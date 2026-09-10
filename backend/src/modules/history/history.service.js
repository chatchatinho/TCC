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

  // Linhas sem sensor de solo (soilMoisture nulo) nunca batem com gte/lte no SQL —
  // ficam de fora do filtro automaticamente, sem precisar de um caso especial aqui.
  if (filters.soilMoistureMin !== undefined || filters.soilMoistureMax !== undefined) {
    const soilMoisture = {};
    if (filters.soilMoistureMin !== undefined) soilMoisture.gte = filters.soilMoistureMin;
    if (filters.soilMoistureMax !== undefined) soilMoisture.lte = filters.soilMoistureMax;
    conditions.push({ soilMoisture });
  }

  // Filtros de situação por variável, independentes entre si — dá para combinar, ex.
  // "temperatura normal E umidade fora do limite" também é uma consulta válida. Cada
  // dispositivo agora tem sua própria faixa de limites, então a checagem vira um OR de
  // sub-condições por dispositivo (cada uma já restrita ao seu próprio deviceId), em vez
  // de uma única faixa aplicada a todas as linhas.
  if (filters.temperatureStatus || filters.humidityStatus || filters.soilMoistureStatus) {
    const targetDeviceIds = filters.deviceId ? [filters.deviceId] : deviceIds;
    const thresholdsByDevice = await getThresholdsByDevice(targetDeviceIds);

    if (filters.temperatureStatus) {
      const temperatureConditions = targetDeviceIds.map((deviceId) => {
        const { temperature } = thresholdsByDevice.get(deviceId);
        return filters.temperatureStatus === 'normal'
          ? { deviceId, temperature: { gte: temperature.min, lte: temperature.max } }
          : { deviceId, OR: [{ temperature: { lt: temperature.min } }, { temperature: { gt: temperature.max } }] };
      });
      conditions.push({ OR: temperatureConditions });
    }

    if (filters.humidityStatus) {
      const humidityConditions = targetDeviceIds.map((deviceId) => {
        const { humidity } = thresholdsByDevice.get(deviceId);
        return filters.humidityStatus === 'normal'
          ? { deviceId, humidity: { gte: humidity.min, lte: humidity.max } }
          : { deviceId, OR: [{ humidity: { lt: humidity.min } }, { humidity: { gt: humidity.max } }] };
      });
      conditions.push({ OR: humidityConditions });
    }

    // Assim como no range de solo acima, uma leitura sem sensor (soilMoisture nulo)
    // não bate com nenhuma das duas comparações abaixo — nem "normal" nem "fora do
    // limite" a incluem, então esse filtro simplesmente ignora dispositivos sem sensor.
    if (filters.soilMoistureStatus) {
      const soilMoistureConditions = targetDeviceIds.map((deviceId) => {
        const { soilMoisture } = thresholdsByDevice.get(deviceId);
        return filters.soilMoistureStatus === 'normal'
          ? { deviceId, soilMoisture: { gte: soilMoisture.min, lte: soilMoisture.max } }
          : { deviceId, OR: [{ soilMoisture: { lt: soilMoisture.min } }, { soilMoisture: { gt: soilMoisture.max } }] };
      });
      conditions.push({ OR: soilMoistureConditions });
    }
  }

  return { AND: conditions };
}

// Busca (e cria com padrão, se necessário) as configurações de cada dispositivo listado,
// retornando um Map deviceId -> thresholds para evitar recomputar a mesma consulta.
async function getThresholdsByDevice(deviceIds) {
  const entries = await Promise.all(
    deviceIds.map(async (deviceId) => {
      const settings = await settingsService.getOrCreate(deviceId);
      return [deviceId, settingsService.computeThresholds(settings)];
    }),
  );
  return new Map(entries);
}

function buildOrderBy(sortBy, sortOrder) {
  return { [sortBy]: sortOrder };
}

async function annotateStatus(measurements) {
  const deviceIds = [...new Set(measurements.map((m) => m.deviceId))];
  const thresholdsByDevice = await getThresholdsByDevice(deviceIds);
  return measurements.map((m) => ({
    id: m.id,
    deviceId: m.deviceId,
    temperature: m.temperature,
    humidity: m.humidity,
    soilMoisture: m.soilMoisture,
    measuredAt: m.measuredAt,
    ...settingsService.evaluateReadingStatus(m, thresholdsByDevice.get(m.deviceId)),
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

  const items = await annotateStatus(rows);
  return { items, total, page, pageSize };
}

async function listForExport(userId, filters) {
  const where = await buildWhere(userId, filters);
  const rows = await prisma.measurement.findMany({
    where,
    orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
    take: MAX_EXPORT_ROWS,
  });
  return annotateStatus(rows);
}

module.exports = { list, listForExport, MAX_EXPORT_ROWS };
