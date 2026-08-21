import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import * as alertsService from '../services/alerts';
import { formatDateTime, formatNumber } from '../utils/format';
import { VARIABLE_LABEL, DIRECTION_LABEL } from '../utils/alertLabels';

// Tela dedicada às notificações de anomalia (temperatura/umidade fora do limite) ainda
// não vistas. Abrir esta tela já conta como "conferir": as notificações trazidas aqui
// são marcadas como lidas assim que chegam, então da próxima vez que o usuário voltar
// (ou olhar o aviso no Dashboard), elas já não aparecem mais.
export default function Notifications() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [justRead, setJustRead] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { alerts: allAlerts } = await alertsService.listAlerts({ pageSize: 100 });
        const unread = allAlerts.filter((a) => !a.readAt);
        if (cancelled) return;
        setAlerts(unread);
        setLoading(false);

        if (unread.length > 0) {
          await Promise.all(unread.map((a) => alertsService.markAlertRead(a.id)));
          if (!cancelled) setJustRead(true);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Notificações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Anomalias de temperatura e umidade detectadas desde o seu último acesso.
        </p>
      </div>

      {justRead && alerts.length > 0 && (
        <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
          Estas notificações foram marcadas como lidas — na próxima visita, esta lista aparecerá vazia até a
          próxima anomalia.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {loading && <p className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">Carregando…</p>}

        {!loading && alerts.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Nenhuma notificação pendente. Tudo certo por aqui.
          </p>
        )}

        {!loading && alerts.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {VARIABLE_LABEL[alert.variable]} {DIRECTION_LABEL[alert.direction]}
                    <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                      {alert.device?.name}
                    </span>
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Valor de pico: {formatNumber(alert.peakValue)} (limite: {formatNumber(alert.limitMin)}–
                    {formatNumber(alert.limitMax)})
                  </p>
                  <p className="text-slate-400 dark:text-slate-500">
                    Início: {formatDateTime(alert.startedAt)}
                    {alert.endedAt ? ` · Fim: ${formatDateTime(alert.endedAt)}` : ' · ainda em andamento'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
