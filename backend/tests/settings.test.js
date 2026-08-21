const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

// notifyTemperature/notifyHumidity são obrigatórios no payload (o frontend sempre
// manda o estado completo do formulário) — este helper evita repetir os dois em cada
// teste que não é sobre eles especificamente.
function payload(overrides) {
  return { notifyTemperature: true, notifyHumidity: true, ...overrides };
}

describe('GET /api/settings', () => {
  test('usuário recém-cadastrado já tem configurações padrão', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.thresholds).toEqual({ temperature: { min: 23, max: 27 }, humidity: { min: 50, max: 70 } });
    expect(res.body.settings.notifyTemperature).toBe(true);
    expect(res.body.settings.notifyHumidity).toBe(true);
  });
});

describe('PUT /api/settings', () => {
  test('valores válidos são salvos e os limites recalculados', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send(
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
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send(
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
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send(
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
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send(
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
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send({
      idealTemperature: 25,
      temperatureTolerance: 2,
      idealHumidity: 60,
      humidityTolerance: 10,
    });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/settings — taxa mínima/máxima opcional', () => {
  test('taxa mínima/máxima definida substitui o cálculo automático daquele lado', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send(
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
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send(
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
    const { agent } = await registerAndLogin();

    await agent.put('/api/settings').send(
      payload({
        idealTemperature: 25,
        temperatureTolerance: 2,
        temperatureMin: 10,
        temperatureMax: 30,
        idealHumidity: 60,
        humidityTolerance: 10,
      }),
    );

    const res = await agent.put('/api/settings').send(
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

describe('PUT /api/settings — notificar por variável', () => {
  const BASE = { idealTemperature: 25, temperatureTolerance: 2, idealHumidity: 60, humidityTolerance: 10 };

  test('com notifyHumidity desligado, leitura de umidade fora do limite não cria alerta', async () => {
    const { agent } = await registerAndLogin();
    const deviceRes = await agent.post('/api/devices').send({ name: 'Sensor de Teste' });
    const secret = deviceRes.body.deviceSecret;
    const deviceId = deviceRes.body.device.deviceIdentifier;

    await agent.put('/api/settings').send({ ...BASE, notifyTemperature: true, notifyHumidity: false });

    const request = require('supertest');
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: deviceId, temperature: 25, humidity: 95 }); // umidade bem fora do limite (50-70)

    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'humidity')).toHaveLength(0);
  });

  test('com notifyTemperature desligado, temperatura fora do limite não cria alerta, mas umidade continua normal', async () => {
    const { agent } = await registerAndLogin();
    const deviceRes = await agent.post('/api/devices').send({ name: 'Sensor de Teste' });
    const secret = deviceRes.body.deviceSecret;
    const deviceId = deviceRes.body.device.deviceIdentifier;

    await agent.put('/api/settings').send({ ...BASE, notifyTemperature: false, notifyHumidity: true });

    const request = require('supertest');
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: deviceId, temperature: 50, humidity: 95 }); // ambos fora do limite

    const alertsRes = await agent.get('/api/alerts');
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'temperature')).toHaveLength(0);
    expect(alertsRes.body.alerts.filter((a) => a.variable === 'humidity')).toHaveLength(1);
  });

  test('desligar a notificação não deixa um alerta já ativo preso: ele ainda se resolve ao voltar ao normal', async () => {
    const { agent } = await registerAndLogin();
    const deviceRes = await agent.post('/api/devices').send({ name: 'Sensor de Teste' });
    const secret = deviceRes.body.deviceSecret;
    const deviceId = deviceRes.body.device.deviceIdentifier;
    const request = require('supertest');

    // Umidade fora do limite com notificação ligada -> abre o alerta.
    await agent.put('/api/settings').send({ ...BASE, notifyTemperature: true, notifyHumidity: true });
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: deviceId, temperature: 25, humidity: 95 });

    // Desliga a notificação de umidade enquanto o alerta ainda está ativo.
    await agent.put('/api/settings').send({ ...BASE, notifyTemperature: true, notifyHumidity: false });

    // Leitura volta ao normal — o alerta já aberto deve se resolver mesmo assim.
    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: deviceId, temperature: 25, humidity: 60 });

    const alertsRes = await agent.get('/api/alerts');
    const humidityAlerts = alertsRes.body.alerts.filter((a) => a.variable === 'humidity');
    expect(humidityAlerts).toHaveLength(1);
    expect(humidityAlerts[0].status).toBe('resolved');
  });
});
