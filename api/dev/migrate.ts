export const config = { runtime: 'nodejs' };

import { getSql } from '../../lib/db';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (process.env.ALLOW_MIGRATE !== 'true') return new Response(null, { status: 403 });
  const sql = getSql();
  await sql`create extension if not exists pgcrypto`;

  // Core ERP tables (from ERP-Vercel-Neon-VercelBlob.md)
  await sql`
  create table if not exists customers (
    id bigserial primary key,
    name text not null,
    phone text,
    address text,
    tax_id text,
    created_at timestamptz default now()
  )`;

  await sql`
  create table if not exists cities (
    id bigserial primary key,
    name text not null unique,
    code text not null unique,
    province text,
    created_at timestamptz default now()
  )`;

  await sql`
  create table if not exists shipments (
    id bigserial primary key,
    customer_id bigint references customers(id),
    customer_name text,
    customer_address text,
    shipping_address text,
    origin text not null,
    destination text not null,
    eta date,
    status text not null default 'DRAFT',
    total_colli int default 0,
    public_code text unique,
    vehicle_plate_region text,
    created_at timestamptz default now()
  )`;
  await sql`alter table shipments add column if not exists customer_address text`;
  await sql`alter table shipments add column if not exists shipping_address text`;

  await sql`
  create table if not exists invoices (
    id bigserial primary key,
    shipment_id bigint references shipments(id),
    invoice_number text unique not null,
    customer_name text not null,
    customer_id bigint references customers(id),
    amount numeric(15,2) not null,
    status text not null default 'pending',
    issued_at timestamptz default now(),
    paid_at timestamptz
  )`;

  await sql`
  create table if not exists colli (
    id bigserial primary key,
    shipment_id bigint references shipments(id) on delete cascade,
    code text unique,
    weight numeric(10,2),
    status text default 'READY'
  )`;

  await sql`
  create table if not exists trips (
    id bigserial primary key,
    carrier_name text,
    vehicle_plate text,
    driver_name text,
    driver_phone text,
    depart_at timestamptz,
    arrive_est timestamptz
  )`;

  await sql`
  create table if not exists trip_items (
    id bigserial primary key,
    trip_id bigint references trips(id) on delete cascade,
    shipment_id bigint references shipments(id) on delete cascade
  )`;

  await sql`
  create table if not exists delivery_tokens (
    id bigserial primary key,
    shipment_id bigint references shipments(id) on delete cascade,
    token text unique not null,
    expires_at timestamptz,
    used_at timestamptz
  )`;

  await sql`
  create table if not exists pod (
    id bigserial primary key,
    shipment_id bigint references shipments(id) on delete cascade,
    method text not null,
    signed_name text,
    signed_at timestamptz,
    gps_lat double precision,
    gps_lng double precision,
    photos jsonb default '[]'::jsonb,
    note text
  )`;

  await sql`
  create table if not exists events (
    id bigserial primary key,
    entity_type text not null,
    entity_id bigint not null,
    event_type text not null,
    payload_json jsonb,
    created_by bigint,
    created_at timestamptz default now()
  )`;

  // Auth tables
  await sql`
  create table if not exists users (
    id bigserial primary key,
    email text unique not null,
    name text,
    password_hash text not null,
    role text default 'staff',
    created_at timestamptz default now()
  )`;

  await sql`
  create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    ip inet,
    ua text,
    created_at timestamptz not null default now()
  )`;

  await sql`create index if not exists idx_sessions_user on sessions(user_id)`;
  await sql`create index if not exists idx_sessions_exp on sessions(expires_at)`;
  await sql`create index if not exists idx_sessions_revoked on sessions(revoked_at)`;

  // Indexes
  await sql`create index if not exists idx_shipments_status_dest on shipments(status, destination)`;
  await sql`create index if not exists idx_colli_code on colli(code)`;
  await sql`create index if not exists idx_events_entity on events(entity_type, entity_id, created_at desc)`;
  await sql`create index if not exists idx_delivery_tokens_token on delivery_tokens(token)`;

  return Response.json({ ok: true });
}
