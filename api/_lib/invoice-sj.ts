import type { Sql } from './db.js';

export const INVOICE_SJ_EVENT = 'sj_status_changed';

type InvoiceReference = { id?: number; number?: string };
type SjChange = { shipment_id: number; sj_returned: boolean };

// Keep the previous state in the existing events table, in the same statement
// as the SJ update. Never trust a previous value supplied by the browser.
export function updateInvoiceSj(sql: Sql, invoice: InvoiceReference, changes: SjChange[]) {
  const unique = Array.from(new Map(changes.map(change => [String(change.shipment_id), change])).values());
  return sql`
    with target_invoice as (
      select id from invoices
      where id = ${invoice.id ?? null}::bigint or invoice_number = ${invoice.number ?? null}::text
    ), data as (
      select * from unnest(
        ${unique.map(change => change.shipment_id)}::bigint[],
        ${unique.map(change => change.sj_returned)}::boolean[]
      ) as t(id, sj_returned)
    ), previous as materialized (
      select s.id, s.sj_returned, s.sj_returned_at, d.sj_returned as requested
      from shipments s join data d on d.id = s.id
      where exists (select 1 from target_invoice)
      order by s.id
      for update of s
    ), updated as (
      update shipments s
      set sj_returned = p.requested,
          sj_returned_at = case when p.requested then coalesce(p.sj_returned_at, now()) else null end
      from previous p where s.id = p.id
      returning s.id, s.sj_returned, s.sj_returned_at
    )
    insert into events (entity_type, entity_id, event_type, payload_json)
    select 'invoice', i.id, ${INVOICE_SJ_EVENT}, jsonb_build_object(
      'shipment_id', p.id,
      'before', case
        when e.id is not null
          and (e.payload_json->'after'->>'sj_returned')::boolean is not distinct from p.sj_returned
          and (e.payload_json->'after'->>'sj_returned_at')::timestamptz is not distinct from p.sj_returned_at
        then e.payload_json->'before'
        else jsonb_build_object('sj_returned', p.sj_returned, 'sj_returned_at', p.sj_returned_at)
      end,
      'after', jsonb_build_object('sj_returned', u.sj_returned, 'sj_returned_at', u.sj_returned_at)
    )
    from previous p join updated u on u.id = p.id cross join target_invoice i
    left join lateral (
      select id, payload_json from events
      where entity_type = 'invoice' and entity_id = i.id and event_type = ${INVOICE_SJ_EVENT}
        and payload_json->>'shipment_id' = p.id::text
      order by id desc limit 1
    ) e on true
    -- A no-op edit must not claim a later SJ change made outside this invoice.
    where e.id is null or p.sj_returned is distinct from u.sj_returned
      or p.sj_returned_at is distinct from u.sj_returned_at
  `;
}

export async function deleteInvoiceWithSjRestore(sql: Sql, invoiceId: number) {
  const [targets, restored, deleted] = await sql.transaction([
    sql`
      select i.id, (
        select count(*)::int from (
          select shipment_id from invoice_items where invoice_id = i.id and shipment_id is not null
          union select i.shipment_id where i.shipment_id is not null
        ) linked
        where not exists (
          select 1 from events e
          where e.entity_type = 'invoice' and e.entity_id = i.id and e.event_type = ${INVOICE_SJ_EVENT}
            and e.payload_json->>'shipment_id' = linked.shipment_id::text
        )
      ) as untracked_count
      from invoices i where i.id = ${invoiceId}
      for update of i
    `,
    sql`
      with latest as (
        select distinct on (e.payload_json->>'shipment_id') e.payload_json
        from events e join invoices i on i.id = e.entity_id
        where e.entity_type = 'invoice' and e.entity_id = ${invoiceId} and e.event_type = ${INVOICE_SJ_EVENT}
        order by e.payload_json->>'shipment_id', e.id desc
      )
      update shipments s
      set sj_returned = (h.payload_json->'before'->>'sj_returned')::boolean,
          sj_returned_at = (h.payload_json->'before'->>'sj_returned_at')::timestamptz
      from latest h
      where s.id = (h.payload_json->>'shipment_id')::bigint
        and s.sj_returned is not distinct from (h.payload_json->'after'->>'sj_returned')::boolean
        and s.sj_returned_at is not distinct from (h.payload_json->'after'->>'sj_returned_at')::timestamptz
        and not exists (
          select 1 from invoices other
          where other.id <> ${invoiceId} and coalesce(other.status, 'pending') <> 'cancelled'
            and (other.shipment_id = s.id or exists (
              select 1 from invoice_items ii where ii.invoice_id = other.id and ii.shipment_id = s.id
            ))
        )
      returning s.id
    `,
    sql`delete from invoices where id = ${invoiceId} returning id`
  ]) as { id: number; untracked_count?: number }[][];
  if (!deleted?.length) return null;
  return {
    restored_count: restored?.length || 0,
    untracked_count: Number(targets?.[0]?.untracked_count || 0)
  };
}
