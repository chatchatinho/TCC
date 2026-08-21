// Períodos pré-definidos para os filtros de gráfico/histórico (seção 12 do escopo).
export const PERIOD_OPTIONS = [
  { key: '6h', label: 'Últimas 6 horas' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: 'custom', label: 'Personalizado' },
];

export function computeRange(periodKey) {
  const now = new Date();

  switch (periodKey) {
    case '6h':
      return { dateFrom: new Date(now.getTime() - 6 * 60 * 60 * 1000), dateTo: now };
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { dateFrom: start, dateTo: now };
    }
    case '7d':
      return { dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), dateTo: now };
    case '30d':
      return { dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), dateTo: now };
    default:
      return { dateFrom: undefined, dateTo: undefined };
  }
}
