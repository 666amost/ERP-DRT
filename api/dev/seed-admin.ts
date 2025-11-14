export const config = { runtime: 'nodejs' };

import { getSql } from '../../lib/db';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (process.env.ALLOW_MIGRATE !== 'true') return new Response(null, { status: 403 });
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || !password) return Response.json({ error: 'Missing ADMIN_EMAIL/ADMIN_PASSWORD' }, { status: 400 });
  const sql = getSql();
  // Insert plain password; DB trigger will auto-hash it
  const rows = await sql`
    insert into users (email, password_hash, name, role)
    values (${email}, ${password}, ${name}, 'admin')
    on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name
    returning id
  ` as { id: number }[];
  return Response.json({ id: (rows[0] as { id: number }).id, email });
}
