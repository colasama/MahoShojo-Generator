import { createServer } from 'node:http';
import path from 'node:path';
import { createLocalFixture } from './local-fixture';
const command = process.argv[2];
const writers = process.argv[3] === '--writers';
if (!['init', 'serve'].includes(command) || process.argv.length > 4 || (process.argv[3] && !writers)) throw new Error('Usage: node scripts/local.mjs init|serve [--writers]');
const fixture = await createLocalFixture(path.resolve('../..'), path.resolve('.wrangler/state/v3'), writers);
if (command === 'init') {
  console.log('Local D1 initialized with synthetic principal; existing fixture state preserved.');
  await fixture.dispose();
} else {
  const port = 8799, origin = `http://127.0.0.1:${port}`;
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.headers.host !== `127.0.0.1:${port}`) { outgoing.writeHead(403); outgoing.end(); return; }
      const url = new URL(incoming.url ?? '/', origin);
      if (url.origin !== origin) { outgoing.writeHead(403); outgoing.end(); return; }
      if (url.pathname === '/__fixture/login' && incoming.method === 'GET') {
        outgoing.writeHead(303, { Location: '/', 'Cache-Control': 'no-store', 'Set-Cookie': `admin_fixture=${fixture.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600` }); outgoing.end(); return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      const cookie = headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('admin_fixture='))?.slice('admin_fixture='.length);
      if (cookie && !headers.has('Cf-Access-Jwt-Assertion')) headers.set('Cf-Access-Jwt-Assertion', cookie);
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of incoming) { size += chunk.length; if (size > 1_048_576) { outgoing.writeHead(413); outgoing.end(); return; } chunks.push(chunk); }
      const response = await fixture.worker.fetch(new Request(url, { method: incoming.method, headers,
        ...(!['GET','HEAD'].includes(incoming.method ?? 'GET') ? {body: Buffer.concat(chunks)} : {}) }), fixture.env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(503); outgoing.end('Local fixture unavailable'); }
  });
  server.listen(port, '127.0.0.1', () => console.log(`Synthetic Access fixture: ${origin}/__fixture/login (${writers ? 'synthetic content/tag/message writers' : 'read-only'}, expires in one hour)`));
  const close = () => { server.close(() => { void fixture.dispose().finally(() => process.exit()); }); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
