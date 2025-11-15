import { createServer } from 'http';
import { parse } from 'url';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('✅ Loaded .env file');
} else {
  console.warn('⚠️  No .env file found');
}

const server = createServer(async (req, res) => {
  const { pathname } = parse(req.url);
  
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace('/api/', '');
    const handlerPath = join(__dirname, 'api', `${apiPath}.ts`);
    
    if (existsSync(handlerPath)) {
      try {
        const module = await import(`./api/${apiPath}.ts?t=${Date.now()}`);
        const handler = module.default;
        
        // If handler expects Node-style (req, res), call directly
        if (typeof handler === 'function' && handler.length >= 2) {
          await handler(req, res);
          return;
        }

        let body = '';
        if (req.method === 'POST' || req.method === 'PUT') {
          for await (const chunk of req) {
            body += chunk.toString();
          }
        }

        const request = new Request(`http://localhost:3000${req.url}`, {
          method: req.method,
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
          ),
          body: body || undefined
        });

        const response = await handler(request);
        
        const headers = Object.fromEntries(response.headers.entries());
        res.writeHead(response.status, headers);
        // Binary-safe body handling
        const contentType = headers['Content-Type'] || headers['content-type'] || '';
        if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
          const arrayBuffer = await response.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } else {
          // default text/json
          const text = await response.text();
          res.end(text);
        }
      } catch (err) {
        console.error('API error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`🚀 API: http://localhost:${PORT}`);
});
