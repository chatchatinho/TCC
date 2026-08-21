const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const AppError = require('../../lib/AppError');
const { generateDeviceSecret } = require('../../lib/deviceSecret');

const SECRET_SALT_ROUNDS = 10;

function generateDeviceIdentifier() {
  return `ESP32-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function list(userId) {
  return prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

// Retorna 404 (não 403) quando o dispositivo não pertence ao usuário: evita
// confirmar a um usuário que um device_identifier de outra pessoa existe.
async function findOwned(userId, deviceId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, userId } });
  if (!device) throw new AppError(404, 'Dispositivo não encontrado.');
  return device;
}

async function create(userId, { name, deviceIdentifier }) {
  const identifier = deviceIdentifier || generateDeviceIdentifier();

  const existing = await prisma.device.findUnique({ where: { deviceIdentifier: identifier } });
  if (existing) {
    throw new AppError(409, 'Este identificador de dispositivo já está em uso.');
  }

  const secret = generateDeviceSecret();
  const deviceSecretHash = await bcrypt.hash(secret, SECRET_SALT_ROUNDS);

  const device = await prisma.device.create({
    data: { deviceIdentifier: identifier, name, deviceSecretHash, userId },
  });

  return { device, secret };
}

async function update(userId, deviceId, data) {
  await findOwned(userId, deviceId);
  return prisma.device.update({ where: { id: deviceId }, data });
}

async function remove(userId, deviceId) {
  await findOwned(userId, deviceId);
  await prisma.device.delete({ where: { id: deviceId } });
}

async function rotateSecret(userId, deviceId) {
  await findOwned(userId, deviceId);
  const secret = generateDeviceSecret();
  const deviceSecretHash = await bcrypt.hash(secret, SECRET_SALT_ROUNDS);
  const device = await prisma.device.update({ where: { id: deviceId }, data: { deviceSecretHash } });
  return { device, secret };
}

module.exports = { list, findOwned, create, update, remove, rotateSecret };
