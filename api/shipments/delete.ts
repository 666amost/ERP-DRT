export const config = { runtime: 'nodejs20.x' };

import { getSql } from '../_lib/db';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'DELETE') return new Response(null, { status: 405 });
  
  const sql = getSql();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return Response.json({ error: 'Missing id' }, { status: 400 });
  }
  
  await sql`delete from shipments where id = ${parseInt(id)}`;
  
  return Response.json({ success: true });
}
