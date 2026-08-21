const AppError = require('../lib/AppError');

// Valida req.body (ou req.query) contra um schema Zod. Em caso de falha, retorna
// 400 com a lista de problemas — nunca deixa dado não validado chegar ao service.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(400, 'Dados inválidos.', result.error.flatten().fieldErrors));
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new AppError(400, 'Parâmetros inválidos.', result.error.flatten().fieldErrors));
    }
    req.query = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery };
