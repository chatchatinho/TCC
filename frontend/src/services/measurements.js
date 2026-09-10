import api from './api';

export function getLatest() {
  return api.get('/measurements/latest').then((res) => res.data.latest);
}
