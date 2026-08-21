const prisma = require('../../lib/prisma');
const AppError = require('../../lib/AppError');
const settingsService = require('../settings/settings.service');

const MAX_EXPORT_ROWS = 5000;

// Monta o WHERE do Prisma como uma lista de condições combinadas com AND — cada filtro
// vira uma condição independente na lista, em vez de mutar um único objeto (abordagem
// anterior tinha um bug: o filtro de status "fora do limite" podia sobrescrever/apagar
// um filtro de faixa manual (temperatureMin/Max) definido junto). Sempre restrito aos
// dispositivos do usuário autenticado — nunca aceita um deviceId de outro usuário.
async function buildWhere(userId, filters) {
  const devices = await prisma.device.findMany({ where: { userId }, select: { id: true } });
  const deviceIds = devices.map((d) => d.id);

  if (filters.deviceId && !deviceIds.includes(filters.deviceId)) {
    throw new AppError(404, 'Dispositivo não encontrado.');
  }

  const conditions = [{ deviceId: filters.deviceId ? filters.deviceId : { in: deviceIds } }];

  if (filters.dateFrom || filters.dateTo) {
    const measuredAt = {};
    if (filters.dateFrom) measuredAt.gte = filters.dateFrom;
    if (filters.dateTo) measuredAt.lte = filters.dateTo;
    conditions.push({ measuredAt });
  }

  if (filters.temperatureMin !== undefined || filters.temperatureMax !== undefined) {
    const temperature = {};
    if (filters.temperatureMin !== undefined) temperature.gte = filters.temperatureMin;
    if (filters.temperatureMax !== undefined) temperature.lte = filters.temperatureMax;
    conditions.push({ temperature });
  }

  if (filters.humidityMin !== undefined || filters.humidityMax !== undefined) {
    const humidity = {};
    if (filters.humidityMin !== undefined) humidity.gte = filters.humidityMin;
    if (filters.humidityMax !== undefined) humidity.lte = filters.humidityMax;
    conditions.push({ humidity });
  }

  // Filtros de situação por variável, independentes entre si — dá para combinar, ex.
  // "temperatura normal E umidade fora do limite" também é uma consulta válida.
  if (filters.temperatureStatus || filters.humidityStatus) {
    const settings = await settingsService.getOrCreate(userId);
    const { temperature, humidity } = settingsService.computeThresholds(settings);

    if (filters.temperatureStatus === 'normal') {
      conditions.push({ temperature: { gte: temperature.min, lte: temperature.max } });
    } else if (filters.temperatureStatus === 'out_of_range') {
      conditions.push({ OR: [{ temperature: { lt: temperature.min } }, { temperature: { gt: temperature.max } }] });
    }

    if (filters.humidityStatus === 'normal') {
      conditions.push({ humidity: { gte: humidity.min, lte: humidity.max } });
    } else if (filters.humidityStatus === 'out_of_range') {
      conditions.push({ OR: [{ humidity: { lt: humidity.min } }, { humidity: { gt: humidity.max } }] });
    }
  }

  return { AND: conditions };
}

function buildOrderBy(sortBy, sortOrder) {
  return { [sortBy]: sortOrder };
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
  const { page, pageSize, sortBy, sortOrder } = filters;

  const [rows, total] = await Promise.all([
    prisma.measurement.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortOrder),
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
    orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
    take: MAX_EXPORT_ROWS,
  });
  return annotateStatus(userId, rows);
}

module.exports = { list, listForExport, MAX_EXPORT_ROWS };
