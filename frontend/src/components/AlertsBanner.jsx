import { useEffect, useState } from 'react';
import * as alertsService from '../services/alerts';
import { formatDateTime, formatNumber } from '../utils/format';

const VARIABLE_LABEL = { temperature: 'Temperatura', humidity: 'Umidade' };
const DIRECTION_LABEL = { above_max: 'acima do limite', below_min: 'abaixo do limite' };

// "Você possui N alertas desde seu último acesso" (seção 15). Ao clicar, expande a
// lista com os detalhes de cada ocorrência: quando, qual variável, valor e limite.
export default function AlertsBanner({ refreshKey }) {
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    alertsService.getAlertsSummary().then(setSummary).catch(() => setSummary(null));
  }, [refreshKey]);

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && unreadAlerts.length === 0) {
      setLoadingDetails(true);
      try {
        const { alerts } = await alertsService.listAlerts({ pageSize: 100 });
        setUnreadAlerts(alerts.filter((a) => !a.readAt));
      } finally {
        setLoadingDetails(false);
      }
    }
  }

  async function markRead(id) {
    await alertsService.markAlertRead(id);
    setUnreadAlerts((prev) => prev.filter((a) => a.id !== id));
    setSummary((prev) => (prev ? { unreadCount: Math.max(0, prev.unreadCount - 1) } : prev));
  }

  if (!summary || summary.unreadCount === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-amber-800 dark:text-amber-400"
      >
        <span>
          ⚠️ Você possui {summary.unreadCount} alerta{summary.unreadCount === 1 ? '' : 's'} desde seu último acesso.
        </span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-amber-100 border-t border-amber-200 bg-white dark:divide-slate-700 dark:border-amber-500/30 dark:bg-slate-800">
          {loadingDetails && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Carregando…</p>}
          {!loadingDetails && unreadAlerts.length === 0 && (
            <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Nenhum alerta não lido encontrado.</p>
          )}
          {unreadAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {VARIABLE_LABEL[alert.variable]} {DIRECTION_LABEL[alert.direction]}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Valor de pico: {formatNumber(alert.peakValue)} (limite: {formatNumber(alert.limitMin)}–{formatNumber(alert.limitMax)})
                </p>
                <p className="text-slate-400 dark:text-slate-500">
                  Início: {formatDateTime(alert.startedAt)}
                  {alert.endedAt ? ` · Fim: ${formatDateTime(alert.endedAt)}` : ' · ainda em andamento'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => markRead(alert.id)}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Marcar como lido
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
