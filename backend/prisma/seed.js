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
const pumpsService = require('../src/modules/pumps/pumps.service');

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
  await prisma.pump.deleteMany();
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
      settings: {
        create: {
          idealTemperature: 25,
          temperatureTolerance: 2,
          idealHumidity: 60,
          humidityTolerance: 10,
          idealSoilMoisture: 45,
          soilMoistureTolerance: 15,
        },
      },
      // Bomba em modo automático: liga sozinha quando o solo passa 20 minutos seguidos
      // abaixo de 30% — o histórico simulado abaixo inclui uma janela de seca (ver
      // isAnomalyWindow) para demonstrar o acionamento sem depender do ESP32 físico.
      pump: {
        create: {
          mode: 'automatic',
          moistureThreshold: 30,
          belowThresholdMinutes: 20,
        },
      },
    },
  });

  // Gera um histórico simulado das últimas 3 horas, uma leitura a cada 5 minutos,
  // com um evento de temperatura fora do limite (28-30°C) e uma janela de solo seco
  // (abaixo de 30%) no meio do período, para demonstrar o fluxo de alertas — e, no
  // caso do solo, o acionamento automático da bomba — sem precisar esperar o hardware
  // real. A janela de seca dura exatamente os 20 minutos configurados em
  // belowThresholdMinutes, então a bomba liga sozinha bem na última leitura dela.
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
    const soilMoisture = isAnomalyWindow
      ? 20 + Math.random() * 8 // 20 - 28% (abaixo do limite de 30% da bomba/ideal 45±15)
      : 40 + Math.random() * 10; // 40 - 50% (dentro do limite)
    readings.push({ measuredAt, temperature, humidity, soilMoisture });
  }

  for (const reading of readings) {
    const measurement = await prisma.measurement.create({
      data: {
        deviceId: device.id,
        temperature: reading.temperature.toFixed(2),
        humidity: reading.humidity.toFixed(2),
        soilMoisture: reading.soilMoisture.toFixed(2),
        measuredAt: reading.measuredAt,
        receivedAt: reading.measuredAt,
      },
    });
    // Mesma rotina usada em produção (measurements.service.js) — mantém o estado da
    // bomba (isOn, belowThresholdSince) consistente com o que o sistema real geraria
    // para este mesmo histórico, em vez de replicar a lógica manualmente aqui.
    await pumpsService.evaluateMeasurement(device, measurement);
  }

  // Cria o alerta correspondente à janela de anomalia simulada acima, já resolvido,
  // seguindo o modelo de "evento" descrito em docs/documentacao/01-arquitetura-e-decisoes.md.
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

  // Mesma janela de anomalia, mas para o solo seco que acionou a bomba automaticamente
  // (ver pumpsService.evaluateMeasurement acima) — também aparece como notificação.
  await prisma.alert.create({
    data: {
      userId: user.id,
      deviceId: device.id,
      variable: 'soil_moisture',
      direction: 'below_min',
      triggeringMeasurementId: triggeringMeasurement?.id,
      peakValue: 21.5,
      limitMin: 30,
      limitMax: 60,
      startedAt: anomalyStart,
      endedAt: anomalyEnd,
      status: 'resolved',
      readAt: null,
    },
  });

  const pump = await prisma.pump.findUnique({ where: { deviceId: device.id } });

  console.log('\nSeed concluído com sucesso.\n');
  console.log('Usuário de teste:');
  console.log(`  e-mail: ${TEST_USER_EMAIL}`);
  console.log(`  senha:  ${TEST_USER_PASSWORD}`);
  console.log('Dispositivo de teste:');
  console.log(`  device_identifier: ${TEST_DEVICE_IDENTIFIER}`);
  console.log(`  device_secret (token, guarde agora - não é reexibido): ${deviceSecret}`);
  console.log(
    `\n${readings.length} medições simuladas criadas, com alertas de temperatura e umidade do solo (resolvidos, não lidos).`,
  );
  console.log(`Bomba d'água: modo ${pump.mode}, estado atual ${pump.isOn ? 'LIGADA' : 'desligada'}.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
