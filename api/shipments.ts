export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

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
  regenerate_code?: boolean;
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
  regenerate_code?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

// use writeJson helper

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
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
    
    writeJson(res, {
      items: shipments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    return;
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateShipmentBody;
    
    try { body = await readJsonNode(req) as CreateShipmentBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.origin || !body.destination || !body.total_colli) { writeJson(res, { error: 'Missing required fields' }, 400); return; }
    
    let customerId = body.customer_id || null;
    let customerName = body.customer_name || null;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }
    
    // Generate a public_code based on origin/destination city codes if possible, else fallback to TRK-xxx
    let publicCode: string | null = null;
    if (body.regenerate_code !== false) {
      // lookup city codes
      const originRow = await sql`select code from cities where name = ${body.origin}` as [{ code: string }?];
      const destRow = await sql`select code from cities where name = ${body.destination}` as [{ code: string }?];
      const originCode = originRow[0]?.code;
      const destCode = destRow[0]?.code;
      const region = (body.vehicle_plate_region || 'XX').toUpperCase();
      if (originCode && destCode) {
        const likePattern = `${originCode}-${destCode}-%`;
        const countRes = await sql`select count(*)::int as count from shipments where public_code like ${likePattern}` as [{ count: number }];
        const nextNum = (countRes[0]?.count || 0) + 1;
        publicCode = `${originCode}-${destCode}-${String(nextNum).padStart(3, '0')}-${region}`;
      } else {
        const countRes = await sql`select count(*)::int as count from shipments where public_code like 'TRK-%'` as [{ count: number }];
        const nextNum = (countRes[0]?.count || 0) + 1;
        publicCode = `TRK-${String(nextNum).padStart(3, '0')}`;
      }
    }
    const result = await sql`
      insert into shipments (
        customer_id, customer_name, public_code, origin, destination, eta, status, total_colli, vehicle_plate_region, created_at
      ) values (
        ${customerId},
        ${customerName},
        ${publicCode},
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
    
    writeJson(res, { id: result[0].id }, 201);
    return;
  } else if (endpoint === 'update' && req.method === 'PUT') {
    let body: UpdateShipmentBody;
    
    try { body = await readJsonNode(req) as UpdateShipmentBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.id) { writeJson(res, { error: 'Missing id' }, 400); return; }
    
    let customerName = body.customer_name;
    let customerId = body.customer_id;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
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
    // If regenerate_code is provided, generate a new code and include it
    if (body.regenerate_code) {
      // Determine origin/destination for code generation: updated values take precedence; otherwise fetch existing shipment
      let originForCode = body.origin;
      let destForCode = body.destination;
      if (!originForCode || !destForCode) {
        const existingRow = await sql`select origin, destination, vehicle_plate_region from shipments where id = ${body.id} limit 1` as Array<any>;
        if (existingRow && existingRow.length) {
          originForCode = originForCode || existingRow[0].origin;
          destForCode = destForCode || existingRow[0].destination;
          if (!body.vehicle_plate_region && existingRow[0].vehicle_plate_region) {
            body.vehicle_plate_region = existingRow[0].vehicle_plate_region;
          }
        }
      }
      const originRow = await sql`select code from cities where name = ${originForCode}` as [{ code: string }?];
      const destRow = await sql`select code from cities where name = ${destForCode}` as [{ code: string }?];
      const originCode = originRow[0]?.code;
      const destCode = destRow[0]?.code;
      const region = (body.vehicle_plate_region || 'XX').toUpperCase();
      if (originCode && destCode) {
        const likePattern = `${originCode}-${destCode}-%`;
        const countRes = await sql`select count(*)::int as count from shipments where public_code like ${likePattern}` as [{ count: number }];
        const nextNum = (countRes[0]?.count || 0) + 1;
        sets.push(`public_code = $${sets.length + 1}`);
        params.push(`${originCode}-${destCode}-${String(nextNum).padStart(3, '0')}-${region}`);
      } else {
        const countRes = await sql`select count(*)::int as count from shipments where public_code like 'TRK-%'` as [{ count: number }];
        const nextNum = (countRes[0]?.count || 0) + 1;
        sets.push(`public_code = $${sets.length + 1}`);
        params.push(`TRK-${String(nextNum).padStart(3, '0')}`);
      }
    }
    if (!sets.length) { writeJson(res, { error: 'No fields to update' }, 400); return; }
    params.push(body.id);
    
    const setClauses: string[] = [];
    let paramIndex = 0;
    if (customerId !== undefined) setClauses.push(`customer_id = ${params[paramIndex++]}`);
    if (customerName !== undefined) setClauses.push(`customer_name = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.origin) setClauses.push(`origin = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.destination) setClauses.push(`destination = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.eta !== undefined) setClauses.push(`eta = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.status) setClauses.push(`status = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.total_colli !== undefined) setClauses.push(`total_colli = ${params[paramIndex++]}`);
    if (body.vehicle_plate_region !== undefined) setClauses.push(`vehicle_plate_region = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.regenerate_code) setClauses.push(`public_code = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    
    const updateQuery = `UPDATE shipments SET ${setClauses.join(', ')} WHERE id = ${body.id}`;
    await sql(updateQuery as any);
    
    writeJson(res, { success: true });
    return;
  } else if (endpoint === 'delete' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    
    if (!id) { writeJson(res, { error: 'Missing id' }, 400); return; }
    
    await sql`delete from shipments where id = ${parseInt(id)}`;
    
    writeJson(res, { success: true });
    return;
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }
  } catch (error) {
    console.error('Shipments API error:', error);
    writeJson(res, { error: 'Internal server error' }, 500);
    return;
  }
}