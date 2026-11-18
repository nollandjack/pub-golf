const crypto = require('crypto');
const TABLES = ['Holes', 'Settings', 'Teams', 'People', 'Codes', 'Constraints', 'Cards', 'Race', 'Pokies', 'Tab', 'Challenges', 'Log'];

function memoryStore(seed = {}) {
  const t = {};
  const photos = {};
  TABLES.forEach(n => { t[n] = (seed[n] || []).map(r => Object.assign({}, r)); });
  return {
    all: n => t[n].map(r => Object.assign({}, r)),
    append: (n, row) => { t[n].push(Object.assign({}, row)); },
    update: (n, match, patch) => { let c = 0; t[n].forEach(r => { if (match(Object.assign({}, r))) { Object.assign(r, patch); c++; } }); return c; },
    replace: (n, rows) => { t[n] = rows.map(r => Object.assign({}, r)); },
    newId: () => crypto.randomBytes(12).toString('hex'),
    savePhoto: (b64) => { const id = 'p' + crypto.randomBytes(6).toString('hex'); photos[id] = b64; return id; },
    photoUrl: id => (id && photos[id] ? 'data:image/jpeg;base64,' + photos[id] : ''),
    tables: t
  };
}

module.exports = { memoryStore };
