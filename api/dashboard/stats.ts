export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';

type Stats = {
  outgoingToday: number;
  activeShipments: number;
  pendingInvoices: number;
  deliveryNotes: number;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  
  const sql = getSql();
  
  const outgoing = await sql`
    select count(*)::int as count from shipments 
    where date(created_at) = current_date
  ` as { count: number }[];
  
  const active = await sql`
    select count(*)::int as count from shipments 
    where status in ('IN_TRANSIT', 'LOADING', 'READY')
  ` as { count: number }[];
  
  const pending = await sql`
    select count(*)::int as count from invoices 
    where status = 'pending'
  ` as { count: number }[];
  
  const notes = await sql`
    select count(*)::int as count from shipments
  ` as { count: number }[];
  
  const stats: Stats = {
    outgoingToday: outgoing[0]?.count || 0,
    activeShipments: active[0]?.count || 0,
    pendingInvoices: pending[0]?.count || 0,
    deliveryNotes: notes[0]?.count || 0
  };
  
  return Response.json(stats);
}
