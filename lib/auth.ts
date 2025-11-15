import { getSql, type Sql } from './db';
import { parseCookies, serializeCookie } from './cookies';
import { createHash } from 'crypto';

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  password_hash: string;
};

export type Session = {
  id: string;
  user_id: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  ip: string | null;
  ua: string | null;
};

export async function findUserByEmail(sql: Sql, email: string): Promise<User | null> {
  const rows = await sql`select id, email, name, role, password_hash from users where email = ${email} limit 1` as User[];
  return rows[0] ?? null;
}

export async function createSession(
  sql: Sql,
  userId: number,
  expiresAt: Date,
  ip: string | null,
  ua: string | null
): Promise<Session> {
  const rows = await sql`
    insert into sessions (user_id, expires_at, ip, ua)
    values (${userId}, ${expiresAt.toISOString()}, ${ip}, ${ua})
    returning id, user_id, expires_at, revoked_at, created_at, ip, ua
  ` as Session[];
  if (!rows[0]) throw new Error('Failed to create session');
  return rows[0];
}

export async function revokeSession(sql: Sql, id: string): Promise<void> {
  await sql`update sessions set revoked_at = now() where id = ${id} and revoked_at is null`;
}

export async function getValidSession(sql: Sql, id: string): Promise<(Session & { user: User }) | null> {
  const rows = await sql`
    select s.id, s.user_id, s.expires_at, s.revoked_at, s.created_at, s.ip, s.ua,
           u.id as user_id2, u.email, u.name, u.role, u.password_hash
    from sessions s
    join users u on u.id = s.user_id
    where s.id = ${id}
      and s.revoked_at is null
      and s.expires_at > now()
    limit 1
  ` as (Session & { user: User })[];
  const row = rows[0];
  if (!row) return null;
  type RowWithUser = Session & { user_id2: number; email: string; name: string | null; role: 'admin' | 'user'; password_hash: string };
  const r = row as unknown as RowWithUser;
  const user: User = {
    id: r.user_id2,
    email: r.email,
    name: r.name ?? null,
    role: r.role,
    password_hash: r.password_hash
  };
  const session: Session = {
    id: row.id,
    user_id: row.user_id,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    ip: row.ip,
    ua: row.ua
  };
  return { ...session, user } as unknown as Session & { user: User };
}

export type RequireSessionResult = {
  user: Omit<User, 'password_hash'>;
  session: Session;
  setCookieHeader?: string;
};

const SESSION_TTL_DAYS = 7;
const ROTATE_AFTER_HOURS = 24;

export async function requireSession(req: any): Promise<RequireSessionResult> {
  const sql = getSql();
  const getHeader = (request: any, name: string): string | null => {
    const headers = request.headers || {};
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name.toLowerCase()] || null;
  };
  const cookies = parseCookies(getHeader(req, 'cookie'));
  const sid = cookies['sid'];
  if (!sid) throw new Response(null, { status: 401 });

  const record = await getValidSession(sql, sid);
  if (!record) throw new Response(null, { status: 401 });

  const createdAt = new Date(record.created_at);
  const now = new Date();
  let setCookieHeader: string | undefined;

  if ((now.getTime() - createdAt.getTime()) / 36e5 >= ROTATE_AFTER_HOURS) {
    await revokeSession(sql, record.id);
    const newExpires = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const newSession = await createSession(sql, record.user.id, newExpires, record.ip, record.ua);
    const secure = (process.env.NODE_ENV === 'production');
    setCookieHeader = serializeCookie('sid', newSession.id, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'Lax' : 'Lax',
      path: '/',
      expires: newExpires
    });
    return {
      user: { id: record.user.id, email: record.user.email, name: record.user.name, role: record.user.role },
      session: newSession,
      setCookieHeader
    };
  }

  return {
    user: { id: record.user.id, email: record.user.email, name: record.user.name, role: record.user.role },
    session: {
      id: record.id,
      user_id: record.user.id,
      expires_at: record.expires_at,
      revoked_at: record.revoked_at,
      created_at: record.created_at,
      ip: record.ip,
      ua: record.ua
    }
  };
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // Compare SHA256 hex digest
  const input = hashPassword(plain);
  return input === hash;
}
