export const config = { runtime: 'nodejs' };
import { getSql } from 'lib/db';

type Customer = { id: number; name: string; phone: string | null; };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const sql = getSql();
  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  let rows: Customer[] = [];
  if (search) {
    rows = await sql`select id, name, phone from customers where lower(name) like ${'%' + search.toLowerCase() + '%'} order by name limit 50` as Customer[];
  } else {
    rows = await sql`select id, name, phone from customers order by name limit 200` as Customer[];
  }
  return Response.json({ items: rows });
}
