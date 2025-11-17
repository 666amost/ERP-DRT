export const config = { runtime: 'nodejs' };

import type { IncomingMessage, ServerResponse } from 'http';
import { getSql } from './_lib/db.js';
import { readJsonNode, writeJson } from './_lib/http.js';

interface ColliBody {
  id?: number;
  shipment_id?: number;
  code?: string;
  kg_m3?: number;
  status?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  items?: ColliBody[];
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return; }
  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();
  try {
    if (endpoint === 'list' && req.method === 'GET') {
      const shipmentId = url.searchParams.get('shipment_id');
      if (!shipmentId) return writeJson(res, { items: [] });
      const items = await sql`select id, shipment_id, code, description, quantity, weight as kg_m3, status, unit_price, amount from colli where shipment_id = ${parseInt(shipmentId)} order by id`;
      return writeJson(res, { items });
    } else if (endpoint === 'create' && req.method === 'POST') {
      const body = await readJsonNode(req) as ColliBody | null;
      if (!body || !body.shipment_id) return writeJson(res, { error: 'Missing shipment_id' }, 400);
      const resInsert = await sql<Array<{ id: number }>>`
        insert into colli (shipment_id, code, weight, status, description, quantity, unit_price, amount)
        values (${body.shipment_id}, ${body.code || null}, ${body.kg_m3 || null}, ${body.status || 'READY'}, ${body.description || null}, ${body.quantity || 1}, ${body.unit_price || 0}, ${body.amount || 0})
        returning id`;
      return writeJson(res, { id: resInsert[0].id }, 201);
    } else if (endpoint === 'update' && req.method === 'PUT') {
      const body = await readJsonNode(req) as ColliBody | null;
      if (!body || !body.id) return writeJson(res, { error: 'Missing id' }, 400);
      const id = body.id;
      if (body.description !== undefined) await sql`update colli set description = ${String(body.description)} where id = ${id}`;
      if (body.quantity !== undefined) await sql`update colli set quantity = ${Number(body.quantity)} where id = ${id}`;
      if (body.kg_m3 !== undefined) await sql`update colli set weight = ${Number(body.kg_m3)} where id = ${id}`;
      if (body.unit_price !== undefined) await sql`update colli set unit_price = ${Number(body.unit_price)} where id = ${id}`;
      if (body.amount !== undefined) await sql`update colli set amount = ${Number(body.amount)} where id = ${id}`;
      if (body.status !== undefined) await sql`update colli set status = ${String(body.status)} where id = ${id}`;
      return writeJson(res, { success: true });
    } else if (endpoint === 'delete' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return writeJson(res, { error: 'Missing id' }, 400);
      await sql`delete from colli where id = ${parseInt(id)}`;
      return writeJson(res, { success: true });
    } else if (endpoint === 'bulk-set' && req.method === 'POST') {
      const body = await readJsonNode(req) as ColliBody | null;
      if (!body || !body.shipment_id) return writeJson(res, { error: 'Missing shipment_id' }, 400);
      const shipmentId = Number(body.shipment_id);
      const items = Array.isArray(body.items) ? body.items : [];
      const existingRows = await sql<Array<{ id: number }>>`select id from colli where shipment_id = ${shipmentId}`;
      const incomingIds = new Set(items.filter((it) => it.id).map((it) => Number(it.id)));
      // Delete items that are no longer present
      for (const r of existingRows) {
        if (!incomingIds.has(r.id)) {
          await sql`delete from colli where id = ${r.id}`;
        }
      }
      const results: Array<{ id: number }> = [];
      for (const it of items) {
        if (it.id) {
          const id = Number(it.id);
          const updates: Array<Promise<unknown>> = [];
          if (it.description !== undefined) updates.push(sql`update colli set description = ${String(it.description)} where id = ${id}`);
          if (it.quantity !== undefined) updates.push(sql`update colli set quantity = ${Number(it.quantity)} where id = ${id}`);
          if (it.kg_m3 !== undefined) updates.push(sql`update colli set weight = ${Number(it.kg_m3)} where id = ${id}`);
          if (it.unit_price !== undefined) updates.push(sql`update colli set unit_price = ${Number(it.unit_price)} where id = ${id}`);
          if (it.amount !== undefined) updates.push(sql`update colli set amount = ${Number(it.amount)} where id = ${id}`);
          if (it.status !== undefined) updates.push(sql`update colli set status = ${String(it.status)} where id = ${id}`);
          await Promise.all(updates);
          results.push({ id });
        } else {
          const insertRes = await sql<Array<{ id: number }>>`
            insert into colli (shipment_id, code, weight, status, description, quantity, unit_price, amount)
            values (${shipmentId}, ${it.code || null}, ${it.kg_m3 || null}, ${it.status || 'READY'}, ${it.description || null}, ${it.quantity || 1}, ${it.unit_price || 0}, ${it.amount || 0}) returning id`;
          results.push({ id: insertRes[0].id });
        }
      }
      return writeJson(res, { success: true, items: results });
    }
    res.writeHead(404);
    res.end();
  } catch (err) {
    console.error('Colli API error:', err);
    writeJson(res, { error: 'Internal error' }, 500);
  }
}
