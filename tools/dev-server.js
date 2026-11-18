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

function fail(res, code, msg) {
  if (res.headersSent) { res.end(); return; }
  res.writeHead(code, { 'Content-Type': 'text/plain' });
  res.end(msg);
}

function route(req, res) {
  let url;
  let rawPath;
  let pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    // Check the raw path before URL normalisation so /../x and /.git/config never reach the disk.
    rawPath = decodeURIComponent(req.url.split('?')[0]);
    pathname = decodeURIComponent(url.pathname);
  } catch (e) { fail(res, 400, 'Bad request'); return; }
  if (url.pathname === '/api') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        let r = null;
        try { r = req.method === 'GET' ? { method: 'GET', k: url.searchParams.get('k') || '' } : Object.assign(JSON.parse(body), { method: 'POST' }); } catch (e) { r = null; }
        const out = r ? gs.handle(r, store, Date.now()) : { ok: false, error: 'Bad request' };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      } catch (e) { fail(res, 500, 'Server error'); }
    });
    return;
  }
  if (rawPath.split('/').some(s => s.startsWith('.'))) { fail(res, 404, 'Not found'); return; }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : pathname);
  let isFile = false;
  try { isFile = file.startsWith(root + path.sep) && fs.existsSync(file) && !fs.statSync(file).isDirectory(); } catch (e) { isFile = false; }
  if (!isFile) { fail(res, 404, 'Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  const stream = fs.createReadStream(file);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

http.createServer((req, res) => {
  try { route(req, res); } catch (e) { fail(res, 500, 'Server error'); }
}).listen(port, '127.0.0.1', () => console.log('Pub golf dev server on http://localhost:' + port));
