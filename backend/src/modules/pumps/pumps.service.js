const prisma = require('../../lib/prisma');

async function getOrCreate(deviceId) {
  const existing = await prisma.pump.findUnique({ where: { deviceId } });
  if (existing) return existing;
  return prisma.pump.create({ data: { deviceId } });
}

// Atualiza modo/limite/período — nunca mexe no estado atual do relé (isOn), que só
// muda via evaluateMeasurement (modo automatic) ou setManualState (comando do usuário).
async function updateConfig(deviceId, data) {
  return prisma.pump.upsert({
    where: { deviceId },
    update: data,
    create: { deviceId, ...data },
  });
}

// Liga/desliga a bomba por comando explícito do usuário — funciona em qualquer modo
// (mesmo em "automatic", como uma sobreposição temporária: a próxima leitura abaixo ou
// acima do limite pode alterar o estado de novo, já que nesse modo o relé é sempre
// derivado da leitura mais recente). getOrCreate garante a linha antes do update — um
// dispositivo recém-criado ainda não tem Pump no banco (só é criada lazily), e um
// update direto contra uma linha inexistente falharia.
async function setManualState(deviceId, isOn) {
  await getOrCreate(deviceId);
  return prisma.pump.update({
    where: { deviceId },
    data: isOn ? { isOn: true, turnedOnAt: new Date() } : { isOn: false, turnedOnAt: null },
  });
}

// Avalia a leitura de umidade do solo mais recente contra a bomba do dispositivo.
// Só o modo 'automatic' liga/desliga o relé sozinho; nos outros modos a bomba segue
// contando desde quando a leitura está abaixo do limite (para exibir na tela), mas o
// relé só muda por comando manual (setManualState) ou pelo motor de alertas, que roda
// à parte e continua notificando (Setting.notifySoilMoisture) independente do modo.
async function evaluateMeasurement(device, measurement) {
  const pump = await getOrCreate(device.id);
  const moisture = Number(measurement.soilMoisture);
  const threshold = Number(pump.moistureThreshold);
  const isBelowThreshold = moisture < threshold;

  if (!isBelowThreshold) {
    const wasAutoOn = pump.mode === 'automatic' && pump.isOn;
    if (pump.belowThresholdSince == null && !wasAutoOn) return pump;
    return prisma.pump.update({
      where: { deviceId: device.id },
      data: {
        belowThresholdSince: null,
        ...(wasAutoOn ? { isOn: false, turnedOnAt: null } : {}),
      },
    });
  }

  if (pump.belowThresholdSince == null) {
    return prisma.pump.update({
      where: { deviceId: device.id },
      data: { belowThresholdSince: measurement.measuredAt },
    });
  }

  if (pump.mode !== 'automatic' || pump.isOn) return pump;

  const elapsedMinutes = (measurement.measuredAt.getTime() - new Date(pump.belowThresholdSince).getTime()) / 60000;
  if (elapsedMinutes < pump.belowThresholdMinutes) return pump;

  return prisma.pump.update({
    where: { deviceId: device.id },
    data: { isOn: true, turnedOnAt: measurement.measuredAt },
  });
}

module.exports = { getOrCreate, updateConfig, setManualState, evaluateMeasurement };
