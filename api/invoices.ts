export const config = { runtime: 'nodejs' };

import { getSql } from './_lib/db.js';
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

type InvoiceItem = {
  id?: number;
  invoice_id?: number;
  shipment_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_type?: string;
  item_discount?: number;
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
  invoice_date?: string;
  due_date?: string;
  bank_account?: string;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
  items?: {
    shipment_id?: number | null;
    description: string;
    quantity: number;
    unit_price: number;
    tax_type?: string;
    item_discount?: number;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');

  try {
    const sql = getSql();

  if (endpoint === 'list' && req.method === 'GET') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const offset = (page - 1) * limit;
    
    let invoices: Invoice[];
    let total: number;
    
    if (status && ['partial', 'paid'].includes(status)) {
      invoices = await sql`
        select 
          id, shipment_id, dbl_id, invoice_number, spb_number, customer_name, customer_id,
          coalesce(amount, 0)::float as amount, 
          coalesce(subtotal, 0)::float as subtotal,
          coalesce(pph_percent, 0)::float as pph_percent,
          coalesce(pph_amount, 0)::float as pph_amount,
          coalesce(total_tagihan, amount, 0)::float as total_tagihan,
          coalesce(paid_amount, 0)::float as paid_amount,
          coalesce(remaining_amount, amount, 0)::float as remaining_amount,
          status, issued_at, invoice_date, due_date, paid_at, 
          bank_account, transfer_date, tax_percent, discount_amount, notes
        from invoices
        where status = ${status}
        order by issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
        where status = ${status}
      ` as [{ count: number }];
      
      total = countResult[0]?.count || 0;
    } else {
      invoices = await sql`
        select 
          id, shipment_id, dbl_id, invoice_number, spb_number, customer_name, customer_id,
          coalesce(amount, 0)::float as amount, 
          coalesce(subtotal, 0)::float as subtotal,
          coalesce(pph_percent, 0)::float as pph_percent,
          coalesce(pph_amount, 0)::float as pph_amount,
          coalesce(total_tagihan, amount, 0)::float as total_tagihan,
          coalesce(paid_amount, 0)::float as paid_amount,
          coalesce(remaining_amount, amount, 0)::float as remaining_amount,
          status, issued_at, invoice_date, due_date, paid_at, 
          bank_account, transfer_date, tax_percent, discount_amount, notes
        from invoices
        order by issued_at desc
        limit ${limit} offset ${offset}
      ` as Invoice[];
      
      const countResult = await sql`
        select count(*)::int as count from invoices
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
  } else if (endpoint === 'create' && req.method === 'POST') {
    let body: CreateInvoiceBody;
    
    try { body = await readJsonNode(req) as CreateInvoiceBody; } catch { body = null as any; }
    if (!body) { writeJson(res, { error: 'Invalid JSON' }, 400); return; }
    
    if (!body.customer_name && !body.customer_id) { writeJson(res, { error: 'Customer harus diisi' }, 400); return; }
    
    const amount = body.amount !== undefined ? Number(body.amount) : 0;
    if (!amount || amount <= 0) { writeJson(res, { error: 'Nominal/Amount harus diisi dan lebih dari 0' }, 400); return; }
    
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const maxResult = await sql`
      select invoice_number from invoices
      where invoice_number like ${prefix + '%'}
      order by invoice_number desc
      limit 1
    ` as [{ invoice_number: string }] | [];
    
    let nextNum = 1;
    if (maxResult.length > 0 && maxResult[0]?.invoice_number) {
      const match = maxResult[0]?.invoice_number.match(/INV-\d{4}-(\d+)/);
      if (match?.[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(4, '0')}`;
    
    let customerName = body.customer_name;
    let customerId = body.customer_id || null;
    if (!customerName && customerId) {
      const c = await sql`select name from customers where id = ${customerId}` as [{ name: string }];
      if (!c.length) { writeJson(res, { error: 'Invalid customer_id' }, 400); return; }
      customerName = c[0].name;
    }
    let spb: string | null = body.spb_number || null;
    if (!spb && body.shipment_id) {
      const s = await sql`select spb_number from shipments where id = ${body.shipment_id}` as [{ spb_number: string | null }];
      spb = s[0]?.spb_number || null;
    }
    
    const subtotal = body.subtotal || amount;
    const pphPercent = body.pph_percent || 0;
    const pphAmount = body.pph_amount || 0;
    const paidAmount = body.paid_amount || 0;
    const remainingAmount = body.remaining_amount !== undefined ? body.remaining_amount : (amount - paidAmount);
    
    const result = await sql`
      insert into invoices (
        shipment_id, invoice_number, spb_number, customer_name, customer_id, 
        amount, subtotal, pph_percent, pph_amount, total_tagihan,
        paid_amount, remaining_amount, status, issued_at, notes
      ) values (
        ${body.shipment_id || null},
        ${invoiceNumber},
        ${spb},
        ${customerName},
        ${customerId},
        ${amount},
        ${subtotal},
        ${pphPercent},
        ${pphAmount},
        ${amount},
        ${paidAmount},
        ${remainingAmount},
        ${body.status || 'partial'},
        now(),
        ${body.notes || null}
      )
      returning id
    ` as [{ id: number }];
    
    const invoiceId = result[0].id;
    
    if (body.items && body.items.length > 0) {
      for (const it of body.items) {
        if (!it) continue;
        const desc = it.description || 'Jasa pengiriman';
        await sql`insert into invoice_items (invoice_id, shipment_id, description, quantity, unit_price, tax_type, item_discount) 
          values (${invoiceId}, ${it.shipment_id || null}, ${desc}, ${it.quantity || 1}, ${it.unit_price || 0}, ${it.tax_type || 'include'}, ${it.item_discount || 0})`;
      }
    }
    
    if (paidAmount > 0) {
      await sql`
        insert into invoice_payments (invoice_id, amount, payment_date, payment_method, notes)
        values (${invoiceId}, ${paidAmount}, now(), 'TRANSFER', 'Pembayaran awal saat buat invoice')
      `;
    }
    
    writeJson(res, { id: invoiceId, invoice_number: invoiceNumber }, 201);
    return;
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
        ii.description, 
        ii.quantity::float as quantity, 
        ii.unit_price::float as unit_price, 
        ii.tax_type,
        ii.item_discount::float as item_discount,
        s.spb_number,
        s.public_code as tracking_code
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
    for (const it of itemsToInsert) {
      if (!it) continue;
      const desc = it.description || 'Jasa pengiriman';
      await sql`insert into invoice_items (invoice_id, shipment_id, description, quantity, unit_price, tax_type, item_discount) values (${body.invoice_id}, ${it.shipment_id || null}, ${desc}, ${it.quantity || 1}, ${it.unit_price || 0}, ${it.tax_type || 'include'}, ${it.item_discount || 0})`;
      insertedCount++;
    }
    console.log(`[set-items] invoice_id=${body.invoice_id}, received=${itemsToInsert.length}, inserted=${insertedCount}`);
    const rows = await sql`select coalesce(sum((quantity*unit_price) - coalesce(item_discount,0)),0)::float as subtotal from invoice_items where invoice_id = ${body.invoice_id}` as [{ subtotal: number }];
    const subtotal = rows[0]?.subtotal || 0;
    
    const inv = await sql`select paid_amount, pph_percent, pph_amount from invoices where id = ${body.invoice_id}` as [{ paid_amount: number; pph_percent: number; pph_amount: number }];
    const paidAmount = Number(inv[0]?.paid_amount || 0);
    const pphPercent = Number(inv[0]?.pph_percent || 0);
    const pphAmount = pphPercent > 0 ? (subtotal * pphPercent / 100) : 0;
    const totalTagihan = subtotal - pphAmount;
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
      discount_amount = ${body.discount_amount || 0}, 
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
                 s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal, s.destination
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
                 s.qty, s.satuan, coalesce(s.nominal, 0)::float as nominal, s.destination
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
    const items = await sql`
      select 
        s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
        s.origin, s.destination, s.total_colli, 
        coalesce(s.berat, 0)::float as total_weight,
        coalesce(s.nominal, 0)::float as nominal,
        s.created_at,
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
      left join invoice_items ii on ii.shipment_id = s.id
      left join invoices ii_inv on ii_inv.id = ii.invoice_id
      left join invoices spb_inv on spb_inv.spb_number = s.spb_number and ii.id is null
      where s.nominal > 0
        and (
          (ii_inv.id is null and spb_inv.id is null)
          or (ii_inv.id is not null and ii_inv.status in ('pending', 'partial'))
          or (ii_inv.id is null and spb_inv.id is not null and spb_inv.status in ('pending', 'partial'))
        )
      group by s.id, s.spb_number, s.public_code, s.customer_id, s.customer_name,
               s.origin, s.destination, s.total_colli, s.berat, s.nominal, s.created_at,
               ii_inv.id, ii_inv.invoice_number, ii_inv.remaining_amount, ii_inv.amount, ii_inv.subtotal, ii_inv.status,
               spb_inv.id, spb_inv.invoice_number, spb_inv.remaining_amount, spb_inv.status
      order by s.created_at desc
    `;
    writeJson(res, { items });
    return;
  } else if (endpoint === 'payment-history' && req.method === 'GET') {
    const payments = await sql`
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
    writeJson(res, { items: payments });
    return;
  } else if (endpoint === 'sales-report' && req.method === 'GET') {
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    
    let items;
    if (fromDate && toDate) {
      items = await sql`
        select 
          coalesce(s.customer_id, 0) as customer_id,
          coalesce(c.name, s.customer_name, 'Unknown') as customer_name,
          count(s.id)::int as total_shipments,
          coalesce(sum(s.total_colli), 0)::int as total_colli,
          coalesce(sum(s.berat), 0)::float as total_weight,
          coalesce(sum(s.nominal), 0)::float as total_nominal,
          coalesce(sum(case when i.status = 'paid' then i.amount else 0 end), 0)::float as total_paid,
          coalesce(sum(case when i.status in ('pending', 'partial') then i.remaining_amount else 0 end), 0)::float as total_outstanding
        from shipments s
        left join customers c on c.id = s.customer_id
        left join invoices i on i.customer_id = s.customer_id
        where s.created_at >= ${fromDate} and s.created_at <= ${toDate + 'T23:59:59'}
        group by s.customer_id, c.name, s.customer_name
        order by total_nominal desc
      `;
    } else {
      items = await sql`
        select 
          coalesce(s.customer_id, 0) as customer_id,
          coalesce(c.name, s.customer_name, 'Unknown') as customer_name,
          count(s.id)::int as total_shipments,
          coalesce(sum(s.total_colli), 0)::int as total_colli,
          coalesce(sum(s.berat), 0)::float as total_weight,
          coalesce(sum(s.nominal), 0)::float as total_nominal,
          coalesce(sum(case when i.status = 'paid' then i.amount else 0 end), 0)::float as total_paid,
          coalesce(sum(case when i.status in ('pending', 'partial') then i.remaining_amount else 0 end), 0)::float as total_outstanding
        from shipments s
        left join customers c on c.id = s.customer_id
        left join invoices i on i.customer_id = s.customer_id
        group by s.customer_id, c.name, s.customer_name
        order by total_nominal desc
      `;
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