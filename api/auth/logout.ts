export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';
import { parseCookies, serializeCookie } from '../_lib/cookies';
import { revokeSession } from '../_lib/auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const cookies = parseCookies(req.headers.get('cookie'));
  const sid = cookies['sid'];
  const sql = getSql();
  if (sid) {
    await revokeSession(sql, sid);
  }
  const expired = serializeCookie('sid', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0)
  });
  return new Response(null, { status: 204, headers: { 'set-cookie': expired } });
}
