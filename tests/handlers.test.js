const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('../tools/load-gs');
const { memoryStore } = require('../tools/memory-store');
const { seed } = require('../tools/seed');
const H = loadGs(['Logic.gs', 'Handlers.gs']);
const j = x => JSON.parse(JSON.stringify(x));
const fresh = () => memoryStore(seed());
const get = (store, k) => j(H.handle({ method: 'GET', k }, store, 1000)).state;
const post = (store, k, type, body) => j(H.handle(Object.assign({ method: 'POST', k, type }, body), store, 2000));

test('public sees the board but no private parts', () => {
  const s = get(fresh(), '');
  assert.equal(s.who.role, 'public');
  assert.equal(s.board.length, 4);
  assert.equal(s.tab, undefined); assert.equal(s.queue, undefined); assert.equal(s.admin, undefined);
  assert.equal(s.holes.find(h => h.hole === 4).hazard, 'hidden');
  assert.deepEqual(s.teams[0].members, ['Ava', 'Ben', 'Cal']);
});

test('staff see hazards and admin sees codes', () => {
  assert.equal(get(fresh(), 'kref').holes.find(h => h.hole === 4).hazard, 'wrong-hand');
  const a = get(fresh(), 'kadmin');
  assert.equal(a.who.role, 'admin');
  assert.ok(a.admin.codes.some(c => c.code === 'kcap1'));
});

test('team and captain links see their own tab only', () => {
  const s = get(fresh(), 'kteam2');
  assert.equal(s.who.team, 2);
  assert.deepEqual(s.tab.members, ['Dee', 'Eli', 'Fay']);
  assert.equal(get(fresh(), 'kcap1').mine.nextHole, 1);
});

test('a revoked code is treated as public', () => {
  const store = fresh();
  store.update('Codes', r => r.code === 'kcap1', { active: false });
  assert.equal(get(store, 'kcap1').who.role, 'public');
});

test('clean_ blocks formulas and caps length', () => {
  assert.equal(H.clean_('=HYPERLINK("x")', 50), 'HYPERLINK("x")');
  assert.equal(H.clean_('  hi  ', 50), 'hi');
  assert.equal(H.clean_('abcdef', 3), 'abc');
});
