import { el, face, fileToJpeg, toast } from './ui.js';

const PENS = [['spill', 'Spill +1'], ['toilet', 'Toilet +2'], ['unfinished', 'Unfinished +3'], ['chuck', 'Chuck +5']];
const HAZ = { 'wrong-hand': ['slip', 'Slip +1'], silent: ['word', 'Word +1'] };

// True when the last render drew the entry form. The poll must not redraw it. Any other screen redraws on each poll.
let formShown = false;
export function liveWhen() { return !formShown; }

export function render(root, s, ctx) {
  formShown = false;
  const m = s.mine;
  if (m.nextHole == null) { root.append(el('h2', null, 'All done'), el('p', null, 'Your team has finished the course.')); return challenges(root, s, ctx); }
  const hole = s.holes.find(h => h.hole === m.nextHole);
  root.append(el('h2', null, 'Hole ' + hole.hole + ', ' + hole.name));
  root.append(el('p', 'sub', (hole.drink || 'Drink') + (hole.par ? ', par ' + hole.par : '')));
  if (hole.kind === 'race') { root.append(el('p', null, 'This is the boat race. A ref enters the times, nothing to do here.')); return challenges(root, s, ctx); }
  const waiting = m.cards.find(c => c.hole === hole.hole && c.status === 'pending');
  if (waiting) { root.append(el('p', 'card', 'Sent. Waiting for the other team or a ref to confirm.')); return challenges(root, s, ctx); }
  formShown = true;
  const back = m.cards.filter(c => c.hole === hole.hole && c.status === 'returned').pop();
  if (back && back.note) root.append(el('p', 'flag', 'Sent back. ' + back.note));

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
      const minus = el('button', 'btn ghost', '-');
      minus.setAttribute('aria-label', 'Take one off ' + label);
      minus.style.display = 'none';
      const show = () => {
        const n = data[name].pen[k] || 0;
        b.textContent = n ? label + ' x' + n : label;
        minus.style.display = n ? '' : 'none';
      };
      b.onclick = () => { data[name].pen[k] = (data[name].pen[k] || 0) + 1; show(); };
      minus.onclick = () => { data[name].pen[k] = Math.max(0, (data[name].pen[k] || 0) - 1); show(); };
      pr.append(b, minus);
    });
    c.append(pr);
    root.append(c);
  });
  root.append(el('p', 'sub', 'Tap a penalty once per time it happened. Tap the minus beside it to take one off.'));

  let photo = null;
  const send = el('button', 'btn', 'Send to be confirmed');
  const file = el('input'); file.type = 'file'; file.accept = 'image/*';
  let converting = false;
  file.onchange = async () => {
    photo = null; converting = true; send.disabled = true;
    try { photo = file.files[0] ? await fileToJpeg(file.files[0], 1024) : null; } catch (e) { toast(e.message); }
    converting = false; send.disabled = false;
  };
  root.append(el('label', null, 'Photo, optional'), file);

  send.onclick = async () => {
    if (converting) return;
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
