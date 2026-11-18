import { el, face, money, toast } from './ui.js';

export function render(root, s, ctx) {
  const t = s.tab;
  root.append(el('h2', null, 'Team tab'));
  root.append(el('p', 'sub', 'Log what you paid for the team. Settle up tonight or tomorrow. Nothing is charged here.'));

  const form = el('div', 'card');
  let payer = null;
  const who = el('div', 'row');
  t.members.forEach(m => {
    const b = el('button', 'btn ghost');
    b.append(face(s, m, 36), el('span', null, ' ' + m));
    b.onclick = () => { payer = m; [...who.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); b.style.outline = '2px solid var(--accent)'; [...who.children].filter(x => x !== b).forEach(x => { x.style.outline = ''; }); };
    who.append(b);
  });
  const venue = el('select');
  s.holes.map(h => h.name).concat(['Uber', 'Light rail', 'Other']).forEach(v => venue.append(el('option', null, v)));
  const item = el('input'); item.placeholder = 'What was it, e.g. round of Guinness';
  const amount = el('input'); amount.type = 'number'; amount.step = '0.01'; amount.min = 0; amount.placeholder = 'Total $';
  const forBox = el('div', 'row');
  const forWho = new Set();
  t.members.forEach(m => {
    const lab = el('label', 'row'); const cb = el('input'); cb.type = 'checkbox'; cb.style.width = 'auto';
    cb.onchange = () => { cb.checked ? forWho.add(m) : forWho.delete(m); };
    lab.append(cb, face(s, m, 24), el('span', null, m)); forBox.append(lab);
  });
  const add = el('button', 'btn', 'Add to tab');
  add.onclick = async () => {
    if (!payer) { toast('Tap who paid'); return; }
    add.disabled = true;
    const ok = await ctx.act('tabAdd', { payer, venue: venue.value, item: item.value, cents: Math.round(Number(amount.value) * 100), forWho: [...forWho] });
    add.disabled = false;
    if (ok) { toast('Added'); ctx.draw(); }
  };
  form.append(el('label', null, 'Who paid'), who, el('label', null, 'Where'), venue, el('label', null, 'What'), item, el('label', null, 'Amount'), amount,
    el('label', null, 'Only for some people? Tick them. Leave blank for the whole team.'), forBox, el('p'), add);
  root.append(form);

  const owe = el('div', 'card');
  owe.append(el('h3', null, 'Who owes whom'));
  if (!t.settle.transfers.length) owe.append(el('p', 'sub', 'All square.'));
  t.settle.transfers.forEach(x => { const r = el('div', 'row'); r.append(face(s, x.from, 28), el('span', null, x.from + ' pays ' + x.to + ' ' + money(x.cents)), face(s, x.to, 28)); owe.append(r); });
  root.append(owe);

  const list = el('div', 'card');
  list.append(el('h3', null, 'Everything on the tab'));
  t.entries.slice().reverse().forEach(e => {
    const r = el('div', 'row');
    const del = el('button', 'btn ghost', 'Remove');
    del.onclick = async () => { if (confirm('Remove this entry?') && await ctx.act('tabDelete', { id: e.id })) ctx.draw(); };
    r.append(face(s, e.payer, 28), el('span', null, e.payer + ', ' + money(e.cents) + ', ' + e.venue + (e.item ? ', ' + e.item : '') + (e.forWho.length ? ' (for ' + e.forWho.join(', ') + ')' : '')), del);
    list.append(r);
  });
  root.append(list);
}
