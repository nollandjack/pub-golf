// Store backed by the bound Google Sheet, with photos in a Drive folder.

function sheetStore_() {
  const ss = SpreadsheetApp.getActive();
  const sh = n => ss.getSheetByName(n);
  const headOf = n => sh(n).getRange(1, 1, 1, sh(n).getLastColumn()).getValues()[0];
  const toObj = (head, row) => { const o = {}; head.forEach((h, i) => { o[h] = row[i]; }); return o; };
  const toRow = (head, o) => head.map(h => (o[h] == null ? '' : o[h]));
  return {
    all: n => {
      const v = sh(n).getDataRange().getValues();
      return v.slice(1).filter(r => r.some(c => c !== '')).map(r => toObj(v[0], r));
    },
    append: (n, o) => { sh(n).appendRow(toRow(headOf(n), o)); },
    update: (n, match, patch) => {
      const s = sh(n), v = s.getDataRange().getValues(), head = v[0];
      let c = 0;
      for (let i = 1; i < v.length; i++) {
        const o = toObj(head, v[i]);
        if (v[i].some(x => x !== '') && match(o)) {
          s.getRange(i + 1, 1, 1, head.length).setValues([toRow(head, Object.assign(o, patch))]);
          c++;
        }
      }
      return c;
    },
    replace: (n, rows) => {
      const s = sh(n), head = headOf(n);
      if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, head.length).clearContent();
      if (rows.length) s.getRange(2, 1, rows.length, head.length).setValues(rows.map(o => toRow(head, o)));
    },
    newId: () => Utilities.getUuid().replace(/-/g, '').slice(0, 24),
    savePhoto: (b64, name) => {
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', name + '.jpg');
      const f = photoFolder_().createFile(blob);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return f.getId();
    },
    photoUrl: id => (id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800' : '')
  };
}

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder('Pub golf photos');
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}
