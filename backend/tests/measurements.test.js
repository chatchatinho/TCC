const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

async function setupDevice() {
  const owner = await registerAndLogin();
  const res = await owner.agent.post('/api/devices').send({ name: 'Sensor de Teste' });
  return { owner, device: res.body.device, secret: res.body.deviceSecret };
}

describe('POST /api/measurements (ingestão autenticada por dispositivo)', () => {
  test('leitura válida com token correto é aceita', async () => {
    const { device, secret } = await setupDevice();

    const res = await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: device.deviceIdentifier, temperature: 24.5, humidity: 58 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('token incorreto é rejeitado com 401 e nada é gravado', async () => {
    const { device } = await setupDevice();

    const res = await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', 'token-invalido')
      .send({ device_id: device.deviceIdentifier, temperature: 24.5, humidity: 58 });

    expect(res.status).toBe(401);

    const prisma = require('../src/lib/prisma');
    const count = await prisma.measurement.count();
    expect(count).toBe(0);
  });

  test('device_id inexistente é rejeitado com 401', async () => {
    const res = await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', 'qualquer-coisa')
      .send({ device_id: 'ESP32-NAO-EXISTE', temperature: 24.5, humidity: 58 });

    expect(res.status).toBe(401);
  });

  test('dispositivo desativado é rejeitado com 401', async () => {
    const { owner, device, secret } = await setupDevice();
    await owner.agent.put(`/api/devices/${device.id}`).send({ active: false });

    const res = await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: device.deviceIdentifier, temperature: 24.5, humidity: 58 });

    expect(res.status).toBe(401);
  });

  test.each([
    ['temperatura como texto', { temperature: 'quente', humidity: 58 }],
    ['temperatura fora da faixa física', { temperature: 500, humidity: 58 }],
    ['umidade negativa', { temperature: 24, humidity: -5 }],
    ['umidade acima de 100%', { temperature: 24, humidity: 150 }],
    ['temperatura ausente', { humidity: 58 }],
  ])('dado inválido (%s) é rejeitado com 400', async (_label, overrides) => {
    const { device, secret } = await setupDevice();

    const res = await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: device.deviceIdentifier, ...overrides });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/measurements/latest', () => {
  test('reflete a última leitura e atualiza lastSeenAt do dispositivo', async () => {
    const { owner, device, secret } = await setupDevice();

    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: device.deviceIdentifier, temperature: 24.5, humidity: 58 });

    const res = await owner.agent.get('/api/measurements/latest');

    expect(res.status).toBe(200);
    expect(res.body.latest).toHaveLength(1);
    expect(Number(res.body.latest[0].measurement.temperature)).toBeCloseTo(24.5);
    expect(res.body.latest[0].device.lastSeenAt).not.toBeNull();
  });
});

describe('lastRealMeasurementAt — distinguir hardware real de simulação', () => {
  test('leitura de dispositivo real (POST /api/measurements) grava lastRealMeasurementAt', async () => {
    const { owner, device, secret } = await setupDevice();

    await request(app)
      .post('/api/measurements')
      .set('X-Device-Key', secret)
      .send({ device_id: device.deviceIdentifier, temperature: 24.5, humidity: 58 });

    const res = await owner.agent.get('/api/measurements/latest');
    expect(res.body.latest[0].device.lastRealMeasurementAt).not.toBeNull();
  });

  test('leitura simulada (POST /api/measurements/simulate) NÃO grava lastRealMeasurementAt', async () => {
    const { owner, device } = await setupDevice();

    await owner.agent
      .post('/api/measurements/simulate')
      .send({ deviceId: device.id, temperature: 24.5, humidity: 58 });

    const res = await owner.agent.get('/api/measurements/latest');
    expect(res.body.latest[0].device.lastSeenAt).not.toBeNull();
    expect(res.body.latest[0].device.lastRealMeasurementAt).toBeNull();
  });
});
