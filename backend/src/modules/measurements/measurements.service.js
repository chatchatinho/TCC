const prisma = require('../../lib/prisma');
const settingsService = require('../settings/settings.service');
const alertsService = require('../alerts/alerts.service');

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutos de tolerância para relógio do ESP32
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 ano

// O ESP32 pode não ter NTP configurado (ver riscos técnicos, docs/01-arquitetura-e-decisoes.md).
// Se o timestamp enviado for ausente, inválido, ou implausível (muito no futuro/passado),
// usa o horário do servidor como received_at/measured_at em vez de rejeitar a leitura.
function resolveMeasuredAt(timestamp) {
  if (!timestamp) return new Date();

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return new Date();

  const now = Date.now();
  if (parsed.getTime() > now + MAX_CLOCK_SKEW_MS) return new Date();
  if (parsed.getTime() < now - MAX_AGE_MS) return new Date();

  return parsed;
}

// `source` distingue leituras vindas de um ESP32 físico ('real') das leituras geradas
// pela simulação automática do dashboard ('simulated') — só a primeira atualiza
// `lastRealMeasurementAt`, o sinal que o frontend usa para desligar a simulação.
async function create(device, { temperature, humidity, timestamp }, { source = 'simulated' } = {}) {
  const measuredAt = resolveMeasuredAt(timestamp);

  const measurement = await prisma.measurement.create({
    data: { deviceId: device.id, temperature, humidity, measuredAt },
  });

  const now = new Date();
  await prisma.device.update({
    where: { id: device.id },
    data: source === 'real' ? { lastSeenAt: now, lastRealMeasurementAt: now } : { lastSeenAt: now },
  });

  const settings = await settingsService.getOrCreate(device.userId);
  const thresholds = settingsService.computeThresholds(settings);
  const notifyFlags = { temperature: settings.notifyTemperature, humidity: settings.notifyHumidity };
  await alertsService.evaluateMeasurement(measurement, device, thresholds, notifyFlags);

  return measurement;
}

// Última leitura de cada dispositivo do usuário — alimenta os cards do dashboard.
// Ordenado por criação (mesmo critério de devicesService.list) para que o seletor de
// dispositivo do dashboard mostre uma ordem estável entre requisições.
async function latestByUser(userId) {
  const devices = await prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

  const results = await Promise.all(
    devices.map(async (device) => {
      const measurement = await prisma.measurement.findFirst({
        where: { deviceId: device.id },
        orderBy: { measuredAt: 'desc' },
      });
      return { device, measurement };
    }),
  );

  return results;
}

module.exports = { create, latestByUser, resolveMeasuredAt };
