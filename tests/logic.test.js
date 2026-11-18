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
