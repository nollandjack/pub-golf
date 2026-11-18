import { el } from './ui.js';

export function render(root, s) {
  const bonus = s.settings.pokiesBonus, missed = s.settings.missedPenalty;
  const items = [
    'Each hole has a drink and a par. Your score is how many sips it takes to finish, plus penalties.',
    'Penalties. Spill +1. Toilet before you finish +2. Unfinished drink +3. Chucking +5.',
    'Your team score on a hole is everyone\'s scores added up and divided by the number of players. Lowest total wins.',
    'Missing a hole, whether you left early or turned up late, scores par plus ' + missed + '.',
    'Captains enter the scores. The team you are paired with confirms them. Roaming refs back this up and settle arguments.',
    'Hazard holes. Wrong hand only, +1 each slip. Silent hole, +1 for every word.',
    'Hole 3 is a Guinness boat race. Every team drinks the same number of Guinnesses, smaller teams send someone twice. Fastest team scores 1, second scores 2 and so on.',
    'Pokies at hole 3. Everyone puts $10 into one machine per team and takes turns for 10 minutes. The team with the most money at the end takes ' + bonus + ' strokes off the hole.',
    'Any captain can challenge another team\'s confirmed score once a hole. Jack rules.',
    'Teams level at the end go to a sudden death shot.'
  ];
  root.append(el('h2', null, 'Rules'));
  const ol = el('ol', 'card');
  items.forEach(t => ol.append(el('li', null, t)));
  root.append(ol);
}
