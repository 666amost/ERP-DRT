export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';

type Invoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: string;
  issued_at: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  
  const sql = getSql();
  
  const invoices = await sql`
    select 
      id, invoice_number, customer_name, amount, status, issued_at
    from invoices
    order by issued_at desc
    limit 10
  ` as Invoice[];
  
  return Response.json({ items: invoices });
}
