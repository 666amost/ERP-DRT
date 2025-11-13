import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

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

type InvoiceRow = { id:number; invoice_number:string; customer_name:string; customer_id:null | number };

async function main():Promise<void> {
  console.log('Generating unmatched invoices report (customer_id is null)');
  const invoices = await sql`select id, invoice_number, customer_name, customer_id from invoices where customer_id is null` as InvoiceRow[];
  console.log('Unmatched count:', invoices.length);
  const reportDir = path.resolve(process.cwd(), 'scripts', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, 'invoices-unmatched-only.json');
  const csvPath = path.join(reportDir, 'invoices-unmatched-only.csv');
  fs.writeFileSync(jsonPath, JSON.stringify({ generated_at: new Date().toISOString(), count: invoices.length, items: invoices }, null, 2));
  fs.writeFileSync(csvPath, ['invoice_number,customer_name'].concat(invoices.map(i => `${i.invoice_number},"${i.customer_name.replace(/"/g,'""')}"`)).join('\n'));
  console.log('Report files written:', jsonPath, 'and', csvPath);
}

main().catch(e => { console.error(e); process.exit(1); });