export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
import type { Sql } from './_lib/db.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { readJsonNode, writeJson } from './_lib/http.js';

type Invoice = {
  id: number;
  shipment_id: number | null;
  dbl_id: number | null;
  invoice_number: string;
  spb_number: string | null;
  customer_name: string;
  customer_id: number | null;
  amount: number;
  subtotal: number;
  pph_percent: number;
  pph_amount: number;
  total_tagihan: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  issued_at: string;
  invoice_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  bank_account: string | null;
  transfer_date: string | null;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string | null;
  shipment_count?: number;
  sj_returned_count?: number;
  sj_pending_count?: number;
  sj_all_returned?: boolean | null;
};

type InvoicePayment = {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  bank_account: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
};

type PaymentHistory = {
  id: number;
  invoice_id: number;
  invoice_number: string | null;
  customer_name: string | null;
  original_amount: number;
  discount: number;
  final_amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
};

// eslint-disable-next-line no-unused-vars
type TxRunner = <T>(_fn: (_sql: Sql) => Promise<T>) => Promise<T>;

type InvoiceItem = {
  id?: number;
  invoice_id?: number;
  shipment_id?: number | null;
  spb_number?: string | null;
  description: string;
  quantity: number;
  colli?: number | null;
  qty?: number | null;
  unit_price: number;
  other_fee?: number;
  tax_type?: string;
  item_discount?: number;
  sj_returned?: boolean;
  unit?: string | null;
  pengirim_name?: string | null;
  recipient_name?: string | null;
  weight?: number | null;
};

type NormalizedItem = {
  shipment_id: number | null;
  spb_number: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  other_fee: number;
  tax_type: string;
  item_discount: number;
  sj_returned: boolean;
};

type CreateInvoiceBody = {
  shipment_id?: number;
  spb_number?: string;
  dbl_id?: number;
  customer_name?: string;
  customer_id?: number;
  amount: number;
  subtotal?: number;
  pph_percent?: number;
  pph_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  status?: string;
  payment_method?: string;
  payment_notes?: string;
  invoice_date?: string;
  due_date?: string;
  bank_account?: string;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
  items?: {
    shipment_id?: number | null;
    spb_number?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    other_fee?: number;
    tax_type?: string;
    item_discount?: number;
    sj_returned?: boolean;
    customer_name?: string;
    customer_id?: number;
  }[];
};

type UpdateInvoiceBody = {
  id: number;
  spb_number?: string;
  customer_name?: string;
  customer_id?: number;
  amount?: number;
  subtotal?: number;
  pph_percent?: number;
  pph_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  status?: string;
  invoice_date?: string;
  due_date?: string;
  bank_account?: string;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
};

type AddPaymentBody = {
  invoice_id: number;
  payment_date: string;
  amount: number;
  payment_method?: string;
  bank_account?: string;
  reference_no?: string;
  notes?: string;
};

type SettleCustomerBody = {
  customer_id?: number;
  customer_name?: string;
  payment_date: string;
  payment_method?: string;
  bank_account?: string;
  reference_no?: string;
  notes?: string;
};

type BulkSettleInvoicesBody = {
  invoice_ids: Array<number | string>;
  payment_date: string;
  payment_method?: string;
  bank_account?: string;
  reference_no?: string;
  notes?: string;
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

function isValidDateString(val?: string | null): val is string {
  return Boolean(val && /^\d{4}-\d{2}-\d{2}$/.test(val));
}

function parseSpbList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const nums = value
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(nums));
}

