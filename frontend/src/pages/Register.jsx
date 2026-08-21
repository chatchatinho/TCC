import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const initialForm = { fullName: '', email: '', password: '', confirmPassword: '', birthDate: '' };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const { confirmPassword, ...payload } = form; // eslint-disable-line no-unused-vars
      await register(payload);
      navigate('/dashboard');
    } catch (err) {
      const details = err.response?.data?.details;
      const firstDetail = details ? Object.values(details)[0]?.[0] : null;
      setError(firstDetail || err.response?.data?.error || 'Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold text-brand-700">Criar conta</h1>
        <p className="mt-1 text-center text-sm text-slate-500">MonitorTCC</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="Nome completo" id="fullName" type="text" value={form.fullName} onChange={update('fullName')} />
          <Field label="E-mail" id="email" type="email" value={form.email} onChange={update('email')} />
          <Field label="Senha" id="password" type="password" value={form.password} onChange={update('password')} />
          <Field
            label="Confirmar senha"
            id="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
          />
          <Field label="Data de nascimento" id="birthDate" type="date" value={form.birthDate} onChange={update('birthDate')} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, id, type, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
