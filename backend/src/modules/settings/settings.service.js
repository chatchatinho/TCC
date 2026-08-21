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

// Calcula os limites mín/máx a partir do valor ideal e da margem de tolerância. Se o
// usuário definiu uma taxa mínima/máxima explícita (Setting.temperatureMin/Max,
// humidityMin/Max), ela substitui o lado correspondente do cálculo — permite uma faixa
// assimétrica ou mais apertada do que a tolerância simétrica permitiria sozinha. Umidade
// é sempre confinada a [0, 100] quando calculada automaticamente — não faz sentido um
// limite fora da faixa fisicamente possível, mesmo que ideal ± tolerância ultrapasse.
function computeThresholds(settings) {
  const temperature = {
    min:
      settings.temperatureMin != null
        ? Number(settings.temperatureMin)
        : Number(settings.idealTemperature) - Number(settings.temperatureTolerance),
    max:
      settings.temperatureMax != null
        ? Number(settings.temperatureMax)
        : Number(settings.idealTemperature) + Number(settings.temperatureTolerance),
  };
  const humidity = {
    min:
      settings.humidityMin != null
        ? Number(settings.humidityMin)
        : Math.max(0, Number(settings.idealHumidity) - Number(settings.humidityTolerance)),
    max:
      settings.humidityMax != null
        ? Number(settings.humidityMax)
        : Math.min(100, Number(settings.idealHumidity) + Number(settings.humidityTolerance)),
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
