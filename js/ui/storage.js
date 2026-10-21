// Sauvegarde locale (navigateur) des réglages : on retrouve son travail à la prochaine ouverture.
const KEY = 'enseigne-state-v1', FONT_KEY = 'enseigne-font-v1';

export function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
}
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible ou plein */ }
}
export function clearState() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(FONT_KEY); } catch (e) { /* stockage indisponible */ }
}

// Police chargée depuis un fichier : gardée en base64 (ignorée si trop lourde pour le stockage)
export function saveFont(buf, name) {
  try {
    const bytes = new Uint8Array(buf); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    localStorage.setItem(FONT_KEY, JSON.stringify({ name, data: btoa(bin) }));
  } catch (e) { forgetFont(); }
}
export function loadFont() {
  try {
    const f = JSON.parse(localStorage.getItem(FONT_KEY));
    if (!f) return null;
    const bin = atob(f.data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { name: f.name, buffer: bytes.buffer };
  } catch (e) { return null; }
}
export function forgetFont() {
  try { localStorage.removeItem(FONT_KEY); } catch (e) { /* stockage indisponible */ }
}
