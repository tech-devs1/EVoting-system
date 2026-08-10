import { auth } from './firebase';

// Use Next.js API proxy at /api/[...path]/route.ts which forwards to backend
// On local dev, the proxy forwards to localhost:5000
// On Vercel, BACKEND_URL env var should be set to the deployed backend URL
const API_BASE_URL = '/api';

export async function getAuthHeaders(): Promise<HeadersInit> {
  if (typeof window === 'undefined') {
    return { 'Content-Type': 'application/json' };
  }

  const path = window.location.pathname;
  let token: string | null = null;
  let tenantId: string | null = null;

  if (path.startsWith('/superadmin')) {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_superadmin_token') ||
            localStorage.getItem('COMPSSA_superadmin_token') ||
            localStorage.getItem('COMPSSA_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_superadmin_tenantId') ||
              localStorage.getItem('COMPSSA_superadmin_tenantId') ||
              localStorage.getItem('COMPSSA_tenantId');
  } else if (path.startsWith('/admin')) {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_admin_token') ||
            localStorage.getItem('COMPSSA_admin_token') ||
            localStorage.getItem('COMPSSA_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_admin_tenantId') ||
              localStorage.getItem('COMPSSA_admin_tenantId') ||
              localStorage.getItem('COMPSSA_tenantId');
  } else if (path.startsWith('/voter')) {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_voter_tenantId') ||
              localStorage.getItem('COMPSSA_voter_tenantId') ||
              localStorage.getItem('COMPSSA_tenantId');
  } else {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_superadmin_token') ||
            sessionStorage.getItem('COMPSSA_admin_token') ||
            sessionStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_superadmin_token') ||
            localStorage.getItem('COMPSSA_admin_token') ||
            localStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_superadmin_tenantId') ||
              sessionStorage.getItem('COMPSSA_admin_tenantId') ||
              sessionStorage.getItem('COMPSSA_voter_tenantId') ||
              localStorage.getItem('COMPSSA_tenantId');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  } else {
    const user = auth.currentUser;
    if (user) {
      try {
        const fbToken = await user.getIdToken();
        headers['Authorization'] = `Bearer ${fbToken}`;
      } catch (e) {}
    }
  }

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any
): Promise<T> {
  const headers = await getAuthHeaders();

  const options: RequestInit = {
    method,
    headers,
    cache: 'no-store', // Disable aggressive Next.js dynamic fetch caching
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error('[API] Non-JSON response:', text.substring(0, 200));
    throw new Error(
      response.status === 413
        ? 'The file is too large. Try splitting it into smaller CSV files.'
        : `Server returned an unexpected response (${response.status}). Please check that the backend is running.`
    );
  }
  
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}
