import { el } from './ui.js';

const signed = n => (n > 0 ? '+' : '') + n;

export function render(root, s) {
  const { missedExtra, raceFirst, raceStep, raceDnf, pokiesBonus } = s.settings;
  const ladder = [0, 1, 2, 3].map(i => signed(raceFirst + i * raceStep));
  const items = [
    'There is no par. Your score on a hole is how many sips it takes to finish the drink, plus penalties.',
    'Penalties. Spill +1. Toilet before you finish +2. Unfinished drink +3. Chucking +5. Nothing is capped.',
    'Your team score on a hole is everyone\'s scores added up and divided by the number of players, so team size does not matter. Lowest total wins.',
    'The board ranks teams by their total so far, and shows how many holes each team has played.',
    'Missing a hole, whether you left early or turned up late, scores the worst score anyone got on that hole plus ' + missedExtra + '. It settles once every team has played that hole.',
    'Captains enter the scores. The team you are paired with confirms them. Roaming refs back this up and settle arguments.',
    'Hazard holes. Wrong hand means your non-dominant hand only, +1 each slip. Silent hole means no talking from order to empty glass, +1 for every word.',
    'Hole 3 is a Guinness boat race. Every team drinks the same number of Guinnesses, smaller teams send someone twice. Fastest team scores ' + ladder[0] + ', then ' + ladder.slice(1).join(', ') + ' and so on. A team that doesn\'t finish scores ' + signed(raceDnf) + '.',
    'Pokies at hole 3. Everyone puts $10 into one machine per team and takes turns for 10 minutes. The team with the most money above $0 takes ' + pokiesBonus + ' strokes off its boat race score. If everyone busts, nobody gets the bonus.',
    'Any captain can challenge another team\'s confirmed score once a hole. Jack rules.',
    'Teams level at the end go to a sudden death shot, timed by a ref.'
  ];
  root.append(el('h2', null, 'Rules'));
  const ol = el('ol', 'card');
  items.forEach(t => ol.append(el('li', null, t)));
  root.append(ol);
}
