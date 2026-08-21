const { Router } = require('express');
const alertsService = require('./alerts.service');
const { listAlertsQuerySchema } = require('./alerts.validation');
const { requireAuth } = require('../../middlewares/auth');
const { validateQuery } = require('../../middlewares/validate');

const router = Router();
router.use(requireAuth);

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await alertsService.summary(req.userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/', validateQuery(listAlertsQuerySchema), async (req, res, next) => {
  try {
    const result = await alertsService.list(req.userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const alert = await alertsService.markRead(req.userId, req.params.id);
    res.json({ alert });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
