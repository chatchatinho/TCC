import api from './api';

export function updateProfile(data) {
  return api.put('/users/me', data).then((res) => res.data.user);
}
