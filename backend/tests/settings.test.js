const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

// notifyTemperature/notifyHumidity/notifySoilMoisture e os valores de solo são
// obrigatórios no payload (o frontend sempre manda o estado completo do formulário) —
// este helper evita repetir tudo isso em cada teste que não é sobre eles especificamente.
function payload(overrides) {
  return {
    notifyTemperature: true,
    notifyHumidity: true,
    notifySoilMoisture: true,
    idealSoilMoisture: 40,
    soilMoistureTolerance: 15,
    ...overrides,
  };
}

// Cada dispositivo tem sua própria configuração de limites — os testes precisam de um
// dispositivo cadastrado antes de ler/alterar suas configurações.
async function registerWithDevice(overrides = {}) {
  const auth = await registerAndLogin(overrides);
  const deviceRes = await auth.agent.post('/api/devices').send({ name: 'Sensor de Teste' });
  return { ...auth, device: deviceRes.body.device, deviceSecret: deviceRes.body.deviceSecret };
}

describe('GET /api/devices/:id/settings', () => {
  test('dispositivo recém-cadastrado já tem configurações padrão', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.get(`/api/devices/${device.id}/settings`);

    expect(res.status).toBe(200);
    expect(res.body.thresholds).toEqual({
      temperature: { min: 23, max: 27 },
      humidity: { min: 50, max: 70 },
      soilMoisture: { min: 25, max: 55 },
    });
    expect(res.body.settings.notifyTemperature).toBe(true);
    expect(res.body.settings.notifyHumidity).toBe(true);
  });

  test('retorna 404 para um device_id inexistente', async () => {
    const { agent } = await registerWithDevice();

    const res = await agent.get('/api/devices/00000000-0000-0000-0000-000000000000/settings');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/devices/:id/settings', () => {
  test('valores válidos são salvos e os limites recalculados', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 22,
        temperatureTolerance: 3,
        idealHumidity: 55,
        humidityTolerance: 15,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.thresholds.temperature).toEqual({ min: 19, max: 25 });
    expect(res.body.thresholds.humidity).toEqual({ min: 40, max: 70 });
  });

  test('umidade fora de 0-100 é rejeitada com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 22,
        temperatureTolerance: 3,
        idealHumidity: 130,
        humidityTolerance: 15,
      }),
    );

    expect(res.status).toBe(400);
  });

  test('margem de tolerância zero é rejeitada com 400 (incoerente)', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 22,
        temperatureTolerance: 0,
        idealHumidity: 55,
        humidityTolerance: 15,
      }),
    );

    expect(res.status).toBe(400);
  });

  test('limites de umidade calculados nunca ultrapassam 0-100%, mesmo com margem grande', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        idealHumidity: 95,
        humidityTolerance: 30,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.thresholds.humidity).toEqual({ min: 65, max: 100 });
  });

  test('rejeita com 400 se notifyTemperature/notifyHumidity estiverem ausentes', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send({
      idealTemperature: 25,
      temperatureTolerance: 2,
      idealHumidity: 60,
      humidityTolerance: 10,
    });

    expect(res.status).toBe(400);
  });

  test('retorna 404 para um device_id inexistente', async () => {
    const { agent } = await registerWithDevice();

    const res = await agent
      .put('/api/devices/00000000-0000-0000-0000-000000000000/settings')
      .send(payload({ idealTemperature: 25, temperatureTolerance: 2, idealHumidity: 60, humidityTolerance: 10 }));

    expect(res.status).toBe(404);
  });

  test('cada dispositivo mantém sua própria configuração, independente dos demais', async () => {
    const { agent, device: deviceA } = await registerWithDevice();
    const deviceBRes = await agent.post('/api/devices').send({ name: 'Segundo Sensor' });
    const deviceB = deviceBRes.body.device;

    await agent.put(`/api/devices/${deviceA.id}/settings`).send(
      payload({ idealTemperature: 15, temperatureTolerance: 1, idealHumidity: 40, humidityTolerance: 5 }),
    );
    await agent.put(`/api/devices/${deviceB.id}/settings`).send(
      payload({ idealTemperature: 30, temperatureTolerance: 4, idealHumidity: 70, humidityTolerance: 20 }),
    );

    const resA = await agent.get(`/api/devices/${deviceA.id}/settings`);
    const resB = await agent.get(`/api/devices/${deviceB.id}/settings`);

    expect(resA.body.thresholds.temperature).toEqual({ min: 14, max: 16 });
    expect(resB.body.thresholds.temperature).toEqual({ min: 26, max: 34 });
  });
});

