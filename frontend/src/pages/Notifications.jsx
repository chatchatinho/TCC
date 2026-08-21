import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import NotificationBadge from '../components/NotificationBadge';
import * as alertsService from '../services/alerts';
import { formatDateTime, formatNumber } from '../utils/format';
import { VARIABLE_LABEL, DIRECTION_LABEL } from '../utils/alertLabels';

// Tela dedicada às notificações de anomalia (temperatura/umidade fora do limite),
// separadas por dispositivo. Diferente da primeira versão, as notificações NÃO somem
// depois de vistas — ficam aqui como histórico. Só a bolinha vermelha de "não lida"
// desaparece, e só quando o usuário expande aquela notificação especificamente (a
// confirmação de leitura é por notificação, não por visitar a tela).
export default function Notifications() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    alertsService
      .listAlerts({ pageSize: 100 })
      .then(({ alerts: allAlerts }) => setAlerts(allAlerts))
      .finally(() => setLoading(false));
  }, []);

  // Agrupa por dispositivo, na ordem em que cada um apareceu (alerts já vem ordenado
  // por mais recente primeiro, então o primeiro grupo tende a ser o dispositivo com a
  // notificação mais recente).
  const deviceGroups = useMemo(() => {
    const groups = [];
    const byId = new Map();
    for (const alert of alerts) {
      let group = byId.get(alert.deviceId);
      if (!group) {
        group = { deviceId: alert.deviceId, device: alert.device, alerts: [] };
        byId.set(alert.deviceId, group);
        groups.push(group);
      }
      group.alerts.push(alert);
    }
    return groups;
  }, [alerts]);

  useEffect(() => {
    if (selectedDeviceId || deviceGroups.length === 0) return;
    setSelectedDeviceId(deviceGroups[0].deviceId);
  }, [deviceGroups, selectedDeviceId]);

  const activeGroup = deviceGroups.find((g) => g.deviceId === selectedDeviceId) ?? deviceGroups[0];

  async function handleToggle(alert) {
    const opening = expandedId !== alert.id;
    setExpandedId(opening ? alert.id : null);

    if (opening && !alert.readAt) {
      try {
        const updated = await alertsService.markAlertRead(alert.id);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, readAt: updated.readAt } : a)));
      } catch {
        /* se falhar, a notificação continua marcada como não lida — sem problema, o
           usuário pode expandir de novo mais tarde */
      }
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Notificações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Histórico de anomalias de temperatura e umidade, por dispositivo. Clique numa notificação para ver os
          detalhes — isso também confirma que você a viu.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Carregando…</p>}

      {!loading && deviceGroups.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
          Nenhuma notificação registrada ainda.
        </div>
      )}

      {!loading && deviceGroups.length > 0 && (
        <>
          {deviceGroups.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {deviceGroups.map((group) => {
                const unreadCount = group.alerts.filter((a) => !a.readAt).length;
                return (
                  <button
                    key={group.deviceId}
                    type="button"
                    onClick={() => setSelectedDeviceId(group.deviceId)}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${
                      activeGroup?.deviceId === group.deviceId
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {group.device.name}
                    <NotificationBadge count={unreadCount} />
                  </button>
                );
              })}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {activeGroup?.alerts.map((alert) => (
                <NotificationItem
                  key={alert.id}
                  alert={alert}
                  expanded={expandedId === alert.id}
                  onToggle={() => handleToggle(alert)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

function NotificationItem({ alert, expanded, onToggle }) {
  const unread = !alert.readAt;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
      >
        <span className="flex items-center gap-2">
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Não lida" />}
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {VARIABLE_LABEL[alert.variable]} {DIRECTION_LABEL[alert.direction]}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          {formatDateTime(alert.startedAt)}
          <span>{expanded ? '▲' : '▼'}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
          <p>
            Valor de pico: {formatNumber(alert.peakValue)} (limite: {formatNumber(alert.limitMin)}–
            {formatNumber(alert.limitMax)})
          </p>
          <p>
            Início: {formatDateTime(alert.startedAt)}
            {alert.endedAt ? ` · Fim: ${formatDateTime(alert.endedAt)}` : ' · ainda em andamento'}
          </p>
        </div>
      )}
    </div>
  );
}
