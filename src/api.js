const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// In-memory access token (never persisted to localStorage for security)
let memoryAccessToken = null;

// Refresh queue to prevent race conditions during token expiration
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Core fetch wrapper
async function customFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  options.credentials = 'include';

  if (!(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  } else {
    options.headers = { ...options.headers };
  }

  if (memoryAccessToken) {
    options.headers['Authorization'] = `Bearer ${memoryAccessToken}`;
  }

  try {
    const response = await fetch(url, options);

    const isAuthError = response.status === 401;
    if (isAuthError && !options._retry && !endpoint.startsWith('/api/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            options.headers['Authorization'] = `Bearer ${token}`;
            options._retry = true;
            return customFetch(endpoint, options);
          })
          .catch((err) => Promise.reject(err));
      }

      options._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await _doRefresh();
        processQueue(null, newAccessToken);
        isRefreshing = false;

        options.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return customFetch(endpoint, options);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        handleLogoutRedirect();
        throw refreshError;
      }
    }

    if (!response.ok) {
      let errorMessage = `API error: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && (errorData.message || errorData.error)) {
          errorMessage = errorData.message || errorData.error;
        }
      } catch (_) { }

      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (error) {
    throw error;
  }
}

async function _doRefresh() {
  const fallbackRefreshToken = localStorage.getItem('fallback_refresh_token');
  if (!fallbackRefreshToken) {
    throw new Error('No refresh token available');
  }

  const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: fallbackRefreshToken }),
  });

  if (!refreshRes.ok) {
    throw new Error('Refresh token invalid or expired');
  }

  const refreshData = await refreshRes.json();
  const dataObj = refreshData.data || refreshData;
  const { accessToken, refreshToken: newRefreshToken } = dataObj;

  memoryAccessToken = accessToken;
  if (newRefreshToken) {
    localStorage.setItem('fallback_refresh_token', newRefreshToken);
  }

  return accessToken;
}

function handleLogoutRedirect() {
  memoryAccessToken = null;
  localStorage.removeItem('fallback_refresh_token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth-logout'));
}

export const api = {
  get: (endpoint, options = {}) =>
    customFetch(endpoint, { ...options, method: 'GET' }),

  post: (endpoint, body, options = {}) =>
    customFetch(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: (endpoint, body, options = {}) =>
    customFetch(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: (endpoint, options = {}) =>
    customFetch(endpoint, { ...options, method: 'DELETE' }),

  upload: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return customFetch('/api/upload', {
      ...options,
      method: 'POST',
      body: formData,
    });
  },

  loginUser: (accessToken, refreshToken, user) => {
    memoryAccessToken = accessToken;
    if (refreshToken) {
      localStorage.setItem('fallback_refresh_token', refreshToken);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  logoutUser: async () => {
    try {
      if (BASE_URL) {
        await customFetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      }
    } catch (_) {
      // ignore network errors on logout
    } finally {
      handleLogoutRedirect();
      window.location.href = '/login';
    }
  },

  checkSessionPersistence: async () => {
    const hasFallbackToken = !!localStorage.getItem('fallback_refresh_token');
    if (!hasFallbackToken) {
      return false;
    }

    try {
      await _doRefresh();
      return true;
    } catch (err) {
      console.warn('No active persistent session found.');
      handleLogoutRedirect();
      return false;
    }
  },

  get accessToken() {
    return memoryAccessToken;
  },

  get baseUrl() {
    return BASE_URL;
  },
};

export default api;
