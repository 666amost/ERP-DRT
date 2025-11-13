export const config = { runtime: 'nodejs20.x' };

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
  
  const outgoing = await sql<{ count: number }[]>`
    select count(*)::int as count from shipments 
    where date(created_at) = current_date
  `;
  
  const active = await sql<{ count: number }[]>`
    select count(*)::int as count from shipments 
    where status in ('IN_TRANSIT', 'LOADING', 'READY')
  `;
  
  const pending = await sql<{ count: number }[]>`
    select count(*)::int as count from invoices 
    where status = 'pending'
  `;
  
  const notes = await sql<{ count: number }[]>`
    select count(*)::int as count from shipments
  `;
  
  const stats: Stats = {
    outgoingToday: outgoing[0]?.count || 0,
    activeShipments: active[0]?.count || 0,
    pendingInvoices: pending[0]?.count || 0,
    deliveryNotes: notes[0]?.count || 0
  };
  
  return Response.json(stats);
}
