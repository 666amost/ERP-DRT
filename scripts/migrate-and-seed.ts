import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = neon(dbUrl);

async function main() {
  console.log('Creating extension...');
  await sql`create extension if not exists pgcrypto`;

  console.log('Creating cities table...');
  await sql`
  create table if not exists cities (
    id bigserial primary key,
    name text unique not null,
    province text,
    created_at timestamptz default now()
  )`;
  
  await sql`
    alter table cities add column if not exists code text
  `;
  
  await sql`
    create unique index if not exists cities_code_unique on cities(code)
  `;

  console.log('Creating customers table...');
  await sql`
  create table if not exists customers (
    id bigserial primary key,
    name text not null,
    phone text,
    address text,
    tax_id text,
    created_at timestamptz default now()
  )`;

  console.log('Creating shipments table...');
  await sql`
  create table if not exists shipments (
    id bigserial primary key,
    customer_id bigint references customers(id),
    origin text not null,
    destination text not null,
    eta date,
    status text not null default 'DRAFT',
    total_colli int default 0,
    public_code text unique,
    created_at timestamptz default now()
  )`;
  
  await sql`
    alter table shipments add column if not exists vehicle_plate_region varchar(2)
  `;

  console.log('Creating colli table...');
  await sql`
  create table if not exists colli (
    id bigserial primary key,
    shipment_id bigint references shipments(id) on delete cascade,
    code text unique,
    weight numeric(10,2),
    status text default 'READY'
  )`;

  console.log('Creating trips table...');
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

  console.log('Creating trip_items table...');
  await sql`
  create table if not exists trip_items (
    id bigserial primary key,
    trip_id bigint references trips(id) on delete cascade,
    shipment_id bigint references shipments(id) on delete cascade
  )`;

  console.log('Creating delivery_tokens table...');
  await sql`
  create table if not exists delivery_tokens (
    id bigserial primary key,
    shipment_id bigint references shipments(id) on delete cascade,
    token text unique not null,
    expires_at timestamptz,
    used_at timestamptz
  )`;

  console.log('Creating pod table...');
  await sql`
  create table if not exists pod (
    id bigserial primary key,
    shipment_id bigint references shipments(id) on delete cascade,
    method text not null,
    signed_name text,
    signed_at timestamptz,
    gps_lat double precision,
    gps_lng double precision,
    photos jsonb default '[]'::jsonb
  )`;

  console.log('Creating events table...');
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

  console.log('Creating invoices table...');
  await sql`
  create table if not exists invoices (
    id bigserial primary key,
    shipment_id bigint references shipments(id),
    invoice_number text unique not null,
    customer_name text not null,
    amount numeric(15,2) not null,
    status text not null default 'pending',
    issued_at timestamptz default now(),
    paid_at timestamptz
  )`;
    // new column for normalized customer
    await sql`alter table invoices add column if not exists customer_id bigint references customers(id) on delete set null`;

  console.log('Creating users table...');
  await sql`
  create table if not exists users (
    id bigserial primary key,
    email text unique not null,
    name text,
    password_hash text not null,
    role text default 'staff',
    created_at timestamptz default now()
  )`;

  console.log('Creating sessions table...');
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

  console.log('Creating indexes...');
  await sql`create index if not exists idx_cities_name on cities(name)`;
  await sql`create index if not exists idx_cities_code on cities(code)`;
  await sql`create index if not exists idx_shipments_status_dest on shipments(status, destination)`;
  await sql`create index if not exists idx_colli_code on colli(code)`;
  await sql`create index if not exists idx_events_entity on events(entity_type, entity_id, created_at desc)`;
  await sql`create index if not exists idx_delivery_tokens_token on delivery_tokens(token)`;
  await sql`create index if not exists idx_sessions_user on sessions(user_id)`;
  await sql`create index if not exists idx_sessions_exp on sessions(expires_at)`;
  await sql`create index if not exists idx_sessions_revoked on sessions(revoked_at)`;
  await sql`create index if not exists idx_invoices_number on invoices(invoice_number)`;

  console.log('Seeding admin user...');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hash = await bcrypt.hash(adminPassword, 10);
  await sql`
    insert into users (email, password_hash, name, role)
    values (${adminEmail}, ${hash}, 'Admin User', 'admin')
    on conflict (email) do update set name = excluded.name
  `;

  console.log('Seeding cities...');
  await sql`
    insert into cities (name, code, province)
    values 
      ('Jakarta', 'JKT', 'DKI Jakarta'),
      ('Surabaya', 'SBY', 'Jawa Timur'),
      ('Bandung', 'BDG', 'Jawa Barat'),
      ('Medan', 'MDN', 'Sumatera Utara'),
      ('Semarang', 'SMG', 'Jawa Tengah'),
      ('Makassar', 'MKS', 'Sulawesi Selatan'),
      ('Palembang', 'PLM', 'Sumatera Selatan'),
      ('Tangerang', 'TNG', 'Banten'),
      ('Depok', 'DPK', 'Jawa Barat'),
      ('Bekasi', 'BKS', 'Jawa Barat'),
      ('Yogyakarta', 'YYK', 'DI Yogyakarta'),
      ('Malang', 'MLG', 'Jawa Timur'),
      ('Bogor', 'BGR', 'Jawa Barat'),
      ('Batam', 'BTM', 'Kepulauan Riau'),
      ('Pekanbaru', 'PKU', 'Riau')
    on conflict (name) do update set code = excluded.code, province = excluded.province
  `;

  console.log('Seeding customers...');
  const custRows = await sql`
    insert into customers (name, phone, address)
    values 
      ('PT Maju Jaya', '021-555-0101', 'Jakarta Selatan'),
      ('CV Sejahtera', '022-555-0202', 'Bandung'),
      ('PT Indo Kencana', '024-555-0303', 'Semarang')
    on conflict do nothing
    returning id
  `;
  const cust1 = (custRows[0] as { id: number } | undefined)?.id || 1;
  const cust2 = (custRows[1] as { id: number } | undefined)?.id || 2;

  console.log('Seeding shipments...');
  const shipRows = await sql`
    insert into shipments (customer_id, origin, destination, status, total_colli, public_code, eta)
    values
      (${cust1}, 'Jakarta', 'Surabaya', 'IN_TRANSIT', 20, 'TRK-001', current_date + interval '2 days'),
      (${cust2}, 'Bandung', 'Semarang', 'IN_TRANSIT', 15, 'TRK-002', current_date + interval '3 days'),
      (${cust1}, 'Jakarta', 'Medan', 'DRAFT', 10, 'TRK-003', current_date + interval '5 days'),
      (${cust2}, 'Surabaya', 'Makassar', 'DELIVERED', 8, 'TRK-004', current_date - interval '1 day')
    on conflict (public_code) do nothing
    returning id
  `;
  const ship1 = (shipRows[0] as { id: number } | undefined)?.id || 1;
  const ship2 = (shipRows[1] as { id: number } | undefined)?.id || 2;

  console.log('Seeding invoices...');
  await sql`
    insert into invoices (shipment_id, invoice_number, customer_name, amount, status, issued_at, paid_at)
    values
      (${ship1}, 'INV-2024-1142', 'PT Maju Jaya', 45500000, 'paid', '2024-11-10'::timestamptz, '2024-11-10'::timestamptz),
      (${ship2}, 'INV-2024-1141', 'CV Sejahtera', 28750000, 'pending', '2024-11-09'::timestamptz, null),
      (${ship1}, 'INV-2024-1140', 'PT Indo Kencana', 67200000, 'pending', '2024-11-08'::timestamptz, null)
    on conflict (invoice_number) do nothing
  `;

  console.log('Seeding trips...');
  const tripRows = await sql`
    insert into trips (carrier_name, vehicle_plate, driver_name, driver_phone, depart_at)
    values
      ('Ekspedisi Kilat', 'B 1234 XY', 'Ahmad Sutanto', '0812-3456-7890', current_timestamp - interval '6 hours'),
      ('Trans Cargo', 'D 5678 ZZ', 'Budi Santoso', '0813-9876-5432', current_timestamp - interval '12 hours')
    returning id
  `;
  const trip1 = (tripRows[0] as { id: number } | undefined)?.id || 1;
  const trip2 = (tripRows[1] as { id: number } | undefined)?.id || 2;

  console.log('Linking trips to shipments...');
  await sql`
    insert into trip_items (trip_id, shipment_id)
    values (${trip1}, ${ship1}), (${trip2}, ${ship2})
    on conflict do nothing
  `;

  console.log('✅ Migration and seed complete!');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
