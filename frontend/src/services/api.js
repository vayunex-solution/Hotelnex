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

// Handles stale/expired sessions globally.
// On 401 or 403 token expiration/invalidation, clears stored credentials and redirects to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const msg = data?.message?.toLowerCase() || '';
      
      if (status === 401 || (status === 403 && (msg.includes('token') || msg.includes('expired') || msg.includes('authentication')))) {
        // Clear all auth state — token is invalid or expired
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Redirect to login — avoids stale sessions lingering in the app
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
