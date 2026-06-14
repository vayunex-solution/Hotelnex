import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ───────────────────────────────────────────────────────
// Automatically attaches the JWT Bearer token to every outgoing request.
// No manual headers needed anywhere in the app.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ──────────────────────────────────────────────────────
// Handles stale/expired sessions globally.
// On 401, clears stored credentials and redirects to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear all auth state — token is invalid or expired
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Redirect to login — avoids stale sessions lingering in the app
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
