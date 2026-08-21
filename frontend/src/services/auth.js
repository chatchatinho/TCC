import api from './api';

export function register(data) {
  return api.post('/auth/register', data).then((res) => res.data.user);
}

export function login(data) {
  return api.post('/auth/login', data).then((res) => res.data.user);
}

export function logout() {
  return api.post('/auth/logout');
}

export function getCurrentUser() {
  return api.get('/auth/me').then((res) => res.data.user);
}
