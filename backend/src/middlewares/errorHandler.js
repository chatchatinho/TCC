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

  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}

module.exports = { notFoundHandler, errorHandler };
