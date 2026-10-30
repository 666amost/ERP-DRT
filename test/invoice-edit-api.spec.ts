// @vitest-environment node
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/invoices';

const db = new PGlite();
const originalFetch = neonConfig.fetchFunction;
type Query = { query: string; params: unknown[] };
let beforeTransaction: (() => Promise<void>) | undefined;

async function execute(client: Pick<PGlite, 'query'>, query: Query) {
  const result = await client.query<Record<string, unknown>>(query.query, query.params);
  return { ...result, rows: result.rows.map(row => result.fields.map(field => {
    const value = row[field.name];
    if (value == null) return null;
    if (value instanceof Date) return value.toISOString();
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  })) };
}

async function request(endpoint: string, body?: unknown, method = 'POST') {
  const req = new PassThrough();
  Object.assign(req, { method, url: `/api/invoices?endpoint=${endpoint}` });
  let status = 0;
  let result: any;
  const pending = handler(req as unknown as IncomingMessage, {
    writeHead(code: number) { status = code; },
    end(json: string) { result = JSON.parse(json); }
  } as unknown as ServerResponse);
  req.end(body ? JSON.stringify(body) : '');
  await pending;
  return { status, body: result };
}

const item = (id: number) => ({
  shipment_id: id, spb_number: `A${String(id).padStart(5, '0')}`,
  description: 'Oli', quantity: 10, unit_price: 100_000, sj_returned: true
});
const edit = (ids: number[], extra = {}) => request('set-items', { invoice_id: 1, items: ids.map(item), ...extra });
const invoice = async () => (await db.query<Record<string, unknown>>('SELECT * FROM invoices WHERE id = 1')).rows[0];
const linkedIds = async () => (await db.query<{ shipment_id: number }>(
  'SELECT shipment_id FROM invoice_items WHERE invoice_id = 1 ORDER BY shipment_id'
)).rows.map(row => Number(row.shipment_id));

