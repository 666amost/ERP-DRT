export const config = { runtime: 'nodejs' };
import { getSql } from '../_lib/db';

type CreateCustomerBody = { name:string; phone?:string; address?:string; };

enum ErrorCode { Validation='validation', Duplicate='duplicate' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null,{ status:405 });
  const sql = getSql();
  let body: CreateCustomerBody;
  try { body = await req.json() as CreateCustomerBody; } catch { return Response.json({ error:'Invalid JSON' },{ status:400 }); }
  if (!body.name || body.name.trim().length < 2) {
    return Response.json({ error:'Nama customer wajib', code:ErrorCode.Validation },{ status:400 });
  }
  const name = body.name.trim();
  try {
    const rows = await sql`insert into customers (name, phone, address) values (${name}, ${body.phone || null}, ${body.address || null}) returning id, name, phone` as [{ id:number; name:string; phone:string|null }];
    return Response.json(rows[0],{ status:201 });
  } catch (e:any) {
    if (e.code === '23505') {
      return Response.json({ error:'Customer sudah ada', code:ErrorCode.Duplicate },{ status:409 });
    }
    return Response.json({ error:'Gagal create customer' },{ status:500 });
  }
}
