export const config = { runtime: 'nodejs20.x' };

import { getSql } from '../_lib/db';

type CreateShipmentBody = {
  customer_id?: number;
  origin: string;
  destination: string;
  eta?: string;
  status?: string;
  total_colli?: number;
  vehicle_plate_region?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  
  const sql = getSql();
  let body: CreateShipmentBody;
  
  try {
    body = await req.json() as CreateShipmentBody;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  
  if (!body.origin || !body.destination) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  const originCity = await sql`select code from cities where name = ${body.origin}` as [{ code: string }?];
  const destCity = await sql`select code from cities where name = ${body.destination}` as [{ code: string }?];
  const deriveCode = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0,3).toUpperCase().padEnd(3,'X');
  const originCode = originCity[0]?.code || deriveCode(body.origin);
  const destCode = destCity[0]?.code || deriveCode(body.destination);
  
  const countResult = await sql`
    select count(*)::int as count from shipments
  ` as [{ count: number }];
  
  const nextNum = (countResult[0]?.count || 0) + 1;
  const plateRegion = body.vehicle_plate_region?.trim().toUpperCase() || 'XX';
  const publicCode = `${originCode}-${destCode}-${String(nextNum).padStart(3, '0')}-${plateRegion}`;
  
  const result = await sql`
    insert into shipments (
      customer_id, origin, destination, eta, status, total_colli, vehicle_plate_region, public_code, created_at
    ) values (
      ${body.customer_id || null},
      ${body.origin},
      ${body.destination},
      ${body.eta || null},
      ${body.status || 'DRAFT'},
      ${body.total_colli || 0},
      ${plateRegion},
      ${publicCode},
      now()
    )
    returning id
  ` as [{ id: number }];
  
  return Response.json({ id: result[0].id, public_code: publicCode }, { status: 201 });
}
