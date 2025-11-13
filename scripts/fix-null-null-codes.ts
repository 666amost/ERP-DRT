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

function deriveCode(name: string): string {
  return name.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase().padEnd(3,'X');
}

async function main() {
  const rows = await sql`select id, origin, destination, public_code, vehicle_plate_region from shipments where public_code like 'null-null-%'` as { id:number; origin:string; destination:string; public_code:string; vehicle_plate_region:string|null }[];
  console.log('Found', rows.length, 'null-null codes');
  for (const r of rows) {
    const originCity = await sql`select code from cities where name = ${r.origin}` as [{ code:string }?];
    const destCity = await sql`select code from cities where name = ${r.destination}` as [{ code:string }?];
    const parts = r.public_code.split('-');
    let num = parts[2] || '001';
    const plate = parts[3] || (r.vehicle_plate_region || 'XX');
    let attempt = 0;
    while (attempt < 1000) {
      const newCode = `${originCity[0]?.code || deriveCode(r.origin)}-${destCity[0]?.code || deriveCode(r.destination)}-${String(num).padStart(3,'0')}-${plate}`;
      try {
        await sql`update shipments set public_code = ${newCode} where id = ${r.id}`;
        console.log('Updated', r.public_code, '->', newCode);
        break;
      } catch (e:any) {
        if (e.code === '23505') {
          num = String(parseInt(num) + 1).padStart(3,'0');
          attempt++;
          continue;
        }
        throw e;
      }
    }
  }
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
