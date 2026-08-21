const prisma = require('../../lib/prisma');
const AppError = require('../../lib/AppError');

const VARIABLES = ['temperature', 'humidity'];

// Avalia uma medição recém-gravada contra os limites atuais do usuário e mantém
// o ciclo de vida dos alertas como EVENTOS (não uma linha por leitura), evitando
// spam de notificações quando o sensor permanece fora da faixa por várias leituras
// seguidas (seção 42 do escopo do projeto):
//
//   - fora da faixa e sem alerta ativo para device+variável -> abre um novo alerta;
//   - fora da faixa e já existe alerta ativo -> apenas atualiza o valor de pico;
//   - dentro da faixa e existe alerta ativo -> encerra o alerta (ended_at = agora).
async function evaluateMeasurement(measurement, device, thresholds) {
  for (const variable of VARIABLES) {
    const value = Number(measurement[variable]);
    const { min, max } = thresholds[variable];
    const isOutOfRange = value < min || value > max;

    const activeAlert = await prisma.alert.findFirst({
      where: { deviceId: device.id, variable, status: 'active' },
    });

    if (isOutOfRange) {
      const direction = value < min ? 'below_min' : 'above_max';

      if (!activeAlert) {
        await prisma.alert.create({
          data: {
            userId: device.userId,
            deviceId: device.id,
            variable,
            direction,
            triggeringMeasurementId: measurement.id,
            peakValue: value,
            limitMin: min,
            limitMax: max,
            startedAt: measurement.measuredAt,
            status: 'active',
          },
        });
        continue;
      }

      const currentPeak = Number(activeAlert.peakValue);
      const isMoreExtreme =
        activeAlert.direction === 'above_max' ? value > currentPeak : value < currentPeak;
      if (isMoreExtreme) {
        await prisma.alert.update({
          where: { id: activeAlert.id },
          data: { peakValue: value },
        });
      }
      continue;
    }

    if (activeAlert) {
      await prisma.alert.update({
        where: { id: activeAlert.id },
        data: { status: 'resolved', endedAt: measurement.measuredAt },
      });
    }
  }
}

async function list(userId, { status, page, pageSize }) {
  const where = { userId, ...(status ? { status } : {}) };
  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { device: { select: { name: true, deviceIdentifier: true } } },
    }),
    prisma.alert.count({ where }),
  ]);
  return { alerts, total, page, pageSize };
}

// "Alertas desde o último acesso" = alertas ainda não visualizados (read_at nulo),
// independentemente de já estarem resolvidos ou ainda ativos.
async function summary(userId) {
  const unreadCount = await prisma.alert.count({ where: { userId, readAt: null } });
  return { unreadCount };
}

async function markRead(userId, alertId) {
  const alert = await prisma.alert.findFirst({ where: { id: alertId, userId } });
  if (!alert) throw new AppError(404, 'Alerta não encontrado.');

  return prisma.alert.update({
    where: { id: alertId },
    data: { readAt: new Date() },
  });
}

module.exports = { evaluateMeasurement, list, summary, markRead };
