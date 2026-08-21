const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');
const prisma = require('../src/lib/prisma');

beforeEach(resetDb);
afterAll(closeDb);

async function setupDeviceWithReadings() {
  const owner = await registerAndLogin();
  const deviceRes = await owner.agent.post('/api/devices').send({ name: 'Sensor de Teste' });
  const device = deviceRes.body.device;

  // 5 leituras espaçadas de 1h, 2 delas fora do limite padrão (23-27°C)
  const baseTime = new Date('2026-08-21T10:00:00Z');
  const readings = [
    { temperature: 24, humidity: 60, offsetHours: 0 },
    { temperature: 25, humidity: 61, offsetHours: 1 },
    { temperature: 30, humidity: 62, offsetHours: 2 }, // fora do limite
    { temperature: 26, humidity: 59, offsetHours: 3 },
    { temperature: 31, humidity: 58, offsetHours: 4 }, // fora do limite
  ];

  for (const r of readings) {
    await prisma.measurement.create({
      data: {
        deviceId: device.id,
        temperature: r.temperature,
        humidity: r.humidity,
        measuredAt: new Date(baseTime.getTime() + r.offsetHours * 3600 * 1000),
      },
    });
  }

  return { owner, device, baseTime };
}

describe('GET /api/history', () => {
  test('lista todas as medições do usuário por padrão, mais recentes primeiro', async () => {
    const { owner } = await setupDeviceWithReadings();

    const res = await owner.agent.get('/api/history');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(5);
    expect(new Date(res.body.items[0].measuredAt).getTime()).toBeGreaterThan(
      new Date(res.body.items[1].measuredAt).getTime(),
    );
  });

  test('filtra por status=out_of_range', async () => {
    const { owner } = await setupDeviceWithReadings();

    const res = await owner.agent.get('/api/history').query({ status: 'out_of_range' });

    expect(res.body.total).toBe(2);
    expect(res.body.items.every((i) => i.temperatureStatus === 'out_of_range')).toBe(true);
  });

  test('filtra por status=normal', async () => {
    const { owner } = await setupDeviceWithReadings();

    const res = await owner.agent.get('/api/history').query({ status: 'normal' });

    expect(res.body.total).toBe(3);
  });

  test('filtra por período (dateFrom/dateTo)', async () => {
    const { owner, baseTime } = await setupDeviceWithReadings();

    const res = await owner.agent.get('/api/history').query({
      dateFrom: new Date(baseTime.getTime() + 1 * 3600 * 1000).toISOString(),
      dateTo: new Date(baseTime.getTime() + 3 * 3600 * 1000).toISOString(),
    });

    expect(res.body.total).toBe(3); // offsets 1, 2 e 3
  });

  test('pagina os resultados corretamente', async () => {
    const { owner } = await setupDeviceWithReadings();

    const page1 = await owner.agent.get('/api/history').query({ pageSize: 2, page: 1 });
    const page2 = await owner.agent.get('/api/history').query({ pageSize: 2, page: 2 });
    const page3 = await owner.agent.get('/api/history').query({ pageSize: 2, page: 3 });

    expect(page1.body.items).toHaveLength(2);
    expect(page2.body.items).toHaveLength(2);
    expect(page3.body.items).toHaveLength(1);
    expect(page1.body.total).toBe(5);

    const ids = [...page1.body.items, ...page2.body.items, ...page3.body.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(5); // sem repetição entre páginas
  });
});

describe('GET /api/history/export', () => {
  test('retorna CSV com cabeçalho e uma linha por medição', async () => {
    const { owner } = await setupDeviceWithReadings();

    const res = await owner.agent.get('/api/history/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('data,horario,temperatura_c,umidade_pct,status_temperatura,status_umidade');
    expect(lines).toHaveLength(6); // cabeçalho + 5 medições
  });
});
