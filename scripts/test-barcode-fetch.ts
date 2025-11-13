import { writeFileSync } from 'fs';

async function main() {
  const url = 'http://localhost:3000/api/barcode/generate?code=TEST-123&type=qr';
  const res = await fetch(url);
  console.log('Status', res.status, 'Content-Type', res.headers.get('Content-Type'));
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('Size bytes:', buf.length);
  writeFileSync('qr-test.png', buf);
  const res2 = await fetch('http://localhost:3000/api/barcode/generate?code=TEST-123&type=barcode');
  const buf2 = Buffer.from(await res2.arrayBuffer());
  writeFileSync('barcode-test.png', buf2);
  console.log('Barcode size bytes:', buf2.length);
}

main().catch(e => { console.error(e); process.exit(1); });
