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
  destination: string;
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
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

export async function shipmentsHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return }

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
            s.id, s.spb_number, s.customer_id,
            coalesce(s.customer_name, c.name) as customer_name,
            coalesce(s.customer_address, c.address) as customer_address,
            s.sender_name, s.sender_address, s.pengirim_name, s.penerima_name, s.penerima_phone,
            s.origin, s.destination, s.eta, s.status, s.total_colli, s.qty, s.satuan, 
            coalesce(s.berat, 0)::float as berat, s.macam_barang, 
            coalesce(s.nominal, 0)::float as nominal, s.public_code, s.vehicle_plate_region, 
            s.shipping_address, s.service_type, s.jenis, s.dbl_id, coalesce(s.invoice_generated, false) as invoice_generated, 
            s.keterangan, s.created_at
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
            s.id, s.spb_number, s.customer_id,
            coalesce(s.customer_name, c.name) as customer_name,
            coalesce(s.customer_address, c.address) as customer_address,
            s.sender_name, s.sender_address, s.pengirim_name, s.penerima_name, s.penerima_phone,
            s.origin, s.destination, s.eta, s.status, s.total_colli, s.qty, s.satuan,
            coalesce(s.berat, 0)::float as berat, s.macam_barang, 
            coalesce(s.nominal, 0)::float as nominal, s.public_code, s.vehicle_plate_region, 
            s.shipping_address, s.service_type, s.jenis, s.dbl_id, coalesce(s.invoice_generated, false) as invoice_generated, 
            s.keterangan, s.created_at
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
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
      return
    } else if (endpoint === 'create' && req.method === 'POST') {
      let body: CreateShipmentBody;
      try { body = await readJsonNode(req) as CreateShipmentBody } catch { body = null as any }
      if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return }

      if (!body.origin || !body.destination || !body.total_colli) { writeJson(res, { error: 'Missing required fields' }, 400); return }

      let customerId = body.customer_id || null;
      let customerName = body.customer_name || null;
      let customerAddress = body.customer_address || null;
      let shippingAddress = body.shipping_address || null;
      if (!customerName && customerId) {
        const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
        if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return }
        customerName = c[0].name;
      }
      if (!customerAddress && customerId) {
        const ca = await sql`select address from customers where id = ${customerId}` as [{ address: string }];
        customerAddress = ca[0]?.address || null;
      }

      const regenerateCode = Boolean(body.regenerate_code);
      let publicCode: string | null = null;
      if (regenerateCode || !body.spb_number) {
        const gen = await sql`select generate_public_code() as code` as [{ code: string }];
        publicCode = gen[0]?.code || null;
      }

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
    } else if (endpoint === 'update' && req.method === 'PUT') {
      let body: UpdateShipmentBody;
      try { body = await readJsonNode(req) as UpdateShipmentBody } catch { body = null as any }
      if (!body || !body.id) { writeJson(res, { error: 'Missing id' }, 400); return }

      const escapeStr = (val: unknown): string => {
        if (val === null || val === undefined || val === 'null' || val === '') return 'NULL';
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const updates: string[] = [];
      if (body.spb_number !== undefined) updates.push(`spb_number = ${escapeStr(body.spb_number)}`);
      if (body.customer_id !== undefined) updates.push(`customer_id = ${body.customer_id || 'NULL'}`);
      if (body.customer_name !== undefined) updates.push(`customer_name = ${escapeStr(body.customer_name)}`);
      if (body.customer_address !== undefined) updates.push(`customer_address = ${escapeStr(body.customer_address)}`);
      if (body.sender_name !== undefined) updates.push(`sender_name = ${escapeStr(body.sender_name)}`);
      if (body.sender_address !== undefined) updates.push(`sender_address = ${escapeStr(body.sender_address)}`);
      if (body.pengirim_name !== undefined) updates.push(`pengirim_name = ${escapeStr(body.pengirim_name)}`);
      if (body.penerima_name !== undefined) updates.push(`penerima_name = ${escapeStr(body.penerima_name)}`);
      if (body.penerima_phone !== undefined) updates.push(`penerima_phone = ${escapeStr(body.penerima_phone)}`);
      if (body.origin !== undefined) updates.push(`origin = ${escapeStr(body.origin)}`);
      if (body.destination !== undefined) updates.push(`destination = ${escapeStr(body.destination)}`);
      if (body.eta !== undefined) updates.push(`eta = ${escapeStr(body.eta)}`);
      if (body.status !== undefined) updates.push(`status = ${escapeStr(body.status)}`);
      if (body.total_colli !== undefined) updates.push(`total_colli = ${body.total_colli || 0}`);
      if (body.qty !== undefined) updates.push(`qty = ${body.qty || 0}`);
      if (body.satuan !== undefined) updates.push(`satuan = ${escapeStr(body.satuan)}`);
      if (body.berat !== undefined) updates.push(`berat = ${body.berat || 0}`);
      if (body.macam_barang !== undefined) updates.push(`macam_barang = ${escapeStr(body.macam_barang)}`);
      if (body.nominal !== undefined) updates.push(`nominal = ${body.nominal || 0}`);
      if (body.vehicle_plate_region !== undefined) updates.push(`vehicle_plate_region = ${escapeStr(body.vehicle_plate_region)}`);
      if (body.shipping_address !== undefined) updates.push(`shipping_address = ${escapeStr(body.shipping_address)}`);
      if (body.service_type !== undefined) updates.push(`service_type = ${escapeStr(body.service_type)}`);
      if (body.jenis !== undefined) updates.push(`jenis = ${escapeStr(body.jenis)}`);
      if (body.keterangan !== undefined) updates.push(`keterangan = ${escapeStr(body.keterangan)}`);

      if (updates.length > 0) {
        const updateQuery = `UPDATE shipments SET ${updates.join(', ')} WHERE id = ${body.id}` as string;
        await sql(updateQuery as never);
      }

      if (body.regenerate_code) {
        const gen = await sql`select generate_public_code() as code` as [{ code: string }];
        await sql`update shipments set public_code = ${gen[0]?.code || null} where id = ${body.id}`;
      }

      writeJson(res, { success: true });
      return
    } else if (endpoint === 'delete' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) { writeJson(res, { error: 'Missing id' }, 400); return }

      await sql`delete from shipments where id = ${parseInt(id)}`;
      writeJson(res, { success: true });
      return
    }

    writeJson(res, { error: 'Invalid endpoint' }, 404);
  } catch (err) {
    writeJson(res, { error: 'Internal error', details: String(err) }, 500);
  }
}
