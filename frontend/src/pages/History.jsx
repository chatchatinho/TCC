import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import * as historyService from '../services/history';
import * as devicesService from '../services/devices';
import { formatDate, formatTime, formatNumber } from '../utils/format';

const initialFilters = {
  deviceId: '',
  dateFrom: '',
  dateTo: '',
  temperatureMin: '',
  temperatureMax: '',
  humidityMin: '',
  humidityMax: '',
  status: '',
};

export default function History() {
  const [devices, setDevices] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, pageSize: 50 });
  const [loading, setLoading] = useState(true);

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
      const data = await historyService.getHistory(toApiParams(filters, { page, pageSize: 50 }));
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(field) {
    return (e) => {
      setPage(1);
      setFilters((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function handleExport() {
    const url = historyService.buildExportUrl(toApiParams(filters));
    window.open(url, '_blank');
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Histórico</h1>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
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
        <SelectField label="Situação" value={filters.status} onChange={updateFilter('status')}>
          <option value="">Todas</option>
          <option value="normal">Normal</option>
          <option value="out_of_range">Fora do limite</option>
        </SelectField>
        <Field label="Temp. mín (°C)" type="number" value={filters.temperatureMin} onChange={updateFilter('temperatureMin')} />
        <Field label="Temp. máx (°C)" type="number" value={filters.temperatureMax} onChange={updateFilter('temperatureMax')} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Temperatura</th>
                <th className="px-4 py-3">Umidade</th>
                <th className="px-4 py-3">Status temperatura</th>
                <th className="px-4 py-3">Status umidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma medição encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
              {!loading &&
                result.items.map((item) => (
                  <tr key={item.id}>
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

function Field({ label, type, value, onChange }) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={onChange}
        className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {children}
      </select>
    </label>
  );
}
