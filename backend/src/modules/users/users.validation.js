const { z } = require('zod');

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(150).optional(),
}).refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar.');

module.exports = { updateProfileSchema };
