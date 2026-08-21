const request = require('supertest');
const app = require('../../src/app');

let counter = 0;

// Cria um agente supertest (mantém o cookie de sessão entre requisições) já com um
// usuário cadastrado e logado — usado por vários arquivos de teste para não repetir
// o boilerplate de registro em cada caso.
async function registerAndLogin(overrides = {}) {
  counter += 1;
  const agent = request.agent(app);
  const user = {
    fullName: 'Usuário de Teste',
    email: `usuario${counter}@example.com`,
    password: 'Senha123',
    birthDate: '1990-01-01',
    ...overrides,
  };

  const res = await agent.post('/api/auth/register').send(user);
  return { agent, user, id: res.body.user.id };
}

module.exports = { registerAndLogin };
