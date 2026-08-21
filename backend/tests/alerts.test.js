const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

// Configurações padrão criadas no registro (ver auth.service.js): temperatura ideal 25°C
// ± 2°C -> faixa aceitável [23, 27]. Umidade ideal 60% ± 10% -> faixa aceitável [50, 70].

async function setupDevice() {
  const owner = await registerAndLogin();
  const res = await owner.agent.post('/api/devices').send({ name: 'Sensor de Teste' });
  return { owner, device: res.body.device };
}

function simulate(agent, deviceId, temperature, humidity) {
  return agent.post('/api/measurements/simulate').send({ deviceId, temperature, humidity });
}

describe('motor de alertas — evita spam em leituras consecutivas fora do limite', () => {
  test('leitura dentro do limite não cria alerta', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 25, 60);

    const res = await owner.agent.get('/api/alerts');
    expect(res.body.alerts).toHaveLength(0);
  });

  test('leitura acima do limite cria alerta ativo com direction=above_max', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 30, 60);

    const res = await owner.agent.get('/api/alerts?status=active');
    expect(res.body.alerts).toHaveLength(1);
    expect(res.body.alerts[0]).toMatchObject({ variable: 'temperature', direction: 'above_max', status: 'active' });
  });

  test('leitura abaixo do limite cria alerta ativo com direction=below_min', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 10, 60);

    const res = await owner.agent.get('/api/alerts?status=active');
    expect(res.body.alerts).toHaveLength(1);
    expect(res.body.alerts[0]).toMatchObject({ variable: 'temperature', direction: 'below_min', status: 'active' });
  });

  test('4 leituras seguidas fora do limite geram 1 único alerta, com o pico atualizado', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 28.0, 60);
    await simulate(owner.agent, device.id, 28.2, 60);
    await simulate(owner.agent, device.id, 28.5, 60); // pico
    await simulate(owner.agent, device.id, 28.3, 60);

    const res = await owner.agent.get('/api/alerts?status=active');
    expect(res.body.alerts).toHaveLength(1);
    expect(Number(res.body.alerts[0].peakValue)).toBeCloseTo(28.5);
  });

  test('voltar ao normal encerra o alerta (status=resolved, endedAt preenchido)', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 30, 60);
    await simulate(owner.agent, device.id, 25, 60);

    const active = await owner.agent.get('/api/alerts?status=active');
    expect(active.body.alerts).toHaveLength(0);

    const resolved = await owner.agent.get('/api/alerts?status=resolved');
    expect(resolved.body.alerts).toHaveLength(1);
    expect(resolved.body.alerts[0].endedAt).not.toBeNull();
  });

  test('um novo desvio após o fechamento cria um alerta NOVO (não reabre o antigo)', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 30, 60); // abre
    await simulate(owner.agent, device.id, 25, 60); // fecha
    await simulate(owner.agent, device.id, 31, 60); // abre de novo

    const res = await owner.agent.get('/api/alerts');
    expect(res.body.alerts).toHaveLength(2);
    expect(res.body.alerts.filter((a) => a.status === 'active')).toHaveLength(1);
    expect(res.body.alerts.filter((a) => a.status === 'resolved')).toHaveLength(1);
  });

  test('temperatura e umidade fora do limite ao mesmo tempo geram 2 alertas independentes', async () => {
    const { owner, device } = await setupDevice();

    await simulate(owner.agent, device.id, 30, 90);

    const res = await owner.agent.get('/api/alerts?status=active');
    expect(res.body.alerts.map((a) => a.variable).sort()).toEqual(['humidity', 'temperature']);
  });
});

describe('GET /api/alerts/summary e PATCH /api/alerts/:id/read', () => {
  test('summary conta alertas não lidos; marcar como lido reduz a contagem', async () => {
    const { owner, device } = await setupDevice();
    await simulate(owner.agent, device.id, 30, 60);

    const before = await owner.agent.get('/api/alerts/summary');
    expect(before.body.unreadCount).toBe(1);

    const list = await owner.agent.get('/api/alerts');
    const alertId = list.body.alerts[0].id;

    const readRes = await owner.agent.patch(`/api/alerts/${alertId}/read`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.alert.readAt).not.toBeNull();

    const after = await owner.agent.get('/api/alerts/summary');
    expect(after.body.unreadCount).toBe(0);
  });
});
