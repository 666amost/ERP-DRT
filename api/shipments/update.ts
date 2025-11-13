export const config = { runtime: 'nodejs' };

import { getSql } from '../_lib/db';

type UpdateShipmentBody = {
  id: number;
  origin?: string;
  destination?: string;
  eta?: string;
  status?: string;
  total_colli?: number;
  customer_id?: number;
  vehicle_plate_region?: string;
  regenerate_code?: boolean;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'PUT') return new Response(null, { status: 405 });
  
  const sql = getSql();
  let body: UpdateShipmentBody;
  
  try {
    body = await req.json() as UpdateShipmentBody;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  
  if (!body.id) {
    return Response.json({ error: 'Missing id' }, { status: 400 });
  }
  
  const existing = await sql`select public_code, origin, destination, vehicle_plate_region from shipments where id = ${body.id}` as [{ public_code: string|null; origin:string; destination:string; vehicle_plate_region:string|null }];
  if (!existing[0]) return Response.json({ error: 'Not found' }, { status: 404 });
  let newCode = existing[0].public_code;
  if (body.regenerate_code && (body.origin || body.destination || body.vehicle_plate_region)) {
    const originName = body.origin || existing[0].origin;
    const destName = body.destination || existing[0].destination;
    const originCity = await sql`select code from cities where name = ${originName}` as [{ code:string }?];
    const destCity = await sql`select code from cities where name = ${destName}` as [{ code:string }?];
    const deriveCode = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0,3).toUpperCase().padEnd(3,'X');
    const originCode = originCity[0]?.code || deriveCode(originName);
    const destCode = destCity[0]?.code || deriveCode(destName);
    const numPart = existing[0].public_code?.split('-')[2] || '001';
    const plate = (body.vehicle_plate_region || existing[0].vehicle_plate_region || 'XX').toUpperCase().slice(0,2);
    newCode = `${originCode}-${destCode}-${numPart}-${plate}`;
  }
  await sql`
    update shipments
    set origin = coalesce(${body.origin || null}, origin),
        destination = coalesce(${body.destination || null}, destination),
        status = coalesce(${body.status || null}, status),
        eta = coalesce(${body.eta || null}, eta),
        total_colli = coalesce(${body.total_colli || null}, total_colli),
        customer_id = coalesce(${body.customer_id || null}, customer_id),
        vehicle_plate_region = coalesce(${body.vehicle_plate_region || null}, vehicle_plate_region),
        public_code = ${newCode}
    where id = ${body.id}
  `;
  return Response.json({ success: true, public_code: newCode });
  
  return Response.json({ success: true });
}
