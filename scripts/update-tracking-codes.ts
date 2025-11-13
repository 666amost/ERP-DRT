import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key) {
        process.env[key] = vals.join('=');
      }
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL not found in environment');
}

const sql = neon(DATABASE_URL);

type Shipment = {
  id: number;
  origin: string;
  destination: string;
  public_code: string;
};

async function main() {
  console.log('Updating tracking codes...');
  
  const shipments = await sql`
    select id, origin, destination, public_code
    from shipments
    where public_code like 'TRK-%'
  ` as Shipment[];
  
  console.log(`Found ${shipments.length} shipments to update`);
  
  for (const shipment of shipments) {
    const originCity = await sql`
      select code from cities where name = ${shipment.origin}
    ` as [{ code: string }?];
    
    const destCity = await sql`
      select code from cities where name = ${shipment.destination}
    ` as [{ code: string }?];
    
    if (!originCity[0] || !destCity[0]) {
      console.log(`⚠️  Skipping ${shipment.public_code}: city not found (${shipment.origin} -> ${shipment.destination})`);
      continue;
    }
    
    const num = shipment.public_code.replace('TRK-', '');
    const newCode = `${originCity[0].code}-${destCity[0].code}-${num}-XX`;
    
    await sql`
      update shipments
      set public_code = ${newCode}, vehicle_plate_region = 'XX'
      where id = ${shipment.id}
    `;
    
    console.log(`✅ Updated: ${shipment.public_code} -> ${newCode}`);
  }
  
  console.log('✅ All tracking codes updated!');
  process.exit(0);
}

main().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
