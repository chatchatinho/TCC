import api from './api';

export function getSettings() {
  return api.get('/settings').then((res) => res.data);
}

export function updateSettings(data) {
  return api.put('/settings', data).then((res) => res.data);
}
