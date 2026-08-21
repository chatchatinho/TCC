module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  // As migrations e o app compartilham um único banco de teste (tcc_test) — testes
  // rodam em série (--runInBand no script "test") para evitar corrida entre o
  // TRUNCATE de um arquivo e as queries de outro.
  maxWorkers: 1,
  testTimeout: 15000,
};
