const BASE_URL = 'http://localhost:5000/api';

class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${BASE_URL}${endpoint}`;
    
    // Set headers
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach token
    const token = localStorage.getItem('token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const config = {
      ...options,
      headers,
    };

    let response = await fetch(url, config);

    // Auto-refresh token on 401
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem('token', data.token);
            
            // Retry request with new token
            headers.set('Authorization', `Bearer ${data.token}`);
            response = await fetch(url, { ...options, headers });
          } else {
            // Refresh token expired, logout
            this.logout();
          }
        } catch (err) {
          console.error('[API Client] Refresh token failed', err);
          this.logout();
        }
      } else {
        this.logout();
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // For file downloads (exports), check response content disposition
    const disposition = response.headers.get('content-disposition');
    if (disposition && (disposition.includes('attachment') || disposition.includes('sheet') || disposition.includes('csv'))) {
      const blob = await response.blob();
      return { blob, filename: this.extractFilename(disposition) };
    }

    return response.json();
  }

  private extractFilename(disposition: string): string {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      return matches[1].replace(/['"]/g, '');
    }
    return 'export';
  }

  private logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  public get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  public post(endpoint: string, body: any, isFormData: boolean = false) {
    return this.request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  public put(endpoint: string, body: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  public delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
