export const config = { runtime: 'nodejs' };

import { getCompanyConfig, getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

// use writeJson helper for Node handlers

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  if (req.method === 'GET') {
    try {
      const sql = getSql();
      const rows = await sql`select id, name, address, phone, email, website, notes from company_config order by id desc limit 1` as Array<any>;
      if (rows && rows.length) {
        writeJson(res, { company: rows[0] });
        return;
      }
    } catch (e) {
      // ignore DB error and fallback to env
      console.error('company GET DB error:', e);
    }
    const company = getCompanyConfig();
    writeJson(res, { company });
    return;
  }

  if (req.method === 'PUT') {
    // Accept JSON body and persist to DB (upsert)
    let body: any;
    try {
      body = await readJsonNode(req);
    } catch {
      writeJson(res, { error: 'Invalid JSON' }, 400);
      return;
    }
    const allowed = ['name', 'address', 'phone', 'email', 'website', 'notes'];
    const payload: any = {};
    for (const k of allowed) {
      if (k in body) payload[k] = body[k] === '' ? null : body[k];
    }
    try {
      const sql = getSql();
      const existing = await sql`select id, name, address, phone, email, website, notes from company_config order by id desc limit 1` as Array<any>;
      if (existing && existing.length) {
        const id = existing[0].id;
        await sql`
          update company_config set
            name = ${payload.name || existing[0].name},
            address = ${payload.address || existing[0].address},
            phone = ${payload.phone ?? existing[0].phone},
            email = ${payload.email ?? existing[0].email},
            website = ${payload.website ?? existing[0].website},
            notes = ${payload.notes ?? existing[0].notes},
            updated_at = now()
          where id = ${id}
        `;
        const rows = await sql`select id, name, address, phone, email, website, notes from company_config where id = ${id} limit 1` as Array<any>;
        writeJson(res, { company: rows[0] });
        return;
      }
      const insert = await sql`
        insert into company_config (name, address, phone, email, website, notes) values (
          ${payload.name || null}, ${payload.address || null}, ${payload.phone || null}, ${payload.email || null}, ${payload.website || null}, ${payload.notes || null}
        ) returning id, name, address, phone, email, website, notes
      ` as Array<any>;
      writeJson(res, { company: insert[0] }, 201);
      return;
    } catch (e) {
      console.error('company PUT DB error', e);
      writeJson(res, { error: 'Failed to save' }, 500);
      return;
    }
  }
  res.writeHead(404, corsHeaders);
  res.end();
  return;
}
