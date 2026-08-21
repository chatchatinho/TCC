const { Router } = require('express');
const historyService = require('./history.service');
const { historyQuerySchema } = require('./history.validation');
const { requireAuth } = require('../../middlewares/auth');
const { validateQuery } = require('../../middlewares/validate');

const router = Router();
router.use(requireAuth);

router.get('/', validateQuery(historyQuerySchema), async (req, res, next) => {
  try {
    const result = await historyService.list(req.userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/export', validateQuery(historyQuerySchema), async (req, res, next) => {
  try {
    const items = await historyService.listForExport(req.userId, req.query);

    const header = 'data,horario,temperatura_c,umidade_pct,status_temperatura,status_umidade\n';
    const rows = items
      .map((item) => {
        const date = new Date(item.measuredAt);
        const dateStr = date.toISOString().slice(0, 10);
        const timeStr = date.toISOString().slice(11, 19);
        return [
          dateStr,
          timeStr,
          item.temperature,
          item.humidity,
          item.temperatureStatus,
          item.humidityStatus,
        ].join(',');
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="historico.csv"');
    res.send(header + rows + '\n');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
