// Carrega .env.test ANTES de qualquer outro módulo (inclusive antes de app.js/prisma.js
// serem importados pelos arquivos de teste), garantindo que o Prisma Client sempre
// aponte para o banco de teste (tcc_test), nunca para o de desenvolvimento (tcc_dev).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });
