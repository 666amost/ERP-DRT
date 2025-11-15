export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

  try {
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
    
    return jsonResponse({ items: cities });
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateCityBody;
    
    try {
      body = await req.json() as CreateCityBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
    
    if (!body.name || body.name.trim().length === 0 || !body.code || body.code.trim().length === 0) {
      return jsonResponse({ error: 'City name and code required' }, 400);
    }
    
    try {
      const result = await sql`
        insert into cities (name, code, province)
        values (${body.name.trim()}, ${body.code.trim().toUpperCase()}, ${body.province || null})
        returning id, name, code, province
      ` as [{ id: number; name: string; code: string; province: string | null }];
      
      return jsonResponse(result[0], 201);
    } catch (e) {
      if ((e as Error).message.includes('duplicate key')) {
        return jsonResponse({ error: 'City already exists' }, 409);
      }
      throw e;
    }
  } else {
    return new Response(null, { status: 404, headers: corsHeaders });
  }
  } catch (error) {
    console.error('Cities API error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}