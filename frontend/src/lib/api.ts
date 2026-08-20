import { auth } from './firebase';

// Use Next.js API proxy at /api/[...path]/route.ts which forwards to backend
// On local dev, the proxy forwards to localhost:5000
// On Vercel, BACKEND_URL env var should be set to the deployed backend URL
const API_BASE_URL = '/api';

export async function getAuthHeaders(): Promise<HeadersInit> {
  // 1. Check local storage token first (holds Admin and Superadmin JWTs)
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('COMPSSA_token') : null;
  const localUserStr = typeof window !== 'undefined' ? localStorage.getItem('COMPSSA_user') : null;

  if (localToken && localUserStr) {
    try {
      const parsedUser = JSON.parse(localUserStr);
      if (parsedUser.role === 'admin' || parsedUser.role === 'superadmin') {
        return {
          'Authorization': localToken.startsWith('Bearer ') ? localToken : `Bearer ${localToken}`,
          'Content-Type': 'application/json',
        };
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // 2. Check Firebase ID Token (for voters)
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (e) {
      console.error('Failed to retrieve Firebase ID Token', e);
    }
  }

  // 3. Fallback to local token
  if (localToken) {
    return {
      'Authorization': localToken.startsWith('Bearer ') ? localToken : `Bearer ${localToken}`,
      'Content-Type': 'application/json',
    };
  }

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
  
  // Inject tenant ID if non-empty
  const storedTenant = typeof window !== 'undefined' ? localStorage.getItem('COMPSSA_tenantId') : null;
  if (storedTenant && storedTenant.trim()) {
    (headers as any)['x-tenant-id'] = storedTenant.trim();
  }

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
