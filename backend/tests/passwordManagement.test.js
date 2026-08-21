const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const { resetDb, closeDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/authClient');

beforeEach(resetDb);
afterAll(closeDb);

// Reproduz o mesmo hash usado pelo service (SHA-256 determinístico) para poder inserir
// um token de reset diretamente no banco nos testes, sem depender de envio real de e-mail.
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('PUT /api/users/me/password (troca de senha logada)', () => {
  test('exige a senha atual correta', async () => {
    const { agent, user } = await registerAndLogin({ password: 'SenhaAntiga123' });

    const wrong = await agent.put('/api/users/me/password').send({
      currentPassword: 'SenhaErrada000',
      newPassword: 'SenhaNova456',
    });
    expect(wrong.status).toBe(401);

    const right = await agent.put('/api/users/me/password').send({
      currentPassword: 'SenhaAntiga123',
      newPassword: 'SenhaNova456',
    });
    expect(right.status).toBe(204);

    const loginNova = await request(app).post('/api/auth/login').send({ email: user.email, password: 'SenhaNova456' });
    expect(loginNova.status).toBe(200);
  });

  test('rejeita senha nova fraca', async () => {
    const { agent } = await registerAndLogin({ password: 'SenhaAntiga123' });

    const res = await agent.put('/api/users/me/password').send({
      currentPassword: 'SenhaAntiga123',
      newPassword: '123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot-password + POST /api/auth/reset-password', () => {
  test('forgot-password responde igual para e-mail existente e inexistente (sem enumeração)', async () => {
    await registerAndLogin({ email: 'existe@example.com' });

    const existing = await request(app).post('/api/auth/forgot-password').send({ email: 'existe@example.com' });
    const missing = await request(app).post('/api/auth/forgot-password').send({ email: 'naoexiste@example.com' });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body.message).toBe(missing.body.message);
  });

  test('gera um token de reset persistido no banco para e-mail existente', async () => {
    const { user } = await registerAndLogin({ email: 'comtoken@example.com' });

    await request(app).post('/api/auth/forgot-password').send({ email: 'comtoken@example.com' });

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    expect(dbUser.passwordResetTokenHash).not.toBeNull();
    expect(dbUser.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('redefine a senha com um token válido, e o token não pode ser reusado', async () => {
    const { user } = await registerAndLogin({ email: 'reset@example.com', password: 'SenhaAntiga123' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { email: user.email },
      data: { passwordResetTokenHash: hashResetToken(rawToken), passwordResetExpiresAt: new Date(Date.now() + 3600_000) },
    });

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'SenhaNova456' });
    expect(resetRes.status).toBe(200);

    const loginOld = await request(app).post('/api/auth/login').send({ email: user.email, password: 'SenhaAntiga123' });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post('/api/auth/login').send({ email: user.email, password: 'SenhaNova456' });
    expect(loginNew.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'OutraSenha789' });
    expect(reuse.status).toBe(400);
  });

  test('rejeita token expirado', async () => {
    const { user } = await registerAndLogin({ email: 'expirado@example.com' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { email: user.email },
      data: { passwordResetTokenHash: hashResetToken(rawToken), passwordResetExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'SenhaNova456' });
    expect(res.status).toBe(400);
  });

  test('rejeita token inexistente/inválido', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'token-que-nunca-existiu', newPassword: 'SenhaNova456' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/users/me — avatar de perfil', () => {
  const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  test('aceita uma imagem válida e depois permite remover', async () => {
    const { agent } = await registerAndLogin();

    const uploaded = await agent.put('/api/users/me').send({ avatarData: TINY_PNG });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.user.avatarData).toBe(TINY_PNG);

    const removed = await agent.put('/api/users/me').send({ avatarData: null });
    expect(removed.status).toBe(200);
    expect(removed.body.user.avatarData).toBeNull();
  });

  test('rejeita um data URL que não é imagem', async () => {
    const { agent } = await registerAndLogin();

    const res = await agent.put('/api/users/me').send({ avatarData: 'data:text/plain;base64,aGVsbG8=' });
    expect(res.status).toBe(400);
  });

  test('nunca aceita o userId do corpo da requisição para se passar por outro usuário', async () => {
    const { agent } = await registerAndLogin();
    const otherUser = await registerAndLogin();

    // mesmo tentando, o backend ignora qualquer campo fora do schema (fullName/avatarData)
    const res = await agent.put('/api/users/me').send({ fullName: 'Nome Trocado', userId: otherUser.id });
    expect(res.status).toBe(200);
    expect(res.body.user.id).not.toBe(otherUser.id);
  });
});
