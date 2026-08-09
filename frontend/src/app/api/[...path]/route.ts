import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

let expressApp: any = null;

function getExpressApp() {
  if (!expressApp) {
    try {
      // Require backend server instance
      expressApp = require('../../../../../backend/server');
    } catch (e) {
      console.error('[Backend Load Error]:', e);
    }
  }
  return expressApp;
}

async function handleProxy(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // 1. If BACKEND_URL is explicitly set in env, proxy to external backend service
    if (BACKEND_URL) {
      const targetUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      const headers = new Headers(req.headers);
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

      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers)
      });
    }

    // 2. Direct serverless execution of Express app in-memory
    const backend = getExpressApp();
    if (backend) {
      return new Promise<NextResponse>((resolve) => {
        const http = require('http');
        const server = http.createServer(backend);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          const port = typeof address === 'object' ? address?.port : 0;
          const targetUrl = `http://127.0.0.1:${port}${url.pathname}${url.search}`;

          const headers = new Headers(req.headers);
          headers.delete('host');

          req.arrayBuffer().then(buffer => {
            const body = (req.method !== 'GET' && req.method !== 'HEAD') ? Buffer.from(buffer) : undefined;
            fetch(targetUrl, {
              method: req.method,
              headers,
              body,
              redirect: 'manual'
            }).then(async res => {
              const resBuffer = await res.arrayBuffer();
              server.close();
              resolve(new NextResponse(resBuffer, {
                status: res.status,
                statusText: res.statusText,
                headers: new Headers(res.headers)
              }));
            }).catch(err => {
              server.close();
              resolve(NextResponse.json({ status: 'error', message: err.message }, { status: 500 }));
            });
          });
        });
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
