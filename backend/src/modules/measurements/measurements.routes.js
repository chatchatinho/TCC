const { Router } = require('express');
const measurementsService = require('./measurements.service');
const settingsService = require('../settings/settings.service');
const pumpsService = require('../pumps/pumps.service');
const { createMeasurementSchema } = require('./measurements.validation');
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
      // A bomba pode ter mudado de estado (automaticamente, no modo automatic, ou
      // manualmente pelo app) desde a última leitura deste dispositivo. Devolver o
      // estado atual aqui deixa o próprio ESP32 acionar o relé, sem precisar de uma
      // autenticação de usuário separada — ele já está autenticado por X-Device-Key.
      const pump = await pumpsService.getOrCreate(req.device.id);
      res.status(201).json({
        id: measurement.id,
        measured_at: measurement.measuredAt,
        received_at: measurement.receivedAt,
        pump: { isOn: pump.isOn },
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
        const settings = await settingsService.getOrCreate(device.id);
        const thresholds = settingsService.computeThresholds(settings);
        const status = settingsService.evaluateReadingStatus(measurement, thresholds);
        return {
          device: serializeDevice(device),
          measurement: {
            id: measurement.id,
            temperature: measurement.temperature,
            humidity: measurement.humidity,
            soilMoisture: measurement.soilMoisture,
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

module.exports = router;
