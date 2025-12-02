export const config = { runtime: 'nodejs' };

import type { IncomingMessage, ServerResponse } from 'http';
import { getSql } from './_lib/db.js';
import { readJsonNode, writeJson } from './_lib/http.js';

interface DBL {
  id: number;
  dbl_number: string;
  dbl_date: string;
  vehicle_plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  loco_amount: number;
  tekor_amount: number;
  sangu: number;
  komisi: number;
  ongkos_muatan: number;
  biaya_lain: number;
  administrasi: number;
  ongkos_lain: number;
  total_tagihan: number;
  total_bayar: number;
  catatan: string | null;
  pengurus_name: string | null;
  supir_name: string | null;
  created_at: string;
  shipment_count?: number;
}

interface DBLItem {
  id?: number;
  dbl_id?: number;
  shipment_id: number;
  urutan?: number;
  bayar_colli?: number;
  total_jumlah?: number;
  spb_number?: string;
  pengirim_name?: string;
  penerima_name?: string;
  macam_barang?: string;
  qty?: number;
  satuan?: string;
  nominal?: number;
}

interface CreateDBLBody {
  dbl_number?: string;
  dbl_date: string;
  vehicle_plate?: string;
  driver_name?: string;
  driver_phone?: string;
  origin?: string;
  destination?: string;
  status?: string;
  loco_amount?: number;
  tekor_amount?: number;
  sangu?: number;
  komisi?: number;
  ongkos_muatan?: number;
  biaya_lain?: number;
  administrasi?: number;
  ongkos_lain?: number;
  catatan?: string;
  pengurus_name?: string;
  supir_name?: string;
  shipment_ids?: number[];
}

interface UpdateDBLBody extends Partial<CreateDBLBody> {
  id: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();

