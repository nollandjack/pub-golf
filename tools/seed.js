// Test data only. Real names, photos and codes live in the Google Sheet.
function seed() {
  const players = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou'];
  const People = players.map((name, i) => ({ name, team: 1 + Math.floor(i / 3), role: 'player', photoId: '' }));
  People.push({ name: 'Rex', team: '', role: 'ref', photoId: '' });
  const Teams = [1, 2, 3, 4].map(id => ({ id, name: 'Team ' + id, captain: players[(id - 1) * 3] }));
  const Codes = [{ code: 'kadmin', role: 'admin', team: '', person: 'Jack', active: true }, { code: 'kref', role: 'ref', team: '', person: 'Rex', active: true }];
  Teams.forEach(t => {
    Codes.push({ code: 'kcap' + t.id, role: 'captain', team: t.id, person: t.captain, active: true });
    Codes.push({ code: 'kteam' + t.id, role: 'team', team: t.id, person: t.name, active: true });
  });
  return {
    Holes: [
      { hole: 1, name: 'The house', address: 'Sent in the group chat', lat: '', lng: '', drink: 'Premix', par: '', hazard: 'silent', kind: 'normal' },
      { hole: 2, name: 'Royal Hotel', address: 'Randwick', lat: -33.9146, lng: 151.2412, drink: 'Espresso martini', par: '', hazard: 'wrong-hand', kind: 'normal' },
      { hole: 3, name: 'Coach and Horses', address: '147 Avoca St, Randwick', lat: -33.9128, lng: 151.2416, drink: 'Guinness boat race and pokies', par: '', hazard: '', kind: 'race' },
      { hole: 4, name: 'Shakespeare Hotel', address: '200 Devonshire St, Surry Hills', lat: -33.8885, lng: 151.2125, drink: 'Fireball shot', par: '', hazard: '', kind: 'normal' },
      { hole: 5, name: 'The Clock', address: '470 Crown St, Surry Hills', lat: -33.8862, lng: 151.2143, drink: 'Large red wine', par: '', hazard: '', kind: 'normal' },
      { hole: 6, name: 'Cricketers Arms', address: 'Fitzroy St, Surry Hills', lat: -33.8865, lng: 151.2166, drink: 'Schooner of cider', par: '', hazard: '', kind: 'normal' },
      { hole: 7, name: 'The Beresford', address: '354 Bourke St, Surry Hills', lat: -33.8843, lng: 151.2158, drink: 'Vodka raspberry, tall glass', par: '', hazard: '', kind: 'normal' }
    ],
    Settings: [{ key: 'missedExtra', value: '5' }, { key: 'raceFirst', value: '-2' }, { key: 'raceStep', value: '2' }, { key: 'raceDnf', value: '15' }, { key: 'pokiesBonus', value: '3' }, { key: 'tiebreakOrder', value: '[]' }],
    Teams, People, Codes,
    Constraints: [{ kind: 'together', a: 'Ava', b: 'Ben' }, { kind: 'apart', a: 'Cal', b: 'Dee' }]
  };
}

module.exports = { seed };
