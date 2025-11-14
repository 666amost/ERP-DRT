export const config = { runtime: 'nodejs' };

import { neon } from '@neondatabase/serverless';

type Photo = { url?: string; pathname: string; size: number; type: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return Response.json({ error: 'Missing DATABASE_URL' }, { status: 500 });

  const body = await req.json().catch(() => null) as { token?: string; photos?: Photo[] } | null;
  if (!body || !body.token || !Array.isArray(body.photos) || body.photos.length === 0) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

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
}
