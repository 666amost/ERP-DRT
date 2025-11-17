export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

type Shipment = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_address: string | null;
  sender_name: string | null;
  sender_address: string | null;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
  total_colli: number;
  public_code: string | null;
  vehicle_plate_region: string | null;
  shipping_address: string | null;
  service_type: string | null;
  created_at: string;
};

type CreateShipmentBody = {
  customer_id?: number;
  customer_name?: string;
  customer_address?: string;
  sender_name?: string;
  sender_address?: string;
  origin: string;
  destination: string;
  eta?: string;
  status?: string;
  total_colli: number;
  vehicle_plate_region?: string;
  shipping_address?: string;
  regenerate_code?: boolean;
  service_type?: string;
};

type UpdateShipmentBody = {
  id: number;
  customer_id?: number;
  customer_name?: string;
  customer_address?: string;
  sender_name?: string;
  sender_address?: string;
  origin?: string;
  destination?: string;
  eta?: string;
  status?: string;
  total_colli?: number;
  vehicle_plate_region?: string;
  shipping_address?: string;
  regenerate_code?: boolean;
  service_type?: string;
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
          s.id, s.customer_id,
          coalesce(s.customer_name, c.name) as customer_name,
          coalesce(s.customer_address, c.address) as customer_address,
          s.sender_name, s.sender_address,
          s.origin, s.destination, s.eta, s.status, s.total_colli, s.public_code, s.vehicle_plate_region, s.shipping_address, s.service_type, s.created_at
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
          s.id, s.customer_id,
          coalesce(s.customer_name, c.name) as customer_name,
          coalesce(s.customer_address, c.address) as customer_address,
          s.sender_name, s.sender_address,
          s.origin, s.destination, s.eta, s.status, s.total_colli, s.public_code, s.vehicle_plate_region, s.shipping_address, s.service_type, s.created_at
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
    let customerAddress = body.customer_address || null;
    let shippingAddress = body.shipping_address || null;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }
    if (!customerAddress && customerId) {
      const ca = await sql`select address from customers where id = ${customerId}` as [{ address: string }];
      customerAddress = ca[0]?.address || null;
    }
    if (!shippingAddress && customerId) {
      const sa = await sql`select address from customers where id = ${customerId}` as [{ address: string }];
      shippingAddress = sa[0]?.address || null;
    }
    
    // Generate public_code using new pattern: STE-<PLATE><DD><RND2><DESTCODE><COLLI2>
    // e.g. STE-DK1825DPS11 (DK=plate, 18=day, 25=random, DPS=dest code, 11=colli)
    let publicCode: string | null = null;
    if (body.regenerate_code !== false) {
      const plate = (body.vehicle_plate_region || 'XX').toUpperCase();
      const createdAt = new Date();
      const dd = String(createdAt.getDate()).padStart(2, '0');
      const rnd2 = String(Math.floor(Math.random() * 90) + 10);
      // try to fetch dest code
      const destRow = await sql`select code from cities where name = ${body.destination}` as [{ code: string }?];
      const destCode = (destRow[0]?.code || String(body.destination || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)).slice(0, 3);
      const colli2 = String(Math.max(0, Number(body.total_colli) || 0)).padStart(2, '0');
      publicCode = `STE-${plate}${dd}${rnd2}${destCode}${colli2}`;
    }
    const result = await sql`
      insert into shipments (
        customer_id, customer_name, sender_name, sender_address, public_code, origin, destination, eta, status, total_colli, vehicle_plate_region, customer_address, shipping_address, service_type, created_at
      ) values (
        ${customerId},
        ${customerName},
        ${body.sender_name || null},
        ${body.sender_address || null},
        ${publicCode},
        ${body.origin},
        ${body.destination},
        ${body.eta || null},
        ${body.status || 'DRAFT'},
        ${body.total_colli},
        ${body.vehicle_plate_region || null},
        ${customerAddress || null},
        ${shippingAddress || null},
        ${(body.service_type || 'REG').toUpperCase()},
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
    // keep undefined when not provided so we can detect presence vs absence
    let customerAddress = body.customer_address as string | undefined;
    let shippingAddress = body.shipping_address as string | undefined;
    let customerId = body.customer_id;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }
    if (!customerAddress && customerId) {
      const ca = await sql`select address from customers where id = ${customerId}` as [{ address: string }?];
      // prefer undefined if missing
      customerAddress = ca[0]?.address ?? undefined;
    }
    if (!shippingAddress && customerId) {
      const sa = await sql`select address from customers where id = ${customerId}` as [{ address: string }?];
      shippingAddress = sa[0]?.address ?? undefined;
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (customerId !== undefined) { sets.push(`customer_id = $${sets.length + 1}`); params.push(customerId); }
    if (customerName !== undefined) { sets.push(`customer_name = $${sets.length + 1}`); params.push(customerName); }
    if (customerAddress !== undefined) { sets.push(`customer_address = $${sets.length + 1}`); params.push(customerAddress); }
    if (shippingAddress !== undefined) { sets.push(`shipping_address = $${sets.length + 1}`); params.push(shippingAddress); }
    if (body.sender_name !== undefined) { sets.push(`sender_name = $${sets.length + 1}`); params.push(body.sender_name); }
    if (body.sender_address !== undefined) { sets.push(`sender_address = $${sets.length + 1}`); params.push(body.sender_address); }
    if (body.origin) { sets.push(`origin = $${sets.length + 1}`); params.push(body.origin); }
    if (body.destination) { sets.push(`destination = $${sets.length + 1}`); params.push(body.destination); }
    if (body.eta !== undefined) { sets.push(`eta = $${sets.length + 1}`); params.push(body.eta); }
    if (body.status) { sets.push(`status = $${sets.length + 1}`); params.push(body.status); }
    if (body.total_colli !== undefined) { sets.push(`total_colli = $${sets.length + 1}`); params.push(body.total_colli); }
    if (body.vehicle_plate_region !== undefined) { sets.push(`vehicle_plate_region = $${sets.length + 1}`); params.push(body.vehicle_plate_region); }
    if (body.service_type !== undefined) { sets.push(`service_type = $${sets.length + 1}`); params.push((body.service_type || 'REG').toUpperCase()); }
    // If regenerate_code is provided, generate a new code and include it
    if (body.regenerate_code) {
      // Generate new pattern: STE-<PLATE><DD><RND2><DESTCODE><COLLI2>
      // determine plate: prefer provided, otherwise fetch existing
      let plateVal = body.vehicle_plate_region as string | undefined;
      if (!plateVal) {
        try {
          const existingPlate = await sql`select vehicle_plate_region from shipments where id = ${body.id} limit 1` as Array<any>;
          if (existingPlate && existingPlate.length && existingPlate[0].vehicle_plate_region) plateVal = existingPlate[0].vehicle_plate_region;
        } catch { /* ignore */ }
      }
      const plate = (plateVal || 'XX').toUpperCase();
      // attempt to get created_at of existing shipment to use as date; fall back to now
      let createdAtForCode = new Date();
      try {
        const existing = await sql`select created_at from shipments where id = ${body.id} limit 1` as Array<any>;
        if (existing && existing.length && existing[0].created_at) createdAtForCode = new Date(existing[0].created_at);
      } catch { /* ignore */ }
      const dd = String(createdAtForCode.getDate()).padStart(2, '0');
      const rnd2 = String(Math.floor(Math.random() * 90) + 10);
      // determine destination for code: prefer provided destination, otherwise fetch existing
      let destForCode = body.destination as string | undefined;
      if (!destForCode) {
        try {
          const existingDest = await sql`select destination from shipments where id = ${body.id} limit 1` as Array<any>;
          if (existingDest && existingDest.length && existingDest[0].destination) destForCode = existingDest[0].destination;
        } catch { /* ignore */ }
      }
      const destRow2 = await sql`select code from cities where name = ${destForCode}` as [{ code: string }?];
      const destCode2 = (destRow2[0]?.code || String(destForCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)).slice(0, 3);
      // determine colli: prefer provided total_colli, otherwise fetch existing value
      let colliVal = body.total_colli as number | undefined;
      if (colliVal === undefined) {
        try {
          const ex = await sql`select total_colli from shipments where id = ${body.id} limit 1` as Array<any>;
          colliVal = ex && ex[0] ? ex[0].total_colli : 0;
        } catch { colliVal = 0; }
      }
      const colli2 = String(Math.max(0, Number(colliVal) || 0)).padStart(2, '0');
      const newCode = `STE-${plate}${dd}${rnd2}${destCode2}${colli2}`;
      sets.push(`public_code = $${sets.length + 1}`);
      params.push(newCode);
    }
    if (!sets.length) { writeJson(res, { error: 'No fields to update' }, 400); return; }
    params.push(body.id);
    
    const setClauses: string[] = [];
    let paramIndex = 0;
    if (customerId !== undefined) setClauses.push(`customer_id = ${params[paramIndex++]}`);
    if (customerName !== undefined) setClauses.push(`customer_name = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (customerAddress !== undefined) setClauses.push(`customer_address = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (shippingAddress !== undefined) setClauses.push(`shipping_address = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.sender_name !== undefined) setClauses.push(`sender_name = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.sender_address !== undefined) setClauses.push(`sender_address = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.origin) setClauses.push(`origin = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.destination) setClauses.push(`destination = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.eta !== undefined) setClauses.push(`eta = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.status) setClauses.push(`status = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.total_colli !== undefined) setClauses.push(`total_colli = ${params[paramIndex++]}`);
    if (body.vehicle_plate_region !== undefined) setClauses.push(`vehicle_plate_region = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
    if (body.service_type !== undefined) setClauses.push(`service_type = '${String(params[paramIndex++]).replace(/'/g, "''")}'`);
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