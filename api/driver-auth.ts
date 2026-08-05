export const config = { runtime: 'nodejs' };

import type { IncomingMessage, ServerResponse } from 'http';
import { getSql } from './_lib/db.js';
import {
  createSession,
  findUserByEmail,
  getBearerToken,
  getValidSession,
  revokeSession,
  verifyPassword
} from './_lib/auth.js';
import { readJsonNode } from './_lib/http.js';

type LoginBody = {
  email?: string;
  password?: string;
  remember_me?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store'
};

function writeJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();

  if (endpoint === 'login' && req.method === 'POST') {
    const body = await readJsonNode(req) as LoginBody | null;
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password || email.length > 254 || password.length > 256) {
      writeJson(res, { error: 'Email dan password harus diisi' }, 400);
      return;
    }

    try {
      const user = await findUserByEmail(sql, email);
      const passwordOk = user ? await verifyPassword(password, user.password_hash) : false;
      if (!user || !passwordOk) {
        writeJson(res, { error: 'INVALID_CREDENTIALS' }, 401);
        return;
      }
      if (user.role !== 'driver') {
        writeJson(res, { error: 'DRIVER_ACCOUNT_REQUIRED' }, 403);
        return;
      }

      const ttlMs = body?.remember_me
        ? 30 * 24 * 60 * 60 * 1000
        : 12 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + ttlMs);
      const forwardedFor = req.headers['x-forwarded-for'];
      const ip = Array.isArray(forwardedFor) ? forwardedFor[0] || null : forwardedFor || null;
      const session = await createSession(
        sql,
        user.id,
        expiresAt,
        ip ? String(ip).split(',')[0]?.trim() || null : null,
        req.headers['user-agent'] || null
      );

      writeJson(res, {
        token: session.id,
        expires_at: session.expires_at,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    } catch (error) {
      console.error('[driver-auth/login]', error instanceof Error ? error.message : String(error));
      writeJson(res, { error: 'Server error' }, 500);
    }
    return;
  }

  if (endpoint === 'me' && req.method === 'GET') {
    const token = getBearerToken(req);
    if (!token) {
      writeJson(res, { error: 'Unauthorized' }, 401);
      return;
    }
    try {
      const session = await getValidSession(sql, token);
      if (!session || session.user.role !== 'driver') {
        writeJson(res, { error: 'Unauthorized' }, 401);
        return;
      }
      writeJson(res, {
        expires_at: session.expires_at,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role
        }
      });
    } catch (error) {
      console.error('[driver-auth/me]', error instanceof Error ? error.message : String(error));
      writeJson(res, { error: 'Unauthorized' }, 401);
    }
    return;
  }

  if (endpoint === 'logout' && req.method === 'POST') {
    const token = getBearerToken(req);
    try {
      if (token) await revokeSession(sql, token);
      res.writeHead(204, corsHeaders);
      res.end();
    } catch (error) {
      console.error('[driver-auth/logout]', error instanceof Error ? error.message : String(error));
      writeJson(res, { error: 'Server error' }, 500);
    }
    return;
  }

  writeJson(res, { error: 'Not found' }, 404);
}
