export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { serializeCookie, parseCookies } from './_lib/cookies.js';
import { findUserByEmail, verifyPassword, createSession, revokeSession, requireSession } from './_lib/auth.js';

type LoginBody = { email: string; password: string };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url, `https://${req.headers.get('host') || 'localhost'}`);
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'login' && req.method === 'POST') {
    try {
      const sql = getSql();
      let body: LoginBody;
      try {
        body = (await req.json()) as LoginBody;
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const email = (body.email || '').toLowerCase().trim();
      const password = body.password || '';
      console.log('Login attempt for:', email);
      
      if (!email || !password) {
        console.error('Missing credentials');
        return Response.json({ error: 'Missing credentials' }, { status: 400 });
      }

      const user = await findUserByEmail(sql, email);
      console.log('User found:', user ? 'yes' : 'no');
      
      if (!user) {
        console.error('User not found:', email);
        return new Response(null, { status: 401 });
      }
      
      const ok = await verifyPassword(password, user.password_hash);
      console.log('Password verified:', ok);
      
      if (!ok) {
        console.error('Invalid password for:', email);
        return new Response(null, { status: 401 });
      }

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
    } catch (e: unknown) {
      console.error('Login error details:', e);
      console.error('Error stack:', e instanceof Error ? e.stack : 'No stack trace');
      console.error('Error message:', e instanceof Error ? e.message : String(e));
      return Response.json({ 
        error: 'Server error',
        details: process.env.NODE_ENV === 'development' ? String(e) : undefined 
      }, { status: 500 });
    }
  } else if (endpoint === 'logout' && req.method === 'POST') {
    try {
      const cookies = parseCookies(req.headers.get('cookie'));
      const sid = cookies['sid'];
      const sql = getSql();
      if (sid) {
        await revokeSession(sql, sid as string);
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
    } catch (e: unknown) {
      console.error('Logout error:', e);
      return Response.json({ error: 'Server error' }, { status: 500 });
    }
  } else if (endpoint === 'me' && req.method === 'GET') {
    try {
      const { user } = await requireSession(req);
      return Response.json({ user });
    } catch (e) {
      if (e instanceof Response) return e;
      return new Response(null, { status: 401 });
    }
  } else {
    return new Response(null, { status: 404 });
  }
}