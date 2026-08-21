const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { requireAuth } = require('../../middlewares/auth');
const { validateBody } = require('../../middlewares/validate');
const { updateProfileSchema, changePasswordSchema } = require('./users.validation');
const { serializeUser } = require('../../lib/serializers');
const AppError = require('../../lib/AppError');
const authService = require('../auth/auth.service');

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError(401, 'Sessão inválida.');
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

// E-mail e data de nascimento não são editáveis por este endpoint: e-mail é o
// identificador único de login (trocá-lo exigiria um fluxo de reconfirmação, fora
// do escopo do TCC) e data de nascimento é um dado cadastral fixo.
router.put('/me', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: req.body,
    });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

// Exige a senha atual — nunca troca a senha só com a sessão válida (seção 39/47: uma
// sessão roubada sozinha não deveria bastar para assumir a conta permanentemente).
router.put('/me/password', validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    await authService.changePassword(req.userId, req.body.currentPassword, req.body.newPassword);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
