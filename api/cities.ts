export const config = { runtime: 'nodejs' };

import { getSql } from 'lib/db';

type City = {
  id: number;
  name: string;
  code: string;
  province: string | null;
};

type CreateCityBody = {
  name: string;
  code: string;
  province?: string;
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();

  if (endpoint === 'list' && req.method === 'GET') {
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
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateCityBody;
    
    try {
      body = await req.json() as CreateCityBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    if (!body.name || body.name.trim().length === 0 || !body.code || body.code.trim().length === 0) {
      return Response.json({ error: 'City name and code required' }, { status: 400 });
    }
    
    try {
      const result = await sql`
        insert into cities (name, code, province)
        values (${body.name.trim()}, ${body.code.trim().toUpperCase()}, ${body.province || null})
        returning id, name, code, province
      ` as [{ id: number; name: string; code: string; province: string | null }];
      
      return Response.json(result[0], { status: 201 });
    } catch (e) {
      if ((e as Error).message.includes('duplicate key')) {
        return Response.json({ error: 'City already exists' }, { status: 409 });
      }
      throw e;
    }
  } else {
    return new Response(null, { status: 404 });
  }
}