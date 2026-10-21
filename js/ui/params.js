// Champs numériques générés depuis PARAMS ; renvoie l'objet des valeurs, tenu à jour.
import { PARAMS } from '../config.js';

export function createParamFields(onChange) {
  const P = {};
  for (const [sec, id, label, unit, v, min, max, step] of PARAMS) {
    P[id] = v;
    const l = document.createElement('label');
    l.className = 'field';
    l.innerHTML = `<span>${label}${unit ? ` <small>${unit}</small>` : ''}</span><input type="number" id="p_${id}" value="${v}" min="${min}" max="${max}" step="${step}">`;
    document.getElementById('fields-' + sec).append(l);
    l.querySelector('input').addEventListener('input', e => {
      const n = parseFloat(e.target.value);
      if (Number.isFinite(n)) { P[id] = Math.min(max, Math.max(min, n)); onChange(id); }
    });
  }
  return P;
}

// Applique des valeurs enregistrées (bornées comme une saisie) aux champs et à P
export function setParamValues(P, values) {
  for (const [, id, , , , min, max] of PARAMS) {
    const n = values?.[id];
    if (!Number.isFinite(n)) continue;
    P[id] = Math.min(max, Math.max(min, n));
    document.getElementById('p_' + id).value = P[id];
  }
}
