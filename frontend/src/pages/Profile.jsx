import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import * as usersService from '../services/users';
import { formatDate } from '../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await usersService.updateProfile({ fullName });
      setUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Perfil</h1>

      <form onSubmit={handleSubmit} className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Nome completo
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500">E-mail</p>
          <p className="text-sm text-slate-700">{user?.email}</p>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Data de nascimento</p>
          <p className="text-sm text-slate-700">{formatDate(user?.birthDate)}</p>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600">Perfil atualizado com sucesso.</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </Layout>
  );
}
