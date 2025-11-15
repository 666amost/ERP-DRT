export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { requireSession } from './_lib/auth.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = safeUrl(req);
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'list' && req.method === 'GET') {
    try {
      const sql = getSql();
      const { setCookieHeader } = await requireSession(req);
      const rows = await sql`select id, shipment_id, signed_at, photos from pod order by id desc limit 50` as Row[];
      if (setCookieHeader) res.setHeader('set-cookie', setCookieHeader);
      writeJson(res, { items: rows });
      return;
    } catch (e) {
      console.error('list endpoint error:', e);
      writeJson(res, { error: 'Unauthorized' }, 401);
      return;
    }
  } else if (endpoint === 'submit' && req.method === 'POST') {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) { writeJson(res, { error: 'Missing DATABASE_URL' }, 500); return; }

    // Wrap submit handling so any unexpected error returns a safe JSON response
    try {
        const body = await readJsonNode(req) as SubmitPodBody | null;
      // Safe debug log: number of photos and flow (token/public_code) - do not log token values
      try { console.debug('submitPOD: photos', Array.isArray(body?.photos) ? (body?.photos as any[]).length : 0, 'hasToken', !!body?.token, 'hasPublicCode', !!body?.public_code); } catch {}
      if (!body || !Array.isArray(body.photos) || body.photos.length === 0) {
        writeJson(res, { error: 'Invalid payload' }, 400);
        return;
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
      if (!t) { writeJson(res, { error: 'Token tidak ditemukan' }, 404); return; }
      if (t.used_at) { writeJson(res, { error: 'Token sudah dipakai' }, 400); return; }
      if (t.expires_at && new Date(t.expires_at) < new Date()) { writeJson(res, { error: 'Token kadaluarsa' }, 400); return; }
      shipmentId = t.shipment_id;
      tokenId = t.id;
    }

    // If public_code provided (manual flow), find shipment by public_code
    if (body.public_code && !shipmentId) {
      const code = body.public_code;
      const row = await sql`select id from shipments where public_code = ${code} limit 1` as { id: number }[];
      const r0 = row[0];
      if (!r0) { writeJson(res, { error: 'Resi tidak ditemukan' }, 404); return; }
      shipmentId = r0.id;
    }

    if (!shipmentId) { writeJson(res, { error: 'Missing token or public_code' }, 400); return; }

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
        if (!m) { writeJson(res, { error: 'Invalid dataUrl' }, 400); return; }
        const contentType = m[1];
        const b64 = m[2];
        if (typeof contentType !== 'string' || typeof b64 !== 'string') { writeJson(res, { error: 'Invalid dataUrl' }, 400); return; }

        // Convert base64 to bytes. On Node, atob may not exist so prefer Buffer if available.
        let bytes: Uint8Array;
        try {
          if (typeof atob === 'function') {
            const binaryString = atob(b64);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
          } else if (typeof Buffer !== 'undefined') {
            const buf = Buffer.from(b64, 'base64');
            bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          } else {
            writeJson(res, { error: 'Base64 decode not supported in this runtime' }, 500);
            return;
          }
        } catch (err) {
          writeJson(res, { error: 'Invalid base64 data' }, 400);
          return;
        }

        if (!blobToken) {
          const MAX_INLINE_BYTES = 2 * 1024 * 1024;
          if (bytes.length > MAX_INLINE_BYTES) { writeJson(res, { error: 'File too large to store inline; BLOB_READ_WRITE_TOKEN required' }, 400); return; }
          normalizedPhotos.push({ url: p.dataUrl, size: bytes.length, type: contentType });
          continue;
        }

        const now = new Date();
        const keyDate = now.toISOString().slice(0, 7).replace('-', '/');
        const uuid = `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
        const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'bin';
        const key = `erp/${keyDate}/${uuid}.${ext}`;
        let blob;
        try {
          const { put } = await import('@vercel/blob');
          const file = new Blob([bytes.buffer as ArrayBuffer], { type: contentType });
          blob = await put(key, file, { access: 'public', token: blobToken });
        } catch (err) {
          console.error('submitPOD: blob upload failed', String(err));
          writeJson(res, { error: 'Blob upload failed' }, 502);
          return;
        }
        normalizedPhotos.push({ pathname: blob.pathname, url: blob.url, size: bytes.length, type: contentType });
        continue;
      }
      writeJson(res, { error: 'Invalid photo payload' }, 400);
      return;
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
      writeJson(res, { error: 'Failed to create POD', detail: String(err) }, 500);
      return;
    }

    const podId = podInsert[0]?.id;
    if (!podId) { writeJson(res, { error: 'Failed to create POD' }, 500); return; }

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
    writeJson(res, { ok: true, pod_id: podId });
    return;
    } catch (err) {
      // Top level catch for unexpected errors — log minimal detail but don't leak secrets
      console.error('submitPOD unexpected error', String(err));
      writeJson(res, { error: 'A server error has occurred' }, 500);
      return;
    }
  } else {
    // Try sync endpoint (admin-only)
    if (endpoint === 'sync-urls' && req.method === 'POST') {
      await syncPhotoUrls(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
    return;
  }
}

// Admin-only: synchronize photo `url` fields for legacy POD entries that only stored pathname
// POST /api/pod?endpoint=sync-urls
export async function syncPhotoUrls(req: any, res?: ServerResponse): Promise<Response | void> {
  const url = safeUrl(req);
  const endpoint = url.searchParams.get('endpoint');
  if (endpoint !== 'sync-urls' || req.method !== 'POST') { if (res) { res.writeHead(404); res.end(); return; } return new Response(null, { status: 404 }); }
  try {
    await requireSession(req);
  } catch (e) {
    if (res) { writeJson(res, { error: 'Unauthorized' }, 401); return; }
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { if (res) { writeJson(res, { error: 'Missing DATABASE_URL' }, 500); return; } return Response.json({ error: 'Missing DATABASE_URL' }, { status: 500 }); }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(dbUrl);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) { if (res) { writeJson(res, { error: 'Missing BLOB_READ_WRITE_TOKEN' }, 500); return; } return Response.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 }); }
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
    if (res) { writeJson(res, { ok: true, updated, processed: rows.length }); return; }
    return Response.json({ ok: true, updated, processed: rows.length });
  } catch (err) {
    console.error('syncPhotoUrls error', err);
    if (res) { writeJson(res, { error: 'Sync failed', detail: String(err) }, 500); return; }
    return Response.json({ error: 'Sync failed', detail: String(err) }, { status: 500 });
  }
}

// edge helper removed; use readJsonNode from _lib/http