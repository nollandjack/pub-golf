const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('../tools/load-gs');
const L = loadGs(['Logic.gs']);
const j = x => JSON.parse(JSON.stringify(x));

test('player score is sips plus weighted penalties', () => {
  assert.equal(L.playerScore({ sips: 4 }), 4);
  assert.equal(L.playerScore({ sips: 4, pen: { spill: 1, toilet: 1, chuck: 1 } }), 12);
  assert.equal(L.playerScore({ sips: 3, pen: { slip: 2, word: 3 } }), 8);
});

test('hole score averages the roster and charges missed players', () => {
  const scores = { Ava: { sips: 3 }, Ben: { sips: 5, pen: { spill: 1 } }, Cal: { missed: true } };
  // Ava 3, Ben 6, Cal par 3 + missed 3 = 6, average 5
  assert.equal(L.holeTeamScore(scores, ['Ava', 'Ben', 'Cal'], 3, 3), 5);
  // a roster player with no entry counts as missed
  assert.equal(L.holeTeamScore({ Ava: { sips: 2 } }, ['Ava', 'Ben'], 2, 3), 3.5);
  assert.equal(L.holeTeamScore({}, [], 3, 3), 0);
});

const holes = [
  { hole: 1, par: 3, kind: 'normal' },
  { hole: 2, par: 2, kind: 'race' },
  { hole: 3, par: 3, kind: 'normal' }
];
const people = [
  { name: 'Ava', team: 1, role: 'player' }, { name: 'Ben', team: 1, role: 'player' },
  { name: 'Cal', team: 2, role: 'player' }, { name: 'Dee', team: 2, role: 'player' },
  { name: 'Rex', team: null, role: 'ref' }
];
const teams = [{ id: 1, name: 'Ones' }, { id: 2, name: 'Twos' }];
const card = (team, hole, scores, status) => ({ id: team + '-' + hole, team, hole, scores, status: status || 'confirmed' });
const base = extra => Object.assign({ teams, people, holes, cards: [], race: [], pokies: [], settings: { missedPenalty: 3, pokiesBonus: 3, tiebreakOrder: [] } }, extra);

test('race ranks share places on a tie', () => {
  assert.deepEqual(j(L.raceRanks([{ team: 1, ms: 9000 }, { team: 2, ms: 7000 }, { team: 3, ms: 9000 }])), { 1: 2, 2: 1, 3: 2 });
});

test('pokies winners are every team on the top amount', () => {
  assert.deepEqual(j(L.pokiesWinners([])), []);
  assert.deepEqual(j(L.pokiesWinners([{ team: 1, cents: 500 }, { team: 2, cents: 900 }, { team: 3, cents: 900 }])), [2, 3]);
});

test('leaderboard counts only confirmed cards and finds the next hole', () => {
  const board = L.leaderboard(base({
    cards: [card(1, 1, { Ava: { sips: 2 }, Ben: { sips: 4 } }), card(2, 1, { Cal: { sips: 3 }, Dee: { sips: 3 } }, 'pending')]
  }));
  const one = board.find(r => r.team === 1);
  const two = board.find(r => r.team === 2);
  assert.equal(one.total, 3); assert.equal(one.toPar, 0); assert.equal(one.played, 1); assert.equal(one.nextHole, 2);
  assert.equal(two.played, 0); assert.equal(two.pending, true); assert.equal(two.nextHole, 1);
  assert.equal(board[0].team, 1);
});

test('race hole scores the rank minus the pokies bonus', () => {
  const board = L.leaderboard(base({ race: [{ team: 1, ms: 5000 }, { team: 2, ms: 4000 }], pokies: [{ team: 1, cents: 2000 }, { team: 2, cents: 100 }] }));
  assert.equal(board.find(r => r.team === 1).byHole[2], -1);
  assert.equal(board.find(r => r.team === 2).byHole[2], 1);
});