  try {
    if (endpoint === 'list' && req.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const status = url.searchParams.get('status');
      const offset = (page - 1) * limit;

      let dbls: DBL[];
      let total: number;

      if (status) {
        dbls = await sql`
          select d.*, 
            (select count(*)::int from dbl_items where dbl_id = d.id) as shipment_count,
            (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal
          from dbl d
          where d.status = ${status}
          order by d.dbl_date desc, d.created_at desc
          limit ${limit} offset ${offset}
        ` as DBL[];

        const countResult = await sql`
          select count(*)::int as count from dbl where status = ${status}
        ` as [{ count: number }];
        total = countResult[0]?.count || 0;
      } else {
        dbls = await sql`
          select d.*, 
            (select count(*)::int from dbl_items where dbl_id = d.id) as shipment_count,
            (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal
          from dbl d
          order by d.dbl_date desc, d.created_at desc
          limit ${limit} offset ${offset}
        ` as DBL[];

        const countResult = await sql`
          select count(*)::int as count from dbl
        ` as [{ count: number }];
        total = countResult[0]?.count || 0;
      }

      return writeJson(res, {
        items: dbls.map(d => ({
          ...d,
          loco_amount: Number(d.loco_amount || 0),
          tekor_amount: Number(d.tekor_amount || 0),
          sangu: Number(d.sangu || 0),
          komisi: Number(d.komisi || 0),
          ongkos_muatan: Number(d.ongkos_muatan || 0),
          biaya_lain: Number(d.biaya_lain || 0),
          administrasi: Number(d.administrasi || 0),
          ongkos_lain: Number(d.ongkos_lain || 0),
          total_tagihan: Number(d.total_tagihan || 0),
          total_bayar: Number(d.total_bayar || 0)
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });

    } else if (endpoint === 'get' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return writeJson(res, { error: 'Missing id' }, 400);

      const dblResult = await sql`
        select * from dbl where id = ${parseInt(id)}
      ` as DBL[];

      if (!dblResult.length) return writeJson(res, { error: 'DBL not found' }, 404);

      const dbl = dblResult[0];
      if (!dbl) return writeJson(res, { error: 'DBL not found' }, 404);
      const items = await sql`
        select di.*, s.spb_number, s.pengirim_name, s.penerima_name, s.macam_barang, 
               s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal,
               s.customer_name, s.destination
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        where di.dbl_id = ${parseInt(id)}
        order by di.urutan, di.id
      ` as DBLItem[];

      return writeJson(res, {
        ...dbl,
        loco_amount: Number(dbl.loco_amount || 0),
        tekor_amount: Number(dbl.tekor_amount || 0),
        sangu: Number(dbl.sangu || 0),
        komisi: Number(dbl.komisi || 0),
        ongkos_muatan: Number(dbl.ongkos_muatan || 0),
        biaya_lain: Number(dbl.biaya_lain || 0),
        administrasi: Number(dbl.administrasi || 0),
        ongkos_lain: Number(dbl.ongkos_lain || 0),
        total_tagihan: Number(dbl.total_tagihan || 0),
        total_bayar: Number(dbl.total_bayar || 0),
        items
      });

    } else if (endpoint === 'create' && req.method === 'POST') {
      const body = await readJsonNode(req) as CreateDBLBody | null;
      if (!body || !body.dbl_date) return writeJson(res, { error: 'Missing dbl_date' }, 400);

      let dblNumber = body.dbl_number;
      if (!dblNumber) {
        const genResult = await sql`select generate_dbl_number() as num` as [{ num: string }];
        dblNumber = genResult[0]?.num || `DBL.${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, '0')}.001`;
      }

      const totalTagihan = (body.loco_amount || 0) - (body.tekor_amount || 0);
      const totalBayar = (body.sangu || 0) + (body.komisi || 0) + (body.ongkos_muatan || 0) +
                         (body.biaya_lain || 0) + (body.administrasi || 0) + (body.ongkos_lain || 0);

      const result = await sql`
        insert into dbl (
          dbl_number, dbl_date, vehicle_plate, driver_name, driver_phone,
          origin, destination, status, loco_amount, tekor_amount,
          sangu, komisi, ongkos_muatan, biaya_lain, administrasi, ongkos_lain,
          total_tagihan, total_bayar, catatan, pengurus_name, supir_name
        ) values (
          ${dblNumber},
          ${body.dbl_date},
          ${body.vehicle_plate || null},
          ${body.driver_name || null},
          ${body.driver_phone || null},
          ${body.origin || null},
          ${body.destination || null},
          ${body.status || 'DRAFT'},
          ${body.loco_amount || 0},
          ${body.tekor_amount || 0},
          ${body.sangu || 0},
          ${body.komisi || 0},
          ${body.ongkos_muatan || 0},
          ${body.biaya_lain || 0},
          ${body.administrasi || 0},
          ${body.ongkos_lain || 0},
          ${totalTagihan},
          ${totalBayar},
          ${body.catatan || null},
          ${body.pengurus_name || null},
          ${body.supir_name || null}
        ) returning id
      ` as [{ id: number }];

      const dblId = result[0].id;

      if (body.shipment_ids && body.shipment_ids.length > 0) {
        for (let i = 0; i < body.shipment_ids.length; i++) {
          const shipmentId = body.shipment_ids[i];
          await sql`
            insert into dbl_items (dbl_id, shipment_id, urutan)
            values (${dblId}, ${shipmentId}, ${i + 1})
          `;
          await sql`
            update shipments set dbl_id = ${dblId} where id = ${shipmentId}
          `;
        }
      }

      return writeJson(res, { id: dblId, dbl_number: dblNumber }, 201);

    } else if (endpoint === 'update' && req.method === 'PUT') {
      const body = await readJsonNode(req) as UpdateDBLBody | null;
      if (!body || !body.id) return writeJson(res, { error: 'Missing id' }, 400);

      const updates: string[] = [];
      if (body.dbl_date !== undefined) updates.push(`dbl_date = '${body.dbl_date}'`);
      if (body.vehicle_plate !== undefined) updates.push(`vehicle_plate = '${String(body.vehicle_plate).replace(/'/g, "''")}'`);
      if (body.driver_name !== undefined) updates.push(`driver_name = '${String(body.driver_name).replace(/'/g, "''")}'`);
      if (body.driver_phone !== undefined) updates.push(`driver_phone = '${String(body.driver_phone).replace(/'/g, "''")}'`);
      if (body.origin !== undefined) updates.push(`origin = '${String(body.origin).replace(/'/g, "''")}'`);
      if (body.destination !== undefined) updates.push(`destination = '${String(body.destination).replace(/'/g, "''")}'`);
      if (body.status !== undefined) updates.push(`status = '${body.status}'`);
      if (body.loco_amount !== undefined) updates.push(`loco_amount = ${body.loco_amount}`);
      if (body.tekor_amount !== undefined) updates.push(`tekor_amount = ${body.tekor_amount}`);
      if (body.sangu !== undefined) updates.push(`sangu = ${body.sangu}`);
      if (body.komisi !== undefined) updates.push(`komisi = ${body.komisi}`);
      if (body.ongkos_muatan !== undefined) updates.push(`ongkos_muatan = ${body.ongkos_muatan}`);
      if (body.biaya_lain !== undefined) updates.push(`biaya_lain = ${body.biaya_lain}`);
      if (body.administrasi !== undefined) updates.push(`administrasi = ${body.administrasi}`);
      if (body.ongkos_lain !== undefined) updates.push(`ongkos_lain = ${body.ongkos_lain}`);
      if (body.catatan !== undefined) updates.push(`catatan = '${String(body.catatan).replace(/'/g, "''")}'`);
      if (body.pengurus_name !== undefined) updates.push(`pengurus_name = '${String(body.pengurus_name).replace(/'/g, "''")}'`);
      if (body.supir_name !== undefined) updates.push(`supir_name = '${String(body.supir_name).replace(/'/g, "''")}'`);

      if (body.loco_amount !== undefined || body.tekor_amount !== undefined) {
        const current = await sql`select loco_amount, tekor_amount from dbl where id = ${body.id}` as [{ loco_amount: number; tekor_amount: number }];
        const loco = body.loco_amount ?? Number(current[0]?.loco_amount || 0);
        const tekor = body.tekor_amount ?? Number(current[0]?.tekor_amount || 0);
        updates.push(`total_tagihan = ${loco - tekor}`);
      }

      if (body.sangu !== undefined || body.komisi !== undefined || body.ongkos_muatan !== undefined ||
          body.biaya_lain !== undefined || body.administrasi !== undefined || body.ongkos_lain !== undefined) {
        const current = await sql`
          select sangu, komisi, ongkos_muatan, biaya_lain, administrasi, ongkos_lain 
          from dbl where id = ${body.id}
        ` as [{ sangu: number; komisi: number; ongkos_muatan: number; biaya_lain: number; administrasi: number; ongkos_lain: number }];
        const sangu = body.sangu ?? Number(current[0]?.sangu || 0);
        const komisi = body.komisi ?? Number(current[0]?.komisi || 0);
        const ongkosMuatan = body.ongkos_muatan ?? Number(current[0]?.ongkos_muatan || 0);
        const biayaLain = body.biaya_lain ?? Number(current[0]?.biaya_lain || 0);
        const administrasi = body.administrasi ?? Number(current[0]?.administrasi || 0);
        const ongkosLain = body.ongkos_lain ?? Number(current[0]?.ongkos_lain || 0);
        updates.push(`total_bayar = ${sangu + komisi + ongkosMuatan + biayaLain + administrasi + ongkosLain}`);
      }

      updates.push(`updated_at = now()`);

      if (updates.length > 0) {
        const updateQuery = `UPDATE dbl SET ${updates.join(', ')} WHERE id = ${body.id}`;
        await sql(updateQuery as never);
      }

      if (body.shipment_ids !== undefined) {
        await sql`update shipments set dbl_id = null where dbl_id = ${body.id}`;
        await sql`delete from dbl_items where dbl_id = ${body.id}`;

        for (let i = 0; i < body.shipment_ids.length; i++) {
          const shipmentId = body.shipment_ids[i];
          await sql`
            insert into dbl_items (dbl_id, shipment_id, urutan)
            values (${body.id}, ${shipmentId}, ${i + 1})
          `;
          await sql`
            update shipments set dbl_id = ${body.id} where id = ${shipmentId}
          `;
        }
      }

      return writeJson(res, { success: true });

    } else if (endpoint === 'delete' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return writeJson(res, { error: 'Missing id' }, 400);

      await sql`update shipments set dbl_id = null where dbl_id = ${parseInt(id)}`;
      await sql`delete from dbl where id = ${parseInt(id)}`;

      return writeJson(res, { success: true });

    } else if (endpoint === 'items' && req.method === 'GET') {
      const dblId = url.searchParams.get('id') || url.searchParams.get('dbl_id');
      if (!dblId) return writeJson(res, { error: 'Missing id' }, 400);

      const items = await sql`
        select di.*, s.spb_number, s.pengirim_name, s.penerima_name, s.macam_barang,
               s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal,
               s.customer_name, s.destination, s.origin
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        where di.dbl_id = ${parseInt(dblId)}
        order by di.urutan, di.id
      ` as DBLItem[];

      return writeJson(res, { items });

    } else if (endpoint === 'add-shipment' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id: number; shipment_id: number } | null;
      if (!body || !body.dbl_id || !body.shipment_id) {
        return writeJson(res, { error: 'Missing dbl_id or shipment_id' }, 400);
      }

      const maxUrutan = await sql`
        select coalesce(max(urutan), 0) + 1 as next_urutan 
        from dbl_items where dbl_id = ${body.dbl_id}
      ` as [{ next_urutan: number }];

      await sql`
        insert into dbl_items (dbl_id, shipment_id, urutan)
        values (${body.dbl_id}, ${body.shipment_id}, ${maxUrutan[0].next_urutan})
        on conflict (dbl_id, shipment_id) do nothing
      `;

      await sql`update shipments set dbl_id = ${body.dbl_id}, status = 'IN_TRANSIT' where id = ${body.shipment_id}`;

      return writeJson(res, { success: true });

    } else if (endpoint === 'remove-shipment' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id: number; shipment_id: number } | null;
      if (!body || !body.dbl_id || !body.shipment_id) {
        return writeJson(res, { error: 'Missing dbl_id or shipment_id' }, 400);
      }

      await sql`delete from dbl_items where dbl_id = ${body.dbl_id} and shipment_id = ${body.shipment_id}`;
      await sql`update shipments set dbl_id = null, status = 'LOADING' where id = ${body.shipment_id}`;

      return writeJson(res, { success: true });

    } else if (endpoint === 'get-shipments' && req.method === 'GET') {
      const dblId = url.searchParams.get('dbl_id');
      if (!dblId) return writeJson(res, { error: 'Missing dbl_id' }, 400);

      const shipments = await sql`
        select s.id, s.tracking_code, s.spb_number, s.pengirim_name as sender_name,
               s.penerima_name as recipient_name, s.penerima_alamat as recipient_address,
               s.penerima_telp as recipient_phone, s.origin as origin_city,
               s.destination as destination_city, s.total_colli, s.berat as total_weight,
               s.service_type, s.macam_barang as description, s.catatan as notes,
               s.status, s.created_at
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        where di.dbl_id = ${parseInt(dblId)}
        order by di.urutan, di.id
      `;

      return writeJson(res, { shipments });

    } else if (endpoint === 'available-shipments' && req.method === 'GET') {
      const search = url.searchParams.get('search') || '';

      let shipments;
      if (search) {
        shipments = await sql`
          select id, spb_number, public_code, pengirim_name, penerima_name, macam_barang,
                 qty, satuan, coalesce(nominal, 0)::float as nominal, total_colli,
                 customer_name, origin, destination, status, created_at
          from shipments
          where dbl_id is null
            and (
              spb_number ilike ${'%' + search + '%'} or
              public_code ilike ${'%' + search + '%'} or
              pengirim_name ilike ${'%' + search + '%'} or
              penerima_name ilike ${'%' + search + '%'} or
              customer_name ilike ${'%' + search + '%'}
            )
          order by created_at desc
          limit 100
        `;
      } else {
        shipments = await sql`
          select id, spb_number, public_code, pengirim_name, penerima_name, macam_barang,
                 qty, satuan, coalesce(nominal, 0)::float as nominal, total_colli,
                 customer_name, origin, destination, status, created_at
          from shipments
          where dbl_id is null
          order by created_at desc
          limit 100
        `;
      }

      return writeJson(res, { items: shipments });

    } else if (endpoint === 'generate-invoices' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id: number; pph_percent?: number } | null;
      if (!body || !body.dbl_id) return writeJson(res, { error: 'Missing dbl_id' }, 400);

      const dblId = body.dbl_id;
      const pphPercent = body.pph_percent || 0;

      const dblCheck = await sql`select id, status from dbl where id = ${dblId}` as [{ id: number; status: string }];
      if (!dblCheck.length) return writeJson(res, { error: 'DBL not found' }, 404);

      const shipments = await sql`
        select s.id, s.customer_id, coalesce(s.customer_name, c.name) as customer_name,
               coalesce(s.nominal, 0)::float as nominal, s.spb_number
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        left join customers c on c.id = s.customer_id
        where di.dbl_id = ${dblId}
          and s.invoice_generated = false
      `;

      const customerTotals = new Map<string, { customer_id: number | null; total: number; shipment_ids: number[] }>();
      for (const s of shipments as Array<{ id: number; customer_id: number | null; customer_name: string; nominal: number }>) {
        const key = s.customer_name || 'Unknown';
        if (!customerTotals.has(key)) {
          customerTotals.set(key, { customer_id: s.customer_id, total: 0, shipment_ids: [] });
        }
        const entry = customerTotals.get(key)!;
        entry.total += s.nominal;
        entry.shipment_ids.push(s.id);
      }

      const createdInvoices: Array<{ id: number; invoice_number: string; customer_name: string; amount: number }> = [];

      for (const [customerName, data] of customerTotals) {
        const subtotal = data.total;
        const pphAmount = pphPercent > 0 ? (subtotal * pphPercent / 100) : 0;
        const totalTagihan = subtotal - pphAmount;

        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const countResult = await sql`
          select count(*)::int as count from invoices
          where invoice_number like ${`%-${month}/STE-JKT/${year.toString().slice(-2)}`}
        ` as [{ count: number }];
        const nextNum = (countResult[0]?.count || 0) + 1;
        const invoiceNumber = `${String(nextNum).padStart(2, '0')}-${month}/STE-JKT/${year.toString().slice(-2)}`;

        const invResult = await sql`
          insert into invoices (
            dbl_id, invoice_number, customer_name, customer_id,
            amount, subtotal, pph_percent, pph_amount, total_tagihan,
            remaining_amount, status, issued_at, invoice_date
          ) values (
            ${dblId},
            ${invoiceNumber},
            ${customerName},
            ${data.customer_id},
            ${totalTagihan},
            ${subtotal},
            ${pphPercent},
            ${pphAmount},
            ${totalTagihan},
            ${totalTagihan},
            'pending',
            now(),
            ${new Date().toISOString().split('T')[0]}
          ) returning id
        ` as [{ id: number }];

        const invoiceId = invResult[0].id;

        for (const shipmentId of data.shipment_ids) {
          await sql`update shipments set invoice_generated = true where id = ${shipmentId}`;
        }

        createdInvoices.push({
          id: invoiceId,
          invoice_number: invoiceNumber,
          customer_name: customerName,
          amount: totalTagihan
        });
      }

      return writeJson(res, { success: true, invoices: createdInvoices });

    }

    if (endpoint === 'report' && req.method === 'GET') {
      const items = await sql`
        select 
          d.id,
          d.dbl_number,
          d.vehicle_plate,
          d.driver_name,
          d.destination,
          d.status,
          d.created_at,
          d.dbl_date as departure_date,
          count(di.id)::int as total_shipments,
          coalesce(sum(s.total_colli), 0)::int as total_colli,
          coalesce(sum(s.nominal), 0)::float as total_nominal
        from dbl d
        left join dbl_items di on di.dbl_id = d.id
        left join shipments s on s.id = di.shipment_id
        group by d.id
        order by d.created_at desc
        limit 500
      `;
      writeJson(res, { items });
      return;
    }

    res.writeHead(404);
    res.end();
  } catch (err) {
    console.error('DBL API error:', err);
    writeJson(res, { error: 'Internal error' }, 500);
  }
}
