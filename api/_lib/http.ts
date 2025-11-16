import type { IncomingMessage, ServerResponse } from 'http';

export function writeJson(res: ServerResponse, data: unknown, status = 200, headers: Record<string,string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(data));
}

export async function readJsonNode(req: IncomingMessage) {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try {
        const s = Buffer.concat(chunks).toString('utf8');
        if (!s) return resolve(null);
        resolve(JSON.parse(s));
      } catch (err) {
        console.warn('readJsonNode parse error', err);
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}
