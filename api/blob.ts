export const config = { runtime: 'nodejs' };

import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import { put } from '@vercel/blob';
import type { IncomingMessage, ServerResponse } from 'http';

function getExtFromName(name: string | null): string {
  if (!name) return 'jpg';
  const parts = name.split('.');
  const last = parts[parts.length - 1] || '';
  if (!last) return 'jpg';
  return last.toLowerCase();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const getHeader = (name: string): string | null => req.headers[name] as string || null;

  // Parse URL
  const host = getHeader('host') || process.env.VERCEL_URL || 'localhost';
  const proto = (getHeader('x-forwarded-proto') || 'https').split(',')[0];
  const url = new URL(req.url || '/', `${proto}://${host}`);
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'generate' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    const type = url.searchParams.get('type') || 'qr';
    const hideText = url.searchParams.get('hideText') === '1';
    
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing code parameter' }));
      return;
    }
    
    try {
      if (type === 'barcode') {
        try {
          const png = await (bwipjs as any).toBuffer({
            bcid: 'code128',
            text: code,
            scale: 4,
            height: 15,
            includetext: !hideText,
            textxalign: 'center'
          });
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' });
          res.end(Buffer.from(png));
          return;
        } catch (be) {
          console.warn('bwip-js PNG generation failed, attempting SVG fallback', be);
          try {
            const svg = await (bwipjs as any).toBuffer({
              bcid: 'code128',
              text: code,
              scale: 3,
              includetext: !hideText,
              textxalign: 'center',
              format: 'svg'
            });
            const body = typeof svg === 'string' ? Buffer.from(svg) : Buffer.from(svg);
            res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' });
            res.end(body);
            return;
          } catch (se) {
            console.error('bwip-js SVG fallback also failed:', se);
            throw se;
          }
        }
      }

      // Primary QR path: try binary buffer first, then fallback to DataURL
      try {
        const qrBuffer = await (QRCode as any).toBuffer(code, { width: 300, margin: 2 });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' });
        res.end(Buffer.from(qrBuffer));
        return;
      } catch (qe) {
        console.warn('QRCode.toBuffer failed, falling back to toDataURL', qe);
        try {
          const dataUrl = await (QRCode as any).toDataURL(code, { width: 300, margin: 2 });
          const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
          if (!m) throw new Error('Invalid DataURL from QRCode');
          const b64 = m[2];
          const binary = Buffer.from(b64, 'base64');
          res.writeHead(200, { 'Content-Type': m[1] || 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' });
          res.end(binary);
          return;
        } catch (fe) {
          console.error('QR fallback failed:', fe);
          throw fe;
        }
      }
    } catch (e) {
      console.error('Barcode generation error:', e);
      const message = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error && e.stack ? e.stack : undefined;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate code', detail: message, stack }));
      return;
    }
  } else if (endpoint === 'upload') {
    // Support OPTIONS preflight for browser-based uploads
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const contentType = getHeader('content-type') || 'application/octet-stream';
    const allowMime = new Set(['image/jpeg', 'image/png', 'application/pdf']);
    const corsBase = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    } as Record<string, string>;

    if (!allowMime.has(contentType)) {
      res.writeHead(415, corsBase);
      res.end(JSON.stringify({ error: 'Invalid content type' }));
      return;
    }

    // Require a delivery token for public uploads (third-party uploads)
    const podToken = url.searchParams.get('token');
    if (!podToken) {
      res.writeHead(401, corsBase);
      res.end(JSON.stringify({ error: 'Missing token' }));
      return;
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      res.writeHead(500, corsBase);
      res.end(JSON.stringify({ error: 'Missing DATABASE_URL' }));
      return;
    }

    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      const rows = (await sql`select id, expires_at, used_at from delivery_tokens where token = ${podToken} limit 1`) as { id: number; expires_at: string | null; used_at: string | null }[];
      const t = rows[0];
      if (!t) {
        res.writeHead(401, corsBase);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }
      if (t.used_at) {
        res.writeHead(401, corsBase);
        res.end(JSON.stringify({ error: 'Token already used' }));
        return;
      }
      if (t.expires_at && new Date(t.expires_at) <= new Date()) {
        res.writeHead(401, corsBase);
        res.end(JSON.stringify({ error: 'Token expired' }));
        return;
      }

      // Read raw body from IncomingMessage
      const readBody = (r: IncomingMessage): Promise<Buffer> => new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        r.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        r.on('end', () => resolve(Buffer.concat(chunks)));
        r.on('error', (err) => reject(err));
      });

      const buffer = await readBody(req);
      console.debug('blob upload: podToken=', !!podToken, 'bufferSizeBytes=', buffer.byteLength, 'contentType=', contentType);
      const maxBytes = 5 * 1024 * 1024;
      if (buffer.byteLength > maxBytes) {
        res.writeHead(413, corsBase);
        res.end(JSON.stringify({ error: 'File too large (max 5MB)' }));
        return;
      }

      const now = new Date();
      const keyDate = now.toISOString().slice(0, 7).replace('-', '/');
      const uuid = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
        ? (globalThis.crypto as any).randomUUID()
        : `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
      const ext = getExtFromName(null);
      const key = `erp/${keyDate}/${uuid}.${ext}`;

      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        res.writeHead(500, corsBase);
        res.end(JSON.stringify({ error: 'Missing BLOB_READ_WRITE_TOKEN' }));
        return;
      }

      const uploadOpts: any = { access: 'public', token, contentType };
      let blob;
      try {
        blob = await put(key, buffer, uploadOpts);
      } catch (err) {
        console.error('put() failed:', String(err), { key, size: buffer.byteLength, contentType });
        throw err;
      }

      // Mark token as used (best effort)
      await sql`update delivery_tokens set used_at = now() where id = ${t.id}`;
      console.debug('blob upload: success', { podTokenId: t.id, pathname: blob.pathname, size: buffer.byteLength });

      res.writeHead(200, corsBase);
      res.end(JSON.stringify({ url: blob.url, pathname: blob.pathname, size: buffer.byteLength, type: contentType }));
      return;
    } catch (err) {
      console.error('Upload error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload failed', detail: String(err) }));
      return;
    }
  } else if (endpoint === 'proxy' && req.method === 'GET') {
    // Attempt to resolve pathname to stored public URL via DB (if photos stored url); otherwise fail gracefully
    const pathname = url.searchParams.get('pathname');
    if (!pathname) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing pathname' }));
      return;
    }
    try {
      const dbUrl = process.env.DATABASE_URL;
      // 1) Try to find url in DB
      if (dbUrl) {
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(dbUrl);
        const rows = await sql`
          select (p->>'url') as url
          from pod, jsonb_array_elements(photos) as p
          where p->>'pathname' = ${pathname}
          limit 1
        ` as { url: string | null }[];
        const urlRow = rows[0];
        if (urlRow && urlRow.url) {
          // redirect to the public URL if found
          res.writeHead(302, { Location: urlRow.url });
          res.end();
          return;
        }
      }

      // 2) Try to fetch from Vercel Blob using SDK (get) to find a public URL or stream
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy unavailable', detail: 'No public URL found and BLOB_READ_WRITE_TOKEN not set' }));
        return;
      }
      const { head } = await import('@vercel/blob');
      try {
        const meta = await head(pathname, { token });
        // If head returns downloadUrl, redirect to it
        if (meta && meta.downloadUrl) {
          res.writeHead(302, { Location: meta.downloadUrl });
          res.end();
          return;
        }
        // If head returns url and it's public, redirect
        if (meta && meta.url) {
          res.writeHead(302, { Location: meta.url });
          res.end();
          return;
        }
        // If we reached here, head didn't provide url/downloadUrl; no further action
      } catch (err) {
        console.error('Blob SDK get failed for pathname=', pathname, err);
        // if SDK get fails, still reply not found below
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy unavailable', detail: 'No public URL found for pathname' }));
      return;
    } catch (err) {
      console.error('Proxy get error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy unavailable', detail: String(err) }));
      return;
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
}