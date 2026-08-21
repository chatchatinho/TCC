const express = require('express');
const rateLimit = require('express-rate-limit');
const request = require('supertest');

// Os limitadores REAIS da aplicação (src/middlewares/rateLimit.js) ficam desligados
// durante os testes automatizados (skip: NODE_ENV==='test'), porque os arquivos de
// teste rodam em série no mesmo processo Node e um contador compartilhado geraria 429
// espúrios dependendo da ordem de execução. Este teste verifica o MECANISMO em si —
// mesma biblioteca, mesmo tipo de configuração (janela + limite) — numa instância
// isolada, sem esse skip, provando que a proteção funciona como configurada.
function buildAppWithLimiter(limit) {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  });
  app.get('/protegida', limiter, (req, res) => res.json({ ok: true }));
  return app;
}

test('bloqueia com 429 após exceder o limite de requisições na janela', async () => {
  const app = buildAppWithLimiter(3);

  const first = await request(app).get('/protegida');
  const second = await request(app).get('/protegida');
  const third = await request(app).get('/protegida');
  const fourth = await request(app).get('/protegida');

  expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);
  expect(fourth.status).toBe(429);
  expect(fourth.body.error).toMatch(/muitas tentativas/i);
});

test('requisições dentro do limite continuam sendo aceitas', async () => {
  const app = buildAppWithLimiter(5);

  for (let i = 0; i < 5; i += 1) {
    const res = await request(app).get('/protegida');
    expect(res.status).toBe(200);
  }
});
