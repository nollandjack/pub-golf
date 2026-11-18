import { el } from './ui.js';

const HAZARD = { 'wrong-hand': 'Wrong hand only, +1 each slip', silent: 'Silent hole, +1 a word', hidden: 'Hazard hole, revealed when you get there' };

export function render(root, s) {
  root.append(el('h2', null, 'Course'));
  const mapEl = el('div'); mapEl.id = 'map'; root.append(mapEl);
  const pinned = s.holes.filter(h => h.lat != null && h.lng != null);
  if (window.L && pinned.length) {
    const map = L.map(mapEl, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const pts = pinned.map(h => [h.lat, h.lng]);
    pinned.forEach(h => L.marker([h.lat, h.lng], { title: h.name }).addTo(map).bindPopup(h.hole + '. ' + h.name));
    L.polyline(pts, { weight: 3, dashArray: '6 6' }).addTo(map);
    map.fitBounds(pts, { padding: [24, 24] });
  } else {
    mapEl.textContent = 'Map loads once the pubs have their locations.';
  }
  s.holes.forEach(h => {
    const c = el('div', 'card');
    c.append(el('h3', null, h.hole + '. ' + h.name));
    c.append(el('p', 'sub', h.address));
    c.append(el('p', null, (h.drink || 'Drink to be announced')));
    if (h.kind === 'race') c.append(el('p', 'pill', 'Boat race and pokies'));
    if (h.hazard) c.append(el('p', 'flag', HAZARD[h.hazard] || h.hazard));
    if (h.hole === 3) c.append(el('p', 'sub', 'Then the L2 light rail from Randwick to the Surry Hills stop, about 15 minutes.'));
    root.append(c);
  });
}
