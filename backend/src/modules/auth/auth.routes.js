const { Router } = require('express');
const authService = require('./auth.service');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('./auth.validation');
const { validateBody } = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { authLimiter } = require('../../middlewares/rateLimit');
const { setSessionCookie, clearSessionCookie, signSessionToken } = require('../../lib/jwt');
const { serializeUser } = require('../../lib/serializers');

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    const token = signSessionToken(user.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await authService.login(req.body);
    const token = signSessionToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// Resposta idêntica exista ou não o e-mail — nunca revela se uma conta está cadastrada.
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: 'Se este e-mail estiver cadastrado, enviamos um link de redefinição.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await authService.getById(req.userId);
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
