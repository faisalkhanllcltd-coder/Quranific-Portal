import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ── REFRESH LOCK & QUEUE ───────────────────────────────────────────────────
// Prevents an infinite loop if multiple components try to fetch data at the
// exact moment the token expires. It locks the system and queues the requests.
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ── REQUEST INTERCEPTOR ────────────────────────────────────────────────────
// Automatically attaches the JWT access token to every outgoing request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── RESPONSE INTERCEPTOR ───────────────────────────────────────────────────
// Handles 401 Unauthorized globally with a silent refresh mechanism.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we get a 401 and we haven't already tried to retry this exact request...
    if (error.response?.status === 401 && !originalRequest._retry) {

      // Safety net: If the refresh token request itself fails with 401, 
      // the session is truly dead. Kick them out immediately.
      // BUGFIX: Corrected the endpoint check to match the actual Django route
      if (originalRequest.url.includes('/accounts/login/refresh/')) {
        localStorage.clear();
        window.location.replace('/login');
        return Promise.reject(error);
      }

      // If another request already triggered the refresh process, put this request in the queue.
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      // Lock the system and mark this request as retrying
      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh');

      // If no refresh token exists, they shouldn't be here. Kick them out.
      if (!refreshToken) {
        localStorage.clear();
        window.location.replace('/login');
        return Promise.reject(error);
      }

      try {
        // MUST use raw axios here, not our 'api' instance, to avoid interceptor loops
        // Uses the same API_BASE_URL as the axios instance — no second hardcoded URL
        const res = await axios.post(`${API_BASE_URL}/accounts/login/refresh/`, {
          refresh: refreshToken
        });

        const newAccessToken = res.data.access;
        localStorage.setItem('access', newAccessToken);

        // Update the default headers for future requests
        api.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;

        // Process all the queued requests with the new token
        processQueue(null, newAccessToken);

        // Retry the original request that triggered the 401
        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
        return api(originalRequest);

      } catch (refreshError) {
        // If the refresh token has expired (e.g., after 7 days), the session is dead.
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.replace('/login');
        return Promise.reject(refreshError);
      } finally {
        // Unlock the system
        isRefreshing = false;
      }
    }

    // Handle 503 Service Unavailable (e.g., LiveKit server down)
    else if (error.response?.status === 503) {
      alert(error.response.data?.detail || "Service Unavailable. Please contact administration.");
    }

    return Promise.reject(error);
  }
);

export default api;