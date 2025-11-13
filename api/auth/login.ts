export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';
import { serializeCookie } from '../_lib/cookies';
import { findUserByEmail, verifyPassword, createSession } from '../_lib/auth';

type LoginBody = { email: string; password: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const sql = getSql();
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email || '').toLowerCase().trim();
  const password = body.password || '';
  if (!email || !password) return Response.json({ error: 'Missing credentials' }, { status: 400 });

  const user = await findUserByEmail(sql, email);
  if (!user) return new Response(null, { status: 401 });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return new Response(null, { status: 401 });

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const ip = req.headers.get('x-forwarded-for') || null;
  const ua = req.headers.get('user-agent') || null;
  const session = await createSession(sql, user.id, expires, ip, ua);

  const secure = (process.env.NODE_ENV === 'production');
  const setCookie = serializeCookie('sid', session.id, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'Lax' : 'Lax',
    path: '/',
    expires
  });

  return new Response(
    JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }),
    { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': setCookie } }
  );
}
