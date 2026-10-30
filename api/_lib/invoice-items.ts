import type { Sql } from './db.js';
import { INVOICE_SJ_EVENT, restoreInvoiceSj, updateInvoiceSj } from './invoice-sj.js';

export type EditableInvoiceItem = {
  id?: number;
  shipment_id?: number | null;
  spb_number?: string | null;
  description?: string;
  quantity?: number;
  unit_price?: number;
  other_fee?: number;
  tax_type?: string;
  item_discount?: number;
  sj_returned?: boolean;
};

export type InvoiceItemsBody = {
  invoice_id: number;
  items: EditableInvoiceItem[];
  pph_percent?: number;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string | null;
};

export class InvoiceEditError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Keep the revision unchanged until the final header update. Every write uses
// this guard, so a concurrent edit/payment makes the entire batch a no-op.
const target = `select i.id from invoices i where i.id = $1 and i.xmin::text = $2
  and (not $3::boolean or (coalesce(i.paid_amount, 0) = 0
    and coalesce(i.status, 'pending') not in ('paid', 'partial', 'cancelled')
    and not exists (select 1 from invoice_payments p where p.invoice_id = i.id)))`;

export async function saveInvoiceItems(sql: Sql, body: InvoiceItemsBody) {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new InvoiceEditError('Pilih minimal satu SPB sebelum menyimpan invoice.');
  }
  if (body.items.some(item => !item || typeof item !== 'object')) throw new InvoiceEditError('Data SPB tidak valid.');
  const [invoice] = await sql`
    select i.id, i.xmin::text as revision, i.customer_id, i.customer_name, i.shipment_id,
      i.spb_number, i.paid_amount, i.status, i.pph_percent, i.tax_percent, i.discount_amount, i.notes,
      exists (select 1 from invoice_payments p where p.invoice_id = i.id) as has_payments,
      coalesce((select jsonb_agg(jsonb_build_object('id', ii.id, 'shipment_id', ii.shipment_id))
        from invoice_items ii where ii.invoice_id = i.id), '[]'::jsonb) as items
    from invoices i where i.id = ${body.invoice_id}
  ` as {
    id: number; revision: string; customer_id: number | null; customer_name: string;
    shipment_id: number | null; spb_number: string | null; paid_amount: number; status: string;
    pph_percent: number; tax_percent: number; discount_amount: number; notes: string | null;
    has_payments: boolean; items: { id: number; shipment_id: number | null }[];
  }[];
  if (!invoice) throw new InvoiceEditError('Invoice tidak ditemukan.', 404);

  const items = body.items.map(item => ({
    ...item, shipment_id: item.shipment_id ? Number(item.shipment_id) : null,
    quantity: Number(item.quantity ?? 1), unit_price: Number(item.unit_price ?? 0),
    other_fee: Number(item.other_fee ?? 0), item_discount: Number(item.item_discount ?? 0)
  }));
  if (items.some(item => (item.shipment_id !== null && (!Number.isSafeInteger(item.shipment_id) || item.shipment_id <= 0))
    || ![item.quantity, item.unit_price, item.other_fee, item.item_discount].every(Number.isFinite)
    || item.quantity <= 0 || item.unit_price < 0 || item.other_fee < 0 || item.item_discount < 0)) {
    throw new InvoiceEditError('Data SPB atau biaya invoice tidak valid.');
  }
  const ids = items.flatMap(item => item.shipment_id === null ? [] : [item.shipment_id]);
  if (new Set(ids).size !== ids.length) throw new InvoiceEditError('SPB yang sama tidak boleh dipilih dua kali.');
  const previousIds = new Set(invoice.items.flatMap(item => item.shipment_id ? [Number(item.shipment_id)] : []));
  if (invoice.shipment_id) previousIds.add(Number(invoice.shipment_id));
  const removedIds = [...previousIds].filter(id => !ids.includes(id));
  const addedIds = ids.filter(id => !previousIds.has(id));
  const membershipChanged = removedIds.length > 0 || addedIds.length > 0
    || items.length !== Math.max(invoice.items.length, 1);
  if (membershipChanged && (Number(invoice.paid_amount) > 0 || invoice.has_payments
    || ['paid', 'partial', 'cancelled'].includes(invoice.status))) {
    throw new InvoiceEditError('Tambah/hapus SPB hanya tersedia untuk invoice yang belum memiliki pembayaran.', 409);
  }
  // Existing manual/legacy lines may remain; new lines must refer to a real SPB.
  if (items.some(item => item.shipment_id === null
    && !(invoice.items.some(old => !old.shipment_id && Number(old.id) === Number(item.id))
      || (invoice.items.length === 0 && items.filter(row => !row.shipment_id).length === 1)))) {
    throw new InvoiceEditError('SPB tidak ditemukan. Muat ulang lalu pilih SPB yang tersedia.');
  }
  const shipments = ids.length ? await sql`
    select s.id, s.spb_number,
      (s.customer_id = ${invoice.customer_id}::bigint
        or lower(trim(coalesce(s.customer_name, ''))) = lower(trim(${invoice.customer_name}))
        or lower(trim(coalesce(s.pengirim_name, ''))) = lower(trim(${invoice.customer_name}))) as same_customer,
      exists (select 1 from invoices other where other.id <> ${invoice.id}
        and coalesce(other.status, 'pending') <> 'cancelled'
        and (other.shipment_id = s.id or exists (
          select 1 from invoice_items ii where ii.invoice_id = other.id and ii.shipment_id = s.id
        ))) as already_invoiced
    from shipments s where s.id = any(${ids}::bigint[])
  ` as { id: number; spb_number: string | null; same_customer: boolean; already_invoiced: boolean }[] : [];
  if (shipments.length !== ids.length) throw new InvoiceEditError('Ada SPB yang sudah tidak tersedia.', 409);
  const added = shipments.filter(shipment => addedIds.includes(Number(shipment.id)));
  if (added.some(shipment => !shipment.same_customer)) throw new InvoiceEditError('Pilih SPB dari customer yang sama.');
  if (added.some(shipment => shipment.already_invoiced)) throw new InvoiceEditError('Ada SPB yang sudah masuk invoice lain. Muat ulang daftar SPB.', 409);

  const pphPercent = Number(body.pph_percent ?? invoice.pph_percent ?? 0);
  const taxPercent = Number(body.tax_percent ?? invoice.tax_percent ?? 0);
  const discount = Number(body.discount_amount ?? invoice.discount_amount ?? 0);
  if (![pphPercent, taxPercent, discount].every(Number.isFinite) || pphPercent < 0 || pphPercent > 100
    || taxPercent < 0 || taxPercent > 100 || discount < 0) throw new InvoiceEditError('Pajak atau diskon tidak valid.');
  const subtotal = items.reduce((sum, item) => sum + item.unit_price + item.other_fee - item.item_discount, 0);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const pphAmount = discountedSubtotal * pphPercent / 100;
  const total = Math.max(0, discountedSubtotal - pphAmount);
  if (total <= 0) throw new InvoiceEditError('Total tagihan harus lebih dari 0.');
  const references = items.map(item => item.shipment_id
    ? shipments.find(shipment => Number(shipment.id) === item.shipment_id)?.spb_number || ''
    : item.spb_number || invoice.spb_number || '').filter(Boolean);
  const spbNumber = [...new Set(references)].join(', ');
  const reference = { id: Number(invoice.id), revision: invoice.revision, unpaidOnly: membershipChanged };
  const params = [invoice.id, invoice.revision, membershipChanged];
  const writes = [sql(`select i.id from invoices i where i.id in (${target}) for update of i`, params)];
  if (removedIds.length) {
    writes.push(restoreInvoiceSj(sql, reference, removedIds));
    writes.push(sql(`update events set event_type = 'sj_status_detached'
      where entity_type = 'invoice' and entity_id in (${target}) and event_type = $4
        and (payload_json->>'shipment_id')::bigint = any($5::bigint[])`, [...params, INVOICE_SJ_EVENT, removedIds]));
  }
  writes.push(sql(`delete from invoice_items where invoice_id in (${target})`, params));
  writes.push(sql(`insert into invoice_items
    (invoice_id, shipment_id, description, quantity, unit_price, other_fee, tax_type, item_discount)
    select i.id, data.* from (${target}) i cross join unnest(
      $4::bigint[], $5::text[], $6::numeric[], $7::numeric[], $8::numeric[], $9::text[], $10::numeric[]
    ) as data(shipment_id, description, quantity, unit_price, other_fee, tax_type, item_discount)`, [
    ...params, items.map(item => item.shipment_id), items.map(item => item.description || 'Jasa pengiriman'),
    items.map(item => item.quantity), items.map(item => item.unit_price), items.map(item => item.other_fee),
    items.map(item => item.tax_type || 'include'), items.map(item => item.item_discount)
  ]));
  // Editing the SPB list does not change SJ status. Capture the current DB
  // baseline for newly attached SPBs without replaying stale browser values.
  writes.push(updateInvoiceSj(sql, { ...reference, preserveStatus: true }, items.flatMap(item => item.shipment_id
    ? [{ shipment_id: item.shipment_id, sj_returned: Boolean(item.sj_returned) }] : [])));
  // Paid amount is read from the locked row; editing never creates a payment.
  writes.push(sql(`update invoices set shipment_id = $4, spb_number = $5,
    subtotal = $6, amount = $7, total_tagihan = $7, pph_percent = $8, pph_amount = $9,
    tax_percent = $10, discount_amount = $11, notes = $12,
    remaining_amount = greatest(0, $7 - coalesce(paid_amount, 0)),
    status = case when status = 'cancelled' then status
      when coalesce(paid_amount, 0) <= 0 then 'pending'
      when paid_amount >= $7 then 'paid' else 'partial' end
    where id in (${target}) returning id`, [
    ...params, ids[0] ?? null, spbNumber || null, subtotal, total, pphPercent, pphAmount,
    taxPercent, discount, body.notes === undefined ? invoice.notes : body.notes || null
  ]));
  const results = await sql.transaction(writes, { isolationLevel: 'Serializable' });
  const saved = results[results.length - 1] as { id: number }[];
  if (!saved.length) throw new InvoiceEditError('Invoice berubah atau pembayaran baru masuk. Muat ulang invoice lalu coba lagi.', 409);
  return { success: true, subtotal, total, remaining_amount: Math.max(0, total - Number(invoice.paid_amount || 0)) };
}
