const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

// Isolamento entre usuários (seção 7/21 do escopo): usuário A nunca deve conseguir ler,
// alterar ou apagar dados que pertencem ao usuário B — e o erro deve ser 404 (não 403),
// para não confirmar a existência do recurso a quem não tem acesso a ele.
describe('isolamento entre usuários', () => {
  async function setupTwoUsersWithDevice() {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    const deviceRes = await userA.agent.post('/api/devices').send({ name: 'Dispositivo de A' });
    return { userA, userB, device: deviceRes.body.device };
  }

  test('usuário B não vê o dispositivo de A na sua listagem', async () => {
    const { userB } = await setupTwoUsersWithDevice();

    const res = await userB.agent.get('/api/devices');

    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(0);
  });

  test('usuário B não pode editar o dispositivo de A (404)', async () => {
    const { userB, device } = await setupTwoUsersWithDevice();

    const res = await userB.agent.put(`/api/devices/${device.id}`).send({ name: 'Hackeado' });

    expect(res.status).toBe(404);
  });

  test('usuário B não pode remover o dispositivo de A (404)', async () => {
    const { userB, device } = await setupTwoUsersWithDevice();

    const res = await userB.agent.delete(`/api/devices/${device.id}`);

    expect(res.status).toBe(404);
  });

  test('usuário B não pode regenerar o token do dispositivo de A (404)', async () => {
    const { userB, device } = await setupTwoUsersWithDevice();

    const res = await userB.agent.post(`/api/devices/${device.id}/rotate-secret`);

    expect(res.status).toBe(404);
  });

  test('usuário B não pode simular uma medição no dispositivo de A (404)', async () => {
    const { userB, device } = await setupTwoUsersWithDevice();

    const res = await userB.agent
      .post('/api/measurements/simulate')
      .send({ deviceId: device.id, temperature: 25, humidity: 55 });

    expect(res.status).toBe(404);
  });

  test('usuário B não pode filtrar o histórico pelo dispositivo de A (404)', async () => {
    const { userB, device } = await setupTwoUsersWithDevice();

    const res = await userB.agent.get('/api/history').query({ deviceId: device.id });

    expect(res.status).toBe(404);
  });

  test('o histórico do usuário B nunca inclui medições do dispositivo de A', async () => {
    const { userA, userB, device } = await setupTwoUsersWithDevice();
    const prisma = require('../src/lib/prisma');

    await prisma.measurement.create({
      data: { deviceId: device.id, temperature: 25, humidity: 55, measuredAt: new Date() },
    });

    const resB = await userB.agent.get('/api/history');
    expect(resB.status).toBe(200);
    expect(resB.body.items).toHaveLength(0);

    // sanity check: userA (dono) vê a própria medição normalmente
    const resA = await userA.agent.get('/api/history');
    expect(resA.body.items).toHaveLength(1);
  });
});

describe('rotas privadas sem autenticação', () => {
  test.each([
    ['get', '/api/devices'],
    ['get', '/api/settings'],
    ['get', '/api/history'],
    ['get', '/api/alerts'],
    ['get', '/api/measurements/latest'],
  ])('%s %s retorna 401 sem sessão', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});
