import { neon } from '@neondatabase/serverless';

export type Sql = ReturnType<typeof neon>;

export function getSql(): Sql {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL');
  }
  return neon(dbUrl);
}
