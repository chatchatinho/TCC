const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');

// Autentica o ESP32: o device_identifier vai no corpo da requisição (é público,
// identifica o dispositivo) e o segredo vai num header dedicado (nunca no corpo,
// nunca em query string, para não acabar em logs de acesso). O device_identifier
// sozinho NUNCA é suficiente — sempre exige o token com hash conferido via bcrypt.
async function requireDeviceAuth(req, res, next) {
  const deviceIdentifier = req.body?.device_id;
  const deviceKey = req.header('X-Device-Key');

  if (!deviceIdentifier || !deviceKey) {
    return next(new AppError(401, 'Credenciais de dispositivo ausentes.'));
  }

  const device = await prisma.device.findUnique({ where: { deviceIdentifier } });
  if (!device || !device.active) {
    return next(new AppError(401, 'Dispositivo não autorizado.'));
  }

  const isValid = await bcrypt.compare(deviceKey, device.deviceSecretHash);
  if (!isValid) {
    return next(new AppError(401, 'Dispositivo não autorizado.'));
  }

  req.device = device;
  next();
}

module.exports = { requireDeviceAuth };
