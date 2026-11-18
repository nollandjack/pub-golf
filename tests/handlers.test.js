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

const scores = (names, sips) => Object.fromEntries(names.map(n => [n, { sips }]));
const T1 = ['Ava', 'Ben', 'Cal'];

test('captain submits, paired captain confirms, score lands on the board', () => {
  const store = fresh();
  assert.equal(post(store, 'kcap1', 'submitCard', { hole: 1, scores: scores(T1, 3) }).ok, true);
  assert.equal(get(store, '').board.find(r => r.team === 1).pending, true);
  assert.equal(get(store, 'kcap3').queue.length, 0);
  assert.equal(get(store, 'kcap1').queue.length, 0);
  const q = get(store, 'kcap2').queue;
  assert.equal(q.length, 1);
  assert.equal(post(store, 'kcap3', 'confirmCard', { cardId: q[0].id }).ok, false);
  assert.equal(post(store, 'kcap2', 'confirmCard', { cardId: q[0].id }).ok, true);
  assert.equal(get(store, '').board.find(r => r.team === 1).byHole[1], 3);
});

test('holes go in order and one pending card at a time', () => {
  const store = fresh();
  assert.match(post(store, 'kcap1', 'submitCard', { hole: 2, scores: scores(T1, 3) }).error, /on hole 1/);
  post(store, 'kcap1', 'submitCard', { hole: 1, scores: scores(T1, 3) });
  assert.match(post(store, 'kcap1', 'submitCard', { hole: 1, scores: scores(T1, 3) }).error, /already waiting/);
  assert.match(post(store, 'kteam1', 'submitCard', { hole: 1, scores: scores(T1, 3) }).error, /Only captains/);
});

test('bad scores are refused', () => {
  const store = fresh();
  assert.match(post(store, 'kcap1', 'submitCard', { hole: 1, scores: { Ava: { sips: 3 } } }).error, /Missing a score for Ben/);
  assert.match(post(store, 'kcap1', 'submitCard', { hole: 1, scores: scores(T1, 0) }).error, /whole number/);
});

test('sending back needs a note and lets the captain resubmit', () => {
  const store = fresh();
  post(store, 'kcap1', 'submitCard', { hole: 1, scores: scores(T1, 3) });
  const id = get(store, 'kref').queue[0].id;
  assert.match(post(store, 'kref', 'returnCard', { cardId: id }).error, /Say why/);
  assert.equal(post(store, 'kref', 'returnCard', { cardId: id, note: 'Ben spilled' }).ok, true);
  assert.equal(get(store, 'kcap1').mine.cards[0].note, 'Ben spilled');
  assert.equal(post(store, 'kcap1', 'submitCard', { hole: 1, scores: scores(T1, 4) }).ok, true);
});

test('admin can override or enter a card for a team', () => {
  const store = fresh();
  assert.equal(post(store, 'kadmin', 'overrideCard', { team: 1, hole: 1, scores: scores(T1, 5), reason: 'Phone died' }).ok, true);
  assert.equal(get(store, '').board.find(r => r.team === 1).byHole[1], 5);
  assert.match(post(store, 'kcap2', 'overrideCard', { team: 1, hole: 1, scores: scores(T1, 1), reason: 'x' }).error, /Only Jack/);
});

test('captains can challenge another team once per hole', () => {
  const store = fresh();
  post(store, 'kadmin', 'overrideCard', { team: 1, hole: 1, scores: scores(T1, 2), reason: 'test' });
  assert.match(post(store, 'kcap1', 'challenge', { team: 1, hole: 1, reason: 'x' }).error, /own team/);
  assert.equal(post(store, 'kcap3', 'challenge', { team: 1, hole: 1, reason: 'No way' }).ok, true);
  assert.match(post(store, 'kcap3', 'challenge', { team: 1, hole: 1, reason: 'Again' }).error, /already/);
  const id = get(store, 'kadmin').admin.challenges[0].id;
  assert.equal(post(store, 'kadmin', 'resolveChallenge', { id, outcome: 'dismissed' }).ok, true);
});

test('captain renames their team', () => {
  const store = fresh();
  assert.equal(post(store, 'kcap2', 'renameTeam', { name: 'The Sippers' }).ok, true);
  assert.equal(get(store, '').teams.find(t => t.id === 2).name, 'The Sippers');
  assert.match(post(store, 'kcap2', 'renameTeam', { name: ' ' }).error, /Give the team a name/);
});

test('inherited object properties are not actions', () => {
  assert.equal(post(fresh(), '', 'toString', {}).ok, false);
});

test('ref enters race times and pokies, board applies both', () => {
  const store = fresh();
  const results = [1, 2, 3, 4].map(team => ({ team, ms: 10000 + team * 1000 }));
  assert.match(post(store, 'kcap1', 'raceResult', { results }).error, /Only refs/);
  assert.equal(post(store, 'kref', 'raceResult', { results }).ok, true);
  assert.equal(post(store, 'kref', 'pokiesResult', { results: [1, 2, 3, 4].map(team => ({ team, cents: team === 3 ? 6000 : 1000 })) }).ok, true);
  const b = get(store, '').board;
  assert.equal(b.find(r => r.team === 1).byHole[3], 1);
  assert.equal(b.find(r => r.team === 3).byHole[3], 0);
  assert.match(post(store, 'kref', 'raceResult', { results: [{ team: 9, ms: 5 }] }).error, /Unknown team/);
});

test('team tab adds, splits and deletes within the team', () => {
  const store = fresh();
  assert.equal(post(store, 'kteam1', 'tabAdd', { payer: 'Ava', venue: 'Royal Hotel', item: 'Espresso martinis', cents: 6000, forWho: [] }).ok, true);
  assert.equal(post(store, 'kcap1', 'tabAdd', { payer: 'Ben', venue: 'Uber', item: 'To Surry Hills', cents: 3000, forWho: ['Ben', 'Cal'] }).ok, true);
  const tab = get(store, 'kteam1').tab;
  assert.equal(tab.entries.length, 2);
  assert.deepEqual(tab.settle.balances, { Ava: 4000, Ben: -500, Cal: -3500 });
  assert.match(post(store, 'kteam1', 'tabAdd', { payer: 'Dee', venue: 'x', item: 'y', cents: 100, forWho: [] }).error, /not on your team/);
  assert.match(post(store, 'kteam2', 'tabDelete', { id: tab.entries[0].id }).error, /not found/);
  assert.equal(post(store, 'kteam1', 'tabDelete', { id: tab.entries[0].id }).ok, true);
  assert.equal(get(store, 'kteam1').tab.entries.length, 1);
  assert.equal(get(store, 'kteam2').tab.entries.length, 0);
});

test('tab split ignores repeated names in forWho', () => {
  const store = fresh();
  assert.equal(post(store, 'kteam1', 'tabAdd', { payer: 'Ava', venue: 'Pub', item: 'Round', cents: 3000, forWho: ['Ben', 'Ben'] }).ok, true);
  assert.deepEqual(get(store, 'kteam1').tab.settle.balances, { Ava: 3000, Ben: -3000, Cal: 0 });
});
