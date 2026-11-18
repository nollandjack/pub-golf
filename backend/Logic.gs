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

function raceRanks(rows) {
  const out = {};
  rows.forEach(r => { out[r.team] = 1 + rows.filter(x => x.ms < r.ms).length; });
  return out;
}

function pokiesWinners(rows) {
  if (!rows.length) return [];
  const top = Math.max.apply(null, rows.map(r => r.cents));
  if (!(top > 0)) return [];
  return rows.filter(r => r.cents === top).map(r => r.team);
}

function rosterOf(people, teamId) {
  return people.filter(p => p.team === teamId && p.role === 'player').map(p => p.name);
}

function leaderboard(d) {
  const missed = Number(d.settings.missedPenalty) || 0;
  const bonus = Number(d.settings.pokiesBonus) || 0;
  const order = d.settings.tiebreakOrder || [];
  const ranks = raceRanks(d.race);
  const winners = pokiesWinners(d.pokies);
  const holes = d.holes.slice().sort((a, b) => a.hole - b.hole);

  const rows = d.teams.map(t => {
    const roster = rosterOf(d.people, t.id);
    const row = { team: t.id, name: t.name, total: 0, toPar: 0, played: 0, nextHole: null, pending: false, byHole: {} };
    let par = 0;
    holes.forEach(h => {
      let score = null;
      if (h.kind === 'race') {
        if (ranks[t.id] != null) score = ranks[t.id] - (winners.indexOf(t.id) >= 0 ? bonus : 0);
      } else {
        const c = d.cards.find(x => x.team === t.id && x.hole === h.hole && x.status === 'confirmed');
        if (c) score = holeTeamScore(c.scores, roster, h.par, missed);
        else if (d.cards.some(x => x.team === t.id && x.hole === h.hole && x.status === 'pending')) row.pending = true;
      }
      if (score == null) { if (row.nextHole == null) row.nextHole = h.hole; return; }
      row.byHole[h.hole] = score; row.total += score; par += h.par; row.played++;
    });
    row.total = round2(row.total);
    row.toPar = round2(row.total - par);
    row.done = row.nextHole == null;
    return row;
  });

  const tb = id => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
  rows.sort((a, b) => a.toPar - b.toPar || b.played - a.played || tb(a.team) - tb(b.team) || a.team - b.team);
  rows.forEach((r, i) => {
    const p = rows[i - 1];
    r.rank = p && p.toPar === r.toPar && p.played === r.played && tb(p.team) === tb(r.team) ? p.rank : i + 1;
  });
  rows.forEach(r => { r.tied = rows.filter(x => x.rank === r.rank).length > 1; });
  return rows;
}
