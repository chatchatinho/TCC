const { Router } = require('express');
const devicesService = require('./devices.service');
const settingsService = require('../settings/settings.service');
const { createDeviceSchema, updateDeviceSchema } = require('./devices.validation');
const { updateSettingsSchema } = require('../settings/settings.validation');
const { requireAuth } = require('../../middlewares/auth');
const { validateBody } = require('../../middlewares/validate');
const { serializeDevice } = require('../../lib/serializers');

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const devices = await devicesService.list(req.userId);
    res.json({ devices: devices.map(serializeDevice) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validateBody(createDeviceSchema), async (req, res, next) => {
  try {
    const { device, secret } = await devicesService.create(req.userId, req.body);
    // O token só existe em texto puro nesta resposta — o cliente deve salvá-lo agora.
    res.status(201).json({ device: serializeDevice(device), deviceSecret: secret });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validateBody(updateDeviceSchema), async (req, res, next) => {
  try {
    const device = await devicesService.update(req.userId, req.params.id, req.body);
    res.json({ device: serializeDevice(device) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await devicesService.remove(req.userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rotate-secret', async (req, res, next) => {
  try {
    const { device, secret } = await devicesService.rotateSecret(req.userId, req.params.id);
    res.json({ device: serializeDevice(device), deviceSecret: secret });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/settings', async (req, res, next) => {
  try {
    const device = await devicesService.findOwned(req.userId, req.params.id);
    const settings = await settingsService.getOrCreate(device.id);
    res.json({ settings, thresholds: settingsService.computeThresholds(settings) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/settings', validateBody(updateSettingsSchema), async (req, res, next) => {
  try {
    const device = await devicesService.findOwned(req.userId, req.params.id);
    const settings = await settingsService.update(device.id, req.body);
    res.json({ settings, thresholds: settingsService.computeThresholds(settings) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
