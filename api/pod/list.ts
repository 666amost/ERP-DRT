export const config = { runtime: 'nodejs' };

import { getSql } from '../lib/db';
import { requireSession } from '../lib/auth';

type Row = {
  id: number;
  shipment_id: number;
  signed_at: string | null;
  photos: Array<{ pathname: string; size: number; type: string }>;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const sql = getSql();
  try {
    const { setCookieHeader } = await requireSession(req);
  const rows = await sql`select id, shipment_id, signed_at, photos from pod order by id desc limit 50` as Row[];
    const res = Response.json({ items: rows });
    if (setCookieHeader) {
      res.headers.set('set-cookie', setCookieHeader);
    }
    return res;
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
