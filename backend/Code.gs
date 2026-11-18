// Pub golf API. Bound to the Google Sheet and deployed as a web app (execute as Jack, anyone can access).

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_(handle({ method: 'GET', k: (e && e.parameter && e.parameter.k) || '' }, sheetStore_(), Date.now()));
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }
  req.method = 'POST';
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return json_(handle(req, sheetStore_(), Date.now())); } finally { lock.releaseLock(); }
}
