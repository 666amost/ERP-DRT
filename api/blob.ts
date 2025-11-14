export const config = { runtime: 'nodejs' };

import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import { put } from '@vercel/blob';

function getExtFromName(name: string | null): string {
  if (!name) return 'jpg';
  const parts = name.split('.');
  const last = parts[parts.length - 1] || '';
  if (!last) return 'jpg';
  return last.toLowerCase();
}

export default async function handler(req: any): Promise<Response> {
  // Support both Web Request (headers.get) and Node IncomingMessage (headers object)
  const getHeader = (name: string): string | null => {
    if (typeof req.headers?.get === 'function') return req.headers.get(name);
    if (req.headers && typeof req.headers === 'object') return req.headers[name] || null;
    return null;
  };

  // `req.url` can be a relative path in some server runtimes (e.g. Vercel).
  // Ensure we always create an absolute URL to parse search params.
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    const host = getHeader('host') || process.env.VERCEL_URL || 'localhost';
    const proto = (getHeader('x-forwarded-proto') || 'https').split(',')[0];
    url = new URL(req.url, `${proto}://${host}`);
  }
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'generate' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    const type = url.searchParams.get('type') || 'qr';
    
    if (!code) {
      return Response.json({ error: 'Missing code parameter' }, { status: 400 });
    }
    
    try {
      if (type === 'barcode') {
        try {
          const png = await (bwipjs as any).toBuffer({
            bcid: 'code128',
            text: code,
            scale: 4,
            height: 15,
            includetext: true,
            textxalign: 'center'
          });
          return new Response(new Uint8Array(png), {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
          });
        } catch (be) {
          console.warn('bwip-js PNG generation failed, attempting SVG fallback', be);
          try {
            const svg = await (bwipjs as any).toBuffer({
              bcid: 'code128',
              text: code,
              scale: 3,
              includetext: true,
              textxalign: 'center',
              format: 'svg'
            });
            // `svg` may be a Buffer or string
            const body = typeof svg === 'string' ? new TextEncoder().encode(svg) : new Uint8Array(svg);
            return new Response(body, {
              headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=31536000, immutable'
              }
            });
          } catch (se) {
            console.error('bwip-js SVG fallback also failed:', se);
            throw se;
          }
        }
      }

      // Primary QR path: try binary buffer first, then fallback to DataURL
      try {
        const qrBuffer = await (QRCode as any).toBuffer(code, { width: 300, margin: 2 });
        return new Response(new Uint8Array(qrBuffer), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      } catch (qe) {
        console.warn('QRCode.toBuffer failed, falling back to toDataURL', qe);
        try {
          const dataUrl = await (QRCode as any).toDataURL(code, { width: 300, margin: 2 });
          // data:[<mediatype>][;base64],<data>
          const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
          if (!m) throw new Error('Invalid DataURL from QRCode');
          const b64 = m[2];
          const binary = Buffer.from(b64, 'base64');
          return new Response(new Uint8Array(binary), {
            headers: {
              'Content-Type': m[1] || 'image/png',
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
          });
        } catch (fe) {
          console.error('QR fallback failed:', fe);
          throw fe;
        }
      }
    } catch (e) {
      console.error('Barcode generation error:', e);
      // Provide more details to help debugging on deployed environment.
      const message = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error && e.stack ? e.stack : undefined;
      // Include stack in response to aid diagnosis; remove in production if sensitive.
      return Response.json({ error: 'Failed to generate code', detail: message, stack }, { status: 500 });
    }
  } else if (endpoint === 'upload' && req.method === 'POST') {
    const ext = url.searchParams.get('ext') || getExtFromName(null);
    const contentType = getHeader('content-type') || 'application/octet-stream';

    const allowMime = new Set(['image/jpeg', 'image/png', 'application/pdf']);
    if (!allowMime.has(contentType)) {
      return Response.json({ error: 'Invalid content type' }, { status: 415 });
    }

    // Access control: admin session OR valid delivery token
    let allowed = false;
    try {
      const { requireSession } = await import('../lib/auth');
      await requireSession(req);
      allowed = true;
    } catch {
      const podToken = url.searchParams.get('token');
      if (podToken) {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) return Response.json({ error: 'Missing DATABASE_URL' }, { status: 500 });
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(dbUrl);
        const rows = await sql`select id, expires_at, used_at from delivery_tokens where token = ${podToken} limit 1` as { id: number; expires_at: string | null; used_at: string | null }[];
        const t = rows[0];
        if (t && !t.used_at && (!t.expires_at || new Date(t.expires_at) > new Date())) {
          allowed = true;
        }
      }
    }
    if (!allowed) return new Response(null, { status: 401 });

    const buffer = await req.arrayBuffer();
    const maxBytes = 5 * 1024 * 1024;
    if (buffer.byteLength > maxBytes) {
      return Response.json({ error: 'File too large (max 5MB)' }, { status: 413 });
    }

    const now = new Date();
    const keyDate = now.toISOString().slice(0, 7).replace('-', '/');
    const uuid = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? globalThis.crypto.randomUUID()
      : `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
    const key = `erp/${keyDate}/${uuid}.${ext}`;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });
    }

    // `@vercel/blob` types in this environment restrict `access` to 'public'.
    // We still need to upload as private at runtime. Create an untyped
    // options object so TypeScript won't reject the value while keeping
    // the runtime behavior unchanged.
    const uploadOpts: any = { access: 'private', token, contentType };
    const blob = await put(key, buffer, uploadOpts);

    return Response.json({ url: blob.url, pathname: blob.pathname, size: buffer.byteLength, type: contentType });
  } else if (endpoint === 'proxy' && req.method === 'GET') {
    try {
      const { requireSession } = await import('../lib/auth');
      const { setCookieHeader } = await requireSession(req);
      const pathname = url.searchParams.get('pathname');
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!pathname) return Response.json({ error: 'Missing pathname' }, { status: 400 });
      if (!token) return Response.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });
      const upstream = `https://blob.vercel-storage.com/${pathname.replace(/^\//, '')}`;
      const res = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return new Response(null, { status: res.status });
      const headers = new Headers(res.headers);
      headers.delete('set-cookie');
      if (setCookieHeader) headers.set('set-cookie', setCookieHeader);
      return new Response(res.body, { status: 200, headers });
    } catch (e) {
      if (e instanceof Response) return e;
      return new Response(null, { status: 401 });
    }
  } else {
    return new Response(null, { status: 404 });
  }
}