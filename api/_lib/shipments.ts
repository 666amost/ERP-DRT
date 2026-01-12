import { getSql } from './db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './http.js';

type Shipment = {
  id: number;
  spb_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_address: string | null;
  sender_name: string | null;
  sender_address: string | null;
  pengirim_name: string | null;
  penerima_name: string | null;
  penerima_phone: string | null;
  origin: string;
  origin_province: string | null;
  destination: string;
  destination_province: string | null;
  eta: string | null;
  status: string;
  total_colli: number;
  qty: number;
  satuan: string | null;
  berat: number;
  macam_barang: string | null;
  nominal: number;
  public_code: string | null;
  vehicle_plate_region: string | null;
  shipping_address: string | null;
  service_type: string | null;
  jenis: string | null;
  dbl_id: number | null;
  invoice_generated: boolean;
  keterangan: string | null;
  created_at: string;
  sj_returned: boolean;
  sj_returned_at?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate?: string | null;
  dbl_number?: string | null;
  dbl_status?: string | null;
};

type CreateShipmentBody = {
  spb_number?: string;
  customer_id?: number;
  customer_name?: string;
  customer_address?: string;
  sender_name?: string;
  sender_address?: string;
  pengirim_name?: string;
  penerima_name?: string;
  penerima_phone?: string;
  origin: string;
  destination: string;
  eta?: string;
  status?: string;
  total_colli: number;
  qty?: number;
  satuan?: string;
  berat?: number;
  macam_barang?: string;
  nominal?: number;
  vehicle_plate_region?: string;
  shipping_address?: string;
  regenerate_code?: boolean;
  service_type?: string;
  jenis?: string;
  keterangan?: string;
  sj_returned?: boolean;
};

