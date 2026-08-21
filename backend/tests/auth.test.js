const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');

beforeEach(resetDb);
afterAll(closeDb);

const validUser = {
  fullName: 'Maria Silva',
  email: 'maria@example.com',
  password: 'Senha123',
  birthDate: '1995-05-20',
};

describe('POST /api/auth/register', () => {
  test('cadastro válido cria o usuário e inicia sessão', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ fullName: validUser.fullName, email: validUser.email });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^session=/);
  });

  test('e-mail duplicado é rejeitado com 409', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
  });

  test('e-mail inválido é rejeitado com 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'nao-e-um-email' });

    expect(res.status).toBe(400);
  });

  test('senha fraca (curta, sem número) é rejeitada com 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'outro@example.com', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.details.password).toBeDefined();
  });

  test('data de nascimento no futuro é rejeitada com 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'outro2@example.com', birthDate: '2099-01-01' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  test('credenciais corretas autenticam o usuário', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.headers['set-cookie'][0]).toMatch(/^session=/);
  });

  test('senha incorreta retorna 401 com mensagem genérica', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'senhaErrada123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha inválidos.');
  });

  test('e-mail inexistente retorna a MESMA mensagem genérica (não revela qual campo errou)', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'senhaErrada123' });

    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'naoexiste@example.com', password: 'qualquerSenha123' });

    expect(wrongEmail.status).toBe(401);
    expect(wrongEmail.body.error).toBe(wrongPassword.body.error);
  });

  test('lastLoginAt mostra o login ANTERIOR, não o desta própria sessão', async () => {
    // Primeiro login: acabou de se cadastrar, nunca logou antes -> null.
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(first.body.user.lastLoginAt).toBeNull();

    // Segundo login: deve mostrar QUANDO foi o primeiro login, não o de agora.
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(second.body.user.lastLoginAt).not.toBeNull();

    // Terceiro login (via /me com a sessão do segundo) já reflete o login anterior salvo.
    const meRes = await request(app).get('/api/auth/me').set('Cookie', second.headers['set-cookie']);
    expect(meRes.body.user.lastLoginAt).not.toBeNull();
  });
});

describe('GET /api/auth/me', () => {
  test('sem sessão retorna 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('com sessão válida retorna o usuário autenticado', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validUser);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });
});

describe('POST /api/auth/logout', () => {
  test('encerra a sessão — /me deixa de funcionar depois', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validUser);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});
