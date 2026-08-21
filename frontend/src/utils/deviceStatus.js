// Limiares de status do dispositivo (seção 29 do escopo). Poderiam virar configuráveis
// por usuário no futuro; por ora são constantes documentadas aqui.
const ONLINE_THRESHOLD_MIN = 5;
const STALE_THRESHOLD_MIN = 30;

export function getDeviceStatus(lastSeenAt) {
  if (!lastSeenAt) return { key: 'offline', label: 'Offline', dot: '🔴' };

  const diffMin = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;

  if (diffMin <= ONLINE_THRESHOLD_MIN) return { key: 'online', label: 'Online', dot: '🟢' };
  if (diffMin <= STALE_THRESHOLD_MIN) {
    return { key: 'stale', label: 'Sem comunicação recente', dot: '🟡' };
  }
  return { key: 'offline', label: 'Offline', dot: '🔴' };
}
