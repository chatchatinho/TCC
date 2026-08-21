const { z } = require('zod');

// Faixa fisicamente plausível para um termo-higrômetro comum (DHT11/DHT22/SHT31/BME280
// e similares) — ampla o suficiente para não rejeitar sensores diferentes do DHT22
// usado como referência no firmware, mas suficiente para descartar lixo (seção 26).
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
