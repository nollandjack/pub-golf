// Pure game rules. No Google APIs here, so Node tests can load this file.

var PENALTIES = { spill: 1, toilet: 2, unfinished: 3, chuck: 5, slip: 1, word: 1 };

function round2(n) { return Math.round(n * 100) / 100; }

function playerScore(entry) {
  let total = Number(entry.sips) || 0;
  const pen = entry.pen || {};
  Object.keys(PENALTIES).forEach(k => { total += (Number(pen[k]) || 0) * PENALTIES[k]; });
  return total;
}

// Every roster player counts. A missed or blank entry scores par plus the missed-hole penalty.
function holeTeamScore(scores, roster, par, missedPenalty) {
  if (!roster.length) return 0;
  let sum = 0;
  roster.forEach(name => {
    const e = scores[name];
    sum += (!e || e.missed) ? par + missedPenalty : playerScore(e);
  });
  return round2(sum / roster.length);
}
