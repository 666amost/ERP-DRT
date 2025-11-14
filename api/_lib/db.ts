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

export type CompanyConfig = {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
};

export function getCompanyConfig(): CompanyConfig {
  return {
    name: process.env.COMPANY_NAME || 'SUMBER TRANS EXPRESS',
    address: process.env.COMPANY_ADDRESS || 'Jl. Contoh No. 123, Jakarta',
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL,
    website: process.env.COMPANY_WEBSITE
  };
}
