export const config = { runtime: 'nodejs' };

import type { IncomingMessage, ServerResponse } from 'http';
import { dblHandler } from './routes/dbl.js';
import { shipmentsHandler } from './routes/shipments.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname || '';

  if (pathname.includes('/api/dbl')) {
    await dblHandler(req, res);
    return;
  }

  if (pathname.includes('/api/shipments')) {
    await shipmentsHandler(req, res);
    return;
  }

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not Found' }));
}
