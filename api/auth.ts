export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { serializeCookie, parseCookies } from './_lib/cookies.js';
import { findUserByEmail, verifyPassword, createSession, revokeSession, requireSession } from './_lib/auth.js';

type LoginBody = { email: string; password: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

function jsonResponse(data: unknown, status: number, additionalHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders
    }
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'login' && req.method === 'POST') {
    try {
      const sql = getSql();
      let body: LoginBody;
      try {
        body = await req.json() as LoginBody;
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        return jsonResponse({ error: 'Invalid JSON' }, 400);
      }

      const email = (body.email || '').toLowerCase().trim();
      const password = body.password || '';
      
      if (!email || !password) {
        return jsonResponse({ error: 'Email dan password harus diisi' }, 400);
      }

      const user = await findUserByEmail(sql, email);
      
      if (!user) {
        console.error('User not found:', email);
        return jsonResponse({ error: 'INVALID_CREDENTIALS' }, 401);
      }
      
      const ok = await verifyPassword(password, user.password_hash);
      console.log('Password verified:', ok);
      
      if (!ok) {
        console.error('Invalid password for:', email);
        return jsonResponse({ error: 'INVALID_CREDENTIALS' }, 401);
      }

      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const ip = req.headers.get('x-forwarded-for') || null;
      const ua = req.headers.get('user-agent') || null;
      const session = await createSession(sql, user.id, expires, ip, ua);

      const secure = (process.env.NODE_ENV === 'production');
      const setCookie = serializeCookie('sid', session.id, {
        httpOnly: true,
        secure,
        sameSite: secure ? 'None' as const : 'Lax' as const,
        path: '/',
        expires
      });

      return jsonResponse(
        { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
        200,
        { 'Set-Cookie': setCookie }
      );
    } catch (e: unknown) {
      console.error('Auth error:', e instanceof Error ? e.message : String(e));
      return jsonResponse({ error: 'Server error' }, 500);
    }
  } else if (endpoint === 'logout' && req.method === 'POST') {
    try {
      const cookies = parseCookies(req.headers.get('cookie') || '');
      const sid = cookies['sid'];
      const sql = getSql();
      if (sid) {
        await revokeSession(sql, sid as string);
      }
      const expired = serializeCookie('sid', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax' as const,
        path: '/',
        maxAge: 0,
        expires: new Date(0)
      });
      return new Response(null, { 
        status: 204, 
        headers: { ...corsHeaders, 'Set-Cookie': expired } 
      });
    } catch (e: unknown) {
      console.error('Logout error:', e);
      return jsonResponse({ error: 'Server error' }, 500);
    }
  } else if (endpoint === 'me' && req.method === 'GET') {
    try {
      const { user } = await requireSession(req);
      return jsonResponse({ user }, 200);
    } catch (e) {
      if (e instanceof Response) {
        return new Response(e.body, { 
          status: e.status, 
          headers: { ...corsHeaders, ...Object.fromEntries(e.headers.entries()) } 
        });
      }
      return new Response(null, { status: 401, headers: corsHeaders });
    }
  } else {
    return new Response(null, { status: 404, headers: corsHeaders });
  }
}
