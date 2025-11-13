type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
};

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const segments: string[] = [];
  segments.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  if (opts.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) segments.push(`Expires=${opts.expires.toUTCString()}`);
  segments.push(`Path=${opts.path ?? '/'}`);
  if (opts.domain) segments.push(`Domain=${opts.domain}`);
  if (opts.httpOnly) segments.push('HttpOnly');
  if (opts.secure) segments.push('Secure');
  if (opts.sameSite) segments.push(`SameSite=${opts.sameSite}`);
  return segments.join('; ');
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = decodeURIComponent(part.slice(0, idx).trim());
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (!out[k]) out[k] = v;
  }
  return out;
}
