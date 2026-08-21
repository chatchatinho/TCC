const STYLES = {
  normal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  out_of_range: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

const LABELS = {
  normal: 'Normal',
  out_of_range: 'Fora do limite',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? STYLES.normal}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
