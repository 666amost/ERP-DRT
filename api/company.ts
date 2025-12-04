export const config = { runtime: 'nodejs' };

import { getCompanyConfig, getSql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS, PUT',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  if (req.method === 'GET') {
    try {
      const sql = getSql();
      const rows = await sql`select id, name, address, phone, email, website, notes from company_config order by id desc limit 1` as Array<any>;
      if (rows && rows.length) {
        const company = rows[0];
        try {
          const detailedRows = await sql`select id, name, address, phone, email, website, notes, bank_name, bank_account, account_holder from company_config where id = ${company.id} limit 1` as Array<any>;
          if (detailedRows && detailedRows.length) {
            writeJson(res, { company: detailedRows[0] });
            return;
          }
        } catch (bankErr) {
          console.warn('Bank columns query failed, using basic columns:', bankErr);
        }
        writeJson(res, { company });
        return;
      }
    } catch (e) {
      console.error('company GET DB error:', e);
    }
    const company = getCompanyConfig();
    writeJson(res, { company });
    return;
  }

  if (req.method === 'PUT') {
    let body: any;
    try {
      body = await readJsonNode(req);
    } catch (err) {
      console.warn('company PUT invalid JSON', err);
      writeJson(res, { error: 'Invalid JSON' }, 400);
      return;
    }

    const allowed = ['name', 'address', 'phone', 'email', 'website', 'notes', 'bank_name', 'bank_account', 'account_holder'];
    const payload: any = {};
    for (const k of allowed) {
      if (k in body) {
        payload[k] = body[k] === '' ? null : body[k];
      }
    }

    try {
      const sql = getSql();
      const existing = await sql`select id, name, address, phone, email, website, notes from company_config order by id desc limit 1` as Array<any>;
      
      if (existing && existing.length) {
        const id = existing[0].id;
        
        const name = payload.name ?? existing[0].name;
        const address = payload.address ?? existing[0].address;
        const phone = payload.phone ?? existing[0].phone;
        const email = payload.email ?? existing[0].email;
        const website = payload.website ?? existing[0].website;
        const notes = payload.notes ?? existing[0].notes;
        const bank_name = payload.bank_name ?? null;
        const bank_account = payload.bank_account ?? null;
        const account_holder = payload.account_holder ?? null;

        try {
          await sql`
            update company_config set
              name = ${name},
              address = ${address},
              phone = ${phone},
              email = ${email},
              website = ${website},
              notes = ${notes},
              bank_name = ${bank_name},
              bank_account = ${bank_account},
              account_holder = ${account_holder},
              updated_at = now()
            where id = ${id}
          `;
        } catch (updateErr: any) {
          if (updateErr.code === '42703') {
            console.warn('Bank columns do not exist yet, updating without them');
            await sql`
              update company_config set
                name = ${name},
                address = ${address},
                phone = ${phone},
                email = ${email},
                website = ${website},
                notes = ${notes},
                updated_at = now()
              where id = ${id}
            `;
          } else {
            throw updateErr;
          }
        }

        try {
          const result = await sql`select id, name, address, phone, email, website, notes, bank_name, bank_account, account_holder from company_config where id = ${id} limit 1` as Array<any>;
          if (result && result.length) {
            writeJson(res, { company: result[0] });
            return;
          }
        } catch {
          const basicResult = await sql`select id, name, address, phone, email, website, notes from company_config where id = ${id} limit 1` as Array<any>;
          if (basicResult && basicResult.length) {
            writeJson(res, { company: basicResult[0] });
            return;
          }
        }
      } else {
        const name = payload.name || null;
        const address = payload.address || null;
        const phone = payload.phone || null;
        const email = payload.email || null;
        const website = payload.website || null;
        const notes = payload.notes || null;
        const bank_name = payload.bank_name || null;
        const bank_account = payload.bank_account || null;
        const account_holder = payload.account_holder || null;

        try {
          const insert = await sql`
            insert into company_config (name, address, phone, email, website, notes, bank_name, bank_account, account_holder) 
            values (${name}, ${address}, ${phone}, ${email}, ${website}, ${notes}, ${bank_name}, ${bank_account}, ${account_holder})
            returning id, name, address, phone, email, website, notes, bank_name, bank_account, account_holder
          ` as Array<any>;
          writeJson(res, { company: insert[0] }, 201);
          return;
        } catch (insertErr: any) {
          if (insertErr.code === '42703') {
            console.warn('Bank columns do not exist yet, inserting without them');
            const insert = await sql`
              insert into company_config (name, address, phone, email, website, notes) 
              values (${name}, ${address}, ${phone}, ${email}, ${website}, ${notes})
              returning id, name, address, phone, email, website, notes
            ` as Array<any>;
            writeJson(res, { company: insert[0] }, 201);
            return;
          } else {
            throw insertErr;
          }
        }
      }
      
      writeJson(res, { error: 'Unable to save company' }, 500);
    } catch (e) {
      console.error('company PUT error:', e);
      writeJson(res, { error: 'Failed to save' }, 500);
    }
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end();
}