type UpdateShipmentBody = {
  id: number;
  spb_number?: string;
  customer_id?: number;
  customer_name?: string;
  customer_address?: string;
  sender_name?: string;
  sender_address?: string;
  pengirim_name?: string;
  penerima_name?: string;
  penerima_phone?: string;
  origin?: string;
  destination?: string;
  eta?: string;
  status?: string;
  total_colli?: number;
  qty?: number;
  satuan?: string;
  berat?: number;
  macam_barang?: string;
  nominal?: number;
  vehicle_plate_region?: string;
  shipping_address?: string;
  regenerate_code?: boolean;
  service_type?: string;
  jenis?: string;
  keterangan?: string;
  sj_returned?: boolean;
  sj_returned_at?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function isValidDate(val?: string | null): val is string {
  return Boolean(val && /^\d{4}-\d{2}-\d{2}$/.test(val));
}

function escapeSqlLiteral(val: string): string {
  return val.replace(/'/g, "''");
}

function generatePublicCode(plateRegion: string, destination: string, totalColli: number, sequence: number): string {
  const plate = (plateRegion || 'XX').toUpperCase().substring(0, 2).padEnd(2, 'X');
  const seq = String(sequence).padStart(4, '0');
  const destCode = destination.toUpperCase().substring(0, 3).padEnd(3, 'X');
  const colli = String(totalColli).padStart(2, '0').substring(0, 2);
  return `STE-${plate}${seq}${destCode}${colli}`;
}

export async function shipmentsHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
    const sql = getSql();

    if (endpoint === 'list' && req.method === 'GET') {
      const DEFAULT_LIMIT = 50;
      const MAX_LIMIT = 5000;

      const page = clampInt(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1, 1_000_000);
      const searchQuery = escapeSqlLiteral(String(url.searchParams.get('search') || '').trim());
      const limit = clampInt(parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1, MAX_LIMIT);
      const status = url.searchParams.get('status');
      const days = clampInt(parseInt(url.searchParams.get('days') || '0', 10) || 0, 0, 3650);
      const dbl = (url.searchParams.get('dbl') || '').toLowerCase();

      const startDateRaw = url.searchParams.get('start_date') || url.searchParams.get('date_from') || url.searchParams.get('from');
      const endDateRaw = url.searchParams.get('end_date') || url.searchParams.get('date_to') || url.searchParams.get('to');
      const startDate = isValidDate(startDateRaw) ? startDateRaw : null;
      const endDate = isValidDate(endDateRaw) ? endDateRaw : null;

      const serviceTypeRaw = url.searchParams.get('service_type');
      const jenisRaw = url.searchParams.get('jenis');
      const serviceType = serviceTypeRaw && /^[a-z0-9_]{1,20}$/i.test(serviceTypeRaw) ? escapeSqlLiteral(serviceTypeRaw.toUpperCase()) : null;
      const jenis = jenisRaw && /^[a-z0-9_]{1,20}$/i.test(jenisRaw) ? escapeSqlLiteral(jenisRaw.toUpperCase()) : null;

      const offset = (page - 1) * limit;

      let shipments: Shipment[];
      let total: number;

      const whereConditions: string[] = [];

      if (status && ['DRAFT', 'READY', 'LOADING', 'IN_TRANSIT', 'DELIVERED'].includes(status)) {
        whereConditions.push(`s.status = '${status}'`);
      }

      if (days > 0) {
        whereConditions.push(`s.created_at >= current_date - interval '${days} days'`);
      }

      if (startDate) {
        whereConditions.push(`s.created_at >= '${startDate}'::date`);
      }

      if (endDate) {
        whereConditions.push(`s.created_at < ('${endDate}'::date + interval '1 day')`);
      }

      if (serviceType) {
        whereConditions.push(`upper(coalesce(s.service_type, '')) = '${serviceType}'`);
      }

      if (jenis) {
        whereConditions.push(`upper(coalesce(s.jenis, '')) = '${jenis}'`);
      }

      if (dbl === 'loaded') {
        whereConditions.push('s.dbl_id is not null');
      } else if (dbl === 'unloaded') {
        whereConditions.push('s.dbl_id is null');
      }

      if (searchQuery) {
        const searchTerm = '%' + searchQuery + '%';
        whereConditions.push(`(
          s.public_code ilike '${searchTerm}' or
          s.spb_number ilike '${searchTerm}' or
          coalesce(s.customer_name, c.name) ilike '${searchTerm}' or
          s.pengirim_name ilike '${searchTerm}' or
          s.penerima_name ilike '${searchTerm}' or
          s.origin ilike '${searchTerm}' or
          s.destination ilike '${searchTerm}' or
          s.macam_barang ilike '${searchTerm}' or
          d.dbl_number ilike '${searchTerm}' or
          d.driver_name ilike '${searchTerm}'
        )`);
      }

      const whereClause = whereConditions.length > 0 ? 'where ' + whereConditions.join(' and ') : '';

      const query = `
        select 
          s.id, s.spb_number, s.customer_id,
          coalesce(s.customer_name, c.name) as customer_name,
          coalesce(s.customer_address, c.address) as customer_address,
          s.sender_name, s.sender_address, s.pengirim_name, s.penerima_name, s.penerima_phone,
          s.origin, co.province as origin_province, s.destination, cd.province as destination_province, 
          s.eta, s.status, s.total_colli, s.qty, s.satuan, 
          coalesce(s.berat, 0)::float as berat, s.macam_barang, 
          coalesce(s.nominal, 0)::float as nominal, s.public_code, s.vehicle_plate_region, 
          s.shipping_address, s.service_type, s.jenis, s.dbl_id, coalesce(s.invoice_generated, false) as invoice_generated, 
          coalesce(s.sj_returned, false) as sj_returned, s.sj_returned_at,
          s.keterangan, s.created_at,
          d.dbl_number, d.driver_name, d.driver_phone, 
          d.vehicle_plate, d.status as dbl_status
        from shipments s
        left join customers c on c.id = s.customer_id
        left join dbl d on d.id = s.dbl_id
        left join cities co on lower(co.name) = lower(s.origin)
        left join cities cd on lower(cd.name) = lower(s.destination)
        ${whereClause}
        order by s.created_at desc
        limit ${limit} offset ${offset}
      ` as string;

      shipments = await sql(query as never) as Shipment[];

      const countQuery = `
        select count(*)::int as count 
        from shipments s
        left join customers c on c.id = s.customer_id
        left join dbl d on d.id = s.dbl_id
        ${whereClause}
      ` as string;

      const countResult = await sql(countQuery as never) as [{ count: number }];
      total = countResult[0]?.count || 0;

      writeJson(res, {
        items: shipments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
      return
    } else if (endpoint === 'create' && req.method === 'POST') {
      let body: CreateShipmentBody;
      try { 
        body = await readJsonNode(req) as CreateShipmentBody 
      } catch (e) { 
        console.error('[shipments/create] JSON parse error:', e);
        writeJson(res, { error: 'Invalid JSON', details: String(e) }, 400); 
        return 
      }
      if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return }

      if (!body.origin || !body.destination || !body.total_colli) { 
        console.error('[shipments/create] Validation error - missing fields:', { origin: body.origin, destination: body.destination, total_colli: body.total_colli });
        writeJson(res, { error: 'Missing required fields: origin, destination, total_colli' }, 400); 
        return 
      }

      let customerId = body.customer_id || null;
      let customerName = body.customer_name || null;
      let customerAddress = body.customer_address || null;
      let shippingAddress = body.shipping_address || null;
      
      try {
        if (!customerName && customerId) {
          const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
          if (!c.length) { 
            console.error('[shipments/create] Customer not found:', customerId);
            writeJson(res, { error: 'Invalid customer_id' }, 400); 
            return 
          }
          customerName = c[0].name;
        }
        if (!customerAddress && customerId) {
          const ca = await sql`select address from customers where id = ${customerId}` as [{ address: string }];
          customerAddress = ca[0]?.address || null;
        }
        
        if (customerName) {
          const existingCust = await sql`select id from customers where lower(name) = lower(${customerName}) limit 1` as { id: number }[];
          if (existingCust.length > 0) {
            customerId = existingCust[0]!.id;
          } else {
            const inserted = await sql`insert into customers (name, address) values (${customerName}, ${customerAddress}) returning id` as { id: number }[];
            customerId = inserted[0]!.id;
          }
        }

        const seqResult = await sql`select coalesce(max(id), 0) + 1 as next_seq from shipments` as [{ next_seq: number }];
        const nextSeq = seqResult[0]!.next_seq || 1;
        const publicCode = generatePublicCode(
          body.vehicle_plate_region || 'XX',
          body.destination,
          body.total_colli,
          nextSeq
        );

        const result = await sql`
          insert into shipments (
          spb_number, customer_id, customer_name, customer_address,
          sender_name, sender_address, pengirim_name, penerima_name, penerima_phone,
          origin, destination, eta, status, total_colli, qty, satuan, berat,
          macam_barang, nominal, public_code, vehicle_plate_region, shipping_address,
          service_type, jenis, keterangan
        ) values (
          ${body.spb_number || null},
          ${customerId},
          ${customerName},
          ${customerAddress},
          ${body.sender_name || null},
          ${body.sender_address || null},
          ${body.pengirim_name || null},
          ${body.penerima_name || null},
          ${body.penerima_phone || null},
          ${body.origin},
          ${body.destination},
          ${body.eta || null},
          ${body.status || 'READY'},
          ${body.total_colli},
          ${body.qty || 0},
          ${body.satuan || null},
          ${body.berat || 0},
          ${body.macam_barang || null},
          ${body.nominal || 0},
          ${publicCode},
          ${body.vehicle_plate_region || null},
          ${shippingAddress},
          ${body.service_type || null},
          ${body.jenis || null},
          ${body.keterangan || null}
        ) returning id
        ` as [{ id: number }];

        writeJson(res, { id: result[0].id, public_code: publicCode });
        return
      } catch (dbError) {
        const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
        const errStack = dbError instanceof Error ? dbError.stack : '';
        console.error('[shipments/create] Database error:', errMsg);
        console.error('[shipments/create] Stack:', errStack);
        console.error('[shipments/create] Body:', JSON.stringify(body));
        writeJson(res, { error: 'Database error during insert', details: errMsg }, 500);
        return
      }
    } else if (endpoint === 'update' && req.method === 'PUT') {
      let body: UpdateShipmentBody;
      try { 
        body = await readJsonNode(req) as UpdateShipmentBody 
      } catch (e) { 
        console.error('[shipments/update] JSON parse error:', e);
        writeJson(res, { error: 'Invalid JSON', details: String(e) }, 400); 
        return 
      }
      if (!body || !body.id) { 
        console.error('[shipments/update] Missing id:', body);
        writeJson(res, { error: 'Missing id' }, 400); 
        return 
      }

      try {
        const existingRows = await sql`select * from shipments where id = ${body.id}` as Shipment[];
        if (!existingRows.length || !existingRows[0]) {
          writeJson(res, { error: 'Shipment not found' }, 404);
          return;
        }
        const existing: Shipment = existingRows[0];

        let newPublicCode: string | null = null;
        if (body.regenerate_code) {
          const plate = body.vehicle_plate_region ?? existing.vehicle_plate_region ?? 'XX';
          const dest = body.destination ?? existing.destination;
          const colli = body.total_colli ?? existing.total_colli;
          newPublicCode = generatePublicCode(plate, dest, colli, body.id);
        }

        const spbNumber = body.spb_number !== undefined ? body.spb_number : existing.spb_number;
        let customerId = body.customer_id !== undefined ? body.customer_id : existing.customer_id;
        let customerName = body.customer_name !== undefined ? body.customer_name : existing.customer_name;
        let customerAddress = body.customer_address !== undefined ? body.customer_address : existing.customer_address;
        
        if (customerName) {
          const existingCust = await sql`select id, name from customers where lower(name) = lower(${customerName}) limit 1` as { id: number; name: string }[];
          if (existingCust.length > 0) {
            customerId = existingCust[0]!.id;
          } else {
            const inserted = await sql`insert into customers (name, address) values (${customerName}, ${customerAddress}) returning id` as { id: number }[];
            customerId = inserted[0]!.id;
          }
        }
        
        const senderName = body.sender_name !== undefined ? body.sender_name : existing.sender_name;
        const senderAddress = body.sender_address !== undefined ? body.sender_address : existing.sender_address;
        const pengirimName = body.pengirim_name !== undefined ? body.pengirim_name : existing.pengirim_name;
        const penerimaName = body.penerima_name !== undefined ? body.penerima_name : existing.penerima_name;
        const penerimaPhone = body.penerima_phone !== undefined ? body.penerima_phone : existing.penerima_phone;
        const origin = body.origin !== undefined ? body.origin : existing.origin;
        const destination = body.destination !== undefined ? body.destination : existing.destination;
        const eta = body.eta !== undefined ? body.eta : existing.eta;
        const status = body.status !== undefined ? body.status : existing.status;
        const totalColli = body.total_colli !== undefined ? body.total_colli : existing.total_colli;
        const qty = body.qty !== undefined ? body.qty : existing.qty;
        const satuan = body.satuan !== undefined ? body.satuan : existing.satuan;
        const berat = body.berat !== undefined ? body.berat : existing.berat;
        const macamBarang = body.macam_barang !== undefined ? body.macam_barang : existing.macam_barang;
        const nominal = body.nominal !== undefined ? body.nominal : existing.nominal;
        const vehiclePlateRegion = body.vehicle_plate_region !== undefined ? body.vehicle_plate_region : existing.vehicle_plate_region;
        const shippingAddress = body.shipping_address !== undefined ? body.shipping_address : existing.shipping_address;
        const serviceType = body.service_type !== undefined ? body.service_type : existing.service_type;
        const jenis = body.jenis !== undefined ? body.jenis : existing.jenis;
        const keterangan = body.keterangan !== undefined ? body.keterangan : existing.keterangan;
        const publicCode = newPublicCode !== null ? newPublicCode : existing.public_code;
        const sjReturned = body.sj_returned !== undefined ? body.sj_returned : existing.sj_returned;
        let sjReturnedAt = existing.sj_returned_at;
        if (body.sj_returned === true && !existing.sj_returned) {
          sjReturnedAt = new Date().toISOString();
        } else if (body.sj_returned === false) {
          sjReturnedAt = null;
        } else if (body.sj_returned_at !== undefined) {
          sjReturnedAt = body.sj_returned_at;
        }

        await sql`
          update shipments set
            spb_number = ${spbNumber},
            customer_id = ${customerId},
            customer_name = ${customerName},
            customer_address = ${customerAddress},
            sender_name = ${senderName},
            sender_address = ${senderAddress},
            pengirim_name = ${pengirimName},
            penerima_name = ${penerimaName},
            penerima_phone = ${penerimaPhone},
            origin = ${origin},
            destination = ${destination},
            eta = ${eta},
            status = ${status},
            total_colli = ${totalColli},
            qty = ${qty},
            satuan = ${satuan},
            berat = ${berat},
            macam_barang = ${macamBarang},
            nominal = ${nominal},
            vehicle_plate_region = ${vehiclePlateRegion},
            shipping_address = ${shippingAddress},
            service_type = ${serviceType},
            jenis = ${jenis},
            keterangan = ${keterangan},
            public_code = ${publicCode},
            sj_returned = ${sjReturned},
            sj_returned_at = ${sjReturned ? sjReturnedAt || new Date().toISOString() : null},
            updated_at = now()
          where id = ${body.id}
        `;

        writeJson(res, { success: true, public_code: newPublicCode });
        return
      } catch (dbError) {
        const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
        const errStack = dbError instanceof Error ? dbError.stack : '';
        console.error('[shipments/update] Database error:', errMsg);
        console.error('[shipments/update] Stack:', errStack);
        console.error('[shipments/update] Body:', JSON.stringify(body));
        writeJson(res, { error: 'Database error during update', details: errMsg }, 500);
        return
      }
    } else if (endpoint === 'all-unpaid' && req.method === 'GET') {
      const filterType = url.searchParams.get('filter_type') || 'penerima';
      
      try {
        const query = `
          select 
            s.id, s.spb_number, s.public_code as tracking_code, 
            s.customer_id, 
            ${filterType === 'pengirim'
              ? "coalesce(s.pengirim_name, s.customer_name, c.name, 'Tanpa Customer') as customer_name"
              : "coalesce(s.customer_name, c.name, 'Tanpa Customer') as customer_name"
            },
            s.pengirim_name,
            s.dbl_id, d.dbl_number, d.driver_name, d.driver_phone,
            d.vehicle_plate, d.dbl_date::date as dbl_date,
            s.macam_barang as description,
            coalesce(s.berat, 0)::float as weight,
            coalesce(s.qty, 1)::int as qty,
            s.satuan as unit,
            s.total_colli,
            s.penerima_name as recipient_name,
            s.shipping_address as recipient_address,
            s.destination as destination_city,
            coalesce(s.nominal, 0)::float as amount,
            coalesce(s.sj_returned, false) as sj_returned,
            s.sj_returned_at,
            s.created_at,
            s.status
          from shipments s
          left join customers c on c.id = s.customer_id
          left join dbl d on d.id = s.dbl_id
          left join invoice_items ii on ii.shipment_id = s.id
          left join invoices i on i.id = ii.invoice_id
          where s.nominal > 0
            and (i.id is null or i.status = 'cancelled')
          order by s.created_at desc
        `;

        const shipments = await sql(query as never) as unknown[];
        writeJson(res, { shipments });
        return;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : '';
        console.error('[shipments/all-unpaid] Error:', errMsg);
        console.error('[shipments/all-unpaid] Stack:', errStack);
        writeJson(res, { error: 'Failed to load unpaid shipments', details: errMsg }, 500);
        return;
      }

    } else if (endpoint === 'delete' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) { writeJson(res, { error: 'Missing id' }, 400); return }

      await sql`delete from shipments where id = ${parseInt(id)}`;
      writeJson(res, { success: true });
      return
    }

    writeJson(res, { error: 'Invalid endpoint' }, 404);
  } catch (err) {
    console.error('[shipments] Unhandled error:', err);
    writeJson(res, { error: 'Internal server error', details: String(err) }, 500);
  }
}
