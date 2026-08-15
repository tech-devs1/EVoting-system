import { auth } from './firebase';

// Use Next.js API proxy at /api/[...path]/route.ts which forwards to backend
// On local dev, the proxy forwards to localhost:5000
// On Vercel, BACKEND_URL env var should be set to the deployed backend URL
const API_BASE_URL = 
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? '/api' // Uses Next.js local proxy or dev server
    : 'https://e-voting.htu.edu.gh/api'; // Points straight to your live cPanel backend
    
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
            localStorage.getItem('COMPSSA_superadmin_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_superadmin_tenantId') ||
              localStorage.getItem('COMPSSA_superadmin_tenantId');
  } else if (path.startsWith('/admin')) {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_admin_token') ||
            localStorage.getItem('COMPSSA_admin_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_admin_tenantId') ||
              localStorage.getItem('COMPSSA_admin_tenantId');
  } else if (path.startsWith('/voter')) {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_voter_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              sessionStorage.getItem('COMPSSA_voter_tenantId') ||
              localStorage.getItem('COMPSSA_voter_tenantId');
  } else {
    token = sessionStorage.getItem('COMPSSA_tab_token') ||
            sessionStorage.getItem('COMPSSA_admin_token') ||
            sessionStorage.getItem('COMPSSA_superadmin_token') ||
            sessionStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_admin_token') ||
            localStorage.getItem('COMPSSA_superadmin_token') ||
            localStorage.getItem('COMPSSA_voter_token') ||
            localStorage.getItem('COMPSSA_token');
    tenantId = sessionStorage.getItem('COMPSSA_tab_tenantId') ||
              localStorage.getItem('COMPSSA_admin_tenantId') ||
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
    throw new Error(data.message || 'An error occurred while communicating with the server.');
  }

  return data as T;
}

// In-Memory Client Cache for instant menu switching (Stale-While-Revalidate pattern)
const clientCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds fresh TTL

export function clearClientCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (key.startsWith(endpointPrefix)) {
      clientCache.delete(key);
    }
  }
}

export async function apiRequestCached<T>(
  endpoint: string,
  onBackgroundUpdate?: (data: T) => void,
  forceRefresh = false
): Promise<T> {
  const now = Date.now();
  const cached = clientCache.get(endpoint);

  // Return cached data immediately if available
  if (cached && !forceRefresh) {
    if (now - cached.timestamp > CACHE_TTL_MS) {
      // Revalidate in background if stale
      apiRequest<T>(endpoint, 'GET')
        .then(freshData => {
          clientCache.set(endpoint, { data: freshData, timestamp: Date.now() });
          if (onBackgroundUpdate) onBackgroundUpdate(freshData);
        })
        .catch(err => console.warn('[API Cache] Silent revalidation failed:', err));
    }
    return cached.data as T;
  }

  const freshData = await apiRequest<T>(endpoint, 'GET');
  clientCache.set(endpoint, { data: freshData, timestamp: Date.now() });
  return freshData;
}
