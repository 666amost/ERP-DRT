export const config = { runtime: 'nodejs20.x' };

import { getSql } from '../_lib/db';

type Shipment = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
  total_colli: number;
  public_code: string | null;
  vehicle_plate_region: string | null;
  created_at: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  
  const sql = getSql();
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const status = url.searchParams.get('status');
  const offset = (page - 1) * limit;
  
  let shipments: Shipment[];
  let total: number;
  
  if (status && ['DRAFT', 'READY', 'LOADING', 'IN_TRANSIT', 'DELIVERED'].includes(status)) {
    shipments = await sql`
      select 
        s.id, s.customer_id, c.name as customer_name,
        s.origin, s.destination, s.eta, s.status, s.total_colli, s.public_code, s.vehicle_plate_region, s.created_at
      from shipments s
      left join customers c on c.id = s.customer_id
      where s.status = ${status}
      order by s.created_at desc
      limit ${limit} offset ${offset}
    ` as Shipment[];
    
    const countResult = await sql`
      select count(*)::int as count from shipments where status = ${status}
    ` as [{ count: number }];
    
    total = countResult[0]?.count || 0;
  } else {
    shipments = await sql`
      select 
        s.id, s.customer_id, c.name as customer_name,
        s.origin, s.destination, s.eta, s.status, s.total_colli, s.public_code, s.vehicle_plate_region, s.created_at
      from shipments s
      left join customers c on c.id = s.customer_id
      order by s.created_at desc
      limit ${limit} offset ${offset}
    ` as Shipment[];
    
    const countResult = await sql`
      select count(*)::int as count from shipments
    ` as [{ count: number }];
    
    total = countResult[0]?.count || 0;
  }
  
  return Response.json({
    items: shipments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}
