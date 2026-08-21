import api from './api';

export function listAlerts(params) {
  return api.get('/alerts', { params }).then((res) => res.data);
}

export function getAlertsSummary() {
  return api.get('/alerts/summary').then((res) => res.data);
}

export function markAlertRead(id) {
  return api.patch(`/alerts/${id}/read`).then((res) => res.data.alert);
}
