export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { serializeCookie, parseCookies } from './_lib/cookies.js';
import { findUserByEmail, verifyPassword, createSession, revokeSession, getValidSession } from './_lib/auth.js';
import type { IncomingMessage, ServerResponse } from 'http';

type LoginBody = { email: string; password: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

function writeJson(res: ServerResponse, data: unknown, status = 200, additionalHeaders: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders, ...additionalHeaders });
  res.end(JSON.stringify(data));
}

async function readJsonNode(req: IncomingMessage): Promise<any> {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try {
        const s = Buffer.concat(chunks).toString('utf8');
        if (!s) return resolve(null);
        resolve(JSON.parse(s));
      } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  if (endpoint === 'login' && req.method === 'POST') {
    try {
      const sql = getSql();
      const body = await readJsonNode(req) as LoginBody;
      if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }

      const email = (body.email || '').toLowerCase().trim();
      const password = body.password || '';
      
      if (!email || !password) {
        writeJson(res, { error: 'Email dan password harus diisi' }, 400);
        return;
      }

      const user = await findUserByEmail(sql, email);
      
      if (!user) {
        console.error('User not found:', email);
        writeJson(res, { error: 'INVALID_CREDENTIALS' }, 401);
        return;
      }
      
      const ok = await verifyPassword(password, user.password_hash);
      
      if (!ok) {
        console.error('Invalid password for:', email);
        writeJson(res, { error: 'INVALID_CREDENTIALS' }, 401);
        return;
      }

      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const headers: any = req.headers || {};
      const ip = (headers['x-forwarded-for'] as string) || null;
      const ua = (headers['user-agent'] as string) || null;
      const session = await createSession(sql, user.id, expires, ip, ua);

      const secure = (process.env.NODE_ENV === 'production');
      const setCookie = serializeCookie('sid', session.id, {
        httpOnly: true,
        secure,
        sameSite: secure ? 'None' as const : 'Lax' as const,
        path: '/',
        expires
      });

      writeJson(res, { user: { id: user.id, email: user.email, name: user.name, role: user.role } }, 200, { 'Set-Cookie': setCookie });
      return;
    } catch (e: unknown) {
      console.error('Auth error:', e instanceof Error ? e.message : String(e));
      writeJson(res, { error: 'Server error' }, 500);
      return;
    }
  } else if (endpoint === 'logout' && req.method === 'POST') {
    try {
      const cookies = parseCookies((req.headers && (req.headers as any)['cookie']) || '');
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
      res.writeHead(204, { ...corsHeaders, 'Set-Cookie': expired });
      res.end();
      return;
    } catch (e: unknown) {
      console.error('Logout error:', e);
      writeJson(res, { error: 'Server error' }, 500);
      return;
    }
  } else if (endpoint === 'me' && req.method === 'GET') {
    try {
      const cookies = parseCookies((req.headers && (req.headers as any)['cookie']) || '');
      const sid = cookies['sid'];
      if (!sid) {
        writeJson(res, { error: 'Unauthorized' }, 401);
        return;
      }
      const sql = getSql();
      const sessionRecord = await getValidSession(sql, sid);
      if (!sessionRecord) { writeJson(res, { error: 'Unauthorized' }, 401); return; }
      const user = { id: sessionRecord.user.id, email: sessionRecord.user.email, name: sessionRecord.user.name, role: sessionRecord.user.role };
      writeJson(res, { user }, 200);
      return;
    } catch (e) {
      console.error('Me error:', e);
      writeJson(res, { error: 'Unauthorized' }, 401);
      return;
    }
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }
}
