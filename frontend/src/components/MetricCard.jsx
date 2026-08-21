import StatusBadge from './StatusBadge';

export default function MetricCard({ label, value, unit, status, subtitle }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {status && <StatusBadge status={status} />}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">
        {value}
        {unit && <span className="ml-1 text-lg font-normal text-slate-400">{unit}</span>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
