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

test('hole score averages the roster and charges missed players the missed score', () => {
  const scores = { Ava: { sips: 3 }, Ben: { sips: 5, pen: { spill: 1 } }, Cal: { missed: true } };
  // Ava 3, Ben 6, Cal 9, average 6
  assert.equal(L.holeTeamScore(scores, ['Ava', 'Ben', 'Cal'], 9), 6);
  // a roster player with no entry counts as missed
  assert.equal(L.holeTeamScore({ Ava: { sips: 2 } }, ['Ava', 'Ben'], 7), 4.5);
  assert.equal(L.holeTeamScore({}, [], 9), 0);
});

test('worst on the hole is the highest real score on any confirmed card', () => {
  const cards = [
    { team: 1, hole: 1, status: 'confirmed', scores: { Ava: { sips: 3 }, Ben: { sips: 5, pen: { spill: 1 } }, Cal: { missed: true } } },
    { team: 2, hole: 1, status: 'confirmed', scores: { Cal: { sips: 8 }, Dee: { sips: 2 } } },
    { team: 2, hole: 3, status: 'confirmed', scores: { Cal: { sips: 20 } } }
  ];
  assert.equal(L.worstOnHole(cards, 1), 8);
  assert.equal(L.worstOnHole(cards, 2), null);
  assert.equal(L.worstOnHole([{ team: 1, hole: 1, status: 'confirmed', scores: { Ava: { missed: true } } }], 1), null);
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
const SETTINGS = { missedExtra: 5, raceFirst: -2, raceStep: 2, raceDnf: 15, pokiesBonus: 3, tiebreakOrder: [] };
const base = extra => Object.assign({ teams, people, holes, cards: [], race: [], pokies: [], settings: SETTINGS }, extra);

test('race ranks share places on a tie', () => {
  assert.deepEqual(j(L.raceRanks([{ team: 1, ms: 9000 }, { team: 2, ms: 7000 }, { team: 3, ms: 9000 }])), { 1: 2, 2: 1, 3: 2 });
});

test('race ranks skip DNF rows', () => {
  const r = j(L.raceRanks([{ team: 1, ms: 9000 }, { team: 2, ms: '', dnf: true }, { team: 3, ms: 7000 }]));
  assert.deepEqual(r, { 1: 2, 3: 1 });
});

test('race ranks skip a row with no time that is not DNF', () => {
  const r = j(L.raceRanks([{ team: 1, ms: null, dnf: false }, { team: 2, ms: 8000, dnf: false }]));
  assert.deepEqual(r, { 2: 1 });
});

test('ruleSettings gives numbers and defaults', () => {
  assert.deepEqual(j(L.ruleSettings({ raceDnf: '+3', missedExtra: 'abc', raceFirst: '' })), { missedExtra: 5, raceFirst: -2, raceStep: 2, raceDnf: 3, pokiesBonus: 3 });
  assert.equal(L.ruleSettings({}).raceDnf, 15);
});

test('the board DNF score uses the same normalised settings', () => {
  const race = [{ team: 1, ms: null, dnf: true }];
  const raceHoles = [{ hole: 3, name: 'R', kind: 'race' }];
  const b = L.leaderboard(base({ holes: raceHoles, race, settings: { raceDnf: '+3', tiebreakOrder: [] } }));
  assert.equal(b.find(r => r.team === 1).byHole[3], 3);
  const b2 = L.leaderboard(base({ holes: raceHoles, race, settings: { raceDnf: 'abc', tiebreakOrder: [] } }));
  assert.equal(b2.find(r => r.team === 1).byHole[3], 15);
});

test('a no-time non-DNF race row scores nothing on the board', () => {
  const raceHoles = [{ hole: 3, name: 'R', kind: 'race' }];
  const b = L.leaderboard(base({ holes: raceHoles, race: [{ team: 1, ms: null, dnf: false }], settings: SETTINGS }));
  assert.equal(b.find(r => r.team === 1).played, 0);
});

test('race score is the ladder, or the DNF score', () => {
  const s = { raceFirst: -2, raceStep: 2, raceDnf: 15 };
  assert.equal(L.raceScore({ team: 1, ms: 1 }, 1, s), -2);
  assert.equal(L.raceScore({ team: 1, ms: 1 }, 2, s), 0);
  assert.equal(L.raceScore({ team: 1, ms: 1 }, 4, s), 4);
  assert.equal(L.raceScore({ team: 1, ms: '', dnf: true }, undefined, s), 15);
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
  assert.equal(one.total, 3); assert.equal('toPar' in one, false); assert.equal(one.played, 1); assert.equal(one.nextHole, 2);
  assert.equal(two.played, 0); assert.equal(two.pending, true); assert.equal(two.nextHole, 1);
  // raw totals: a team that has played nothing sits on 0, so it ranks above a team on 3 until scores come in
  assert.equal(board[0].team, 2);
});

test('race ladder scores -2, 0, 2, 4 and the pokies winner takes 3 off', () => {
  const t4 = [1, 2, 3, 4].map(id => ({ id, name: 'T' + id }));
  const p4 = [1, 2, 3, 4].map(id => ({ name: 'P' + id, team: id, role: 'player' }));
  const race = [{ team: 1, ms: 4000 }, { team: 2, ms: 1000 }, { team: 3, ms: 2000 }, { team: 4, ms: 3000 }];
  let board = L.leaderboard(base({ teams: t4, people: p4, race }));
  assert.deepEqual([2, 3, 4, 1].map(t => board.find(r => r.team === t).byHole[2]), [-2, 0, 2, 4]);
  board = L.leaderboard(base({ teams: t4, people: p4, race, pokies: [{ team: 2, cents: 2000 }, { team: 4, cents: 100 }] }));
  assert.equal(board.find(r => r.team === 2).byHole[2], -5);
  assert.equal(board.find(r => r.team === 4).byHole[2], 2);
});

test('a tie for first gives both -2 and the next place +2', () => {
  const t3 = [1, 2, 3].map(id => ({ id, name: 'T' + id }));
  const p3 = [1, 2, 3].map(id => ({ name: 'P' + id, team: id, role: 'player' }));
  const board = L.leaderboard(base({ teams: t3, people: p3, race: [{ team: 1, ms: 5 }, { team: 2, ms: 5 }, { team: 3, ms: 9 }] }));
  assert.deepEqual([1, 2, 3].map(t => board.find(r => r.team === t).byHole[2]), [-2, -2, 2]);
});

test('a DNF team scores 15 and does not push others down', () => {
  const board = L.leaderboard(base({ race: [{ team: 1, ms: 5000 }, { team: 2, ms: '', dnf: true }] }));
  assert.equal(board.find(r => r.team === 1).byHole[2], -2);
  assert.equal(board.find(r => r.team === 2).byHole[2], 15);
});

test('missed player scores the worst on the hole plus 5 (worst 8 is on another team)', () => {
  const t3 = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
  const p = [{ name: 'Ava', team: 1, role: 'player' }, { name: 'Ben', team: 1, role: 'player' }, { name: 'Cal', team: 1, role: 'player' }, { name: 'Dee', team: 2, role: 'player' }];
  const cards = [
    card(1, 1, { Ava: { sips: 3 }, Ben: { sips: 5, pen: { spill: 1 } }, Cal: { missed: true } }),
    card(2, 1, { Dee: { sips: 8 } })
  ];
  const t = L.leaderboard(base({ teams: t3, people: p, cards })).find(r => r.team === 1);
  assert.equal(t.byHole[1], L.round2((3 + 6 + 13) / 3));
});

test('with no other real scores a missed player scores the worst on their own card plus 5', () => {
  const p = [{ name: 'Ava', team: 1, role: 'player' }, { name: 'Ben', team: 1, role: 'player' }, { name: 'Cal', team: 1, role: 'player' }];
  const cards = [card(1, 1, { Ava: { sips: 3 }, Ben: { sips: 6 }, Cal: { missed: true } })];
  const t = L.leaderboard(base({ teams: [teams[0]], people: p, cards })).find(r => r.team === 1);
  assert.equal(t.byHole[1], L.round2((3 + 6 + 11) / 3));
  // nobody has a real score at all, so the missed player scores just missedExtra
  const only = [card(1, 1, { Ava: { missed: true }, Ben: { missed: true }, Cal: { missed: true } })];
  assert.equal(L.leaderboard(base({ teams: [teams[0]], people: p, cards: only }))[0].byHole[1], 5);
});

test('the board ranks by raw total and rows carry no toPar', () => {
  const cards = [
    card(1, 1, { Ava: { sips: 3 }, Ben: { sips: 3 } }),
    card(2, 1, { Cal: { sips: 1 }, Dee: { sips: 1 } }), card(2, 3, { Cal: { sips: 2 }, Dee: { sips: 4 } })
  ];
  const b = L.leaderboard(base({ cards }));
  assert.equal(b.every(r => !('toPar' in r)), true);
  // team 1 total 3, team 2 total 4
  assert.deepEqual(b.map(r => [r.team, r.total]), [[1, 3], [2, 4]]);
});

test('same total ranks the team that has played more holes first', () => {
  const cards = [
    card(1, 1, { Ava: { sips: 3 }, Ben: { sips: 3 } }),
    card(2, 1, { Cal: { sips: 1 }, Dee: { sips: 1 } }), card(2, 3, { Cal: { sips: 2 }, Dee: { sips: 2 } })
  ];
  const b = L.leaderboard(base({ cards }));
  // both total 3, team 2 has played two holes
  assert.deepEqual(b.map(r => [r.team, r.total, r.played]), [[2, 3, 2], [1, 3, 1]]);
  assert.equal(b[0].tied, false);
});

test('finished level teams are tied until a tie-break order is set', () => {
  const all = [
    card(1, 1, { Ava: { sips: 3 }, Ben: { sips: 3 } }), card(2, 1, { Cal: { sips: 3 }, Dee: { sips: 3 } }),
    card(1, 3, { Ava: { sips: 3 }, Ben: { sips: 3 } }), card(2, 3, { Cal: { sips: 3 }, Dee: { sips: 3 } })
  ];
  const race = [{ team: 1, ms: 1 }, { team: 2, ms: 1 }];
  let board = L.leaderboard(base({ cards: all, race }));
  assert.equal(board[0].tied, true); assert.equal(board[0].done, true); assert.equal(board[1].rank, 1);
  board = L.leaderboard(base({ cards: all, race, settings: Object.assign({}, SETTINGS, { tiebreakOrder: [2, 1] }) }));
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

test('cards with one-sip drinks or identical sips get flagged', () => {
  assert.deepEqual(j(L.cardFlags({ Ava: { sips: 1 }, Ben: { sips: 4 } }, 'Large red wine')), ['Ava finished in one sip']);
  assert.deepEqual(j(L.cardFlags({ Ava: { sips: 1 } }, 'Fireball shot')), []);
  assert.deepEqual(j(L.cardFlags({ Ava: { sips: 1 } }, 'Fireball SHOT')), []);
  assert.deepEqual(j(L.cardFlags({ A: { sips: 3 }, B: { sips: 3 }, C: { sips: 3 }, D: { missed: true } }, 'Premix')), ['Everyone has the same sips']);
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

test('tab splits evenly by default and settles in few transfers', () => {
  const out = L.settleTab([{ payer: 'Ava', cents: 3000, forWho: [] }, { payer: 'Ben', cents: 1500, forWho: [] }], ['Ava', 'Ben', 'Cal']);
  assert.deepEqual(j(out.balances), { Ava: 1500, Ben: 0, Cal: -1500 });
  assert.deepEqual(j(out.transfers), [{ from: 'Cal', to: 'Ava', cents: 1500 }]);
});

test('tab respects who a cost was for and keeps every cent', () => {
  const out = L.settleTab([{ payer: 'Ava', cents: 1000, forWho: ['Ava', 'Ben', 'Cal'] }, { payer: 'Cal', cents: 2000, forWho: ['Ben', 'Cal'] }], ['Ava', 'Ben', 'Cal']);
  // 1000 / 3 = 334, 333, 333. Ben owes 333 + 1000, Cal is +2000 - 333 - 1000
  assert.deepEqual(j(out.balances), { Ava: 666, Ben: -1333, Cal: 667 });
  assert.equal(Object.values(out.balances).reduce((a, b) => a + b, 0), 0);
});

test('tab ignores entries for people not on the team', () => {
  assert.deepEqual(j(L.settleTab([{ payer: 'Zed', cents: 500, forWho: [] }], ['Ava']).balances), { Ava: 0 });
});