test('finished level teams are tied until a tie-break order is set', () => {
  const all = [
    card(1, 1, { Ava: { sips: 3 }, Ben: { sips: 3 } }), card(2, 1, { Cal: { sips: 3 }, Dee: { sips: 3 } }),
    card(1, 3, { Ava: { sips: 3 }, Ben: { sips: 3 } }), card(2, 3, { Cal: { sips: 3 }, Dee: { sips: 3 } })
  ];
  const race = [{ team: 1, ms: 1 }, { team: 2, ms: 1 }];
  let board = L.leaderboard(base({ cards: all, race }));
  assert.equal(board[0].tied, true); assert.equal(board[0].done, true); assert.equal(board[1].rank, 1);
  board = L.leaderboard(base({ cards: all, race, settings: { missedPenalty: 3, pokiesBonus: 3, tiebreakOrder: [2, 1] } }));
  assert.equal(board[0].team, 2); assert.equal(board[0].tied, false); assert.equal(board[1].rank, 2);
});

test('pokies bonus needs more than $0 (all-zero top means no winners)', () => {
  assert.deepEqual(j(L.pokiesWinners([{ team: 1, cents: 0 }, { team: 2, cents: 0 }])), []);
});

test('teams pair up to confirm each other', () => {
  assert.deepEqual(j(L.confirmersFor(1, [1, 2, 3, 4])), [2]);
  assert.deepEqual(j(L.confirmersFor(2, [1, 2, 3, 4])), [1]);
  assert.deepEqual(j(L.confirmersFor(4, [1, 2, 3, 4])), [3]);
});

test('an odd number of teams puts the last three in a ring', () => {
  const ids = [1, 2, 3, 4, 5];
  assert.deepEqual(j(L.confirmersFor(1, ids)), [2]);
  // ring is 3, 4, 5. 3 watches 4, 4 watches 5, 5 watches 3
  assert.deepEqual(j(L.confirmersFor(4, ids)), [3]);
  assert.deepEqual(j(L.confirmersFor(5, ids)), [4]);
  assert.deepEqual(j(L.confirmersFor(3, ids)), [5]);
  assert.deepEqual(j(L.confirmersFor(1, [1])), []);
});

test('cards with one-sip pints or identical sips get flagged', () => {
  assert.deepEqual(j(L.cardFlags({ Ava: { sips: 1 }, Ben: { sips: 4 } }, 3)), ['Ava finished in one sip']);
  assert.deepEqual(j(L.cardFlags({ Ava: { sips: 1 } }, 1)), []);
  assert.deepEqual(j(L.cardFlags({ A: { sips: 3 }, B: { sips: 3 }, C: { sips: 3 }, D: { missed: true } }, 3)), ['Everyone has the same sips']);
});

const names = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit'];
const teamOf = (teams, n) => teams.findIndex(t => t.includes(n));

test('team builder keeps pairs together and apart and balances sizes', () => {
  const rules = [{ kind: 'together', a: 'Ava', b: 'Ben' }, { kind: 'apart', a: 'Ava', b: 'Cal' }, { kind: 'apart', a: 'Dee', b: 'Eli' }];
  for (let seed = 1; seed <= 50; seed++) {
    const out = L.buildTeams(names, rules, 3, L.mulberry32(seed));
    assert.ok(out.teams, out.error);
    assert.equal(teamOf(out.teams, 'Ava'), teamOf(out.teams, 'Ben'));
    assert.notEqual(teamOf(out.teams, 'Ava'), teamOf(out.teams, 'Cal'));
    assert.notEqual(teamOf(out.teams, 'Dee'), teamOf(out.teams, 'Eli'));
    const sizes = out.teams.map(t => t.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.equal(sizes.reduce((a, b) => a + b, 0), names.length);
  }
});

test('team builder explains impossible rules', () => {
  assert.match(L.buildTeams(names, [{ kind: 'together', a: 'Ava', b: 'Ben' }, { kind: 'apart', a: 'Ava', b: 'Ben' }], 3, L.mulberry32(1)).error, /both together and apart/);
  assert.match(L.buildTeams(names, [], 0, L.mulberry32(1)).error, /Need between/);
});

test('same seed gives the same teams', () => {
  assert.deepEqual(j(L.buildTeams(names, [], 3, L.mulberry32(7))), j(L.buildTeams(names, [], 3, L.mulberry32(7))));
});
