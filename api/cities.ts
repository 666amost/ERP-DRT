export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';

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

function writeJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(data));
}

async function readJsonNode(req: IncomingMessage): Promise<any> {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try { const s = Buffer.concat(chunks).toString('utf8'); if (!s) return resolve(null); resolve(JSON.parse(s)); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
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
    
    writeJson(res, { items: cities });
    return;
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateCityBody | null;

    try { body = await readJsonNode(req) as CreateCityBody; } catch { body = null; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.name || body.name.trim().length === 0 || !body.code || body.code.trim().length === 0) {
      writeJson(res, { error: 'City name and code required' }, 400);
      return;
    }
    
    try {
      const result = await sql`
        insert into cities (name, code, province)
        values (${body.name.trim()}, ${body.code.trim().toUpperCase()}, ${body.province || null})
        returning id, name, code, province
      ` as [{ id: number; name: string; code: string; province: string | null }];
      
      writeJson(res, result[0], 201);
      return;
    } catch (e) {
      if ((e as Error).message.includes('duplicate key')) {
        writeJson(res, { error: 'City already exists' }, 409);
        return;
      }
      throw e;
    }
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }
  } catch (error) {
    console.error('Cities API error:', error);
    writeJson(res, { error: 'Internal server error' }, 500);
    return;
  }
}