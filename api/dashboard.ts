export const config = { runtime: 'nodejs' };

import { getSql } from 'lib/db';

type Stats = {
  outgoingToday: number;
  activeShipments: number;
  pendingInvoices: number;
  deliveryNotes: number;
};

type Invoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: string;
  issued_at: string;
};

type Shipment = {
  id: number;
  public_code: string;
  origin: string;
  destination: string;
  status: string;
  carrier_name: string | null;
  driver_name: string | null;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

  const sql = getSql();

  if (endpoint === 'stats') {
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
  } else if (endpoint === 'invoices') {
    const invoices = await sql`
      select 
        id, invoice_number, customer_name, amount, status, issued_at
      from invoices
      order by issued_at desc
      limit 10
    ` as Invoice[];
    
    return Response.json({ items: invoices });
  } else if (endpoint === 'tracking') {
    const shipments = await sql`
      select 
        s.id, s.public_code, s.origin, s.destination, s.status,
        t.carrier_name, t.driver_name
      from shipments s
      left join trip_items ti on ti.shipment_id = s.id
      left join trips t on t.id = ti.trip_id
      where s.status in ('IN_TRANSIT', 'LOADING')
      order by s.created_at desc
      limit 10
    ` as Shipment[];
    
    return Response.json({ items: shipments });
  } else {
    return new Response(null, { status: 404 });
  }
}