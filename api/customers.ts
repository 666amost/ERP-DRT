export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';

type Customer = { id: number; name: string; phone: string | null };
type CreateCustomerBody = { name: string; phone?: string; address?: string };

enum ErrorCode { Validation = 'validation', Duplicate = 'duplicate' }

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
    let rows: Customer[] = [];
    if (search) {
      rows = await sql`select id, name, phone from customers where lower(name) like ${'%' + search.toLowerCase() + '%'} order by name limit 50` as Customer[];
    } else {
      rows = await sql`select id, name, phone from customers order by name limit 200` as Customer[];
    }
    return jsonResponse({ items: rows });
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateCustomerBody;
    try {
      body = await req.json() as CreateCustomerBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
    if (!body.name || body.name.trim().length < 2) {
      return jsonResponse({ error: 'Nama customer wajib', code: ErrorCode.Validation }, 400);
    }
    const name = body.name.trim();
    try {
      const rows = await sql`insert into customers (name, phone, address) values (${name}, ${body.phone || null}, ${body.address || null}) returning id, name, phone` as [{ id: number; name: string; phone: string | null }];
      return jsonResponse(rows[0], 201);
    } catch (e: any) {
      if (e.code === '23505') {
        return jsonResponse({ error: 'Customer sudah ada', code: ErrorCode.Duplicate }, 409);
      }
      return jsonResponse({ error: 'Gagal create customer' }, 500);
    }
  } else {
    return new Response(null, { status: 404, headers: corsHeaders });
  }
  } catch (error) {
    console.error('Customers API error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}