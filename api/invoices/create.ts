export const config = { runtime: 'nodejs20.x' };

import { getSql } from '../_lib/db';

type CreateInvoiceBody = {
  shipment_id?: number;
  customer_name?: string;
  customer_id?: number;
  amount: number;
  status?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  
  const sql = getSql();
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
}
