const { z } = require('zod');

const listAlertsQuerySchema = z.object({
  status: z.enum(['active', 'resolved']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { listAlertsQuerySchema };
