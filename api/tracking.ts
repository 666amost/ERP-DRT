export const config = { runtime: 'nodejs' };

import type { IncomingMessage, ServerResponse } from 'http';
import { getSql } from './_lib/db.js';
import { requireBearerSession, requireSession, type User } from './_lib/auth.js';
import { readJsonNode } from './_lib/http.js';

type TripRow = {
  id: number;
  dbl_number: string;
  dbl_date: string;
  driver_name: string | null;
  vehicle_plate: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  shipment_count: number;
  tracking_account_id?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Cache-Control': 'no-store'
};

function writeJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(data));
}

function publicTrip(row: TripRow): TripRow {
  return {
    id: Number(row.id),
    dbl_number: row.dbl_number,
    dbl_date: row.dbl_date,
    driver_name: row.driver_name,
    vehicle_plate: row.vehicle_plate,
    origin: row.origin,
    destination: row.destination,
    status: row.status,
    shipment_count: Number(row.shipment_count || 0),
    ...(row.tracking_account_id !== undefined
      ? { tracking_account_id: Number(row.tracking_account_id) }
      : {})
  };
}

async function requireDriver(req: IncomingMessage): Promise<User> {
  const session = await requireBearerSession(req);
  if (session.user.role !== 'driver') throw new Response(null, { status: 403 });
  return session.user;
}

