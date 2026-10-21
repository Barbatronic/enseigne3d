// Point d'entrée de l'interface : réglages, polices, calcul dans le worker, aperçu, tableau et téléchargements.
import { CDN, FONTS, fontUrl, defaultOptions } from './config.js';
import { createParamFields, setParamValues } from './ui/params.js';
import { loadState, saveState, clearState, saveFont, loadFont, forgetFont } from './ui/storage.js';
import { renderChips, everyLetter, remapColors } from './ui/chips.js';
import { createViewer } from './ui/viewer.js';
import { makeStl } from './export/stl.js';
import { make3mf } from './export/threemf.js';
import { slug, segName, partName } from './export/naming.js';
import { fixText, hardwareText, readme } from './export/report.js';

const $ = id => document.getElementById(id);
const fflate = import(CDN.fflate);

/* ---------- État ---------- */
const opts = defaultOptions();
const ui = { shownCuts: [], fontName: '', result: null };
// l'état du ruban de lettres est partagé avec opts (texte, couleurs, coupes manuelles)
const chipState = {
  get text() { return opts.text; }, get charColor() { return opts.charColor; },
  get manualCuts() { return opts.manualCuts; }, set manualCuts(v) { opts.manualCuts = v; },
  get shownCuts() { return ui.shownCuts; },
};
const colors = () => ['colBase', 'col0', 'col1', 'col2'].map(id => $(id).value);
const P = createParamFields(() => schedule());
const viewer = createViewer($('view'));
const setStatus = t => { $('status').textContent = t; };

/* ---------- Calcul dans le worker ---------- */
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let engineReady = false, fontReady = false, busy = false, pending = false, reqId = 0;

function readOptions() {
  Object.assign(opts, {
    arrow: $('arrow').value, arrowColor: +$('arrowColor').value,
    signType: $('signType').value, wallSide: $('wallSide').value,
    fixType: $('fixType').value, nutTrap: $('nutTrap').checked, chamferJoints: $('chamferJoints').checked,
  });
  return { ...opts, charColor: [...opts.charColor], manualCuts: opts.manualCuts && [...opts.manualCuts] };
}

function run() {
  if (!engineReady || !fontReady) return;
  if (busy) { pending = true; return; }
  busy = true; pending = false;
  setDirty(false);
  $('btnRun').disabled = true;
  setStatus('Calcul…');
  worker.postMessage({ type: 'build', id: ++reqId, P: { ...P }, opts: readOptions() });
}

worker.onmessage = ({ data }) => {
  if (data.type === 'ready') { engineReady = true; schedule(0); }
  else if (data.type === 'engine-error') setStatus('Moteur 3D indisponible : vérifie la connexion internet');
  else if (data.type === 'font') {
    if (data.ok) { fontReady = true; schedule(0); }
    else setStatus('Fichier de police illisible (le .woff2 n\'est pas pris en charge, utilise .ttf/.otf/.woff)');
  } else if (data.type === 'result' || data.type === 'error') {
    busy = false; $('btnRun').disabled = false;
    if (data.type === 'error') setStatus('Erreur de calcul : ' + data.message);
    else showResult(data.result);
    if (pending) run();
  }
};

function showResult(r) {
  ui.result = r; ui.shownCuts = r.shownCuts;
  refreshChips();
  viewer.show(r, colors(), Math.max(6, P.capH * 0.12));
  showTables(r);
  const tri = r.segments.reduce((a, s) => a + s.parts.reduce((b, p) => b + p.mesh.idx.length / 3, 0), 0);
  setStatus(r.empty ? 'Tape un texte' : `${r.segments.length} blocs · ${tri.toLocaleString('fr-FR')} triangles · ${r.ms} ms`);
}

/* ---------- Recalcul automatique ou à la demande ---------- */
let timer = null, dirty = false;
const autoBox = $('autoRun');
try { autoBox.checked = localStorage.getItem('enseigne-auto') === '1'; } catch (e) { /* stockage indisponible */ }
autoBox.addEventListener('change', () => {
  try { localStorage.setItem('enseigne-auto', autoBox.checked ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
  if (autoBox.checked && dirty) schedule(0);
});
function setDirty(v) {
  dirty = v;
  $('btnRun').classList.toggle('dirty', v);
  $('dirtyHint').hidden = !v;
}
// Chaque modification passe ici : calcul si recalcul auto (ou premier calcul), sinon « à recalculer »
function schedule(delay = 350) {
  clearTimeout(timer);
  persist();
  if (autoBox.checked || !ui.result) timer = setTimeout(run, delay);
  else setDirty(true);
}
$('btnRun').onclick = () => { clearTimeout(timer); run(); };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); clearTimeout(timer); run(); } });

