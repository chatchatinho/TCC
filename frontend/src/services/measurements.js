import api from './api';

export function getLatest() {
  return api.get('/measurements/latest').then((res) => res.data.latest);
}

export function simulateMeasurement(data) {
  return api.post('/measurements/simulate', data).then((res) => res.data);
}
