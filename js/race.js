import { el, clock, money, toast } from './ui.js';

export function render(root, s, ctx) {
  root.append(el('h2', null, 'Boat race'));
  const times = {}, dnfSaved = {};
  s.race.forEach(r => { times[r.team] = r.ms; dnfSaved[r.team] = !!r.dnf; });
  let start = null, timer = null;
  const big = el('div', 'big', '0:00.0');
  const go = el('button', 'btn', 'Start');
  const boxes = {}, taps = {}, dnfs = {};
  // Accepts m:ss, m:ss.s or plain seconds. Returns whole ms, or null if empty or unreadable.
  function parseTime(v) {
    v = String(v || '').trim();
    if (!v) return null;
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(v);
    if (!m) return NaN;
    return Math.round(((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 1000);
  }
  go.onclick = () => {
    if (s.teams.some(t => boxes[t.id].value.trim() !== '' || dnfs[t.id].checked) && !confirm('Restart the race and clear the times?')) return;
    start = performance.now();
    s.teams.forEach(t => { boxes[t.id].value = ''; dnfs[t.id].checked = false; });
    clearInterval(timer); timer = setInterval(() => {
      if (!big.isConnected) { clearInterval(timer); return; }
      big.textContent = clock(performance.now() - start);
    }, 100);
    sync();
  };
  const list = el('div');
  function sync() {
    s.teams.forEach(t => {
      boxes[t.id].disabled = dnfs[t.id].checked;
      taps[t.id].disabled = start == null || dnfs[t.id].checked || boxes[t.id].value.trim() !== '';
    });
    if (start != null && s.teams.every(t => dnfs[t.id].checked || boxes[t.id].value.trim() !== '')) clearInterval(timer);
  }
  s.teams.forEach(t => {
    const box = el('input'); box.type = 'text'; box.inputMode = 'decimal'; box.placeholder = 'm:ss.s'; box.style.width = '90px';
    if (times[t.id] != null) box.value = clock(times[t.id]);
    box.oninput = sync;
    const b = el('button', 'btn', 'Done');
    b.onclick = () => { box.value = clock(Math.round(performance.now() - start)); sync(); };
    const dnfBox = el('input'); dnfBox.type = 'checkbox'; dnfBox.checked = !!dnfSaved[t.id];
    dnfBox.setAttribute('aria-label', 'Did not finish, ' + t.name);
    dnfBox.onchange = sync;
    dnfBox.style.width = 'auto';
    const dnfLabel = el('label', null, 'DNF'); dnfLabel.style.cssText = 'display:inline-flex;gap:4px;align-items:center;margin:0'; dnfLabel.prepend(dnfBox);
    boxes[t.id] = box; taps[t.id] = b; dnfs[t.id] = dnfBox;
    const r = el('div', 'row'); r.append(el('strong', null, t.name), box, b, dnfLabel); list.append(r);
  });
  sync();
  const save = el('button', 'btn', 'Save race result');
  save.onclick = async () => {
    const results = [];
    for (const t of s.teams) {
      if (dnfs[t.id].checked) { results.push({ team: t.id, dnf: true }); continue; }
      const ms = parseTime(boxes[t.id].value);
      if (Number.isNaN(ms)) { toast('Check the time for ' + t.name + '. Use m:ss or seconds.'); return; }
      if (ms != null) results.push({ team: t.id, ms });
    }
    if (!results.length) { toast('Enter at least one team'); return; }
    if (results.length < s.teams.length && !confirm('Not every team has a time or a DNF. Save anyway?')) return;
    if (await ctx.act('raceResult', { results })) toast('Race saved');
  };
  const rc = el('div', 'card'); rc.append(big, go, list, save); root.append(rc);

  root.append(el('h2', null, 'Pokies'));
  const pc = el('div', 'card');
  const inputs = {};
  s.teams.forEach(t => {
    const i = el('input'); i.type = 'number'; i.step = '0.05'; i.min = 0; i.placeholder = 'Cash out $';
    const prev = s.pokies.find(p => p.team === t.id); if (prev) i.value = (prev.cents / 100).toFixed(2);
    inputs[t.id] = i;
    pc.append(el('label', null, t.name), i);
  });
  const ps = el('button', 'btn', 'Save pokies');
  ps.onclick = async () => {
    const results = s.teams.filter(t => inputs[t.id].value !== '').map(t => ({ team: t.id, cents: Math.round(Number(inputs[t.id].value) * 100) }));
    if (await ctx.act('pokiesResult', { results })) toast('Pokies saved. Top team gets ' + s.settings.pokiesBonus + ' off.');
  };
  pc.append(el('p'), ps);
  root.append(pc);
  if (s.pokies.length) root.append(el('p', 'sub', 'Saved: ' + s.pokies.map(p => (s.teams.find(t => t.id === p.team) || {}).name + ' ' + money(p.cents)).join(', ')));
}
