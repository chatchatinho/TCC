const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { requireAuth } = require('../../middlewares/auth');
const { validateBody } = require('../../middlewares/validate');
const { updateProfileSchema } = require('./users.validation');
const { serializeUser } = require('../../lib/serializers');
const AppError = require('../../lib/AppError');

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

module.exports = router;