async function getCurrentTrip(userId: number): Promise<TripRow | null> {
  const sql = getSql();
  const rows = await sql`
    select d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
           d.origin, d.destination, d.status, count(s.id)::int as shipment_count,
           ${userId}::bigint as tracking_account_id
    from dbl d
    join shipments s on s.dbl_id = d.id
    join driver_shipments ds on ds.shipment_id = s.id and ds.driver_id = ${userId}
    where d.status = 'DEPARTED'
      and s.courier_id = ${userId}
      and not exists (
        select 1 from shipments conflict
        where conflict.dbl_id = d.id
          and conflict.courier_id is distinct from ${userId}
      )
      and not exists (
        select 1 from shipments unlinked
        where unlinked.dbl_id = d.id
          and not exists (
            select 1 from driver_shipments app_assignment
            where app_assignment.shipment_id = unlinked.id
              and app_assignment.driver_id = ${userId}
          )
      )
    group by d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
             d.origin, d.destination, d.status
    order by d.updated_at desc
    limit 1
  ` as TripRow[];
  return rows[0] || null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');
  const sql = getSql();

  try {
    if (endpoint === 'active' && req.method === 'GET') {
      const session = await requireSession(req);
      if (session.user.role !== 'admin' && session.user.role !== 'accounting') {
        writeJson(res, { error: 'Forbidden' }, 403);
        return;
      }
      if (session.setCookieHeader) res.setHeader('Set-Cookie', session.setCookieHeader);

      const rows = await sql`
        select d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
               d.origin, d.destination, d.status,
               count(s.id)::int as shipment_count,
               min(s.courier_id)::bigint as tracking_account_id
        from dbl d
        join shipments s on s.dbl_id = d.id
        left join driver_shipments ds
          on ds.shipment_id = s.id and ds.driver_id = s.courier_id
        where d.status = 'DEPARTED'
          and s.courier_id is not null
        group by d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                 d.origin, d.destination, d.status
        having count(distinct s.courier_id) = 1
           and count(*) = count(s.courier_id)
           and count(*) = count(ds.shipment_id)
        order by d.updated_at desc
      ` as TripRow[];
      writeJson(res, { items: rows.map(publicTrip) });
      return;
    }

    const driver = await requireDriver(req);

    if (endpoint === 'current' && req.method === 'GET') {
      const trip = await getCurrentTrip(driver.id);
      writeJson(res, { item: trip ? publicTrip(trip) : null });
      return;
    }

    if (endpoint === 'lookup' && req.method === 'GET') {
      const dblNumber = String(url.searchParams.get('dbl_number') || '').trim();
      if (!dblNumber || dblNumber.length > 100) {
        writeJson(res, { error: 'Nomor DBL tidak valid' }, 400);
        return;
      }
      const rows = await sql`
        select d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
               d.origin, d.destination, d.status, count(s.id)::int as shipment_count,
               bool_and(
                 s.courier_id = ${driver.id}
                 and exists (
                   select 1 from driver_shipments app_assignment
                   where app_assignment.shipment_id = s.id
                     and app_assignment.driver_id = ${driver.id}
                 )
               ) filter (where s.id is not null) as assigned_to_current,
               count(s.id) filter (where s.courier_id is not null and s.courier_id <> ${driver.id})::int as assigned_to_other
        from dbl d
        left join shipments s on s.dbl_id = d.id
        where lower(btrim(d.dbl_number)) = lower(btrim(${dblNumber}))
        group by d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                 d.origin, d.destination, d.status
        limit 1
      ` as (TripRow & { assigned_to_current: boolean | null; assigned_to_other: number })[];
      const row = rows[0];
      if (!row) {
        writeJson(res, { error: 'DBL_NOT_FOUND' }, 404);
        return;
      }
      const current = await getCurrentTrip(driver.id);
      const resumable = row.status === 'DEPARTED' && row.assigned_to_current === true;
      let reason: string | null = null;
      if (Number(row.shipment_count) === 0) reason = 'DBL_EMPTY';
      else if (current && current.id !== row.id) reason = 'ACCOUNT_HAS_ACTIVE_TRIP';
      else if (Number(row.assigned_to_other || 0) > 0) reason = 'DBL_CLAIMED_BY_OTHER';
      else if (!['DRAFT', 'READY'].includes(row.status) && !resumable) reason = 'DBL_NOT_AVAILABLE';

      writeJson(res, {
        item: publicTrip(row),
        can_start: reason === null,
        resumable,
        reason
      });
      return;
    }

    if (endpoint === 'start' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_number?: string } | null;
      const dblNumber = String(body?.dbl_number || '').trim();
      if (!dblNumber || dblNumber.length > 100) {
        writeJson(res, { error: 'Nomor DBL tidak valid' }, 400);
        return;
      }

      let rows: (TripRow & { linked_count: number })[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const [claimRows] = await sql.transaction([sql`
        with claimed as (
          update dbl d
          set status = 'DEPARTED', updated_at = now()
          where lower(btrim(d.dbl_number)) = lower(btrim(${dblNumber}))
            and d.status in ('DRAFT', 'READY')
            and exists (select 1 from shipments s where s.dbl_id = d.id)
            and not exists (
              select 1 from shipments conflict
              where conflict.dbl_id = d.id
                and conflict.courier_id is not null
                and conflict.courier_id <> ${driver.id}
            )
            and not exists (
              select 1
              from dbl active_dbl
              join shipments active_s on active_s.dbl_id = active_dbl.id
              join driver_shipments active_assignment
                on active_assignment.shipment_id = active_s.id
               and active_assignment.driver_id = ${driver.id}
              where active_dbl.status = 'DEPARTED'
                and active_s.courier_id = ${driver.id}
                and active_dbl.id <> d.id
            )
          returning d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                    d.origin, d.destination, d.status
        ), existing as (
          select d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                 d.origin, d.destination, d.status
          from dbl d
          where lower(btrim(d.dbl_number)) = lower(btrim(${dblNumber}))
            and d.status = 'DEPARTED'
            and exists (select 1 from shipments s where s.dbl_id = d.id)
            and not exists (
              select 1 from shipments conflict
              where conflict.dbl_id = d.id
                and conflict.courier_id is distinct from ${driver.id}
            )
            and not exists (
              select 1 from shipments unlinked
              where unlinked.dbl_id = d.id
                and not exists (
                  select 1 from driver_shipments app_assignment
                  where app_assignment.shipment_id = unlinked.id
                    and app_assignment.driver_id = ${driver.id}
                )
            )
        ), selected as (
          select * from claimed
          union all
          select * from existing where not exists (select 1 from claimed)
        ), assigned as (
          update shipments s
          set courier_id = ${driver.id},
              scanned_at = coalesce(s.scanned_at, now()),
              status = 'IN_TRANSIT',
              updated_at = now()
          from selected d
          where s.dbl_id = d.id
            and (s.courier_id is null or s.courier_id = ${driver.id})
          returning s.id as shipment_id, s.dbl_id
        ), linked as (
          insert into driver_shipments (driver_id, shipment_id)
          select ${driver.id}, shipment_id from assigned
          on conflict (driver_id, shipment_id) do nothing
          returning shipment_id
        )
        select d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
               d.origin, d.destination, d.status,
               count(a.shipment_id)::int as shipment_count,
               ${driver.id}::bigint as tracking_account_id,
               (select count(*) from linked)::int as linked_count
        from selected d
        join assigned a on a.dbl_id = d.id
        group by d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                 d.origin, d.destination, d.status
          `], { isolationLevel: 'Serializable' }) as [(TripRow & { linked_count: number })[]];
          rows = claimRows;
          break;
        } catch (error) {
          const isSerializationConflict = /40001|serializ/i.test(
            error instanceof Error ? error.message : String(error)
          );
          if (!isSerializationConflict || attempt === 1) throw error;
        }
      }

      const row = rows[0];
      if (!row) {
        const candidate = await sql`
          select d.id, d.status, count(s.id)::int as shipment_count,
                 count(s.id) filter (where s.courier_id is not null and s.courier_id <> ${driver.id})::int as other_claims
          from dbl d left join shipments s on s.dbl_id = d.id
          where lower(btrim(d.dbl_number)) = lower(btrim(${dblNumber}))
          group by d.id, d.status
          limit 1
        ` as { id: number; status: string; shipment_count: number; other_claims: number }[];
        const current = await getCurrentTrip(driver.id);
        const found = candidate[0];
        if (!found) writeJson(res, { error: 'DBL_NOT_FOUND' }, 404);
        else if (current && current.id !== found.id) writeJson(res, { error: 'ACCOUNT_HAS_ACTIVE_TRIP' }, 409);
        else if (Number(found.shipment_count) === 0) writeJson(res, { error: 'DBL_EMPTY' }, 409);
        else if (Number(found.other_claims) > 0) writeJson(res, { error: 'DBL_CLAIMED_BY_OTHER' }, 409);
        else writeJson(res, { error: 'DBL_NOT_AVAILABLE', status: found.status }, 409);
        return;
      }

      writeJson(res, { item: publicTrip(row) });
      return;
    }

    if (endpoint === 'complete' && req.method === 'POST') {
      const body = await readJsonNode(req) as { dbl_id?: number } | null;
      const dblId = Number(body?.dbl_id);
      if (!Number.isInteger(dblId) || dblId <= 0) {
        writeJson(res, { error: 'DBL tidak valid' }, 400);
        return;
      }

      const rows = await sql`
        with owned as (
          select d.id
          from dbl d
          where d.id = ${dblId}
            and d.status = 'DEPARTED'
            and exists (select 1 from shipments s where s.dbl_id = d.id)
            and not exists (
              select 1 from shipments conflict
              where conflict.dbl_id = d.id
                and conflict.courier_id is distinct from ${driver.id}
            )
            and not exists (
              select 1 from shipments unlinked
              where unlinked.dbl_id = d.id
                and not exists (
                  select 1 from driver_shipments app_assignment
                  where app_assignment.shipment_id = unlinked.id
                    and app_assignment.driver_id = ${driver.id}
                )
            )
        ), completed as (
          update dbl d
          set status = 'COMPLETED', updated_at = now()
          from owned o
          where d.id = o.id
          returning d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                    d.origin, d.destination, d.status
        ), delivered as (
          update shipments s
          set status = 'DELIVERED', updated_at = now()
          from completed d
          where s.dbl_id = d.id
          returning s.id, s.dbl_id
        )
        select d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
               d.origin, d.destination, d.status,
               count(s.id)::int as shipment_count,
               ${driver.id}::bigint as tracking_account_id
        from completed d
        join delivered s on s.dbl_id = d.id
        group by d.id, d.dbl_number, d.dbl_date, d.driver_name, d.vehicle_plate,
                 d.origin, d.destination, d.status
      ` as TripRow[];

      const row = rows[0];
      if (!row) {
        writeJson(res, { error: 'TRIP_NOT_ACTIVE_OR_NOT_OWNED' }, 409);
        return;
      }
      writeJson(res, { item: publicTrip(row) });
      return;
    }

    writeJson(res, { error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof Response) {
      writeJson(res, { error: error.status === 403 ? 'Forbidden' : 'Unauthorized' }, error.status);
      return;
    }
    console.error('[tracking]', error instanceof Error ? error.message : String(error));
    writeJson(res, { error: 'Server error' }, 500);
  }
}
