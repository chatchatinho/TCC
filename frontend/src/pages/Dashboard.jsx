import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as measurementsService from '../services/measurements';
import * as historyService from '../services/history';
import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import LineChart from '../components/LineChart';
import AlertsBanner from '../components/AlertsBanner';
import { PERIOD_OPTIONS, computeRange } from '../utils/periods';
import { formatDateTime, formatNumber, formatTime } from '../utils/format';
import { getDeviceStatus } from '../utils/deviceStatus';

const POLL_INTERVAL_MS = 10_000;

export default function Dashboard() {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6h');
  const [chartData, setChartData] = useState({ labels: [], temperature: [], humidity: [] });
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);
  const [simulating, setSimulating] = useState(false);

  const loadLatest = useCallback(async () => {
    try {
      const data = await measurementsService.getLatest();
      setLatest(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const primary = latest[0];

  const loadChart = useCallback(async () => {
    if (!primary?.device?.id) return;
    const { dateFrom, dateTo } = computeRange(period);
    const { items } = await historyService.getHistory({
      deviceId: primary.device.id,
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString(),
      pageSize: 200,
    });
    const ascending = [...items].reverse();
    setChartData({
      labels: ascending.map((item) => formatTime(item.measuredAt)),
      temperature: ascending.map((item) => Number(item.temperature)),
      humidity: ascending.map((item) => Number(item.humidity)),
    });
  }, [primary?.device?.id, period]);

  useEffect(() => {
    loadLatest();
    const interval = setInterval(loadLatest, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadLatest]);

  useEffect(() => {
    loadChart();
    const interval = setInterval(loadChart, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadChart]);

  const deviceStatus = useMemo(
    () => (primary?.device ? getDeviceStatus(primary.device.lastSeenAt) : null),
    [primary],
  );

  async function handleSimulate(outOfRange) {
    if (!primary?.device) return;
    setSimulating(true);
    try {
      const temperature = outOfRange ? 30 + Math.random() * 2 : 24 + Math.random() * 2;
      const humidity = 55 + Math.random() * 5;
      await measurementsService.simulateMeasurement({
        deviceId: primary.device.id,
        temperature: Number(temperature.toFixed(1)),
        humidity: Number(humidity.toFixed(1)),
      });
      await Promise.all([loadLatest(), loadChart()]);
      setAlertsRefreshKey((k) => k + 1);
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      </Layout>
    );
  }

  if (!primary) {
    return (
      <Layout>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-600 dark:bg-slate-800">
          <p className="text-slate-600 dark:text-slate-300">Nenhum dispositivo cadastrado ainda.</p>
          <Link to="/devices" className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Cadastrar dispositivo
          </Link>
        </div>
      </Layout>
    );
  }

  const { measurement, device } = primary;

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{device.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={simulating}
            onClick={() => handleSimulate(false)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Testar o sistema sem o ESP32 físico conectado"
          >
            Simular leitura normal
          </button>
          <button
            type="button"
            disabled={simulating}
            onClick={() => handleSimulate(true)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
            title="Testar o sistema sem o ESP32 físico conectado"
          >
            Simular leitura fora do limite
          </button>
        </div>
      </div>

      <AlertsBanner refreshKey={alertsRefreshKey} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Temperatura"
          value={measurement ? formatNumber(measurement.temperature) : '—'}
          unit="°C"
          status={measurement?.temperatureStatus}
        />
        <MetricCard
          label="Umidade"
          value={measurement ? formatNumber(measurement.humidity) : '—'}
          unit="%"
          status={measurement?.humidityStatus}
        />
        <MetricCard
          label="Status do dispositivo"
          value={`${deviceStatus.dot} ${deviceStatus.label}`}
          subtitle={`Última comunicação: ${formatDateTime(device.lastSeenAt)}`}
        />
        <MetricCard
          label="Última leitura"
          value={measurement ? formatDateTime(measurement.measuredAt) : '—'}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {PERIOD_OPTIONS.filter((p) => p.key !== 'custom').map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setPeriod(option.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              period === option.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Temperatura (°C)</h2>
          {chartData.labels.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados no período selecionado.</p>
          ) : (
            <LineChart labels={chartData.labels} data={chartData.temperature} label="Temperatura" color="#2563eb" unit="°C" />
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Umidade (%)</h2>
          {chartData.labels.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados no período selecionado.</p>
          ) : (
            <LineChart labels={chartData.labels} data={chartData.humidity} label="Umidade" color="#0d9488" unit="%" />
          )}
        </div>
      </div>
    </Layout>
  );
}
