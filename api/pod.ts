export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { requireSession } from './_lib/auth.js';
import { put } from '@vercel/blob';

type Photo = { pathname?: string; url?: string; size: number; type: string };

type Row = {
  id: number;
  shipment_id: number;
  signed_at: string | null;
  photos: Array<{ pathname?: string; url?: string; size: number; type: string }>;
};

type SubmitPodBody = {
  token?: string;
  public_code?: string;
  scanned_at?: string;
  note?: string;
  photos: Photo[];
};

function safeUrl(req: any): URL {
  try {
    return new URL(req.url);
  } catch {
    // Support both Fetch `Request` (headers.get) and Node-style `IncomingMessage` (headers object)
    const headers = req.headers || {};
    const getHeader = typeof headers.get === 'function'
      ? (k: string) => headers.get(k)
      : (k: string) => headers[k.toLowerCase()] || headers[k];
    const host = getHeader('host') || 'localhost';
    const proto = getHeader('x-forwarded-proto') || getHeader('x-forwarded-protocol') || 'http';
    const path = typeof req.url === 'string' ? req.url : '/';
    return new URL(`${proto}://${host}${path}`);
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = safeUrl(req);
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'list' && req.method === 'GET') {
    const sql = getSql();
    try {
      const { setCookieHeader } = await requireSession(req);
      const rows = await sql`select id, shipment_id, signed_at, photos from pod order by id desc limit 50` as Row[];
      const res = Response.json({ items: rows });
      if (setCookieHeader) {
        res.headers.set('set-cookie', setCookieHeader);
      }
      return res;
    } catch (e) {
      if (e instanceof Response) return e;
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (endpoint === 'submit' && req.method === 'POST') {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return Response.json({ error: 'Missing DATABASE_URL' }, { status: 500 });

    // Wrap submit handling so any unexpected error returns a safe JSON response
    try {
        const body = await readJson(req) as SubmitPodBody | null;
      // Safe debug log: number of photos and flow (token/public_code) - do not log token values
      try { console.debug('submitPOD: photos', Array.isArray(body?.photos) ? (body?.photos as any[]).length : 0, 'hasToken', !!body?.token, 'hasPublicCode', !!body?.public_code); } catch {}
      if (!body || !Array.isArray(body.photos) || body.photos.length === 0) {
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);

      let shipmentId: number | null = null;
      let tokenId: number | null = null;

    // If token provided, validate token and obtain shipment
    if (body.token) {
      const token = body.token;
      const tokenRow = await sql`select id, shipment_id, expires_at, used_at from delivery_tokens where token = ${token}` as { id: number; shipment_id: number; expires_at: string | null; used_at: string | null }[];
      const t = tokenRow[0];
      if (!t) return Response.json({ error: 'Token tidak ditemukan' }, { status: 404 });
      if (t.used_at) return Response.json({ error: 'Token sudah dipakai' }, { status: 400 });
      if (t.expires_at && new Date(t.expires_at) < new Date()) return Response.json({ error: 'Token kadaluarsa' }, { status: 400 });
      shipmentId = t.shipment_id;
      tokenId = t.id;
    }

    // If public_code provided (manual flow), find shipment by public_code
    if (body.public_code && !shipmentId) {
      const code = body.public_code;
      const row = await sql`select id from shipments where public_code = ${code} limit 1` as { id: number }[];
      const r0 = row[0];
      if (!r0) return Response.json({ error: 'Resi tidak ditemukan' }, { status: 404 });
      shipmentId = r0.id;
    }

    if (!shipmentId) return Response.json({ error: 'Missing token or public_code' }, { status: 400 });

    // Normalize photos: accept either { pathname, size, type } or { dataUrl, size, type }
    const photosInput = body.photos as any[];
    const normalizedPhotos: { pathname?: string; url?: string; size: number; type: string }[] = [];
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    for (const p of photosInput) {
      if (p.pathname) {
        normalizedPhotos.push({ pathname: p.pathname, url: p.url, size: p.size, type: p.type });
        continue;
      }
      if (p.dataUrl) {
        const m = String(p.dataUrl).match(/^data:(.+);base64,(.+)$/);
        if (!m) return Response.json({ error: 'Invalid dataUrl' }, { status: 400 });
        const contentType = m[1];
        const b64 = m[2];
        if (typeof contentType !== 'string' || typeof b64 !== 'string') {
          return Response.json({ error: 'Invalid dataUrl' }, { status: 400 });
        }
        const buffer = Buffer.from(b64, 'base64');
        // If we don't have a blob token, fallback to storing the dataUrl inline (but don't allow huge files)
        if (!blobToken) {
          const MAX_INLINE_BYTES = 2 * 1024 * 1024; // 2MB limit for inline storage
          if (buffer.length > MAX_INLINE_BYTES) {
            return Response.json({ error: 'File too large to store inline; BLOB_READ_WRITE_TOKEN required' }, { status: 400 });
          }
          // Save the original dataUrl as photo url; DB will contain the base64 URL in photos
          normalizedPhotos.push({ url: p.dataUrl, size: buffer.length, type: contentType });
          continue;
        }
        const now = new Date();
        const keyDate = now.toISOString().slice(0, 7).replace('-', '/');
        const uuid = `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
        const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'bin';
        const key = `erp/${keyDate}/${uuid}.${ext}`;
        let blob;
        try {
          blob = await put(key, buffer, { access: 'public', token: blobToken, contentType });
        } catch (err) {
          console.error('submitPOD: blob upload failed', String(err));
          return Response.json({ error: 'Blob upload failed' }, { status: 502 });
        }
        normalizedPhotos.push({ pathname: blob.pathname, url: blob.url, size: buffer.length, type: contentType });
        continue;
      }
      return Response.json({ error: 'Invalid photo payload' }, { status: 400 });
    }

    const photos = normalizedPhotos;

    const signedAtValue = body.scanned_at || new Date().toISOString();
    const noteValue = (body as any).note || null;

    let podInsert;
    try {
      podInsert = await sql`
        insert into pod (shipment_id, method, signed_at, photos, note)
        values (${shipmentId}, 'photo_only', ${signedAtValue}, ${JSON.stringify(photos)}::jsonb, ${noteValue})
        returning id;
      ` as { id: number }[];
    } catch (err) {
      console.error('submitPOD: db insert failed', String(err));
      return Response.json({ error: 'Failed to create POD', detail: String(err) }, { status: 500 });
    }

    const podId = podInsert[0]?.id;
    if (!podId) return Response.json({ error: 'Failed to create POD' }, { status: 500 });

    // mark token used if applicable
    if (tokenId) {
      try {
        await sql`update delivery_tokens set used_at = now() where id = ${tokenId}`;
      } catch (err) {
        console.warn('submitPOD: warning: failed to mark token used', String(err));
      }
    }

    // Mark shipment as DELIVERED on POD submission (manual delivery confirmation)
    try {
      await sql`update shipments set status = 'DELIVERED' where id = ${shipmentId}`;
    } catch (err) {
      console.warn('submitPOD: warning: failed to update shipment status', String(err));
    }
    return Response.json({ ok: true, pod_id: podId });
    } catch (err) {
      // Top level catch for unexpected errors — log minimal detail but don't leak secrets
      console.error('submitPOD unexpected error', String(err));
      return Response.json({ error: 'A server error has occurred' }, { status: 500 });
    }
  } else {
    // Try sync endpoint (admin-only)
    if (endpoint === 'sync-urls' && req.method === 'POST') {
      return await syncPhotoUrls(req);
    }
    return new Response(null, { status: 404 });
  }
}

// Admin-only: synchronize photo `url` fields for legacy POD entries that only stored pathname
// POST /api/pod?endpoint=sync-urls
export async function syncPhotoUrls(req: any): Promise<Response> {
  const url = safeUrl(req);
  const endpoint = url.searchParams.get('endpoint');
  if (endpoint !== 'sync-urls' || req.method !== 'POST') return new Response(null, { status: 404 });
  try {
    await requireSession(req);
  } catch (e) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return Response.json({ error: 'Missing DATABASE_URL' }, { status: 500 });
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(dbUrl);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return Response.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });
  const { head } = await import('@vercel/blob');
  try {
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const rows = await sql`select id, photos from pod where exists (select 1 from jsonb_array_elements(photos) as p where (p->>'url') is null) order by id desc limit ${limit}` as { id: number; photos: any[] }[];
    const updated: { id: number; updatedCount: number }[] = [];
    for (const r of rows) {
      const photos = r.photos as any[];
      let changed = false;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (p && !p.url && p.pathname) {
          try {
            const meta = await head(p.pathname, { token });
            if (meta?.url) {
              photos[i] = { pathname: p.pathname, url: meta.url, size: p.size, type: p.type };
              changed = true;
            }
          } catch (err) {
            console.warn('syncPhotoUrls head failed for', p.pathname, err);
          }
        }
      }
      if (changed) {
        await sql`update pod set photos = ${JSON.stringify(photos)}::jsonb where id = ${r.id}`;
        updated.push({ id: r.id, updatedCount: photos.filter(p => p?.url).length });
      }
    }
    return Response.json({ ok: true, updated, processed: rows.length });
  } catch (err) {
    console.error('syncPhotoUrls error', err);
    return Response.json({ error: 'Sync failed', detail: String(err) }, { status: 500 });
  }
}

async function readJson(req: any): Promise<any> {
  // If runtime provides Fetch Request with json(), use it
  if (req && typeof req.json === 'function') {
    try {
      return await req.json();
    } catch {
      return null;
    }
  }
  // Otherwise assume Node IncomingMessage and read the raw body
  if (req && typeof req.on === 'function') {
    return await new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      req.on('end', () => {
        try {
          const s = Buffer.concat(chunks).toString('utf8');
          if (!s) return resolve(null);
          resolve(JSON.parse(s));
        } catch {
          resolve(null);
        }
      });
      req.on('error', () => resolve(null));
    });
  }
  return null;
}