import type { IncomingMessage, ServerResponse } from 'http';
import { getSql } from './db.js';
import { readJsonNode, writeJson } from './http.js';

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

interface UpdateDBLBody extends Partial<CreateDBLBody> { id: number }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

export async function dblHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return }

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

      writeJson(res, {
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
      return

    } else if (endpoint === 'get' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) { writeJson(res, { error: 'Missing id' }, 400); return }

      const dblResult = await sql`
        select * from dbl where id = ${parseInt(id)}
      ` as DBL[];

      if (!dblResult.length) { writeJson(res, { error: 'DBL not found' }, 404); return }

      const dbl = dblResult[0];
      if (!dbl) { writeJson(res, { error: 'DBL not found' }, 404); return }
      const items = await sql`
        select di.*, s.spb_number, s.pengirim_name, s.penerima_name, s.macam_barang, 
               s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal,
               s.customer_name, s.destination
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        where di.dbl_id = ${parseInt(id)}
        order by di.urutan, di.id
      ` as DBLItem[];

      writeJson(res, {
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
      return

    } else if (endpoint === 'create' && req.method === 'POST') {
      const body = await readJsonNode(req) as CreateDBLBody | null;
      if (!body || !body.dbl_date) { writeJson(res, { error: 'Missing dbl_date' }, 400); return }

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

      writeJson(res, { id: dblId, dbl_number: dblNumber }, 201);
      return

    } else if (endpoint === 'update' && req.method === 'PUT') {
      const body = await readJsonNode(req) as UpdateDBLBody | null;
      if (!body || !body.id) { writeJson(res, { error: 'Missing id' }, 400); return }

      const escapeStr = (val: unknown): string => {
        if (val === null || val === undefined || val === 'null' || val === '') return 'NULL';
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const updates: string[] = [];
      if (body.dbl_date !== undefined) updates.push(`dbl_date = ${body.dbl_date ? `'${body.dbl_date}'` : 'NULL'}`);
      if (body.vehicle_plate !== undefined) updates.push(`vehicle_plate = ${escapeStr(body.vehicle_plate)}`);
      if (body.driver_name !== undefined) updates.push(`driver_name = ${escapeStr(body.driver_name)}`);
      if (body.driver_phone !== undefined) updates.push(`driver_phone = ${escapeStr(body.driver_phone)}`);
      if (body.origin !== undefined) updates.push(`origin = ${escapeStr(body.origin)}`);
      if (body.destination !== undefined) updates.push(`destination = ${escapeStr(body.destination)}`);
      if (body.status !== undefined) updates.push(`status = '${body.status}'`);
      if (body.loco_amount !== undefined) updates.push(`loco_amount = ${body.loco_amount || 0}`);
      if (body.tekor_amount !== undefined) updates.push(`tekor_amount = ${body.tekor_amount || 0}`);
      if (body.sangu !== undefined) updates.push(`sangu = ${body.sangu || 0}`);
      if (body.komisi !== undefined) updates.push(`komisi = ${body.komisi || 0}`);
      if (body.ongkos_muatan !== undefined) updates.push(`ongkos_muatan = ${body.ongkos_muatan || 0}`);
      if (body.biaya_lain !== undefined) updates.push(`biaya_lain = ${body.biaya_lain || 0}`);
      if (body.administrasi !== undefined) updates.push(`administrasi = ${body.administrasi || 0}`);
      if (body.ongkos_lain !== undefined) updates.push(`ongkos_lain = ${body.ongkos_lain || 0}`);
      if (body.catatan !== undefined) updates.push(`catatan = ${escapeStr(body.catatan)}`);
      if (body.pengurus_name !== undefined) updates.push(`pengurus_name = ${escapeStr(body.pengurus_name)}`);
      if (body.supir_name !== undefined) updates.push(`supir_name = ${escapeStr(body.supir_name)}`);

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

      try {
        if (updates.length > 0) {
          const updateQuery = `UPDATE dbl SET ${updates.join(', ')} WHERE id = ${body.id}` as string;
          await sql(updateQuery as never);
        }

        if (body.status !== undefined) {
          const statusMapping: Record<string, string> = {
            DEPARTED: 'IN_TRANSIT',
            ARRIVED: 'IN_TRANSIT',
            COMPLETED: 'DELIVERED'
          };
          const shipmentStatus = statusMapping[body.status];
          if (shipmentStatus) {
            await sql`
              UPDATE shipments 
              SET status = ${shipmentStatus}, updated_at = now()
              WHERE dbl_id = ${body.id}
            `;
          }
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

        writeJson(res, { success: true });
        return
      } catch (updateError) {
        writeJson(res, { error: 'Database update failed', details: String(updateError) }, 500);
        return
      }

    } else if (endpoint === 'delete' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) { writeJson(res, { error: 'Missing id' }, 400); return }

      await sql`update shipments set dbl_id = null where dbl_id = ${parseInt(id)}`;
      await sql`delete from dbl where id = ${parseInt(id)}`;

      writeJson(res, { success: true });
      return

    } else if (endpoint === 'items' && req.method === 'GET') {
      const dblId = url.searchParams.get('id') || url.searchParams.get('dbl_id');
      if (!dblId) { writeJson(res, { error: 'Missing id' }, 400); return }

      const items = await sql`
        select di.shipment_id as id, di.urutan, di.dbl_id,
               s.spb_number, s.public_code as tracking_code, s.pengirim_name as sender_name, s.penerima_name as recipient_name, s.penerima_phone as recipient_phone, s.macam_barang as description,
               s.qty, s.satuan, s.berat as total_weight, coalesce(s.nominal, 0)::float as nominal,
               s.customer_name, s.destination as destination_city, s.origin as origin_city, s.total_colli, s.status, s.created_at
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        where di.dbl_id = ${parseInt(dblId)}
        order by di.urutan, di.id
      ` as DBLItem[];

      writeJson(res, { items });
      return

    } else if (endpoint === 'add-shipment' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id: number; shipment_id: number } | null;
      if (!body || !body.dbl_id || !body.shipment_id) { writeJson(res, { error: 'Missing dbl_id or shipment_id' }, 400); return }

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

      writeJson(res, { success: true });
      return

    } else if (endpoint === 'remove-shipment' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id: number; shipment_id: number } | null;
      if (!body || !body.dbl_id || !body.shipment_id) { writeJson(res, { error: 'Missing dbl_id or shipment_id' }, 400); return }

      await sql`delete from dbl_items where dbl_id = ${body.dbl_id} and shipment_id = ${body.shipment_id}`;
      await sql`update shipments set dbl_id = null, status = 'LOADING' where id = ${body.shipment_id}`;

      const items = await sql`
        select di.shipment_id as id, di.urutan, di.dbl_id,
               s.spb_number, s.public_code as tracking_code, s.pengirim_name as sender_name, s.penerima_name as recipient_name, s.penerima_phone as recipient_phone, s.macam_barang as description,
               s.qty, s.satuan, s.berat as total_weight, coalesce(s.nominal, 0)::float as nominal,
               s.customer_name, s.destination as destination_city, s.origin as origin_city, s.total_colli, s.status, s.created_at
        from dbl_items di
        join shipments s on s.id = di.shipment_id
        where di.dbl_id = ${body.dbl_id}
        order by di.urutan, di.id
      ` as DBLItem[];

      writeJson(res, { success: true, items });
      return

    } else if (endpoint === 'available-shipments' && req.method === 'GET') {
      try {
        const items = await sql`
          select 
            s.id, 
            s.spb_number, 
            s.public_code, 
            s.customer_id,
            s.customer_name,
            s.pengirim_name, 
            s.penerima_name, 
            s.penerima_phone,
            s.origin, 
            s.destination, 
            s.macam_barang, 
            coalesce(s.qty, 0)::float as qty,
            s.satuan, 
            coalesce(s.nominal, 0)::float as nominal, 
            s.total_colli, 
            s.status,
            coalesce(s.invoice_generated, false) as invoice_generated
          from shipments s
          where s.dbl_id is null 
          and s.status in ('LOADING', 'BOOKED', 'READY')
          and coalesce(s.invoice_generated, false) = false
          order by s.created_at desc
          limit 100
        `;

        writeJson(res, { items });
        return
      } catch (err) {
        console.error('[dbl/available-shipments] Error:', err);
        writeJson(res, { error: 'Failed to fetch available shipments', details: String(err) }, 500);
        return
      }

    } else if (endpoint === 'generate-invoices' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id: number; pph_percent?: number } | null;
      if (!body || !body.dbl_id) { writeJson(res, { error: 'Missing dbl_id' }, 400); return }

      const shipments = await sql`
        select s.*, di.dbl_id
        from shipments s
        join dbl_items di on di.shipment_id = s.id
        where di.dbl_id = ${body.dbl_id}
        and coalesce(s.invoice_generated, false) = false
        and s.customer_id is not null
      `;

      const shipmentsArray = Array.isArray(shipments) ? shipments : [];

      if (shipmentsArray.length === 0) {
        writeJson(res, { error: 'No eligible shipments found' }, 400);
        return
      }

      const customerGroups = shipmentsArray.reduce((acc: Record<number, typeof shipmentsArray>, s: any) => {
        const cid = s.customer_id;
        if (!acc[cid]) acc[cid] = [];
        acc[cid].push(s);
        return acc;
      }, {} as Record<number, typeof shipmentsArray>);

      const invoices = [];
      for (const [customerId, customerShipments] of Object.entries(customerGroups)) {
        const totalAmount = customerShipments.reduce((sum: number, s: any) => sum + Number(s.nominal || 0), 0);
        const pphAmount = body.pph_percent ? (totalAmount * body.pph_percent / 100) : 0;
        const finalAmount = totalAmount - pphAmount;

        const invoiceNumberResult = await sql`select generate_invoice_number() as num` as [{ num: string }];
        const invoiceNumber = invoiceNumberResult[0]?.num || `INV-${Date.now()}`;

        const [invoice] = await sql`
          insert into invoices (
            invoice_number,
            customer_id,
            invoice_date,
            amount,
            pph_amount,
            status
          ) values (
            ${invoiceNumber},
            ${parseInt(customerId)},
            now(),
            ${finalAmount},
            ${pphAmount},
            'pending'
          ) returning id
        ` as [{ id: number }];

        for (const shipment of (customerShipments as any[])) {
          await sql`
            insert into invoice_items (invoice_id, description, quantity, unit_price)
            values (
              ${invoice.id}, 
              ${`Resi: ${shipment.spb_number || shipment.public_code} - ${shipment.macam_barang || 'Jasa Pengiriman'}`},
              1,
              ${Number(shipment.nominal || 0)}
            )
          `;
          await sql`
            update shipments 
            set invoice_generated = true, status = 'DELIVERED'
            where id = ${shipment.id}
          `;
        }

        invoices.push({ id: invoice.id, invoice_number: invoiceNumber });
      }

      writeJson(res, { invoices });
      return

    } else if (endpoint === 'report' && req.method === 'GET') {
      const items = await sql`
        select 
          d.id,
          d.dbl_number,
          d.vehicle_plate,
          d.driver_name,
          d.destination,
          d.status,
          d.dbl_date as departure_date,
          d.created_at,
          (select count(*)::int from dbl_items where dbl_id = d.id) as total_shipments,
          (select coalesce(sum(s.total_colli), 0)::int from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_colli,
          (select coalesce(sum(s.berat), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_weight,
          (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal
        from dbl d
        order by d.dbl_date desc, d.created_at desc
      ` as Array<{
        id: number;
        dbl_number: string;
        vehicle_plate: string | null;
        driver_name: string | null;
        destination: string | null;
        status: string;
        departure_date: string | null;
        created_at: string;
        total_shipments: number;
        total_colli: number;
        total_weight: number;
        total_nominal: number;
      }>;

      writeJson(res, { items });
      return

    } else if (endpoint === 'operational-costs' && req.method === 'GET') {
      const dblId = url.searchParams.get('dbl_id');
      
      if (dblId) {
        const result = await sql`
          select oc.*, d.dbl_number, d.origin, d.destination, d.driver_name, d.dbl_date,
            (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal
          from dbl_operational_costs oc
          join dbl d on d.id = oc.dbl_id
          where oc.dbl_id = ${parseInt(dblId)}
        ` as Record<string, unknown>[];
        
        if (result.length > 0) {
          writeJson(res, { item: result[0] });
        } else {
          const dblResult = await sql`
            select d.*, 
              (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal
            from dbl d where d.id = ${parseInt(dblId)}
          ` as Record<string, unknown>[];
          writeJson(res, { item: null, dbl: dblResult[0] || null });
        }
      } else {
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');
        const destination = url.searchParams.get('destination');
        
        let items;
        if (startDate && endDate) {
          if (destination) {
            items = await sql`
              select d.id, d.dbl_number, d.origin, d.destination, d.driver_name, d.dbl_date, d.vehicle_plate,
                (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal,
                oc.bayar_supir, oc.solar, oc.sewa_mobil, oc.kuli_muat, oc.kuli_bongkar, oc.biaya_lain, oc.total_operational, oc.catatan as oc_catatan
              from dbl d
              left join dbl_operational_costs oc on oc.dbl_id = d.id
              where d.dbl_date >= ${startDate}::date and d.dbl_date <= ${endDate}::date
                and lower(d.destination) like ${`%${destination.toLowerCase()}%`}
              order by d.dbl_date desc
            `;
          } else {
            items = await sql`
              select d.id, d.dbl_number, d.origin, d.destination, d.driver_name, d.dbl_date, d.vehicle_plate,
                (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal,
                oc.bayar_supir, oc.solar, oc.sewa_mobil, oc.kuli_muat, oc.kuli_bongkar, oc.biaya_lain, oc.total_operational, oc.catatan as oc_catatan
              from dbl d
              left join dbl_operational_costs oc on oc.dbl_id = d.id
              where d.dbl_date >= ${startDate}::date and d.dbl_date <= ${endDate}::date
              order by d.dbl_date desc
            `;
          }
        } else {
          items = await sql`
            select d.id, d.dbl_number, d.origin, d.destination, d.driver_name, d.dbl_date, d.vehicle_plate,
              (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal,
              oc.bayar_supir, oc.solar, oc.sewa_mobil, oc.kuli_muat, oc.kuli_bongkar, oc.biaya_lain, oc.total_operational, oc.catatan as oc_catatan
            from dbl d
            left join dbl_operational_costs oc on oc.dbl_id = d.id
            order by d.dbl_date desc
            limit 50
          `;
        }
        
        writeJson(res, { items });
      }
      return

    } else if (endpoint === 'save-operational-costs' && req.method === 'POST') {
      const body = await readJsonNode(req) as {
        dbl_id: number;
        bayar_supir?: number;
        solar?: number;
        sewa_mobil?: number;
        kuli_muat?: number;
        kuli_bongkar?: number;
        biaya_lain?: number;
        catatan?: string;
      } | null;

      if (!body || !body.dbl_id) {
        writeJson(res, { error: 'Missing dbl_id' }, 400);
        return;
      }

      const totalOperational = (body.bayar_supir || 0) + (body.solar || 0) + (body.sewa_mobil || 0) +
        (body.kuli_muat || 0) + (body.kuli_bongkar || 0) + (body.biaya_lain || 0);

      const existing = await sql`
        select id from dbl_operational_costs where dbl_id = ${body.dbl_id}
      ` as { id: number }[];

      if (existing.length > 0) {
        await sql`
          update dbl_operational_costs set
            bayar_supir = ${body.bayar_supir || 0},
            solar = ${body.solar || 0},
            sewa_mobil = ${body.sewa_mobil || 0},
            kuli_muat = ${body.kuli_muat || 0},
            kuli_bongkar = ${body.kuli_bongkar || 0},
            biaya_lain = ${body.biaya_lain || 0},
            total_operational = ${totalOperational},
            catatan = ${body.catatan || null},
            updated_at = now()
          where dbl_id = ${body.dbl_id}
        `;
      } else {
        await sql`
          insert into dbl_operational_costs (
            dbl_id, bayar_supir, solar, sewa_mobil, kuli_muat, kuli_bongkar, biaya_lain, total_operational, catatan
          ) values (
            ${body.dbl_id},
            ${body.bayar_supir || 0},
            ${body.solar || 0},
            ${body.sewa_mobil || 0},
            ${body.kuli_muat || 0},
            ${body.kuli_bongkar || 0},
            ${body.biaya_lain || 0},
            ${totalOperational},
            ${body.catatan || null}
          )
        `;
      }

      writeJson(res, { success: true });
      return

    } else if (endpoint === 'margin-report' && req.method === 'GET') {
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      const destination = url.searchParams.get('destination');
      
      let baseQuery = `
        select 
          d.id, d.dbl_number, d.origin, d.destination, d.driver_name, d.dbl_date, d.vehicle_plate,
          (select coalesce(sum(s.nominal), 0)::float from dbl_items di join shipments s on s.id = di.shipment_id where di.dbl_id = d.id) as total_nominal,
          coalesce(oc.total_operational, 0)::float as total_operational,
          coalesce(oc.bayar_supir, 0)::float as bayar_supir,
          coalesce(oc.solar, 0)::float as solar,
          coalesce(oc.sewa_mobil, 0)::float as sewa_mobil,
          coalesce(oc.kuli_muat, 0)::float as kuli_muat,
          coalesce(oc.kuli_bongkar, 0)::float as kuli_bongkar,
          coalesce(oc.biaya_lain, 0)::float as biaya_lain
        from dbl d
        left join dbl_operational_costs oc on oc.dbl_id = d.id
      `;

      const conditions: string[] = [];
      if (startDate) conditions.push(`d.dbl_date >= '${startDate}'::date`);
      if (endDate) conditions.push(`d.dbl_date <= '${endDate}'::date`);
      if (destination) conditions.push(`lower(d.destination) like '%${destination.toLowerCase()}%'`);

      if (conditions.length > 0) {
        baseQuery += ` where ${conditions.join(' and ')}`;
      }
      baseQuery += ` order by d.dbl_date desc`;

      const items = await sql(baseQuery as never) as Array<{
        id: number;
        dbl_number: string;
        origin: string | null;
        destination: string | null;
        driver_name: string | null;
        dbl_date: string | null;
        vehicle_plate: string | null;
        total_nominal: number;
        total_operational: number;
        bayar_supir: number;
        solar: number;
        sewa_mobil: number;
        kuli_muat: number;
        kuli_bongkar: number;
        biaya_lain: number;
      }>;

      const report = items.map(item => ({
        ...item,
        margin: item.total_nominal - item.total_operational,
        margin_percent: item.total_nominal > 0 ? parseFloat(((item.total_nominal - item.total_operational) / item.total_nominal * 100).toFixed(2)) : 0
      }));

      const summary = {
        total_nominal: report.reduce((sum, r) => sum + r.total_nominal, 0),
        total_operational: report.reduce((sum, r) => sum + r.total_operational, 0),
        total_margin: report.reduce((sum, r) => sum + r.margin, 0)
      };

      writeJson(res, { items: report, summary });
      return
    }

    writeJson(res, { error: 'Invalid endpoint' }, 404);
  } catch (err) {
    writeJson(res, { error: 'Internal error', details: String(err) }, 500);
  }
}
