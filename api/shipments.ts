export const config = { runtime: 'nodejs' };

import { getSql } from '../lib/db';

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

type CreateShipmentBody = {
  customer_id?: number;
  customer_name?: string;
  origin: string;
  destination: string;
  eta?: string;
  total_colli: number;
  vehicle_plate_region?: string;
};

type UpdateShipmentBody = {
  id: number;
  customer_id?: number;
  customer_name?: string;
  origin?: string;
  destination?: string;
  eta?: string;
  status?: string;
  total_colli?: number;
  vehicle_plate_region?: string;
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

  const sql = getSql();

  if (endpoint === 'list' && req.method === 'GET') {
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
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateShipmentBody;
    
    try {
      body = await req.json() as CreateShipmentBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    if (!body.origin || !body.destination || !body.total_colli) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    let customerId = body.customer_id || null;
    let customerName = body.customer_name || null;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) return Response.json({ error: 'Invalid customer_id' }, { status: 400 });
      customerName = c[0].name;
    }
    
    const result = await sql`
      insert into shipments (
        customer_id, customer_name, origin, destination, eta, status, total_colli, vehicle_plate_region, created_at
      ) values (
        ${customerId},
        ${customerName},
        ${body.origin},
        ${body.destination},
        ${body.eta || null},
        'DRAFT',
        ${body.total_colli},
        ${body.vehicle_plate_region || null},
        now()
      )
      returning id
    ` as [{ id: number }];
    
    return Response.json({ id: result[0].id }, { status: 201 });
  } else if (endpoint === 'update' && req.method === 'PUT') {
    let body: UpdateShipmentBody;
    
    try {
      body = await req.json() as UpdateShipmentBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    if (!body.id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    
    let customerName = body.customer_name;
    let customerId = body.customer_id;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) return Response.json({ error: 'Invalid customer_id' }, { status: 400 });
      customerName = c[0].name;
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (customerId !== undefined) { sets.push(`customer_id = $${sets.length + 1}`); params.push(customerId); }
    if (customerName !== undefined) { sets.push(`customer_name = $${sets.length + 1}`); params.push(customerName); }
    if (body.origin) { sets.push(`origin = $${sets.length + 1}`); params.push(body.origin); }
    if (body.destination) { sets.push(`destination = $${sets.length + 1}`); params.push(body.destination); }
    if (body.eta !== undefined) { sets.push(`eta = $${sets.length + 1}`); params.push(body.eta); }
    if (body.status) { sets.push(`status = $${sets.length + 1}`); params.push(body.status); }
    if (body.total_colli !== undefined) { sets.push(`total_colli = $${sets.length + 1}`); params.push(body.total_colli); }
    if (body.vehicle_plate_region !== undefined) { sets.push(`vehicle_plate_region = $${sets.length + 1}`); params.push(body.vehicle_plate_region); }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    const updateSql = `update shipments set ${sets.join(', ')} where id = $${sets.length + 1}`;
    params.push(body.id);
    await sql(updateSql, params);
    
    return Response.json({ success: true });
  } else if (endpoint === 'delete' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    
    await sql`delete from shipments where id = ${parseInt(id)}`;
    
    return Response.json({ success: true });
  } else {
    return new Response(null, { status: 404 });
  }
}