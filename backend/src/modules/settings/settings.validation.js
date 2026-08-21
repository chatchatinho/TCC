const { z } = require('zod');

// Taxa mínima/máxima são opcionais: null/ausente = usa o cálculo automático
// (ideal ± tolerância); um número explícito substitui aquele lado da faixa.
const optionalRate = z.number().nullable().optional();

const updateSettingsSchema = z
  .object({
    idealTemperature: z.number().min(-20, 'Temperatura ideal fora de uma faixa plausível.').max(60),
    temperatureTolerance: z.number().min(0.1, 'A margem deve ser maior que zero.').max(30),
    temperatureMin: optionalRate.refine((v) => v == null || (v >= -40 && v <= 80), {
      message: 'Taxa mínima de temperatura fora de uma faixa plausível.',
    }),
    temperatureMax: optionalRate.refine((v) => v == null || (v >= -40 && v <= 80), {
      message: 'Taxa máxima de temperatura fora de uma faixa plausível.',
    }),
    idealHumidity: z.number().min(0, 'Umidade ideal deve estar entre 0 e 100%.').max(100),
    humidityTolerance: z.number().min(0.1, 'A margem deve ser maior que zero.').max(100),
    humidityMin: optionalRate.refine((v) => v == null || (v >= 0 && v <= 100), {
      message: 'Taxa mínima de umidade deve estar entre 0 e 100%.',
    }),
    humidityMax: optionalRate.refine((v) => v == null || (v >= 0 && v <= 100), {
      message: 'Taxa máxima de umidade deve estar entre 0 e 100%.',
    }),
    notifyTemperature: z.boolean(),
    notifyHumidity: z.boolean(),
  })
  .refine((data) => data.temperatureMin == null || data.temperatureMax == null || data.temperatureMin < data.temperatureMax, {
    message: 'A taxa mínima de temperatura deve ser menor que a máxima.',
    path: ['temperatureMax'],
  })
  .refine((data) => data.humidityMin == null || data.humidityMax == null || data.humidityMin < data.humidityMax, {
    message: 'A taxa mínima de umidade deve ser menor que a máxima.',
    path: ['humidityMax'],
  });

module.exports = { updateSettingsSchema };
