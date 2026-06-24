import { auth } from './firebase';

// Use relative /api path — Next.js rewrites in next.config.ts forward it to the Express backend
// NEXT_PUBLIC_API_URL can override this (e.g. for direct backend access during local dev)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

async function getAuthHeaders(): Promise<HeadersInit> {
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

  // Fallback to local storage mock token if user is signed in but no Firebase auth token exists
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('Votick_token') : null;
  if (localToken) {
    return {
      'Authorization': `Bearer ${localToken}`,
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
  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}
