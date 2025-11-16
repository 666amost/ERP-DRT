export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

type Customer = { id: number; name: string; phone: string | null; address?: string | null };
type CreateCustomerBody = { name: string; phone?: string; address?: string };

const ErrorCode = { Validation: 'validation', Duplicate: 'duplicate' } as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

// replaced by writeJson helper

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
    const sql = getSql();

  if (endpoint === 'list' && req.method === 'GET') {
    const search = url.searchParams.get('search');
    let rows: Customer[] = [];
    if (search) {
      rows = await sql`select id, name, phone, address from customers where lower(name) like ${'%' + search.toLowerCase() + '%'} order by name limit 50` as Customer[];
    } else {
      rows = await sql`select id, name, phone, address from customers order by name limit 200` as Customer[];
    }
    writeJson(res, { items: rows });
    return;
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateCustomerBody;
    try { body = (await readJsonNode(req)) as CreateCustomerBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    if (!body.name || body.name.trim().length < 2) { writeJson(res, { error: 'Nama customer wajib', code: ErrorCode.Validation }, 400); return; }
    const name = body.name.trim();
    try {
      const rows = await sql`insert into customers (name, phone, address) values (${name}, ${body.phone || null}, ${body.address || null}) returning id, name, phone, address` as [{ id: number; name: string; phone: string | null; address: string | null }];
      writeJson(res, rows[0], 201);
      return;
    } catch (e: any) {
      if (e.code === '23505') { writeJson(res, { error: 'Customer sudah ada', code: ErrorCode.Duplicate }, 409); return; }
      writeJson(res, { error: 'Gagal create customer' }, 500);
      return;
    }
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }
  } catch (error) {
    console.error('Customers API error:', error);
    writeJson(res, { error: 'Internal server error' }, 500);
    return;
  }
}