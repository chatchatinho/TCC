import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import * as historyService from '../services/history';
import * as devicesService from '../services/devices';
import { formatDate, formatTime, formatNumber } from '../utils/format';
import { PERIOD_OPTIONS, computeRange } from '../utils/periods';

const initialFilters = {
  deviceId: '',
  dateFrom: '',
  dateTo: '',
  temperatureMin: '',
  temperatureMax: '',
  humidityMin: '',
  humidityMax: '',
  temperatureStatus: '',
  humidityStatus: '',
};

const SORT_COLUMNS = [
  { key: 'measuredAt', label: 'Data/Horário' },
  { key: 'temperature', label: 'Temperatura' },
  { key: 'humidity', label: 'Umidade' },
];

// <input type="datetime-local"> espera "YYYY-MM-DDTHH:mm" em horário LOCAL — mesmo
// formato que os presets de período (Dashboard) já calculam como objetos Date.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function History() {
  const [devices, setDevices] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sortBy, setSortBy] = useState('measuredAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, pageSize: 50 });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activePeriod, setActivePeriod] = useState('');

  useEffect(() => {
    devicesService.listDevices().then(setDevices);
  }, []);

  // <input type="datetime-local"> devolve uma string sem fuso horário (ex. "2026-08-21T10:00"),
  // interpretada como horário LOCAL do navegador. Convertemos para ISO/UTC aqui, antes de
  // enviar à API — o servidor nunca deve precisar adivinhar em que fuso o filtro foi digitado.
  function toApiParams(rawFilters, extra) {
    const params = { ...rawFilters, ...extra };
    if (params.dateFrom) params.dateFrom = new Date(params.dateFrom).toISOString();
    if (params.dateTo) params.dateTo = new Date(params.dateTo).toISOString();
    Object.keys(params).forEach((key) => {
      if (params[key] === '') delete params[key];
    });
    return params;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await historyService.getHistory(toApiParams(filters, { page, pageSize: 50, sortBy, sortOrder }));
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(field) {
    return (e) => {
      setPage(1);
      if (field === 'dateFrom' || field === 'dateTo') setActivePeriod('');
      setFilters((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function applyPeriodPreset(key) {
    setActivePeriod(key);
    setPage(1);
    if (key === '') {
      setFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '' }));
      return;
    }
    const { dateFrom, dateTo } = computeRange(key);
    setFilters((prev) => ({
      ...prev,
      dateFrom: dateFrom ? toDatetimeLocalValue(dateFrom) : '',
      dateTo: dateTo ? toDatetimeLocalValue(dateTo) : '',
    }));
  }

  function clearFilters() {
    setPage(1);
    setActivePeriod('');
    setFilters(initialFilters);
  }

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length;

  function toggleSort(column) {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }

  function handleExport() {
    const url = historyService.buildExportUrl(toApiParams(filters, { sortBy, sortOrder }));
    window.open(url, '_blank');
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Histórico</h1>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Exportar CSV
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  clearFilters();
                }}
                onKeyDown={(e) => e.key === 'Enter' && clearFilters()}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Limpar filtros
              </span>
            )}
            <span className="text-slate-400 dark:text-slate-500">{filtersOpen ? '▲' : '▼'}</span>
          </span>
        </button>

        {filtersOpen && (
          <div className="mt-4">
            <FilterGroup label="Dispositivo e período">
              <div className="mb-2 flex flex-wrap gap-2">
                {PERIOD_OPTIONS.filter((p) => p.key !== 'custom').map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => applyPeriodPreset(option.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activePeriod === option.key
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {(filters.dateFrom || filters.dateTo) && (
                  <button
                    type="button"
                    onClick={() => applyPeriodPreset('')}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    Limpar período
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SelectField label="Dispositivo" value={filters.deviceId} onChange={updateFilter('deviceId')}>
                  <option value="">Todos</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectField>
                <Field label="De" type="datetime-local" value={filters.dateFrom} onChange={updateFilter('dateFrom')} />
                <Field label="Até" type="datetime-local" value={filters.dateTo} onChange={updateFilter('dateTo')} />
              </div>
            </FilterGroup>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FilterGroup label="Temperatura" accent="blue">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectField label="Situação" value={filters.temperatureStatus} onChange={updateFilter('temperatureStatus')}>
                    <option value="">Todas</option>
                    <option value="normal">Normal</option>
                    <option value="out_of_range">Fora do limite</option>
                  </SelectField>
                  <DebouncedField
                    label="Mín (°C)"
                    value={filters.temperatureMin}
                    onCommit={(v) => {
                      setPage(1);
                      setFilters((prev) => ({ ...prev, temperatureMin: v }));
                    }}
                  />
                  <DebouncedField
                    label="Máx (°C)"
                    value={filters.temperatureMax}
                    onCommit={(v) => {
                      setPage(1);
                      setFilters((prev) => ({ ...prev, temperatureMax: v }));
                    }}
                  />
                </div>
              </FilterGroup>

              <FilterGroup label="Umidade" accent="teal">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectField label="Situação" value={filters.humidityStatus} onChange={updateFilter('humidityStatus')}>
                    <option value="">Todas</option>
                    <option value="normal">Normal</option>
                    <option value="out_of_range">Fora do limite</option>
                  </SelectField>
                  <DebouncedField
                    label="Mín (%)"
                    value={filters.humidityMin}
                    onCommit={(v) => {
                      setPage(1);
                      setFilters((prev) => ({ ...prev, humidityMin: v }));
                    }}
                  />
                  <DebouncedField
                    label="Máx (%)"
                    value={filters.humidityMax}
                    onCommit={(v) => {
                      setPage(1);
                      setFilters((prev) => ({ ...prev, humidityMax: v }));
                    }}
                  />
                </div>
              </FilterGroup>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                {SORT_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3" colSpan={column.key === 'measuredAt' ? 2 : 1}>
                    <button type="button" onClick={() => toggleSort(column.key)} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
                      {column.label}
                      {sortBy === column.key && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3">Status temperatura</th>
                <th className="px-4 py-3">Status umidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Nenhuma medição encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
              {!loading &&
                result.items.map((item) => (
                  <tr key={item.id} className="dark:text-slate-200">
                    <td className="px-4 py-2">{formatDate(item.measuredAt)}</td>
                    <td className="px-4 py-2">{formatTime(item.measuredAt)}</td>
                    <td className="px-4 py-2">{formatNumber(item.temperature)} °C</td>
                    <td className="px-4 py-2">{formatNumber(item.humidity)} %</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={item.temperatureStatus} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={item.humidityStatus} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} />
      </div>
    </Layout>
  );
}

// Agrupa um conjunto de filtros sob um rótulo, com uma barra de cor lateral opcional
// para reforçar visualmente a associação (ex.: azul = temperatura, verde-azulado =
// umidade), consistente com as cores usadas nos gráficos do Dashboard.
const GROUP_ACCENTS = {
  blue: 'border-l-blue-400 dark:border-l-blue-500',
  teal: 'border-l-teal-400 dark:border-l-teal-500',
  none: 'border-l-transparent',
};

function FilterGroup({ label, accent = 'none', children }) {
  return (
    <div className={`border-l-2 pl-3 ${GROUP_ACCENTS[accent]}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, type, value, onChange }) {
  return (
    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

// Campo numérico com digitação local instantânea, mas que só dispara a busca (via
// onCommit) 400ms depois de parar de digitar — evita recarregar a tabela a cada dígito
// enquanto o usuário ainda está escrevendo um número de dois ou três dígitos.
function DebouncedField({ label, value, onCommit, delay = 400 }) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleChange(e) {
    const next = e.target.value;
    setLocalValue(next);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onCommit(next), delay);
  }

  return (
    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
      {label}
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
      {label}
      <select
        value={value}
        onChange={onChange}
        className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        {children}
      </select>
    </label>
  );
}
