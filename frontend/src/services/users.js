import api from './api';

export function updateProfile(data) {
  return api.put('/users/me', data).then((res) => res.data.user);
}

export function changePassword(currentPassword, newPassword) {
  return api.put('/users/me/password', { currentPassword, newPassword });
}

export function deleteAccount(password) {
  return api.delete('/users/me', { data: { password } });
}
