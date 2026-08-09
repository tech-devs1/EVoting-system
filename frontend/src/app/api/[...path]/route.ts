import { NextRequest, NextResponse } from 'next/server';

// Direct import so Vercel bundler statically includes backend/server.js in the serverless function
// @ts-ignore
import expressApp from '../../../../../backend/server';

let cachedPort: number | null = null;
let serverPromise: Promise<number> | null = null;

function ensureBackendListening(): Promise<number> {
  if (cachedPort) return Promise.resolve(cachedPort);
  if (serverPromise) return serverPromise;

  serverPromise = new Promise((resolve, reject) => {
    try {
      const http = require('http');
      const server = http.createServer(expressApp);
      server.listen(0, '127.0.0.1', () => {
        const port = typeof address === 'object' && address ? address.port : 5000;
        cachedPort = port;
        console.log(`[API Proxy] Singleton Express backend listening on port ${port}`);
        resolve(port);
      });
      server.on('error', (err: any) => {
        console.error('[API Proxy] Server error:', err);
        serverPromise = null;
        reject(err);
      });
    } catch (err) {
      serverPromise = null;
      reject(err);
    }
  });

  return serverPromise;
}

async function handleProxy(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    if (BACKEND_URL) {
      const targetUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      const headers = new Headers(req.headers);
      headers.delete('host');

      const method = req.method;
      let body: any = undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        body = await req.arrayBuffer();
      }

      const res = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: 'manual'
      });

      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers)
      });
    }

    if (expressApp) {
      const port = await ensureBackendListening();
      const targetUrl = `http://127.0.0.1:${port}${url.pathname}${url.search}`;

      const headers = new Headers(req.headers);
      headers.delete('host');

      const method = req.method;
      let body: any = undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        const buffer = await req.arrayBuffer();
        body = Buffer.from(buffer);
      }

      const res = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: 'manual'
      });

      const resBuffer = await res.arrayBuffer();
      return new NextResponse(resBuffer, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers)
      });
    }

    return NextResponse.json({ status: 'error', message: 'Backend service unavailable.' }, { status: 503 });
  } catch (err: any) {
    console.error('[API Proxy Error]:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to communicate with backend API server.' },
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
