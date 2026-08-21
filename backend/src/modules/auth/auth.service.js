const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const AppError = require('../../lib/AppError');

const PASSWORD_SALT_ROUNDS = 10;
// Mensagem única para credenciais erradas: nunca revela se o e-mail existe ou
// se foi a senha que errou (seção 6 do escopo do projeto).
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

async function register({ fullName, email, password, birthDate }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Este e-mail já está cadastrado.');
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      birthDate: new Date(birthDate),
      settings: { create: {} }, // valores padrão definidos no schema
    },
  });

  return user;
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  return user;
}

async function getById(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'Sessão inválida.');
  }
  return user;
}

module.exports = { register, login, getById };
