import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import * as settingsService from '../services/settings';
import { parseDecimal, isValidDecimal, isValidOptionalDecimal } from '../utils/number';
import { useTheme } from '../context/ThemeContext';

const ACCENT_OPTIONS = [
  { key: 'blue', label: 'Azul', swatch: '#2563eb' },
  { key: 'emerald', label: 'Verde', swatch: '#059669' },
  { key: 'violet', label: 'Roxo', swatch: '#7c3aed' },
  { key: 'orange', label: 'Laranja', swatch: '#ea580c' },
];

const REQUIRED_FIELDS = ['idealTemperature', 'temperatureTolerance', 'idealHumidity', 'humidityTolerance'];
const OPTIONAL_FIELDS = ['temperatureMin', 'temperatureMax', 'humidityMin', 'humidityMax'];

const DEFAULT_FORM = {
  idealTemperature: '25',
  temperatureTolerance: '2',
  temperatureMin: '',
  temperatureMax: '',
  idealHumidity: '60',
  humidityTolerance: '10',
  humidityMin: '',
  humidityMax: '',
};

const TABS = [
  { key: 'values', label: 'Valores' },
  { key: 'appearance', label: 'Aparência' },
];

function toFormString(value) {
  return value == null ? '' : String(value);
}

// Faixa final de uma variável: usa a taxa opcional quando definida, senão cai no
// cálculo automático (ideal ± tolerância) — mesma regra do backend, para o preview
// bater com o que vai ser salvo antes mesmo de enviar o formulário.
function computeRange(ideal, tolerance, min, max, clampToPercent) {
  const computedMin = ideal - tolerance;
  const computedMax = ideal + tolerance;
  const finalMin = min !== '' ? parseDecimal(min) : clampToPercent ? Math.max(0, computedMin) : computedMin;
  const finalMax = max !== '' ? parseDecimal(max) : clampToPercent ? Math.min(100, computedMax) : computedMax;
  return { min: finalMin, max: finalMax };
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('values');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const { darkMode, toggleDarkMode, followsSystem, followSystemTheme, accent, setAccent } = useTheme();

  useEffect(() => {
    settingsService.getSettings().then(({ settings }) => {
      setForm({
        idealTemperature: toFormString(settings.idealTemperature),
        temperatureTolerance: toFormString(settings.temperatureTolerance),
        temperatureMin: toFormString(settings.temperatureMin),
        temperatureMax: toFormString(settings.temperatureMax),
        idealHumidity: toFormString(settings.idealHumidity),
        humidityTolerance: toFormString(settings.humidityTolerance),
        humidityMin: toFormString(settings.humidityMin),
        humidityMax: toFormString(settings.humidityMax),
      });
    });
  }, []);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function restoreDefaults() {
    setForm(DEFAULT_FORM);
    setError('');
    setSuccess(false);
  }

  const allValid =
    form &&
    REQUIRED_FIELDS.every((f) => isValidDecimal(form[f])) &&
    OPTIONAL_FIELDS.every((f) => isValidOptionalDecimal(form[f]));

  const preview =
    form && allValid
      ? {
          temperature: computeRange(
            parseDecimal(form.idealTemperature),
            parseDecimal(form.temperatureTolerance),
            form.temperatureMin,
            form.temperatureMax,
            false,
          ),
          humidity: computeRange(
            parseDecimal(form.idealHumidity),
            parseDecimal(form.humidityTolerance),
            form.humidityMin,
            form.humidityMax,
            true,
          ),
        }
      : null;

  const rangeErrors = preview
    ? {
        temperature: form.temperatureMin !== '' && form.temperatureMax !== '' && preview.temperature.min >= preview.temperature.max,
        humidity: form.humidityMin !== '' && form.humidityMax !== '' && preview.humidity.min >= preview.humidity.max,
      }
    : { temperature: false, humidity: false };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!allValid) {
      setError('Digite valores numéricos válidos (use vírgula ou ponto para decimais).');
      return;
    }
    if (rangeErrors.temperature || rangeErrors.humidity) {
      setError('A taxa mínima precisa ser menor que a máxima.');
      return;
    }

    setSaving(true);
    try {
      const payload = {};
      for (const field of REQUIRED_FIELDS) payload[field] = parseDecimal(form[field]);
      for (const field of OPTIONAL_FIELDS) payload[field] = form[field] === '' ? null : parseDecimal(form[field]);

      await settingsService.updateSettings(payload);
      setSuccess(true);
    } catch (err) {
      const details = err.response?.data?.details;
      const firstDetail = details ? Object.values(details)[0]?.[0] : null;
      setError(firstDetail || err.response?.data?.error || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <Layout>
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">Configurações</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'values' && (
        <form onSubmit={handleSubmit} className="max-w-3xl">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <VariableSection
              title="Temperatura"
              accent="blue"
              unit="°C"
              idealLabel="Temperatura ideal (°C)"
              idealValue={form.idealTemperature}
              onIdealChange={update('idealTemperature')}
              toleranceLabel="Margem de tolerância (±°C)"
              toleranceValue={form.temperatureTolerance}
              onToleranceChange={update('temperatureTolerance')}
              minValue={form.temperatureMin}
              onMinChange={update('temperatureMin')}
              maxValue={form.temperatureMax}
              onMaxChange={update('temperatureMax')}
              range={preview?.temperature}
              rangeError={rangeErrors.temperature}
            />
            <VariableSection
              title="Umidade"
              accent="teal"
              unit="%"
              idealLabel="Umidade ideal (%)"
              idealValue={form.idealHumidity}
              onIdealChange={update('idealHumidity')}
              toleranceLabel="Margem de tolerância (±%)"
              toleranceValue={form.humidityTolerance}
              onToleranceChange={update('humidityTolerance')}
              minValue={form.humidityMin}
              onMinChange={update('humidityMin')}
              maxValue={form.humidityMax}
              onMaxChange={update('humidityMax')}
              range={preview?.humidity}
              rangeError={rangeErrors.humidity}
            />
          </div>

          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">Configurações salvas com sucesso.</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar configurações'}
            </button>
            <button
              type="button"
              onClick={restoreDefaults}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Restaurar padrões
            </button>
          </div>
        </form>
      )}

      {activeTab === 'appearance' && (
        <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Modo escuro</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {followsSystem
                  ? 'Seguindo automaticamente o tema do seu dispositivo.'
                  : 'Definido manualmente neste navegador.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              onClick={toggleDarkMode}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${darkMode ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {!followsSystem && (
            <button
              type="button"
              onClick={followSystemTheme}
              className="mb-5 -mt-3 text-xs font-medium text-brand-600 hover:underline dark:text-brand-500"
            >
              Voltar a seguir o tema do dispositivo
            </button>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Cor de destaque</p>
            <div className="flex gap-2">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAccent(option.key)}
                  title={option.label}
                  className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-white transition-shadow dark:ring-offset-slate-800 ${
                    accent === option.key ? 'ring-2 ring-slate-900 dark:ring-slate-100' : ''
                  }`}
                  style={{ backgroundColor: option.swatch }}
                >
                  <span className="sr-only">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const ACCENT_BORDER = {
  blue: 'border-l-blue-400 dark:border-l-blue-500',
  teal: 'border-l-teal-400 dark:border-l-teal-500',
};

function VariableSection({
  title,
  accent,
  unit,
  idealLabel,
  idealValue,
  onIdealChange,
  toleranceLabel,
  toleranceValue,
  onToleranceChange,
  minValue,
  onMinChange,
  maxValue,
  onMaxChange,
  range,
  rangeError,
}) {
  return (
    <div
      className={`rounded-xl border border-l-2 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${ACCENT_BORDER[accent]}`}
    >
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Valores obrigatórios
      </p>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <DecimalField label={idealLabel} value={idealValue} onChange={onIdealChange} />
        <DecimalField label={toleranceLabel} value={toleranceValue} onChange={onToleranceChange} />
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Taxa mínima e máxima (opcional)
      </p>
      <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
        Se definidas, substituem o cálculo automático (ideal ± tolerância) para aquele lado da faixa.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <OptionalDecimalField label={`Mín (${unit})`} value={minValue} onChange={onMinChange} />
        <OptionalDecimalField label={`Máx (${unit})`} value={maxValue} onChange={onMaxChange} />
      </div>

      {range && (
        <p className={`mt-3 text-xs ${rangeError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {rangeError
            ? 'A taxa mínima precisa ser menor que a máxima.'
            : `Faixa aceitável: ${range.min.toFixed(1)}${unit} a ${range.max.toFixed(1)}${unit}`}
        </p>
      )}
    </div>
  );
}

function DecimalField({ label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        required
        placeholder="ex.: 25 ou 25,5"
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function OptionalDecimalField({ label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        placeholder="opcional"
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}
