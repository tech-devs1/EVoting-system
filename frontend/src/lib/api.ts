import { auth } from './firebase';

// Use Next.js API proxy at /api/[...path]/route.ts which forwards to backend
// On local dev, the proxy forwards to localhost:5000
// On Vercel, BACKEND_URL env var should be set to the deployed backend URL
const API_BASE_URL = '/api';

export async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      console.log('[API] Using Firebase token');
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (e) {
      console.error('Failed to retrieve Firebase ID Token', e);
    }
  }

  // Fallback to local storage mock token if user is signed in but no Firebase auth token exists
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('COMPSSA_token') : null;
  if (localToken) {
    console.log('[API] Using local token:', localToken.substring(0, 30) + '...');
    return {
      'Authorization': localToken.startsWith('Bearer ') ? localToken : `Bearer ${localToken}`,
      'Content-Type': 'application/json',
    };
  }

  console.log('[API] No token found');
  return {
    'Content-Type': 'application/json',
  };
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any
): Promise<T> {
  const headers = await getAuthHeaders();
  
  // Inject default tenant ID for multi-tenant VaaS transition
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('COMPSSA_tenantId') || 'default_tenant' : 'default_tenant';
  (headers as any)['x-tenant-id'] = tenantId;

  const options: RequestInit = {
    method,
    headers,
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
