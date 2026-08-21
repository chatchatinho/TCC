// Bolinha vermelha bem pequena com a contagem de notificações não vistas — usada no
// item "Notificações" do menu lateral e, ao lado de cada dispositivo, no resumo de
// outros dispositivos do Dashboard. Some por completo quando a contagem é zero.
export default function NotificationBadge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
