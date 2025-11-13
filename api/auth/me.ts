export const config = { runtime: 'nodejs20.x' };

import { requireSession } from '../_lib/auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  try {
    const { user } = await requireSession(req);
    return Response.json({ user });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(null, { status: 401 });
  }
}
