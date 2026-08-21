import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import * as usersService from '../services/users';
import { formatDate, formatDateTime } from '../utils/format';

const MAX_AVATAR_BYTES = 500 * 1024;

const TABS = [
  { key: 'data', label: 'Dados' },
  { key: 'security', label: 'Segurança' },
];

export default function Profile() {
  const [activeTab, setActiveTab] = useState('data');

  return (
    <Layout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">Perfil</h1>

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

      {activeTab === 'data' && <DataTab />}
      {activeTab === 'security' && <SecurityTab />}
    </Layout>
  );
}

function DataTab() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;

    setAvatarError('');

    if (!file.type.startsWith('image/')) {
      setAvatarError('Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Imagem muito grande (máximo 500KB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingAvatar(true);
      try {
        const updated = await usersService.updateProfile({ avatarData: reader.result });
        setUser(updated);
      } catch (err) {
        setAvatarError(err.response?.data?.error || 'Não foi possível salvar a foto.');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveAvatar() {
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const updated = await usersService.updateProfile({ avatarData: null });
      setUser(updated);
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Não foi possível remover a foto.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <>
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Foto de perfil (opcional)</p>
        <div className="flex items-center gap-4">
          {user?.avatarData ? (
            <img src={user.avatarData} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-500">
              {user?.fullName?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
              {uploadingAvatar ? 'Enviando…' : 'Escolher imagem'}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            </label>
            {user?.avatarData && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Remover foto
              </button>
            )}
          </div>
        </div>
        {avatarError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{avatarError}</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Nome completo
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">E-mail</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{user?.email}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Não pode ser alterado por aqui — é o identificador de login da conta.
          </p>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Data de nascimento</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{formatDate(user?.birthDate)}</p>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Conta criada em</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{formatDateTime(user?.createdAt)}</p>
        </div>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">Perfil atualizado com sucesso.</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </>
  );
}

function SecurityTab() {
  return (
    <>
      <ChangePasswordForm />
      <DeleteAccountSection />
    </>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('As senhas novas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      await usersService.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const details = err.response?.data?.details;
      const firstDetail = details ? Object.values(details)[0]?.[0] : null;
      setError(firstDetail || err.response?.data?.error || 'Não foi possível trocar a senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Trocar senha</h2>

      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Senha atual
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mt-1 mb-3 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>

      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Nova senha
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1 mb-3 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>

      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Confirmar nova senha
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">Senha alterada com sucesso.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Salvando…' : 'Trocar senha'}
      </button>
    </form>
  );
}

// Apagar a conta é irreversível — exige a senha (mesmo padrão de troca de senha) e uma
// confirmação explícita antes de habilitar o botão, para reduzir o risco de clique
// acidental num link tão destrutivo.
function DeleteAccountSection() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDeleting(true);
    try {
      await usersService.deleteAccount(password);
      setUser(null);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível excluir a conta.');
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/30 dark:bg-slate-800">
      <h2 className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400">Excluir conta</h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Remove permanentemente sua conta, dispositivos, histórico de leituras, alertas e configurações. Essa ação
        não pode ser desfeita.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          Quero excluir minha conta
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Confirme sua senha
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 mb-3 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="mb-4 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            Entendo que essa ação é permanente e apaga todos os meus dados.
          </label>

          {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!confirmed || deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Excluindo…' : 'Excluir permanentemente'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword('');
                setConfirmed(false);
                setError('');
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
