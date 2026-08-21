import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import SecretRevealModal from '../components/SecretRevealModal';
import * as devicesService from '../services/devices';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/format';
import { getDeviceStatus } from '../utils/deviceStatus';

export default function Devices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(null); // { title, deviceIdentifier, secret }

  async function load() {
    setLoading(true);
    try {
      setDevices(await devicesService.listDevices());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const { device, deviceSecret } = await devicesService.createDevice({ name });
      setName('');
      await load();
      setRevealed({ title: 'Dispositivo cadastrado', deviceIdentifier: device.deviceIdentifier, secret: deviceSecret });
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível cadastrar o dispositivo.');
    }
  }

  async function handleToggleActive(device) {
    await devicesService.updateDevice(device.id, { active: !device.active });
    load();
  }

  async function handleRotate(device) {
    const { deviceSecret } = await devicesService.rotateDeviceSecret(device.id);
    setRevealed({ title: 'Token regenerado', deviceIdentifier: device.deviceIdentifier, secret: deviceSecret });
  }

  async function handleDelete(device) {
    if (!window.confirm(`Remover o dispositivo "${device.name}"? O histórico associado também será apagado.`)) return;
    await devicesService.deleteDevice(device.id);
    load();
  }

  return (
    <Layout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Dispositivos</h1>

      <div className="mb-6 grid grid-cols-1 gap-4">
        {loading && <p className="text-slate-500">Carregando…</p>}

        {!loading && devices.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum dispositivo cadastrado ainda. Adicione um abaixo.</p>
        )}

        {devices.map((device) => {
          const status = getDeviceStatus(device.lastSeenAt);
          return (
            <div key={device.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{device.name}</p>
                  <p className="text-sm text-slate-500">{device.deviceIdentifier}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {status.dot} {status.label} · última comunicação: {formatDateTime(device.lastSeenAt)}
                  </p>
                  <p className="text-xs text-slate-400">Associado a: {user?.fullName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleToggleActive(device)} className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">
                    {device.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button type="button" onClick={() => handleRotate(device)} className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">
                    Regenerar token
                  </button>
                  <button type="button" onClick={() => handleDelete(device)} className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50">
                    Remover
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Adicionar dispositivo</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="Nome (ex.: Sensor Sala)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Adicionar
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-slate-400">
          O identificador (ex.: ESP32-XXXXXX) é gerado automaticamente. O token de acesso é exibido uma única vez após o cadastro.
        </p>
      </div>

      {revealed && (
        <SecretRevealModal
          title={revealed.title}
          deviceIdentifier={revealed.deviceIdentifier}
          secret={revealed.secret}
          onClose={() => setRevealed(null)}
        />
      )}
    </Layout>
  );
}
