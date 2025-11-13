export const config = { runtime: 'nodejs' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const { requireSession } = await import('../_lib/auth');
  try {
    const { setCookieHeader } = await requireSession(req);
    const u = new URL(req.url);
    const pathname = u.searchParams.get('pathname');
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!pathname) return Response.json({ error: 'Missing pathname' }, { status: 400 });
    if (!token) return Response.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });
    const upstream = `https://blob.vercel-storage.com/${pathname.replace(/^\//, '')}`;
    const res = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return new Response(null, { status: res.status });
    const headers = new Headers(res.headers);
    headers.delete('set-cookie');
    if (setCookieHeader) headers.set('set-cookie', setCookieHeader);
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(null, { status: 401 });
  }
}
