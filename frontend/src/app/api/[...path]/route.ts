import { NextRequest, NextResponse } from 'next/server';

// The Express backend URL — defaults to localhost:5000 in development
// On Vercel, this should be set to the deployed backend URL
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathString = path.join('/');
  const targetUrl = `${BACKEND_URL}/api/${pathString}${req.nextUrl.search}`;

  console.log(`[API Proxy] Forwarding ${req.method} request to: ${targetUrl}`);
  console.log(`[API Proxy] Authorization header:`, req.headers.get('authorization'));

  // Forward all headers from the incoming request
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // Skip headers that should not be forwarded
    if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers[key] = value;
      console.log(`[API Proxy] Forwarding header ${key}:`, key === 'authorization' ? '[REDACTED]' : value);
    }
  });

  try {
    const backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    });

    const data = await backendResponse.text();

    if (!backendResponse.ok) {
      console.error(`[API Proxy] Backend returned error: ${backendResponse.status} ${backendResponse.statusText}`);
    }

    return new NextResponse(data, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error(`[API Proxy] Failed to reach backend at ${targetUrl}:`, error);
    return NextResponse.json(
      { status: 'error', message: `Backend service is unavailable. Target: ${targetUrl}` },
      { status: 503 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
