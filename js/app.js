import { getState, post, forget, KEY } from './api.js';
import { $, el, toast } from './ui.js';
import * as board from './board.js';
import * as course from './course.js';
import * as rules from './rules.js';
import * as teams from './teams.js';
import * as scorecard from './scorecard.js';
import * as confirm from './confirm.js';
import * as race from './race.js';
import * as tab from './tab.js';
import * as admin from './admin.js';

const any = () => true;
const is = (...roles) => s => roles.includes(s.who.role);
// live views re-render on every poll. Views with forms only render when opened.
const VIEWS = [
  { id: 'board', label: 'Board', show: any, mod: board, live: true },
  { id: 'card', label: 'Scorecard', show: is('captain'), mod: scorecard },
  { id: 'confirm', label: 'Confirm', show: is('captain', 'ref', 'admin'), mod: confirm, live: true },
  { id: 'race', label: 'Race and pokies', show: is('ref', 'admin'), mod: race },
  { id: 'tab', label: 'Tab', show: is('team', 'captain'), mod: tab },
  { id: 'course', label: 'Course', show: any, mod: course },
  { id: 'teams', label: 'Teams', show: any, mod: teams, live: true },
  { id: 'rules', label: 'Rules', show: any, mod: rules },
  { id: 'admin', label: 'Admin', show: is('admin'), mod: admin }
];

let state = null;
let current = location.hash.slice(1) || 'board';
const ROLE_NAMES = { public: 'Viewing the board', team: 'Team link', captain: 'Captain', ref: 'Referee', admin: 'Admin' };

const ctx = {
  async act(type, body) {
    try {
      const r = await post(type, body);
      if (r.state) state = r.state;
      if (!r.ok) { toast(r.error || 'Something went wrong'); return null; }
      return r.result !== undefined ? r.result : true;
    } catch (e) { toast(e.message); return null; }
  },
  async refresh() { await load(); draw(true); },
  draw: () => draw(true)
};

function nav() {
  const n = $('nav'); n.innerHTML = '';
  VIEWS.filter(v => v.show(state)).forEach(v => {
    const b = el('button', v.id === current ? 'on' : null, v.label);
    b.onclick = () => { current = v.id; location.hash = v.id; draw(true); };
    n.append(b);
  });
}

function draw(force) {
  if (!state) return;
  let v = VIEWS.find(x => x.id === current && x.show(state));
  if (!v) { current = 'board'; v = VIEWS[0]; }
  nav();
  const w = state.who;
  $('who').textContent = ROLE_NAMES[w.role] + (w.person ? ', ' + w.person : '');
  if (KEY && w.role === 'public') { $('who').textContent = 'That link has been switched off. Ask Jack for a new one.'; }
  const live = v.live || (v.mod.liveWhen && v.mod.liveWhen(state));
  if (!force && !live) return;
  const root = $('view');
  // Do not wipe a note or name box while someone is typing in it.
  const a = document.activeElement;
  if (!force && a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  const scrolls = Array.from(root.querySelectorAll('.scroll'), n => n.scrollLeft);
  root.innerHTML = '';
  v.mod.render(root, state, ctx);
  root.querySelectorAll('.scroll').forEach((n, i) => { if (scrolls[i]) n.scrollLeft = scrolls[i]; });
}

async function load() {
  const r = await getState();
  if (!r.ok) throw new Error(r.error || 'Something went wrong');
  state = r.state;
}

async function tick(first) {
  try {
    await load();
    $('status').textContent = 'Live. Updates every 30 seconds.';
    draw(first);
  } catch (e) {
    $('status').textContent = e.message + '. Trying again shortly.';
  }
}

window.addEventListener('hashchange', () => { current = location.hash.slice(1) || 'board'; draw(true); });
window.pubGolfForget = forget;
tick(true);
setInterval(() => { if (!document.hidden) tick(false); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(false); });
