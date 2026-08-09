import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

async function handleProxy(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

    const headers = new Headers(req.headers);
    // Remove host header to prevent SSL/SNI host mismatch issues
    headers.delete('host');

    const method = req.method;
    let body: any = null;

    if (method !== 'GET' && method !== 'HEAD') {
      body = await req.arrayBuffer();
    }

    const res = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual'
    });

    const responseHeaders = new Headers(res.headers);

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders
    });
  } catch (err: any) {
    console.error('[API Proxy Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Failed to communicate with backend API server.' },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const OPTIONS = handleProxy;
