// Erro de aplicação com status HTTP explícito, para distinguir erros esperados
// (validação, autenticação, autorização, não encontrado) de bugs inesperados.
// O errorHandler expõe `message` ao cliente apenas para instâncias de AppError;
// qualquer outro erro vira uma mensagem genérica (nunca stack trace ao usuário).
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = AppError;
