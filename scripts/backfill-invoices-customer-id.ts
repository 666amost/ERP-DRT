import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Load .env manually (consistent with other scripts)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...v] = t.split('=');
    process.env[k] = v.join('=');
  });
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing');
const sql = neon(url);

type CustomerRow = { id:number; name:string };
type InvoiceRow = { id:number; invoice_number:string; customer_name:string; customer_id:null | number };

function normName(name:string):string { return name.trim().toLowerCase(); }

async function main():Promise<void> {
  console.log('Starting backfill invoices customer_id');
  const customers = await sql`select id, name from customers` as CustomerRow[];
  const customerMap = new Map<string, number>();
  for (const c of customers) {
    const key = normName(c.name);
    // first come first serve, ignore duplicates with same normalized name
    if (!customerMap.has(key)) customerMap.set(key, c.id);
  }
  const invoices = await sql`select id, invoice_number, customer_name, customer_id from invoices where customer_id is null` as InvoiceRow[];
  console.log('Invoices needing backfill:', invoices.length);
  const unmatched: InvoiceRow[] = [];
  let updated = 0;
  for (const inv of invoices) {
    const key = normName(inv.customer_name);
    const cid = customerMap.get(key);
    if (cid) {
      await sql`update invoices set customer_id = ${cid} where id = ${inv.id}`;
      updated++;
    } else {
      unmatched.push(inv);
    }
  }
  const reportDir = path.resolve(process.cwd(), 'scripts', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPathJson = path.join(reportDir, 'invoices-unmatched.json');
  const reportPathCsv = path.join(reportDir, 'invoices-unmatched.csv');
  fs.writeFileSync(reportPathJson, JSON.stringify({ generated_at: new Date().toISOString(), total_unmatched: unmatched.length, items: unmatched }, null, 2));
  fs.writeFileSync(reportPathCsv, ['invoice_number,customer_name'].concat(unmatched.map(u => `${u.invoice_number},"${u.customer_name.replace(/"/g,'""')}"`)).join('\n'));
  console.log('Backfill done. Updated:', updated, 'Unmatched:', unmatched.length);
  console.log('Report written:', reportPathJson, 'and', reportPathCsv);
  if (unmatched.length) {
    console.log('Next: fix data manually or add mapping entries, then re-run this script.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });