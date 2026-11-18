import { el, toPar } from './ui.js';

export function render(root, s) {
  root.append(el('h2', null, 'Leaderboard'));
  const table = el('table');
  const head = el('tr');
  [['', ''], ['Team', ''], ['To par', 'num'], ['Thru', 'num']].concat(s.holes.map(h => [String(h.hole), 'num'])).forEach(([t, c]) => head.append(el('th', c, t)));
  table.append(head);
  s.board.forEach(r => {
    const tr = el('tr', r.team === s.who.team ? 'mine' : null);
    tr.append(el('td', null, (r.tied ? 'T' : '') + r.rank));
    tr.append(el('td', null, r.name + (r.pending ? ' (waiting)' : '')));
    tr.append(el('td', 'num', toPar(r.toPar)));
    tr.append(el('td', 'num', r.done ? 'F' : String(r.played)));
    s.holes.forEach(h => tr.append(el('td', 'num', r.byHole[h.hole] == null ? '' : String(r.byHole[h.hole]))));
    table.append(tr);
  });
  const wrap = el('div', 'card scroll'); wrap.append(table); root.append(wrap);
  const level = s.board.filter(r => r.tied && r.done && r.rank === 1);
  if (level.length) root.append(el('p', 'flag', level.map(r => r.name).join(' and ') + ' are level. Sudden death shot, ref times it.'));
  if (s.photos.length) {
    root.append(el('h3', null, 'Photos'));
    const strip = el('div', 'photos');
    s.photos.slice().reverse().forEach(p => { const i = el('img'); i.src = p.url; i.alt = p.teamName + ' hole ' + p.hole; i.loading = 'lazy'; strip.append(i); });
    root.append(strip);
  }
}
