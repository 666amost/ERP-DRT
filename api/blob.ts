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
            includetext: true,
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
              includetext: true,
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
  } else if (endpoint === 'upload' && req.method === 'POST') {
    // Upload endpoint disabled for now - needs full rewrite for Node API
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upload endpoint temporarily unavailable' }));
    return;
  } else if (endpoint === 'proxy' && req.method === 'GET') {
    // Proxy endpoint disabled for now - needs full rewrite for Node API
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy endpoint temporarily unavailable' }));
    return;
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
}