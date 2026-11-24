const API_ROOT = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('campus-token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(`${API_ROOT}/api${path}`, { ...options, method, headers });
    } catch (error) {
      if (method !== 'GET' || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    if (method === 'GET' && response.status >= 500 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      continue;
    }
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  throw new Error('Unable to complete the request.');
}

export function imageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ROOT}${path}`;
}
