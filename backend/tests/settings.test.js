const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

describe('GET /api/settings', () => {
  test('usuário recém-cadastrado já tem configurações padrão', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.thresholds).toEqual({ temperature: { min: 23, max: 27 }, humidity: { min: 50, max: 70 } });
  });
});

describe('PUT /api/settings', () => {
  test('valores válidos são salvos e os limites recalculados', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send({
      idealTemperature: 22,
      temperatureTolerance: 3,
      idealHumidity: 55,
      humidityTolerance: 15,
    });

    expect(res.status).toBe(200);
    expect(res.body.thresholds.temperature).toEqual({ min: 19, max: 25 });
    expect(res.body.thresholds.humidity).toEqual({ min: 40, max: 70 });
  });

  test('umidade fora de 0-100 é rejeitada com 400', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send({
      idealTemperature: 22,
      temperatureTolerance: 3,
      idealHumidity: 130,
      humidityTolerance: 15,
    });

    expect(res.status).toBe(400);
  });

  test('margem de tolerância zero é rejeitada com 400 (incoerente)', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send({
      idealTemperature: 22,
      temperatureTolerance: 0,
      idealHumidity: 55,
      humidityTolerance: 15,
    });

    expect(res.status).toBe(400);
  });

  test('limites de umidade calculados nunca ultrapassam 0-100%, mesmo com margem grande', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/settings').send({
      idealTemperature: 25,
      temperatureTolerance: 2,
      idealHumidity: 95,
      humidityTolerance: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.thresholds.humidity).toEqual({ min: 65, max: 100 });
  });
});
