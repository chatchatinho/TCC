const { z } = require('zod');

const MIN_BIRTH_YEAR = 1900;

function isPlausibleBirthDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (date > now) return false;
  if (date.getFullYear() < MIN_BIRTH_YEAR) return false;
  return true;
}

// Reaproveitada no cadastro, na redefinição via e-mail e na troca de senha logada —
// a mesma política em todos os lugares onde uma senha nova é definida.
const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .regex(/[a-zA-Z]/, 'A senha deve conter pelo menos uma letra.')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número.');

const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(150),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: passwordSchema,
  birthDate: z
    .string()
    .refine(isPlausibleBirthDate, 'Data de nascimento inválida.'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token ausente.'),
  newPassword: passwordSchema,
});

module.exports = {
  passwordSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
