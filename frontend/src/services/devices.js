import api from './api';

export function listDevices() {
  return api.get('/devices').then((res) => res.data.devices);
}

export function createDevice(data) {
  return api.post('/devices', data).then((res) => res.data);
}

export function updateDevice(id, data) {
  return api.put(`/devices/${id}`, data).then((res) => res.data.device);
}

export function deleteDevice(id) {
  return api.delete(`/devices/${id}`);
}

export function rotateDeviceSecret(id) {
  return api.post(`/devices/${id}/rotate-secret`).then((res) => res.data);
}
