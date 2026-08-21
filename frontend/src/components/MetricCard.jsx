import StatusBadge from './StatusBadge';

export default function MetricCard({ label, value, unit, status, subtitle }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {status && <StatusBadge status={status} />}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
        {unit && <span className="ml-1 text-lg font-normal text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
    </div>
  );
}