describe('PUT /api/devices/:id/settings — taxa mínima/máxima opcional', () => {
  test('taxa mínima/máxima definida substitui o cálculo automático daquele lado', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        temperatureMin: 10,
        temperatureMax: 30,
        idealHumidity: 60,
        humidityTolerance: 10,
        humidityMin: null,
        humidityMax: 80,
      }),
    );

    expect(res.status).toBe(200);
    // ideal ± tolerância daria 23-27, mas a taxa explícita substitui os dois lados.
    expect(res.body.thresholds.temperature).toEqual({ min: 10, max: 30 });
    // só o máximo foi sobrescrito; o mínimo continua vindo do cálculo automático (50).
    expect(res.body.thresholds.humidity).toEqual({ min: 50, max: 80 });
  });

  test('taxa mínima maior ou igual à máxima é rejeitada com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        temperatureMin: 30,
        temperatureMax: 10,
        idealHumidity: 60,
        humidityTolerance: 10,
      }),
    );

    expect(res.status).toBe(400);
  });

  test('enviar null limpa uma taxa definida anteriormente, voltando ao cálculo automático', async () => {
    const { agent, device } = await registerWithDevice();

    await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        temperatureMin: 10,
        temperatureMax: 30,
        idealHumidity: 60,
        humidityTolerance: 10,
      }),
    );

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        temperatureMin: null,
        temperatureMax: null,
        idealHumidity: 60,
        humidityTolerance: 10,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.thresholds.temperature).toEqual({ min: 23, max: 27 });
  });
});

describe('PUT /api/devices/:id/settings — notificar por variável', () => {
  const BASE = {
    idealTemperature: 25,
    temperatureTolerance: 2,
    idealHumidity: 60,
    humidityTolerance: 10,
    idealSoilMoisture: 40,
    soilMoistureTolerance: 15,
    notifySoilMoisture: true,
  };

  test('com notifyHumidity desligado, leitura de umidade fora do limite não cria alerta', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();

    await agent
      .put(`/api/devices/${device.id}/settings`)
      .send({ ...BASE, notifyTemperature: true, notifyHumidity: false });

    const request = require('supertest');
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', deviceSecret)
      .send({ device_id: device.deviceIdentifier, temperature: 25, humidity: 95 }); // umidade bem fora do limite (50-70)

    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'humidity')).toHaveLength(0);
  });

  test('com notifyTemperature desligado, temperatura fora do limite não cria alerta, mas umidade continua normal', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();

    await agent
      .put(`/api/devices/${device.id}/settings`)
      .send({ ...BASE, notifyTemperature: false, notifyHumidity: true });

    const request = require('supertest');
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', deviceSecret)
      .send({ device_id: device.deviceIdentifier, temperature: 50, humidity: 95 }); // ambos fora do limite

    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'temperature')).toHaveLength(0);
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'humidity')).toHaveLength(1);
  });

  test('desligar a notificação não deixa um alerta já ativo preso: ele ainda se resolve ao voltar ao normal', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();
    const request = require('supertest');

    // Umidade fora do limite com notificação ligada -> abre o alerta.
    await agent
      .put(`/api/devices/${device.id}/settings`)
      .send({ ...BASE, notifyTemperature: true, notifyHumidity: true });
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', deviceSecret)
      .send({ device_id: device.deviceIdentifier, temperature: 25, humidity: 95 });

    // Desliga a notificação de umidade enquanto o alerta ainda está ativo.
    await agent
      .put(`/api/devices/${device.id}/settings`)
      .send({ ...BASE, notifyTemperature: true, notifyHumidity: false });

    // Leitura volta ao normal — o alerta já aberto deve se resolver mesmo assim.
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', deviceSecret)
      .send({ device_id: device.deviceIdentifier, temperature: 25, humidity: 60 });

    const alertsRes = await agent.get('/api/alerts');
    const humidityAlerts = alertsRes.body.alerts.filter((a) => a.variable === 'humidity');
    expect(humidityAlerts).toHaveLength(1);
    expect(humidityAlerts[0].status).toBe('resolved');
  });
});

describe('PUT /api/devices/:id/settings — umidade do solo', () => {
  test('valores válidos de solo são salvos e os limites recalculados', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        idealHumidity: 60,
        humidityTolerance: 10,
        idealSoilMoisture: 45,
        soilMoistureTolerance: 20,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.thresholds.soilMoisture).toEqual({ min: 25, max: 65 });
  });

  test('umidade do solo fora de 0-100 é rejeitada com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        idealHumidity: 60,
        humidityTolerance: 10,
        idealSoilMoisture: 130,
      }),
    );

    expect(res.status).toBe(400);
  });

  test('taxa mínima de solo maior ou igual à máxima é rejeitada com 400', async () => {
    const { agent, device } = await registerWithDevice();

    const res = await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        idealHumidity: 60,
        humidityTolerance: 10,
        soilMoistureMin: 50,
        soilMoistureMax: 20,
      }),
    );

    expect(res.status).toBe(400);
  });

  test('com notifySoilMoisture desligado, leitura de solo fora do limite não cria alerta', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();

    await agent.put(`/api/devices/${device.id}/settings`).send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        idealHumidity: 60,
        humidityTolerance: 10,
        notifySoilMoisture: false,
      }),
    );

    const request = require('supertest');
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', deviceSecret)
      .send({ device_id: device.deviceIdentifier, temperature: 25, humidity: 60, soilMoisture: 5 }); // bem abaixo do limite (25-55)

    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'soil_moisture')).toHaveLength(0);
  });

  test('uma leitura sem o sensor de solo (soilMoisture ausente) não afeta o status de solo nem cria alerta', async () => {
    const { agent, device, deviceSecret } = await registerWithDevice();

    const request = require('supertest');
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', deviceSecret)
      .send({ device_id: device.deviceIdentifier, temperature: 25, humidity: 60 });

    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'soil_moisture')).toHaveLength(0);
  });
});
