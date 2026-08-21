const prisma = require('../../src/lib/prisma');

// Limpa todas as tabelas entre testes. TRUNCATE ... CASCADE é mais rápido e simples que
// deletar respeitando a ordem das foreign keys manualmente — aceitável aqui porque o
// banco de teste não tem nada que precise sobreviver entre casos.
async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE alerts, measurements, settings, devices, users RESTART IDENTITY CASCADE;',
  );
}

async function closeDb() {
  await prisma.$disconnect();
}

module.exports = { resetDb, closeDb };
