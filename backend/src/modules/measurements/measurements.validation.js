const { z } = require('zod');

// Faixa fisicamente plausível para um termo-higrômetro comum (o firmware usa um DHT11,
// que opera 0-50°C / 20-90% UR, mas a validação fica mais ampla de propósito para não
// rejeitar leituras só por estarem fora da faixa nominal de precisão do sensor — apenas
// o que é fisicamente impossível é descartado aqui; ver seção 26).
const createMeasurementSchema = z.object({
  device_id: z.string().min(1, 'device_id é obrigatório.'),
  temperature: z.coerce.number().finite().min(-40).max(80),
  humidity: z.coerce.number().finite().min(0).max(100),
  timestamp: z.string().optional(),
});

const simulateMeasurementSchema = z.object({
  deviceId: z.string().uuid('deviceId inválido.'),
  temperature: z.coerce.number().finite().min(-40).max(80),
  humidity: z.coerce.number().finite().min(0).max(100),
  timestamp: z.string().optional(),
});

module.exports = { createMeasurementSchema, simulateMeasurementSchema };
