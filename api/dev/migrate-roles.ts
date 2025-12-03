export const config = { runtime: 'nodejs' };

import { getSql } from '../../lib/db';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (process.env.ALLOW_MIGRATE !== 'true') return new Response(null, { status: 403 });
  
  const sql = getSql();
  
  const result = await sql`
    UPDATE users 
    SET role = 'staff' 
    WHERE role = 'user'
    RETURNING id, email, role
  `;
  
  return Response.json({ 
    message: 'Updated users from role "user" to "staff"',
    updated: result 
  });
}
