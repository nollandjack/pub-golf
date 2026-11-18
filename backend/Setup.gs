// Run setup() once from the Apps Script editor. It only adds what is missing.

var TABS = {
  Holes: ['hole', 'name', 'address', 'lat', 'lng', 'drink', 'par', 'hazard', 'kind'],
  Settings: ['key', 'value'],
  Teams: ['id', 'name', 'captain'],
  People: ['name', 'team', 'role', 'photoId'],
  Codes: ['code', 'role', 'team', 'person', 'active'],
  Constraints: ['kind', 'a', 'b'],
  Cards: ['id', 'team', 'hole', 'scores', 'photoId', 'status', 'submittedBy', 'confirmedBy', 'note', 'ts'],
  Race: ['team', 'ms'],
  Pokies: ['team', 'cents'],
  Tab: ['id', 'team', 'payer', 'venue', 'item', 'cents', 'forWho', 'ts', 'deleted'],
  Challenges: ['id', 'byTeam', 'team', 'hole', 'reason', 'status', 'ts'],
  Log: ['ts', 'who', 'action', 'detail']
};

var COURSE = [
  [1, "Jack's place", 'Sent in the group chat', '', '', 'Premix', '', '', 'normal'],
  [2, 'Royal Hotel', 'Randwick', '', '', 'Espresso martini', '', '', 'normal'],
  [3, 'Coach and Horses', '147 Avoca St, Randwick', '', '', 'Guinness boat race and pokies', '', '', 'race'],
  [4, 'Shakespeare Hotel', '200 Devonshire St, Surry Hills', '', '', '', '', '', 'normal'],
  [5, 'The Clock', '470 Crown St, Surry Hills', '', '', '', '', '', 'normal'],
  [6, 'Cricketers Arms', 'Fitzroy St, Surry Hills', '', '', '', '', '', 'normal'],
  [7, 'The Beresford', '354 Bourke St, Surry Hills', '', '', '', '', '', 'normal']
];

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
      // Text columns stay text so ids and JSON are never turned into numbers.
      sh.getRange(2, 1, sh.getMaxRows() - 1, TABS[name].length).setNumberFormat('@');
    }
  });
  const holes = ss.getSheetByName('Holes');
  if (holes.getLastRow() === 1) {
    holes.getRange(2, 1, COURSE.length, COURSE[0].length).setValues(COURSE);
    holes.getRange(2, 1, COURSE.length, 1).setNumberFormat('0');
    holes.getRange(2, 4, COURSE.length, 2).setNumberFormat('0.000000');
    holes.getRange(2, 7, COURSE.length, 1).setNumberFormat('0');
  }
  const settings = ss.getSheetByName('Settings');
  if (settings.getLastRow() === 1) settings.getRange(2, 1, 3, 2).setValues([['missedPenalty', '3'], ['pokiesBonus', '3'], ['tiebreakOrder', '[]']]);
  const codes = ss.getSheetByName('Codes');
  if (codes.getLastRow() === 1) {
    const code = 'k' + Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    codes.appendRow([code, 'admin', '', 'Jack', true]);
  }
  photoFolder_();
  Logger.log('Admin link: add ?k=' + codes.getRange(2, 1).getValue() + ' to the site address');
}
