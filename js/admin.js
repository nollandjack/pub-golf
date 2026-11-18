import { el, face, fileToJpeg, toast } from './ui.js';

export function render(root, s, ctx) {
  const a = s.admin;
  root.append(el('h2', null, 'Admin'));
  root.append(teamBuilder(s, ctx), links(s, ctx), photos(s, ctx), override(s, ctx), challenges(s, ctx), tiebreak(s, ctx), log(a));
}

function teamBuilder(s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Teams'));
  c.append(el('p', 'sub', 'Together and apart rules come from the Constraints tab in the Sheet. ' + s.admin.constraints.length + ' rules loaded.'));
  const count = el('input'); count.type = 'number'; count.min = 1; count.value = Math.max(2, s.teams.length);
  let proposal = null;
  const out = el('div');
  const shuffle = el('button', 'btn ghost', 'Shuffle teams');
  shuffle.onclick = async () => {
    const r = await ctx.act('proposeTeams', { teamCount: Number(count.value), seed: Date.now() % 100000 });
    if (!r) return;
    proposal = r.map((members, i) => ({ name: (s.teams[i] && s.teams[i].name) || 'Team ' + (i + 1), captain: members[0], members }));
    show();
  };
  function show() {
    out.innerHTML = '';
    proposal.forEach(t => {
      const box = el('div', 'card');
      box.append(el('strong', null, t.name));
      t.members.forEach(m => {
        const r = el('label', 'row');
        const rb = el('input'); rb.type = 'radio'; rb.name = 'cap-' + t.name; rb.checked = m === t.captain; rb.style.width = 'auto';
        rb.onchange = () => { t.captain = m; };
        r.append(rb, face(s, m, 28), el('span', null, m + ' (captain?)'));
        box.append(r);
      });
      out.append(box);
    });
    const save = el('button', 'btn', 'Save these teams');
    save.onclick = async () => {
      if (!confirm('Save these teams? Old team and captain links stop working.')) return;
      if (await ctx.act('saveTeams', { teams: proposal })) { toast('Teams saved. Old team links are off, make new links below.'); ctx.draw(); }
    };
    out.append(el('p', 'sub', 'Saving switches off the old team and captain links. Make new ones after.'), save);
  }
  const r = el('div', 'row'); r.append(el('span', null, 'Number of teams'), count, shuffle);
  c.append(r, out);
  return c;
}

function links(s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Links to send'));
  const make = el('button', 'btn', 'Make any missing links');
  make.onclick = async () => { if (await ctx.act('makeCodes', {})) ctx.draw(); };
  c.append(make);
  const base = location.origin + location.pathname + '?k=';
  s.admin.codes.filter(x => x.active && x.role !== 'admin').forEach(x => {
    const team = s.teams.find(t => t.id === x.team);
    const label = { team: 'Team link', captain: 'Captain', ref: 'Ref' }[x.role] + ', ' + (x.role === 'team' ? (team ? team.name : x.person) : x.person);
    const r = el('div', 'row');
    const copy = el('button', 'btn ghost', 'Copy');
    copy.onclick = async () => { try { await navigator.clipboard.writeText(base + x.code); toast('Copied ' + label); } catch (_) { prompt('Copy this link', base + x.code); } };
    const off = el('button', 'btn ghost', 'Switch off');
    off.onclick = async () => { if (confirm('Switch off ' + label + '? They will need a new link.') && await ctx.act('revokeCode', { code: x.code })) ctx.draw(); };
    r.append(el('span', null, label), copy, off);
    c.append(r);
  });
  return c;
}

function photos(s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Player photos'));
  s.admin.people.forEach(p => {
    const r = el('div', 'row');
    const f = el('input'); f.type = 'file'; f.accept = 'image/*'; f.style.width = 'auto';
    f.onchange = async () => {
      if (!f.files[0]) return;
      try { const photo = await fileToJpeg(f.files[0], 400); if (await ctx.act('setPersonPhoto', { name: p.name, photo })) { toast('Saved ' + p.name); ctx.draw(); } } catch (e) { toast(e.message); }
    };
    r.append(face(s, p.name, 40), el('span', null, p.name + (p.role === 'ref' ? ' (ref)' : '')), f);
    c.append(r);
  });
  return c;
}

function override(s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Enter or fix a score'));
  const team = el('select'); s.teams.forEach(t => { const o = el('option', null, t.name); o.value = t.id; team.append(o); });
  const hole = el('select'); s.holes.filter(h => h.kind === 'normal').forEach(h => { const o = el('option', null, 'Hole ' + h.hole); o.value = h.hole; hole.append(o); });
  const rows = el('div');
  const draw = () => {
    rows.innerHTML = '';
    const t = s.teams.find(x => x.id === Number(team.value));
    (t ? t.members : []).forEach(m => {
      const i = el('input'); i.type = 'number'; i.placeholder = m + ' sips, blank if missed'; i.dataset.name = m;
      rows.append(i);
    });
  };
  team.onchange = draw; draw();
  const reason = el('input'); reason.placeholder = 'Reason';
  const save = el('button', 'btn', 'Save as confirmed');
  save.onclick = async () => {
    if (!confirm('Replace this team\'s score for this hole?')) return;
    const scores = {};
    rows.querySelectorAll('input').forEach(i => { scores[i.dataset.name] = i.value === '' ? { missed: true } : { sips: Number(i.value) }; });
    if (await ctx.act('overrideCard', { team: Number(team.value), hole: Number(hole.value), scores, reason: reason.value })) toast('Saved');
  };
  c.append(team, hole, rows, reason, el('p'), save);
  c.append(el('p', 'sub', 'This replaces any card for that team and hole. Penalties go in as extra sips here.'));
  return c;
}

function challenges(s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Challenges'));
  const open = s.admin.challenges.filter(x => x.status === 'open');
  if (!open.length) c.append(el('p', 'sub', 'None open.'));
  open.forEach(x => {
    const name = id => (s.teams.find(t => t.id === id) || {}).name || 'Team ' + id;
    const r = el('div', 'row');
    const up = el('button', 'btn ghost', 'Upheld'); up.onclick = async () => { if (await ctx.act('resolveChallenge', { id: x.id, outcome: 'upheld' })) { toast('Upheld. Fix the score above.'); ctx.draw(); } };
    const no = el('button', 'btn ghost', 'Dismissed'); no.onclick = async () => { if (await ctx.act('resolveChallenge', { id: x.id, outcome: 'dismissed' })) ctx.draw(); };
    r.append(el('span', null, name(x.byTeam) + ' challenges ' + name(x.team) + ', hole ' + x.hole + '. ' + x.reason), up, no);
    c.append(r);
  });
  return c;
}

function tiebreak(s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Sudden death result'));
  c.append(el('p', 'sub', 'Pick the winner of the sudden death shot. They go ahead of the teams they were level with.'));
  const pick = el('select'); s.teams.forEach(t => { const o = el('option', null, t.name); o.value = t.id; pick.append(o); });
  const b = el('button', 'btn ghost', 'Set winner');
  b.onclick = async () => {
    const order = [Number(pick.value)].concat((s.admin.settings.tiebreakOrder || []).filter(id => id !== Number(pick.value)));
    if (await ctx.act('tiebreak', { order })) toast('Tie-break saved');
  };
  c.append(pick, el('p'), b);
  return c;
}

function log(a) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Recent activity'));
  a.log.slice(0, 20).forEach(x => c.append(el('p', 'sub', new Date(Number(x.ts)).toLocaleTimeString() + ' ' + x.who + ' ' + x.action)));
  return c;
}
