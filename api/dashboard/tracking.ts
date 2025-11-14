export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';

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
  
  const sql = getSql();
  
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
}
