import { el, face, toast } from './ui.js';

const PEN_NAMES = { spill: 'spill', toilet: 'toilet', unfinished: 'unfinished', chuck: 'chuck', slip: 'slip', word: 'word' };

export function render(root, s, ctx) {
  root.append(el('h2', null, 'Confirm scores'));
  if (!s.queue.length) { root.append(el('p', 'sub', 'Nothing waiting. This page checks again every 30 seconds.')); return; }
  s.queue.forEach(q => {
    const c = el('div', 'card');
    c.append(el('h3', null, q.teamName + ', hole ' + q.hole + ' (par ' + q.par + ')'));
    q.flags.forEach(f => c.append(el('p', 'flag', f)));
    Object.keys(q.scores).forEach(name => {
      const e = q.scores[name];
      const r = el('div', 'row');
      const pens = e.pen ? Object.keys(e.pen).map(k => PEN_NAMES[k] + ' x' + e.pen[k]).join(', ') : '';
      r.append(face(s, name, 32), el('span', null, name + ', ' + (e.missed ? 'missed' : e.sips + ' sips' + (pens ? ', ' + pens : ''))));
      c.append(r);
    });
    if (q.photo) { const i = el('img'); i.src = q.photo; i.style.maxWidth = '100%'; i.style.borderRadius = '8px'; c.append(i); }
    const ok = el('button', 'btn', 'Confirm');
    ok.onclick = async () => { ok.disabled = true; if (await ctx.act('confirmCard', { cardId: q.id })) { toast('Confirmed'); ctx.draw(); } ok.disabled = false; };
    const note = el('input'); note.placeholder = 'Why it is going back';
    const no = el('button', 'btn ghost', 'Send back');
    no.onclick = async () => { if (await ctx.act('returnCard', { cardId: q.id, note: note.value })) { toast('Sent back'); ctx.draw(); } };
    const r = el('div', 'row'); r.append(ok, note, no);
    c.append(r);
    root.append(c);
  });
}