/* ---------- Polices ---------- */
const fontSel = $('font'), weightSel = $('weight');
for (const [id, name] of FONTS) fontSel.add(new Option(name, id));
function fillWeights() {
  const f = FONTS.find(f => f[0] === fontSel.value);
  weightSel.innerHTML = '';
  for (const w of f[2]) weightSel.add(new Option(w, w, false, w === f[3]));
  weightSel.disabled = f[2].length < 2;
}
fontSel.value = 'nunito'; fillWeights();

async function useFontBuffer(buf, name) {
  ui.fontName = name; fontReady = false;
  worker.postMessage({ type: 'font', buffer: buf.slice(0) }, []);
  try {
    // la même police sert à afficher le ruban de lettres
    const ff = new FontFace('BannerFont', buf);
    await ff.load();
    for (const f of [...document.fonts]) if (f.family.replace(/"/g, '') === 'BannerFont') document.fonts.delete(f);
    document.fonts.add(ff);
  } catch (e) { /* le ruban garde la police de l'interface */ }
  refreshChips();
}
async function loadPreset() {
  const id = fontSel.value, w = weightSel.value;
  setStatus('Chargement de la police…');
  try {
    const r = await fetch(fontUrl(id, w));
    if (!r.ok) throw new Error(r.status);
    await useFontBuffer(await r.arrayBuffer(), `${fontSel.selectedOptions[0].text} ${w}`);
    $('fontFile').value = ''; forgetFont();
  } catch (e) {
    setStatus('Police introuvable en ligne : vérifie la connexion ou charge un fichier .ttf');
  }
}
fontSel.addEventListener('change', () => { fillWeights(); loadPreset(); });
weightSel.addEventListener('change', loadPreset);
$('fontFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer(), name = file.name.replace(/\.[^.]+$/, '');
  saveFont(buf, name);
  await useFontBuffer(buf, name);
});

/* ---------- Texte, lettres et options ---------- */
const refreshChips = () => renderChips($('chips'), $('cutMode'), chipState, colors, () => { refreshChips(); schedule(0); });
$('text').addEventListener('input', e => {
  opts.charColor = remapColors(opts.text, e.target.value, opts.charColor);
  opts.text = e.target.value; opts.manualCuts = null;
  refreshChips(); schedule();
});
$('autoCut').onclick = () => { opts.manualCuts = null; refreshChips(); schedule(0); };
$('cutAll').onclick = () => { opts.manualCuts = everyLetter(opts.text); refreshChips(); schedule(0); };
for (const id of ['colBase', 'col0', 'col1', 'col2']) $(id).addEventListener('input', () => { refreshChips(); viewer.recolor(colors()); persist(); });
for (const id of ['nutTrap', 'chamferJoints', 'fixType', 'arrow', 'arrowColor', 'wallSide']) $(id).addEventListener('change', () => schedule());
function applySignType() {
  $('wallSideRow').hidden = $('flagHint').hidden = $('signType').value !== 'flag';
}
$('signType').addEventListener('change', () => { applySignType(); viewer.reframeNext(); schedule(); });

/* ---------- Thème (appliqué dès le <head> pour éviter un flash) ---------- */
const themeSel = $('theme');
themeSel.value = document.documentElement.dataset.theme ?? '';
themeSel.addEventListener('change', () => {
  const t = themeSel.value;
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { t ? localStorage.setItem('enseigne-theme', t) : localStorage.removeItem('enseigne-theme'); } catch (e) { /* stockage indisponible */ }
});

/* ---------- Aperçu ---------- */
$('btnExplode').onclick = e => e.currentTarget.setAttribute('aria-pressed', viewer.toggleExplode());
$('btnFront').onclick = () => viewer.frame('front');
$('btnBack').onclick = () => viewer.frame('back');

/* ---------- Résultats et téléchargements ---------- */
const fmt = n => n.toFixed(0);
function showTables(r) {
  const s = r.segments;
  $('stats').innerHTML = s.length ? `
    <div class="stat"><b>${fmt(r.totalW)} × ${fmt(r.totalH)}</b><span>mm, enseigne assemblée</span></div>
    <div class="stat"><b>${s.length}</b><span>pièce${s.length > 1 ? 's' : ''} à imprimer</span></div>
    <div class="stat"><b>${hardwareText(r)}</b><span>${r.hardware ? 'tiges filetées + écrous' : 'vis + écrous'}</span></div>
    <div class="stat"><b></b><span>police</span></div>` : '';
  if (s.length) $('stats').lastElementChild.querySelector('b').textContent = ui.fontName;
  const warn = $('warnings'); warn.innerHTML = '';
  for (const w of r.warnings) { const d = document.createElement('div'); d.textContent = w; warn.append(d); }
  const fi = $('fixInfo'); fi.hidden = !r.fix;
  if (r.fix) fi.innerHTML = fixText(r.fix, true);
  const tb = $('segRows'); tb.innerHTML = '';
  for (const seg of s) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="num">${String(seg.n).padStart(2, '0')}</td><td class="letters"></td>
      <td class="num ${seg.fits ? '' : 'bad'}">${fmt(seg.w)} × ${fmt(seg.h)} × ${fmt(seg.D)}</td><td class="num">${seg.screws}</td><td><div class="row"></div></td>`;
    tr.querySelector('.letters').textContent = seg.label;
    const row = tr.querySelector('.row');
    const btn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = fn; row.append(b); };
    btn('3MF', async () => save(`${segName(seg)}.3mf`, make3mf([seg], exportOpts(), await fflate)));
    for (const p of seg.parts) btn(p.kind === 'base' ? 'STL fond' : `STL ${'ABC'[p.color]}`, () => save(`${partName(seg, p)}.stl`, makeStl(seg, p)));
    tb.append(tr);
  }
  $('dlAll').disabled = $('dlPlates').disabled = !s.length;
}
const exportOpts = () => ({ colors: colors(), bedX: P.bedX, bedY: P.bedY });
function save(name, data) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('dlPlates').onclick = async () => {
  if (ui.result) save(`enseigne-${slug(opts.text)}-plateaux.3mf`, make3mf(ui.result.segments, exportOpts(), await fflate));
};
$('dlAll').onclick = async () => {
  const r = ui.result; if (!r) return;
  const zip = await fflate, files = {};
  for (const seg of r.segments) {
    const dir = segName(seg) + '/';
    files[dir + segName(seg) + '.3mf'] = [make3mf([seg], exportOpts(), zip), { level: 0 }];
    for (const p of seg.parts) files[dir + partName(seg, p) + '.stl'] = makeStl(seg, p);
  }
  files[`enseigne-${slug(opts.text)}-plateaux.3mf`] = [make3mf(r.segments, exportOpts(), zip), { level: 0 }];
  files['LISEZMOI.txt'] = zip.strToU8(readme(r, { text: opts.text, fontName: ui.fontName, P }));
  save(`enseigne-${slug(opts.text)}.zip`, zip.zipSync(files, { level: 6 }));
};

/* ---------- Sauvegarde des réglages entre deux ouvertures ---------- */
const OPT_FIELDS = ['arrow', 'arrowColor', 'signType', 'wallSide', 'fixType', 'nutTrap', 'chamferJoints'];
const COLOR_FIELDS = ['colBase', 'col0', 'col1', 'col2'];
let saveTimer = null, resetting = false;
function flush() {
  clearTimeout(saveTimer);
  if (resetting) return;
  saveState({ P: { ...P }, opts: readOptions(), colors: colors(), font: fontSel.value, weight: weightSel.value });
}
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); }
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

// Remet un champ à une valeur enregistrée, seulement si elle est valide
function setField(el, v) {
  if (v === undefined) return;
  if (el.type === 'checkbox') el.checked = !!v;
  else if (el.type === 'color') { if (/^#[0-9a-f]{6}$/i.test(v)) el.value = v; }
  else if ([...el.options].some(o => o.value === String(v))) el.value = String(v);
}
function restore(s) {
  if (!s) return;
  setParamValues(P, s.P);
  const o = s.opts ?? {};
  if (typeof o.text === 'string') {
    opts.text = $('text').value = o.text;
    const cc = Array.isArray(o.charColor) ? o.charColor : [];
    opts.charColor = Array.from(o.text, (c, i) => [0, 1, 2].includes(cc[i]) ? cc[i] : 0);
    opts.manualCuts = Array.isArray(o.manualCuts) ? o.manualCuts.filter(Number.isInteger) : null;
  }
  for (const id of OPT_FIELDS) setField($(id), o[id]);
  COLOR_FIELDS.forEach((id, i) => setField($(id), s.colors?.[i]));
  if (FONTS.some(f => f[0] === s.font)) { fontSel.value = s.font; fillWeights(); setField(weightSel, s.weight); }
  applySignType();
}
$('btnReset').onclick = () => {
  if (!confirm('Revenir aux réglages par défaut ? Le travail en cours sera effacé.')) return;
  resetting = true; clearState(); location.reload();
};

/* ---------- Démarrage ---------- */
restore(loadState());
refreshChips();
setStatus('Chargement du moteur 3D…');
const savedFont = loadFont();
if (savedFont) useFontBuffer(savedFont.buffer, savedFont.name);
else loadPreset();
// accès pour le débogage et les tests de bout en bout
window.__enseigne = { P, opts, get result() { return ui.result; }, run, viewer };
