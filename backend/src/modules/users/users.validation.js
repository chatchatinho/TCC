const { z } = require('zod');
const { passwordSchema } = require('../auth/auth.validation');

// ~700KB de string base64 ≈ 500KB de imagem binária — limite generoso para uma foto de
// perfil, mas evita que alguém tente gravar arquivos grandes demais na coluna do banco.
const MAX_AVATAR_DATA_URL_LENGTH = 700_000;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/;

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Informe o nome completo.').max(150).optional(),
    // null explicitamente remove a foto atual; string preenche/troca; ausente não mexe.
    avatarData: z
      .string()
      .max(MAX_AVATAR_DATA_URL_LENGTH, 'Imagem muito grande (máximo ~500KB).')
      .regex(AVATAR_DATA_URL_PATTERN, 'Formato de imagem inválido (use PNG, JPEG, WEBP ou GIF).')
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar.');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: passwordSchema,
});

module.exports = { updateProfileSchema, changePasswordSchema };
