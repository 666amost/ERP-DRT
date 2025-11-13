export const config = { runtime: 'nodejs20.x' };

import { getSql } from '../_lib/db';

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  
  const sql = getSql();
  const url = new URL(req.url);
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
}
