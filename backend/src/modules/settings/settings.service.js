const prisma = require('../../lib/prisma');

async function getOrCreate(deviceId) {
  const existing = await prisma.setting.findUnique({ where: { deviceId } });
  if (existing) return existing;
  return prisma.setting.create({ data: { deviceId } });
}

async function update(deviceId, data) {
  return prisma.setting.upsert({
    where: { deviceId },
    update: data,
    create: { deviceId, ...data },
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
  const soilMoisture = {
    min:
      settings.soilMoistureMin != null
        ? Number(settings.soilMoistureMin)
        : Math.max(0, Number(settings.idealSoilMoisture) - Number(settings.soilMoistureTolerance)),
    max:
      settings.soilMoistureMax != null
        ? Number(settings.soilMoistureMax)
        : Math.min(100, Number(settings.idealSoilMoisture) + Number(settings.soilMoistureTolerance)),
  };
  return { temperature, humidity, soilMoisture };
}

// Status por variável para exibição no dashboard/histórico: 'normal' ou 'out_of_range'.
// soilMoistureStatus vem null quando a leitura não trouxe o valor (dispositivo sem
// sensor de solo) — diferente de temperatura/umidade do ar, que todo dispositivo envia.
function evaluateReadingStatus(measurement, thresholds) {
  const temperature = Number(measurement.temperature);
  const humidity = Number(measurement.humidity);
  const hasSoilMoisture = measurement.soilMoisture != null;
  const soilMoisture = hasSoilMoisture ? Number(measurement.soilMoisture) : null;
  return {
    temperatureStatus:
      temperature < thresholds.temperature.min || temperature > thresholds.temperature.max
        ? 'out_of_range'
        : 'normal',
    humidityStatus:
      humidity < thresholds.humidity.min || humidity > thresholds.humidity.max
        ? 'out_of_range'
        : 'normal',
    soilMoistureStatus: !hasSoilMoisture
      ? null
      : soilMoisture < thresholds.soilMoisture.min || soilMoisture > thresholds.soilMoisture.max
        ? 'out_of_range'
        : 'normal',
  };
}

module.exports = { getOrCreate, update, computeThresholds, evaluateReadingStatus };
