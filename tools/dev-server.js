const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadGs } = require('./load-gs');
const { memoryStore } = require('./memory-store');
const { seed } = require('./seed');

const gs = loadGs(['Logic.gs', 'Handlers.gs']);
const store = memoryStore(seed());
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const port = Number(process.env.PORT) || 4173;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let r = null;
      try { r = req.method === 'GET' ? { method: 'GET', k: url.searchParams.get('k') || '' } : Object.assign(JSON.parse(body), { method: 'POST' }); } catch (e) { r = null; }
      const out = r ? gs.handle(r, store, Date.now()) : { ok: false, error: 'Bad request' };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  // Check the raw path before URL normalisation so /../x and /.git/config never reach the disk.
  let rawPath = '';
  try { rawPath = decodeURIComponent(req.url.split('?')[0]); } catch (e) { rawPath = '\0'; }
  if (rawPath.split('/').some(s => s.startsWith('.'))) { res.writeHead(404); res.end('Not found'); return; }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('Pub golf dev server on http://localhost:' + port));
