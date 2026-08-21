const rateLimit = require('express-rate-limit');

// Login/registro: alvo clássico de força bruta / enumeração de e-mail.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

// Ingestão de medições: protege contra um dispositivo (ou credencial vazada)
// inundando a API. Generoso o suficiente para leituras a cada poucos segundos.
const measurementsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de envio de medições excedido.' },
});

module.exports = { authLimiter, measurementsLimiter };
