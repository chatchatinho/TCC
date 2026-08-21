const crypto = require('crypto');

// Gera um token de dispositivo (equivalente a uma senha) exibido em texto puro
// ao usuário apenas uma vez, no momento da criação/rotação. Apenas o hash é persistido.
function generateDeviceSecret() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { generateDeviceSecret };
