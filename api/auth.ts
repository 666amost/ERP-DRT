export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { serializeCookie, parseCookies } from './_lib/cookies.js';
import { findUserByEmail, verifyPassword, createSession, revokeSession, requireSession } from './_lib/auth.js';

type LoginBody = { email: string; password: string };

type NodeLikeHeaders = Record<string, string | string[] | undefined>;
function headerGetLike(headers: unknown, name: string): string | null {
  const n = name.toLowerCase();
  const h = headers as unknown as { get?: (key: string) => string | null } & NodeLikeHeaders | undefined;
  if (h && typeof h.get === 'function') return h.get(name);
  if (!h) return null;
  const v = (h as NodeLikeHeaders)[n] ?? (h as NodeLikeHeaders)[name];
  if (Array.isArray(v)) return v[0] ?? null;
  if (typeof v === 'string') return v;
  return v != null ? String(v) : null;
}

async function readJsonBody<T>(req: unknown): Promise<T> {
  const r = req as { json?: () => Promise<unknown>; body?: unknown };
  if (typeof r?.json === 'function') return (await r.json()) as T;
  if (r && 'body' in (r as object)) {
    const b = r.body as unknown;
    if (typeof b === 'string') return JSON.parse(b) as T;
    return b as T;
  }
  throw new Error('No JSON body');
}

export default async function handler(req: unknown): Promise<Response> {
  const urlStr: string = (req as { url?: string }).url ?? '/api/auth';
  const host = headerGetLike((req as { headers?: unknown }).headers, 'host') || 'localhost';
  const url = new URL(urlStr, `https://${host}`);
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'login' && req.method === 'POST') {
    try {
      const sql = getSql();
      let body: LoginBody;
      try {
        body = await readJsonBody<LoginBody>(req);
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
      const ip = headerGetLike((req as { headers?: unknown }).headers, 'x-forwarded-for') || null;
      const ua = headerGetLike((req as { headers?: unknown }).headers, 'user-agent') || null;
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
  } else if (endpoint === 'logout' && (req as { method?: string }).method === 'POST') {
    try {
      const cookies = parseCookies(headerGetLike((req as { headers?: unknown }).headers, 'cookie'));
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
  } else if (endpoint === 'me' && (req as { method?: string }).method === 'GET') {
    try {
      const cookie = headerGetLike((req as { headers?: unknown }).headers, 'cookie');
      const headers = new Headers();
      if (cookie) headers.set('cookie', cookie);
      const fetchReq = new Request(url.toString(), { headers });
      const { user } = await requireSession(fetchReq);
      return Response.json({ user });
    } catch (e) {
      if (e instanceof Response) return e;
      return new Response(null, { status: 401 });
    }
  } else {
    return new Response(null, { status: 404 });
  }
}