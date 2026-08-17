import axios from 'axios';

/**
 * Dedicated Axios client for /api/v1/platform/* endpoints.
 * Uses a separate localStorage key (platform_token) so it never
 * conflicts with the hotel PMS token.
 */
const platformApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1/platform`
    : 'http://localhost:5000/api/v1/platform',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach Super Admin JWT ──────────────────────────────
platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — auto-logout on 401/403 ────────────────────────────
platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('platform_token');
      localStorage.removeItem('platform_user');
      // Redirect to platform login
      if (!window.location.pathname.startsWith('/platform/login')) {
        window.location.href = '/platform/login';
      }
    }
    return Promise.reject(error);
  },
);

export default platformApi;
