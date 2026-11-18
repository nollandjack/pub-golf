import { el, clock, money, toast } from './ui.js';

export function render(root, s, ctx) {
  root.append(el('h2', null, 'Boat race'));
  const times = {};
  s.race.forEach(r => { times[r.team] = r.ms; });
  let start = null, timer = null;
  const big = el('div', 'big', '0:00.0');
  const go = el('button', 'btn', 'Start');
  go.onclick = () => {
    start = performance.now();
    s.teams.forEach(t => { delete times[t.id]; });
    clearInterval(timer); timer = setInterval(() => { big.textContent = clock(performance.now() - start); }, 100);
    draw();
  };
  const list = el('div');
  function draw() {
    list.innerHTML = '';
    s.teams.forEach(t => {
      const b = el('button', times[t.id] != null ? 'btn ghost' : 'btn', t.name + (times[t.id] != null ? ', ' + clock(times[t.id]) : ', tap when done'));
      b.disabled = start == null || times[t.id] != null;
      b.onclick = () => { times[t.id] = Math.round(performance.now() - start); if (s.teams.every(x => times[x.id] != null)) clearInterval(timer); draw(); };
      const r = el('p'); r.append(b); list.append(r);
    });
  }
  draw();
  const save = el('button', 'btn', 'Save race result');
  save.onclick = async () => {
    const results = s.teams.filter(t => times[t.id] != null).map(t => ({ team: t.id, ms: times[t.id] }));
    if (results.length < s.teams.length && !confirm('Not every team has a time. Save anyway?')) return;
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
