const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
// Apps Script web app. Update the code with: clasp push, then clasp update-deployment AKfycbxaCR9rW8z-ZJMC02mugdaMAF5UFjZfjuNq5f7gmiI40dFeBGQGouB7TdGAZx75SFFYmA
const REMOTE = 'https://script.google.com/macros/s/AKfycbxaCR9rW8z-ZJMC02mugdaMAF5UFjZfjuNq5f7gmiI40dFeBGQGouB7TdGAZx75SFFYmA/exec';
export const API = LOCAL ? '/api' : REMOTE;

function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch (_) { return false; } }

const fromUrl = new URLSearchParams(location.search).get('k');
if (fromUrl && lsSet('pg-k', fromUrl)) {
  // Keep the code out of the address bar once it is saved. If saving failed, leave it so a reload still works.
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (_) {}
}
export const KEY = fromUrl || lsGet('pg-k') || '';
export function forget() { lsSet('pg-k', null); location.href = location.pathname; }

export async function getState() {
  const r = await fetch(API + '?k=' + encodeURIComponent(KEY));
  if (!r.ok) throw new Error('Could not reach the scoreboard');
  return r.json();
}

export async function post(type, body) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({ type, k: KEY }, body)) });
  if (!r.ok) throw new Error('Could not reach the scoreboard');
  return r.json();
}
