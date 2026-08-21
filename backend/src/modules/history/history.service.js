const prisma = require('../../lib/prisma');
const AppError = require('../../lib/AppError');
const settingsService = require('../settings/settings.service');

const MAX_EXPORT_ROWS = 5000;

// Monta o WHERE do Prisma a partir dos filtros. Sempre restrito aos dispositivos
// do usuário autenticado — nunca aceita um deviceId de outro usuário.
async function buildWhere(userId, filters) {
  const devices = await prisma.device.findMany({ where: { userId }, select: { id: true } });
  const deviceIds = devices.map((d) => d.id);

  if (filters.deviceId) {
    if (!deviceIds.includes(filters.deviceId)) {
      throw new AppError(404, 'Dispositivo não encontrado.');
    }
  }

  const where = {
    deviceId: filters.deviceId ? filters.deviceId : { in: deviceIds },
  };

  if (filters.dateFrom || filters.dateTo) {
    where.measuredAt = {};
    if (filters.dateFrom) where.measuredAt.gte = filters.dateFrom;
    if (filters.dateTo) where.measuredAt.lte = filters.dateTo;
  }

  if (filters.temperatureMin !== undefined || filters.temperatureMax !== undefined) {
    where.temperature = {};
    if (filters.temperatureMin !== undefined) where.temperature.gte = filters.temperatureMin;
    if (filters.temperatureMax !== undefined) where.temperature.lte = filters.temperatureMax;
  }

  if (filters.humidityMin !== undefined || filters.humidityMax !== undefined) {
    where.humidity = {};
    if (filters.humidityMin !== undefined) where.humidity.gte = filters.humidityMin;
    if (filters.humidityMax !== undefined) where.humidity.lte = filters.humidityMax;
  }

  if (filters.status) {
    const settings = await settingsService.getOrCreate(userId);
    const { temperature, humidity } = settingsService.computeThresholds(settings);

    if (filters.status === 'normal') {
      where.AND = [
        { temperature: { gte: temperature.min, lte: temperature.max } },
        { humidity: { gte: humidity.min, lte: humidity.max } },
      ];
    } else {
      where.OR = [
        { temperature: { lt: temperature.min } },
        { temperature: { gt: temperature.max } },
        { humidity: { lt: humidity.min } },
        { humidity: { gt: humidity.max } },
      ];
    }
  }

  return where;
}

async function annotateStatus(userId, measurements) {
  const settings = await settingsService.getOrCreate(userId);
  const thresholds = settingsService.computeThresholds(settings);
  return measurements.map((m) => ({
    id: m.id,
    deviceId: m.deviceId,
    temperature: m.temperature,
    humidity: m.humidity,
    measuredAt: m.measuredAt,
    ...settingsService.evaluateReadingStatus(m, thresholds),
  }));
}

async function list(userId, filters) {
  const where = await buildWhere(userId, filters);
  const { page, pageSize } = filters;

  const [rows, total] = await Promise.all([
    prisma.measurement.findMany({
      where,
      orderBy: { measuredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.measurement.count({ where }),
  ]);

  const items = await annotateStatus(userId, rows);
  return { items, total, page, pageSize };
}

async function listForExport(userId, filters) {
  const where = await buildWhere(userId, filters);
  const rows = await prisma.measurement.findMany({
    where,
    orderBy: { measuredAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  });
  return annotateStatus(userId, rows);
}

module.exports = { list, listForExport, MAX_EXPORT_ROWS };
