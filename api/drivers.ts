export const config = { runtime: 'nodejs' };

import type { IncomingMessage, ServerResponse } from 'http';
import { getSql } from './_lib/db.js';
import { readJsonNode, writeJson } from './_lib/http.js';

interface Driver {
  id: number;
  name: string;
  phone: string | null;
  license_number: string | null;
  created_at: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();

  try {
    await sql`
      create table if not exists drivers (
        id bigserial primary key,
        name text not null,
        phone text,
        license_number text,
        created_at timestamptz default now()
      )
    `;

    if (endpoint === 'list' && req.method === 'GET') {
      const search = url.searchParams.get('search') || '';
      
      let drivers: Driver[];
      if (search) {
        drivers = await sql`
          select id, name, phone, license_number, created_at
          from drivers
          where name ilike ${'%' + search + '%'} or phone ilike ${'%' + search + '%'}
          order by name
          limit 50
        ` as Driver[];
      } else {
        drivers = await sql`
          select id, name, phone, license_number, created_at
          from drivers
          order by name
          limit 50
        ` as Driver[];
      }

      return writeJson(res, { items: drivers });

    } else if (endpoint === 'create' && req.method === 'POST') {
      const body = await readJsonNode(req) as { name: string; phone?: string; license_number?: string } | null;
      if (!body || !body.name) return writeJson(res, { error: 'Missing name' }, 400);

      const result = await sql`
        insert into drivers (name, phone, license_number)
        values (${body.name}, ${body.phone || null}, ${body.license_number || null})
        returning id, name, phone, license_number
      ` as [Driver];

      return writeJson(res, result[0], 201);

    } else if (endpoint === 'update' && req.method === 'PUT') {
      const body = await readJsonNode(req) as { id: number; name?: string; phone?: string; license_number?: string } | null;
      if (!body || !body.id) return writeJson(res, { error: 'Missing id' }, 400);

      await sql`
        update drivers set
          name = coalesce(${body.name || null}, name),
          phone = coalesce(${body.phone || null}, phone),
          license_number = coalesce(${body.license_number || null}, license_number)
        where id = ${body.id}
      `;

      return writeJson(res, { success: true });

    } else if (endpoint === 'delete' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return writeJson(res, { error: 'Missing id' }, 400);

      await sql`delete from drivers where id = ${parseInt(id)}`;
      return writeJson(res, { success: true });

    } else {
      return writeJson(res, { error: 'Unknown endpoint' }, 404);
    }

  } catch (error) {
    console.error('Drivers API error:', error);
    return writeJson(res, { error: 'Internal server error' }, 500);
  }
}
