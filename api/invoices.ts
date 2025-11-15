export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

type Invoice = {
  id: number;
  shipment_id: number | null;
  invoice_number: string;
  customer_name: string;
  customer_id: number | null;
  amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string | null;
};

type InvoiceItem = {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_type?: string;
  item_discount?: number;
};

type CreateInvoiceBody = {
  shipment_id?: number;
  customer_name?: string;
  customer_id?: number;
  amount: number;
  status?: string;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
};

type UpdateInvoiceBody = {
  id: number;
  customer_name?: string;
  customer_id?: number;
  amount?: number;
  status?: string;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

// use writeJson helper

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
    const sql = getSql();

  if (endpoint === 'list' && req.method === 'GET') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status');
    const offset = (page - 1) * limit;
    
    let invoices: Invoice[];
    let total: number;
    
    if (status && ['pending', 'paid', 'cancelled'].includes(status)) {
      invoices = await sql`
        select 
          id, shipment_id, invoice_number, customer_name, customer_id,
          amount, status, issued_at, paid_at, tax_percent, discount_amount, notes
        from invoices
        where status = ${status}
        order by issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
        where status = ${status}
      ` as [{ count: number }];
      
      total = countResult[0]?.count || 0;
    } else {
      invoices = await sql`
        select 
          id, shipment_id, invoice_number, customer_name, customer_id,
          amount, status, issued_at, paid_at, tax_percent, discount_amount, notes
        from invoices
        order by issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
      ` as [{ count: number }];
      
      total = countResult[0]?.count || 0;
    }
    
    writeJson(res, {
      items: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateInvoiceBody;
    
    try { body = await readJsonNode(req) as CreateInvoiceBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if ((!body.customer_name && !body.customer_id) || !body.amount) { writeJson(res, { error: 'Missing required fields' }, 400); return; }
    
    const year = new Date().getFullYear();
    const countResult = await sql`
      select count(*)::int as count from invoices
      where invoice_number like ${`INV-${year}-%`}
    ` as [{ count: number }];
    
    const nextNum = (countResult[0]?.count || 0) + 1;
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(4, '0')}`;
    
    let customerName = body.customer_name;
    let customerId = body.customer_id || null;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }
    const result = await sql`
      insert into invoices (
        shipment_id, invoice_number, customer_name, customer_id, amount, status, issued_at, tax_percent, discount_amount, notes
      ) values (
        ${body.shipment_id || null},
        ${invoiceNumber},
        ${customerName},
        ${customerId},
        ${body.amount},
        ${body.status || 'pending'},
        now(),
        ${body.tax_percent || 0},
        ${body.discount_amount || 0},
        ${body.notes || null}
      )
      returning id
    ` as [{ id: number }];
    
    writeJson(res, { id: result[0].id, invoice_number: invoiceNumber }, 201);
    return;
  } else if (endpoint === 'update' && req.method === 'PUT') {
    let body: UpdateInvoiceBody;
    
    try { body = await readJsonNode(req) as UpdateInvoiceBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.id) { writeJson(res, { error: 'Missing id' }, 400); return; }
    
    let customerName = body.customer_name;
    let customerId = body.customer_id;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }

    const sets: string[] = [];
    if (customerName) sets.push(`customer_name = $${sets.length + 1}`);
    if (customerId !== undefined) sets.push(`customer_id = $${sets.length + 1}`);
    if (body.amount !== undefined) sets.push(`amount = $${sets.length + 1}`);
    if (body.tax_percent !== undefined) sets.push(`tax_percent = $${sets.length + 1}`);
    if (body.discount_amount !== undefined) sets.push(`discount_amount = $${sets.length + 1}`);
    if (body.notes !== undefined) sets.push(`notes = $${sets.length + 1}`);
    if (body.status) {
      sets.push(`status = $${sets.length + 1}`);
      if (body.status === 'paid') sets.push('paid_at = now()');
    }
    if (!sets.length) { writeJson(res, { error: 'No fields to update' }, 400); return; }
    const params: unknown[] = [];
    if (customerName) params.push(customerName);
    if (customerId !== undefined) params.push(customerId);
    if (body.amount !== undefined) params.push(body.amount);
    if (body.tax_percent !== undefined) params.push(body.tax_percent);
    if (body.discount_amount !== undefined) params.push(body.discount_amount);
    if (body.notes !== undefined) params.push(body.notes);
    if (body.status) params.push(body.status);
    params.push(body.id);
    
    const setClauses: string[] = [];
    let paramIndex = 0;
    if (customerName) setClauses.push(`customer_name = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (customerId !== undefined) setClauses.push(`customer_id = ${params[paramIndex++]}`);
    if (body.amount !== undefined) setClauses.push(`amount = ${params[paramIndex++]}`);
    if (body.tax_percent !== undefined) setClauses.push(`tax_percent = ${params[paramIndex++]}`);
    if (body.discount_amount !== undefined) setClauses.push(`discount_amount = ${params[paramIndex++]}`);
    if (body.notes !== undefined) setClauses.push(`notes = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.status) {
      setClauses.push(`status = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
      if (body.status === 'paid') setClauses.push('paid_at = now()');
    }
    
    const updateQuery = `UPDATE invoices SET ${setClauses.join(', ')} WHERE id = ${body.id}`;
    await sql(updateQuery as any);
    
    writeJson(res, { success: true });
    return;
  } else if (endpoint === 'items' && req.method === 'GET') {
    const invoiceId = parseInt(url.searchParams.get('invoice_id') || '0');
    if (!invoiceId) { writeJson(res, { error: 'Missing invoice_id' }, 400); return; }
    const items = await sql`select id, invoice_id, description, quantity::float as quantity, unit_price::float as unit_price, tax_type, item_discount::float as item_discount from invoice_items where invoice_id = ${invoiceId} order by id` as InvoiceItem[];
    writeJson(res, { items });
    return;
  } else if (endpoint === 'set-items' && req.method === 'POST') {
    let body: { invoice_id: number; items: InvoiceItem[]; tax_percent?: number; discount_amount?: number; notes?: string };
    try { body = await readJsonNode(req) as { invoice_id: number; items: InvoiceItem[]; tax_percent?: number; discount_amount?: number; notes?: string }; } catch { body = null as any; }
    if (!body || !body.invoice_id) { writeJson(res, { error: 'Missing invoice_id' }, 400); return; }

    await sql`delete from invoice_items where invoice_id = ${body.invoice_id}`;
    for (const it of body.items || []) {
      if (!it || !it.description) continue;
      await sql`insert into invoice_items (invoice_id, description, quantity, unit_price, tax_type, item_discount) values (${body.invoice_id}, ${it.description}, ${it.quantity || 0}, ${it.unit_price || 0}, ${it.tax_type || 'include'}, ${it.item_discount || 0})`;
    }
    const rows = await sql`select coalesce(sum((quantity*unit_price) - coalesce(item_discount,0)),0)::float as subtotal from invoice_items where invoice_id = ${body.invoice_id}` as [{ subtotal: number }];
    const subtotal = rows[0]?.subtotal || 0;
    const tax = (body.tax_percent || 0) * subtotal / 100;
    const total = subtotal + tax - (body.discount_amount || 0);
    await sql`update invoices set amount = ${total}, tax_percent = ${body.tax_percent || 0}, discount_amount = ${body.discount_amount || 0}, notes = ${body.notes || null} where id = ${body.invoice_id}`;
    writeJson(res, { success: true, subtotal, total });
    return;
  } else if (endpoint === 'delete' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    
    if (!id) { writeJson(res, { error: 'Missing id' }, 400); return; }
    
    await sql`delete from invoices where id = ${parseInt(id)}`;
    
    writeJson(res, { success: true });
    return;
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }
  } catch (error) {
    console.error('Invoices API error:', error);
    writeJson(res, { error: 'Internal server error' }, 500);
    return;
  }
}