export const config = { runtime: 'nodejs20.x' };

import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const type = url.searchParams.get('type') || 'qr';
  
  if (!code) {
    return Response.json({ error: 'Missing code parameter' }, { status: 400 });
  }
  
  try {
    if (type === 'barcode') {
      const png = await bwipjs.toBuffer({
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
    }
    const qrBuffer = await QRCode.toBuffer(code, { width: 300, margin: 2 });
    return new Response(new Uint8Array(qrBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (e) {
    console.error('Barcode generation error:', e);
    return Response.json({ error: 'Failed to generate code' }, { status: 500 });
  }
}