describe('editing invoice SPBs using the real API and local Postgres', () => {
  beforeAll(async () => {
    // All serialized Neon SQL is executed locally; never load .env or contact Neon.
    vi.stubEnv('DATABASE_URL', 'postgresql://local:local@localhost/invoice-edit-tests-only');
    neonConfig.fetchFunction = async (_url: unknown, init?: { body?: unknown }) => {
      const body = JSON.parse(String(init?.body)) as Query & { queries?: Query[] };
      try {
        if (body.queries && beforeTransaction) {
          const change = beforeTransaction;
          beforeTransaction = undefined;
          await change();
        }
        const result = body.queries ? { results: await db.transaction(async tx => {
          const results = [];
          for (const query of body.queries!) results.push(await execute(tx, query));
          return results;
        }) } : await execute(db, body);
        return new Response(JSON.stringify(result));
      } catch (error) {
        const failure = error as { message: string; code?: string; constraint?: string };
        return new Response(JSON.stringify({
          message: failure.message, code: failure.code, constraint: failure.constraint
        }), { status: 400 });
      }
    };
    await db.exec(`
      CREATE TABLE customers (id bigint PRIMARY KEY, name text);
      CREATE TABLE shipments (
        id bigint PRIMARY KEY, customer_id bigint REFERENCES customers(id), customer_name text,
        pengirim_name text, spb_number varchar(50), nominal numeric(15,2), public_code text,
        created_at timestamptz DEFAULT now(), macam_barang text, penerima_name text,
        destination text, total_colli integer DEFAULT 10, berat numeric DEFAULT 1, satuan text,
        sj_returned boolean DEFAULT false, sj_returned_at timestamptz
      );
      CREATE TABLE invoices (
        id bigserial PRIMARY KEY, invoice_number text UNIQUE NOT NULL,
        shipment_id bigint REFERENCES shipments(id), customer_id bigint REFERENCES customers(id),
        customer_name text NOT NULL, spb_number text, amount numeric(15,2), subtotal numeric(15,2),
        pph_percent numeric(5,4), pph_amount numeric(15,2), total_tagihan numeric(15,2),
        tax_percent numeric(5,2), discount_amount numeric(15,2), paid_amount numeric(15,2),
        remaining_amount numeric(15,2), status text, issued_at timestamptz, paid_at timestamptz, notes text
      );
      CREATE TABLE invoice_items (
        id bigserial PRIMARY KEY, invoice_id bigint REFERENCES invoices(id) ON DELETE CASCADE,
        shipment_id bigint REFERENCES shipments(id), description text, quantity numeric(12,2),
        unit_price numeric(15,2), other_fee numeric(15,2), tax_type text, item_discount numeric(15,2)
      );
      CREATE TABLE invoice_payments (
        id serial PRIMARY KEY, invoice_id bigint REFERENCES invoices(id) ON DELETE CASCADE,
        amount numeric(15,2), payment_date date, payment_method varchar(50), notes text
      );
      CREATE TABLE events (
        id bigserial PRIMARY KEY, entity_type text NOT NULL, entity_id bigint NOT NULL,
        event_type text NOT NULL, payload_json jsonb, created_at timestamptz DEFAULT now()
      );
    `);
  }, 30_000);

  beforeEach(async () => {
    beforeTransaction = undefined;
    await db.exec(`
      TRUNCATE events, invoice_payments, invoice_items, invoices, shipments, customers RESTART IDENTITY CASCADE;
      ALTER TABLE invoices DROP CONSTRAINT IF EXISTS reject_test_total;
      INSERT INTO customers VALUES (1, 'Customer'), (2, 'Other');
      INSERT INTO shipments (id, customer_id, customer_name, spb_number, nominal)
      SELECT n, 1, 'Customer', 'A' || lpad(n::text, 5, '0'), 100000 FROM generate_series(1, 30) n;
    `);
    expect((await request('create', {
      customer_id: 1, customer_name: 'Customer', amount: 200_000, status: 'pending', items: [item(1), item(2)]
    })).status).toBe(201);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    neonConfig.fetchFunction = originalFetch;
    vi.unstubAllEnvs();
    await db.close();
  });

  it('adds and removes SPBs, recalculates totals and preserves the invoice number/date', async () => {
    const original = await invoice();
    const result = await edit([2, 3], { discount_amount: 10_000, pph_percent: 2, notes: 'Correction' });
    expect(result.status).toBe(200);
    expect(await linkedIds()).toEqual([2, 3]);
    expect(await invoice()).toMatchObject({
      invoice_number: original?.invoice_number, issued_at: original?.issued_at,
      shipment_id: 2, spb_number: 'A00002, A00003', subtotal: '200000.00',
      amount: '186200.00', paid_amount: '0.00', remaining_amount: '186200.00', status: 'pending', notes: 'Correction'
    });
    expect((await db.query('SELECT * FROM invoice_payments')).rows).toHaveLength(0);
    const sj = await db.query('SELECT id, sj_returned FROM shipments WHERE id IN (1,2,3) ORDER BY id');
    expect(sj.rows).toEqual([{ id: 1, sj_returned: false }, { id: 2, sj_returned: true }, { id: 3, sj_returned: false }]);
  });

  it('saves 21 combined references without truncation', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    expect((await edit(ids)).status).toBe(200);
    expect((await invoice())?.spb_number).toBe(ids.map(id => item(id).spb_number).join(', '));
    expect(await linkedIds()).toEqual(ids);
  });

  it('accepts IDs encoded as strings by the database driver', async () => {
    expect((await request('set-items', {
      invoice_id: '1', items: [{ ...item(1), shipment_id: '1' }, { ...item(3), shipment_id: '3' }]
    })).status).toBe(200);
    expect(await linkedIds()).toEqual([1, 3]);
  });

  it('offers only available SPBs from the invoice customer', async () => {
    await db.exec(`
      UPDATE shipments SET customer_id = 2, customer_name = 'Other' WHERE id = 3;
      INSERT INTO invoices (invoice_number, customer_name, shipment_id, status) VALUES ('OTHER', 'Customer', 4, 'pending');
    `);
    const result = await request('available-spb&invoice_id=1', undefined, 'GET');
    expect(result.status).toBe(200);
    const ids = result.body.items.map((row: { shipment_id: number }) => Number(row.shipment_id));
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
    expect(ids).toContain(5);
  });

  it.each([{ ids: [] }, { ids: [1, 1] }])('rejects an empty or duplicated selection: $ids', async ({ ids }) => {
    expect((await edit(ids)).status).toBe(400);
    expect(await linkedIds()).toEqual([1, 2]);
  });

  it('rejects a shipment from another customer', async () => {
    await db.exec("UPDATE shipments SET customer_id = 2, customer_name = 'Other' WHERE id = 3");
    expect((await edit([1, 2, 3])).status).toBe(400);
    expect(await linkedIds()).toEqual([1, 2]);
  });

  it('rejects a shipment already linked to another active invoice', async () => {
    await db.exec("INSERT INTO invoices (invoice_number, customer_name, shipment_id, status) VALUES ('OTHER', 'Customer', 3, 'pending')");
    expect((await edit([1, 2, 3])).status).toBe(409);
    expect(await linkedIds()).toEqual([1, 2]);
  });

  it.each(['paid', 'partial'])('blocks membership changes after %s payment, while keeping fee edits available', async status => {
    await db.query('UPDATE invoices SET paid_amount = 50000, status = $1 WHERE id = 1', [status]);
    await db.exec('INSERT INTO invoice_payments (invoice_id, amount) VALUES (1, 50000)');
    expect((await edit([2, 3])).status).toBe(409);
    expect(await linkedIds()).toEqual([1, 2]);
    expect((await edit([1, 2], { items: [{ ...item(1), other_fee: 500 }, item(2)] })).status).toBe(200);
    expect(await invoice()).toMatchObject({ amount: '200500.00', paid_amount: '50000.00', remaining_amount: '150500.00' });
    expect((await db.query('SELECT * FROM invoice_payments')).rows).toHaveLength(1);
  });

  it('also blocks membership changes when a payment record exists but the header is stale', async () => {
    await db.exec('INSERT INTO invoice_payments (invoice_id, amount) VALUES (1, 50000)');
    expect((await edit([2, 3])).status).toBe(409);
    expect(await linkedIds()).toEqual([1, 2]);
  });

  it('rolls back item replacement and SJ restoration when the final header write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.exec('ALTER TABLE invoices ADD CONSTRAINT reject_test_total CHECK (amount <= 200000)');
    const original = await invoice();
    const history = (await db.query('SELECT * FROM events ORDER BY id')).rows;
    expect((await edit([2, 3, 4])).status).toBe(500);
    expect(await invoice()).toEqual(original);
    expect(await linkedIds()).toEqual([1, 2]);
    expect((await db.query('SELECT * FROM events ORDER BY id')).rows).toEqual(history);
    expect((await db.query('SELECT id FROM shipments WHERE sj_returned ORDER BY id')).rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('does not mutate items after a concurrent invoice update', async () => {
    beforeTransaction = async () => { await db.exec("UPDATE invoices SET notes = 'Changed concurrently' WHERE id = 1"); };
    expect((await edit([2, 3])).status).toBe(409);
    expect(await linkedIds()).toEqual([1, 2]);
    expect((await invoice())?.notes).toBe('Changed concurrently');
  });

  it('does not mutate items when a payment arrives just before the edit transaction', async () => {
    beforeTransaction = async () => { await db.exec('INSERT INTO invoice_payments (invoice_id, amount) VALUES (1, 50000)'); };
    expect((await edit([2, 3])).status).toBe(409);
    expect(await linkedIds()).toEqual([1, 2]);
  });

  it('restores only attached SJ states when the edited invoice is later deleted', async () => {
    expect((await edit([2, 3])).status).toBe(200);
    await db.exec('UPDATE shipments SET sj_returned = true, sj_returned_at = now() WHERE id = 1');
    expect((await request('delete&id=1', undefined, 'DELETE')).status).toBe(200);
    const sj = await db.query('SELECT id, sj_returned FROM shipments WHERE id IN (1,2,3) ORDER BY id');
    expect(sj.rows).toEqual([{ id: 1, sj_returned: true }, { id: 2, sj_returned: false }, { id: 3, sj_returned: false }]);
  });

  it('preserves later SJ changes made outside the invoice when removing a SPB', async () => {
    await db.exec("UPDATE shipments SET sj_returned_at = sj_returned_at + interval '1 hour' WHERE id = 1");
    expect((await edit([2])).status).toBe(200);
    expect((await db.query<{ sj_returned: boolean }>('SELECT sj_returned FROM shipments WHERE id = 1')).rows[0]?.sj_returned).toBe(true);
  });

  it('does not replay stale SJ values for retained or newly added SPBs', async () => {
    await db.exec('UPDATE shipments SET sj_returned = false, sj_returned_at = null WHERE id = 2');
    await db.exec('UPDATE shipments SET sj_returned = true, sj_returned_at = now() WHERE id = 3');
    expect((await edit([1, 2, 3], { items: [item(1), item(2), { ...item(3), sj_returned: false }] })).status).toBe(200);
    const sj = await db.query('SELECT id, sj_returned FROM shipments WHERE id IN (2,3) ORDER BY id');
    expect(sj.rows).toEqual([{ id: 2, sj_returned: false }, { id: 3, sj_returned: true }]);
  });
});
