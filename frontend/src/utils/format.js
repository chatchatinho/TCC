// Toda data vem da API em UTC (timestamptz). A conversão para o fuso de
// São Paulo/Brasil acontece só aqui, na camada de apresentação (seção 27 do escopo).
const TIME_ZONE = 'America/Sao_Paulo';

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

export function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(fractionDigits);
}

// "há 2 minutos" / "há 3 horas" — usado no status online/atenção/offline do dispositivo.
export function formatRelative(value) {
  if (!value) return 'nunca';
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays} d`;
}
