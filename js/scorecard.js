import { el, face, fileToJpeg, toast } from './ui.js';

const PENS = [['spill', 'Spill +1'], ['toilet', 'Toilet +2'], ['unfinished', 'Unfinished +3'], ['chuck', 'Chuck +5']];
const HAZ = { 'wrong-hand': ['slip', 'Slip +1'], silent: ['word', 'Word +1'] };

export function render(root, s, ctx) {
  const m = s.mine;
  if (m.nextHole == null) { root.append(el('h2', null, 'All done'), el('p', null, 'Your team has finished the course.')); return challenges(root, s, ctx); }
  const hole = s.holes.find(h => h.hole === m.nextHole);
  root.append(el('h2', null, 'Hole ' + hole.hole + ', ' + hole.name));
  root.append(el('p', 'sub', (hole.drink || 'Drink') + (hole.par ? ', par ' + hole.par : '')));
  if (hole.kind === 'race') { root.append(el('p', null, 'This is the boat race. A ref enters the times, nothing to do here.')); return challenges(root, s, ctx); }
  const waiting = m.cards.find(c => c.hole === hole.hole && c.status === 'pending');
  if (waiting) { root.append(el('p', 'card', 'Sent. Waiting for the other team or a ref to confirm.')); return challenges(root, s, ctx); }
  const back = m.cards.filter(c => c.hole === hole.hole && c.status === 'returned').pop();
  if (back && back.note) root.append(el('p', 'flag', 'Sent back: ' + back.note));

  const pens = PENS.concat(hole.hazard && HAZ[hole.hazard] ? [HAZ[hole.hazard]] : []);
  const data = {};
  m.roster.forEach(name => {
    data[name] = { sips: '', pen: {}, missed: false };
    const c = el('div', 'card');
    const top = el('div', 'row');
    const sips = el('input'); sips.type = 'number'; sips.inputMode = 'numeric'; sips.min = 1; sips.max = 50; sips.placeholder = 'Sips'; sips.style.width = '90px';
    sips.oninput = () => { data[name].sips = sips.value; };
    const miss = el('button', 'btn ghost', 'Missed');
    miss.onclick = () => { data[name].missed = !data[name].missed; miss.classList.toggle('on'); miss.textContent = data[name].missed ? 'Missed, tap to undo' : 'Missed'; sips.disabled = data[name].missed; };
    top.append(face(s, name, 40), el('strong', null, name), sips, miss);
    c.append(top);
    const pr = el('div', 'row');
    pens.forEach(([k, label]) => {
      const b = el('button', 'btn ghost', label);
      b.onclick = () => { data[name].pen[k] = (data[name].pen[k] || 0) + 1; b.textContent = label + ' x' + data[name].pen[k]; };
      b.oncontextmenu = e => { e.preventDefault(); data[name].pen[k] = 0; b.textContent = label; };
      pr.append(b);
    });
    c.append(pr);
    root.append(c);
  });
  root.append(el('p', 'sub', 'Tap a penalty once per time it happened. Long-press to clear it.'));

  let photo = null;
  const file = el('input'); file.type = 'file'; file.accept = 'image/*';
  file.onchange = async () => { try { photo = file.files[0] ? await fileToJpeg(file.files[0], 1024) : null; } catch (e) { toast(e.message); } };
  root.append(el('label', null, 'Photo, optional'), file);

  const send = el('button', 'btn', 'Send to be confirmed');
  send.onclick = async () => {
    send.disabled = true;
    const scores = {};
    m.roster.forEach(n => { scores[n] = data[n].missed ? { missed: true } : { sips: Number(data[n].sips), pen: data[n].pen }; });
    if (await ctx.act('submitCard', { hole: hole.hole, scores, photo })) { toast('Sent'); ctx.draw(); }
    send.disabled = false;
  };
  root.append(el('p'), send);
  challenges(root, s, ctx);
}

function challenges(root, s, ctx) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Challenge a score'));
  const team = el('select'); s.teams.filter(t => t.id !== s.who.team).forEach(t => { const o = el('option', null, t.name); o.value = t.id; team.append(o); });
  const hole = el('select'); s.holes.filter(h => h.kind === 'normal').forEach(h => { const o = el('option', null, 'Hole ' + h.hole); o.value = h.hole; hole.append(o); });
  const why = el('input'); why.placeholder = 'What looked wrong';
  const b = el('button', 'btn ghost', 'Send to Jack');
  b.onclick = async () => { if (await ctx.act('challenge', { team: Number(team.value), hole: Number(hole.value), reason: why.value })) toast('Sent to Jack'); };
  c.append(team, hole, why, el('p'), b);
  root.append(c);
}
