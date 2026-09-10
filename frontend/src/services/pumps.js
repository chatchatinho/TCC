import api from './api';

export function getPump(deviceId) {
  return api.get(`/devices/${deviceId}/pump`).then((res) => res.data.pump);
}

export function updatePump(deviceId, data) {
  return api.put(`/devices/${deviceId}/pump`, data).then((res) => res.data.pump);
}

export function togglePump(deviceId, isOn) {
  return api.post(`/devices/${deviceId}/pump/toggle`, { isOn }).then((res) => res.data.pump);
}
