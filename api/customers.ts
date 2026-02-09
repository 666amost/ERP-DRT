export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

type Customer = { id: number; name: string; pengirim_name?: string | null; phone: string | null; address?: string | null };
type CreateCustomerBody = { name: string; pengirim_name?: string; phone?: string; address?: string };
type UpdateCustomerBody = { id: number; name: string; pengirim_name?: string; phone?: string; address?: string };

const ErrorCode = { Validation: 'validation', Duplicate: 'duplicate' } as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const frequent = url.searchParams.get('frequent') === 'true';
    let rows: Customer[] = [];
    if (frequent) {
      rows = await sql`
        select c.id, c.name, c.pengirim_name, c.phone, c.address
        from customers c
        where c.id in (
          select customer_id from shipments 
          where customer_id is not null 
          group by customer_id 
          order by count(*) desc 
          limit 20
        )
        order by (select count(*) from shipments where customer_id = c.id) desc
      ` as Customer[];
    } else if (search) {
      rows = await sql`select id, name, pengirim_name, phone, address from customers where lower(name) like ${'%' + search.toLowerCase() + '%'} order by name limit 50` as Customer[];
    } else {
      rows = await sql`select id, name, pengirim_name, phone, address from customers order by name limit 200` as Customer[];
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
      const rows = await sql`insert into customers (name, pengirim_name, phone, address) values (${name}, ${body.pengirim_name || null}, ${body.phone || null}, ${body.address || null}) returning id, name, pengirim_name, phone, address` as [Customer];
      writeJson(res, rows[0], 201);
      return;
    } catch (e: any) {
      if (e.code === '23505') { writeJson(res, { error: 'Customer sudah ada', code: ErrorCode.Duplicate }, 409); return; }
      writeJson(res, { error: 'Gagal create customer' }, 500);
      return;
    }
  } else if (endpoint === 'update' && req.method === 'PUT') {
    let body: UpdateCustomerBody;
    try { body = (await readJsonNode(req)) as UpdateCustomerBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    if (!body.id) { writeJson(res, { error: 'ID customer wajib', code: ErrorCode.Validation }, 400); return; }
    if (!body.name || body.name.trim().length < 2) { writeJson(res, { error: 'Nama customer wajib', code: ErrorCode.Validation }, 400); return; }
    const name = body.name.trim();
    try {
      const rows = await sql`
        update customers 
        set name = ${name}, 
            pengirim_name = ${body.pengirim_name || null}, 
            phone = ${body.phone || null}, 
            address = ${body.address || null}
        where id = ${body.id}
        returning id, name, pengirim_name, phone, address
      ` as [Customer];
      if (!rows.length) { writeJson(res, { error: 'Customer tidak ditemukan' }, 404); return; }
      writeJson(res, rows[0]);
      return;
    } catch (e: any) {
      if (e.code === '23505') { writeJson(res, { error: 'Customer sudah ada', code: ErrorCode.Duplicate }, 409); return; }
      writeJson(res, { error: 'Gagal update customer' }, 500);
      return;
    }
  } else if (endpoint === 'delete' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id || isNaN(parseInt(id))) { writeJson(res, { error: 'ID customer tidak valid' }, 400); return; }
    try {
      const rows = await sql`delete from customers where id = ${parseInt(id)} returning id` as [{ id: number }];
      if (!rows.length) { writeJson(res, { error: 'Customer tidak ditemukan' }, 404); return; }
      writeJson(res, { success: true });
      return;
    } catch (e: any) {
      if (e.code === '23503') { writeJson(res, { error: 'Customer tidak bisa dihapus, masih digunakan di shipment' }, 409); return; }
      writeJson(res, { error: 'Gagal hapus customer' }, 500);
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