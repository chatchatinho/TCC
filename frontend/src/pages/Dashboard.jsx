import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as measurementsService from '../services/measurements';
import * as historyService from '../services/history';
import * as settingsService from '../services/settings';
import * as alertsService from '../services/alerts';
import * as pumpsService from '../services/pumps';
import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import LineChart from '../components/LineChart';
import AlertsBanner from '../components/AlertsBanner';
import NotificationBadge from '../components/NotificationBadge';
import { PERIOD_OPTIONS, computeRange } from '../utils/periods';
import { formatDateTime, formatNumber, formatRelative, formatTime } from '../utils/format';
import { getDeviceStatus } from '../utils/deviceStatus';

const POLL_INTERVAL_MS = 10_000;
const AUTO_SIM_INTERVAL_MS = 2_000;
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
  let soilMoisture = randomInRange(thresholds.soilMoisture.min, thresholds.soilMoisture.max);

  if (Math.random() < OUT_OF_RANGE_PROBABILITY) {
    const roll = Math.random();
    if (roll < 1 / 3) {
      temperature = pushOutOfRange(thresholds.temperature.min, thresholds.temperature.max, 1, 3, 0, 60);
    } else if (roll < 2 / 3) {
      humidity = pushOutOfRange(thresholds.humidity.min, thresholds.humidity.max, 3, 8, 0, 100);
    } else {
      soilMoisture = pushOutOfRange(thresholds.soilMoisture.min, thresholds.soilMoisture.max, 3, 8, 0, 100);
    }
  }

  return {
    temperature: Number(temperature.toFixed(1)),
    humidity: Number(humidity.toFixed(1)),
    soilMoisture: Number(soilMoisture.toFixed(1)),
  };
}

