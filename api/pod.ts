export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { requireSession } from './_lib/auth.js';
import { put } from '@vercel/blob';

type Photo = { pathname: string; size: number; type: string };

type Row = {
  id: number;
  shipment_id: number;
  signed_at: string | null;
  photos: Array<{ pathname: string; size: number; type: string }>;
};

type SubmitPodBody = {
  token?: string;
  public_code?: string;
  scanned_at?: string;
  note?: string;
  photos: Photo[];
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
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

    const body = await req.json().catch(() => null) as SubmitPodBody | null;
    if (!body || !Array.isArray(body.photos) || body.photos.length === 0) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    let shipmentId: number | null = null;
    let tokenId: number | null = null;

    // If token provided, validate token and obtain shipment
    if (body.token) {
      const token = body.token as string;
      const tokenRow = await sql`select id, shipment_id, expires_at, used_at from delivery_tokens where token = ${token}` as { id: number; shipment_id: number; expires_at: string | null; used_at: string | null }[];
      if (tokenRow.length === 0) return Response.json({ error: 'Token tidak ditemukan' }, { status: 404 });
      const t = tokenRow[0];
      if (t.used_at) return Response.json({ error: 'Token sudah dipakai' }, { status: 400 });
      if (t.expires_at && new Date(t.expires_at) < new Date()) return Response.json({ error: 'Token kadaluarsa' }, { status: 400 });
      shipmentId = t.shipment_id;
      tokenId = t.id;
    }

    // If public_code provided (manual flow), find shipment by public_code
    if (body.public_code && !shipmentId) {
      const code = body.public_code as string;
      const row = await sql`select id from shipments where public_code = ${code} limit 1` as [{ id: number }][];
      if (!row || row.length === 0) return Response.json({ error: 'Resi tidak ditemukan' }, { status: 404 });
      shipmentId = row[0].id;
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
        if (!blobToken) return Response.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });
        const m = String(p.dataUrl).match(/^data:(.+);base64,(.+)$/);
        if (!m) return Response.json({ error: 'Invalid dataUrl' }, { status: 400 });
        const contentType = m[1];
        const b64 = m[2];
        const buffer = Buffer.from(b64, 'base64');
        const now = new Date();
        const keyDate = now.toISOString().slice(0, 7).replace('-', '/');
        const uuid = `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
        const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'bin';
        const key = `erp/${keyDate}/${uuid}.${ext}`;
        const uploadOpts: any = { access: 'public', token: blobToken, contentType };
        const blob = await put(key, buffer, uploadOpts);
        normalizedPhotos.push({ pathname: blob.pathname, url: blob.url, size: buffer.length, type: contentType });
        continue;
      }
      return Response.json({ error: 'Invalid photo payload' }, { status: 400 });
    }

    const photos = normalizedPhotos;

    const signedAtValue = body.scanned_at || new Date().toISOString();
    const noteValue = (body as any).note || null;

    const podInsert = await sql`
      insert into pod (shipment_id, method, signed_at, photos, note)
      values (${shipmentId}, 'photo_only', ${signedAtValue}, ${JSON.stringify(photos)}::jsonb, ${noteValue})
      returning id;
    ` as { id: number }[];

    const podId = podInsert[0]?.id;
    if (!podId) return Response.json({ error: 'Failed to create POD' }, { status: 500 });

    // mark token used if applicable
    if (tokenId) {
      await sql`update delivery_tokens set used_at = now() where id = ${tokenId}`;
    }

    // Mark shipment as DELIVERED on POD submission (manual delivery confirmation)
    await sql`update shipments set status = 'DELIVERED' where id = ${shipmentId}`;

    return Response.json({ ok: true, pod_id: podId });
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
export async function syncPhotoUrls(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  if (endpoint !== 'sync-urls' || req.method !== 'POST') return new Response(null, { status: 404 });
  try {
    // Require session (admin), reuse existing requireSession helper
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
    // Fetch pods with photos that have missing url
    const rows = await sql`select id, photos from pod where exists (select 1 from jsonb_array_elements(photos) as p where (p->>'url') is null)` as { id: number; photos: any[] }[];
    const updated: { id: number; updatedCount: number }[] = [];
    for (const r of rows) {
      const photos = r.photos as any[];
      let changed = false;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!p.url && p.pathname) {
          try {
            const meta = await head(p.pathname, { token });
            if (meta && meta.url) {
              photos[i] = { ...p, url: meta.url };
              changed = true;
            }
          } catch (err) {
            console.warn('syncPhotoUrls head failed for', p.pathname, err);
          }
        }
      }
      if (changed) {
        await sql`update pod set photos = ${JSON.stringify(photos)}::jsonb where id = ${r.id}`;
        updated.push({ id: r.id, updatedCount: photos.filter(p => p.url).length });
      }
    }
    return Response.json({ ok: true, updated });
  } catch (err) {
    console.error('syncPhotoUrls error', err);
    return Response.json({ error: 'Sync failed', detail: String(err) }, { status: 500 });
  }
}