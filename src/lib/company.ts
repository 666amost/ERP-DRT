export type CompanyProfile = {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
};

let cachedCompany: CompanyProfile | null = null;

export async function getCompany(): Promise<CompanyProfile> {
  if (cachedCompany) return cachedCompany!;
  try {
    const res = await fetch('/api/company');
    const data = await res.json();
    cachedCompany = data.company;
    return cachedCompany!;
  } catch (err) {
    console.warn('getCompany error', err);
    return {
      name: 'SUMBER TRANS EXPRESS',
      address: 'Jl. Contoh No. 123, Jakarta'
    };
  }
}

export const COMPANY: CompanyProfile = {
  name: 'SUMBER TRANS EXPRESS',
  address: 'Jl. Contoh No. 123, Jakarta',
  phone: '021-0000-0000',
  email: 'info@sumbertransexpress.co.id',
  website: 'https://sumbertransexpress.co.id'
};
