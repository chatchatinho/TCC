import axios from 'axios';

// withCredentials: envia/recebe o cookie httpOnly de sessão em toda requisição.
// O backend precisa ter CORS_ORIGIN apontando para esta origem e credentials: true.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export default api;
