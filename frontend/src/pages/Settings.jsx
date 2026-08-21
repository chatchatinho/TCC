import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import * as settingsService from '../services/settings';
import { parseDecimal, isValidDecimal } from '../utils/number';
import { useTheme } from '../context/ThemeContext';

const ACCENT_OPTIONS = [
  { key: 'blue', label: 'Azul', swatch: '#2563eb' },
  { key: 'emerald', label: 'Verde', swatch: '#059669' },
  { key: 'violet', label: 'Roxo', swatch: '#7c3aed' },
  { key: 'orange', label: 'Laranja', swatch: '#ea580c' },
];

export default function Settings() {
  const [form, setForm] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const { darkMode, toggleDarkMode, accent, setAccent } = useTheme();

  useEffect(() => {
    settingsService.getSettings().then(({ settings, thresholds }) => {
      setForm({
        idealTemperature: String(settings.idealTemperature),
        temperatureTolerance: String(settings.temperatureTolerance),
        idealHumidity: String(settings.idealHumidity),
        humidityTolerance: String(settings.humidityTolerance),
      });
      setThresholds(thresholds);
    });
  }, []);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  const allValid = form && Object.values(form).every(isValidDecimal);

  // Preview local dos limites calculados, para feedback imediato antes de salvar
  // (mesma fórmula usada no backend: ideal ± tolerância, umidade confinada a 0-100%).
  const preview =
    form && allValid
      ? {
          temperature: {
            min: parseDecimal(form.idealTemperature) - parseDecimal(form.temperatureTolerance),
            max: parseDecimal(form.idealTemperature) + parseDecimal(form.temperatureTolerance),
          },
          humidity: {
            min: Math.max(0, parseDecimal(form.idealHumidity) - parseDecimal(form.humidityTolerance)),
            max: Math.min(100, parseDecimal(form.idealHumidity) + parseDecimal(form.humidityTolerance)),
          },
        }
      : thresholds;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!allValid) {
      setError('Digite valores numéricos válidos (use vírgula ou ponto para decimais).');
      return;
    }

    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parseDecimal(v)]));
      const { thresholds: newThresholds } = await settingsService.updateSettings(payload);
      setThresholds(newThresholds);
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

      <form
        onSubmit={handleSubmit}
        className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <fieldset className="mb-6">
          <legend className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Temperatura</legend>
          <div className="grid grid-cols-2 gap-4">
            <DecimalField label="Temperatura ideal (°C)" value={form.idealTemperature} onChange={update('idealTemperature')} />
            <DecimalField label="Margem de tolerância (±°C)" value={form.temperatureTolerance} onChange={update('temperatureTolerance')} />
          </div>
          {preview && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Faixa aceitável: {preview.temperature.min.toFixed(1)}°C a {preview.temperature.max.toFixed(1)}°C
            </p>
          )}
        </fieldset>

        <fieldset className="mb-6">
          <legend className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Umidade</legend>
          <div className="grid grid-cols-2 gap-4">
            <DecimalField label="Umidade ideal (%)" value={form.idealHumidity} onChange={update('idealHumidity')} />
            <DecimalField label="Margem de tolerância (±%)" value={form.humidityTolerance} onChange={update('humidityTolerance')} />
          </div>
          {preview && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Faixa aceitável: {preview.humidity.min.toFixed(1)}% a {preview.humidity.max.toFixed(1)}%
            </p>
          )}
        </fieldset>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">Configurações salvas com sucesso.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </form>

      <div className="mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Aparência</h2>

        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Modo escuro</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Aplica-se a todo o sistema, salvo neste navegador.</p>
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
    </Layout>
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
