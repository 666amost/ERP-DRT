import { neon } from '@neondatabase/serverless';

export type Sql = ReturnType<typeof neon>;

export function getSql(): Sql {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is missing in environment');
    throw new Error('Missing DATABASE_URL');
  }
  console.log('Database URL configured:', dbUrl.substring(0, 30) + '...');
  return neon(dbUrl);
}
