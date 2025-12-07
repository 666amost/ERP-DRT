export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import { requireSession } from './_lib/auth.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { writeJson } from './_lib/http.js';

type Stats = {
  outgoingToday: number;
  activeShipments: number;
  pendingInvoices: number;
  deliveryNotes: number;
  totalInvoices: number;
  outstandingCount: number;
  outstandingAmount: number;
  pelunasanCount: number;
  pelunasanAmount: number;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

// use writeJson helper

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }
  if (req.method !== 'GET') { res.writeHead(405, corsHeaders); res.end(); return; }

  try { await requireSession(req); } catch (err) { console.warn('requireSession failed', err); res.writeHead(401, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
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
        where status in ('pending', 'partial')
      ` as { count: number }[];
      
      const notes = await sql`
        select count(*)::int as count from shipments
      ` as { count: number }[];

      const totalInvoices = await sql`
        select count(*)::int as count from invoices
      ` as { count: number }[];

      const outstanding = await sql`
        select 
          count(*)::int as count,
          coalesce(sum(remaining_amount), 0)::numeric as amount 
        from (
          select 
            s.id,
            case 
              when ii_inv.id is null and spb_inv.id is null then coalesce(s.nominal, 0)
              when ii_inv.id is not null then
                case 
                  when coalesce(ii_inv.subtotal, 0) > 0 then 
                    round((coalesce(s.nominal, 0)::numeric / coalesce(ii_inv.subtotal, 1)::numeric) * coalesce(ii_inv.remaining_amount, ii_inv.amount, 0)::numeric, 2)
                  else coalesce(ii_inv.remaining_amount, s.nominal, 0)
                end
              else coalesce(spb_inv.remaining_amount, s.nominal, 0)
            end as remaining_amount
          from shipments s
          left join invoice_items ii on ii.shipment_id = s.id
          left join invoices ii_inv on ii_inv.id = ii.invoice_id
          left join invoices spb_inv on spb_inv.spb_number = s.spb_number and ii.id is null
          where s.nominal > 0
            and s.created_at >= current_date - interval '90 days'
            and (
              (ii_inv.id is null and spb_inv.id is null)
              or (ii_inv.id is not null and ii_inv.status in ('pending', 'partial'))
              or (ii_inv.id is null and spb_inv.id is not null and spb_inv.status in ('pending', 'partial'))
            )
          group by s.id, s.nominal,
                   ii_inv.id, ii_inv.remaining_amount, ii_inv.amount, ii_inv.subtotal,
                   spb_inv.id, spb_inv.remaining_amount
        ) as outstanding_items
      ` as { count: number; amount: number }[];

      const pelunasan = await sql`
        select count(*)::int as count, coalesce(sum(amount), 0)::numeric as amount 
        from invoice_payments
      ` as { count: number; amount: number }[];
      
      const stats: Stats = {
        outgoingToday: outgoing[0]?.count || 0,
        activeShipments: active[0]?.count || 0,
        pendingInvoices: pending[0]?.count || 0,
        deliveryNotes: notes[0]?.count || 0,
        totalInvoices: totalInvoices[0]?.count || 0,
        outstandingCount: outstanding[0]?.count || 0,
        outstandingAmount: Number(outstanding[0]?.amount) || 0,
        pelunasanCount: pelunasan[0]?.count || 0,
        pelunasanAmount: Number(pelunasan[0]?.amount) || 0
      };
      
      writeJson(res, stats);
      return;
    } else if (endpoint === 'invoices') {
      const invoices = await sql`
        select 
          id, invoice_number, customer_name, amount, status, issued_at
        from invoices
        order by issued_at desc
      ` as Invoice[];
      
      writeJson(res, { items: invoices });
      return;
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
      ` as Shipment[];
      
      writeJson(res, { items: shipments });
      return;
    } else if (endpoint === 'trend') {
      // Return outgoing shipments counts for last 7 days (date + count)
      const trend = await sql`
        select to_char(date_trunc('day', created_at)::date, 'YYYY-MM-DD') as day, count(*)::int as count
        from shipments
        where created_at >= (current_date - interval '6 days')
        group by day
        order by day
      ` as { day: string; count: number }[];

      writeJson(res, { items: trend });
      return;
    } else {
      res.writeHead(404, corsHeaders);
      res.end();
      return;
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    writeJson(res, { 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
    return;
  }
}