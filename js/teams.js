import { el, face } from './ui.js';

export function render(root, s, ctx) {
  root.append(el('h2', null, 'Teams'));
  s.teams.forEach(t => {
    const c = el('div', 'card');
    c.append(el('h3', null, t.name));
    t.members.forEach(m => {
      const r = el('div', 'row');
      r.append(face(s, m, 44), el('span', null, m + (m === t.captain ? ' (captain)' : '')));
      c.append(r);
    });
    if (s.who.role === 'captain' && s.who.team === t.id) {
      const input = el('input'); input.value = t.name; input.maxLength = 30;
      const b = el('button', 'btn', 'Rename team');
      b.onclick = async () => { b.disabled = true; if (await ctx.act('renameTeam', { name: input.value })) ctx.draw(); b.disabled = false; };
      const r = el('div', 'row'); r.append(input, b); c.append(el('label', null, 'Team name'), r);
    }
    root.append(c);
  });
  if (s.refs.length) {
    const c = el('div', 'card'); c.append(el('h3', null, 'Roaming refs'));
    s.refs.forEach(m => { const r = el('div', 'row'); r.append(face(s, m, 44), el('span', null, m)); c.append(r); });
    root.append(c);
  }
}
