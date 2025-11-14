export const config = { runtime: 'nodejs' };

import { getSql } from '../lib/db';

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
};

type CreateInvoiceBody = {
  shipment_id?: number;
  customer_name?: string;
  customer_id?: number;
  amount: number;
  status?: string;
};

type UpdateInvoiceBody = {
  id: number;
  customer_name?: string;
  customer_id?: number;
  amount?: number;
  status?: string;
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

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
          amount, status, issued_at, paid_at
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
          amount, status, issued_at, paid_at
        from invoices
        order by issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
      ` as [{ count: number }];
      
      total = countResult[0]?.count || 0;
    }
    
    return Response.json({
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
    
    try {
      body = await req.json() as CreateInvoiceBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    if ((!body.customer_name && !body.customer_id) || !body.amount) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
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
      if (!c.length) return Response.json({ error: 'Invalid customer_id' }, { status: 400 });
      customerName = c[0].name;
    }
    const result = await sql`
      insert into invoices (
        shipment_id, invoice_number, customer_name, customer_id, amount, status, issued_at
      ) values (
        ${body.shipment_id || null},
        ${invoiceNumber},
        ${customerName},
        ${customerId},
        ${body.amount},
        ${body.status || 'pending'},
        now()
      )
      returning id
    ` as [{ id: number }];
    
    return Response.json({ id: result[0].id, invoice_number: invoiceNumber }, { status: 201 });
  } else if (endpoint === 'update' && req.method === 'PUT') {
    let body: UpdateInvoiceBody;
    
    try {
      body = await req.json() as UpdateInvoiceBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    if (!body.id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    
    // resolve customer_name if only customer_id provided
    let customerName = body.customer_name;
    let customerId = body.customer_id;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) return Response.json({ error: 'Invalid customer_id' }, { status: 400 });
      customerName = c[0].name;
    }

    const sets: string[] = [];
    if (customerName) sets.push(`customer_name = $${sets.length + 1}`);
    if (customerId !== undefined) sets.push(`customer_id = $${sets.length + 1}`);
    if (body.amount !== undefined) sets.push(`amount = $${sets.length + 1}`);
    if (body.status) {
      sets.push(`status = $${sets.length + 1}`);
      if (body.status === 'paid') sets.push('paid_at = now()');
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    const params: unknown[] = [];
    if (customerName) params.push(customerName);
    if (customerId !== undefined) params.push(customerId);
    if (body.amount !== undefined) params.push(body.amount);
    if (body.status) params.push(body.status);
    const updateSql = `update invoices set ${sets.join(', ')} where id = $${sets.length + 1}`;
    params.push(body.id);
    await sql(updateSql, params);
    
    return Response.json({ success: true });
  } else if (endpoint === 'delete' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    
    await sql`delete from invoices where id = ${parseInt(id)}`;
    
    return Response.json({ success: true });
  } else {
    return new Response(null, { status: 404 });
  }
}