const AppError = require('../lib/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

// Middleware de erro central: nunca vaza stack trace ou detalhes internos ao cliente.
// Erros esperados (AppError) retornam a mensagem definida pelo próprio módulo;
// qualquer erro não tratado vira 500 genérico, com o detalhe completo só no log do servidor.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // express.json() rejeita corpo malformado lançando um SyntaxError com esse marcador
  // (do body-parser) — é erro de quem chamou a API (400), não uma falha do servidor.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo da requisição não é um JSON válido.' });
  }

  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}

module.exports = { notFoundHandler, errorHandler };
