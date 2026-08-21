const rateLimit = require('express-rate-limit');

// Nos testes automatizados (NODE_ENV=test), os limitadores REAIS usados pela aplicação
// ficam desligados: como os arquivos de teste rodam em série no mesmo processo Node
// (--runInBand), um contador em memória compartilhado entre arquivos causaria 429
// espúrios dependendo da ordem de execução. O mecanismo de rate limiting em si continua
// coberto por um teste dedicado (tests/security/rateLimit.test.js) que instancia seu
// próprio limitador isolado, sem esse skip.
const skipInTests = () => process.env.NODE_ENV === 'test';

// Login/registro: alvo clássico de força bruta / enumeração de e-mail.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

// Ingestão de medições: protege contra um dispositivo (ou credencial vazada)
// inundando a API. Generoso o suficiente para leituras a cada poucos segundos.
const measurementsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Limite de envio de medições excedido.' },
});

module.exports = { authLimiter, measurementsLimiter };
