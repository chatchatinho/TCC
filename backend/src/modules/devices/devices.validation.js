const { z } = require('zod');

const identifierPattern = /^[A-Za-z0-9_-]{3,50}$/;

const createDeviceSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome para o dispositivo.').max(100),
  deviceIdentifier: z
    .string()
    .trim()
    .regex(identifierPattern, 'Identificador deve conter apenas letras, números, "-" ou "_".')
    .optional(),
});

const updateDeviceSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar.');

module.exports = { createDeviceSchema, updateDeviceSchema };
