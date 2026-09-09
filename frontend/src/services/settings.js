import api from './api';

export function getSettings(deviceId) {
  return api.get(`/devices/${deviceId}/settings`).then((res) => res.data);
}

export function updateSettings(deviceId, data) {
  return api.put(`/devices/${deviceId}/settings`, data).then((res) => res.data);
}
