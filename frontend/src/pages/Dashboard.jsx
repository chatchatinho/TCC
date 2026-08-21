import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as measurementsService from '../services/measurements';
import * as historyService from '../services/history';
import * as settingsService from '../services/settings';
import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import LineChart from '../components/LineChart';
import AlertsBanner from '../components/AlertsBanner';
import { PERIOD_OPTIONS, computeRange } from '../utils/periods';
import { formatDateTime, formatNumber, formatTime } from '../utils/format';
import { getDeviceStatus } from '../utils/deviceStatus';

const POLL_INTERVAL_MS = 10_000;
const AUTO_SIM_INTERVAL_MS = 5_000;
// Proporção 100:5 (normal:fora do limite) pedida no escopo — 5 leituras fora do limite
// a cada 105 leituras simuladas.
const OUT_OF_RANGE_PROBABILITY = 5 / 105;
// Se uma leitura real (ESP32 físico) chegou há menos que isso, a simulação automática
// fica completamente pausada — evita misturar dado simulado com hardware de verdade.
const REAL_HARDWARE_GRACE_MS = 60_000;

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

// Gera uma leitura simulada realista a partir dos limites configurados pelo usuário:
// a maior parte das leituras cai dentro da faixa ideal, e uma pequena fração (proporção
// 100:5) sai propositalmente do limite de temperatura ou de umidade (nunca os dois ao
// mesmo tempo, para deixar claro no dashboard qual variável "disparou" o alerta).
// Empurra um limite para fora, na direção sorteada, por uma quantidade aleatória entre
// `minSpan` e `maxSpan`, sem deixar o valor sair da faixa fisicamente possível.
function pushOutOfRange(limitMin, limitMax, minSpan, maxSpan, physicalMin, physicalMax) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const span = randomInRange(minSpan, maxSpan);
  const base = direction < 0 ? limitMin : limitMax;
  return Math.min(physicalMax, Math.max(physicalMin, base + direction * span));
}

function buildSimulatedReading(thresholds) {
  let temperature = randomInRange(thresholds.temperature.min, thresholds.temperature.max);
  let humidity = randomInRange(thresholds.humidity.min, thresholds.humidity.max);

  if (Math.random() < OUT_OF_RANGE_PROBABILITY) {
    if (Math.random() < 0.5) {
      temperature = pushOutOfRange(thresholds.temperature.min, thresholds.temperature.max, 1, 3, 0, 60);
    } else {
      humidity = pushOutOfRange(thresholds.humidity.min, thresholds.humidity.max, 3, 8, 0, 100);
    }
  }

  return {
    temperature: Number(temperature.toFixed(1)),
    humidity: Number(humidity.toFixed(1)),
  };
}

export default function Dashboard() {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6h');
  const [chartData, setChartData] = useState({ labels: [], temperature: [], humidity: [] });
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);
  const simulatingRef = useRef(false);

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

  // Simulação automática (sem botão): a cada 5s, se nenhum ESP32 físico tiver mandado
  // uma leitura real recentemente para este dispositivo, gera uma leitura simulada
  // relativa aos limites configurados pelo usuário. Some completamente assim que o
  // hardware real começa a enviar dados (ver `lastRealMeasurementAt`).
  const deviceId = primary?.device?.id;
  const lastRealMeasurementAt = primary?.device?.lastRealMeasurementAt;

  useEffect(() => {
    if (!deviceId) return undefined;

    const usingRealHardware =
      lastRealMeasurementAt && Date.now() - new Date(lastRealMeasurementAt).getTime() < REAL_HARDWARE_GRACE_MS;
    if (usingRealHardware) return undefined;

    const interval = setInterval(async () => {
      if (simulatingRef.current) return;
      simulatingRef.current = true;
      try {
        const { thresholds } = await settingsService.getSettings();
        const reading = buildSimulatedReading(thresholds);
        await measurementsService.simulateMeasurement({ deviceId, ...reading });
        await Promise.all([loadLatest(), loadChart()]);
        setAlertsRefreshKey((k) => k + 1);
      } finally {
        simulatingRef.current = false;
      }
    }, AUTO_SIM_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [deviceId, lastRealMeasurementAt, loadLatest, loadChart]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{device.name}</p>
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
