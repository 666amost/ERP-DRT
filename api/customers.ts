export const config = { runtime: 'nodejs' };

import { getSql } from '../lib/db';

type Customer = { id: number; name: string; phone: string | null };
type CreateCustomerBody = { name: string; phone?: string; address?: string };

enum ErrorCode { Validation = 'validation', Duplicate = 'duplicate' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();

  if (endpoint === 'list' && req.method === 'GET') {
    const search = url.searchParams.get('search');
    let rows: Customer[] = [];
    if (search) {
      rows = await sql`select id, name, phone from customers where lower(name) like ${'%' + search.toLowerCase() + '%'} order by name limit 50` as Customer[];
    } else {
      rows = await sql`select id, name, phone from customers order by name limit 200` as Customer[];
    }
    return Response.json({ items: rows });
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateCustomerBody;
    try {
      body = await req.json() as CreateCustomerBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body.name || body.name.trim().length < 2) {
      return Response.json({ error: 'Nama customer wajib', code: ErrorCode.Validation }, { status: 400 });
    }
    const name = body.name.trim();
    try {
      const rows = await sql`insert into customers (name, phone, address) values (${name}, ${body.phone || null}, ${body.address || null}) returning id, name, phone` as [{ id: number; name: string; phone: string | null }];
      return Response.json(rows[0], { status: 201 });
    } catch (e: any) {
      if (e.code === '23505') {
        return Response.json({ error: 'Customer sudah ada', code: ErrorCode.Duplicate }, { status: 409 });
      }
      return Response.json({ error: 'Gagal create customer' }, { status: 500 });
    }
  } else {
    return new Response(null, { status: 404 });
  }
}