const { z } = require('zod');

const updatePumpSchema = z.object({
  mode: z.enum(['automatic', 'notify_only', 'manual'], {
    errorMap: () => ({ message: 'Modo inválido — use automatic, notify_only ou manual.' }),
  }),
  moistureThreshold: z.number().min(0, 'Limite de umidade do solo deve estar entre 0 e 100%.').max(100),
  belowThresholdMinutes: z
    .number()
    .int('O período deve ser um número inteiro de minutos.')
    .min(1, 'O período deve ser de pelo menos 1 minuto.')
    .max(1440, 'O período máximo é de 24 horas (1440 minutos).'),
});

const setPumpStateSchema = z.object({
  isOn: z.boolean(),
});

module.exports = { updatePumpSchema, setPumpStateSchema };
