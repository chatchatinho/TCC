import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import * as settingsService from '../services/settings';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.getSettings().then(({ settings, thresholds }) => {
      setForm({
        idealTemperature: settings.idealTemperature,
        temperatureTolerance: settings.temperatureTolerance,
        idealHumidity: settings.idealHumidity,
        humidityTolerance: settings.humidityTolerance,
      });
      setThresholds(thresholds);
    });
  }, []);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  // Preview local dos limites calculados, para feedback imediato antes de salvar
  // (mesma fórmula usada no backend: ideal ± tolerância, umidade confinada a 0-100%).
  const preview = form
    ? {
        temperature: {
          min: Number(form.idealTemperature) - Number(form.temperatureTolerance),
          max: Number(form.idealTemperature) + Number(form.temperatureTolerance),
        },
        humidity: {
          min: Math.max(0, Number(form.idealHumidity) - Number(form.humidityTolerance)),
          max: Math.min(100, Number(form.idealHumidity) + Number(form.humidityTolerance)),
        },
      }
    : thresholds;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]));
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
        <p className="text-slate-500">Carregando…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Configurações</h1>

      <form onSubmit={handleSubmit} className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <fieldset className="mb-6">
          <legend className="mb-3 text-sm font-semibold text-slate-700">Temperatura</legend>
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Temperatura ideal (°C)" value={form.idealTemperature} onChange={update('idealTemperature')} step="0.1" />
            <NumberField label="Margem de tolerância (±°C)" value={form.temperatureTolerance} onChange={update('temperatureTolerance')} step="0.1" min="0.1" />
          </div>
          {preview && (
            <p className="mt-2 text-xs text-slate-500">
              Faixa aceitável: {preview.temperature.min.toFixed(1)}°C a {preview.temperature.max.toFixed(1)}°C
            </p>
          )}
        </fieldset>

        <fieldset className="mb-6">
          <legend className="mb-3 text-sm font-semibold text-slate-700">Umidade</legend>
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Umidade ideal (%)" value={form.idealHumidity} onChange={update('idealHumidity')} step="1" />
            <NumberField label="Margem de tolerância (±%)" value={form.humidityTolerance} onChange={update('humidityTolerance')} step="1" min="0.1" />
          </div>
          {preview && (
            <p className="mt-2 text-xs text-slate-500">
              Faixa aceitável: {preview.humidity.min.toFixed(1)}% a {preview.humidity.max.toFixed(1)}%
            </p>
          )}
        </fieldset>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {success && <p className="mb-4 text-sm text-emerald-600">Configurações salvas com sucesso.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </form>
    </Layout>
  );
}

function NumberField({ label, value, onChange, step, min }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={onChange}
        required
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