async function generateInvoiceNumber(sql: Sql): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  try {
    const res = await sql`select generate_invoice_number() as num` as [{ num: string }];
    if (res?.[0]?.num) return res[0].num;
  } catch (err) {
    console.warn('[invoices] generate_invoice_number() missing, fallback to local generator', err);
  }

  const maxResult = await sql`
    select invoice_number from invoices
    where invoice_number like ${prefix + '%'}
    order by invoice_number desc
    limit 1
    for update
  ` as [{ invoice_number: string }];

  let nextNum = 1;
  const lastNumber = maxResult[0]?.invoice_number;
  if (lastNumber) {
    const match = lastNumber.match(/INV-\d{4}-(\d+)/);
    if (match?.[1]) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
    const sql = getSql() as Sql & { begin?: TxRunner };

  if (endpoint === 'list' && req.method === 'GET') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const qRaw = url.searchParams.get('q') || url.searchParams.get('search');
    const search = qRaw && qRaw.trim() ? `%${qRaw.trim()}%` : null;
    const offset = (page - 1) * limit;
    
    let invoices: Invoice[];
    let total: number;
    
    if (status && ['partial', 'paid'].includes(status)) {
      invoices = await sql`
        select 
          i.id, i.shipment_id, i.dbl_id, i.invoice_number, i.spb_number, i.customer_name, i.customer_id,
          coalesce(i.amount, 0)::float as amount, 
          coalesce(i.subtotal, 0)::float as subtotal,
          coalesce(i.pph_percent, 0)::float as pph_percent,
          coalesce(i.pph_amount, 0)::float as pph_amount,
          coalesce(i.total_tagihan, i.amount, 0)::float as total_tagihan,
          coalesce(i.paid_amount, 0)::float as paid_amount,
          coalesce(i.remaining_amount, i.amount, 0)::float as remaining_amount,
          i.status, i.issued_at, i.invoice_date, i.due_date, i.paid_at, 
          i.bank_account, i.transfer_date, i.tax_percent, i.discount_amount, i.notes,
          coalesce(stats.shipment_count, 0)::int as shipment_count,
          coalesce(stats.returned_count, 0)::int as sj_returned_count,
          coalesce(stats.pending_count, 0)::int as sj_pending_count,
          case 
            when stats.shipment_count is null or stats.shipment_count = 0 then null
            when coalesce(stats.pending_count, 0) = 0 then true
            else false
          end as sj_all_returned
        from invoices i
        left join lateral (
          select 
            count(s.id)::int as shipment_count,
            count(*) filter (where coalesce(s.sj_returned, false))::int as returned_count,
            count(*) filter (where coalesce(s.sj_returned, false) = false)::int as pending_count
          from invoice_items ii
          left join shipments s on s.id = ii.shipment_id
          where ii.invoice_id = i.id
            and ii.shipment_id is not null
        ) as stats on true
        where i.status = ${status}
          and (
            ${search}::text is null
            or i.invoice_number ilike ${search}
            or i.customer_name ilike ${search}
            or i.spb_number ilike ${search}
            or coalesce(i.notes, '') ilike ${search}
            or i.status ilike ${search}
          )
        order by i.issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
        where status = ${status}
          and (
            ${search}::text is null
            or invoice_number ilike ${search}
            or customer_name ilike ${search}
            or spb_number ilike ${search}
            or coalesce(notes, '') ilike ${search}
            or status ilike ${search}
          )
      ` as [{ count: number }];
      
      total = countResult[0]?.count || 0;
    } else {
      invoices = await sql`
        select 
          i.id, i.shipment_id, i.dbl_id, i.invoice_number, i.spb_number, i.customer_name, i.customer_id,
          coalesce(i.amount, 0)::float as amount, 
          coalesce(i.subtotal, 0)::float as subtotal,
          coalesce(i.pph_percent, 0)::float as pph_percent,
          coalesce(i.pph_amount, 0)::float as pph_amount,
          coalesce(i.total_tagihan, i.amount, 0)::float as total_tagihan,
          coalesce(i.paid_amount, 0)::float as paid_amount,
          coalesce(i.remaining_amount, i.amount, 0)::float as remaining_amount,
          i.status, i.issued_at, i.invoice_date, i.due_date, i.paid_at, 
          i.bank_account, i.transfer_date, i.tax_percent, i.discount_amount, i.notes,
          coalesce(stats.shipment_count, 0)::int as shipment_count,
          coalesce(stats.returned_count, 0)::int as sj_returned_count,
          coalesce(stats.pending_count, 0)::int as sj_pending_count,
          case 
            when stats.shipment_count is null or stats.shipment_count = 0 then null
            when coalesce(stats.pending_count, 0) = 0 then true
            else false
          end as sj_all_returned
        from invoices i
        left join lateral (
          select 
            count(s.id)::int as shipment_count,
            count(*) filter (where coalesce(s.sj_returned, false))::int as returned_count,
            count(*) filter (where coalesce(s.sj_returned, false) = false)::int as pending_count
          from invoice_items ii
          left join shipments s on s.id = ii.shipment_id
          where ii.invoice_id = i.id
            and ii.shipment_id is not null
        ) as stats on true
        where (
          ${search}::text is null
          or i.invoice_number ilike ${search}
          or i.customer_name ilike ${search}
          or i.spb_number ilike ${search}
          or coalesce(i.notes, '') ilike ${search}
          or i.status ilike ${search}
        )
        order by i.issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
        where (
          ${search}::text is null
          or invoice_number ilike ${search}
          or customer_name ilike ${search}
          or spb_number ilike ${search}
          or coalesce(notes, '') ilike ${search}
          or status ilike ${search}
        )
      ` as [{ count: number }];
      
      total = countResult[0]?.count || 0;
    }
    
    writeJson(res, {
      items: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    return;
  } else if (endpoint === 'unpaid' && req.method === 'GET') {
    const DEFAULT_LIMIT = 1000;
    const MAX_LIMIT = 5000;
    const limit = clampInt(parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1, MAX_LIMIT);
    const customerId = parseInt(url.searchParams.get('customer_id') || '0', 10) || 0;
    const customerNameRaw = (url.searchParams.get('customer_name') || '').trim();
    const qRaw = url.searchParams.get('q') || url.searchParams.get('search');
    const search = qRaw && qRaw.trim() ? `%${qRaw.trim()}%` : null;

    let items: Invoice[];
    if (customerId) {
      items = await sql`
        select 
          i.id, i.shipment_id, i.dbl_id, i.invoice_number, i.spb_number, i.customer_name, i.customer_id,
          coalesce(i.amount, 0)::float as amount, 
          coalesce(i.subtotal, 0)::float as subtotal,
          coalesce(i.pph_percent, 0)::float as pph_percent,
          coalesce(i.pph_amount, 0)::float as pph_amount,
          coalesce(i.total_tagihan, i.amount, 0)::float as total_tagihan,
          coalesce(i.paid_amount, 0)::float as paid_amount,
          coalesce(i.remaining_amount, i.amount, 0)::float as remaining_amount,
          i.status, i.issued_at, i.invoice_date, i.due_date, i.paid_at, 
          i.bank_account, i.transfer_date, i.tax_percent, i.discount_amount, i.notes,
          coalesce(stats.shipment_count, 0)::int as shipment_count,
          coalesce(stats.returned_count, 0)::int as sj_returned_count,
          coalesce(stats.pending_count, 0)::int as sj_pending_count,
          case 
            when stats.shipment_count is null or stats.shipment_count = 0 then null
            when coalesce(stats.pending_count, 0) = 0 then true
            else false
          end as sj_all_returned
        from invoices i
        left join lateral (
          select 
            count(s.id)::int as shipment_count,
            count(*) filter (where coalesce(s.sj_returned, false))::int as returned_count,
            count(*) filter (where coalesce(s.sj_returned, false) = false)::int as pending_count
          from invoice_items ii
          left join shipments s on s.id = ii.shipment_id
          where ii.invoice_id = i.id
            and ii.shipment_id is not null
        ) as stats on true
        where i.customer_id = ${customerId}
          and coalesce(i.status, 'pending') in ('pending','partial','overdue')
          and coalesce(i.remaining_amount, i.amount, 0) > 0
          and (
            ${search}::text is null
            or i.invoice_number ilike ${search}
            or i.customer_name ilike ${search}
            or i.spb_number ilike ${search}
            or coalesce(i.notes, '') ilike ${search}
          )
        order by i.issued_at desc
        limit ${limit}
      ` as Invoice[];
    } else if (customerNameRaw) {
      items = await sql`
        select 
          i.id, i.shipment_id, i.dbl_id, i.invoice_number, i.spb_number, i.customer_name, i.customer_id,
          coalesce(i.amount, 0)::float as amount, 
          coalesce(i.subtotal, 0)::float as subtotal,
          coalesce(i.pph_percent, 0)::float as pph_percent,
          coalesce(i.pph_amount, 0)::float as pph_amount,
          coalesce(i.total_tagihan, i.amount, 0)::float as total_tagihan,
          coalesce(i.paid_amount, 0)::float as paid_amount,
          coalesce(i.remaining_amount, i.amount, 0)::float as remaining_amount,
          i.status, i.issued_at, i.invoice_date, i.due_date, i.paid_at, 
          i.bank_account, i.transfer_date, i.tax_percent, i.discount_amount, i.notes,
          coalesce(stats.shipment_count, 0)::int as shipment_count,
          coalesce(stats.returned_count, 0)::int as sj_returned_count,
          coalesce(stats.pending_count, 0)::int as sj_pending_count,
          case 
            when stats.shipment_count is null or stats.shipment_count = 0 then null
            when coalesce(stats.pending_count, 0) = 0 then true
            else false
          end as sj_all_returned
        from invoices i
        left join lateral (
          select 
            count(s.id)::int as shipment_count,
            count(*) filter (where coalesce(s.sj_returned, false))::int as returned_count,
            count(*) filter (where coalesce(s.sj_returned, false) = false)::int as pending_count
          from invoice_items ii
          left join shipments s on s.id = ii.shipment_id
          where ii.invoice_id = i.id
            and ii.shipment_id is not null
        ) as stats on true
        where lower(coalesce(i.customer_name,'')) = lower(${customerNameRaw})
          and coalesce(i.status, 'pending') in ('pending','partial','overdue')
          and coalesce(i.remaining_amount, i.amount, 0) > 0
          and (
            ${search}::text is null
            or i.invoice_number ilike ${search}
            or i.customer_name ilike ${search}
            or i.spb_number ilike ${search}
            or coalesce(i.notes, '') ilike ${search}
          )
        order by i.issued_at desc
        limit ${limit}
      ` as Invoice[];
    } else {
      items = await sql`
        select 
          i.id, i.shipment_id, i.dbl_id, i.invoice_number, i.spb_number, i.customer_name, i.customer_id,
          coalesce(i.amount, 0)::float as amount, 
          coalesce(i.subtotal, 0)::float as subtotal,
          coalesce(i.pph_percent, 0)::float as pph_percent,
          coalesce(i.pph_amount, 0)::float as pph_amount,
          coalesce(i.total_tagihan, i.amount, 0)::float as total_tagihan,
          coalesce(i.paid_amount, 0)::float as paid_amount,
          coalesce(i.remaining_amount, i.amount, 0)::float as remaining_amount,
          i.status, i.issued_at, i.invoice_date, i.due_date, i.paid_at, 
          i.bank_account, i.transfer_date, i.tax_percent, i.discount_amount, i.notes,
          coalesce(stats.shipment_count, 0)::int as shipment_count,
          coalesce(stats.returned_count, 0)::int as sj_returned_count,
          coalesce(stats.pending_count, 0)::int as sj_pending_count,
          case 
            when stats.shipment_count is null or stats.shipment_count = 0 then null
            when coalesce(stats.pending_count, 0) = 0 then true
            else false
          end as sj_all_returned
        from invoices i
        left join lateral (
          select 
            count(s.id)::int as shipment_count,
            count(*) filter (where coalesce(s.sj_returned, false))::int as returned_count,
            count(*) filter (where coalesce(s.sj_returned, false) = false)::int as pending_count
          from invoice_items ii
          left join shipments s on s.id = ii.shipment_id
          where ii.invoice_id = i.id
            and ii.shipment_id is not null
        ) as stats on true
        where coalesce(i.status, 'pending') in ('pending','partial','overdue')
          and coalesce(i.remaining_amount, i.amount, 0) > 0
          and (
            ${search}::text is null
            or i.invoice_number ilike ${search}
            or i.customer_name ilike ${search}
            or i.spb_number ilike ${search}
            or coalesce(i.notes, '') ilike ${search}
          )
        order by i.issued_at desc
        limit ${limit}
      ` as Invoice[];
    }

    writeJson(res, { items });
    return;
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateInvoiceBody;
    
    try { body = await readJsonNode(req) as CreateInvoiceBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.customer_name && !body.customer_id) {
      const itemCustomer = body.items?.find((it) => it?.customer_name || it?.customer_id);
      if (itemCustomer?.customer_name) body.customer_name = itemCustomer.customer_name;
      if (!body.customer_id && itemCustomer?.customer_id) body.customer_id = itemCustomer.customer_id;
    }
    
    if (!body.customer_name && !body.customer_id) { writeJson(res, { error: 'Customer harus diisi' }, 400); return; }
    
    const rawItems = Array.isArray(body.items) ? body.items.filter(Boolean) : [];
    const itemsForCalc: NormalizedItem[] = rawItems.map((it) => ({
      shipment_id: it?.shipment_id ?? null,
      spb_number: it?.spb_number?.trim() || null,
      description: it?.description || 'Jasa pengiriman',
      quantity: Number(it?.quantity || 1),
      unit_price: Number(it?.unit_price || 0),
      other_fee: Number(it?.other_fee || 0),
      tax_type: it?.tax_type || 'include',
      item_discount: Number(it?.item_discount || 0),
      sj_returned: Boolean(it?.sj_returned)
    }));
    const spbFromHeader = parseSpbList(body.spb_number);
    
    const runInTxn = sql.begin
      ? sql.begin.bind(sql)
      // eslint-disable-next-line no-unused-vars
      : async <T>(fn: (_client: Sql) => Promise<T>) => {
          const client = getSql();
          try {
            await client`begin`;
            const result = await fn(client);
            await client`commit`;
            return result;
          } catch (e) {
            try { await client`rollback`; } catch { /* ignore rollback errors */ }
            throw e;
          }
        };
    
    try {
      const { id: invoiceId, invoiceNumber } = await runInTxn(async (trx: Sql) => {
        const invoiceNumber = await generateInvoiceNumber(trx);
        
        let customerName = body.customer_name;
        let customerId = body.customer_id || null;
        if (!customerName && customerId) {
          const c = await trx`select name from customers where id = ${customerId}` as [{ name: string }];
          if (!c.length) { throw new Error('CUSTOMER_NOT_FOUND'); }
          customerName = c[0].name;
        }
        if (!customerName) {
          const fallbackName = rawItems.find((it) => it?.customer_name)?.customer_name;
          if (fallbackName) customerName = fallbackName;
        }
        if (!customerId) {
          const fallbackId = rawItems.find((it) => it?.customer_id)?.customer_id;
          if (fallbackId) customerId = fallbackId;
        }
        
        const spbNumbersToLookup = Array.from(new Set(itemsForCalc.filter((it) => !it.shipment_id && it.spb_number).map((it) => it.spb_number as string)));
        const spbLookup: Record<string, number> = {};
        if (spbNumbersToLookup.length > 0) {
          const found = await trx`
            select spb_number, id from shipments
            where spb_number = any(${spbNumbersToLookup})
          ` as { spb_number: string; id: number }[];
          for (const row of found) {
            if (row.spb_number) spbLookup[row.spb_number] = row.id;
          }
        }
        
        const normalizedItems: NormalizedItem[] = itemsForCalc.map((it) => ({
          ...it,
          shipment_id: it.shipment_id || (it.spb_number ? (spbLookup[it.spb_number] || null) : null)
        }));
        
        const existingSpbSet = new Set(
          normalizedItems
            .map((it) => (it.spb_number || '').toLowerCase())
            .filter(Boolean)
        );
        const extraSpb = spbFromHeader
          .map((s) => s.toLowerCase())
          .filter((s) => !!s && !existingSpbSet.has(s));
        if (extraSpb.length > 0) {
          const extraRows = await trx`
            select id, spb_number, coalesce(nominal, 0)::float as nominal, coalesce(customer_name, '') as customer_name
            from shipments
            where lower(spb_number) = any(${extraSpb})
          ` as { id: number; spb_number: string | null; nominal: number; customer_name: string | null }[];
          for (const row of extraRows) {
            if (!row.spb_number) continue;
            normalizedItems.push({
              shipment_id: row.id || null,
              spb_number: row.spb_number,
              description: 'Jasa pengiriman',
              quantity: 1,
              unit_price: row.nominal || 0,
              other_fee: 0,
              tax_type: 'include',
              item_discount: 0,
              sj_returned: false
            });
            existingSpbSet.add(row.spb_number.toLowerCase());
          }
        }
        
        let spb: string | null = body.spb_number || null;
        if (!spb && body.shipment_id) {
          const s = await trx`select spb_number from shipments where id = ${body.shipment_id}` as [{ spb_number: string | null }];
          spb = s[0]?.spb_number || null;
        }
        const spbSet = new Map<string, string>();
        const addSpbNumber = (value?: string | null): void => {
          const clean = (value || '').trim();
          if (!clean) return;
          const key = clean.toLowerCase();
          if (!spbSet.has(key)) spbSet.set(key, clean);
        };
        normalizedItems.forEach((it) => addSpbNumber(it.spb_number));
        spbFromHeader.forEach((val) => addSpbNumber(val));
        if (!spb && spbSet.size > 0) {
          spb = Array.from(spbSet.values()).join(', ');
        }
        
        if (normalizedItems.length === 0) {
          throw new Error('INVALID_ITEMS');
        }
        
        const discountAmount = Number(body.discount_amount || 0);
        // unit_price already represents the line total, so avoid multiplying by quantity again
        const subtotalFromItems = normalizedItems.reduce((sum, it) => {
          const lineTotal = (it.unit_price || 0) + (it.other_fee || 0) - (it.item_discount || 0);
          return sum + lineTotal;
        }, 0);
        const subtotalAfterDiscount = Math.max(0, subtotalFromItems - discountAmount);
        const pphPercentVal = Number(body.pph_percent || 0);
        const pphAmountCalc = pphPercentVal > 0 ? (subtotalAfterDiscount * pphPercentVal / 100) : 0;
        const calculatedTotal = Math.max(0, subtotalAfterDiscount - pphAmountCalc);
        const totalTagihan = calculatedTotal > 0 ? calculatedTotal : Math.max(0, Number(body.amount || 0));
        if (!totalTagihan || totalTagihan <= 0) {
          throw new Error('INVALID_TOTAL');
        }
        
        let status = body.status || 'pending';
        let paidAmount = Math.max(0, Number(body.paid_amount || 0));
        if (status === 'paid' && paidAmount === 0) {
          paidAmount = totalTagihan;
        }
        const remainingAmount = body.remaining_amount !== undefined ? Math.max(0, Number(body.remaining_amount)) : Math.max(0, totalTagihan - paidAmount);
        if (remainingAmount <= 0 && paidAmount > 0) status = 'paid';
        else if (paidAmount > 0) status = 'partial';
        else if (!status) status = 'pending';
        
        const result = await trx`
          insert into invoices (
            shipment_id, invoice_number, spb_number, customer_name, customer_id, 
            amount, subtotal, pph_percent, pph_amount, total_tagihan,
            tax_percent, discount_amount,
            paid_amount, remaining_amount, status, issued_at, notes
          ) values (
            ${normalizedItems[0]?.shipment_id || body.shipment_id || null},
            ${invoiceNumber},
            ${spb},
            ${customerName},
            ${customerId},
            ${totalTagihan},
            ${subtotalFromItems > 0 ? subtotalFromItems : totalTagihan},
            ${pphPercentVal},
            ${pphAmountCalc},
            ${totalTagihan},
            ${body.tax_percent || 0},
            ${discountAmount},
            ${paidAmount},
            ${remainingAmount},
            ${status},
            now(),
            ${body.notes || null}
          )
          returning id
        ` as [{ id: number }];
        
        const newInvoiceId = result[0].id;
        
        if (normalizedItems.length > 0) {
          const shipmentIds = normalizedItems.map((it) => it.shipment_id);
          const descriptions = normalizedItems.map((it) => it.description);
          const quantities = normalizedItems.map((it) => it.quantity || 1);
          const unitPrices = normalizedItems.map((it) => it.unit_price || 0);
          const otherFees = normalizedItems.map((it) => it.other_fee || 0);
          const taxTypes = normalizedItems.map((it) => it.tax_type || 'include');
          const discounts = normalizedItems.map((it) => it.item_discount || 0);
          
          await trx`
            insert into invoice_items (invoice_id, shipment_id, description, quantity, unit_price, other_fee, tax_type, item_discount)
            select ${newInvoiceId}, * from unnest(
              ${shipmentIds}::bigint[],
              ${descriptions}::text[],
              ${quantities}::numeric[],
              ${unitPrices}::numeric[],
              ${otherFees}::numeric[],
              ${taxTypes}::text[],
              ${discounts}::numeric[]
            ) as t(shipment_id, description, quantity, unit_price, other_fee, tax_type, item_discount)
          `;
          
          const shipmentsToUpdate = normalizedItems.filter((it) => it.shipment_id);
          if (shipmentsToUpdate.length > 0) {
            const updateIds = shipmentsToUpdate.map((it) => it.shipment_id as number);
            const updateSjReturned = shipmentsToUpdate.map((it) => Boolean(it.sj_returned));
            await trx`
              with data as (
                select * from unnest(${updateIds}::bigint[], ${updateSjReturned}::boolean[]) as t(id, sj_returned)
              )
              update shipments s
              set sj_returned = d.sj_returned,
                  sj_returned_at = case when d.sj_returned then coalesce(sj_returned_at, now()) else null end
              from data d
              where s.id = d.id
            `;
          }
        }
        
        if (paidAmount > 0) {
          const methodRaw = String(body.payment_method || '').trim().toUpperCase();
          const allowedMethods = new Set([
            'TRANSFER',
            'CASH',
            'GIRO',
            'CHEQUE',
            'CICILAN',
            'CASH BALI',
            'CASH JAKARTA',
            'TF BALI',
            'TF JAKARTA',
            'TRANSFER ALI'
          ]);
          const paymentMethod = allowedMethods.has(methodRaw) ? methodRaw : 'TRANSFER';
          const paymentNotes =
            (typeof body.payment_notes === 'string' ? body.payment_notes : null) ??
            (typeof body.notes === 'string' ? body.notes : null) ??
            '';
          await trx`
            insert into invoice_payments (invoice_id, amount, payment_date, payment_method, notes)
            values (${newInvoiceId}, ${paidAmount}, now(), ${paymentMethod}, ${String(paymentNotes).trim() || null})
          `;
        }
        
        return { id: newInvoiceId, invoiceNumber };
      });
      
      writeJson(res, { id: invoiceId, invoice_number: invoiceNumber }, 201);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'CUSTOMER_NOT_FOUND') {
        writeJson(res, { error: 'Invalid customer_id' }, 400);
        return;
      }
      if (msg === 'INVALID_TOTAL') {
        writeJson(res, { error: 'Nominal/Amount harus diisi dan lebih dari 0' }, 400);
        return;
      }
      if (msg === 'INVALID_ITEMS') {
        writeJson(res, { error: 'Minimal 1 SPB harus dipilih' }, 400);
        return;
      }
      console.error('Invoices API error (create):', err);
      writeJson(res, { error: 'Internal server error' }, 500);
      return;
    }
  } else if (endpoint === 'update' && req.method === 'PUT') {
    let body: UpdateInvoiceBody;
    
    try { body = await readJsonNode(req) as UpdateInvoiceBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.id) { writeJson(res, { error: 'Missing id' }, 400); return; }
    
    let customerName = body.customer_name;
    let customerId = body.customer_id;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }

    const current = await sql`
      select amount, subtotal, pph_percent, pph_amount, paid_amount, remaining_amount, status 
      from invoices where id = ${body.id}
    ` as [{ amount: number; subtotal: number; pph_percent: number; pph_amount: number; paid_amount: number; remaining_amount: number; status: string }];
    
    if (!current.length) { writeJson(res, { error: 'Invoice not found' }, 404); return; }

    const newAmount = body.amount !== undefined ? Number(body.amount) : Number(current[0].amount || 0);
    const newSubtotal = body.subtotal !== undefined ? Number(body.subtotal) : Number(current[0].subtotal || newAmount);
    const newPphPercent = body.pph_percent !== undefined ? Number(body.pph_percent) : Number(current[0].pph_percent || 0);
    const newPphAmount = body.pph_amount !== undefined ? Number(body.pph_amount) : Number(current[0].pph_amount || 0);
    const newPaidAmount = body.paid_amount !== undefined ? Number(body.paid_amount) : Number(current[0].paid_amount || 0);
    const newRemaining = body.remaining_amount !== undefined ? Number(body.remaining_amount) : Math.max(0, newAmount - newPaidAmount);
    
    let newStatus = body.status || current[0].status;
    if (newRemaining <= 0 && newPaidAmount > 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0 && newRemaining > 0) {
      newStatus = 'partial';
    } else if (newPaidAmount === 0) {
      newStatus = 'pending';
    }

    if (newStatus === 'paid') {
      await sql`
        update invoices set
          spb_number = coalesce(${body.spb_number || null}, spb_number),
          customer_name = coalesce(${customerName || null}, customer_name),
          customer_id = coalesce(${customerId || null}, customer_id),
          amount = ${newAmount},
          subtotal = ${newSubtotal},
          pph_percent = ${newPphPercent},
          pph_amount = ${newPphAmount},
          total_tagihan = ${newAmount},
          paid_amount = ${newPaidAmount},
          remaining_amount = ${newRemaining},
          notes = ${body.notes !== undefined ? (body.notes || null) : null},
          status = ${newStatus},
          paid_at = coalesce(paid_at, now())
        where id = ${body.id}
      `;
    } else {
      await sql`
        update invoices set
          spb_number = coalesce(${body.spb_number || null}, spb_number),
          customer_name = coalesce(${customerName || null}, customer_name),
          customer_id = coalesce(${customerId || null}, customer_id),
          amount = ${newAmount},
          subtotal = ${newSubtotal},
          pph_percent = ${newPphPercent},
          pph_amount = ${newPphAmount},
          total_tagihan = ${newAmount},
          paid_amount = ${newPaidAmount},
          remaining_amount = ${newRemaining},
          notes = ${body.notes !== undefined ? (body.notes || null) : null},
          status = ${newStatus}
        where id = ${body.id}
      `;
    }

    writeJson(res, { success: true });
    return;
  } else if (endpoint === 'items' && req.method === 'GET') {
    const invoiceId = parseInt(url.searchParams.get('invoice_id') || '0');
    if (!invoiceId) { writeJson(res, { error: 'Missing invoice_id' }, 400); return; }
    const items = await sql`
      select 
        ii.id, 
        ii.invoice_id, 
        ii.shipment_id,
        ii.description, 
        ii.quantity::float as quantity, 
        coalesce(s.total_colli, ii.quantity)::float as colli,
        coalesce(s.qty, ii.quantity)::float as qty,
        ii.unit_price::float as unit_price, 
        coalesce(ii.other_fee, 0)::float as other_fee,
        ii.tax_type,
        ii.item_discount::float as item_discount,
        s.spb_number,
        s.public_code as tracking_code,
        s.satuan as unit,
        s.pengirim_name,
        s.penerima_name as recipient_name,
        s.berat::float as weight,
        s.sj_returned
      from invoice_items ii
      left join shipments s on ii.shipment_id = s.id
      where ii.invoice_id = ${invoiceId}
      order by ii.id
    ` as (InvoiceItem & { spb_number?: string; tracking_code?: string })[];
    writeJson(res, { items });
    return;
  } else if (endpoint === 'set-items' && req.method === 'POST') {
    let body: { invoice_id: number; items: (InvoiceItem & { id?: number })[]; tax_percent?: number; discount_amount?: number; notes?: string };
    try { body = await readJsonNode(req) as { invoice_id: number; items: (InvoiceItem & { id?: number })[]; tax_percent?: number; discount_amount?: number; notes?: string }; } catch { body = null as any; }
    if (!body || !body.invoice_id) { writeJson(res, { error: 'Missing invoice_id' }, 400); return; }

    await sql`delete from invoice_items where invoice_id = ${body.invoice_id}`;
    const itemsToInsert = body.items || [];
    let insertedCount = 0;
    const spbLookup: Record<string, number> = {};
    for (const it of itemsToInsert) {
      if (!it) continue;
      const desc = it.description || 'Jasa pengiriman';
      let shipmentId = it.shipment_id || null;
      if (!shipmentId && it.spb_number) {
        const spbKey = it.spb_number.trim();
        if (spbLookup[spbKey] !== undefined) {
          shipmentId = spbLookup[spbKey] || null;
        } else {
          const found = await sql`select id from shipments where spb_number = ${spbKey} limit 1` as { id: number }[];
          shipmentId = found[0]?.id || null;
          spbLookup[spbKey] = shipmentId || 0;
        }
      }
      await sql`insert into invoice_items (invoice_id, shipment_id, description, quantity, unit_price, other_fee, tax_type, item_discount) values (${body.invoice_id}, ${shipmentId}, ${desc}, ${it.quantity || 1}, ${it.unit_price || 0}, ${it.other_fee || 0}, ${it.tax_type || 'include'}, ${it.item_discount || 0})`;
      insertedCount++;
      if (shipmentId) {
        const sjReturned = Boolean(it.sj_returned);
        await sql`
          update shipments 
          set sj_returned = ${sjReturned},
              sj_returned_at = case when ${sjReturned} then coalesce(sj_returned_at, now()) else null end
          where id = ${shipmentId}
        `;
      }
    }
    console.log(`[set-items] invoice_id=${body.invoice_id}, received=${itemsToInsert.length}, inserted=${insertedCount}`);
    // unit_price is stored as the total per line, so ignore quantity when recalculating subtotal
    const rows = await sql`
      select coalesce(sum((unit_price + coalesce(other_fee,0)) - coalesce(item_discount,0)),0)::float as subtotal 
      from invoice_items 
      where invoice_id = ${body.invoice_id}
    ` as [{ subtotal: number }];
    const subtotal = rows[0]?.subtotal || 0;
    
    const inv = await sql`select paid_amount, pph_percent, pph_amount from invoices where id = ${body.invoice_id}` as [{ paid_amount: number; pph_percent: number; pph_amount: number }];
    const paidAmount = Number(inv[0]?.paid_amount || 0);
    const pphPercent = Number(inv[0]?.pph_percent || 0);
    const discountAmount = Number(body.discount_amount || 0);
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const pphAmount = pphPercent > 0 ? (subtotalAfterDiscount * pphPercent / 100) : 0;
    const totalTagihan = subtotalAfterDiscount - pphAmount;
    const remainingAmount = Math.max(0, totalTagihan - paidAmount);
    
    let status = 'pending';
    if (remainingAmount <= 0 && paidAmount > 0) status = 'paid';
    else if (paidAmount > 0) status = 'partial';
    
    await sql`update invoices set 
      amount = ${totalTagihan}, 
      subtotal = ${subtotal},
      pph_amount = ${pphAmount},
      total_tagihan = ${totalTagihan},
      remaining_amount = ${remainingAmount},
      status = ${status},
      tax_percent = ${body.tax_percent || 0}, 
      discount_amount = ${discountAmount}, 
      notes = ${body.notes || null} 
    where id = ${body.invoice_id}`;
    writeJson(res, { success: true, subtotal, total: totalTagihan, remaining_amount: remainingAmount });
    return;
  } else if (endpoint === 'delete' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    
    if (!id) { writeJson(res, { error: 'Missing id' }, 400); return; }
    
    await sql`delete from invoices where id = ${parseInt(id)}`;
    
    writeJson(res, { success: true });
    return;
  } else if (endpoint === 'payments' && req.method === 'GET') {
    const invoiceId = parseInt(url.searchParams.get('invoice_id') || '0');
    if (!invoiceId) { writeJson(res, { error: 'Missing invoice_id' }, 400); return; }
    
    const payments = await sql`
      select id, invoice_id, payment_date, amount::float as amount, 
             payment_method, bank_account, reference_no, notes, created_at
      from invoice_payments 
      where invoice_id = ${invoiceId}
      order by payment_date desc, created_at desc
    ` as InvoicePayment[];
    
    writeJson(res, { items: payments });
    return;
  } else if (endpoint === 'add-payment' && req.method === 'POST') {
    let body: AddPaymentBody;
    try { body = await readJsonNode(req) as AddPaymentBody; } catch { body = null as unknown as AddPaymentBody; }
    if (!body || !body.invoice_id || !body.amount || !body.payment_date) {
      writeJson(res, { error: 'Missing required fields (invoice_id, amount, payment_date)' }, 400);
      return;
    }

    const invCheck = await sql`select id, amount, total_tagihan, paid_amount, remaining_amount from invoices where id = ${body.invoice_id}` as Array<{ id: number; amount: number; total_tagihan: number; paid_amount: number; remaining_amount: number }>;
    if (!invCheck.length) { writeJson(res, { error: 'Invoice not found' }, 404); return; }

    const result = await sql`
      insert into invoice_payments (
        invoice_id, payment_date, amount, payment_method, bank_account, reference_no, notes
      ) values (
        ${body.invoice_id},
        ${body.payment_date},
        ${body.amount},
        ${body.payment_method || null},
        ${body.bank_account || null},
        ${body.reference_no || null},
        ${body.notes || null}
      ) returning id
    ` as [{ id: number }];

    const invoiceAmount = Number(invCheck[0]?.total_tagihan || invCheck[0]?.amount || 0);
    const currentPaid = Number(invCheck[0]?.paid_amount || 0);
    const newPaidAmount = currentPaid + Number(body.amount);
    const newRemainingAmount = Math.max(0, invoiceAmount - newPaidAmount);
    let newStatus = 'partial';
    if (newRemainingAmount <= 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    if (newStatus === 'paid') {
      await sql`
        update invoices set 
          paid_amount = ${newPaidAmount},
          remaining_amount = ${newRemainingAmount},
          status = ${newStatus},
          paid_at = now()
        where id = ${body.invoice_id}
      `;
    } else {
      await sql`
        update invoices set 
          paid_amount = ${newPaidAmount},
          remaining_amount = ${newRemainingAmount},
          status = ${newStatus}
        where id = ${body.invoice_id}
      `;
    }

    writeJson(res, { id: result[0].id, success: true, paid_amount: newPaidAmount, remaining_amount: newRemainingAmount, status: newStatus }, 201);
    return;
  } else if (endpoint === 'settle-customer' && req.method === 'POST') {
    let body: SettleCustomerBody;
    try { body = await readJsonNode(req) as SettleCustomerBody; } catch { body = null as unknown as SettleCustomerBody; }
    if (!body || !isValidDateString(body.payment_date)) {
      writeJson(res, { error: 'Invalid payment_date (YYYY-MM-DD)' }, 400);
      return;
    }

    const customerId = typeof body.customer_id === 'number' ? body.customer_id : parseInt(String(body.customer_id || 0), 10) || 0;
    const customerName = (body.customer_name || '').trim();
    if (!customerId && !customerName) {
      writeJson(res, { error: 'Missing customer_id or customer_name' }, 400);
      return;
    }

    const runInTxn = sql.begin
      ? sql.begin.bind(sql)
      // eslint-disable-next-line no-unused-vars
      : async <T>(fn: (_client: Sql) => Promise<T>) => {
          const client = getSql();
          try {
            await client`begin`;
            const result = await fn(client);
            await client`commit`;
            return result;
          } catch (e) {
            try { await client`rollback`; } catch { /* ignore rollback errors */ }
            throw e;
          }
        };

    const result = await runInTxn(async (trx: Sql) => {
      const targets = customerId
        ? await trx`
            select id, coalesce(total_tagihan, amount, 0)::float as total_tagihan,
                   coalesce(paid_amount, 0)::float as paid_amount
            from invoices
            where customer_id = ${customerId}
              and coalesce(status, 'pending') in ('pending','partial','overdue')
              and coalesce(remaining_amount, amount, 0) > 0
            for update
          ` as Array<{ id: number; total_tagihan: number; paid_amount: number }>
        : await trx`
            select id, coalesce(total_tagihan, amount, 0)::float as total_tagihan,
                   coalesce(paid_amount, 0)::float as paid_amount
            from invoices
            where lower(coalesce(customer_name,'')) = lower(${customerName})
              and coalesce(status, 'pending') in ('pending','partial','overdue')
              and coalesce(remaining_amount, amount, 0) > 0
            for update
          ` as Array<{ id: number; total_tagihan: number; paid_amount: number }>;

      let settledCount = 0;
      let totalPaid = 0;
      for (const inv of targets) {
        const remaining = Math.max(0, Number(inv.total_tagihan || 0) - Number(inv.paid_amount || 0));
        if (remaining <= 0) continue;

        await trx`
          insert into invoice_payments (
            invoice_id, payment_date, amount, payment_method, bank_account, reference_no, notes
          ) values (
            ${inv.id},
            ${body.payment_date},
            ${remaining},
            ${body.payment_method || null},
            ${body.bank_account || null},
            ${body.reference_no || null},
            ${body.notes || null}
          )
        `;

        await trx`
          update invoices set
            paid_amount = ${Number(inv.paid_amount || 0) + remaining},
            remaining_amount = 0,
            status = 'paid',
            paid_at = now()
          where id = ${inv.id}
        `;

        settledCount += 1;
        totalPaid += remaining;
      }

      return { settledCount, totalPaid };
    });

    writeJson(res, { success: true, settled_count: result.settledCount, total_paid: result.totalPaid });
    return;
  } else if (endpoint === 'bulk-settle' && req.method === 'POST') {
    let body: BulkSettleInvoicesBody;
    try { body = await readJsonNode(req) as BulkSettleInvoicesBody; } catch { body = null as unknown as BulkSettleInvoicesBody; }

    const invoiceIds = normalizeIdList(body?.invoice_ids);
    if (!body || invoiceIds.length === 0) {
      writeJson(res, { error: 'Missing invoice_ids' }, 400);
      return;
    }
    if (!isValidDateString(body.payment_date)) {
      writeJson(res, { error: 'Invalid payment_date (YYYY-MM-DD)' }, 400);
      return;
    }

    const runInTxn = sql.begin
      ? sql.begin.bind(sql)
      // eslint-disable-next-line no-unused-vars
      : async <T>(fn: (_client: Sql) => Promise<T>) => {
          const client = getSql();
          try {
            await client`begin`;
            const result = await fn(client);
            await client`commit`;
            return result;
          } catch (e) {
            try { await client`rollback`; } catch { /* ignore rollback errors */ }
            throw e;
          }
        };

    try {
      const result = await runInTxn(async (trx: Sql) => {
        const targets = await trx`
          select
            id,
            invoice_number,
            spb_number,
            customer_id,
            customer_name,
            coalesce(amount, 0)::float as amount,
            coalesce(subtotal, 0)::float as subtotal,
            coalesce(tax_percent, 0)::float as tax_percent,
            coalesce(discount_amount, 0)::float as discount_amount,
            coalesce(pph_percent, 0)::float as pph_percent,
            coalesce(pph_amount, 0)::float as pph_amount,
            coalesce(total_tagihan, amount, 0)::float as total_tagihan,
            coalesce(paid_amount, 0)::float as paid_amount,
            coalesce(remaining_amount, amount, 0)::float as remaining_amount
          from invoices
          where id = any(${invoiceIds})
          for update
        ` as Array<{
          id: number;
          invoice_number: string;
          spb_number: string | null;
          customer_id: number | null;
          customer_name: string | null;
          amount: number;
          subtotal: number;
          tax_percent: number;
          discount_amount: number;
          pph_percent: number;
          pph_amount: number;
          total_tagihan: number;
          paid_amount: number;
          remaining_amount: number;
        }>;

        if (targets.length !== invoiceIds.length) {
          throw new Error('INVOICE_NOT_FOUND');
        }

        const customerIds = new Set<number>();
        const customerNames = new Set<string>();
        for (const t of targets) {
          if (typeof t.customer_id === 'number') customerIds.add(t.customer_id);
          if (t.customer_name) customerNames.add(t.customer_name.trim().toLowerCase());
          if (Number(t.remaining_amount || 0) <= 0) throw new Error('NOT_OUTSTANDING');
        }
        if (customerIds.size > 1) throw new Error('MIXED_CUSTOMER');
        if (customerIds.size === 0 && customerNames.size > 1) throw new Error('MIXED_CUSTOMER');
        if (customerIds.size === 1 && customerNames.size > 1) {
          const primary = targets.find((t) => typeof t.customer_id === 'number')?.customer_name?.trim().toLowerCase();
          if (primary && !customerNames.has(primary)) throw new Error('MIXED_CUSTOMER');
        }

        const customerId = customerIds.size === 1 ? Array.from(customerIds)[0] : null;
        const customerName = (targets.find((t) => (t.customer_name || '').trim())?.customer_name || '').trim();
        if (!customerName && !customerId) throw new Error('MISSING_CUSTOMER');

        const taxPercents = new Set<number>(targets.map((t) => Number(t.tax_percent || 0)));
        const taxPercent = taxPercents.size === 1 ? Array.from(taxPercents)[0] : 0;

        const totalRemainingToPay = targets.reduce((sum, t) => sum + Math.max(0, Number(t.remaining_amount || 0)), 0);
        const subtotalSum = targets.reduce((sum, t) => sum + Number(t.subtotal || 0), 0);
        const discountSum = targets.reduce((sum, t) => sum + Number(t.discount_amount || 0), 0);
        const pphAmountSum = targets.reduce((sum, t) => sum + Number(t.pph_amount || 0), 0);
        const totalTagihanSum = targets.reduce((sum, t) => sum + Number(t.total_tagihan || t.amount || 0), 0);

        const invoiceNumber = await generateInvoiceNumber(trx);
        const invoiceNotes = body.notes && String(body.notes).trim() ? String(body.notes).trim() : null;

        const insertRes = await trx`
          insert into invoices (
            shipment_id, invoice_number, spb_number, customer_name, customer_id,
            amount, subtotal, pph_percent, pph_amount, total_tagihan,
            tax_percent, discount_amount,
            paid_amount, remaining_amount, status, issued_at, notes
          ) values (
            ${null},
            ${invoiceNumber},
            ${null},
            ${customerName},
            ${customerId},
            ${totalTagihanSum},
            ${subtotalSum > 0 ? subtotalSum : totalTagihanSum},
            ${0},
            ${pphAmountSum},
            ${totalTagihanSum},
            ${taxPercent},
            ${discountSum},
            ${totalTagihanSum},
            ${0},
            ${'paid'},
            now(),
            ${invoiceNotes}
          ) returning id
        ` as [{ id: number }];

        const newInvoiceId = insertRes[0].id;

        await trx`
          update invoice_items
          set invoice_id = ${newInvoiceId}
          where invoice_id = any(${invoiceIds})
        `;

        await trx`
          update invoice_payments
          set invoice_id = ${newInvoiceId}
          where invoice_id = any(${invoiceIds})
        `;
        await trx`delete from invoices where id = any(${invoiceIds})`;

        const spbAgg = await trx`
          select string_agg(distinct s.spb_number, ', ' order by s.spb_number) as spb
          from invoice_items ii
          join shipments s on s.id = ii.shipment_id
          where ii.invoice_id = ${newInvoiceId}
            and s.spb_number is not null
        ` as Array<{ spb: string | null }>;

        const fallbackSpb = Array.from(
          new Map(
            targets
              .flatMap((t) => parseSpbList(t.spb_number))
              .map((val) => [val.toLowerCase(), val] as const)
          ).values()
        ).join(', ');

        const spbNumber = spbAgg[0]?.spb || fallbackSpb || null;

        await trx`
          update invoices set
            spb_number = ${spbNumber},
            paid_at = now()
          where id = ${newInvoiceId}
        `;

        await trx`
          insert into invoice_payments (
            invoice_id, payment_date, amount, payment_method, bank_account, reference_no, notes
          ) values (
            ${newInvoiceId},
            ${body.payment_date},
            ${totalRemainingToPay},
            ${body.payment_method || null},
            ${body.bank_account || null},
            ${body.reference_no || null},
            ${body.notes || null}
          )
        `;

        return {
          id: newInvoiceId,
          invoice_number: invoiceNumber,
          merged_count: targets.length,
          total_paid: totalRemainingToPay
        };
      });

      writeJson(res, { success: true, ...result }, 201);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVOICE_NOT_FOUND') {
        writeJson(res, { error: 'Invoice tidak ditemukan' }, 404);
        return;
      }
      if (msg === 'MIXED_CUSTOMER') {
        writeJson(res, { error: 'Invoice yang dipilih harus 1 customer yang sama' }, 400);
        return;
      }
      if (msg === 'NOT_OUTSTANDING') {
        writeJson(res, { error: 'Ada invoice yang sudah tidak punya sisa' }, 400);
        return;
      }
      if (msg === 'MISSING_CUSTOMER') {
        writeJson(res, { error: 'Customer invoice tidak valid' }, 400);
        return;
      }
      console.error('Invoices API error (bulk-settle):', err);
      writeJson(res, { error: 'Internal server error' }, 500);
      return;
    }
  } else if (endpoint === 'delete-payment' && req.method === 'DELETE') {
    const paymentId = url.searchParams.get('payment_id') || url.searchParams.get('id');
    if (!paymentId) { writeJson(res, { error: 'Missing payment_id' }, 400); return; }

    await sql`delete from invoice_payments where id = ${parseInt(paymentId)}`;
    writeJson(res, { success: true });
    return;
  } else if (endpoint === 'update-pph' && req.method === 'PUT') {
    let body: { id?: number; invoice_id?: number; pph_percent: number };
    try { body = await readJsonNode(req) as { id?: number; invoice_id?: number; pph_percent: number }; } catch { body = null as unknown as { id?: number; invoice_id?: number; pph_percent: number }; }
    const invoiceId = body?.id || body?.invoice_id;
    if (!body || !invoiceId) { writeJson(res, { error: 'Missing id or invoice_id' }, 400); return; }

    const inv = await sql`select subtotal, paid_amount from invoices where id = ${invoiceId}` as [{ subtotal: number; paid_amount: number }];
    if (!inv.length) { writeJson(res, { error: 'Invoice not found' }, 404); return; }

    const subtotal = Number(inv[0].subtotal || 0);
    const paidAmount = Number(inv[0].paid_amount || 0);
    const pphPercent = body.pph_percent || 0;
    const pphAmount = pphPercent > 0 ? (subtotal * pphPercent / 100) : 0;
    const totalTagihan = subtotal - pphAmount;
    const remaining = totalTagihan - paidAmount;

    let status = 'pending';
    if (paidAmount >= totalTagihan) status = 'paid';
    else if (paidAmount > 0) status = 'partial';

    await sql`
      update invoices set 
        pph_percent = ${pphPercent},
        pph_amount = ${pphAmount},
        total_tagihan = ${totalTagihan},
        amount = ${totalTagihan},
        remaining_amount = ${remaining},
        status = ${status}
      where id = ${invoiceId}
    `;

    writeJson(res, { success: true, pph_amount: pphAmount, total_tagihan: totalTagihan, remaining_amount: remaining, status });
    return;
  } else if (endpoint === 'shipments' && req.method === 'GET') {
    const invoiceId = parseInt(url.searchParams.get('invoice_id') || '0');
    const dblId = parseInt(url.searchParams.get('dbl_id') || '0');
    
    if (!invoiceId && !dblId) { writeJson(res, { error: 'Missing invoice_id or dbl_id' }, 400); return; }

    let shipments;
    if (dblId) {
      const inv = await sql`select customer_name from invoices where id = ${invoiceId}` as [{ customer_name: string }];
      const customerName = inv[0]?.customer_name;
      
      if (customerName) {
        shipments = await sql`
          select s.id, s.spb_number, s.pengirim_name, s.penerima_name, s.macam_barang,
                 s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal, s.destination,
                 coalesce(s.sj_returned, false) as sj_returned
          from dbl_items di
          join shipments s on s.id = di.shipment_id
          where di.dbl_id = ${dblId} and s.customer_name = ${customerName}
          order by di.urutan
        `;
      } else {
        shipments = [];
      }
    } else {
      const inv = await sql`select dbl_id, customer_name from invoices where id = ${invoiceId}` as [{ dbl_id: number; customer_name: string }];
      if (inv[0]?.dbl_id) {
        shipments = await sql`
          select s.id, s.spb_number, s.pengirim_name, s.penerima_name, s.macam_barang,
                 s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal, s.destination,
                 coalesce(s.sj_returned, false) as sj_returned
          from dbl_items di
          join shipments s on s.id = di.shipment_id
          where di.dbl_id = ${inv[0].dbl_id} and s.customer_name = ${inv[0].customer_name}
          order by di.urutan
        `;
      } else {
        shipments = [];
      }
    }

    writeJson(res, { items: shipments });
    return;
  } else if (endpoint === 'outstanding' && req.method === 'GET') {
    const isValidDate = (val?: string | null): val is string => Boolean(val && /^\d{4}-\d{2}-\d{2}$/.test(val));
    const fromDateRaw = url.searchParams.get('from') || url.searchParams.get('start_date');
    const toDateRaw = url.searchParams.get('to') || url.searchParams.get('end_date');
    const fromDate = isValidDate(fromDateRaw) ? fromDateRaw : null;
    const toDate = isValidDate(toDateRaw) ? toDateRaw : null;

    const dateConditions: string[] = [];
    if (fromDate) dateConditions.push(`s.created_at >= '${fromDate}'::date`);
    if (toDate) dateConditions.push(`s.created_at < ('${toDate}'::date + interval '1 day')`);
    const dateClause = dateConditions.length ? ` and ${dateConditions.join(' and ')}` : '';

    const query = `
      select 
        s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
        s.pengirim_name, s.penerima_name,
        s.origin, s.destination, s.total_colli, 
        coalesce(s.berat, 0)::float as total_weight,
        coalesce(s.nominal, 0)::float as nominal,
        s.created_at,
        s.dbl_id, d.dbl_number, d.driver_name, d.driver_phone,
        d.vehicle_plate, d.dbl_date,
        coalesce(s.sj_returned, false) as sj_returned,
        coalesce(ii_inv.id, spb_inv.id) as invoice_id, 
        coalesce(ii_inv.invoice_number, spb_inv.invoice_number) as invoice_number,
        case 
          when ii_inv.id is null and spb_inv.id is null then coalesce(s.nominal, 0)
          when ii_inv.id is not null then
            case 
              when coalesce(ii_inv.subtotal, 0) > 0 then 
                round((coalesce(s.nominal, 0)::numeric / coalesce(ii_inv.subtotal, 1)::numeric) * coalesce(ii_inv.remaining_amount, ii_inv.amount, 0)::numeric, 2)
              else coalesce(ii_inv.remaining_amount, s.nominal, 0)
            end
          else coalesce(spb_inv.remaining_amount, s.nominal, 0)
        end::float as remaining_amount,
        coalesce(
          case when ii_inv.id is not null then ii_inv.status else spb_inv.status end,
          'no_invoice'
        ) as invoice_status
      from shipments s
      left join dbl d on d.id = s.dbl_id
      left join invoice_items ii on ii.shipment_id = s.id
      left join invoices ii_inv on ii_inv.id = ii.invoice_id
      left join invoices spb_inv on spb_inv.spb_number = s.spb_number and ii.id is null
      where s.nominal > 0${dateClause}
        and (
          (ii_inv.id is not null and coalesce(ii_inv.remaining_amount, 0) > 0)
          or (spb_inv.id is not null and coalesce(spb_inv.remaining_amount, 0) > 0)
          or (ii_inv.id is null and spb_inv.id is null)
        )
      group by s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
               s.pengirim_name, s.penerima_name,
               s.origin, s.destination, s.total_colli, s.berat, s.nominal, s.created_at,
               s.dbl_id, d.dbl_number, d.driver_name, d.driver_phone, d.vehicle_plate, d.dbl_date, s.sj_returned,
               ii_inv.id, ii_inv.invoice_number, ii_inv.remaining_amount, ii_inv.amount, ii_inv.subtotal, ii_inv.status,
               spb_inv.id, spb_inv.invoice_number, spb_inv.remaining_amount, spb_inv.status
      order by s.created_at desc
    ` as string;

    const items = await sql(query as never);
    writeJson(res, { items });
    return;
  } else if (endpoint === 'payment-history' && req.method === 'GET') {
    const isValidDate = (val?: string | null): val is string => Boolean(val && /^\d{4}-\d{2}-\d{2}$/.test(val));
    const fromRaw = url.searchParams.get('from') || url.searchParams.get('start_date');
    const toRaw = url.searchParams.get('to') || url.searchParams.get('end_date');
    const fromDate = isValidDate(fromRaw) ? fromRaw : null;
    const toDate = isValidDate(toRaw) ? toRaw : null;

    let payments: PaymentHistory[];
    if (fromDate && toDate) {
      payments = await sql`
        select 
          ip.id, ip.invoice_id, i.invoice_number, i.customer_name,
          coalesce(i.amount, 0)::float as original_amount,
          coalesce(i.discount_amount, 0)::float as discount,
          coalesce(ip.amount, 0)::float as final_amount,
          ip.payment_date, ip.payment_method, ip.reference_no, ip.notes
        from invoice_payments ip
        join invoices i on i.id = ip.invoice_id
        where ip.payment_date >= ${fromDate}::date
          and ip.payment_date < (${toDate}::date + interval '1 day')
        order by ip.payment_date desc
        limit 500
      ` as PaymentHistory[];
    } else if (fromDate) {
      payments = await sql`
        select 
          ip.id, ip.invoice_id, i.invoice_number, i.customer_name,
          coalesce(i.amount, 0)::float as original_amount,
          coalesce(i.discount_amount, 0)::float as discount,
          coalesce(ip.amount, 0)::float as final_amount,
          ip.payment_date, ip.payment_method, ip.reference_no, ip.notes
        from invoice_payments ip
        join invoices i on i.id = ip.invoice_id
        where ip.payment_date >= ${fromDate}::date
        order by ip.payment_date desc
        limit 500
      ` as PaymentHistory[];
    } else if (toDate) {
      payments = await sql`
        select 
          ip.id, ip.invoice_id, i.invoice_number, i.customer_name,
          coalesce(i.amount, 0)::float as original_amount,
          coalesce(i.discount_amount, 0)::float as discount,
          coalesce(ip.amount, 0)::float as final_amount,
          ip.payment_date, ip.payment_method, ip.reference_no, ip.notes
        from invoice_payments ip
        join invoices i on i.id = ip.invoice_id
        where ip.payment_date < (${toDate}::date + interval '1 day')
        order by ip.payment_date desc
        limit 500
      ` as PaymentHistory[];
    } else {
      payments = await sql`
        select 
          ip.id, ip.invoice_id, i.invoice_number, i.customer_name,
          coalesce(i.amount, 0)::float as original_amount,
          coalesce(i.discount_amount, 0)::float as discount,
          coalesce(ip.amount, 0)::float as final_amount,
          ip.payment_date, ip.payment_method, ip.reference_no, ip.notes
        from invoice_payments ip
        join invoices i on i.id = ip.invoice_id
        order by ip.payment_date desc
        limit 500
      ` as PaymentHistory[];
    }
    writeJson(res, { items: payments });
    return;
  } else if (endpoint === 'sales-report' && req.method === 'GET') {
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    let items;
    if (fromDate && toDate) {
      items = await sql`
        with s_agg as (
          select 
            coalesce(s.customer_id, 0) as customer_id,
            coalesce(c.name, s.customer_name, 'Unknown') as customer_name,
            count(s.id)::int as total_shipments,
            coalesce(sum(s.total_colli), 0)::int as total_colli,
            coalesce(sum(s.berat), 0)::float as total_weight,
            coalesce(sum(s.nominal), 0)::float as total_nominal,
            max(s.destination) as destination
          from shipments s
          left join customers c on c.id = s.customer_id
          where (s.created_at at time zone 'Asia/Jakarta') >= ${fromDate}::date
            and (s.created_at at time zone 'Asia/Jakarta') < (${toDate}::date + interval '1 day')
          group by 1,2
        ), paid as (
          select coalesce(i.customer_id, 0) as customer_id, coalesce(sum(ip.amount),0)::float as total_paid
          from invoice_payments ip
          join invoices i on i.id = ip.invoice_id
          where (ip.payment_date at time zone 'Asia/Jakarta') >= ${fromDate}::date
            and (ip.payment_date at time zone 'Asia/Jakarta') < (${toDate}::date + interval '1 day')
          group by coalesce(i.customer_id, 0)
        ), outstanding as (
          select customer_id, coalesce(sum(remaining_amount),0)::float as total_outstanding
          from invoices
          where coalesce(status,'pending') in ('pending','partial')
            and coalesce(invoice_date, issued_at) at time zone 'Asia/Jakarta' >= ${fromDate}::date
            and coalesce(invoice_date, issued_at) at time zone 'Asia/Jakarta' < (${toDate}::date + interval '1 day')
          group by customer_id
        )
        select sa.customer_id, sa.customer_name, sa.total_shipments, sa.total_colli, sa.total_weight, sa.total_nominal,
               coalesce(paid.total_paid, 0)::float as total_paid,
               coalesce(outstanding.total_outstanding, 0)::float as total_outstanding,
               sa.destination
        from s_agg sa
        left join paid on paid.customer_id = sa.customer_id
        left join outstanding on outstanding.customer_id = sa.customer_id
        order by sa.total_nominal desc
      `;
    } else {
      items = await sql`
        with s_agg as (
          select 
            coalesce(s.customer_id, 0) as customer_id,
            coalesce(c.name, s.customer_name, 'Unknown') as customer_name,
            count(s.id)::int as total_shipments,
            coalesce(sum(s.total_colli), 0)::int as total_colli,
            coalesce(sum(s.berat), 0)::float as total_weight,
            coalesce(sum(s.nominal), 0)::float as total_nominal,
            max(s.destination) as destination
          from shipments s
          left join customers c on c.id = s.customer_id
          group by 1,2
        ), paid as (
          select coalesce(i.customer_id, 0) as customer_id, coalesce(sum(ip.amount),0)::float as total_paid
          from invoice_payments ip
          join invoices i on i.id = ip.invoice_id
          group by coalesce(i.customer_id, 0)
        ), outstanding as (
          select customer_id, coalesce(sum(remaining_amount),0)::float as total_outstanding
          from invoices
          where coalesce(status,'pending') in ('pending','partial')
          group by customer_id
        )
        select sa.customer_id, sa.customer_name, sa.total_shipments, sa.total_colli, sa.total_weight, sa.total_nominal,
               coalesce(paid.total_paid, 0)::float as total_paid,
               coalesce(outstanding.total_outstanding, 0)::float as total_outstanding,
               sa.destination
        from s_agg sa
        left join paid on paid.customer_id = sa.customer_id
        left join outstanding on outstanding.customer_id = sa.customer_id
        order by sa.total_nominal desc
      `;
    }
    writeJson(res, { items });
    return;
  } else if (endpoint === 'sales-detail' && req.method === 'GET') {
    const customerIdRaw = url.searchParams.get('customer_id');
    const customerNameRaw = url.searchParams.get('customer_name');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    const customerId = customerIdRaw ? parseInt(customerIdRaw) : 0;
    const nameKey = (customerNameRaw || '').trim().toLowerCase();

    if (!customerId && !nameKey) { writeJson(res, { error: 'Missing customer_id or customer_name' }, 400); return; }

    let items;
    if (fromDate && toDate) {
      if (customerId) {
        items = await sql`
          select 
            s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
            s.origin, s.destination, s.total_colli,
            coalesce(s.berat, 0)::float as total_weight,
            coalesce(s.nominal, 0)::float as nominal,
            s.created_at,
            s.dbl_id
          from shipments s
          where s.customer_id = ${customerId}
            and (s.created_at at time zone 'Asia/Jakarta') >= ${fromDate}::date
            and (s.created_at at time zone 'Asia/Jakarta') < (${toDate}::date + interval '1 day')
          order by s.created_at desc
        `;
      } else {
        items = await sql`
          select 
            s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
            s.origin, s.destination, s.total_colli,
            coalesce(s.berat, 0)::float as total_weight,
            coalesce(s.nominal, 0)::float as nominal,
            s.created_at,
            s.dbl_id
          from shipments s
          where lower(coalesce(s.customer_name,'')) = ${nameKey}
            and (s.created_at at time zone 'Asia/Jakarta') >= ${fromDate}::date
            and (s.created_at at time zone 'Asia/Jakarta') < (${toDate}::date + interval '1 day')
          order by s.created_at desc
        `;
      }
    } else {
      if (customerId) {
        items = await sql`
          select 
            s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
            s.origin, s.destination, s.total_colli,
            coalesce(s.berat, 0)::float as total_weight,
            coalesce(s.nominal, 0)::float as nominal,
            s.created_at,
            s.dbl_id
          from shipments s
          where s.customer_id = ${customerId}
          order by s.created_at desc
        `;
      } else {
        items = await sql`
          select 
            s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
            s.origin, s.destination, s.total_colli,
            coalesce(s.berat, 0)::float as total_weight,
            coalesce(s.nominal, 0)::float as nominal,
            s.created_at,
            s.dbl_id
          from shipments s
          where lower(coalesce(s.customer_name,'')) = ${nameKey}
          order by s.created_at desc
        `;
      }
    }
    writeJson(res, { items });
    return;
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }
  } catch (error) {
    console.error('Invoices API error:', error);
    writeJson(res, { error: 'Internal server error' }, 500);
    return;
  }
}
