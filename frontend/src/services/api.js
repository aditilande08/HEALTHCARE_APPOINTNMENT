const API_BASE = import.meta.env.VITE_API_URL 
  ? (import.meta.env.VITE_API_URL.endsWith('/api') ? import.meta.env.VITE_API_URL : `${import.meta.env.VITE_API_URL}/api`)
  : '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.isRefreshing = false;
    this.refreshSubscribers = [];
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (access) localStorage.setItem('accessToken', access);
    else localStorage.removeItem('accessToken');

    if (refresh) localStorage.setItem('refreshToken', refresh);
    else localStorage.removeItem('refreshToken');
  }

  clearTokens() {
    this.setTokens(null, null);
    localStorage.removeItem('user');
  }

  onRefreshed(token) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  addRefreshSubscriber(callback) {
    this.refreshSubscribers.push(callback);
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      let response = await fetch(url, config);

      if (response.status === 401 && this.refreshToken && !options._retry) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: this.refreshToken }),
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              this.setTokens(data.accessToken, this.refreshToken);
              this.isRefreshing = false;
              this.onRefreshed(data.accessToken);
            } else {
              this.clearTokens();
              this.isRefreshing = false;
              window.dispatchEvent(new Event('auth:logout'));
              throw new Error('Session expired');
            }
          } catch (err) {
            this.clearTokens();
            this.isRefreshing = false;
            window.dispatchEvent(new Event('auth:logout'));
            throw err;
          }
        }

        // Wait for token refresh to complete
        const retryToken = await new Promise((resolve) => {
          this.addRefreshSubscriber((token) => resolve(token));
        });

        headers['Authorization'] = `Bearer ${retryToken}`;
        return fetch(url, { ...options, headers, _retry: true }).then((res) => this.handleResponse(res));
      }

      return this.handleResponse(response);
    } catch (err) {
      throw err;
    }
  }

  async handleResponse(response) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg = data?.error || (Array.isArray(data?.errors) ? data.errors[0].msg : 'Request failed');
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  get(endpoint, options) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  post(endpoint, body, options) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options });
  }

  patch(endpoint, body, options) {
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options });
  }

  delete(endpoint, options) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }
}

export const api = new ApiClient();
