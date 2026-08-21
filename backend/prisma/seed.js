// Popula o banco com dados de demonstração: 1 usuário de teste, 1 dispositivo de teste,
// configurações padrão e um histórico simulado de medições (incluindo um evento fora do
// limite) para permitir demonstrar o TCC sem depender do ESP32 físico.
//
// Uso: npm run db:seed
// As credenciais impressas no final são válidas SOMENTE no banco local de desenvolvimento.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

const TEST_USER_EMAIL = 'teste@tcc.local';
const TEST_USER_PASSWORD = 'Senha@Teste123';
const TEST_DEVICE_IDENTIFIER = 'ESP32-001';

function generateDeviceSecret() {
  return crypto.randomBytes(24).toString('hex');
}

async function main() {
  await prisma.alert.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      fullName: 'Usuário de Teste',
      email: TEST_USER_EMAIL,
      passwordHash,
      birthDate: new Date('2000-01-15'),
      settings: {
        create: {
          idealTemperature: 25,
          temperatureTolerance: 2,
          idealHumidity: 60,
          humidityTolerance: 10,
        },
      },
    },
  });

  const deviceSecret = generateDeviceSecret();
  const deviceSecretHash = await bcrypt.hash(deviceSecret, 10);

  const device = await prisma.device.create({
    data: {
      deviceIdentifier: TEST_DEVICE_IDENTIFIER,
      name: 'Sensor - Sala de Teste',
      deviceSecretHash,
      userId: user.id,
      active: true,
      lastSeenAt: new Date(),
    },
  });

  // Gera um histórico simulado das últimas 3 horas, uma leitura a cada 5 minutos,
  // com um evento de temperatura fora do limite (28-30°C) no meio do período,
  // para demonstrar o fluxo de alertas sem precisar esperar o hardware real.
  const now = new Date();
  const readings = [];
  const totalReadings = 36; // 3h / 5min
  for (let i = totalReadings - 1; i >= 0; i--) {
    const measuredAt = new Date(now.getTime() - i * 5 * 60 * 1000);
    const isAnomalyWindow = i >= 14 && i <= 18; // ~20 min de anomalia no meio do histórico
    const temperature = isAnomalyWindow
      ? 28 + Math.random() * 2 // 28.0 - 30.0 °C (fora do limite: ideal 25 ± 2)
      : 24 + Math.random() * 2; // 24.0 - 26.0 °C (dentro do limite)
    const humidity = 55 + Math.random() * 10; // 55 - 65 % (dentro do limite: ideal 60 ± 10)
    readings.push({ measuredAt, temperature, humidity });
  }

  for (const reading of readings) {
    await prisma.measurement.create({
      data: {
        deviceId: device.id,
        temperature: reading.temperature.toFixed(2),
        humidity: reading.humidity.toFixed(2),
        measuredAt: reading.measuredAt,
        receivedAt: reading.measuredAt,
      },
    });
  }

  // Cria o alerta correspondente à janela de anomalia simulada acima, já resolvido,
  // seguindo o modelo de "evento" descrito em docs/01-arquitetura-e-decisoes.md.
  const anomalyStart = readings[totalReadings - 1 - 18].measuredAt;
  const anomalyEnd = readings[totalReadings - 1 - 14].measuredAt;
  const triggeringMeasurement = await prisma.measurement.findFirst({
    where: { deviceId: device.id, measuredAt: anomalyStart },
  });

  await prisma.alert.create({
    data: {
      userId: user.id,
      deviceId: device.id,
      variable: 'temperature',
      direction: 'above_max',
      triggeringMeasurementId: triggeringMeasurement?.id,
      peakValue: 29.8,
      limitMin: 23,
      limitMax: 27,
      startedAt: anomalyStart,
      endedAt: anomalyEnd,
      status: 'resolved',
      readAt: null, // ainda não visualizado — deve aparecer como notificação ao logar
    },
  });

  console.log('\nSeed concluído com sucesso.\n');
  console.log('Usuário de teste:');
  console.log(`  e-mail: ${TEST_USER_EMAIL}`);
  console.log(`  senha:  ${TEST_USER_PASSWORD}`);
  console.log('Dispositivo de teste:');
  console.log(`  device_identifier: ${TEST_DEVICE_IDENTIFIER}`);
  console.log(`  device_secret (token, guarde agora - não é reexibido): ${deviceSecret}`);
  console.log(`\n${readings.length} medições simuladas criadas, com 1 alerta de temperatura (resolvido, não lido).\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
