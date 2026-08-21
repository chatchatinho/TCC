const { Router } = require('express');
const settingsService = require('./settings.service');
const { updateSettingsSchema } = require('./settings.validation');
const { requireAuth } = require('../../middlewares/auth');
const { validateBody } = require('../../middlewares/validate');

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const settings = await settingsService.getOrCreate(req.userId);
    res.json({ settings, thresholds: settingsService.computeThresholds(settings) });
  } catch (err) {
    next(err);
  }
});

router.put('/', validateBody(updateSettingsSchema), async (req, res, next) => {
  try {
    const settings = await settingsService.update(req.userId, req.body);
    res.json({ settings, thresholds: settingsService.computeThresholds(settings) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
