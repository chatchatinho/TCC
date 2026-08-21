const { z } = require('zod');

const historyQuerySchema = z.object({
  deviceId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  temperatureMin: z.coerce.number().optional(),
  temperatureMax: z.coerce.number().optional(),
  humidityMin: z.coerce.number().optional(),
  humidityMax: z.coerce.number().optional(),
  status: z.enum(['normal', 'out_of_range']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

module.exports = { historyQuerySchema };
