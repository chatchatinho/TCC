const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const AppError = require('../../lib/AppError');
const mailer = require('../../lib/mailer');

const PASSWORD_SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
// Mensagem única para credenciais erradas: nunca revela se o e-mail existe ou
// se foi a senha que errou (seção 6 do escopo do projeto).
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

// Hash determinístico (SHA-256), não bcrypt: precisamos localizar o usuário por uma
// busca direta no banco (WHERE token_hash = ...), o que bcrypt não permite (é salgado).
// Isso é seguro aqui porque o token em si já tem 256 bits de entropia aleatória — o
// mesmo princípio usado por tokens de acesso do GitHub/reset de senha do Django.
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

// Sempre "sucede" silenciosamente mesmo se o e-mail não existir — a rota HTTP retorna
// a mesma mensagem genérica em ambos os casos, para não permitir enumerar contas
// cadastradas (mesmo princípio do login, seção 6 do escopo).
async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const passwordResetTokenHash = hashResetToken(rawToken);
  const passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetTokenHash, passwordResetExpiresAt },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  // Uma falha de envio (SMTP fora do ar, credenciais erradas etc.) NUNCA pode
  // propagar como erro daqui: se propagasse, a rota HTTP responderia diferente
  // (500) para e-mails cadastrados com falha de SMTP do que para e-mails
  // inexistentes (200 imediato) — um canal lateral que revelaria quais contas
  // existem. O token já foi salvo; o e-mail pode ser reenviado depois.
  try {
    await mailer.sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error('[auth] Falha ao enviar e-mail de redefinição de senha:', err.message);
  }
}

async function resetPassword(token, newPassword) {
  const passwordResetTokenHash = hashResetToken(token);

  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash, passwordResetExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    throw new AppError(400, 'Link de redefinição inválido ou expirado. Solicite um novo.');
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    // Invalida o token após o uso — não pode ser reaproveitado (nem para redefinir de novo).
    data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  });
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, 'Sessão inválida.');

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'Senha atual incorreta.');
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

// Exige a senha atual pelo mesmo motivo de changePassword: uma sessão sozinha (ex.
// roubada) não deveria bastar para apagar a conta. O delete em cascata (devices,
// settings, alerts → onDelete: Cascade no schema) cuida de limpar todo o resto.
async function deleteAccount(userId, password) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, 'Sessão inválida.');

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'Senha incorreta.');
  }

  await prisma.user.delete({ where: { id: userId } });
}

module.exports = { register, login, getById, requestPasswordReset, resetPassword, changePassword, deleteAccount };
