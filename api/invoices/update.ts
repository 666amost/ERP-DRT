export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';

type UpdateInvoiceBody = {
  id: number;
  customer_name?: string;
  customer_id?: number;
  amount?: number;
  status?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'PUT') return new Response(null, { status: 405 });
  
  const sql = getSql();
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
}
