// Requests, access and state. Storage only through the store object (SheetStore.gs in Apps Script, tools/memory-store.js in tests).

var ACTIONS = {};

function clean_(s, max) {
  return String(s == null ? '' : s).trim().replace(/^[=+\-@]+/, '').trim().slice(0, max || 200);
}

function parseJson_(v, fallback) {
  if (v === '' || v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}

function num_(v) { return v === '' || v == null ? null : Number(v); }
function bool_(v) { return v === true || v === 'TRUE' || v === 'true'; }

function load_(store) {
  const settings = { missedPenalty: 3, pokiesBonus: 3, tiebreakOrder: [] };
  store.all('Settings').forEach(r => { settings[r.key] = parseJson_(r.value, r.value); });
  return {
    settings,
    holes: store.all('Holes').map(h => ({ hole: num_(h.hole), name: String(h.name), address: String(h.address || ''), lat: num_(h.lat), lng: num_(h.lng), drink: String(h.drink || ''), par: num_(h.par) || 0, hazard: String(h.hazard || ''), kind: h.kind === 'race' ? 'race' : 'normal' })).sort((a, b) => a.hole - b.hole),
    teams: store.all('Teams').map(t => ({ id: num_(t.id), name: String(t.name), captain: String(t.captain || '') })).sort((a, b) => a.id - b.id),
    people: store.all('People').map(p => ({ name: String(p.name), team: num_(p.team), role: p.role === 'ref' ? 'ref' : 'player', photoId: String(p.photoId || '') })),
    codes: store.all('Codes').map(c => ({ code: String(c.code), role: String(c.role), team: num_(c.team), person: String(c.person || ''), active: bool_(c.active) })),
    constraints: store.all('Constraints').map(c => ({ kind: String(c.kind), a: String(c.a), b: String(c.b) })),
    cards: store.all('Cards').map(c => ({ id: String(c.id), team: num_(c.team), hole: num_(c.hole), scores: parseJson_(c.scores, {}), photoId: String(c.photoId || ''), status: String(c.status), submittedBy: String(c.submittedBy || ''), confirmedBy: String(c.confirmedBy || ''), note: String(c.note || ''), ts: num_(c.ts) })),
    race: store.all('Race').map(r => ({ team: num_(r.team), ms: num_(r.ms) })),
    pokies: store.all('Pokies').map(r => ({ team: num_(r.team), cents: num_(r.cents) })),
    tab: store.all('Tab').map(r => ({ id: String(r.id), team: num_(r.team), payer: String(r.payer), venue: String(r.venue || ''), item: String(r.item || ''), cents: num_(r.cents), forWho: parseJson_(r.forWho, []), ts: num_(r.ts), deleted: bool_(r.deleted) })),
    challenges: store.all('Challenges').map(r => ({ id: String(r.id), byTeam: num_(r.byTeam), team: num_(r.team), hole: num_(r.hole), reason: String(r.reason || ''), status: String(r.status), ts: num_(r.ts) }))
  };
}

function whoAmI_(d, code) {
  const c = code && d.codes.find(x => x.active && x.code === code);
  return c ? { role: c.role, team: c.team, person: c.person } : { role: 'public', team: null, person: '' };
}

function canConfirm_(d, who, card) {
  if (who.team != null && card.team === who.team) return false;
  if (who.role === 'ref' || who.role === 'admin') return true;
  if (who.role !== 'captain') return false;
  return confirmersFor(card.team, d.teams.map(t => t.id)).indexOf(who.team) >= 0;
}

function state_(d, who, store) {
  const board = leaderboard(d);
  const staff = who.role === 'admin' || who.role === 'ref';
  const reached = board.reduce((m, r) => Math.max(m, r.nextHole == null ? 999 : r.nextHole), 0);
  const teamName = id => (d.teams.find(t => t.id === id) || {}).name || 'Team ' + id;
  const faces = {};
  d.people.forEach(p => { if (p.photoId) faces[p.name] = store.photoUrl(p.photoId); });
  const s = {
    who: { role: who.role, team: who.team, person: who.person },
    settings: { missedPenalty: d.settings.missedPenalty, pokiesBonus: d.settings.pokiesBonus },
    holes: d.holes.map(h => Object.assign({}, h, { hazard: staff || h.hole <= reached ? h.hazard : (h.hazard ? 'hidden' : '') })),
    teams: d.teams.map(t => ({ id: t.id, name: t.name, captain: t.captain, members: rosterOf(d.people, t.id) })),
    faces,
    refs: d.people.filter(p => p.role === 'ref').map(p => p.name),
    board,
    race: d.race,
    pokies: d.pokies,
    photos: d.cards.filter(c => c.status === 'confirmed' && c.photoId).map(c => ({ team: c.team, teamName: teamName(c.team), hole: c.hole, url: store.photoUrl(c.photoId) }))
  };
  if (who.role === 'captain') {
    const row = board.find(r => r.team === who.team);
    s.mine = { nextHole: row ? row.nextHole : null, roster: rosterOf(d.people, who.team), cards: d.cards.filter(c => c.team === who.team).map(c => ({ id: c.id, hole: c.hole, status: c.status, note: c.note, scores: c.scores })) };
    s.myChallenges = d.challenges.filter(c => c.byTeam === who.team);
  }
  if (who.role === 'captain' || staff) {
    s.queue = d.cards.filter(c => c.status === 'pending' && canConfirm_(d, who, c)).map(c => {
      const h = d.holes.find(x => x.hole === c.hole) || { par: 0 };
      return { id: c.id, team: c.team, teamName: teamName(c.team), hole: c.hole, par: h.par, scores: c.scores, flags: cardFlags(c.scores, h.par), photo: store.photoUrl(c.photoId), submittedBy: c.submittedBy, ts: c.ts };
    });
  }
  if (who.role === 'team' || who.role === 'captain') {
    const members = rosterOf(d.people, who.team);
    const entries = d.tab.filter(e => e.team === who.team && !e.deleted);
    s.tab = { members, entries, settle: settleTab(entries, members) };
  }
  if (who.role === 'admin') {
    s.admin = { people: d.people, constraints: d.constraints, codes: d.codes, challenges: d.challenges, cards: d.cards, settings: d.settings, log: store.all('Log').slice(-50).reverse() };
  }
  return s;
}

function log_(store, who, req, now) {
  const detail = Object.assign({}, req);
  delete detail.k; delete detail.photo; delete detail.method;
  store.append('Log', { ts: now, who: who.person || who.role, action: clean_(req.type, 40), detail: JSON.stringify(detail).slice(0, 500) });
}

function handle(req, store, now) {
  try {
    const d = load_(store);
    const who = whoAmI_(d, String(req.k || ''));
    if (req.method === 'GET') return { ok: true, state: state_(d, who, store) };
    const fn = Object.prototype.hasOwnProperty.call(ACTIONS, req.type) ? ACTIONS[req.type] : null;
    if (!fn) return { ok: false, error: 'Unknown request' };
    const r = fn(req, d, who, store, now) || {};
    if (r.error) return { ok: false, error: r.error, state: state_(d, who, store) };
    log_(store, who, req, now);
    const out = { ok: true, state: state_(load_(store), who, store) };
    if (r.result !== undefined) out.result = r.result;
    return out;
  } catch (err) {
    return { ok: false, error: 'Something broke on our side. Try again.' };
  }
}

function cleanScores_(raw, roster) {
  const out = {};
  for (const name of roster) {
    const e = raw && raw[name];
    if (!e) return 'Missing a score for ' + name;
    if (e.missed) { out[name] = { missed: true }; continue; }
    const sips = Number(e.sips);
    if (!Number.isInteger(sips) || sips < 1 || sips > 50) return 'Sips for ' + name + ' must be a whole number from 1 to 50';
    const pen = {};
    for (const k of Object.keys(PENALTIES)) {
      const n = Number((e.pen || {})[k] || 0);
      if (!Number.isInteger(n) || n < 0 || n > 20) return 'Bad penalty count for ' + name;
      if (n) pen[k] = n;
    }
    out[name] = { sips, pen };
  }
  return out;
}

ACTIONS.submitCard = function (req, d, who, store, now) {
  if (who.role !== 'captain') return { error: 'Only captains can enter scores' };
  const hole = d.holes.find(h => h.hole === Number(req.hole));
  if (!hole || hole.kind !== 'normal') return { error: 'That hole is not scored on a card' };
  const row = leaderboard(d).find(r => r.team === who.team);
  if (!row || row.nextHole == null) return { error: 'Your team has finished the course' };
  if (row.nextHole !== hole.hole) return { error: 'Your team is on hole ' + row.nextHole };
  if (d.cards.some(c => c.team === who.team && c.hole === hole.hole && c.status === 'pending')) return { error: 'This hole is already waiting to be confirmed' };
  const scores = cleanScores_(req.scores, rosterOf(d.people, who.team));
  if (typeof scores === 'string') return { error: scores };
  let photoId = '';
  if (req.photo) {
    if (String(req.photo).length > 1500000) return { error: 'That photo is too big' };
    photoId = store.savePhoto(String(req.photo), 'team' + who.team + '-hole' + hole.hole);
  }
  store.append('Cards', { id: 'c' + store.newId(), team: who.team, hole: hole.hole, scores: JSON.stringify(scores), photoId, status: 'pending', submittedBy: who.person, confirmedBy: '', note: '', ts: now });
};

function decide_(req, d, who, store, status) {
  const card = d.cards.find(c => c.id === String(req.cardId));
  if (!card || card.status !== 'pending') return { error: 'That card is not waiting any more' };
  if (!canConfirm_(d, who, card)) return { error: 'You cannot confirm this team' };
  const note = clean_(req.note, 200);
  if (status === 'returned' && !note) return { error: 'Say why it is going back' };
  store.update('Cards', r => String(r.id) === card.id, { status, confirmedBy: who.person || who.role, note });
}
ACTIONS.confirmCard = (req, d, who, store) => decide_(req, d, who, store, 'confirmed');
ACTIONS.returnCard = (req, d, who, store) => decide_(req, d, who, store, 'returned');

ACTIONS.overrideCard = function (req, d, who, store, now) {
  if (who.role !== 'admin') return { error: 'Only Jack can change a score' };
  const reason = clean_(req.reason, 200);
  if (!reason) return { error: 'Add a reason' };
  let card = req.cardId ? d.cards.find(c => c.id === String(req.cardId)) : null;
  const team = card ? card.team : Number(req.team);
  const hole = card ? card.hole : Number(req.hole);
  if (!d.teams.some(t => t.id === team) || !d.holes.some(h => h.hole === hole && h.kind === 'normal')) return { error: 'Pick a team and a card hole' };
  const scores = cleanScores_(req.scores, rosterOf(d.people, team));
  if (typeof scores === 'string') return { error: scores };
  // Any other card for that team and hole stops counting.
  store.update('Cards', r => Number(r.team) === team && Number(r.hole) === hole && r.status !== 'returned', { status: 'returned', note: 'Replaced by Jack' });
  store.append('Cards', { id: 'c' + store.newId(), team, hole, scores: JSON.stringify(scores), photoId: card ? card.photoId : '', status: 'confirmed', submittedBy: 'Jack', confirmedBy: 'Jack', note: 'Jack: ' + reason, ts: now });
};

ACTIONS.challenge = function (req, d, who, store, now) {
  if (who.role !== 'captain') return { error: 'Only captains can challenge' };
  const team = Number(req.team), hole = Number(req.hole);
  if (team === who.team) return { error: 'You cannot challenge your own team' };
  if (!d.cards.some(c => c.team === team && c.hole === hole && c.status === 'confirmed')) return { error: 'That score is not confirmed yet' };
  if (d.challenges.some(c => c.byTeam === who.team && c.hole === hole)) return { error: 'You have already challenged a score on this hole' };
  store.append('Challenges', { id: 'h' + store.newId(), byTeam: who.team, team, hole, reason: clean_(req.reason, 200), status: 'open', ts: now });
};

ACTIONS.resolveChallenge = function (req, d, who, store) {
  if (who.role !== 'admin') return { error: 'Only Jack can rule on a challenge' };
  if (['upheld', 'dismissed'].indexOf(req.outcome) < 0) return { error: 'Pick upheld or dismissed' };
  if (!store.update('Challenges', r => String(r.id) === String(req.id), { status: req.outcome })) return { error: 'Challenge not found' };
};

ACTIONS.renameTeam = function (req, d, who, store) {
  if (who.role !== 'captain') return { error: 'Only the captain can rename the team' };
  const name = clean_(req.name, 30);
  if (!name) return { error: 'Give the team a name' };
  if (d.teams.some(t => t.id !== who.team && t.name.toLowerCase() === name.toLowerCase())) return { error: 'Another team already has that name' };
  store.update('Teams', r => Number(r.id) === who.team, { name });
};

// Boat race and pokies results. Refs or Jack only. Each post replaces the whole tab.
function teamResults_(req, d, field) {
  const rows = [];
  for (const r of (req.results || [])) {
    const team = Number(r.team), v = Number(r[field]);
    if (!d.teams.some(t => t.id === team)) return { error: 'Unknown team ' + r.team };
    if (!Number.isInteger(v) || v < 0) return { error: 'Numbers must be whole and not negative' };
    if (rows.some(x => x.team === team)) return { error: 'Team ' + team + ' is in twice' };
    const row = { team }; row[field] = v; rows.push(row);
  }
  return { rows };
}

ACTIONS.raceResult = function (req, d, who, store) {
  if (who.role !== 'ref' && who.role !== 'admin') return { error: 'Only refs can enter this' };
  const r = teamResults_(req, d, 'ms');
  if (r.error) return r;
  store.replace('Race', r.rows);
};

ACTIONS.pokiesResult = function (req, d, who, store) {
  if (who.role !== 'ref' && who.role !== 'admin') return { error: 'Only refs can enter this' };
  const r = teamResults_(req, d, 'cents');
  if (r.error) return r;
  store.replace('Pokies', r.rows);
};

// Team tab. Each team sees and changes only its own entries.
ACTIONS.tabAdd = function (req, d, who, store, now) {
  if (who.role !== 'team' && who.role !== 'captain') return { error: 'Use your team link to add costs' };
  const members = rosterOf(d.people, who.team);
  const payer = String(req.payer || '');
  if (members.indexOf(payer) < 0) return { error: payer + ' is not on your team' };
  const cents = Number(req.cents);
  if (!Number.isInteger(cents) || cents < 1 || cents > 100000) return { error: 'Enter an amount up to $1000' };
  const forWho = (req.forWho || []).map(String).filter((n, i, a) => members.indexOf(n) >= 0 && a.indexOf(n) === i);
  store.append('Tab', { id: 't' + store.newId(), team: who.team, payer, venue: clean_(req.venue, 60), item: clean_(req.item, 80), cents, forWho: JSON.stringify(forWho), ts: now, deleted: false });
};

ACTIONS.tabDelete = function (req, d, who, store) {
  if (who.role !== 'team' && who.role !== 'captain') return { error: 'Use your team link' };
  if (!store.update('Tab', r => String(r.id) === String(req.id) && Number(r.team) === who.team, { deleted: true })) return { error: 'That entry was not found' };
};

// Admin actions: teams, codes, player photos and tie-break. Jack only unless noted.
function adminOnly_(who) { return who.role === 'admin' ? null : { error: 'Only Jack can do that' }; }

function setSetting_(store, key, value) {
  const v = JSON.stringify(value);
  if (!store.update('Settings', r => r.key === key, { value: v })) store.append('Settings', { key, value: v });
}

ACTIONS.proposeTeams = function (req, d, who, store, now) {
  const no = adminOnly_(who); if (no) return no;
  if (!Number.isInteger(Number(req.teamCount))) return { error: 'Team count must be a whole number' };
  const players = d.people.filter(p => p.role === 'player').map(p => p.name);
  const out = buildTeams(players, d.constraints, Number(req.teamCount), mulberry32(Number(req.seed) || now));
  return out.error ? { error: out.error } : { result: out.teams };
};

ACTIONS.saveTeams = function (req, d, who, store) {
  const no = adminOnly_(who); if (no) return no;
  const players = d.people.filter(p => p.role === 'player').map(p => p.name);
  const seen = {};
  const teams = req.teams || [];
  for (const t of teams) {
    if (!clean_(t.name, 30)) return { error: 'Every team needs a name' };
    if ((t.members || []).indexOf(t.captain) < 0) return { error: 'The captain of ' + t.name + ' must be on that team' };
    for (const m of t.members) {
      if (players.indexOf(m) < 0) return { error: m + ' is not a player on the list' };
      if (seen[m]) return { error: m + ' is on two teams' };
      seen[m] = true;
    }
  }
  store.replace('Teams', teams.map((t, i) => ({ id: i + 1, name: clean_(t.name, 30), captain: t.captain })));
  players.forEach(name => {
    const i = teams.findIndex(t => t.members.indexOf(name) >= 0);
    store.update('People', r => r.name === name, { team: i < 0 ? '' : i + 1 });
  });
};

ACTIONS.makeCodes = function (req, d, who, store) {
  const no = adminOnly_(who); if (no) return no;
  const has = (role, team, person) => d.codes.some(c => c.active && c.role === role && c.team === team && (person == null || c.person === person));
  const add = (role, team, person) => store.append('Codes', { code: 'k' + store.newId(), role, team: team == null ? '' : team, person, active: true });
  d.teams.forEach(t => {
    if (!has('team', t.id)) add('team', t.id, t.name);
    if (!has('captain', t.id, t.captain)) {
      store.update('Codes', r => r.role === 'captain' && Number(r.team) === t.id, { active: false });
      add('captain', t.id, t.captain);
    }
  });
  d.people.filter(p => p.role === 'ref').forEach(p => { if (!has('ref', null, p.name)) add('ref', null, p.name); });
};

ACTIONS.revokeCode = function (req, d, who, store) {
  const no = adminOnly_(who); if (no) return no;
  const c = d.codes.find(x => x.code === String(req.code));
  if (!c) return { error: 'Code not found' };
  if (c.role === 'admin') return { error: 'The admin code is changed in the Sheet, not here' };
  store.update('Codes', r => r.code === c.code, { active: false });
};

ACTIONS.setPersonPhoto = function (req, d, who, store) {
  const no = adminOnly_(who); if (no) return no;
  if (!d.people.some(p => p.name === req.name)) return { error: req.name + ' is not on the list' };
  if (!req.photo || String(req.photo).length > 1500000) return { error: 'Pick a photo under about 1MB' };
  const id = store.savePhoto(String(req.photo), 'person-' + req.name);
  store.update('People', r => r.name === req.name, { photoId: id });
};

ACTIONS.tiebreak = function (req, d, who, store) {
  if (who.role !== 'admin') return { error: 'Only Jack can set the tie-break' };
  const order = (req.order || []).map(Number).filter(id => d.teams.some(t => t.id === id));
  setSetting_(store, 'tiebreakOrder', order);
};
