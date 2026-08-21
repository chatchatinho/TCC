import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as alertsService from '../services/alerts';

// "Você possui N alertas desde seu último acesso" (seção 15). A revisão em si (ver
// detalhes, marcar como lida) acontece na tela dedicada /notifications — este banner é
// só o aviso rápido no Dashboard, que soma até lá.
export default function AlertsBanner({ refreshKey }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    alertsService.getAlertsSummary().then(setSummary).catch(() => setSummary(null));
  }, [refreshKey]);

  if (!summary || summary.unreadCount === 0) return null;

  return (
    <Link
      to="/notifications"
      className="mb-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
    >
      <span>
        ⚠️ Você possui {summary.unreadCount} notificaç{summary.unreadCount === 1 ? 'ão' : 'ões'} desde seu último
        acesso.
      </span>
      <span>Ver notificações →</span>
    </Link>
  );
}
