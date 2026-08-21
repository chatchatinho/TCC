const prisma = require('../../lib/prisma');

async function getOrCreate(userId) {
  const existing = await prisma.setting.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.setting.create({ data: { userId } });
}

async function update(userId, data) {
  return prisma.setting.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

// Calcula os limites mín/máx a partir do valor ideal e da margem de tolerância.
// Umidade é sempre confinada a [0, 100] — não faz sentido um limite fora da faixa
// fisicamente possível, mesmo que ideal ± tolerância matematicamente ultrapasse.
function computeThresholds(settings) {
  const temperature = {
    min: Number(settings.idealTemperature) - Number(settings.temperatureTolerance),
    max: Number(settings.idealTemperature) + Number(settings.temperatureTolerance),
  };
  const humidity = {
    min: Math.max(0, Number(settings.idealHumidity) - Number(settings.humidityTolerance)),
    max: Math.min(100, Number(settings.idealHumidity) + Number(settings.humidityTolerance)),
  };
  return { temperature, humidity };
}

// Status por variável para exibição no dashboard/histórico: 'normal' ou 'out_of_range'.
function evaluateReadingStatus(measurement, thresholds) {
  const temperature = Number(measurement.temperature);
  const humidity = Number(measurement.humidity);
  return {
    temperatureStatus:
      temperature < thresholds.temperature.min || temperature > thresholds.temperature.max
        ? 'out_of_range'
        : 'normal',
    humidityStatus:
      humidity < thresholds.humidity.min || humidity > thresholds.humidity.max
        ? 'out_of_range'
        : 'normal',
  };
}

module.exports = { getOrCreate, update, computeThresholds, evaluateReadingStatus };
