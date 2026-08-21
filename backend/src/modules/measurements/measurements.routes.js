const { Router } = require('express');
const measurementsService = require('./measurements.service');
const settingsService = require('../settings/settings.service');
const devicesService = require('../devices/devices.service');
const { createMeasurementSchema, simulateMeasurementSchema } = require('./measurements.validation');
const { requireAuth } = require('../../middlewares/auth');
const { requireDeviceAuth } = require('../../middlewares/deviceAuth');
const { validateBody } = require('../../middlewares/validate');
const { measurementsLimiter } = require('../../middlewares/rateLimit');
const { serializeDevice } = require('../../lib/serializers');

const router = Router();

// Usado pelo ESP32 — autenticado por device_id + X-Device-Key, não por sessão de usuário.
router.post(
  '/',
  measurementsLimiter,
  requireDeviceAuth,
  validateBody(createMeasurementSchema),
  async (req, res, next) => {
    try {
      const measurement = await measurementsService.create(req.device, req.body);
      res.status(201).json({
        id: measurement.id,
        measured_at: measurement.measuredAt,
        received_at: measurement.receivedAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/latest', requireAuth, async (req, res, next) => {
  try {
    const results = await measurementsService.latestByUser(req.userId);

    const payload = await Promise.all(
      results.map(async ({ device, measurement }) => {
        if (!measurement) {
          return { device: serializeDevice(device), measurement: null };
        }
        const settings = await settingsService.getOrCreate(req.userId);
        const thresholds = settingsService.computeThresholds(settings);
        const status = settingsService.evaluateReadingStatus(measurement, thresholds);
        return {
          device: serializeDevice(device),
          measurement: {
            id: measurement.id,
            temperature: measurement.temperature,
            humidity: measurement.humidity,
            measuredAt: measurement.measuredAt,
            ...status,
          },
        };
      }),
    );

    res.json({ latest: payload });
  } catch (err) {
    next(err);
  }
});

// Endpoint de teste protegido (seção 34 do escopo): permite demonstrar o fluxo completo
// (medição -> dashboard -> histórico -> alertas) sem depender do ESP32 físico estar
// conectado. Exige sessão de usuário normal (não a autenticação de dispositivo) e só
// aceita injetar leituras em dispositivos que pertencem ao próprio usuário logado.
router.post('/simulate', requireAuth, validateBody(simulateMeasurementSchema), async (req, res, next) => {
  try {
    const device = await devicesService.findOwned(req.userId, req.body.deviceId);
    const measurement = await measurementsService.create(device, req.body);
    res.status(201).json({
      id: measurement.id,
      measured_at: measurement.measuredAt,
      received_at: measurement.receivedAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
