const { z } = require('zod');

const updateSettingsSchema = z.object({
  idealTemperature: z.number().min(-20, 'Temperatura ideal fora de uma faixa plausível.').max(60),
  temperatureTolerance: z.number().min(0.1, 'A margem deve ser maior que zero.').max(30),
  idealHumidity: z.number().min(0, 'Umidade ideal deve estar entre 0 e 100%.').max(100),
  humidityTolerance: z.number().min(0.1, 'A margem deve ser maior que zero.').max(100),
});

module.exports = { updateSettingsSchema };
