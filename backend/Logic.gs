// Pure game rules. No Google APIs here, so Node tests can load this file.

var PENALTIES = { spill: 1, toilet: 2, unfinished: 3, chuck: 5, slip: 1, word: 1 };

function round2(n) { return Math.round(n * 100) / 100; }

function playerScore(entry) {
  let total = Number(entry.sips) || 0;
  const pen = entry.pen || {};
  Object.keys(PENALTIES).forEach(k => { total += (Number(pen[k]) || 0) * PENALTIES[k]; });
  return total;
}

// Every roster player counts. A missed or blank entry scores missedScore.
function holeTeamScore(scores, roster, missedScore) {
  if (!roster.length) return 0;
  let sum = 0;
  roster.forEach(name => {
    const e = scores[name];
    sum += (!e || e.missed) ? missedScore : playerScore(e);
  });
  return round2(sum / roster.length);
}

// Highest real player score on a hole across every confirmed card, any team. Null when nobody has one yet.
function worstOnHole(cards, hole) {
  let worst = null;
  cards.forEach(c => {
    if (c.hole !== hole || c.status !== 'confirmed') return;
    Object.keys(c.scores || {}).forEach(n => {
      const e = c.scores[n];
      if (!e || e.missed) return;
      const v = playerScore(e);
      if (worst == null || v > worst) worst = v;
    });
  });
  return worst;
}

// Teams that did not finish are left out. Ties share a place.
function raceRanks(rows) {
  const out = {};
  const ranked = rows.filter(r => !r.dnf);
  ranked.forEach(r => { out[r.team] = 1 + ranked.filter(x => x.ms < r.ms).length; });
  return out;
}

function raceScore(row, rank, settings) {
  if (row.dnf) return settings.raceDnf;
  return settings.raceFirst + settings.raceStep * (rank - 1);
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
  const st = d.settings;
  const num = (v, def) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? def : Number(v));
  const rs = { raceFirst: num(st.raceFirst, -2), raceStep: num(st.raceStep, 2), raceDnf: num(st.raceDnf, 15) };
  const missedExtra = num(st.missedExtra, 5);
  const bonus = num(st.pokiesBonus, 3);
  const order = st.tiebreakOrder || [];
  const ranks = raceRanks(d.race);
  const winners = pokiesWinners(d.pokies);
  const holes = d.holes.slice().sort((a, b) => a.hole - b.hole);
  const confirmed = d.cards.filter(c => c.status === 'confirmed');

  const rows = d.teams.map(t => {
    const roster = rosterOf(d.people, t.id);
    const row = { team: t.id, name: t.name, total: 0, played: 0, nextHole: null, pending: false, byHole: {} };
    holes.forEach(h => {
      let score = null;
      if (h.kind === 'race') {
        const r = d.race.find(x => x.team === t.id);
        if (r && (r.dnf || ranks[t.id] != null)) score = raceScore(r, ranks[t.id], rs) - (winners.indexOf(t.id) >= 0 ? bonus : 0);
      } else {
        const c = confirmed.find(x => x.team === t.id && x.hole === h.hole);
        if (c) score = holeTeamScore(c.scores, roster, (worstOnHole(confirmed, h.hole) || 0) + missedExtra);
        else if (d.cards.some(x => x.team === t.id && x.hole === h.hole && x.status === 'pending')) row.pending = true;
      }
      if (score == null) { if (row.nextHole == null) row.nextHole = h.hole; return; }
      row.byHole[h.hole] = score; row.total += score; row.played++;
    });
    row.total = round2(row.total);
    row.done = row.nextHole == null;
    return row;
  });

  const tb = id => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
  rows.sort((a, b) => a.total - b.total || b.played - a.played || tb(a.team) - tb(b.team) || a.team - b.team);
  rows.forEach((r, i) => {
    const p = rows[i - 1];
    r.rank = p && p.total === r.total && p.played === r.played && tb(p.team) === tb(r.team) ? p.rank : i + 1;
  });
  rows.forEach(r => { r.tied = rows.filter(x => x.rank === r.rank).length > 1; });
  return rows;
}

function confirmersFor(teamId, teamIds) {
  const ids = teamIds.slice().sort((a, b) => a - b);
  const i = ids.indexOf(teamId);
  if (i < 0 || ids.length < 2) return [];
  const ringStart = ids.length % 2 === 1 && ids.length >= 3 ? ids.length - 3 : ids.length;
  if (i >= ringStart) {
    const ring = ids.slice(ringStart);
    return [ring[(i - ringStart + 2) % 3]];
  }
  return [ids[i % 2 === 0 ? i + 1 : i - 1]];
}

