// Nunca serializar password_hash/device_secret_hash nas respostas da API.
function serializeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    birthDate: user.birthDate,
    createdAt: user.createdAt,
  };
}

function serializeDevice(device) {
  return {
    id: device.id,
    deviceIdentifier: device.deviceIdentifier,
    name: device.name,
    active: device.active,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
  };
}

module.exports = { serializeUser, serializeDevice };
