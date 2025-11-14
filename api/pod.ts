export const config = { runtime: 'nodejs' };

import { getSql } from 'lib/db';
import { requireSession } from 'lib/auth';

type Photo = { pathname: string; size: number; type: string };

type Row = {
  id: number;
  shipment_id: number;
  signed_at: string | null;
  photos: Array<{ pathname: string; size: number; type: string }>;
};

type SubmitPodBody = {
  token: string;
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
    if (!body || !body.token || !Array.isArray(body.photos) || body.photos.length === 0) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);
    const tokenRow = await sql`select id, shipment_id, expires_at, used_at from delivery_tokens where token = ${body.token}` as { id: number; shipment_id: number; expires_at: string | null; used_at: string | null }[];

    if (tokenRow.length === 0) return Response.json({ error: 'Token tidak ditemukan' }, { status: 404 });
    const t = tokenRow[0];
    if (!t) return Response.json({ error: 'Token tidak ditemukan' }, { status: 404 });
    if (t.used_at) return Response.json({ error: 'Token sudah dipakai' }, { status: 400 });
    if (t.expires_at && new Date(t.expires_at) < new Date()) return Response.json({ error: 'Token kadaluarsa' }, { status: 400 });

    const photos = body.photos.map((p) => ({ pathname: p.pathname, size: p.size, type: p.type }));

    const podInsert = await sql`
      insert into pod (shipment_id, method, signed_at, photos)
      values (${t.shipment_id}, 'photo_only', now(), ${JSON.stringify(photos)}::jsonb)
      returning id;
    ` as { id: number }[];

    const podId = podInsert[0]?.id;
    if (!podId) return Response.json({ error: 'Failed to create POD' }, { status: 500 });

    await sql`update delivery_tokens set used_at = now() where id = ${t.id}`;

    return Response.json({ ok: true, pod_id: podId });
  } else {
    return new Response(null, { status: 404 });
  }
}