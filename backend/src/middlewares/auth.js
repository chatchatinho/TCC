const AppError = require('../lib/AppError');
const { SESSION_COOKIE_NAME, verifySessionToken } = require('../lib/jwt');

// Protege rotas privadas: exige um JWT de sessão válido no cookie httpOnly.
// Nunca confia em um userId vindo do corpo/query da requisição — sempre usa
// req.userId, derivado exclusivamente do token assinado pelo servidor.
function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return next(new AppError(401, 'Não autenticado.'));
  }

  try {
    req.userId = verifySessionToken(token);
    next();
  } catch (err) {
    next(new AppError(401, 'Sessão inválida ou expirada.'));
  }
}

module.exports = { requireAuth };
