import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DATABASE_URL = 'postgresql://neondb_owner:npg_MZJCiF3a9dEf@ep-orange-bush-a1w65w02-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function test() {
  const sql = neon(DATABASE_URL);
  
  console.log('Fetching admin user...');
  const rows = await sql<Array<{ email: string; password_hash: string; name: string }>>`
    select email, password_hash, name from users where email = 'admin@example.com' limit 1
  `;
  
  if (!rows[0]) {
    console.error('❌ Admin user not found!');
    return;
  }
  
  console.log('✅ User found:', rows[0].email, rows[0].name);
  console.log('Hash in DB:', rows[0].password_hash.substring(0, 30) + '...');
  
  const testPassword = 'Admin123!';
  console.log('\nTesting password:', testPassword);
  
  const match = await bcrypt.compare(testPassword, rows[0].password_hash);
  console.log('Password match:', match ? '✅ YES' : '❌ NO');
  
  if (match) {
    console.log('\n✅ Login should work! Try again in browser.');
  } else {
    console.log('\n❌ Password does not match. Re-seeding admin...');
    const newHash = await bcrypt.hash(testPassword, 10);
    await sql`
      update users set password_hash = ${newHash} where email = 'admin@example.com'
    `;
    console.log('✅ Password updated!');
  }
}

test().catch(console.error);

