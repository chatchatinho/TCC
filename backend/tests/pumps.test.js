const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

async function registerWithDevice(overrides = {}) {
  const auth = await registerAndLogin(overrides);
  const deviceRes = await auth.agent.post('/api/devices').send({ name: 'Sensor de Teste' });
  return { ...auth, device: deviceRes.body.device, deviceSecret: deviceRes.body.deviceSecret };
}

// Envia uma leitura autenticada por dispositivo (mesma rota do ESP32 real), com um
// `timestamp` explícito — é assim que os testes abaixo simulam o "período estipulado"
// decorrido sem precisar esperar tempo de verdade.
function sendReading(deviceSecret, deviceIdentifier, { soilMoisture, measuredAt }) {
  return request(app)
    .post('/api/measurements')
    .set('X-Device-Key', deviceSecret)
    .send({ device_id: deviceIdentifier, temperature: 25, humidity: 60, soilMoisture, timestamp: measuredAt.toISOString() });
}

describe('GET /api/devices/:id/pump', () => {
  test('dispositivo recém-cadastrado já tem uma bomba com valores padrão', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.get(`/api/devices/${device.id}/pump`);

    expect(res.status).toBe(200);
    expect(res.body.pump).toMatchObject({
      mode: 'notify_only',
      moistureThreshold: '30',
      belowThresholdMinutes: 30,
      isOn: false,
    });
  });

  test('retorna 404 para um device_id inexistente', async () => {
    const { agent } = await registerWithDevice();

    const res = await agent.get('/api/devices/00000000-0000-0000-0000-000000000000/pump');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/devices/:id/pump', () => {
  test('salva modo, limite e período válidos', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'automatic', moistureThreshold: 25, belowThresholdMinutes: 15 });

    expect(res.status).toBe(200);
    expect(res.body.pump).toMatchObject({ mode: 'automatic', moistureThreshold: '25', belowThresholdMinutes: 15 });
  });

  test('rejeita um modo inválido com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'ligado', moistureThreshold: 30, belowThresholdMinutes: 30 });

    expect(res.status).toBe(400);
  });

  test('rejeita período menor que 1 minuto com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'automatic', moistureThreshold: 30, belowThresholdMinutes: 0 });

    expect(res.status).toBe(400);
  });

  test('rejeita limite de umidade fora de 0-100 com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'automatic', moistureThreshold: 130, belowThresholdMinutes: 30 });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/devices/:id/pump/toggle', () => {
  test('liga e desliga manualmente, independente do modo', async () => {
    const { agent, device } = await registerWithDevice();
    await agent.put(`/api/devices/${device.id}/pump`).send({ mode: 'manual', moistureThreshold: 30, belowThresholdMinutes: 30 });

    const onRes = await agent.post(`/api/devices/${device.id}/pump/toggle`).send({ isOn: true });
    expect(onRes.status).toBe(200);
    expect(onRes.body.pump.isOn).toBe(true);
    expect(onRes.body.pump.turnedOnAt).not.toBeNull();

    const offRes = await agent.post(`/api/devices/${device.id}/pump/toggle`).send({ isOn: false });
    expect(offRes.status).toBe(200);
    expect(offRes.body.pump.isOn).toBe(false);
    expect(offRes.body.pump.turnedOnAt).toBeNull();
  });

  test('retorna 404 para um device_id inexistente', async () => {
    const { agent } = await registerWithDevice();

    const res = await agent
      .post('/api/devices/00000000-0000-0000-0000-000000000000/pump/toggle')
      .send({ isOn: true });

    expect(res.status).toBe(404);
  });
});

describe('acionamento automático a partir de leituras de umidade do solo', () => {
  test('modo automatic liga a bomba sozinha só depois do período estipulado abaixo do limite', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();
    await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'automatic', moistureThreshold: 30, belowThresholdMinutes: 20 });

    const now = new Date();
    const start = new Date(now.getTime() - 20 * 60 * 1000);

    // Primeira leitura seca: só começa a contar o período, ainda não liga.
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: start });
    const afterFirst = await agent.get(`/api/devices/${device.id}/pump`);
    expect(afterFirst.body.pump.isOn).toBe(false);

    // Segunda leitura seca, exatamente 20 minutos depois da primeira: o período
    // estipulado foi cumprido, a bomba liga sozinha.
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: now });
    const afterSecond = await agent.get(`/api/devices/${device.id}/pump`);
    expect(afterSecond.body.pump.isOn).toBe(true);
    expect(afterSecond.body.pump.turnedOnAt).not.toBeNull();
  });

  test('a bomba desliga sozinha (modo automatic) assim que a umidade volta ao normal', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();
    await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'automatic', moistureThreshold: 30, belowThresholdMinutes: 20 });

    const now = new Date();
    const start = new Date(now.getTime() - 20 * 60 * 1000);
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: start });
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: now });

    const ligada = await agent.get(`/api/devices/${device.id}/pump`);
    expect(ligada.body.pump.isOn).toBe(true);

    const depois = new Date(now.getTime() + 5 * 60 * 1000);
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 50, measuredAt: depois });

    const desligada = await agent.get(`/api/devices/${device.id}/pump`);
    expect(desligada.body.pump.isOn).toBe(false);
    expect(desligada.body.pump.turnedOnAt).toBeNull();
  });

  test('modo notify_only nunca liga a bomba sozinha, mesmo com o solo seco pelo período todo', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();
    await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'notify_only', moistureThreshold: 30, belowThresholdMinutes: 20 });

    const now = new Date();
    const start = new Date(now.getTime() - 20 * 60 * 1000);
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: start });
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: now });

    const res = await agent.get(`/api/devices/${device.id}/pump`);
    expect(res.body.pump.isOn).toBe(false);

    // Mesmo sem ligar a bomba, o alerta de umidade do solo continua sendo gerado
    // normalmente — só o acionamento automático é que fica desligado nesse modo.
    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'soil_moisture' && a.status === 'active')).toHaveLength(1);
  });

  test('modo manual nunca liga a bomba sozinha, mesmo com o solo seco pelo período todo', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();
    await agent
      .put(`/api/devices/${device.id}/pump`)
      .send({ mode: 'manual', moistureThreshold: 30, belowThresholdMinutes: 20 });

    const now = new Date();
    const start = new Date(now.getTime() - 20 * 60 * 1000);
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: start });
    await sendReading(deviceSecret, device.deviceIdentifier, { soilMoisture: 20, measuredAt: now });

    const res = await agent.get(`/api/devices/${device.id}/pump`);
    expect(res.body.pump.isOn).toBe(false);
  });
});
