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

const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(150),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .regex(/[a-zA-Z]/, 'A senha deve conter pelo menos uma letra.')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número.'),
  birthDate: z
    .string()
    .refine(isPlausibleBirthDate, 'Data de nascimento inválida.'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

module.exports = { registerSchema, loginSchema };
