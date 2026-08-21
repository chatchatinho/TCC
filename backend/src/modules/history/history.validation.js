const { z } = require('zod');

const historyQuerySchema = z.object({
  deviceId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  temperatureMin: z.coerce.number().optional(),
  temperatureMax: z.coerce.number().optional(),
  humidityMin: z.coerce.number().optional(),
  humidityMax: z.coerce.number().optional(),
  // Filtros de situação separados por variável — antes era um único "status" que
  // exigia as duas fora do limite ao mesmo tempo para achar "anormal", escondendo o
  // caso comum de só uma das duas estar fora.
  temperatureStatus: z.enum(['normal', 'out_of_range']).optional(),
  humidityStatus: z.enum(['normal', 'out_of_range']).optional(),
  sortBy: z.enum(['measuredAt', 'temperature', 'humidity']).default('measuredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

module.exports = { historyQuerySchema };
