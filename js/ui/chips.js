// Ruban des lettres : clic sur une lettre = couleur suivante, clic entre deux lettres = couper / joindre.
const isInk = c => !/\s/.test(c);

// state : { text, charColor, manualCuts, shownCuts } ; colors() : [fond, A, B, C]
export function renderChips(box, modeLabel, state, colors, onChange) {
  box.innerHTML = '';
  const cs = Array.from(state.text), cols = colors();
  const shown = new Set(state.manualCuts ?? state.shownCuts);
  cs.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (!isInk(c)) { b.className = 'chip space'; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); box.append(b); return; }
    b.className = 'chip'; b.textContent = c; b.style.color = cols[1 + (state.charColor[i] ?? 0)];
    b.title = 'Changer la couleur';
    b.onclick = () => { state.charColor[i] = ((state.charColor[i] ?? 0) + 1) % 3; onChange('color'); };
    box.append(b);
    if (cs.findIndex((d, j) => j > i && isInk(d)) > 0) {
      const g = document.createElement('button');
      g.type = 'button'; g.className = 'gap' + (shown.has(i) ? ' on' : '');
      g.title = shown.has(i) ? 'Joindre ces lettres' : 'Couper ici';
      g.setAttribute('aria-label', g.title);
      g.onclick = () => {
        shown.has(i) ? shown.delete(i) : shown.add(i);
        state.manualCuts = [...shown]; onChange('cut');
      };
      box.append(g);
    }
  });
  modeLabel.textContent = state.manualCuts ? 'Découpe manuelle' : 'Découpe auto selon le plateau';
}

// Coupe après chaque lettre (« Une lettre par bloc »)
export const everyLetter = text => {
  const cs = Array.from(text);
  return cs.map((c, i) => i).filter(i => isInk(cs[i]) && cs.some((d, j) => j > i && isInk(d)));
};

// Garde les couleurs des lettres inchangées quand le texte est modifié (préfixe et suffixe communs)
export function remapColors(oldText, newText, colors) {
  const old = Array.from(oldText), nw = Array.from(newText);
  let p = 0; while (p < old.length && p < nw.length && old[p] === nw[p]) p++;
  let s = 0; while (s < old.length - p && s < nw.length - p && old[old.length-1-s] === nw[nw.length-1-s]) s++;
  const cc = [];
  for (let i = 0; i < nw.length; i++) {
    if (i < p) cc[i] = colors[i] ?? 0;
    else if (i >= nw.length - s) cc[i] = colors[old.length - (nw.length - i)] ?? 0;
    else cc[i] = cc[i-1] ?? 0;
  }
  return cc;
}
