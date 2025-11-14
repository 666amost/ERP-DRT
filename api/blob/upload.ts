export const config = { runtime: 'nodejs' };

import { put } from '@vercel/blob';

function getExtFromName(name: string | null): string {
  if (!name) return 'jpg';
  const parts = name.split('.');
  const last = parts[parts.length - 1] || '';
  if (!last) return 'jpg';
  return last.toLowerCase();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const url = new URL(req.url);
  const ext = url.searchParams.get('ext') || getExtFromName(null);
  const contentType = req.headers.get('content-type') || 'application/octet-stream';

  const buffer = await req.arrayBuffer();

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

  const blob = await put(key, buffer, {
    access: 'public',
    token,
    contentType
  });

  return Response.json({ url: blob.url, pathname: blob.pathname, size: buffer.byteLength });
}
