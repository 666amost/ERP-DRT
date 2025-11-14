export const config = { runtime: 'nodejs' };

import { getSql } from '../lib/db';

type City = {
  id: number;
  name: string;
  code: string;
  province: string | null;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  
  const sql = getSql();
  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  
  let cities: City[];
  
  if (search) {
    cities = await sql`
      select id, name, code, province
      from cities
      where lower(name) like ${`%${search.toLowerCase()}%`}
      order by name
      limit 20
    ` as City[];
  } else {
    cities = await sql`
      select id, name, code, province
      from cities
      order by name
    ` as City[];
  }
  
  return Response.json({ items: cities });
}