function cardFlags(scores, drink) {
  const flags = [];
  const played = Object.keys(scores).filter(n => !scores[n].missed);
  const shot = /shot/i.test(String(drink || ''));
  played.forEach(n => { if (Number(scores[n].sips) === 1 && !shot) flags.push(n + ' finished in one sip'); });
  const sips = played.map(n => Number(scores[n].sips));
  if (sips.length >= 3 && sips.every(s => s === sips[0])) flags.push('Everyone has the same sips');
  return flags;
}

// Seeded random so the same seed always gives the same teams.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[k]; arr[k] = tmp;
  }
  return arr;
}

// Together pairs are merged into groups first. Apart pairs must end up in different teams.
function buildTeams(players, constraints, teamCount, rng) {
  if (!(teamCount >= 1 && teamCount <= players.length)) return { error: 'Need between 1 and ' + players.length + ' teams' };
  const parent = {};
  players.forEach(p => { parent[p] = p; });
  const find = p => (parent[p] === p ? p : (parent[p] = find(parent[p])));
  const known = c => parent[c.a] != null && parent[c.b] != null;
  constraints.filter(c => c.kind === 'together' && known(c)).forEach(c => { parent[find(c.a)] = find(c.b); });
  const apart = constraints.filter(c => c.kind === 'apart' && known(c));
  for (const c of apart) if (find(c.a) === find(c.b)) return { error: c.a + ' and ' + c.b + ' are set as both together and apart' };

  const byRoot = {};
  players.forEach(p => { (byRoot[find(p)] = byRoot[find(p)] || []).push(p); });
  const groups = Object.keys(byRoot).map(k => byRoot[k]);
  const cap = Math.ceil(players.length / teamCount);
  for (const g of groups) if (g.length > cap) return { error: g.join(', ') + ' are too many to keep together with ' + teamCount + ' teams' };
  const clash = (team, g) => apart.some(c => (team.indexOf(c.a) >= 0 && g.indexOf(c.b) >= 0) || (team.indexOf(c.b) >= 0 && g.indexOf(c.a) >= 0));

  for (let attempt = 0; attempt < 500; attempt++) {
    const order = shuffle(groups.slice(), rng).sort((a, b) => b.length - a.length);
    const teams = Array.from({ length: teamCount }, () => []);
    let ok = true;
    for (const g of order) {
      const options = teams.filter(t => t.length + g.length <= cap && !clash(t, g));
      if (!options.length) { ok = false; break; }
      const smallest = Math.min.apply(null, options.map(t => t.length));
      const pick = shuffle(options.filter(t => t.length === smallest), rng)[0];
      g.forEach(n => pick.push(n));
    }
    if (ok) return { teams };
  }
  return { error: 'Could not find teams that keep everyone apart who needs to be. Try a different team count.' };
}

// Entries split evenly across forWho (or the whole team when empty). Odd cents go to the first people listed.
function settleTab(entries, members) {
  const bal = {};
  members.forEach(m => { bal[m] = 0; });
  entries.forEach(e => {
    const who = ((e.forWho && e.forWho.length) ? e.forWho : members).filter(m => m in bal);
    if (!who.length || !(e.payer in bal)) return;
    const cents = Math.round(Number(e.cents) || 0);
    bal[e.payer] += cents;
    const share = Math.floor(cents / who.length);
    let rem = cents - share * who.length;
    who.forEach(m => { bal[m] -= share + (rem > 0 ? 1 : 0); if (rem > 0) rem--; });
  });
  const side = sign => members.filter(m => sign * bal[m] > 0).map(m => ({ m, v: Math.abs(bal[m]) })).sort((a, b) => b.v - a.v);
  const debtors = side(-1);
  const creditors = side(1);
  const transfers = [];
  let i = 0, k = 0;
  while (i < debtors.length && k < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[k].v);
    transfers.push({ from: debtors[i].m, to: creditors[k].m, cents: amt });
    debtors[i].v -= amt; creditors[k].v -= amt;
    if (!debtors[i].v) i++;
    if (!creditors[k].v) k++;
  }
  return { balances: bal, transfers };
}
