import api from './api';

export function getHistory(params) {
  return api.get('/history', { params }).then((res) => res.data);
}

// Exportação em CSV é feita por navegação direta do navegador (não via axios/blob):
// o cookie httpOnly de sessão é enviado automaticamente numa navegação GET normal,
// e o navegador cuida do download sem precisarmos manipular blobs manualmente.
export function buildExportUrl(params) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ).toString();
  return `${import.meta.env.VITE_API_URL}/history/export?${query}`;
}
