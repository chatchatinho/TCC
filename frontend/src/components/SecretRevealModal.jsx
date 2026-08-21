import { useState } from 'react';

// Exibe o token/segredo do dispositivo em texto puro exatamente uma vez — o backend
// nunca o retorna de novo depois deste momento (só o hash fica armazenado).
export default function SecretRevealModal({ title, deviceIdentifier, secret, onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Copie e guarde este token agora. Por segurança, ele não pode ser exibido novamente — se
          perdê-lo, será preciso gerar um novo.
        </p>

        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Identificador do dispositivo</p>
          <code className="mt-1 block rounded-md bg-slate-100 p-2 text-sm dark:bg-slate-900 dark:text-slate-200">{deviceIdentifier}</code>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Token de API (X-Device-Key)</p>
          <code className="mt-1 block break-all rounded-md bg-slate-100 p-2 text-sm dark:bg-slate-900 dark:text-slate-200">{secret}</code>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copied ? 'Copiado!' : 'Copiar token'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Já guardei, fechar
          </button>
        </div>
      </div>
    </div>
  );
}