export default function Dashboard() {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6h');
  const [chartData, setChartData] = useState({ labels: [], temperature: [], humidity: [], soilMoisture: [] });
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [deviceAlertCounts, setDeviceAlertCounts] = useState({});
  const [pump, setPump] = useState(null);
  const [pumpToggling, setPumpToggling] = useState(false);
  const simulatingRef = useRef(false);
  const latestRef = useRef([]);

  const loadLatest = useCallback(async () => {
    try {
      const data = await measurementsService.getLatest();
      setLatest(data);
      latestRef.current = data;
    } finally {
      setLoading(false);
    }
  }, []);

  // Notificações pendentes por dispositivo, para a bolinha ao lado de cada um no
  // resumo dos outros dispositivos. Reaproveita a mesma contagem de "não lidas" do
  // sino do menu, só que quebrada por device_id.
  useEffect(() => {
    alertsService
      .listAlerts({ pageSize: 100 })
      .then(({ alerts }) => {
        const counts = {};
        for (const alert of alerts) {
          if (!alert.readAt) counts[alert.deviceId] = (counts[alert.deviceId] ?? 0) + 1;
        }
        setDeviceAlertCounts(counts);
      })
      .catch(() => {});
  }, [alertsRefreshKey]);

  // Enquanto o usuário não escolher um dispositivo (ou se o escolhido tiver sido
  // removido), cai no primeiro da lista — mesmo comportamento de antes para quem só
  // tem um dispositivo.
  const primary = latest.find((item) => item.device.id === selectedDeviceId) ?? latest[0];

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
      soilMoisture: ascending.map((item) => (item.soilMoisture != null ? Number(item.soilMoisture) : null)),
    });
  }, [primary?.device?.id, period]);

  // Estado da bomba do dispositivo selecionado — muda sozinho no backend (modo
  // automatic) a cada leitura, então precisa ser recarregado no mesmo ritmo do
  // gráfico/última leitura para o botão manual não ficar mostrando um estado velho.
  const loadPump = useCallback(async () => {
    if (!primary?.device?.id) return;
    const data = await pumpsService.getPump(primary.device.id);
    setPump(data);
  }, [primary?.device?.id]);

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

  useEffect(() => {
    loadPump();
    const interval = setInterval(loadPump, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadPump]);

  const deviceStatus = useMemo(
    () => (primary?.device ? getDeviceStatus(primary.device.lastSeenAt) : null),
    [primary],
  );

  // Simulação automática (sem botão): a cada 2s, gera uma leitura para CADA dispositivo
  // "virtual" do usuário — não só o que está selecionado no momento — para que os outros
  // continuem "vivos" em segundo plano (cards de resumo, alertas) mesmo sem o usuário
  // estar olhando para eles. Um dispositivo só fica de fora da rodada se um ESP32 físico
  // tiver mandado uma leitura real recentemente (ver `lastRealMeasurementAt`); nesse
  // caso, ele passa a ser tratado como hardware real e a simulação o ignora por completo.
  // Lê a lista de dispositivos de uma ref (em vez de depender de `latest` diretamente)
  // para o intervalo não precisar ser recriado a cada leitura simulada.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (simulatingRef.current) return;
      const devices = latestRef.current;
      if (devices.length === 0) return;

      const virtualDevices = devices.filter((item) => {
        const lastReal = item.device.lastRealMeasurementAt;
        const usingRealHardware = lastReal && Date.now() - new Date(lastReal).getTime() < REAL_HARDWARE_GRACE_MS;
        return !usingRealHardware;
      });
      if (virtualDevices.length === 0) return;

      simulatingRef.current = true;
      try {
        await Promise.all(
          virtualDevices.map(async (item) => {
            const { thresholds } = await settingsService.getSettings(item.device.id);
            const reading = buildSimulatedReading(thresholds);
            return measurementsService.simulateMeasurement({ deviceId: item.device.id, ...reading });
          }),
        );
        await Promise.all([loadLatest(), loadChart(), loadPump()]);
        setAlertsRefreshKey((k) => k + 1);
      } finally {
        simulatingRef.current = false;
      }
    }, AUTO_SIM_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadLatest, loadChart, loadPump]);

  async function handlePumpToggle() {
    if (!pump) return;
    setPumpToggling(true);
    try {
      const updated = await pumpsService.togglePump(pump.deviceId, !pump.isOn);
      setPump(updated);
    } finally {
      setPumpToggling(false);
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
  const otherDevices = latest.filter((item) => item.device.id !== device.id);

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          {latest.length > 1 ? (
            <select
              value={device.id}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              aria-label="Trocar de dispositivo"
              className="-ml-1 mt-0.5 rounded border-0 bg-transparent px-1 py-0 text-sm text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {latest.map((item) => (
                <option key={item.device.id} value={item.device.id} className="dark:bg-slate-800 dark:text-slate-100">
                  {item.device.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{device.name}</p>
          )}
        </div>
        {otherDevices.length > 0 && (
          <div className="space-y-0.5 text-right text-xs text-slate-600 dark:text-slate-300">
            {otherDevices.map((item) => (
              <OtherDeviceSummary
                key={item.device.id}
                item={item}
                alertCount={deviceAlertCounts[item.device.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      <AlertsBanner refreshKey={alertsRefreshKey} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          label="Umidade do solo"
          value={measurement?.soilMoisture != null ? formatNumber(measurement.soilMoisture) : '—'}
          unit={measurement?.soilMoisture != null ? '%' : undefined}
          status={measurement?.soilMoistureStatus}
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

      {pump && <PumpWidget pump={pump} onToggle={handlePumpToggle} toggling={pumpToggling} />}

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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Umidade do solo (%)</h2>
          {chartData.labels.length === 0 || chartData.soilMoisture.every((v) => v == null) ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados no período selecionado.</p>
          ) : (
            <LineChart labels={chartData.labels} data={chartData.soilMoisture} label="Umidade do solo" color="#d97706" unit="%" />
          )}
        </div>
      </div>
    </Layout>
  );
}

const PUMP_MODE_LABEL = {
  automatic: 'Automática',
  notify_only: 'Somente notificar',
  manual: 'Manual',
};

// Faixa compacta com o estado atual da bomba do dispositivo selecionado e um botão de
// controle manual — funciona em qualquer modo (a configuração completa fica em
// Configurações > Bomba d'água, aqui é só o essencial para acompanhar/agir rápido).
function PumpWidget({ pump, onToggle, toggling }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            pump.isOn
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          Bomba {pump.isOn ? 'ligada' : 'desligada'}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Modo: {PUMP_MODE_LABEL[pump.mode]}
          {pump.isOn && pump.turnedOnAt ? ` · ligada ${formatRelative(pump.turnedOnAt)}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={toggling}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
          pump.isOn ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {toggling ? 'Aguarde…' : pump.isOn ? 'Desligar agora' : 'Ligar agora'}
      </button>
    </div>
  );
}

// Linha compacta e somente-informativa (a troca de dispositivo acontece no seletor
// abaixo de "Dashboard") com a temperatura atual de um dispositivo que não é o
// exibido no momento: "Nome → valor °C status 🔴N" (a bolinha só aparece se houver
// notificação pendente daquele dispositivo).
function OtherDeviceSummary({ item, alertCount }) {
  const status = getDeviceStatus(item.device.lastSeenAt);
  return (
    <p>
      <span className="font-medium text-slate-700 dark:text-slate-200">{item.device.name}</span>
      <span className="mx-1 text-slate-400 dark:text-slate-500">→</span>
      <span>{item.measurement ? `${formatNumber(item.measurement.temperature)} °C` : 'sem leitura'}</span>
      <span className="ml-1">{status.dot}</span>
      <NotificationBadge count={alertCount} className="ml-1 align-middle" />
    </p>
  );
}
