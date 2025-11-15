import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;

export type Sql = ReturnType<typeof neon>;

export function getSql(): Sql {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is missing in environment');
    throw new Error('Missing DATABASE_URL');
  }
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
  const base = {
    name: process.env.COMPANY_NAME || 'SUMBER TRANS EXPRESS',
    address: process.env.COMPANY_ADDRESS || 'Jl. Contoh No. 123, Jakarta'
  };
  const cfg: CompanyConfig = {
    ...base,
    ...(process.env.COMPANY_PHONE ? { phone: process.env.COMPANY_PHONE } : {}),
    ...(process.env.COMPANY_EMAIL ? { email: process.env.COMPANY_EMAIL } : {}),
    ...(process.env.COMPANY_WEBSITE ? { website: process.env.COMPANY_WEBSITE } : {})
  };
  return cfg;
}
