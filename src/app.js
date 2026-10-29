/* =====================================================================
   PADDOCK 26 — rendu 3D (three.js) + interface mobile
   ===================================================================== */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const NIGHT = new Set(['bh-2002', 'sa-2021', 'sg-2008', 'us-2023', 'qa-2004', 'ae-2009']);
const DESERT = new Set(['bh-2002', 'sa-2021', 'qa-2004', 'ae-2009']);

/* ---------------- migration : noms réels des anciennes versions → noms fictifs ---------------- */
(function migrateNames() {
  try {
    if (localStorage.getItem('paddock26-names') === '3') return;
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('paddock26')) keys.push(k); }
    const pairs = Object.entries(NAME_MIGRATION).sort((a, b) => b[0].length - a[0].length);   // « Racing Bulls » avant « Red Bull »…
    for (const k of keys) {
      let v = localStorage.getItem(k), w = v;
      for (const [o, n] of pairs) w = w.split('"' + o + '"').join('"' + n + '"');
      if (w !== v) localStorage.setItem(k, w);
    }
    localStorage.setItem('paddock26-names', '3');
  } catch (e) { /* stockage indisponible */ }
})();

/* ---------------- état & préférences ---------------- */
/* noms personnalisés : le jeu ne contient que des noms fictifs, mais chaque joueur peut renommer
   écuries et pilotes à sa guise (ou importer un « pack de noms ») ; pack = { nom du jeu: nom choisi } */
function loadPack() { try { return JSON.parse(localStorage.getItem('paddock26-namepack') || '{}') || {}; } catch (e) { return {}; } }
/* couleurs des écuries, numéros et drapeaux des pilotes choisis par le joueur : livery = { nom du jeu: { color, color2, tv } ou { num, nat } } */
function loadLivery() { try { return JSON.parse(localStorage.getItem('paddock26-livery') || '{}') || {}; } catch (e) { return {}; } }
const lum = h => { const n = parseInt(String(h).slice(1), 16); return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255; };
const tvOf = (c1, c2) => lum(c1) < 0.16 ? c2 : c1;   // couleur d'affichage (classements) : la secondaire si la principale est trop sombre
function packedTeams() {
  const pack = loadPack(), lv = loadLivery(), teams = JSON.parse(JSON.stringify(TEAMS_BASE));
  for (const t of teams) {
    t.base = t.name; t.name = pack[t.name] || t.name; Object.assign(t, lv[t.base] || {});
    for (const d of t.drivers) { d.base = d.name; d.name = pack[d.name] || d.name; Object.assign(d, lv[d.base] || {}); }
  }
  return teams;
}
const ST = { circuit: 0, lapsKey: '10', wear: 'prop', chaos: 1, speed: 1, human: '', assist: 'on', noDnf: false, dmgLite: false, ctrl: 'touch', weather: 'dry', sound: true, aiPace: 98, brakeAid: 'aide', cues: true, stab: true, tlRule: 'indulgent', colRule: 'indulgent', ghost: true, engine: 'hybrid', lang: 'fr', tiktok: true, teams: packedTeams(), quali: null };
/* moteur (hybride 2026 / 100 % thermique) : appliqué au simulateur avant chaque qualif, course ou tour chrono */
for (const f of ['qualifying', 'createRace', 'createQualiRun', 'createTimeTrial', 'hotLap', 'ghostLap']) {
  const o = SIM[f]; SIM[f] = function (...a) { SIM.setEngine(f === 'createRace' && a[2] && a[2].engine || ST.engine); return o.apply(this, a); };
}
/* difficulté à la carte : rythme des IA (en % de la limite physique) + aides au pilotage */
const DIFF_KEYS = ['aiPace', 'brakeAid', 'cues', 'stab', 'tlRule', 'colRule'];
const OLD_LEVELS = {   // anciens niveaux → réglages équivalents
  debutant: { aiPace: 95.5, brakeAid: 'auto', cues: true, stab: true, tlRule: 'off', colRule: 'off' },
  amateur: { aiPace: 98, brakeAid: 'aide', cues: true, stab: true, tlRule: 'indulgent', colRule: 'indulgent' },
  pro: { aiPace: 100, brakeAid: 'aide', cues: true, stab: true, tlRule: 'indulgent', colRule: 'indulgent' },
  expert: { aiPace: 100, brakeAid: 'off', cues: true, stab: true, tlRule: 'indulgent', colRule: 'indulgent' },
  legende: { aiPace: 100, brakeAid: 'off', cues: false, stab: false, tlRule: 'strict', colRule: 'strict' },
};
const BRAKE_L = { auto: 'automatique', aide: 'aidé', off: 'sans aide' };
/* pénalités : nombre d'infractions par pénalité de 5 s */
const RULE_N = { tl: { strict: 3, indulgent: 6, off: 0 }, col: { strict: 2, indulgent: 4, off: 0 } };
const RULE_L = { strict: 'strictes', indulgent: 'indulgentes', off: 'aucune' };
const pctTxt = p => (+p).toFixed(1).replace('.', ',').replace(',0', '') + ' %';
function levelOf(o) {
  return { name: `IA ${pctTxt(o.aiPace)} · freinage ${BRAKE_L[o.brakeAid]}`, pace: SIM.paceFromLimit(o.aiPace / 100), brake: o.brakeAid, cues: !!o.cues, stab: !!o.stab, limits: o.tlRule !== 'off', tlEvery: RULE_N.tl[o.tlRule] || 0, colEvery: RULE_N.col[o.colRule] || 0, invincible: false, err: 0.8 };
}
try {
  const sv = JSON.parse(localStorage.getItem('paddock26') || 'null');
  if (sv) { ST.circuit = sv.circuit ?? 0; ST.lapsKey = sv.lapsKey ?? '10'; ST.wear = sv.wear ?? 'prop'; ST.chaos = sv.chaos ?? 1; ST.human = sv.human ?? ''; ST.assist = sv.assist === false ? 'off' : sv.assist === true || sv.assist == null ? 'on' : sv.assist; ST.ctrl = sv.ctrl ?? 'touch'; ST.noDnf = !!sv.noDnf; ST.dmgLite = !!sv.dmgLite; ST.weather = sv.weather ?? 'dry'; ST.sound = sv.sound ?? true; ST.engine = sv.engine === 'ice' ? 'ice' : 'hybrid'; ST.lang = sv.lang === 'en' ? 'en' : 'fr'; ST.tiktok = sv.tiktok ?? true; Object.assign(ST, sv.aiPace != null ? Object.fromEntries(DIFF_KEYS.map(k => [k, sv[k] ?? ST[k]])) : OLD_LEVELS[sv.level] || {});
    if (sv.tlRule == null && sv.limits === false) ST.tlRule = 'off'; ST.ghost = sv.ghost ?? true; }
} catch (e) { /* stockage indisponible */ }
function savePrefs() {   // pendant une carrière, ce sont les réglages du menu (mis de côté) qui sont mémorisés
  const P = ST._menu ? Object.assign({}, ST, ST._menu) : ST;
  try { localStorage.setItem('paddock26', JSON.stringify({ circuit: P.circuit, lapsKey: P.lapsKey, wear: P.wear, chaos: P.chaos, human: P.human, assist: P.assist, noDnf: P.noDnf, dmgLite: P.dmgLite, ctrl: P.ctrl, weather: P.weather, sound: P.sound, aiPace: P.aiPace, brakeAid: P.brakeAid, cues: P.cues, stab: P.stab, tlRule: P.tlRule, colRule: P.colRule, ghost: P.ghost, engine: P.engine, lang: P.lang, tiktok: P.tiktok })); } catch (e) { /* ignoré */ }
}
/* ---------------- version d'essai / version complète ----------------
   Essai : Grand Prix et contre-la-montre sur 3 circuits mythiques, réglages limités.
   Version complète : débloquée par un code lié à l'appareil (voir tools/gen_code.js). */
/* LITE : appli « Paddock 26 Essai » du Play Store (python3 build.py essai) : reste en version d'essai, sans code de déblocage */
const LITE = false;
const PRO_SALT = 'pdk26-7Hq2xV-monza-eau-rouge';
const FREE_IDS = ['mc-1929', 'gb-1948', 'it-1922'];
const FREE_SET = { lapsKey: ['3', '5'], wear: ['prop'], chaos: ['1'], weather: ['dry'], noDnf: ['false'], dmgLite: ['false'] };
const FREE_FIX = { lapsKey: '5', wear: 'prop', chaos: 1, weather: 'dry', noDnf: false, dmgLite: false, aiPace: 98, tlRule: 'indulgent', colRule: 'indulgent', cues: true, stab: true };
/* dégâts : réalistes (0) · abandons seuls (2 : accidents et Safety Car, mais aucun dégât intermédiaire) · sans abandon (1) */
const DMG_CHIPS = [{ v: 0, l: 'Réalistes' }, { v: 2, l: 'Abandons seuls' }, { v: 1, l: 'Sans abandon' }];
const dmgOf = o => o.noDnf ? 1 : o.dmgLite ? 2 : 0;
function setDmg(o, v) { o.noDnf = v === '1'; o.dmgLite = v === '2'; }
function proHash(str) {   // empreinte 2×32 bits (cyrb53) → 10 caractères lisibles
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let n = (h2 >>> 0) * 4294967296 + (h1 >>> 0), out = '';
  for (let i = 0; i < 10; i++) { out += A[n % 32]; n = Math.floor(n / 32); }
  return out;
}
function deviceId() {
  let id = '';
  try { id = window.PaddockNative && window.PaddockNative.deviceId ? String(window.PaddockNative.deviceId()) : ''; } catch (e) { /* navigateur */ }
  if (!id) try { id = localStorage.getItem('paddock26-dev') || ''; if (!id) { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('paddock26-dev', id); } } catch (e) { id = 'web'; }
  return proHash('id:' + id).slice(0, 8);
}
const DEV_ID = deviceId();
const proCode = id => { const h = proHash(PRO_SALT + ':' + id); return h.slice(0, 5) + '-' + h.slice(5); };
let PRO = false;
if (!LITE) try { PRO = localStorage.getItem('paddock26-pro') === proCode(DEV_ID); } catch (e) { /* ignoré */ }
const isFreeCirc = c => PRO || FREE_IDS.includes(c.id);
/* en version d'essai, les réglages verrouillés reprennent leur valeur par défaut */
function freeClamp(o) {
  if (PRO) return;
  for (const k in FREE_FIX) if (!FREE_SET[k] || !FREE_SET[k].includes(String(o[k]))) o[k] = FREE_FIX[k];
  if (!isFreeCirc(CIRCUITS[ST.circuit] || {})) ST.circuit = CIRCUITS.findIndex(c => c.id === FREE_IDS[0]);
}
function tryUnlock(code) {
  if (LITE) return false;
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 10 || c !== proCode(DEV_ID).replace('-', '')) return false;
  PRO = true; try { localStorage.setItem('paddock26-pro', proCode(DEV_ID)); } catch (e) { /* ignoré */ }
  return true;
}
const trackCache = new Map();
// q = version « tour seul en piste » (qualif, contre-la-montre) avec la trajectoire temps minimal
// calendrier 2026 (24 manches) ; les circuits bonus (anciens Grands Prix) suivent dans CIRCUITS
const CAL = CIRCUITS.filter(c => !c.bonus);
function getTrack(i, q) { const key = i + (q ? 'q' : ''); if (!trackCache.has(key)) trackCache.set(key, SIM.buildTrack(q ? Object.assign({}, CIRCUITS[i], { useLine: true }) : CIRCUITS[i])); return trackCache.get(key); }
function lapsFor(circ) {
  const k = ST.lapsKey;
  if (k === '50') return Math.round(circ.laps / 2);
  if (k === '100') return circ.laps;
  return +k;
}
const fmt = SIM.fmtLap;
const lastName = n => n.split(' ').slice(-1)[0];

/* =====================================================================
   MENU
   ===================================================================== */
function drawThumb(cv, circ, active) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 140, H = cv.clientHeight || 90;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const p = circ.pts; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  const sc = Math.min((W - 16) / (x1 - x0), (H - 16) / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const X = i => ox + (p[i] - x0) * sc, Y = i => H - (oy + (p[i + 1] - y0) * sc);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = active ? '#ff2d2d' : 'rgba(236,239,244,.85)'; g.lineWidth = active ? 3 : 2.2;
  g.beginPath(); g.moveTo(X(0), Y(0)); for (let i = 2; i < p.length; i += 2) g.lineTo(X(i), Y(i)); g.closePath(); g.stroke();
  g.fillStyle = '#fff'; g.fillRect(X(0) - 3, Y(0) - 3, 6, 6);
}

/* menu : accueil (Grand Prix, contre-la-montre, carrière, écuries) puis un écran par mode */
let MODE = 'home';
const MODE_TITLE = { gp: 'Grand Prix', tt: 'Contre-la-montre', teams: 'Écuries & pilotes', mp: 'Multijoueur Wi-Fi', replays: 'Replays sauvegardés' };
/* ---- fenêtre de réglages et flèche de retour ---- */
function openPro() { $('#pro-id').textContent = DEV_ID; $('#pro-msg').textContent = ''; $('#pro').hidden = false; $('#pro-bg').hidden = false; }
function closePro() { $('#pro').hidden = true; $('#legal').hidden = true; $('#pro-bg').hidden = true; }
/* bandeau « version d'essai », cadenas sur les modes réservés à la version complète */
function renderProBits() {
  document.body.classList.toggle('free', !PRO);
  $('#pro-banner').hidden = PRO || !['home', 'gp', 'tt'].includes(MODE);
  $('#btn-mar').classList.toggle('locked', !PRO);
  for (const b of $$('.home .mode')) b.classList.toggle('locked', !PRO && !['gp', 'tt'].includes(b.dataset.go));
}
function openSheet() { $('#sheet').hidden = false; $('#sheet-bg').hidden = false; $('#sheet').scrollTop = 0; updateNavBack(); }
function closeSheet() { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; updateNavBack(); }
function curScreen() { return ['menu', 'quali', 'race', 'champ', 'cnew', 'lobby'].find(id => !$('#' + id).hidden) || 'menu'; }
function updateNavBack() {   // barre du haut : retour, titre de l'écran, résumé et bouton réglages
  const sc = curScreen(), on = sc !== 'race' && !(sc === 'menu' && MODE === 'home');
  $('#topnav').hidden = !on; document.body.classList.toggle('nb', on);
  if (!on) return;
  const settings = sc === 'menu' && (MODE === 'gp' || MODE === 'tt');
  const c = CIRCUITS[ST.circuit] || CIRCUITS[0];
  const title = sc === 'menu' ? MODE_TITLE[MODE] : { quali: 'Qualifications', champ: 'Carrière', lobby: 'Multijoueur', cnew: 'Nouvelle carrière' }[sc] || '';
  const sub = settings ? $('#set-sum').textContent : sc === 'quali' ? `${c.flag} ${c.name}` : sc === 'champ' && career() ? career().name : sc === 'lobby' ? (NET.role === 'host' ? 'Tu héberges la partie' : 'Partie rejointe') : '';
  $('#tn-t').textContent = title; $('#tn-s').textContent = sub; $('#tn-s').hidden = !sub;
  $('#nav-back-l').textContent = sc === 'lobby' ? 'Quitter' : sc === 'cnew' ? 'Retour' : sc === 'quali' ? (CH.pending ? 'Carrière' : 'Circuits') : 'Menu';
  $('#tn-set').hidden = !settings;
}
function navBack() {   // retour d'un cran, quel que soit l'endroit de la page (aussi bouton retour Android)
  if (!$('#pro').hidden || !$('#legal').hidden) { closePro(); return true; }
  if (!$('#sheet').hidden) { closeSheet(); return true; }
  const sc = curScreen();
  if (sc === 'menu') { if (MODE === 'home') return false; setMode('home'); return true; }
  if (sc === 'quali') { $('#btn-back').click(); return true; }
  if (sc === 'champ') { $('#ch-menu').click(); return true; }
  if (sc === 'lobby') { $('#lb-leave').click(); return true; }
  if (sc === 'cnew') { $('#cf-cancel').click(); return true; }
  return false;
}
function setMode(m) {
  if (MODE === 'mp' && m !== 'mp' && MPN && !NET.role) MPN.stopDiscover();
  MODE = m; $('#menu').dataset.mode = m;
  if (m === 'mp') setTimeout(mpMenu, 0);
  if (m === 'replays') renderReplays();
  $$('#menu [data-modes]').forEach(el => { el.hidden = !el.dataset.modes.split(' ').includes(m); });
  $('#m-title').textContent = MODE_TITLE[m] || '';
  renderMenu(); window.scrollTo(0, 0); closeSheet();
}
function renderMenu() {
  restoreMenuSettings();
  freeClamp(ST); renderProBits();
  const list = $('#gp-list');
  const card = (c, i) => `
    <button class="gp ${i === ST.circuit ? 'on' : ''} ${isFreeCirc(c) ? '' : 'locked'}" data-i="${i}" id="gp-${i}" aria-pressed="${i === ST.circuit}">
      <span class="gp-rd">${isFreeCirc(c) ? '' : '🔒 '}${c.bonus ? 'BONUS' : 'R' + String(i + 1).padStart(2, '0')}</span>
      <canvas class="gp-map" aria-hidden="true"></canvas>
      <span class="gp-name"><span class="flag">${c.flag}</span>${c.name}</span>
      <span class="gp-sub">${c.sub}</span>
      <span class="gp-data">${(c.length / 1000).toFixed(3)} km · ${c.laps} tours${c.street ? ' · urbain' : ''}</span>
      ${(r => r ? `<span class="gp-rec">Record ${fmt(r.time)}</span>` : '')(loadRecord(c.id))}
    </button>`;
  list.innerHTML = CIRCUITS.map((c, i) => c.bonus ? '' : card(c, i)).join('');
  $('#gp-bonus').innerHTML = CIRCUITS.map((c, i) => c.bonus ? card(c, i) : '').join('');
  renderTTTotal();
  $$('.gp').forEach(b => {
    drawThumb(b.querySelector('canvas'), CIRCUITS[+b.dataset.i], +b.dataset.i === ST.circuit);
    b.onclick = () => { if (!isFreeCirc(CIRCUITS[+b.dataset.i])) { openPro(); return; } ST.circuit = +b.dataset.i; ST.quali = null; savePrefs(); renderMenu(); };
  });
  renderSettings();
  renderTeams();
  renderChampCard();
  renderHome();
}
/* ---- accueil : course rapide + tracé animé ---- */
const WX_SHORT = { dry: 'Sec', light: 'Pluie légère', heavy: 'Pluie forte', mixed: 'Variable' };
function renderHome() {
  const c = CIRCUITS[ST.circuit];
  $('#qk-name').textContent = `${c.flag} ${c.name}`;
  $('#qk-sub').textContent = `${lapsFor(c)} tours · ${WX_SHORT[ST.weather] || 'Sec'} · ${ST.human || 'spectateur'}`;
  chipGroup($('#opt-lang'), [{ v: 'fr', l: 'Français' }, { v: 'en', l: 'English' }], ST.lang, v => { ST.lang = v; I18N.set(v); savePrefs(); setLangBtns(); renderMenu(); });
  chipGroup($('#opt-tiktok'), [{ v: 1, l: 'Zones TikTok' }, { v: 0, l: 'Plein écran' }], ST.tiktok ? 1 : 0, v => { ST.tiktok = v === '1'; savePrefs(); renderHome(); });
  $('#tiktok-note').textContent = ST.tiktok ? 'Les vidéos (highlights, clips, présentation, grille) gardent leurs textes hors des zones couvertes par l’interface de TikTok (haut, bas, droite).' : 'Les textes des vidéos occupent toute l’image.';
  heroAnim();
}
const HERO = { raf: 0, t: 0, circ: -1, pts: null };
function heroAnim() {
  if (HERO.raf) return;
  const cv = $('#hero-map');
  const frame = now => {
    HERO.raf = 0;
    if (MODE !== 'home' || $('#menu').hidden || document.hidden) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || HERO.circ !== ST.circuit) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); HERO.circ = ST.circuit;
      const p = CIRCUITS[ST.circuit].pts; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
      // tracé à droite, sous le titre
      const top = Math.min(H * 0.42, 120), bx = W * 0.42, bw = W * 0.56, by = W > 600 ? 14 : top, bh = (W > 600 ? H - 14 : H) - 108 - by;
      const sc = Math.min(bw / (x1 - x0), bh / (y1 - y0)), ox = bx + (bw - (x1 - x0) * sc) / 2, oy = by + (bh - (y1 - y0) * sc) / 2;
      HERO.pts = []; for (let i = 0; i < p.length; i += 2) HERO.pts.push([ox + (p[i] - x0) * sc, oy + (y1 - p[i + 1]) * sc]);
      HERO.len = [0]; for (let i = 1; i <= HERO.pts.length; i++) { const a = HERO.pts[i - 1], b = HERO.pts[i % HERO.pts.length]; HERO.len.push(HERO.len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    }
    const g = cv.getContext('2d'), P = HERO.pts, L = HERO.len[HERO.len.length - 1];
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.lineJoin = g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 9; g.beginPath(); P.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.stroke();
    // voiture : point lumineux avec une traînée
    HERO.t = ((now || 0) / 1000 * L / 9) % L;
    const at = d => { d = ((d % L) + L) % L; let i = 1; while (HERO.len[i] < d) i++; const a = P[i - 1], b = P[i % P.length], f = (d - HERO.len[i - 1]) / Math.max(1e-6, HERO.len[i] - HERO.len[i - 1]); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    for (let k = 26; k >= 0; k--) { const q = at(HERO.t - k * L / 140); g.fillStyle = `rgba(255,${40 + k * 4},${30 + k * 3},${(1 - k / 27) * 0.9})`; g.beginPath(); g.arc(q[0], q[1], 3.2 - k * 0.08, 0, 7); g.fill(); }
    const q = at(HERO.t); g.shadowColor = '#ff2d2d'; g.shadowBlur = 14; g.fillStyle = '#fff'; g.beginPath(); g.arc(q[0], q[1], 3.6, 0, 7); g.fill(); g.shadowBlur = 0;
    HERO.raf = requestAnimationFrame(frame);
  };
  HERO.raf = requestAnimationFrame(frame);
}

function chipGroup(el, opts, cur, onPick) {
  el.innerHTML = opts.map(o => `<button class="chip ${String(o.v) === String(cur) ? 'on' : ''}" data-v="${o.v}" aria-pressed="${String(o.v) === String(cur)}">${o.l}</button>`).join('');
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => { onPick(b.dataset.v); });
}
/* version d'essai : les choix non disponibles portent un cadenas et ouvrent la fenêtre de déblocage */
function lockChips(el, allowed) {
  if (PRO) return;
  el.querySelectorAll('.chip').forEach(b => {
    const v = b.dataset.v != null ? b.dataset.v : b.dataset.k;
    if (allowed.includes(String(v))) return;
    b.classList.add('locked'); b.textContent = '🔒 ' + b.textContent.replace(/^✓ /, '');
    b.onclick = e => { e.preventDefault(); openPro(); };
  });
}
/* rythme des IA + aides : même bloc dans le menu et dans le formulaire de carrière */
function renderDiff(pfx, o, done) {
  const r = $('#' + pfx + '-pace'), v = $('#' + pfx + '-pace-v');
  const showV = () => { v.textContent = pctTxt(o.aiPace) + (o.aiPace > 100 ? ' · au-delà de la limite' : o.aiPace === 100 ? ' · limite de la voiture' : ''); };
  r.value = o.aiPace; showV();
  r.disabled = !PRO && pfx === 'opt'; r.parentElement.classList.toggle('locked', r.disabled);
  r.parentElement.onclick = r.disabled ? () => openPro() : null;
  r.oninput = () => { o.aiPace = +r.value; showV(); };
  r.onchange = () => { o.aiPace = +r.value; done(); };
  chipGroup($('#' + pfx + '-brake'), [{ v: 'auto', l: 'Automatique' }, { v: 'aide', l: 'Aide' }, { v: 'off', l: 'Aucune' }], o.brakeAid, x => { o.brakeAid = x; done(); });
  const help = $('#' + pfx + '-help');
  const rules = [['tl', 'tlRule', 'limites de piste', 'infractions'], ['col', 'colRule', 'collisions', 'collisions provoquées']];
  for (const [k, key] of rules) chipGroup($('#' + pfx + '-' + k), [{ v: 'strict', l: 'Strictes' }, { v: 'indulgent', l: 'Indulgentes' }, { v: 'off', l: 'Aucune' }], o[key], x => { o[key] = x; done(); });
  help.innerHTML = [['cues', 'Zones de freinage'], ['stab', 'Anti tête-à-queue']]
    .map(([k, l]) => `<button class="chip ${o[k] ? 'on' : ''}" data-k="${k}" aria-pressed="${!!o[k]}">${o[k] ? '✓ ' : ''}${l}</button>`).join('');
  help.querySelectorAll('.chip').forEach(b => b.onclick = () => { o[b.dataset.k] = !o[b.dataset.k]; done(); });
  if (pfx === 'opt') { for (const [k, key] of rules) lockChips($('#opt-' + k), [String(FREE_FIX[key])]); lockChips(help, []); }
  $('#' + pfx + '-help-note').textContent = ({ auto: 'Freinage automatique : la voiture freine toute seule avant les virages.', aide: 'Aide au freinage : la voiture freine pour toi si tu arrives beaucoup trop vite.', off: 'Aucune aide : tu freines toi-même.' })[o.brakeAid]
    + (o.cues ? ' Les zones de freinage sont affichées sur la piste.' : '') + (o.stab ? ' Pas de tête-à-queue.' : ' Tête-à-queue possibles.')
    + (pfx === 'opt' && MODE === 'tt' ? ' En contre-la-montre, un tour hors des limites de piste est annulé.'   // pas d'IA ni de pénalités en contre-la-montre
      : rules.map(([k, key, l, u]) => RULE_N[k][o[key]] ? ` Pénalité de 5 s toutes les ${RULE_N[k][o[key]]} ${u} (${l}).` : ` Pas de pénalité pour les ${l}.`).join('')
      + ' À 100 %, les IA exploitent toute l’adhérence de leur voiture ; au-delà, elles vont plus loin, comme un pilote qui « attaque » les épingles et les vibreurs.');
}
function renderSettings() {
  const c = CIRCUITS[ST.circuit];
  $('#sel-name').textContent = `${c.flag} ${c.name} · ${c.sub}`;
  chipGroup($('#opt-laps'), [
    { v: '1', l: '1' }, { v: '3', l: '3' }, { v: '5', l: '5' }, { v: '10', l: '10' }, { v: '20', l: '20' },
    { v: '50', l: `50 % · ${Math.round(c.laps / 2)}` }, { v: '100', l: `Complet · ${c.laps}` }], ST.lapsKey, v => { ST.lapsKey = v; savePrefs(); renderSettings(); });
  chipGroup($('#opt-wear'), [{ v: 'prop', l: 'Stratégie complète' }, { v: 'real', l: 'Usure réelle' }], ST.wear, v => { ST.wear = v; savePrefs(); renderSettings(); });
  chipGroup($('#opt-chaos'), [{ v: 1, l: 'Réaliste' }, { v: 2.5, l: 'Agité' }, { v: 5, l: 'Chaos' }], ST.chaos, v => { ST.chaos = +v; savePrefs(); renderSettings(); });
  chipGroup($('#opt-wx'), [{ v: 'dry', l: 'Sec' }, { v: 'light', l: 'Pluie légère' }, { v: 'heavy', l: 'Pluie forte' }, { v: 'mixed', l: 'Variable' }], ST.weather, v => { ST.weather = v; ST.quali = null; savePrefs(); renderSettings(); });
  lockChips($('#opt-laps'), FREE_SET.lapsKey); lockChips($('#opt-wear'), FREE_SET.wear); lockChips($('#opt-chaos'), FREE_SET.chaos); lockChips($('#opt-wx'), FREE_SET.weather);
  const sel = $('#opt-driver');
  sel.innerHTML = (MODE === 'tt' ? '' : '<option value="">Spectateur (toutes les voitures en IA)</option>') + ST.teams.map(t => t.drivers.map(d => `<option value="${d.name}" ${d.name === ST.human ? 'selected' : ''}>${d.name} · ${t.name}</option>`).join('')).join('');
  sel.onchange = () => { ST.human = sel.value; savePrefs(); renderSettings(); };
  $('#drive-who').textContent = ST.human || MODE === 'tt' ? 'Tu pilotes' : 'Spectateur';
  renderDiff('opt', ST, () => { ST.quali = null; savePrefs(); renderSettings(); });
  chipGroup($('#opt-assist'), [{ v: 'on', l: 'Assistée' }, { v: 'semi', l: 'Semi' }, { v: 'off', l: 'Libre' }], ST.assist, v => { ST.assist = v; savePrefs(); renderSettings(); });
  chipGroup($('#opt-dmg'), DMG_CHIPS, dmgOf(ST), v => { setDmg(ST, v); savePrefs(); renderSettings(); });
  lockChips($('#opt-dmg'), ['0']);
  chipGroup($('#opt-eng'), [{ v: 'hybrid', l: 'Hybride 2026' }, { v: 'ice', l: '100 % thermique' }], ST.engine, v => { ST.engine = v; ST.quali = null; savePrefs(); renderSettings(); if (typeof renderTTTotal === 'function') renderTTTotal(); });
  $('#eng-note').textContent = ST.engine === 'ice'
    ? 'Moteur thermique seul (≈ 815 ch), puissance constante : pas de batterie, pas d’ERS ni d’Overtake. Seul le pilotage compte. Records du contre-la-montre séparés.'
    : 'Moteur 2026 : moitié thermique, moitié électrique. Gère la batterie (ERS) et le mode Overtake.';
  $('#dmg-note').textContent = ST.noDnf
    ? 'Aucune voiture ne peut abandonner, IA comprises. Un choc contre une voiture ou un mur ralentit, sans casse ni crevaison.'
    : ST.dmgLite
      ? 'Les gros accidents peuvent provoquer des abandons (et donc la Safety Car), mais les petits chocs n’abîment rien : jamais d’arrêt forcé pour réparer.'
      : 'Chocs et sorties peuvent abîmer l’aileron, crever un pneu ou mettre fin à ta course.';
  chipGroup($('#opt-ctrl'), [{ v: 'touch', l: 'Un doigt' }, { v: 'pads', l: 'Boutons' }], ST.ctrl, v => { ST.ctrl = v; savePrefs(); renderSettings(); });
  $('#ctrl-note').textContent = (ST.ctrl === 'touch'
    ? 'Un doigt : appuie à gauche ou à droite de l’écran pour tourner (plus tu t’éloignes du centre, plus tu braques). Tant que tu appuies, tu accélères ; relâche pour freiner, de plus en plus fort.' + (ST.brakeAid === 'off' ? ' Sans aide au freinage, une bande « roue libre » en bas de l’écran permet de tourner sans accélérer.' : '')
    : 'Boutons : ◀ ▶ pour tourner, FREIN et GAZ à maintenir. Sans pédale, la voiture roule en roue libre.')
    + ({ on: ' Direction assistée : la voiture suit la courbe de la piste, tu choisis ta trajectoire et tes points de freinage.', semi: ' Direction semi-assistée : la voiture prend une partie du virage toute seule, à toi de compléter le braquage (ou d’en retirer) pour rester sur la piste.', off: ' Direction libre : tu tiens le volant, la voiture va tout droit si tu ne tournes pas.' })[ST.assist]
    + ' La qualification de ta voiture est faite par l’IA. Clavier : flèches, O pour Overtake, B pour les stands.';
  const tp = SIM.tyreProfile(c);
  const degTxt = tp.deg >= 1.3 ? 'très élevée' : tp.deg >= 1.1 ? 'élevée' : tp.deg >= 0.9 ? 'moyenne' : tp.deg >= 0.75 ? 'faible' : 'très faible';
  $('#tyre-info').innerHTML = `<b>Pneus :</b> <span style="color:#E8002D">tendre</span> → <span style="color:#FFD12E">medium</span> +${tp.sm.toFixed(2).replace('.', ',')} s · medium → <span style="color:#F0F0EC">dur</span> +${tp.mh.toFixed(2).replace('.', ',')} s au tour · dégradation ${degTxt}`;
  const laps = lapsFor(c), drv = ST.human ? ST.human.split(' ').pop() : 'Spectateur';
  $('#set-sum').textContent = (ST.engine === 'ice' ? 'Thermique · ' : '') + (MODE === 'tt' ? `${ST.human || 'Pilote auto'} · freinage ${BRAKE_L[ST.brakeAid]} · direction ${({ on: 'assistée', semi: 'semi', off: 'libre' })[ST.assist]}`
    : `${laps} tours · ${WX_LABEL[ST.weather] || 'Sec'} · ${drv}${ST.human ? ' · IA ' + pctTxt(ST.aiPace) : ''}`);
  if (typeof updateNavBack === 'function' && $('#topnav')) updateNavBack();
  $('#race-dist').textContent = `${laps} tours · ${(laps * c.length / 1000).toFixed(1)} km`;
}

/* réglages des écuries : mémorisés sur l'appareil */
const STATS = ['ligne_droite', 'virage', 'pneus', 'depart'];
function saveTeams() {
  try { localStorage.setItem('paddock26-teams', JSON.stringify(ST.teams.map(t => ({ name: t.name, s: STATS.map(k => +t[k]), d: t.drivers.map(d => [d.name, +d.skill]) })))); } catch (e) { /* ignoré */ }
}
(function loadTeams() {
  try {
    const sv = JSON.parse(localStorage.getItem('paddock26-teams') || 'null'); if (!sv) return;
    for (const x of sv) { const t = ST.teams.find(t => t.name === x.name); if (!t) continue; STATS.forEach((k, i) => { t[k] = x.s[i]; }); for (const [n, sk] of x.d) { const d = t.drivers.find(d => d.name === n); if (d) { d.skill = sk; d.consistency = sk; } } }
  } catch (e) { /* ignoré */ }
})();
function setAllTeams(v) {
  ST.teams.forEach((t, i) => {
    const base = TEAMS_BASE[i];
    STATS.forEach(k => { t[k] = v == null ? base[k] : v; });
    t.drivers.forEach((d, j) => { d.skill = v == null ? base.drivers[j].skill : v; d.consistency = v == null ? base.drivers[j].consistency : v; });
  });
  ST.quali = null; saveTeams(); renderTeams();
}
/* renomme (map : nom actuel → nouveau nom) partout, sauvegardes comprises, puis relance l'appli */
function applyRenames(map) {
  const pairs = Object.entries(map).filter(([a, b]) => a && b && a !== b).sort((x, y) => y[0].length - x[0].length);
  if (!pairs.length) return;
  const pack = loadPack(), all = ST.teams.flatMap(t => [t, ...t.drivers]);
  for (const [a, b] of pairs) { const o = all.find(x => x.name === a); if (o) pack[o.base] = b; }
  for (const k of Object.keys(pack)) if (all.some(x => x.base === k && pack[k] === k)) delete pack[k];
  try {
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('paddock26') && k !== 'paddock26-namepack' && k !== 'paddock26-careers' && k !== 'paddock26-livery') keys.push(k); }   // les carrières gardent leurs noms d'origine
    // en deux temps (via des jetons) pour permettre d'échanger deux noms
    for (const k of keys) {
      let v = localStorage.getItem(k);
      pairs.forEach(([a], i) => { v = v.split('"' + a + '"').join('"\u0001' + i + '\u0001"'); });
      pairs.forEach(([, b], i) => { v = v.split('"\u0001' + i + '\u0001"').join(JSON.stringify(b)); });
      localStorage.setItem(k, v);
    }
    localStorage.setItem('paddock26-namepack', JSON.stringify(pack));
  } catch (e) { /* stockage indisponible */ }
  location.reload();
}
function namesText() { return ST.teams.map(t => [`${t.base} = ${t.name} | ${t.color} ${t.color2 || ''}`.trim(), ...t.drivers.map(d => `${d.base} = ${d.name} | #${d.num} ${d.nat || ''}`.trim())].join('\n')).join('\n\n'); }
function importNames(txt) {
  const map = {}, all = ST.teams.flatMap(t => [t, ...t.drivers]), lv = loadLivery(); let lvCh = false;
  for (const line of String(txt).split(/\r?\n/)) {
    const m = /^\s*(.+?)\s*=\s*([^|]+?)\s*(?:\|\s*(.*?))?\s*$/.exec(line); if (!m) continue;
    const o = all.find(x => x.base === m[1] || x.name === m[1]); const nn = m[2].replace(/\s+/g, ' ').slice(0, 28);
    if (o && nn && nn !== o.name) map[o.name] = nn;
    if (o && m[3]) {   // « | #couleur #couleur » pour une écurie, « | #numéro drapeau » pour un pilote
      const cols = m[3].match(/#[0-9a-fA-F]{6}\b/g), num = /#(\d{1,2})(?!\d|[0-9a-fA-F]{4})/.exec(m[3]);
      if (o.drivers && cols) { lv[o.base] = { color: cols[0], color2: cols[1] || cols[0], tv: tvOf(cols[0], cols[1] || cols[0]) }; lvCh = true; }
      else if (!o.drivers && num) { lv[o.base] = { num: +num[1], nat: m[3].replace(num[0], '').trim() }; lvCh = true; }
    }
  }
  if (lvCh) { try { localStorage.setItem('paddock26-livery', JSON.stringify(lv)); } catch (e) { /* ignoré */ } if (!Object.keys(map).length) { location.reload(); return ''; } }
  const finalNames = all.map(x => map[x.name] || x.name);
  if (new Set(finalNames.map(n => n.toLowerCase())).size !== finalNames.length) return 'Deux écuries ou deux pilotes auraient le même nom.';
  if (!Object.keys(map).length) return 'Aucun changement trouvé.';
  applyRenames(map); return '';
}
function renderTeams() {
  const box = $('#teams');
  box.innerHTML = ST.teams.map((t, ti) => `
    <details class="team">
      <summary><i style="background:${t.tv || t.color}"></i><b>${t.name}</b><span>${t.drivers.map(d => lastName(d.name)).join(' · ')}</span></summary>
      <div class="sliders">
        ${[['ligne_droite', 'Moteur / vitesse de pointe'], ['virage', 'Aéro / virages'], ['pneus', 'Gestion des pneus'], ['depart', 'Départs']].map(([k, l]) => `
          <label for="t${ti}-${k}">${l}<output id="o${ti}-${k}">${(+t[k]).toFixed(1)}</output></label>
          <input type="range" id="t${ti}-${k}" min="50" max="80" step="0.5" value="${t[k]}" data-t="${ti}" data-k="${k}">`).join('')}
        ${t.drivers.map((d, di) => `
          <label for="d${ti}-${di}">${d.name} · talent<output id="od${ti}-${di}">${(+d.skill).toFixed(1)}</output></label>
          <input type="range" id="d${ti}-${di}" min="50" max="80" step="0.5" value="${d.skill}" data-t="${ti}" data-d="${di}">`).join('')}
      </div>
      <div class="rename">
        <div class="lv-car" aria-hidden="true">${carSVG(t.color, t.color2, t.drivers[0].num)}</div>
        <label>Nom de l’écurie<input class="txt" maxlength="28" data-old="${escapeHtml(t.name)}" value="${escapeHtml(t.name)}"></label>
        <div class="lv-cols"><label>Couleur principale<input type="color" data-c="color" value="${t.color}"></label><label>Couleur secondaire<input type="color" data-c="color2" value="${t.color2 || '#ffffff'}"></label></div>
        ${t.drivers.map((d, di) => `<div class="lv-drv"><label>Pilote<input class="txt" maxlength="28" data-old="${escapeHtml(d.name)}" value="${escapeHtml(d.name)}"></label>
          <label>N°<input class="txt" type="number" inputmode="numeric" min="0" max="99" data-num="${di}" value="${d.num}"></label>
          <label>Drapeau<input class="txt" maxlength="8" data-nat="${di}" value="${escapeHtml(d.nat || '')}" placeholder="🏳️"></label></div>`).join('')}
        <button class="btn ghost" data-ren="${ti}">Enregistrer</button>
      </div>
    </details>`).join('');
  // aperçu de la voiture quand on change une couleur ou un numéro
  box.querySelectorAll('.rename').forEach(rn => rn.oninput = () => {
    const c1 = rn.querySelector('[data-c=color]').value, c2 = rn.querySelector('[data-c=color2]').value, n = rn.querySelector('[data-num="0"]').value;
    rn.querySelector('.lv-car').innerHTML = carSVG(c1, c2, n);
  });
  box.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => {
    const t = ST.teams[+b.dataset.ren], rn = b.parentElement;
    const fail = msg => { b.textContent = msg; setTimeout(() => { b.textContent = 'Enregistrer'; }, 2500); };
    const map = {}; rn.querySelectorAll('input[data-old]').forEach(i => { const v = i.value.replace(/\s+/g, ' ').trim(); if (v && v !== i.dataset.old) map[i.dataset.old] = v; });
    const all = ST.teams.flatMap(x => [x, ...x.drivers]).map(x => (map[x.name] || x.name).toLowerCase());
    if (new Set(all).size !== all.length) { fail('Nom déjà utilisé'); return; }
    const nums = t.drivers.map((d, di) => Math.round(+rn.querySelector(`[data-num="${di}"]`).value));
    if (nums.some(n => !(n >= 0 && n <= 99))) { fail('Numéro de 0 à 99'); return; }
    const others = ST.teams.flatMap(x => x === t ? [] : x.drivers.map(d => +d.num));
    if (nums[0] === nums[1] || nums.some(n => others.includes(n))) { fail('Numéro déjà pris'); return; }
    const lv = loadLivery(), c1 = rn.querySelector('[data-c=color]').value, c2 = rn.querySelector('[data-c=color2]').value;
    lv[t.base] = { color: c1, color2: c2, tv: tvOf(c1, c2) };
    t.drivers.forEach((d, di) => { lv[d.base] = { num: nums[di], nat: rn.querySelector(`[data-nat="${di}"]`).value.trim() }; });
    try { localStorage.setItem('paddock26-livery', JSON.stringify(lv)); } catch (e) { /* stockage indisponible */ }
    if (Object.keys(map).length) applyRenames(map); else location.reload();
  });
  box.querySelectorAll('input[type=range]').forEach(inp => inp.oninput = () => {
    const t = ST.teams[+inp.dataset.t];
    ST.quali = null; clearTimeout(renderTeams.sv); renderTeams.sv = setTimeout(saveTeams, 300);
    if (inp.dataset.k) { t[inp.dataset.k] = +inp.value; $(`#o${inp.dataset.t}-${inp.dataset.k}`).textContent = (+inp.value).toFixed(1); }
    else { const d = t.drivers[+inp.dataset.d]; d.skill = +inp.value; d.consistency = +inp.value; $(`#od${inp.dataset.t}-${inp.dataset.d}`).textContent = (+inp.value).toFixed(1); }
  });
}

/* =====================================================================
   QUALIFICATIONS
   ===================================================================== */
function qPace() { return ST.human ? ST.aiPace / 100 : 1; }   // en qualif l'IA roule déjà à la limite (pas de marge de course)
function startWet() { return ST.weather === 'heavy' ? 0.9 : ST.weather === 'light' ? 0.4 : 0; }
function runQuali() {
  const T = getTrack(ST.circuit, true);
  const entries = activeTeams().flatMap(t => t.drivers.map(d => ({ team: t, driver: d })));
  // carrière : les qualifs d'une manche ne se jouent qu'une fois (on les retrouve telles quelles en revenant)
  ST.quali = CH.pending && champQuali(entries) || SIM.qualifying(T, entries, startWet(), qPace(), ST.human);
  if (CH.pending) saveChampQuali();
  renderQuali();
  show('quali');
}
const champRound = () => CH.season && CH.season.round < CH.season.rounds.length ? CH.season.rounds[CH.season.round] : null;
function saveChampQuali() {
  const rd = champRound(); if (!rd || !ST.quali) return;
  rd.quali = ST.quali.map(r => ({ n: r.entry.driver.name, q1: r.q1, q2: r.q2, q3: r.q3, best: r.best, gn: r.gn, gk: r.gk, wet: r.wet, mine: !!r.mine, pos: r.pos }));
  saveChamp();
}
function champQuali(entries) {
  const rd = champRound(); if (!rd || !rd.quali) return null;
  const by = new Map(entries.map(e => [e.driver.name, e]));
  if (rd.quali.length !== entries.length || !rd.quali.every(q => by.has(q.n))) return null;
  return rd.quali.map(q => ({ entry: by.get(q.n), q1: q.q1, q2: q.q2, q3: q.q3, best: q.best, gn: q.gn, gk: q.gk, wet: q.wet || 0, mine: q.mine || undefined, pos: q.pos }));
}
/* ---------------- simulateur de stratégie (avant la course) ----------------
   toutes les stratégies sèches à 1 ou 2 arrêts (au moins deux types de pneus), meilleur tour d'arrêt pour chacune,
   d'après le même modèle d'usure, d'adhérence et d'essence que la course */
function computeStrategies(T, N, baseLap) {
  const M = SIM.strategyModel(T, N, ST.wear, baseLap), C = ['S', 'M', 'H'];
  // coût d'un relais : pneu c du tour a au tour b inclus (tableau cumulé)
  const stint = {};
  for (const c of C) {
    stint[c] = [];
    for (let a = 1; a <= N; a++) { const row = new Float64Array(N + 1); let sum = 0; for (let b = a; b <= N; b++) { sum += M.lap(c, M.wearPerLap(c) * (b - a), b, b === a && a > 1); row[b] = sum; } stint[c][a] = row; }
  }
  const out = [];
  if (N < 5) {
    for (const c of C) out.push({ seq: [c], stops: [], total: stint[c][1][N] });
    return { list: out.sort((a, b) => a.total - b.total), M };
  }
  for (const a of C) for (const b of C) if (a !== b) {
    let best = null;
    for (let k = 1; k < N; k++) { const t = stint[a][1][k] + stint[b][k + 1][N] + M.pitLoss; if (!best || t < best.total) best = { seq: [a, b], stops: [k], total: t }; }
    out.push(best);
  }
  for (const a of C) for (const b of C) for (const c of C) {
    if (a === b && b === c) continue;
    let best = null;
    for (let k1 = 1; k1 < N - 1; k1++) for (let k2 = k1 + 1; k2 < N; k2++) {
      const t = stint[a][1][k1] + stint[b][k1 + 1][k2] + stint[c][k2 + 1][N] + 2 * M.pitLoss;
      if (!best || t < best.total) best = { seq: [a, b, c], stops: [k1, k2], total: t };
    }
    out.push(best);
  }
  // une seule ligne par combinaison de pneus (M-H-H, H-M-H… reviennent au même) : on garde la plus rapide
  const seen = new Set(), list = [];
  for (const st of out.sort((a, b) => a.total - b.total)) { const k = st.seq.slice().sort().join('') + st.stops.length; if (!seen.has(k)) { seen.add(k); list.push(st); } }
  return { list, M };
}
function lapsOfStrategy(st, M, N) {
  const res = []; let si = 0, from = 1;
  for (let l = 1; l <= N; l++) {
    if (si < st.stops.length && l > st.stops[si]) { si++; from = l; }
    const c = st.seq[si]; res.push({ l, c, t: M.lap(c, M.wearPerLap(c) * (l - from), l, l === from && from > 1) + (si > 0 && l === from ? M.pitLoss : 0) });
  }
  return res;
}
/* simulateur manuel : tu choisis le nombre d'arrêts, les pneus de chaque relais et le tour de chaque arrêt ;
   le temps total, l'usure en fin de relais et les temps au tour sont recalculés en direct */
let STD = null;   // stratégie en cours d'édition { circuit, laps, seq, stops }
function renderStrategy() {
  const box = $('#strat');
  if (!ST.human || !ST.quali || !PRO) { box.hidden = true; return; }
  const circ = CIRCUITS[ST.circuit], N = lapsFor(circ), Tq = getTrack(ST.circuit);
  const mine = ST.quali.find(r => r.entry.driver.name === ST.human && r.mine), p1 = ST.quali.filter(r => r.best < 900)[0];
  const base = mine ? mine.best : p1.best, M = SIM.strategyModel(Tq, N, ST.wear, base);   // le modèle passe du tour de qualif au rythme de course réel du circuit
  box.hidden = false;
  if (!STD || STD.circuit !== circ.id || STD.laps !== N) {
    const p = ST.plan && ST.plan.circuit === circ.id && ST.plan.laps === N ? ST.plan : null;
    STD = p ? { circuit: circ.id, laps: N, seq: p.seq.slice(), stops: p.stops.slice() }
      : N < 5 ? { circuit: circ.id, laps: N, seq: ['S'], stops: [] } : { circuit: circ.id, laps: N, seq: ['M', 'H'], stops: [Math.round(N * 0.45)] };
  }
  $('#st-base').textContent = `${N} tours · arrêt ≈ ${M.pitLoss.toFixed(1)} s`;
  $('#st-note').textContent = (ST.weather !== 'dry' ? 'Prévision pour une course sur le sec : la pluie changera tout. ' : '')
    + `Compose ta stratégie : temps au tour prévus à partir de ${mine ? 'ton tour de qualif' : 'la pole'} et du rythme de course réel sur ce circuit, avec l’usure des pneus (falaise au-delà de 85 %), l’essence et le temps perdu aux stands. Elle est appliquée au départ (pneu monté, rappel au bon tour, pneu présélectionné au stand).`;
  const COL = { S: SIM.COMP.S.col, M: SIM.COMP.M.col, H: SIM.COMP.H.col };
  // nombre d'arrêts : on répartit les arrêts régulièrement quand il change
  chipGroup($('#st-stops'), [0, 1, 2, 3].map(n => ({ v: n, l: n ? String(n) : 'Aucun' })), STD.stops.length, v => {
    const n = +v; if (n === STD.stops.length) return;
    STD.stops = Array.from({ length: n }, (_, k) => Math.round(N * (k + 1) / (n + 1)));
    STD.seq = Array.from({ length: n + 1 }, (_, k) => STD.seq[k] || (k % 2 ? 'H' : 'M'));
    savePlan(); renderStrategy();
  });
  const stintLen = k => (k < STD.stops.length ? STD.stops[k] : N) - (k ? STD.stops[k - 1] : 0);
  $('#st-list').innerHTML = STD.seq.map((c, k) => {
    const len = stintLen(k), wEnd = M.wearPerLap(c) * len, mid = Math.round(N / 2), lost = M.lap(c, Math.max(0, wEnd - M.wearPerLap(c)), mid, false) - M.lap(c, 0, mid, false);
    const stop = k < STD.stops.length ? `<label class="st-stop">Arrêt ${k + 1}<input type="range" min="1" max="${N - 1}" value="${STD.stops[k]}" data-k="${k}" aria-label="Tour de l’arrêt ${k + 1}"><b id="st-l${k}">T${STD.stops[k]}</b></label>` : '';
    return `<div class="st-stint"><div class="hd"><b>Relais ${k + 1} · ${len} tour${len > 1 ? 's' : ''}</b><span class="${wEnd > 0.9 ? 'warn' : ''}">usure en fin de relais ${Math.round(wEnd * 100)} % · +${lost.toFixed(1).replace('.', ',')} s/tour${wEnd > 1 ? ' — pneus cuits !' : wEnd > 0.9 ? ' — falaise' : ''}</span></div>
      <div class="st-tyres">${['S', 'M', 'H'].map(t => `<button data-k="${k}" data-t="${t}" class="${t === c ? 'on' : ''}" style="border-color:${COL[t]};color:${COL[t]}" aria-pressed="${t === c}">${t}</button>`).join('')}</div>${stop}</div>`;
  }).join('');
  $$('#st-list .st-tyres button').forEach(b => b.onclick = () => { STD.seq[+b.dataset.k] = b.dataset.t; savePlan(); renderStrategy(); });
  $$('#st-list input[type=range]').forEach(r => {
    r.oninput = () => {   // les arrêts restent dans l'ordre, au moins un tour d'écart
      const k = +r.dataset.k; let v = +r.value;
      v = clamp(v, (k ? STD.stops[k - 1] : 0) + 1, (k + 1 < STD.stops.length ? STD.stops[k + 1] : N) - 1);
      r.value = v; STD.stops[k] = v; $('#st-l' + k).textContent = 'T' + v; drawPlan(M, N, COL);
    };
    r.onchange = () => { savePlan(); renderStrategy(); };
  });
  drawPlan(M, N, COL);
}
function savePlan() { ST.plan = { circuit: STD.circuit, laps: STD.laps, seq: STD.seq.slice(), stops: STD.stops.slice() }; }
function drawPlan(M, N, COL) {
  const st = { seq: STD.seq, stops: STD.stops }, laps = lapsOfStrategy(st, M, N), total = laps.reduce((a, p) => a + p.t, 0);
  const dry = new Set(STD.seq).size, warn = N >= 5 && dry < 2 ? 'Règlement : il faut utiliser au moins deux types de pneus (sinon disqualification).' : '';
  $('#st-sum').innerHTML = `<span>Temps de course prévu</span><b>${fmtTotal(total).replace(/\.\d+$/, '')}</b><span>${STD.stops.length} arrêt${STD.stops.length > 1 ? 's' : ''} · ${STD.seq.join(' → ')}</span>${warn ? `<span class="warn">${warn}</span>` : ''}`;
  const cv = $('#st-chart'), dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 600, H = cv.clientHeight || 190;
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const ys = laps.map(p => p.t).filter((t, i) => !STD.stops.some(l => l + 1 === laps[i].l)).sort((a, b) => a - b);
  const lo = ys[0] - 0.3, hi = Math.max(ys[ys.length - 1], ys[0] + 2) + 0.4;
  const X = l => 34 + (W - 44) * (l - 1) / Math.max(1, N - 1), Y = t => 10 + (H - 30) * (1 - clamp((t - lo) / (hi - lo), 0, 1));
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px "JetBrains Mono", monospace';
  for (let k = 0; k <= 3; k++) { const t = lo + (hi - lo) * k / 3, y = Y(t); g.beginPath(); g.moveTo(34, y); g.lineTo(W - 8, y); g.stroke(); g.fillText(fmt(t).replace(/^\d+:/, ''), 0, y + 3); }
  g.fillText('T1', 34, H - 6); g.fillText('T' + N, W - 30, H - 6);
  g.lineWidth = 2.6;
  const outLap = l => STD.stops.some(x => x + 1 === l);   // tour de sortie des stands : non tracé
  for (let i = 1; i < laps.length; i++) { const a = laps[i - 1], b = laps[i]; if (STD.stops.includes(a.l) || outLap(a.l) || outLap(b.l)) continue; g.strokeStyle = COL[b.c]; g.beginPath(); g.moveTo(X(a.l), Y(a.t)); g.lineTo(X(b.l), Y(b.t)); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.8)'; STD.stops.forEach(l => g.fillRect(X(l + 0.5) - 1, 10, 2, H - 30));
  $('#st-legend').innerHTML = '<span>couleur = pneu · barre blanche = arrêt · le tour de sortie des stands (pneus froids + temps perdu) n’est pas tracé</span>';
}
function renderQuali() {
  const pole = ST.quali[0].best;
  const q = v => v == null ? '' : v >= 999 ? '<em>sans temps</em>' : fmt(v);
  $('#quali-title').textContent = `${CIRCUITS[ST.circuit].flag} Qualifications · ${CIRCUITS[ST.circuit].name}`;
  const noLap = r => r.entry.driver.name === ST.human && !r.mine;
  const rows = [...ST.quali.filter(r => !noLap(r)), ...ST.quali.filter(noLap)];
  const pole2 = rows[0].best;
  $('#quali-body').innerHTML = rows.map((r, k) => `
    <tr class="${k === 10 || k === 16 ? 'cut' : ''}">
      <td class="n">${k + 1}</td>
      <td${r.entry.driver.name === ST.human ? ' class="mine"' : ''}><i class="tb" style="background:${(r.entry.team.tv || r.entry.team.color)}"></i>${r.entry.driver.name}<small>${r.entry.team.name}</small></td>
      <td class="t">${noLap(r) ? '' : q(r.q1)}</td><td class="t">${noLap(r) ? '' : q(r.q2)}</td><td class="t">${noLap(r) ? '' : q(r.q3)}</td>
      <td class="t gap">${noLap(r) ? 'pas de tour' : k === 0 ? 'POLE' : r.best >= 999 ? '—' : '+' + (r.best - pole2).toFixed(3)}</td>
    </tr>`).join('');
  $('#btn-myq').hidden = !ST.human;
  const mine = ST.quali.find(r => r.entry.driver.name === ST.human);
  $('#myq-note').textContent = !ST.human ? '' : mine && mine.mine
    ? `Ton meilleur tour : ${fmt(mine.best)} · P${mine.pos}. Tu peux encore l'améliorer.`
    : `Sans tour de qualif, tu pars dernier (P${ST.quali.length}). Fais ton tour lancé pour gagner ta place sur la grille.`;
  renderStrategy();
}

/* =====================================================================
   SCÈNE 3D
   ===================================================================== */
let renderer, scene, camera, R = null, T = null, carObjs = [], scObj = null;
let HUM = null, follow = 0, camMode = 'auto', zoom = 1, paused = false, acc = 0, lastT = 0, evIdx = 0;
const CAM_MODES = [['auto', 'Réalisateur'], ['tv', 'TV'], ['fixed', 'Bord de piste'], ['heli', 'Hélico'], ['drone', 'Drone'], ['onboard', 'Embarquée'], ['map', 'Circuit']];
const SPEEDS = LITE ? [1, 2, 4, 8, 16, 32, 64] : [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];   // ralenti ×¼ ×½ (pas dans l'essai) … accéléré ×64
const spdLabel = v => v < 1 ? '×' + (v === 0.25 ? '¼' : '½') : '×' + v;

/* résolution adaptative : si le téléphone (GPU) n'arrive pas à suivre, on baisse la densité de pixels, puis on la remonte s'il y a de la marge */
const QUAL = {
  max: Math.min(2, window.devicePixelRatio || 1), k: null, acc: 0, n: 0, slow: 0, fast: 0,
  pr() { if (this.k == null) { let v = NaN; try { v = parseFloat(localStorage.getItem('paddock26-pr2')); } catch (e) { /* ignoré */ } this.k = v >= 1 && v <= this.max ? v : this.max; } return this.k; },
  frame(dt) {   // appelé à chaque image pendant la course (hors enregistrement vidéo)
    if (!renderer || HL.on || TLR.video || dt <= 0 || dt > 0.25) return;
    this.acc += dt; this.n++;
    if (this.acc < 1.5) return;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    if (avg > 0.024) { this.slow++; this.fast = 0; } else if (avg < 0.0145) { this.fast++; this.slow = 0; } else { this.slow = 0; this.fast = 0; }
    let k = this.pr();
    if (this.slow >= 1 && k > 1) k = Math.max(1, k - 0.25);
    else if (this.fast >= 5 && k < this.max) k = Math.min(this.max, k + 0.25);
    if (k !== this.k) { this.k = k; this.slow = this.fast = 0; renderer.setPixelRatio(k); resize(); try { localStorage.setItem('paddock26-pr2', k); } catch (e) { /* ignoré */ } }
  },
};
function initRenderer() {
  if (renderer) return;
  const cv = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(QUAL.pr());
  camera = new THREE.PerspectiveCamera(52, 1, 0.3, 9000);
  window.addEventListener('resize', resize);
  setupTouch(cv);
  setupDrivePointers(cv);
}
function resize() {
  if (!renderer) return;
  if (HL.on) { renderer.setSize(HL_W, HL_H, false); camera.aspect = HL_W / HL_H; camera.updateProjectionMatrix(); return; }
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; BASE_FOV = camera.fov = w < h ? 62 : 48; camera.updateProjectionMatrix();
  drawMinimapBase();
  placeCoast();
}

/* --- utilitaires géométrie --- */
function mergeGeos(list) {
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function box(w, h, d, x, y, z, taper) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (taper) {                           // rétrécit l'extrémité +x (taper>0) ou -x (taper<0)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sx = p.getX(i) * Math.sign(taper) > 0 ? Math.abs(taper) : 1;
      p.setY(i, p.getY(i) * sx - (sx < 1 ? h * (1 - sx) * 0.35 : 0)); p.setZ(i, p.getZ(i) * sx);
    }
  }
  g.translate(x, y, z); return g;
}

/* --- modèle de F1 2026 procédural --- */
const MAT = {};
function sharedMats() {
  if (MAT.k) return MAT;
  MAT.k = new THREE.MeshPhongMaterial({ color: 0x15171a, shininess: 40 });
  MAT.tyre = new THREE.MeshLambertMaterial({ color: 0x121212 });
  MAT.S = new THREE.MeshBasicMaterial({ color: 0xE8002D });
  MAT.M = new THREE.MeshBasicMaterial({ color: 0xFFD12E });
  MAT.H = new THREE.MeshBasicMaterial({ color: 0xF0F0EC });
  MAT.I = new THREE.MeshBasicMaterial({ color: 0x43B047 });
  MAT.W = new THREE.MeshBasicMaterial({ color: 0x1E7BFF });
  MAT.lightOn = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  MAT.lightOff = new THREE.MeshBasicMaterial({ color: 0x401010 });
  MAT.glow = new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.35, depthWrite: false });
  return MAT;
}
const GEO = {};
function carGeos() {
  if (GEO.c1) return GEO;
  GEO.c1 = mergeGeos([
    box(1.9, 0.5, 0.74, 0.55, 0.42, 0),                 // monocoque
    box(1.35, 0.24, 0.32, 1.95, 0.32, 0, 0.55),          // museau
    box(2.2, 0.56, 0.62, -0.6, 0.55, 0, -0.45),          // capot moteur
    box(1.55, 0.4, 0.42, -0.25, 0.38, 0.56, -0.5),       // pontons
    box(1.55, 0.4, 0.42, -0.25, 0.38, -0.56, -0.5),
    box(0.26, 0.04, 1.0, -2.52, 1.1, 0),                 // volet d'aileron (couleur)
  ]);
  GEO.c2 = mergeGeos([
    box(0.46, 0.04, 1.9, 2.55, 0.12, 0),                 // aileron avant
    box(0.3, 0.03, 1.72, 2.42, 0.2, 0),
    box(0.5, 0.36, 0.3, -0.1, 0.98, 0, -0.7),            // prise d'air
    box(2.7, 0.02, 0.2, -0.3, 0.84, 0),                  // bande
    box(0.34, 0.045, 1.0, -2.44, 0.95, 0),               // plan principal arrière
  ]);
  GEO.k = mergeGeos([
    box(4.5, 0.06, 1.46, -0.1, 0.08, 0),                 // fond plat
    box(0.52, 0.22, 0.03, 2.5, 0.2, 0.95), box(0.52, 0.22, 0.03, 2.5, 0.2, -0.95),
    box(0.72, 0.78, 0.03, -2.46, 0.72, 0.5), box(0.72, 0.78, 0.03, -2.46, 0.72, -0.5),
    box(0.3, 0.03, 0.9, -2.35, 0.46, 0),                 // beam wing
    box(0.05, 0.26, 0.05, 0.64, 0.84, 0),                // pilier du halo
    box(0.9, 0.05, 0.05, 1.3, 0.3, 0.45), box(0.9, 0.05, 0.05, 1.3, 0.3, -0.45),   // triangles de suspension
    box(0.9, 0.05, 0.05, -1.55, 0.3, 0.45), box(0.9, 0.05, 0.05, -1.55, 0.3, -0.45),
  ]);
  const halo = new THREE.TorusGeometry(0.3, 0.035, 6, 14, Math.PI);
  halo.rotateX(-Math.PI / 2); halo.rotateY(-Math.PI / 2); halo.translate(0.36, 0.96, 0);
  GEO.halo = halo;
  GEO.helmet = new THREE.SphereGeometry(0.15, 10, 8); GEO.helmet.translate(0.22, 0.86, 0);
  GEO.flap = box(0.24, 0.04, 1.0, 0, 0, 0);
  const wf = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 16); wf.rotateX(Math.PI / 2); GEO.wf = wf;
  const wr = new THREE.CylinderGeometry(0.36, 0.36, 0.4, 16); wr.rotateX(Math.PI / 2); GEO.wr = wr;
  GEO.band = new THREE.TorusGeometry(0.27, 0.025, 4, 18);
  GEO.light = box(0.05, 0.09, 0.14, 0, 0, 0);
  GEO.glow = new THREE.PlaneGeometry(6.4, 2.6); GEO.glow.rotateX(-Math.PI / 2);
  return GEO;
}
/* --- modèle F1.obj (converti par gen_model.py) --- */
function b64(str, Type) {
  const bin = atob(str), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}
let MODEL = null;
const teamGeo = new Map();
function loadModel() {
  if (MODEL) return MODEL;
  const P = b64(CAR_MODEL.p, Int16Array), Nn = b64(CAR_MODEL.n, Int8Array);
  const geo = (P, Nn) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(P, v => v / 1000), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Float32Array.from(Nn, v => v / 127), 3));
    return g;
  };
  MODEL = {
    chassis: geo(P, Nn), zones: b64(CAR_MODEL.z, Uint8Array),
    wheels: CAR_MODEL.wheels.map(w => ({ c: w.c, r: w.r, w: w.w, geo: geo(b64(w.p, Int16Array), b64(w.n, Int8Array)) })),
  };
  return MODEL;
}
function chassisFor(team) {
  const gk = team.name + team.color + (team.color2 || '');   // une écurie créée peut changer de couleurs
  if (teamGeo.has(gk)) return teamGeo.get(gk);
  const M = loadModel(), base = M.chassis;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
  const pal = [new THREE.Color(0x16181c), new THREE.Color(team.color), new THREE.Color(team.color2 || '#ffffff')];
  const col = new Float32Array(base.attributes.position.count * 3);
  for (let t = 0; t < M.zones.length; t++) { const c = pal[M.zones[t]]; for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (t * 3 + k) * 3); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  teamGeo.set(gk, g);
  return g;
}
function makeCar(team) {
  const M = sharedMats(), Mo = loadModel();
  MAT.body = MAT.body || new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x333333 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(chassisFor(team), MAT.body));
  const wheels = [];
  for (const w of Mo.wheels) {
    const grp = new THREE.Group(); grp.position.set(w.c[0], w.c[1], w.c[2]);
    const tyre = new THREE.Mesh(w.geo, M.tyre); grp.add(tyre);
    const band = new THREE.Mesh(new THREE.TorusGeometry(w.r * 0.74, 0.022, 4, 20), M.M);
    band.position.z = Math.sign(w.c[2]) * (w.w / 2 + 0.005); grp.add(band);
    grp.tyre = tyre; grp.band = band; grp.front = w.c[0] > 0;
    g.add(grp); wheels.push(grp);
  }
  const light = new THREE.Mesh(carGeos().light, M.lightOff); light.position.set(-2.62, 0.42, 0); g.add(light);
  const glow = new THREE.Mesh(carGeos().glow, M.glow); glow.position.y = 0.03; glow.visible = false; g.add(glow);
  g.userData = { wheels, light, glow, spinA: 0 };
  return g;
}
function makeSafetyCar() {
  const g = new THREE.Group();
  const body = new THREE.MeshPhongMaterial({ color: 0x0f5c4d, shininess: 80 });
  g.add(new THREE.Mesh(mergeGeos([box(4.6, 0.6, 1.95, 0, 0.55, 0), box(2.2, 0.5, 1.6, -0.3, 1.1, 0, -0.8)]), body));
  const bar = new THREE.Mesh(box(0.25, 0.1, 1.2, -0.2, 1.42, 0), new THREE.MeshBasicMaterial({ color: 0xff9a00 }));
  g.add(bar); g.userData.bar = bar;
  const w = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 12); w.rotateX(Math.PI / 2);
  for (const [x, z] of [[1.5, 0.9], [1.5, -0.9], [-1.5, 0.9], [-1.5, -0.9]]) { const m = new THREE.Mesh(w, sharedMats().tyre); m.position.set(x, 0.34, z); g.add(m); }
  return g;
}

/* --- textures procédurales --- */
function canvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
function asphaltTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#34373c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 40 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v + 2},${v + 5},.55)`; g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); }
    g.fillStyle = 'rgba(15,15,18,.35)'; g.fillRect(w * 0.42, 0, w * 0.16, h);   // gomme sur la trajectoire
  });
}
function kerbTex() {
  return canvasTex(32, 128, (g, w, h) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#d7141a'; g.fillRect(0, 0, w, h / 2); });
}

/* --- rubans le long de la piste --- */
function ribbon(Tk, dA, dB, y, mat, opts = {}) {
  const pos = [], uv = [], col = [], step = opts.step || 1, N = Tk.N;
  const P = (i, d) => { const j = ((i % N) + N) % N; return [Tk.x[j] + Tk.nx[j] * d, Tk.y[j] + Tk.ny[j] * d]; };
  const dv = typeof dA === 'function' ? dA : () => dA, dw = typeof dB === 'function' ? dB : () => dB;
  const i0 = opts.from || 0, i1 = opts.to || N;
  for (let i = i0; i < i1; i += step) {
    const j = i + step;
    if (opts.filter && !opts.filter(((i % N) + N) % N)) continue;
    const a0 = P(i, dv(i)), a1 = P(i, dw(i)), b0 = P(j, dv(j)), b1 = P(j, dw(j));
    const v0 = i * Tk.ds / (opts.vLen || 10), v1 = j * Tk.ds / (opts.vLen || 10);
    const quad = [[a0, 0, v0], [a1, 1, v0], [b1, 1, v1], [a0, 0, v0], [b1, 1, v1], [b0, 0, v1]];
    for (const [p, u, v] of quad) { pos.push(p[0], y, -p[1]); uv.push(u, v); }
    if (opts.color) { const c = opts.color(((i % N) + N) % N); for (let k = 0; k < 6; k++) col.push(c[0], c[1], c[2]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (opts.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  mat.side = THREE.DoubleSide;
  return new THREE.Mesh(g, mat);
}
function wallMesh(Tk, d, h, mat, filter) {
  const pos = [], N = Tk.N, step = 2;
  for (let i = 0; i < N; i += step) {
    if (filter && !filter(i)) continue;
    const j = (i + step) % N;
    const a = [Tk.x[i] + Tk.nx[i] * d, Tk.y[i] + Tk.ny[i] * d], b = [Tk.x[j] + Tk.nx[j] * d, Tk.y[j] + Tk.ny[j] * d];
    pos.push(a[0], 0, -a[1], a[0], h, -a[1], b[0], h, -b[1], a[0], 0, -a[1], b[0], h, -b[1], b[0], 0, -b[1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/* Grille de proximité : évite de dessiner murs / dégagements sur une autre portion de piste */
function proximity(Tk) {
  const cell = 25, grid = new Map(), key = (x, y) => (Math.floor(x / cell)) + ',' + (Math.floor(y / cell));
  for (let i = 0; i < Tk.N; i++) { const k = key(Tk.x[i], Tk.y[i]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  return (i, d, rad) => {
    const x = Tk.x[i] + Tk.nx[i] * d, y = Tk.y[i] + Tk.ny[i] * d;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const L = grid.get((cx + a) + ',' + (cy + b)); if (!L) continue;
      for (const j of L) {
        const di = Math.min(Math.abs(j - i), Tk.N - Math.abs(j - i)) * Tk.ds;
        if (di < 60) continue;
        if (Math.hypot(Tk.x[j] - x, Tk.y[j] - y) < rad) return true;
      }
    }
    return false;
  };
}

function buildScene() {
  if (scene) scene.traverse(o => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); });
  scene = new THREE.Scene();
  const circ = T.circ, night = NIGHT.has(circ.id), desert = DESERT.has(circ.id);
  const sky = night ? 0x0a0f24 : 0x9cc3e4;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 350, night ? 1600 : 2400);
  WX.sky = new THREE.Color(sky); WX.skyWet = new THREE.Color(night ? 0x0b0e14 : 0x7a838d);
  WX.far = night ? 1600 : 2400;
  scene.add(new THREE.HemisphereLight(night ? 0x8fa6ff : 0xdfefff, night ? 0x202018 : 0x5a5540, night ? 0.75 : 0.85));
  const sun = new THREE.DirectionalLight(night ? 0xfff2dd : 0xffffff, night ? 0.75 : 0.95); sun.position.set(300, 600, 200); scene.add(sun);
  WX.sun = sun; WX.sunI = sun.intensity;
  scene.add(new THREE.AmbientLight(0xffffff, night ? 0.25 : 0.2));

  // sol
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < T.N; i++) { x0 = Math.min(x0, T.x[i]); x1 = Math.max(x1, T.x[i]); y0 = Math.min(y0, T.y[i]); y1 = Math.max(y1, T.y[i]); }
  T.bbox = { x0, x1, y0, y1 };
  const groundCol = T.street ? 0x4a4d52 : desert ? (night ? 0x7a6448 : 0xc2a574) : (night ? 0x24401f : 0x4f7d3c);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 3000, y1 - y0 + 3000), new THREE.MeshLambertMaterial({ color: groundCol }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, -0.05, -(y0 + y1) / 2); scene.add(ground);

  const near = proximity(T), hw = T.w / 2;
  // zones de virage (vibreurs, graviers)
  const corner = new Uint8Array(T.N);
  for (let i = 0; i < T.N; i++) if (Math.abs(T.kRL[i]) > 1 / 260) for (let u = -6; u <= 6; u++) corner[(i + u + T.N) % T.N] = 1;

  // dégagements
  if (!T.street) {
    const sand = desert ? [0.78, 0.66, 0.46] : [0.80, 0.70, 0.50], run = [0.45, 0.47, 0.5], grass = desert ? [0.72, 0.6, 0.42] : [0.33, 0.52, 0.27];
    const rmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const side of [1, -1]) {
      scene.add(ribbon(T, side * (hw + 1.2), side * (hw + 15), 0.0, rmat, {
        step: 2, filter: i => !near(i, side * (hw + 12), hw + 4),
        color: i => corner[i] ? (T.kRL[i] * side < 0 ? sand : run) : grass,
      }));
    }
  }
  // piste
  const atex = asphaltTex(); atex.repeat.set(1, 1);
  WX.track = new THREE.MeshPhongMaterial({ map: atex, specular: 0x000000, shininess: 30 });
  scene.add(ribbon(T, -hw, hw, 0.02, WX.track, { vLen: T.w }));
  // lignes blanches
  const white = new THREE.MeshBasicMaterial({ color: 0xe9ecef });
  scene.add(ribbon(T, hw - 0.45, hw - 0.2, 0.035, white, { step: 2 }), ribbon(T, -hw + 0.2, -hw + 0.45, 0.035, white, { step: 2 }));
  // vibreurs
  const ktex = kerbTex();
  const kmat = new THREE.MeshLambertMaterial({ map: ktex });
  scene.add(ribbon(T, hw - 0.1, hw + 1.2, 0.04, kmat, { filter: i => corner[i], vLen: 2.4 }));
  scene.add(ribbon(T, -hw - 1.2, -hw + 0.1, 0.04, kmat, { filter: i => corner[i], vLen: 2.4 }));
  // murs
  const wallMat = new THREE.MeshLambertMaterial({ color: T.street ? 0xc9ccd1 : 0x2a4f8f, side: THREE.DoubleSide });
  const wd = T.street ? hw + 1.8 : hw + 17;
  for (const side of [1, -1]) scene.add(wallMesh(T, side * wd, T.street ? 1.1 : 0.9, wallMat, i => !near(i, side * wd, hw + 3) && !(inPitZone(i) && side === T.pitSide)));

  // voie des stands, muret, garages
  const pitMat = new THREE.MeshLambertMaterial({ color: 0x3d4046 });
  const iIn = Math.round(T.pitIn / T.ds), nPit = Math.round(T.pitLen / T.ds);
  const pitD = i => { const ps = ((i - iIn + T.N) % T.N) * T.ds; return pitPathD(ps); };
  scene.add(ribbon(T, i => pitD(i) - 5 * T.pitSide, i => pitD(i) + 5 * T.pitSide, 0.015, pitMat, { from: iIn, to: iIn + nPit }));
  const pw = new THREE.MeshLambertMaterial({ color: 0xdadde2, side: THREE.DoubleSide });
  scene.add(wallMesh(T, T.pitSide * (hw + 2.4), 1.1, pw, i => { const ps = ((i - iIn + T.N) % T.N) * T.ds; return ps > 120 && ps < T.pitLen - 120; }));
  const garMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  R.teamOrder.forEach((name, k) => {
    const team = R.cars.find(c => c.team.name === name).team;
    const s = T.pitIn + 170 + k * 18;
    const p = SIM.worldPos(T, s, T.pitD + T.pitSide * 11);
    const gar = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 13), garMat);
    gar.position.set(p.x, 2.5, -p.y); gar.rotation.y = p.h; scene.add(gar);
    const band = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.2, 13.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(team.color) }));
    band.position.set(p.x, 4.6, -p.y); band.rotation.y = p.h; scene.add(band);
  });
  // tribunes face aux stands
  const standMat = new THREE.MeshLambertMaterial({ color: 0x6d7580 });
  for (let s = -260; s <= 200; s += 46) {
    const i = SIM.idxOf(T, s);
    if (near(i, -T.pitSide * (hw + 24), hw + 8)) continue;
    const p = SIM.worldPos(T, s, -T.pitSide * (hw + (T.street ? 8 : 22)));
    const st = new THREE.Mesh(new THREE.BoxGeometry(42, 9, 10), standMat);
    st.position.set(p.x, 4.5, -p.y); st.rotation.y = p.h; scene.add(st);
  }
  // ligne de départ en damier + emplacements de grille
  const chk = canvasTex(64, 8, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 4, y * 4, 4, 4); } });
  const p0 = SIM.worldPos(T, 0, 0);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, T.w), new THREE.MeshBasicMaterial({ map: chk }));
  line.rotation.x = -Math.PI / 2; line.rotation.z = p0.h; line.position.set(p0.x, 0.045, -p0.y); scene.add(line);
  const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  R.cars.forEach(c => {
    const s = -(7 + 8 * c.id) + 2.9, p = SIM.worldPos(T, s, c.id % 2 === 0 ? (T.csign[0] || 1) * Math.min(3.3, T.lim - 0.5) : -(T.csign[0] || 1) * Math.min(3.3, T.lim - 0.5));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.2), gridMat); m.rotation.x = -Math.PI / 2; m.rotation.z = p.h; m.position.set(p.x, 0.045, -p.y); scene.add(m);
  });

  // zones de freinage (aide visuelle quand le joueur pilote, sauf en Légende)
  if (HUM && R.level && R.level.cues) {
    const bz = new Uint8Array(T.N);
    for (let i = 0; i < T.N; i++) if (T.brk[i] && T.env[i] < T.vc[i] - 2) bz[i] = 1;
    const rl = i => T.alpha[((i % T.N) + T.N) % T.N];
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.55, depthWrite: false });
    scene.add(ribbon(T, i => rl(i) - 1.1, i => rl(i) + 1.1, 0.05, red, { filter: i => bz[i] }));
    // panneaux 150 / 100 / 50 m avant chaque début de freinage
    const boardMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), stripe = new THREE.MeshBasicMaterial({ color: 0xe10600 });
    for (let i = 0; i < T.N; i++) {
      const p = (i - 1 + T.N) % T.N;
      if (!bz[i] || bz[p]) continue;
      const s0 = i * T.ds;
      // barre de début de freinage en travers de la trajectoire
      const q = SIM.worldPos(T, s0, rl(i));
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.2), boardMat);
      bar.rotation.x = -Math.PI / 2; bar.rotation.z = q.h; bar.position.set(q.x, 0.06, -q.y); scene.add(bar);
      const side = -(T.csign[i] || 1);   // panneaux à l'extérieur du virage
      [150, 100, 50].forEach((dm, k) => {
        const b = SIM.worldPos(T, s0 - dm, side * (T.w / 2 + 2.2));
        const g = new THREE.Group(); g.position.set(b.x, 0, -b.y); g.rotation.y = b.h + Math.PI / 2;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), boardMat); post.position.y = 0.8; g.add(post);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.06), boardMat); panel.position.y = 1.9; g.add(panel);
        for (let n = 0; n <= k; n++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.14, 0.08), stripe); st.position.y = 1.62 + n * 0.25; g.add(st); }
        scene.add(g);
      });
    }
  }
  // voitures
  carObjs = R.cars.map(c => { const o = makeCar(c.team); scene.add(o); return o; });
  scObj = makeSafetyCar(); scObj.visible = false; scene.add(scObj);
  buildRain();
  sprays = R.cars.map(() => { const sp = new THREE.Sprite(sprayMat()); sp.visible = false; scene.add(sp); return sp; });
}

/* ---------------- pluie : gouttes, gerbes d'eau, piste mouillée ---------------- */
const WX = {};
let rainFx = null, rainPos = null, sprays = [], sprayM = null;
const RAIN_N = 2400;
function buildRain() {
  const g = new THREE.BufferGeometry();
  rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) {
    const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60;
    rainPos.set([x, y, z, x + 0.05, y + 0.9, z + 0.05], i * 6);
  }
  g.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainFx = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xdfe8f2, transparent: true, opacity: 0.6, depthWrite: false }));
  rainFx.frustumCulled = false; rainFx.visible = false;
  scene.add(rainFx);
}
function sprayMat() {
  if (!sprayM) {
    const tex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(235,240,245,.9)'); gr.addColorStop(1, 'rgba(235,240,245,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    sprayM = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 });
  }
  return sprayM.clone();
}
function updateWeatherFx(dt) {
  const rain = R.wx ? R.wx.rain : 0, wet = R.wet || 0;
  // ciel, brouillard, lumière
  scene.background.copy(WX.sky).lerp(WX.skyWet, Math.min(1, rain * 1.2));
  scene.fog.color.copy(scene.background);
  scene.fog.far = WX.far * (1 - 0.7 * rain); scene.fog.near = 350 * (1 - 0.8 * rain);
  if (effCam() === 'map') { scene.fog.far = 1e6; scene.fog.near = 1e6; }   // vue circuit : pas de brouillard
  WX.sun.intensity = WX.sunI * (1 - 0.45 * rain);
  // asphalte qui brille quand il est mouillé
  const k = 1 - 0.38 * wet; WX.track.color.setRGB(k, k, k * 1.02);
  WX.track.specular.setScalar(0.45 * wet); WX.track.shininess = 30 + 70 * wet;
  // gouttes autour de la caméra
  rainFx.visible = rain > 0.03;
  if (rainFx.visible) {
    const n = Math.floor(RAIN_N * Math.min(1, rain * 1.1));
    rainFx.geometry.setDrawRange(0, n * 2);
    const fall = 16 * dt;
    for (let i = 0; i < n; i++) {
      const o = i * 6; let y = rainPos[o + 1] - fall;
      if (y < -1) y += 31;
      rainPos[o + 1] = y; rainPos[o + 4] = y + 0.9;
    }
    rainFx.geometry.attributes.position.needsUpdate = true;
    rainFx.position.set(camera.position.x, camera.position.y - 14, camera.position.z);
  }
  // gerbes d'eau derrière les voitures
  R.cars.forEach((c, i) => {
    const sp = sprays[i];
    const show = wet > 0.08 && !c.gone && c.v > 8 && c.state !== 'pit';
    sp.visible = show; if (!show) return;
    const p = carPose(c), fx = Math.cos(p.h), fz = -Math.sin(p.h);
    sp.position.set(p.x - fx * (3.2 + c.v * 0.02), 0.8, -p.y - fz * (3.2 + c.v * 0.02));
    const sc = (2.5 + c.v * 0.07) * (0.5 + wet);
    sp.scale.set(sc * 1.4, sc * 0.7, 1);
    sp.material.opacity = Math.min(0.75, wet * 0.95) * Math.min(1, c.v / 50);
  });
}
function inPitZone(i) { const ps = ((i * T.ds - T.pitIn) % T.L + T.L) % T.L; return ps < T.pitLen; }
function pitPathD(ps) {    // même tracé que la logique des stands
  const edge = T.pitSide * (T.lim + 0.3);
  if (ps < 110) return edge + (T.pitD - edge) * clamp((ps - 10) / 100, 0, 1);
  if (ps > T.pitLen - 110) return T.pitD + (edge - T.pitD) * clamp((ps - (T.pitLen - 110)) / 100, 0, 1);
  return T.pitD;
}

/* =====================================================================
   COURSE
   ===================================================================== */
function startRace() {
  if (!CH.pending) freeClamp(ST);
  const circ = CIRCUITS[ST.circuit];
  T = getTrack(ST.circuit);
  const qres = (ST.quali || SIM.qualifying(getTrack(ST.circuit, true), activeTeams().flatMap(t => t.drivers.map(d => ({ team: t, driver: d }))), startWet(), qPace(), ST.human));
  // sans tour de qualif réalisé par le joueur, il part dernier
  const noLap = r => r.entry.driver.name === ST.human && !r.mine;
  const grid = [...qres.filter(r => !noLap(r)), ...qres.filter(noLap)].map(r => r.entry);
  const hIdx = ST.human ? grid.findIndex(e => e.driver.name === ST.human) : -1;
  R = SIM.createRace(T, grid, { laps: lapsFor(circ), wearMode: ST.wear, chaos: ST.chaos, human: hIdx >= 0 ? hIdx : null, assist: ST.assist, weather: ST.weather, level: levelOf(ST), noDnf: ST.noDnf, dmgLite: ST.dmgLite, colEvery: RULE_N.col[ST.colRule] || 0 });
  initAudio();
  follow = hIdx >= 0 ? hIdx : R.cars[0].id;
  HUM = hIdx >= 0 ? R.cars[hIdx] : null;
  // stratégie choisie dans le simulateur : pneu de départ et arrêts prévus
  const plan = ST.plan && ST.plan.circuit === circ.id && ST.plan.laps === R.laps && R.wet < 0.2 ? ST.plan : null;
  if (HUM && plan) { HUM.tyre = plan.seq[0]; HUM.usedComps = new Set([plan.seq[0]]); HUM.myPlan = plan.stops.map((l, k) => ({ lap: l, comp: plan.seq[k + 1] })); }
  recStart();
  R.hlCtx = hlContext(qres);
  enterView(circ);
}
function startQualiRun() {
  const circ = CIRCUITS[ST.circuit];
  T = getTrack(ST.circuit, true);
  const entry = activeTeams().flatMap(t => t.drivers.map(d => ({ team: t, driver: d }))).find(e => e.driver.name === ST.human);
  if (!entry) return;
  R = SIM.createQualiRun(T, entry, { assist: ST.assist, weather: ST.weather, level: levelOf(ST), noDnf: ST.noDnf });
  R.recGhost = true;
  initAudio();
  follow = 0; HUM = R.cars[0];
  // fantôme du poleman (hors joueur)
  const p1 = ST.quali.filter(r => r.entry.driver.name !== ST.human)[0];
  if (!ST.qGhost || ST.qGhost.src !== p1) {
    const g = SIM.ghostLap(T, p1.entry, p1.gn, p1.wet, p1.best, p1.gk);
    ST.qGhost = g && Object.assign(g, { src: p1, label: 'P1 · ' + p1.entry.driver.name, team: p1.entry.team });
  }
  GH = ST.qGhost;
  enterView(circ);
  initSectors('q');
}
/* ---------------- contre-la-montre ---------------- */
let recCache = null, recCacheT = 0;
function loadRecordCached() { if (performance.now() - recCacheT > 1000) { recCache = loadRecord(T.circ.id); recCacheT = performance.now(); } return recCache; }
const ENG_SFX = () => ST.engine === 'ice' ? '-ice' : '';   // records séparés : hybride / 100 % thermique
const recKey = id => 'paddock26-tt-' + id + ENG_SFX();
function loadRecord(id) { try { return JSON.parse(localStorage.getItem(recKey(id)) || 'null'); } catch (e) { return null; } }
function saveRecord(id, rec) { try { localStorage.setItem(recKey(id), JSON.stringify(rec)); return true; } catch (e) { return false; } }
/* records faits avant la nouvelle physique (v1.48) : effacés une seule fois */
try {
  if (!localStorage.getItem('paddock26-ttphys')) {
    const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^paddock26-tt(sec)?-/.test(k)) ks.push(k); }
    ks.forEach(k => localStorage.removeItem(k)); localStorage.setItem('paddock26-ttphys', '1.48');
  }
} catch (e) { /* stockage indisponible */ }
function resetRecords() {
  try { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^paddock26-(tt(sec)?-|marathon(-ice)?$)/.test(k)) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignoré */ }
}
/* ---- marathon : les 24 circuits enchaînés, un tour lancé chacun, temps cumulé ---- */
const MAR = { on: false, i: 0, times: [], pen: 0 };
const marKey = () => 'paddock26-marathon' + ENG_SFX();
function loadMarathon() { try { return JSON.parse(localStorage.getItem(marKey()) || 'null'); } catch (e) { return null; } }
function startMarathon() {
  if (!PRO) { openPro(); return; }
  Object.assign(MAR, { on: true, i: 0, times: [], pen: 0, prev: ST.circuit });
  $('#mres').hidden = true;
  ST.circuit = 0; startTimeTrial();
}
function marathonLap(lap) {
  const offs = lap.offs || 0, t = lap.time + offs;
  MAR.times.push({ id: T.circ.id, t, valid: !offs });
  const sum = MAR.times.reduce((a, x) => a + x.t, 0) + MAR.pen;
  toast({ type: 'tt', msg: `${T.circ.name} : ${fmt(lap.time)}${offs ? ` + ${offs} s (limites de piste)` : ''} · total ${fmtTotal(sum)}`, cars: [] });
  MAR.i++;
  if (MAR.i >= CAL.length) { finishMarathon(); return; }
  // sans s'arrêter : on passe la ligne du circuit suivant à la même vitesse
  const fly = { v: HUM.v, d: HUM.d }, input = Object.assign({}, R.input);
  ST.circuit = MAR.i; KEEP_INPUT = true;
  try { startTimeTrial(fly); } finally { KEEP_INPUT = false; }
  Object.assign(R.input, input);   // gaz, frein, direction et mode ERS conservés
  $('#btn-ers').innerHTML = '<small>ERS</small>' + ({ normal: 'NORMAL', attack: 'ATTAQUE', charge: 'RECHARGE' })[R.input.ers]; $('#btn-ers').className = R.input.ers;
}
function finishMarathon() {
  MAR.on = false;
  const total = MAR.times.reduce((a, x) => a + x.t, 0) + MAR.pen, best = loadMarathon();
  const better = !best || total < best.total;
  if (better) try { localStorage.setItem(marKey(), JSON.stringify({ total, times: MAR.times, pen: MAR.pen, driver: HUM ? HUM.driver.name : '', date: new Date().toISOString().slice(0, 10) })); } catch (e) { /* ignoré */ }
  R.over = true; R.resultsShown = true; paused = true;
  $('#mres-body').innerHTML = `<b>${fmtTotal(total)}</b><span>${better ? (best ? `Nouveau record ! (${(total - best.total).toFixed(3)} s)` : 'Premier marathon bouclé !') : `Record : ${fmtTotal(best.total)} (+${(total - best.total).toFixed(3)} s)`}${MAR.pen ? ` · dont ${MAR.pen} s de pénalité (sorties)` : ''}</span>`
    + `<ol class="mlist">${MAR.times.map(x => { const c = CIRCUITS.find(k => k.id === x.id); return `<li><span>${c.flag} ${c.name}</span><em class="${x.valid ? '' : 'bad'}">${fmt(x.t)}</em></li>`; }).join('')}</ol>`;
  $('#mres').hidden = false;
}
/* temps total du contre-la-montre : somme des records des 24 circuits */
function ttTotal() {
  const recs = CAL.map(c => loadRecord(c.id)).filter(r => r && r.time > 0);
  return { n: recs.length, sum: recs.reduce((a, r) => a + r.time, 0) };
}
function fmtTotal(t) {
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = (t % 60).toFixed(3).padStart(6, '0');
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + sec;
}
function renderTTTotal() {
  const { n, sum } = ttTotal(), N = CAL.length;
  $('#home-tt').textContent = n ? `Records sur ${n}/${N} circuits · total ${fmtTotal(sum)}` : 'Tours lancés seul en piste, records et fantôme.';
  const mb = loadMarathon();
  $('#mar-rec').textContent = mb ? `Record : ${fmtTotal(mb.total)} (${mb.date})` : 'Pas encore de marathon bouclé.';
  $('#tt-total').innerHTML = `<small>Contre-la-montre${ST.engine === 'ice' ? ' 100 % thermique' : ' hybride'} · temps total ${N} circuits</small>`
    + `<b>${n ? fmtTotal(sum) : '—'}</b>`
    + `<span>${n === N ? 'Tous les circuits sont bouclés : améliore tes records pour faire baisser le total.' : `${n}/${N} circuits avec un record — il en manque ${N - n} pour le total complet${n ? ' (total partiel)' : ''}.`}</span>`;
}
function startTimeTrial(flying) {
  freeClamp(ST);
  const circ = CIRCUITS[ST.circuit];
  T = getTrack(ST.circuit, true);
  const all = ST.teams.flatMap(t => t.drivers.map(d => ({ team: t, driver: d })));
  const entry = all.find(e => e.driver.name === ST.human) || all[0];
  R = SIM.createTimeTrial(T, entry, { assist: ST.assist, level: levelOf(ST), noDnf: ST.noDnf, flying: MAR.on ? flying : null });
  if (MAR.on) R.ttNoInvalid = true;   // marathon : une sortie de piste coûte 1 s, le tour n'est pas annulé
  initAudio();
  follow = 0; HUM = R.cars[0];
  const rec = loadRecord(circ.id);
  GH = rec ? { time: rec.time, samples: rec.samples, label: 'Record', team: entry.team } : null;
  ttSeen = 0;
  enterView(circ);
  $('#btn-ttrp').hidden = MAR.on || !(TLR.neu && TLR.circ === circ.id && TLR.eng === ST.engine);
  initSectors('tt');
  if (MAR.on) toast({ type: 'tt', msg: `Marathon · circuit ${MAR.i + 1}/${CAL.length} : ${circ.flag} ${circ.name}`, cars: [] });
  else if (rec) toast({ type: 'tt', msg: `Record à battre : ${fmt(rec.time)} (${rec.driver}, ${rec.level})`, cars: [] });
}
let GH = null, ttSeen = 0, ghostObj = null;
/* replay du dernier tour valide (contre-la-montre) : la voiture rejoue le tour, l'ancien record en fantôme */
const TLR = { on: false, circ: null, neu: null, old: null, t: 0 };
function startTTReplay() {
  if (!TLR.neu || !R || !R.tt) return;
  TLR.on = true; TLR.t = 0; TLR.ended = false;
  $('#btn-ttrp').hidden = true; $('#ttrpbar').hidden = false;
  const d = TLR.old ? TLR.neu.time - TLR.old.time : null;
  $('#ttrp-txt').textContent = `REPLAY ${fmt(TLR.neu.time)}` + (d != null ? ` · ${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(3)} sur ${TLR.rec ? "l'ancien record" : 'le record'} (fantôme)` : '');
  camInit = false;
}
/* vidéo du tour record (9:16, comme les highlights) : le tour, l'ancien record en fantôme, chrono et écart en direct */
function startTTVideo() {
  if (!TLR.neu || !R || !R.tt) return;
  if (!TLR.on) startTTReplay();
  if (!HL.cv) { HL.cv = $('#hl'); HL.cv.width = HL_W; HL.cv.height = HL_H; HL.g = HL.cv.getContext('2d'); }
  Object.assign(TLR, { video: true, vdone: false, ended: false, endT: 0, t: 0, cam0: camMode, sec: null });
  document.body.classList.add('hl');
  renderer.setPixelRatio(1); renderer.setSize(HL_W, HL_H, false);
  camera.aspect = HL_W / HL_H; BASE_FOV = camera.fov = 60; camera.updateProjectionMatrix();
  camMode = 'tv'; camInit = false; paused = false;
  $('#hl-ui').hidden = false; $('#hl-ui').classList.remove('fade'); $('#hl-rec').hidden = true; $('#hl-share').hidden = true;
  if (expOk()) expStart(); else hlRecordStart();
  if (HL.recording) $('#hl-status').textContent = 'Enregistrement de la vidéo… laisse défiler jusqu’au bout';
}
function closeTTVideo() {
  if (!TLR.video) return;
  if (HL.recording) hlRecordStop(true);
  TLR.video = false;
  document.body.classList.remove('hl'); $('#hl-ui').hidden = true; $('#hl-rec').hidden = false;
  renderer.setPixelRatio(QUAL.pr()); resize();
  camMode = TLR.cam0 || camMode; camInit = false;
}
/* mise en page « safe zone » TikTok (720x1280) : rien d'important en haut (onglets/recherche, y < 150),
   en bas (légende/musique, y > 940) ni à droite sous les boutons like/commentaire (x > 620, y > 500) */
const TTV = { x0: 40, x1: 620, y0: 150, y1: 940, cx: 330 };
function ttSectors() {
  const n = TLR.neu, o = TLR.old, L = T.L;
  return [1, 2, 3].map(k => {
    const at = (g) => !g ? null : k === 3 ? g.time : ghostTimeAtDist(g, L * k / 3);
    const p = (g) => !g ? null : k === 1 ? 0 : ghostTimeAtDist(g, L * (k - 1) / 3);
    const tn = at(n), pn = p(n), to = at(o), po = p(o);
    return { dist: L * k / 3, at: tn, n: tn != null && pn != null ? tn - pn : null, o: to != null && po != null ? to - po : null };
  });
}
function ttCompose() {
  const g = HL.g, W = HL_W, H = HL_H, n = TLR.neu, o = TLR.old, Z = TTV;
  g.drawImage(renderer.domElement, 0, 0, W, H);
  if (!TLR.sec) TLR.sec = ttSectors();
  let gr = g.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 480);
  gr = g.createLinearGradient(0, 760, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.8)'); g.fillStyle = gr; g.fillRect(0, 760, W, H - 760);
  const fin = TLR.ended, t = fin ? n.time : Math.min(TLR.t, n.time), cx = W / 2;
  g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  // en-tête : marque + circuit, barre de progression du tour
  g.font = `900 24px ${HF.t}`; const bw = g.measureText('PADDOCK 26').width, bx = cx - bw / 2;
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText('PADDOCK', bx, Z.y0 + 22); g.fillStyle = '#e10600'; g.fillText('26', bx + g.measureText('PADDOCK ').width, Z.y0 + 22);
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `700 26px ${HF.t}`;
  g.fillText(`${T.circ.flag || ''} ${tr(T.circ.name).toUpperCase()} · ${SIM.engine === 'ice' ? '100 % THERMIQUE' : 'CONTRE-LA-MONTRE'}`.trim(), cx, Z.y0 + 56, W - 2 * Z.x0);
  const pw = W - 2 * 60, prog = fin ? 1 : Math.max(0, Math.min(1, HUM.dist / T.L));
  hlBox(g, 60, Z.y0 + 72, pw, 6, 'rgba(255,255,255,.25)', 3); hlBox(g, 60, Z.y0 + 72, pw * prog, 6, '#e10600', 3);
  for (let k = 1; k < 3; k++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(60 + pw * k / 3 - 1, Z.y0 + 68, 2, 14); }
  // chrono géant + écart sur l'ancien record
  g.font = `800 76px ${HF.m}`; const ct = fmt(t), cw = g.measureText(ct).width + 44;
  hlBox(g, cx - cw / 2, Z.y0 + 96, cw, 92, 'rgba(10,12,16,.82)', 14); g.fillStyle = '#fff'; g.fillText(ct, cx, Z.y0 + 168);
  let dd = null;
  if (o) { const ref = ghostTimeAtDist(o, HUM.dist); dd = fin ? n.time - o.time : ref == null ? null : t - ref; }
  if (dd != null) {
    const sc = TLR.sec, last = sc.filter(s => s.at != null && t >= s.at).pop(), pop = last ? Math.max(0, 1 - (t - last.at) / 0.35) : 0;
    g.save(); g.translate(cx, Z.y0 + 228); g.scale(1 + pop * 0.25, 1 + pop * 0.25);
    g.font = `800 42px ${HF.m}`; const dt = (dd <= 0 ? '−' : '+') + Math.abs(dd).toFixed(2) + ' s', dw = g.measureText(dt).width + 36;
    hlBox(g, -dw / 2, -26, dw, 56, dd <= 0 ? '#1f9d55' : '#c62828', 12); g.fillStyle = '#fff'; g.fillText(dt, 0, 16);
    g.restore();
  }
  // secteurs : violet = mieux que l'ancien record, jaune = moins bien
  const chW = 170, chX = cx - (chW * 3 + 20) / 2, chY = Z.y0 + (dd != null ? 272 : 210);
  TLR.sec.forEach((s, i) => {
    const x = chX + i * (chW + 10), done = s.at != null && t >= s.at, better = done && s.o != null && s.n != null && s.n <= s.o;
    hlBox(g, x, chY, chW, 46, !done ? 'rgba(10,12,16,.6)' : s.o == null ? 'rgba(10,12,16,.85)' : better ? '#8e2bd9' : '#c9a400', 10);
    g.fillStyle = '#fff'; g.font = `700 20px ${HF.t}`; g.textAlign = 'left'; g.fillText('S' + (i + 1), x + 12, chY + 30);
    g.textAlign = 'right'; g.font = `800 22px ${HF.m}`;
    g.fillText(!done || s.n == null ? '—' : s.o != null ? `${s.n <= s.o ? '−' : '+'}${Math.abs(s.n - s.o).toFixed(2)}` : s.n.toFixed(2), x + chW - 12, chY + 31);
  });
  g.textAlign = 'left';
  // pilote + vitesse, au-dessus de la légende TikTok et à gauche des boutons
  g.fillStyle = tcol(HUM); g.fillRect(Z.x0, Z.y1 - 98, 10, 90);
  g.fillStyle = '#fff'; g.font = `900 50px ${HF.t}`; g.fillText(HUM.driver.name.split(' ').slice(-1)[0].toUpperCase(), Z.x0 + 24, Z.y1 - 44, 340);
  g.font = `600 22px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText(HUM.team.name, Z.x0 + 24, Z.y1 - 14, 340);
  g.textAlign = 'right'; g.font = `700 60px ${HF.m}`; g.fillStyle = '#fff'; g.fillText(Math.round(HUM.v * 3.6), Z.x1 - 10, Z.y1 - 40);
  g.font = `700 20px ${HF.m}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('KM/H', Z.x1 - 10, Z.y1 - 14); g.textAlign = 'center';
  // accroche d'ouverture (les 2 premières secondes décident si on scrolle)
  if (TLR.t < 2.8) {
    g.save(); g.globalAlpha = Math.min(1, (2.8 - TLR.t) / 0.35); const y = 560;
    g.font = `900 66px ${HF.t}`; const h1 = o ? 'RECORD À BATTRE' : 'TOUR PARFAIT ?', w1 = g.measureText(h1).width + 48;
    g.fillStyle = '#e10600'; g.fillRect(Z.cx - w1 / 2, y, w1, 86); g.fillStyle = '#fff'; g.fillText(h1, Z.cx, y + 66);
    if (o) { g.font = `800 56px ${HF.m}`; const w2 = g.measureText(fmt(o.time)).width + 48; g.fillStyle = 'rgba(10,12,16,.9)'; g.fillRect(Z.cx - w2 / 2, y + 92, w2, 76); g.fillStyle = '#fff'; g.fillText(fmt(o.time), Z.cx, y + 150); }
    g.font = `800 32px ${HF.t}`; g.fillStyle = '#ffd400'; g.fillText('ATTENDS LA FIN… 👀', Z.cx, y + (o ? 216 : 136));
    g.restore();
  }
  // suspense dans les derniers mètres
  if (!fin && o && T.L - HUM.dist < 500 && dd != null && Math.abs(dd) < 1.5) {
    g.save(); g.globalAlpha = 0.65 + 0.35 * Math.sin(TLR.t * 9);
    g.font = `900 48px ${HF.t}`; g.fillStyle = '#ffd400'; g.fillText(dd <= 0 ? 'ÇA PASSE ?!' : 'ÇA VA ÊTRE JUSTE…', Z.cx, 660);
    g.restore();
  }
  // carton final + appel aux commentaires
  if (fin) {
    const a = Math.min(1, TLR.endT / 0.4), pop = 1 + 0.4 * Math.max(0, 1 - TLR.endT / 0.3);
    g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H);
    const bx0 = Z.x0 + 10, bw0 = Z.x1 - Z.x0 - 20, top = 330;
    hlBox(g, bx0, top, bw0, o ? 400 : 320, 'rgba(10,12,16,.92)', 20);
    g.fillStyle = '#e10600'; g.font = `900 40px ${HF.t}`; g.fillText(TLR.rec ? 'NOUVEAU RECORD' : 'MON TOUR', Z.cx, top + 64);
    g.save(); g.translate(Z.cx, top + 170); g.scale(pop, pop); g.fillStyle = '#fff'; g.font = `800 96px ${HF.m}`; g.fillText(fmt(n.time), 0, 0, bw0 - 30); g.restore();
    g.font = `700 26px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(`${T.circ.flag || ''} ${tr(T.circ.name)} · ${HUM.driver.name}`, Z.cx, top + 222, bw0 - 40);
    if (o) { const d = n.time - o.time; g.font = `800 48px ${HF.m}`; g.fillStyle = d <= 0 ? '#39ff88' : '#ff6b66'; g.fillText(`${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(3)} s`, Z.cx, top + 300);
      g.font = `600 24px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(`${TLR.rec ? 'ancien record' : 'record'} ${fmt(o.time)}`, Z.cx, top + 342); }
    if (TLR.endT > 1) {
      g.globalAlpha = a * Math.min(1, (TLR.endT - 1) / 0.3); const cy = top + (o ? 400 : 320) + 40;
      hlBox(g, bx0, cy, bw0, 130, '#ffd400', 18); g.fillStyle = '#111';
      g.font = `900 40px ${HF.t}`; g.fillText('TU FAIS MIEUX ?', Z.cx, cy + 54);
      g.font = `800 28px ${HF.t}`; g.fillText('Ton temps en commentaire 👇', Z.cx, cy + 100, bw0 - 30);
    }
    g.restore();
  }
  g.textAlign = 'left';
}
function stopTTReplay() {
  closeTTVideo();
  TLR.on = false; $('#ttrpbar').hidden = true;
  startTimeTrial();   // on repart d'un tour neuf, avec le nouveau record en fantôme
}
function ttReplayStep(dt) {
  TLR.t += dt;
  const S = TLR.neu.samples, p = ghostAt(TLR.neu, TLR.t);
  if (!p) {   // fin du tour : on reste sur l'image, au joueur de choisir (vidéo : carton final puis enregistrement)
    TLR.t = S[S.length - 1][0]; TLR.ended = true;
    if (TLR.video && !TLR.vdone) { TLR.endT += dt; if (TLR.endT > 4.5) { TLR.vdone = true; if (HL.recording) hlRecordStop(false); } }
    return;
  }
  const q = ghostAt(TLR.neu, Math.max(0, TLR.t - 0.1)) || p;
  const v = Math.max(0, (p.s - q.s) / Math.min(0.1, Math.max(0.016, TLR.t)));
  Object.assign(HUM, { dist: p.s, s: SIM.mod(p.s, T.L), d: p.d, v: HUM.v + (v - HUM.v) * 0.3, yaw: 0, spin: null, state: 'run', lapsDone: 0, lapStartT: R.t - TLR.t });
  HUM.vd = Math.tan(p.slip) * Math.max(HUM.v, 3);
}
function updateTimeTrial() {
  if (!R || !R.tt) return;
  const circ = T.circ;
  while (ttSeen < R.tt.laps.length) {
    const lap = R.tt.laps[ttSeen++];
    if (MAR.on) {
      if (!lap.offs) { const rec = loadRecord(circ.id); if (!rec || lap.time < rec.time) saveRecord(circ.id, { time: lap.time, samples: (lap.samples || []).filter((p, i) => i % 2 === 0), driver: HUM.driver.name, team: HUM.team.name, level: 'marathon', date: new Date().toISOString().slice(0, 10) }); }
      marathonLap(lap); return;
    }
    if (!lap.valid) { toast({ type: 'error', msg: `Tour ${fmt(lap.time)} annulé (limites de piste)`, cars: [0] }); continue; }
    const rec = loadRecord(circ.id);
    const d = rec ? lap.time - rec.time : null, isRec = !rec || lap.time < rec.time;
    // replay (et vidéo) du dernier tour valide, record ou pas, avec le record (ou l'ancien record) en fantôme
    if (lap.samples && lap.samples.length > 10) {
      Object.assign(TLR, { circ: circ.id, eng: ST.engine, rec: isRec, neu: { time: lap.time, samples: lap.samples, team: HUM.team }, old: rec && rec.samples ? { time: rec.time, samples: rec.samples, team: GH ? GH.team : HUM.team } : null });
      $('#btn-ttrp').textContent = isRec ? '▶ Replay du record' : '▶ Replay du tour'; $('#btn-ttrp').hidden = false;
    }
    if (isRec) {
      const samples = (lap.samples || []).filter((p, i) => i % 2 === 0);   // 10 points / s suffisent
      const nr = { time: lap.time, samples, driver: HUM.driver.name, team: HUM.team.name, level: 'freinage ' + BRAKE_L[ST.brakeAid], date: new Date().toISOString().slice(0, 10) };
      saveRecord(circ.id, nr);
      GH = { time: nr.time, samples, label: 'Record', team: HUM.team };
      toast({ type: 'fastest', msg: `NOUVEAU RECORD${ST.engine === 'ice' ? ' THERMIQUE' : ''} ! ${fmt(lap.time)}${d != null ? ' (' + d.toFixed(3) + ')' : ''}`, cars: [0] });
      const tot = ttTotal();
      if (!circ.bonus) toast({ type: 'tt', msg: tot.n === CAL.length ? `Temps total ${CAL.length} circuits : ${fmtTotal(tot.sum)}` : `Records : ${tot.n}/${CAL.length} circuits · total partiel ${fmtTotal(tot.sum)}`, cars: [] });
    } else toast({ type: 'tt', msg: `Tour ${fmt(lap.time)} · +${d.toFixed(3)} sur le record`, cars: [0] });
  }
  if (R.tt.crashed && !R.tt.restartAt) { R.tt.restartAt = performance.now() + 2500; if (MAR.on) { MAR.pen += 10; toast({ type: 'penalty', msg: 'Sortie : on repart sur ce circuit · +10 s au total', cars: [0] }); } }
  if (R.tt.restartAt && performance.now() > R.tt.restartAt) startTimeTrial();
}
/* ---------------- secteurs (qualif & contre-la-montre) : trois tiers de tour ----------------
   violet = meilleur secteur absolu ; vert / jaune = plus rapide / plus lent que le même secteur du meilleur tour
   (record ou pole, ou ton meilleur tour s'il est plus rapide) ; rouge = tour annulé */
const SECPB = {};                     // meilleurs secteurs du joueur pendant la session, par mode et circuit
const SECLAP = {};                    // secteurs du meilleur tour du joueur pendant la session
let SEC = null;
function lapRefSplits() {
  let ref = null;
  if (GH) { GH._splits = GH._splits || ghostSplits(GH); if (GH._splits) ref = { time: GH.time, splits: GH._splits }; }
  const mine = SECLAP[SEC.key];
  if (mine && (!ref || mine.time < ref.time)) ref = mine;
  return ref && ref.splits;
}
const secKey = id => 'paddock26-ttsec-' + id + ENG_SFX();
function loadBestSec(id) { try { return JSON.parse(localStorage.getItem(secKey(id)) || 'null'); } catch (e) { return null; } }
function saveBestSec(id, v) { try { localStorage.setItem(secKey(id), JSON.stringify(v)); } catch (e) { /* ignoré */ } }
function ghostSplits(g) {
  if (!g || !g.samples) return null;
  const a = ghostTimeAtDist(g, T.L / 3), b = ghostTimeAtDist(g, T.L * 2 / 3);
  return a != null && b != null ? [a, b - a, g.time - b] : null;
}
function initSectors(mode) {
  const key = mode + ':' + T.circ.id;
  const pb = SECPB[key] || (SECPB[key] = [null, null, null]);
  const ref = ghostSplits(GH), stored = mode === 'tt' ? loadBestSec(T.circ.id) : null;
  const best = [0, 1, 2].map(k => Math.min(...[ref && ref[k], stored && stored[k], pb[k]].filter(x => x > 0), 1e9));
  SEC = { key, mode, pb, best, lap: -99, splits: [], cells: [null, null, null] };
  $('#sectors').hidden = false; document.body.classList.add('secs'); requestAnimationFrame(placeCoast);
}
function sectorDone(k, t, valid) {
  let col = 'yel';
  if (!valid) col = 'bad';
  else {
    const ref = lapRefSplits();
    if (t <= SEC.best[k]) col = 'pur'; else if (!ref || t <= ref[k]) col = 'grn';
    if (!SEC.pb[k] || t < SEC.pb[k]) SEC.pb[k] = t;
    if (t < SEC.best[k]) {
      SEC.best[k] = t;
      if (SEC.mode === 'tt') { const b = loadBestSec(T.circ.id) || [null, null, null]; b[k] = t; saveBestSec(T.circ.id, b); }
    }
  }
  SEC.cells[k] = { t, col };
}
function updateSectors() {
  if (!SEC || !HUM) return;
  const c = HUM, L = T.L;
  const timed = R.tt ? true : !R.qualiRun.done;
  if (c.lapsDone !== SEC.lap) {     // passage sur la ligne
    if (SEC.lap >= 0 && SEC.splits.length === 2 && c.lastLap) {
      const lapOk = R.tt ? (R.tt.laps.length ? R.tt.laps[R.tt.laps.length - 1].valid : true) : !R.qualiRun.invalid;
      sectorDone(2, c.lastLap - SEC.splits[1], lapOk);
      const mine = SECLAP[SEC.key];
      if (lapOk && (!mine || c.lastLap < mine.time)) SECLAP[SEC.key] = { time: c.lastLap, splits: SEC.cells.map(x => x.t) };
    }
    SEC.lap = c.lapsDone; SEC.splits = [];
    for (const cell of SEC.cells) if (cell) cell.old = true;
  }
  if (c.lapsDone >= 0 && timed) {
    const el = R.t - c.lapStartT, d = c.dist - c.lapsDone * L, ok = R.tt ? R.tt.valid : !R.qualiRun.invalid;
    for (let k = SEC.splits.length; k < 2; k++) {
      const at = L * (k + 1) / 3;
      if (d < at) break;
      const t = el - (d - at) / Math.max(c.v, 1);   // instant exact du passage
      SEC.splits.push(t);
      sectorDone(k, t - (k ? SEC.splits[k - 1] : 0), ok);
    }
  }
  const live = c.lapsDone >= 0 && !(R.qualiRun && R.qualiRun.done) ? SEC.splits.length : -1;
  for (let k = 0; k < 3; k++) {
    const el = $('#sec-' + k), cell = SEC.cells[k];
    let txt, cls;
    if (k === live) { txt = (R.t - c.lapStartT - (k ? SEC.splits[k - 1] : 0)).toFixed(1); cls = 'run'; }
    else if (cell) { txt = cell.t.toFixed(3); cls = cell.col + (cell.old && k > live ? ' old' : ''); }
    else { txt = SEC.best[k] < 1e9 ? SEC.best[k].toFixed(3) : '—'; cls = 'old'; }
    const html = `<small>S${k + 1}</small>${txt}`;
    if (el.innerHTML !== html) el.innerHTML = html;
    if (el.className !== cls) el.className = cls;
  }
}
/* fantôme : voiture transparente rejouant un tour enregistré */
function ghostAt(g, t) {
  const S = g.samples; if (!S || S.length < 2 || t < 0 || t > S[S.length - 1][0]) return null;
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid][0] <= t) lo = mid; else hi = mid; }
  const a = S[lo], b = S[hi], f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
  return { s: a[1] + (b[1] - a[1]) * f, d: a[2] + (b[2] - a[2]) * f, slip: a[3] + (b[3] - a[3]) * f };
}
function ghostTimeAtDist(g, dist) {
  const S = g.samples; if (!S || S.length < 2 || dist <= S[0][1] || dist >= S[S.length - 1][1]) return null;
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid][1] <= dist) lo = mid; else hi = mid; }
  const a = S[lo], b = S[hi]; return a[0] + (b[0] - a[0]) * (dist - a[1]) / Math.max(1e-6, b[1] - a[1]);
}
function makeGhost(team) {
  const g = makeCar(team);
  g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; } });
  return g;
}
function updateGhost() {
  if (TLR.on) {
    const g = TLR.old; if (!g) { if (ghostObj) ghostObj.visible = false; return null; }
    if (!ghostObj || ghostObj.userData.team !== g.team) { if (ghostObj) scene.remove(ghostObj); ghostObj = makeGhost(g.team); ghostObj.userData.team = g.team; scene.add(ghostObj); }
    const p = ghostAt(g, TLR.t);
    if (!p) ghostObj.visible = false;
    else { const w = SIM.worldPos(T, p.s, p.d); ghostObj.visible = true; ghostObj.position.set(w.x, 0.01, -w.y); ghostObj.rotation.set(0, w.h + p.slip, 0); }
    const ref = ghostTimeAtDist(g, HUM.dist);
    return ref == null ? null : TLR.t - ref;
  }
  const timed = R.tt ? HUM.lapsDone >= 0 : R.qualiRun ? HUM.lapsDone === 0 && !R.qualiRun.done : false;
  if (!GH || !ST.ghost || !timed) { if (ghostObj) ghostObj.visible = false; return null; }
  if (!ghostObj || ghostObj.userData.team !== GH.team) {
    if (ghostObj) scene.remove(ghostObj);
    ghostObj = makeGhost(GH.team); ghostObj.userData.team = GH.team; scene.add(ghostObj);
  }
  const el = R.t - HUM.lapStartT, p = ghostAt(GH, el);
  if (!p) { ghostObj.visible = false; }
  else {
    const w = SIM.worldPos(T, p.s, p.d);
    ghostObj.visible = true; ghostObj.position.set(w.x, 0.01, -w.y); ghostObj.rotation.set(0, w.h + p.slip, 0);
  }
  const ref = ghostTimeAtDist(GH, HUM.dist - HUM.lapsDone * T.L);
  return ref == null ? null : el - ref;
}
function enterView(circ) {
  document.body.classList.toggle('ice', SIM.engine === 'ice');
  document.body.classList.toggle('ice-race', SIM.engine === 'ice' && !!R && !R.tt && !R.qualiRun);   // en course, pas d'Overtake (en chrono le bouton sert à recommencer)
  ghostObj = null; SEC = null; $('#sectors').hidden = true; document.body.classList.remove('secs');
  if (TLR.video) closeTTVideo();
  TLR.on = false; $('#ttrpbar').hidden = true; $('#btn-ttrp').hidden = true;
  $('#btn-results').hidden = true;
  RP.on = false; $('#rpbar').hidden = true; clipReset();
  RW.on = false; RW.cur = null; RW.R = null; document.body.classList.remove('rw'); $('#rwbar').hidden = true; $('#btn-rw').hidden = true;
  Object.assign(DIR, { cam: 'tv', until: 0, idx: 0, hot: new Map(), caption: '', finDone: false, finEnd: 0 });
  FIX.lock = false;
  if (HUM && camMode !== 'onboard') camMode = 'tv';   // au volant : seulement TV ou embarquée
  $('#dnf').hidden = true; $('#dnf-btns').hidden = false; $('#dnf-prog').hidden = true;
  setupDriveUI(); evIdx = 0; acc = 0; paused = false; ST.speed = 1; camInit = false;
  show('race');
  initRenderer();
  buildScene();
  resize();
  buildTower();
  buildLabels();
  $('#qres').hidden = true;
  $('#hud-gp').textContent = `${circ.flag} ${circ.name.toUpperCase()}`;
  $('#btn-speed').textContent = '×1';
  $('#btn-pause').textContent = 'Pause';
  $('#btn-cam').textContent = CAM_MODES.find(m => m[0] === camMode)[1];
  $('#results').hidden = true; $('#toasts').innerHTML = '';
  lastT = performance.now();
  requestWake();
  requestAnimationFrame(loop);
}

let wakeLock = null;
async function requestWake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) { /* non disponible */ } }

function loop(now) {
  if (!R || $('#race').hidden) return;
  if (EXP.on) { lastT = now; requestAnimationFrame(loop); return; }   // export en cours : c'est lui qui fait avancer la vidéo
  const dtR = Math.min(0.1, (now - lastT) / 1000); QUAL.frame((now - lastT) / 1000); lastT = now;
  if (VID.on) { if (!paused) vidStep(dtR); }
  else if (HL.on) { if (!paused) hlStep(dtR); else editAudioStop(); }
  else if (RP.on) { if (!paused) RP.t = Math.min(RP.t + dtR * ST.speed, CLIP.video && !CLIP.done ? CLIP.b : RP.end); applyReplay(); if (CLIP.video) clipStep(); rpCtlTick(); }
  else if (TLR.on) { if (!paused) ttReplayStep(dtR); }
  else if (HUM) updateInput(dtR);
  if (!paused && !R.over && R.net !== 'client' && !TLR.on) {
    acc += dtR * ST.speed;
    let n = 0;
    // pas de simulation plus grand en très accéléré, et budget de calcul limité par image
    const sdt = ST.speed >= 32 ? 1 / 30 : 1 / 60, tb = performance.now();
    while (acc >= sdt && performance.now() - tb < 12) { stepSim(sdt); acc -= sdt; n++; }
    if (acc > sdt * 4) acc = 0;
  }
  if (R.net) netTick(now);
  rwTick();
  updateCars(dtR * (paused ? 0 : ST.speed));
  director(now);
  updateCamera(dtR);
  updateLabels();
  updateWeatherFx(paused ? 0 : dtR * Math.min(ST.speed, 2));
  updateAudio(dtR);
  renderer.render(scene, camera);
  if (VID.on) vidCompose();
  else if (HL.on) hlCompose();
  else if (TLR.video) ttCompose();
  else if (CLIP.video) clipCompose();
  updateHUD(now);
  if (R.tt) updateTimeTrial();
  // stratégie : rappel au début du tour où il faut rentrer aux stands
  if (HUM && HUM.myPlan && HUM.myPlan.length && !R.over) {
    const p = HUM.myPlan[0];
    if (HUM.stops > (HUM.myPlanDone || 0)) { HUM.myPlan.shift(); HUM.myPlanDone = HUM.stops; }
    else if (!p.warned && HUM.lapsDone + 1 >= p.lap && HUM.state === 'run') { p.warned = true; toast({ type: 'pit', msg: `Stratégie : arrêt à la fin de ce tour, pneus ${SIM.COMP[p.comp].name} — appuie sur BOX`, cars: [HUM.id] }); }
  }
  if (HUM && !R.tt && !R.qualiRun && HUM.state === 'out' && !R.dnfShown) {
    R.dnfShown = true;
    $('#dnf-title').textContent = 'Abandon';
    $('#dnf-why').textContent = `${HUM.driver.name} — ${HUM.retiredWhy}`;
    $('#dnf-watch').textContent = 'Regarder la course'; $('#dnf-sim').textContent = 'Simuler jusqu’à l’arrivée';
    $('#dnf-sim').hidden = !!R.net;
    $('#dnf').hidden = false;
  }
  // arrivée du joueur : regarder la fin de course en spectateur ou passer directement au classement
  if (HUM && !R.tt && !R.qualiRun && HUM.fin && !R.over && !R.dnfShown && R.t - HUM.finishT > 3) {
    R.dnfShown = true;
    $('#dnf-title').textContent = 'Arrivée';
    $('#dnf-why').textContent = `${HUM.driver.name} — P${HUM.pos} sur la ligne${HUM.penalty ? ` · pénalité de ${HUM.penalty} s` : ''}`;
    $('#dnf-watch').textContent = 'Regarder la fin'; $('#dnf-sim').textContent = 'Passer au classement';
    $('#dnf-sim').hidden = !!R.net;
    $('#dnf').hidden = false;
  }
  autoSaveRace();
  if (R.over && !R.resultsShown) { R.resultsShown = true; if (R.qualiRun) showQualiResult(); else showResults(); }
  requestAnimationFrame(loop);
}

const fwdV = new THREE.Vector3();
function carPose(c) {
  const p = SIM.worldPos(T, c.s, c.d);
  const slip = c.state === 'pit' ? 0 : Math.atan2(-c.vd, Math.max(c.v, 3)) * -1;
  return { x: p.x, y: p.y, h: p.h + slip + (c.yaw || 0) };
}
/* voiture fantôme (hors course) : matériaux transparents, et retour à la normale (replay rembobiné) */
function carGhost(o, on) {
  o.userData.ghost = on;
  o.traverse(m => {
    if (!m.isMesh) return;
    if (on) { m.userData.mat0 = m.material; m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.3; m.material.depthWrite = false; }
    else if (m.userData.mat0) { m.material = m.userData.mat0; m.userData.mat0 = null; }
  });
}
function updateCars(dt) {
  R.cars.forEach((c, k) => {
    const o = carObjs[k];
    if (c.gone) { o.visible = false; return; }
    o.visible = true;
    const p = carPose(c);
    o.position.set(p.x, 0, -p.y);
    o.rotation.set(0, p.h, 0);
    if (c.state === 'out') { o.rotation.z = 0.04; }
    const u = o.userData, gh = c.state === 'out' && R.t > (c.outT || 0) + 5;   // voiture hors course depuis 5 s : fantôme
    if (gh !== !!u.ghost) carGhost(o, gh);
    u.spinA += c.v * dt / 0.36;
    const steer = c.human ? -(R.input.steer || 0) * 0.4 : clamp((c.latG || 0) * 0.04, -0.35, 0.35);
    for (const w of u.wheels) { w.tyre.rotation.z = -u.spinA; if (!gh) w.band.material = MAT[c.tyre] || MAT.M; if (w.front) w.rotation.y = steer; }
    u.light.material = c.clip && (performance.now() / 120 | 0) % 2 ? MAT.lightOn : c.brake > 0.5 ? MAT.lightOn : MAT.lightOff;
    u.glow.visible = !!c.otActive;
  });
  if (R.sc) {
    scObj.visible = true;
    const p = SIM.worldPos(T, R.sc.s, R.sc.d);
    scObj.position.set(p.x, 0, -p.y); scObj.rotation.y = p.h;
    scObj.userData.bar.material.color.setHex((performance.now() / 250 | 0) % 2 ? 0xff9a00 : 0x442200);
  } else scObj.visible = false;
}

let BASE_FOV = 62;
const FIX = { s: 0, d: 0, id: -1 };
/* caméra bord de piste placée à la main (replay, course) : endroit du circuit, côté, distance, hauteur, angle, zoom, et si elle
   pivote pour suivre la voiture ; gardée par circuit */
const FIXM = { on: false, s: 0, side: 1, off: 6, h: 6, yaw: 0, fov: 42, track: true };
let FIXM_ALL = {}; try { FIXM_ALL = JSON.parse(localStorage.getItem('paddock26-fixcam') || '{}'); } catch (e) { FIXM_ALL = {}; }
const fixmOn = () => FIXM.on && !HL.on && !VID.on;
function fixmSave() { if (!T) return; FIXM_ALL[T.circ.id] = Object.assign({}, FIXM); try { localStorage.setItem('paddock26-fixcam', JSON.stringify(FIXM_ALL)); } catch (e) { /* ignoré */ } }
function fixUi() {
  const show = !!R && effCam() === 'fixed' && camMode === 'fixed' && !HL.on && !VID.on; $('#fixcam').hidden = !show; if (!show) return;
  if (FIXM.for !== T.circ.id) { Object.assign(FIXM, { on: false, s: 0, side: 1, off: 6, h: 6, yaw: 0, fov: 42, track: true }, FIXM_ALL[T.circ.id] || {}); FIXM.for = T.circ.id; }   // réglages de ce circuit
  $('#fx-auto').classList.toggle('set', !FIXM.on); $('#fx-track').classList.toggle('set', FIXM.track); $('#fx-track').textContent = L('Suit la voiture : ', 'Follows the car: ') + (FIXM.track ? L('oui', 'yes') : L('non', 'no'));
  $('#fx-s').value = Math.round(FIXM.s / T.L * 1000); $('#fx-off').value = FIXM.off; $('#fx-h').value = FIXM.h; $('#fx-yaw').value = FIXM.yaw; $('#fx-fov').value = FIXM.fov;
}
/* plan fixe : caméra posée en bord de piste, un peu devant la voiture, à l'extérieur */
function placeFixed(c) {
  const ahead = 70 + Math.random() * 80, s = c.s + ahead, i = SIM.idxOf(T, s);
  const side = -(T.csign[i] || 1);
  Object.assign(FIX, { s: SIM.mod(s, T.L), d: side * (T.w / 2 + (T.street ? 1.2 : 5 + Math.random() * 5)), id: c.id, h: T.street ? 10 + Math.random() * 4 : 6 + Math.random() * 4, fresh: true });
}
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camInit = false;
/* ---- réalisateur automatique : choisit la meilleure action en piste ---- */
const DIR = { cam: 'tv', until: 0, cutAt: 0, idx: 0, hot: new Map(), caption: '' };
const effCam = () => camMode === 'auto' ? (HUM ? 'tv' : DIR.cam) : camMode;
function director(now) {
  if (camMode !== 'auto' || HUM || !R || !R.ranked) { $('#dir-cap').hidden = true; return; }
  // événements récents : un accident ou un dépassement attire la caméra
  while (DIR.idx < R.events.length && R.events[DIR.idx].t <= R.t) {
    const e = R.events[DIR.idx++];
    const w = { crash: 120, contact: 70, error: 55, overtake: 60, penalty: 20, fastest: 15, pit: 25 }[e.type] || 0;
    if (w && e.cars.length) DIR.hot.set(e.cars[0], { w, until: R.t + (e.type === 'crash' ? 9 : 6), type: e.type, msg: e.msg });
  }
  for (const [id, h] of DIR.hot) if (h.until < R.t) DIR.hot.delete(id);
  // arrivée : on montre les 3 premiers franchir la ligne, un par un, depuis un plan fixe sur la ligne
  const Lr = R.laps * T.L, capEl = $('#dir-cap');
  if ((R.ranked[0].dist > Lr - 600 || R.leaderDone) && !DIR.finDone) {
    const podium = R.ranked.filter(c => c.state !== 'out').slice(0, 3);
    const next = podium.find(c => !c.fin && c.state !== 'out');
    if (!next) {
      if (!DIR.finEnd) DIR.finEnd = now + 3500;
      if (now > DIR.finEnd) { DIR.finDone = true; FIX.lock = false; }
    } else {
      if (follow !== next.id) { follow = next.id; camInit = false; }
      const toLine = Lr - next.dist;
      if (toLine < 480) {
        if (!FIX.lock) Object.assign(FIX, { s: 28, d: -T.pitSide * (T.w / 2 + (T.street ? 1.2 : 7)), h: T.street ? 11 : 6, id: next.id, lock: true, fresh: true });
        FIX.id = next.id; DIR.cam = 'fixed';
      } else { DIR.cam = 'tv'; FIX.lock = false; }
      const pos = next.pos;
      capEl.hidden = false;
      capEl.textContent = pos === 1 ? `Dernier tour : ${next.driver.name} vers la victoire` : `${R.cars[R.finishOrder[0]].code} vainqueur · ${next.driver.name} vers la P${pos}`;
    }
    if (!DIR.finDone) return;
  }
  const score = c => {
    if (c.gone || c.finGhost) return -1;
    const front = Math.pow(1 - (c.pos - 1) / 21, 1.6);             // les voitures de tête comptent beaucoup plus
    let sc = 75 * front, why = c.pos === 1 ? 'Tête de course' : c.pos <= 3 ? `${c.code} · P${c.pos}` : '';
    const h = DIR.hot.get(c.id); if (h) { sc += h.w; why = h.msg; }
    if (c.state === 'run' && c.pos > 1 && c.int != null && c.int < 0.8) {
      const ahead = R.ranked[c.pos - 2];
      sc += (55 * (1 - c.int / 0.8) + (c.ai.mode === 'attack' ? 20 : 0) + (c.otActive ? 10 : 0)) * (0.35 + 0.65 * front);
      if (!h) why = `Duel pour la P${c.pos - 1} : ${c.code} attaque ${ahead.code}`;
    }
    if (c.state === 'pit' && c.pos <= 8) { sc += 25; if (!h) why = `${c.code} aux stands`; }
    if (c.state === 'out' && !h) sc = -1;
    if (R.leaderDone && c.fin) sc = c.pos === 1 && R.t - R.finishedAt < 12 ? 200 : -1;
    if (R.t - R.startT < 20) sc = c.pos <= 3 ? 80 - c.pos : sc;   // départ : l'avant de la grille
    if (c.id === follow) sc += 12;                                // éviter de zapper sans cesse
    return { sc, why: why || `${c.code} · P${c.pos}` };
  };
  let best = null, bs = -1e9, bw = '';
  for (const c of R.cars) { const r = score(c); if (r.sc > bs) { bs = r.sc; best = c; bw = r.why; } }
  const urgent = best && DIR.hot.get(best.id) && DIR.hot.get(best.id).w >= 100;
  if (best && best.id !== follow && (now > DIR.until || urgent)) {
    follow = best.id; camInit = false;
    DIR.until = now + (urgent ? 7000 : 6000);
    const h = DIR.hot.get(best.id);
    const r = Math.random();
    DIR.cam = h && (h.type === 'crash' || h.type === 'contact') ? 'heli' : r < 0.12 ? 'onboard' : r < 0.27 ? 'heli' : r < 0.55 ? 'fixed' : 'tv';
    if (DIR.cam === 'fixed') { placeFixed(best); DIR.until = now + 12000; }
  }
  // plan fixe : on garde le plan le temps que la voiture et ses poursuivants passent
  if (DIR.cam === 'fixed' && R.cars[follow]) {
    const past = SIM.mod(R.cars[follow].s - FIX.s + T.L / 2, T.L) - T.L / 2;
    if (past > 70) DIR.until = Math.min(DIR.until, now + 1500);
  }
  DIR.caption = bw;
  const cap = $('#dir-cap'); cap.hidden = false; cap.textContent = DIR.caption;
}
const DRONE = { side: 1 };
function updateCamera(dt) {
  if (VID.on && !(vidSeg() || {}).clip) { vidCamera(dt); return; }   // extrait de course : caméras habituelles
  const camMode = effCam();
  const c = R.cars[follow];
  const p = carPose(c);
  const h = c.state === 'pit' ? SIM.worldPos(T, c.s, c.d).h : SIM.worldPos(T, c.s, c.d).h;
  const fx = Math.cos(h), fz = -Math.sin(h), sx = -fz, sz = fx;
  const car = new THREE.Vector3(p.x, 0, -p.y);
  let pos, look, k = 1 - Math.exp(-dt * 5);
  camera.up.set(0, 1, 0);
  if (camMode !== 'fixed' && camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }   // (bord de piste : zoom propre)
  // positions prises le long du tracé (et pas dans l'axe de la voiture) : la caméra reste au-dessus de la piste,
  // même dans une rue étroite ou une épingle, au lieu de se retrouver derrière un mur
  const onTrack = (ds, dd, y) => { const w = SIM.worldPos(T, c.s + ds, clamp(dd, -(T.w / 2 - 0.4), T.w / 2 - 0.4)); return new THREE.Vector3(w.x, y, -w.y); };
  const inPit = c.state === 'pit';
  if (camMode === 'tv' && !inPit) {
    // derrière la voiture, au-dessus de la piste ; le regard vise juste devant la voiture (dans sa direction) : elle reste au
    // centre de l'image, même au milieu d'un virage serré
    const d = 16 * zoom, ch = p.h;
    pos = onTrack(-d, c.d * 0.85, 5.5 * zoom + 1.5 + (T.street ? 1.5 : 0));
    look = car.clone().add(new THREE.Vector3(Math.cos(ch) * 6, 1, -Math.sin(ch) * 6));
  } else if (camMode === 'tv') {
    const d = 16 * zoom;
    pos = car.clone().add(new THREE.Vector3(-fx * d + sx * 3, 5.5 * zoom + 1.5, -fz * d + sz * 3));
    look = car.clone().add(new THREE.Vector3(fx * 14, 1, fz * 14));
  } else if (camMode === 'heli') {
    const d = 55 * zoom;
    pos = car.clone().add(new THREE.Vector3(-fx * d * 0.6 + sx * d * 0.5, d, -fz * d * 0.6 + sz * d * 0.5));
    look = car.clone().add(new THREE.Vector3(fx * 8, 0, fz * 8));
    k = 1 - Math.exp(-dt * 3);
  } else if (camMode === 'drone') {         // drone : au-dessus et sur le côté, assez près pour voir les deux voitures d'un dépassement
    if (!camInit) DRONE.side = c.d > 0 ? -1 : 1;   // côté choisi au début du plan (le plus de place), gardé ensuite
    const w = SIM.worldPos(T, c.s - 7 * zoom, c.d + DRONE.side * 8 * zoom), a = SIM.worldPos(T, c.s + 3, c.d - DRONE.side * 1.5);
    pos = new THREE.Vector3(w.x, 11 * zoom + (T.street ? 4 : 0), -w.y); look = new THREE.Vector3(a.x, 0.5, -a.y);
    k = 1 - Math.exp(-dt * 9);
  } else if (camMode === 'fixed' && fixmOn()) {
    // bord de piste placé à la main : position choisie ; regard tourné vers les voitures qui arrivent (+ angle), ou qui suit la voiture
    const w = SIM.worldPos(T, FIXM.s, FIXM.side * (T.w / 2 + FIXM.off)), hd = SIM.worldPos(T, FIXM.s, 0).h, a = (FIXM.yaw * Math.PI) / 180;
    const bx = -Math.cos(hd), bz = Math.sin(hd), dx = bx * Math.cos(a) - bz * Math.sin(a), dz = bx * Math.sin(a) + bz * Math.cos(a);
    if (camera.fov !== FIXM.fov) { camera.fov = FIXM.fov; camera.updateProjectionMatrix(); }
    camPos.set(w.x, FIXM.h, -w.y);
    const aim = FIXM.track ? car.clone().add(new THREE.Vector3(0, 0.6, 0)) : new THREE.Vector3(w.x + dx * 40, 0.5, -w.y + dz * 40);
    if (!camInit || !FIXM.track) camLook.copy(aim); else camLook.lerp(aim, 1 - Math.exp(-dt * 8));
    camInit = true; camera.position.copy(camPos); camera.lookAt(camLook);
    return;
  } else if (camMode === 'fixed') {
    // plan fixe : caméra immobile (position, direction et zoom figés), les voitures traversent l'image
    if (!FIX.lock && (FIX.id !== c.id || SIM.mod(c.s - FIX.s + T.L / 2, T.L) - T.L / 2 > 120)) placeFixed(c);
    const w = SIM.worldPos(T, FIX.s, FIX.d), aim = SIM.worldPos(T, FIX.s - 35, SIM.at(T, T.alpha, FIX.s - 35));
    if (camera.fov !== 42) { camera.fov = 42; camera.updateProjectionMatrix(); }
    camPos.set(w.x, FIX.h, -w.y); camLook.set(aim.x, 0.5, -aim.y); camInit = true;
    camera.position.copy(camPos); camera.lookAt(camLook);
    return;
  } else if (camMode === 'chase') {         // poursuite basse et proche (format vertical)
    pos = onTrack(-13, c.d, 3.4); look = onTrack(30, c.d, 0.6);
    k = 1 - Math.exp(-dt * 10);
  } else if (camMode === 'side') {          // travelling latéral bas, côté intérieur de la piste
    const side = c.d > 0 ? -1 : 1, room = T.w / 2 - 0.4 - side * c.d;
    pos = onTrack(-1.5, c.d + side * Math.min(7.5, Math.max(3, room)), T.street ? 2.4 : 1.2); look = onTrack(5, c.d, 0.6);
    k = 1 - Math.exp(-dt * 9);
  } else if (camMode === 'front') {         // caméra devant la voiture, qui fonce vers l'objectif
    pos = onTrack(15, c.d + (c.d > 0 ? -1.6 : 1.6), 1.8); look = car.clone().add(new THREE.Vector3(0, 0.7, 0));
    k = 1 - Math.exp(-dt * 8);
  } else if (camMode === 'orbit') {         // highlights : lent travelling circulaire autour de la voiture (cartons)
    const ang = (HL.played || 0) * 0.18 + (HL.orbit0 || 0), r = (T.street ? 18 : 30) * zoom, hgt = T.street ? 24 : 11;
    pos = car.clone().add(new THREE.Vector3(Math.cos(ang) * r, hgt, Math.sin(ang) * r)); look = car.clone().add(new THREE.Vector3(0, 0.8, 0));
    k = 1 - Math.exp(-dt * 3);
  } else if (camMode === 'onboard') {
    const ch = p.h, cx = Math.cos(ch), cz = -Math.sin(ch);
    pos = car.clone().add(new THREE.Vector3(cx * -0.3, 1.22, cz * -0.3));
    look = car.clone().add(new THREE.Vector3(cx * 30, 0.6, cz * 30));
    k = 1;
  } else {
    const b = T.bbox, cxm = (b.x0 + b.x1) / 2, cym = (b.y0 + b.y1) / 2;
    const span = Math.max((b.x1 - b.x0) / camera.aspect, b.y1 - b.y0) * 0.62 / Math.tan(camera.fov * Math.PI / 360) * zoom;
    pos = new THREE.Vector3(cxm, span, -cym + span * 0.05);
    look = new THREE.Vector3(cxm, 0, -cym);
    camera.up.set(0, 0, -1);
    k = 1 - Math.exp(-dt * 4);
  }
  if (!camInit || k >= 1) { camPos.copy(pos); camLook.copy(look); camInit = true; }
  else { camPos.lerp(pos, k); camLook.lerp(look, Math.min(1, k * 1.6)); }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

/* ---------------- étiquettes au-dessus des voitures ---------------- */
const labV = new THREE.Vector3();
function buildLabels() {
  const box = $('#labels'); box.innerHTML = '';
  R.cars.forEach(c => { const d = document.createElement('div'); d.className = 'clab'; d.id = 'lab-' + c.id; d.style.borderLeftColor = c.team.tv || c.team.color; box.appendChild(d); });
}
function updateLabels() {
  const W = window.innerWidth, H = window.innerHeight, cam = effCam();
  R.cars.forEach((c, k) => {
    const el = $('#lab-' + c.id); if (!el) return;
    const o = carObjs[k];
    if (c.gone || !o || !o.visible || (cam === 'onboard' && c.id === follow)) { el.style.display = 'none'; return; }
    labV.set(o.position.x, 1.7, o.position.z);
    const dist = labV.distanceTo(camera.position);
    labV.project(camera);
    if (labV.z > 1 || Math.abs(labV.x) > 1.05 || Math.abs(labV.y) > 1.05 || (cam !== 'map' && dist > 220)) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const txt = (R.tt || R.qualiRun ? '' : 'P' + c.pos + ' ') + c.code + (c.state === 'out' ? ' · OUT' : c.state === 'pit' ? ' · STAND' : '');
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle('me', c.id === follow);
    el.classList.toggle('ot', !!c.otActive);
    el.style.transform = `translate(-50%, -100%) translate(${(labV.x * 0.5 + 0.5) * W}px, ${(-labV.y * 0.5 + 0.5) * H}px)`;
  });
}

/* ---------------- toucher : pincer pour zoomer, glisser pour changer de pilote ---------------- */
function setupTouch(cv) {
  let d0 = 0, z0 = 1, sx = 0, sy = 0, st = 0;
  cv.addEventListener('touchstart', e => {
    if (HUM) return;
    if (e.touches.length === 2) { d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); z0 = zoom; }
    else { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = performance.now(); }
  }, { passive: true });
  cv.addEventListener('touchmove', e => {
    if (HUM) return;
    if (e.touches.length === 2 && d0) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoom = clamp(z0 * d0 / d, 0.35, 3.5); }
  }, { passive: true });
  cv.addEventListener('touchend', e => {
    if (HUM) return;
    if (d0 && e.touches.length < 2) { d0 = 0; return; }
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (performance.now() - st < 400 && Math.abs(dx) > 60 && Math.abs(dy) < 50) cycleFollow(dx < 0 ? 1 : -1);
  }, { passive: true });
  cv.addEventListener('wheel', e => { zoom = clamp(zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.35, 3.5); }, { passive: true });
}
function cycleFollow(dir) {
  if (HUM) return;
  if (camMode === 'auto') { camMode = 'tv'; $('#btn-cam').textContent = 'TV'; }
  const order = (R.ranked || R.cars).filter(c => !c.gone).map(c => c.id);
  const k = order.indexOf(follow);
  follow = order[(k + dir + order.length) % order.length];
  camInit = false;
}

/* =====================================================================
   HUD : tour de chronométrage, télémétrie, mini-carte, messages
   ===================================================================== */
let towerMode = 'int', lastTower = 0;
function buildTower() {
  const box = $('#tower-rows');
  box.innerHTML = R.cars.map(c => `<button class="tr" id="tr-${c.id}" data-id="${c.id}"><span class="p"></span><i style="background:${(c.team.tv || c.team.color)}"></i><span class="c">${c.code}</span><span class="g"></span><span class="ty"></span></button>`).join('');
  box.querySelectorAll('.tr').forEach(b => b.onclick = () => { if (HUM) return; follow = +b.dataset.id; camInit = false; if (camMode === 'auto') { camMode = 'tv'; $('#btn-cam').textContent = 'TV'; } });
}
function gapText(c, i, ranked) {
  if (c.state === 'out') return 'OUT';
  if (c.state === 'pit') return 'STAND';
  if (i === 0) return c.fin ? (R.winnerId === c.id ? 'VAINQ.' : 'ARRIVÉ') : 'TÊTE';
  if (c.gap != null && c.gap < 0) return `+${-c.gap} T`;
  if (towerMode === 'int') return c.int != null ? '+' + Math.max(0, c.int).toFixed(3) : '';
  return c.gap != null ? '+' + Math.max(0, c.gap).toFixed(3) : '';
}
function updateHUD(now) {
  const circ = T.circ;
  // barre supérieure
  const lap = Math.min(R.laps, Math.max(1, (R.ranked ? R.ranked[0].lapsDone : 0) + 1));
  const delta = HUM && (R.tt || R.qualiRun) ? updateGhost() : null;
  if (HUM && (R.tt || R.qualiRun) && !TLR.on) updateSectors();   // pas de chrono pendant le replay du record
  $('#hud-lap').textContent = R.tt && MAR.on ? `${MAR.i + 1}/${CAL.length} · ${HUM.lapsDone < 0 ? 'LANCEMENT' : fmt(R.t - HUM.lapStartT)} · Σ ${fmtTotal(MAR.times.reduce((a, x) => a + x.t, 0) + MAR.pen + (HUM.lapsDone >= 0 ? R.t - HUM.lapStartT + R.tt.offs : 0)).replace(/\.\d+$/, '')}`
    : R.tt ? (HUM.lapsDone < 0 ? 'CONTRE-LA-MONTRE · LANCEMENT' : 'CLM · ' + fmt(R.t - HUM.lapStartT) + (R.tt.valid ? '' : ' · ANNULÉ'))
    : R.qualiRun ? (HUM.lapsDone < 0 ? 'TOUR DE LANCEMENT' : 'QUALIF · ' + fmt(R.t - HUM.lapStartT) + (R.qualiRun.invalid ? ' · ANNULÉ' : ''))
    : R.phase === 'lights' ? 'GRILLE' : R.leaderDone ? 'ARRIVÉE' : `TOUR ${lap}/${R.laps}`;
  const flag = { green: ['', 'VERT'], sc: ['sc', 'SAFETY CAR'], sc_in: ['sc', 'SC RENTRE'], restart: ['sc', 'RELANCE'], vsc: ['vsc', 'VSC'], vsc_end: ['vsc', 'FIN VSC'] }[R.flag] || ['', ''];
  const fl = $('#hud-flag'); fl.className = 'flag-chip ' + (R.leaderDone ? 'chk' : flag[0]); fl.textContent = R.leaderDone ? 'DAMIER' : R.yellows.length && R.flag === 'green' ? 'JAUNE' : flag[1];
  if (R.yellows.length && R.flag === 'green' && !R.leaderDone) fl.className = 'flag-chip yel';
  const wxEl = $('#hud-wx'), rain = R.wx ? R.wx.rain : 0;
  wxEl.textContent = rain > 0.05 ? `PLUIE · PISTE ${Math.round(R.wet * 100)} %` : R.wet > 0.05 ? `SÈCHE · ${Math.round(R.wet * 100)} %` : 'SEC';
  wxEl.className = (rain > 0.05 ? 'rain' : R.wet > 0.05 ? 'damp' : '');
  // feux
  const lights = $('#lights');
  const lmsg = $('#lights-msg'), me = HUM && HUM.human ? HUM : null;
  if (R.phase === 'lights') {
    lights.hidden = false; lights.querySelectorAll('i').forEach((l, k) => l.className = k < R.lightsOn ? 'on' : '');
    if (me) { lmsg.textContent = me.jump ? 'FAUX DÉPART ! +5 s' : 'N\'accélère qu\'à l\'extinction des feux'; lmsg.className = me.jump ? 'bad' : ''; }
    else lmsg.textContent = '';
  }
  else if (!lights.hidden && R.t - R.startT > (me && (me.jump || me.reactT != null) ? 2.5 : 1.2) && !(me && me.reaction === Infinity)) lights.hidden = true;
  else if (!lights.hidden) {
    lights.querySelectorAll('i').forEach(l => l.className = 'out');
    if (me) {
      if (me.jump) { lmsg.textContent = 'FAUX DÉPART ! +5 s'; lmsg.className = 'bad'; }
      else if (me.reaction === Infinity) { lmsg.textContent = 'GO ! GO ! GO !'; lmsg.className = 'good'; }
      else if (me.reactT != null) { lmsg.textContent = `Réaction : ${me.reactT.toFixed(3)} s`; lmsg.className = me.reactT < 0.25 ? 'good' : ''; }
      else lmsg.textContent = '';
    }
  }

  // tour de chrono (4 fois / s)
  if (now - lastTower > 250 && R.ranked) {
    lastTower = now;
    const rows = $('#tower-rows');
    R.ranked.forEach((c, i) => {
      const el = $('#tr-' + c.id);
      el.style.order = i;
      el.querySelector('.p').textContent = i + 1;
      el.querySelector('.g').textContent = gapText(c, i, R.ranked);
      const ty = el.querySelector('.ty'); ty.style.color = SIM.COMP[c.tyre].col; ty.textContent = c.tyre;
      el.classList.toggle('me', c.id === follow);
      el.classList.toggle('out', c.state === 'out');
      el.classList.toggle('ot', !!c.otActive);
      el.classList.toggle('fl', !!(R.fastest && R.fastest.id === c.id));
      // conduite : leader + voisins directs ; replay : pilote suivi + celui devant et derrière ; spectateur : 2 devant, 2 derrière
      const fp = R.cars[follow].pos - 1;
      el.classList.toggle('show', HUM ? i === 0 || Math.abs(i - (HUM.pos - 1)) <= 1 : Math.abs(i - fp) <= (RP.on ? 1 : 2));
    });
    rows.dataset.mode = towerMode;
    document.body.classList.toggle('rp', RP.on);
    $('#btn-rw').hidden = !(rwAvail() || RW.on);
    $('#dnf-rw').hidden = !(rwAvail() && HUM.state === 'out');
  }
  // télémétrie du pilote suivi
  const c = R.cars[follow];
  $('#tl-pos').textContent = 'P' + c.pos;
  $('#tl-name').textContent = c.driver.name;
  $('#tl-team').textContent = `${c.team.name} · #${c.driver.num}`;
  $('#tl-bar').style.background = (c.team.tv || c.team.color);
  $('#tl-speed').textContent = Math.round(c.v * 3.6);
  const kmh = c.v * 3.6, gear = c.v < 0.5 ? 'N' : kmh < 95 ? (kmh < 60 ? 2 : 3) : kmh < 135 ? 4 : kmh < 175 ? 5 : kmh < 215 ? 6 : kmh < 260 ? 7 : 8;
  $('#tl-gear').textContent = gear;
  $('#tl-thr').style.transform = `scaleY(${c.throttle || 0})`;
  $('#tl-brk').style.transform = `scaleY(${c.brake || 0})`;
  const soc = c.soc / SIM.SOC_MAX;
  $('#tl-soc').style.transform = `scaleX(${soc})`;
  $('#tl-soc-v').textContent = Math.round(soc * 100) + ' %';
  const ot = $('#tl-ot'); ot.className = 'badge ' + (c.otActive ? 'live' : c.otAvail ? 'arm' : '');
  $('#tl-aero').textContent = c.state === 'pit' ? 'STAND' : c.xmode ? 'AÉRO X' : 'AÉRO Z';
  $('#tl-clip').hidden = !c.clip;
  $('#tl-tyre').textContent = SIM.COMP[c.tyre].name;
  $('#tl-tyre').style.color = SIM.COMP[c.tyre].col;
  $('#tl-wear').textContent = Math.round(Math.max(0, 1 - c.wear) * 100) + ' %';
  $('#tl-last').textContent = fmt(c.lastLap);
  $('#tl-best').textContent = fmt(c.bestLap);
  $('#tl-g').textContent = ((c.latG || 0) >= 0 ? '' : '') + Math.abs(c.latG || 0).toFixed(1) + ' g';
  const idx = R.ranked ? R.ranked.indexOf(c) : 0;
  const ahead = idx > 0 ? R.ranked[idx - 1] : null;
  $('#tl-ahead').textContent = ahead && c.int != null ? `${ahead.code} +${Math.max(0, c.int).toFixed(3)}` : idx === 0 ? 'En tête' : '—';
  if (HUM) {
    const k = HUM;
    const kmh2 = k.v * 3.6;
    $('#dh-pos').textContent = R.tt ? 'CLM' : R.qualiRun ? 'Q' : 'P' + k.pos;
    $('#dh-spd').textContent = Math.round(kmh2);
    $('#dh-gear').textContent = $('#tl-gear').textContent;
    $('#dh-soc').style.transform = `scaleX(${k.soc / SIM.SOC_MAX})`;
    $('#dh-ers').className = 'dh-ers ' + (k.otActive ? 'ot' : k.clip ? 'clip' : '');
    const ty = $('#dh-tyre'); ty.textContent = k.tyre + ' ' + Math.round(Math.max(0, 1 - k.wear) * 100) + '%'; ty.style.color = SIM.COMP[k.tyre].col;
    const late = k.assistV && k.v > k.assistV * 0.995 && k.state === 'run' && !TLR.on;
    $('#dh-brake').hidden = !late;
    $('#dh-pen').hidden = !(k.penalty || k.tl || k.scHold);
    $('#dh-pen').textContent = k.scHold && R.flag !== 'green' ? 'NE PAS DÉPASSER' : (k.penalty ? `PÉN +${k.penalty}s · ` : '') + (k.tl ? `LDP ${k.tl % 3}/3` : '');
    const dg = $('#dh-gap');
    dg.style.color = delta == null ? '' : delta <= 0 ? 'var(--ot)' : '#ff6b66';
    if (delta != null) dg.textContent = (delta <= 0 ? '−' : '+') + Math.abs(delta).toFixed(2) + ' ' + (TLR.on ? (TLR.rec ? 'ANC. REC' : 'REC') : GH.label === 'Record' ? 'REC' : 'P1');
    else dg.textContent = R.tt ? (loadRecordCached() ? 'REC ' + fmt(loadRecordCached().time) : '') : R.qualiRun ? (k.lastLap ? fmt(k.lastLap) : '') : k.pos > 1 && k.int != null ? '+' + Math.max(0, k.int).toFixed(3) : k.pos === 1 ? 'EN TÊTE' : '';
  }
  // mini-carte
  drawMinimap();
  // messages
  while (evIdx < R.events.length) toast(R.events[evIdx++]);
}

/* mini-carte */
let mmBase = null;
function drawMinimapBase() {
  const cv = $('#minimap'); if (!cv || !T) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < T.N; i++) { x0 = Math.min(x0, T.x[i]); x1 = Math.max(x1, T.x[i]); y0 = Math.min(y0, T.y[i]); y1 = Math.max(y1, T.y[i]); }
  const sc = Math.min((W - 14) / (x1 - x0), (H - 14) / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  mmBase = { dpr, W, H, X: x => ox + (x - x0) * sc, Y: y => H - (oy + (y - y0) * sc) };
}
function drawMinimap() {
  const cv = $('#minimap'); if (!mmBase) drawMinimapBase(); const m = mmBase; if (!m) return;
  const g = cv.getContext('2d'); g.setTransform(m.dpr, 0, 0, m.dpr, 0, 0); g.clearRect(0, 0, m.W, m.H);
  g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i < T.N; i += 3) { const x = m.X(T.x[i]), y = m.Y(T.y[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.stroke();
  const p0 = SIM.worldPos(T, 0, 0); g.fillStyle = '#fff'; g.fillRect(m.X(p0.x) - 1.5, m.Y(p0.y) - 4, 3, 8);
  const draw = (x, y, col, r, ring) => { g.beginPath(); g.arc(m.X(x), m.Y(y), r, 0, 7); g.fillStyle = col; g.fill(); if (ring) { g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); } };
  for (const c of R.cars) { if (c.gone) continue; const p = SIM.worldPos(T, c.s, c.state === 'pit' ? c.d : c.d); draw(p.x, p.y, c.state === 'out' ? '#666' : (c.team.tv || c.team.color), c.id === follow ? 4.5 : 3, c.id === follow); }
  if (R.sc) { const p = SIM.worldPos(T, R.sc.s, 0); draw(p.x, p.y, '#ff9a00', 4, false); }
  for (const y of R.yellows) { const p = SIM.worldPos(T, y.s, 0); g.fillStyle = '#ffd400'; g.fillRect(m.X(p.x) - 3, m.Y(p.y) - 3, 6, 6); }
}

/* messages de course */
function toast(e) {
  const c = R.cars[follow];
  if ((e.type === 'crash' || e.type === 'contact') && e.cars.length) {
    const o = R.cars[e.cars[0]], p = carPose(o);
    const d = Math.hypot(p.x - camera.position.x, -p.y - camera.position.z);
    if (d < 150) crashSound((e.type === 'crash' ? 1 : 0.45) * (1 - d / 150));
  }
  const involved = e.cars.includes(follow);
  const top = e.cars.some(id => R.cars[id].pos <= 6);
  if (e.type === 'overtake' && !involved && !top) return;
  if (e.type === 'fastest' && !involved) return;
  if (e.type === 'pit' && !involved && !top) return;
  if (e.type === 'info' && !involved && !top && R.t - R.startT > 5) return;
  const box = $('#toasts');
  const d = document.createElement('div');
  d.className = 'toast ' + e.type + (involved ? ' mine' : '');
  d.innerHTML = `<b>${tr(labelFor(e.type))}</b><span>${escapeHtml(tr(e.msg))}</span>`;
  box.prepend(d);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => d.classList.add('bye'), 3600);
  setTimeout(() => d.remove(), 4200);
}
const labelFor = t => ({ tt: 'Contre-la-montre', penalty: 'Pénalité', wx: 'Météo', overtake: 'Dépassement', crash: 'Accident', contact: 'Contact', error: 'Incident', sc: 'Safety car', vsc: 'VSC', green: 'Drapeau vert', pit: 'Stands', fastest: 'Meilleur tour', finish: 'Arrivée', start: 'Départ', info: 'Course' }[t] || 'Course');

/* ---------------- replay de la course ---------------- */
const REC_DT = 0.25, TY = 'SMHIW';
const RP = { on: false, t: 0, end: 0, evIdx: 0, saved: null, drag: false };
/* rembobinage en course : un instantané de la course toutes les 0,5 s (30 dernières secondes),
   on revient en arrière, on choisit le moment et on reprend le volant à partir de là */
const RW = { R: null, snaps: [], last: -1, on: false, cur: null, idx: 0, from: 0, n: 0, DT: 0.5, MAX: 60 };
const rwAvail = () => !!(R && HUM && HUM.human && !R.tt && !R.qualiRun && !R.net && !R.over && !RP.on && !HL.on && RW.R === R && RW.snaps.length);
function rwSnap() {
  const T0 = R.T, rec = R.rec, ev = R.events;
  R.T = null; R.rec = null; R.events = null;   // la piste, l'enregistrement du replay et les messages ne sont pas copiés
  try { return { t: R.t, R: structuredClone(R) }; } finally { R.T = T0; R.rec = rec; R.events = ev; }
}
function rwTick() {
  if (RW.R !== R) { RW.R = R; RW.snaps = []; RW.last = -1; RW.n = 0; }
  if (RW.on || !HUM || !HUM.human || R.tt || R.qualiRun || R.net || R.over || R.phase === 'lights') return;
  if (HUM.state === 'out' || HUM.fin) return;   // on garde les secondes d'avant l'accident
  if (R.t - RW.last < RW.DT) return;
  RW.last = R.t; RW.snaps.push(rwSnap());
  if (RW.snaps.length > RW.MAX) RW.snaps.shift();
}
function rwApply(snap) {
  // replay et messages : copies faites à l'ouverture, pour pouvoir annuler sans rien perdre
  const nr = structuredClone(snap.R), cut = nr.t + 1e-6;
  nr.T = T; nr.events = RW.ev0.filter(e => e.t <= cut);
  nr.rec = RW.rec0 ? { ...RW.rec0, frames: RW.rec0.frames.filter(f => f.t <= cut), next: nr.t, hk: Math.floor(cut / HIN_DT) } : null;
  R = nr; RW.R = R;
  HUM = R.cars.find(c => c.human) || null; if (HUM) HUM.input = R.input;
  Object.assign(R.input, { thr: 0, brk: 0, steer: 0 });
  evIdx = R.events.length; camInit = false; lastTower = 0; acc = 0;
  $('#toasts').innerHTML = ''; $('#dnf').hidden = !R.dnfShown;
  $('#btn-ers').innerHTML = '<small>ERS</small>' + ({ normal: 'NORMAL', attack: 'ATTAQUE', charge: 'RECHARGE' })[R.input.ers]; $('#btn-ers').className = R.input.ers;
}
function rwOpen() {
  if (!rwAvail()) return;
  RW.cur = rwSnap(); RW.on = true; RW.from = R.t; paused = true;
  RW.ev0 = R.events.slice(); RW.rec0 = R.rec ? { ...R.rec, frames: R.rec.frames.slice() } : null;
  document.body.classList.add('rw'); $('#dnf').hidden = true; $('#rwbar').hidden = false;
  const sl = $('#rw-slider'); sl.max = RW.snaps.length - 1;
  // par défaut : 3 s en arrière (ou le plus loin possible)
  const tl = RW.snaps[RW.snaps.length - 1].t;
  let k = RW.snaps.length - 1; while (k > 0 && tl - RW.snaps[k].t < 3) k--;
  sl.value = k; rwSeek(k);
}
function rwSeek(k) {
  if (!RW.on || !RW.snaps.length) return;
  RW.idx = clamp(k | 0, 0, RW.snaps.length - 1);
  rwApply(RW.snaps[RW.idx]); $('#dnf').hidden = true;
  $('#rw-time').textContent = '−' + (RW.from - R.t).toFixed(1).replace('.', ',') + ' s';
}
function rwClose(resume) {
  if (!RW.on) return;
  if (resume) {
    RW.snaps.length = RW.idx + 1; RW.last = R.t; RW.n++;
    R.dnfShown = false; R.rewinds = (R.rewinds || 0) + 1;
    toast({ type: 'info', msg: `Rembobinage : −${(RW.from - R.t).toFixed(1).replace('.', ',')} s`, cars: [] });
  } else rwApply(RW.cur);
  RW.on = false; RW.cur = null; RW.ev0 = RW.rec0 = null;
  document.body.classList.remove('rw'); $('#rwbar').hidden = true;
  paused = false; $('#btn-pause').textContent = $('#btn-pause2').textContent = 'Pause';
  lastT = performance.now();
}
function stepSim(dt) { SIM.step(R, dt); if (R.rec && R.t >= R.rec.next) recFrame(R); if (R.rec && HUM) recInput(); }
/* commandes du joueur pour le replay (10 fois par seconde) : gaz, frein, direction, mode ERS, Overtake, caméra utilisée ;
   par paquets de 1200 échantillons de 6 octets, indexés par le temps de course */
const HIN_DT = 0.1, HIN_N = 1200;
function recInput() {
  const rec = R.rec, h = HUM, k = Math.floor(R.t / HIN_DT); if (rec.hk != null && k <= rec.hk) return;
  if (!rec.hin) { rec.hin = []; rec.hid = h.id; }
  const I = R.input, ci = Math.floor(k / HIN_N), j = (k % HIN_N) * 6;
  while (rec.hin.length <= ci) rec.hin.push(new Int8Array(HIN_N * 6));
  const a = rec.hin[ci]; rec.hk = k;
  a[j] = Math.round(clamp(I.thr || 0, 0, 1) * 100); a[j + 1] = Math.round(clamp(I.brk || 0, 0, 1) * 100); a[j + 2] = Math.round(clamp(I.steer || 0, -1, 1) * 100);
  a[j + 3] = ({ normal: 0, attack: 1, charge: 2 })[I.ers] || 0; a[j + 4] = (I.ot ? 1 : 0) | (h.xmode ? 2 : 0); a[j + 5] = 4 | (effCam() === 'onboard' ? 1 : 0);   // 4 : échantillon présent
}
function hinAt(t) {
  const rec = R && R.rec; if (!rec || !rec.hin) return null;
  const get = k => { const a = rec.hin[Math.floor(k / HIN_N)], j = (k % HIN_N) * 6; return a && a[j + 5] & 4 ? a.subarray(j, j + 6) : null; };
  const k = Math.floor(t / HIN_DT), u = t / HIN_DT - k, A = get(k), B = get(k + 1) || A; if (!A) return null;
  const m = i => (A[i] + (B[i] - A[i]) * u) / 100;
  return { thr: m(0), brk: m(1), steer: m(2), ers: A[3], ot: !!(A[4] & 1), drs: !!(A[4] & 2), onboard: !!(A[5] & 1) };
}
function recStart() { R.rec = R.tt || R.qualiRun ? null : { next: 0, frames: [] }; }
function recFrame(R) {
  const rec = R.rec, n = R.cars.length; rec.next = R.t + REC_DT;
  const f = new Float32Array(n * 7), g = new Uint8Array(n * 2);
  R.cars.forEach((c, i) => {
    const o = i * 7; f[o] = c.dist; f[o + 1] = c.d; f[o + 2] = Math.atan2(c.vd, Math.max(c.v, 3)); f[o + 3] = c.v; f[o + 4] = c.yaw || 0; f[o + 5] = c.soc; f[o + 6] = c.wear;
    g[i * 2] = (c.state === 'pit' ? 1 : 0) | (c.state === 'out' ? 2 : 0) | (c.gone ? 4 : 0) | (c.xmode ? 8 : 0) | (c.otActive ? 16 : 0) | (c.brake > 0.3 ? 32 : 0) | (c.fin ? 64 : 0) | (c.clip ? 128 : 0);
    g[i * 2 + 1] = Math.max(0, TY.indexOf(c.tyre));
  });
  rec.frames.push({ t: R.t, f, g, sc: R.sc ? [R.sc.s, R.sc.d] : null, flag: R.flag, rain: R.wx ? R.wx.rain : 0, wet: R.wet || 0, yel: R.yellows.map(y => y.s) });
}
/* replay : les commandes du joueur à l'écran, avec la vue qu'il avait (TV ou embarquée) */
function rpCtlUi() {
  const has = !!(RP.on && R && R.rec && R.rec.hin); $('#rp-ctl').hidden = !has; if (!has) RP.ctl = false;
  $('#rp-ctl').setAttribute('aria-pressed', String(!!RP.ctl)); $('#rpctl').hidden = !RP.ctl;
}
function rpCtlTick() {
  if (!RP.ctl) return;
  const h = hinAt(RP.t), cv = $('#rpctl'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  if (follow !== R.rec.hid) { follow = R.rec.hid; camInit = false; }
  if (h) { const cm = h.onboard ? 'onboard' : 'tv'; if (camMode !== cm) { camMode = cm; camInit = false; $('#btn-cam').textContent = CAM_MODES.find(m => m[0] === cm)[1]; } }
  g.clearRect(0, 0, W, H); if (!h) return;
  if (R.input) R.input.steer = h.steer;   // le volant de l'embarquée tourne comme celui du joueur
  hlBox(g, 0, 0, W, H, 'rgba(10,12,16,.72)', 14);
  // volant
  const cx = 70, cy = H / 2, r = 46; g.save(); g.translate(cx, cy); g.rotate(h.steer * Math.PI * 0.5);
  g.lineWidth = 9; g.strokeStyle = '#e8e8e8'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8e8e8'; g.fillRect(-r, -5, 2 * r, 10); g.fillRect(-5, 0, 10, r);
  g.fillStyle = '#e10600'; g.fillRect(-4, -r - 5, 8, 12); g.restore();
  // pédales
  const bar = (x, v, col, lab) => { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, 18, 30, H - 46); g.fillStyle = col; const hh = (H - 46) * clamp(v, 0, 1); g.fillRect(x, 18 + H - 46 - hh, 30, hh);
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 12px ${HF.t}`; g.textAlign = 'center'; g.fillText(lab, x + 15, H - 10); };
  bar(140, h.brk, '#ff3b3b', L('FREIN', 'BRAKE')); bar(182, h.thr, '#39ff88', L('GAZ', 'THROTTLE'));
  // ERS, Overtake
  g.textAlign = 'left'; g.font = `800 15px ${HF.t}`;
  const ers = [['NORMAL', '#fff'], [L('ATTAQUE', 'ATTACK'), '#ffd23f'], [L('RECHARGE', 'CHARGE'), '#39c7ff']][h.ers] || ['', '#fff'];
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('ERS', 232, 40); g.fillStyle = ers[1]; g.fillText(ers[0], 232, 60);
  if (h.ot) { hlBox(g, 230, 76, 110, 26, '#b14cff', 7); g.fillStyle = '#fff'; g.fillText('OVERTAKE', 238, 95); }
  if (h.drs) { g.fillStyle = '#39ff88'; g.fillText(L('AÉRO X', 'X-MODE'), 232, 128); }
}
function startReplay() {
  if (!R || !R.rec || R.rec.frames.length < 2) return;
  $('#btn-results').hidden = true;
  const F = R.rec.frames;
  RP.saved = { t: R.t, finishOrder: R.finishOrder.slice(), leaderDone: R.leaderDone, finishedAt: R.finishedAt, sc: R.sc, flag: R.flag, wet: R.wet, rain: R.wx ? R.wx.rain : 0, yellows: R.yellows, ranked: R.ranked };
  RP.on = true; RP.t = F[0].t; RP.end = F[F.length - 1].t;
  // le replay se regarde comme en spectateur : caméras, vitesse, pilote suivi, classement cliquable
  RP.hum = HUM; HUM = null; setupDriveUI();
  seekReplay(RP.t);
  $('#results').hidden = true; $('#rpbar').hidden = false; $('#toasts').innerHTML = '';
  paused = false; ST.speed = 2; $('#btn-speed').textContent = spdLabel(2); $('#btn-pause').textContent = 'Pause';
  camMode = 'auto'; $('#btn-cam').textContent = 'Réalisateur';
  Object.assign(DIR, { until: 0, hot: new Map(), finDone: false, finEnd: 0 }); FIX.lock = false;
  evIdx = R.events.length;
  RP.ctl = false; rpCtlUi();
}
function seekReplay(t) {
  RP.t = clamp(t, R.rec.frames[0].t, RP.end);
  RP.evIdx = R.events.findIndex(e => e.t > RP.t); if (RP.evIdx < 0) RP.evIdx = R.events.length;
  DIR.idx = RP.evIdx; DIR.hot = new Map(); DIR.until = 0; DIR.finDone = false; DIR.finEnd = 0; FIX.lock = false;
  camInit = false;
}
function stopReplay() {
  if (!RP.on) return;
  const S = RP.saved;
  Object.assign(R, { t: S.t, finishOrder: S.finishOrder, leaderDone: S.leaderDone, sc: S.sc, flag: S.flag, wet: S.wet, yellows: S.yellows, ranked: S.ranked });
  if (R.wx) R.wx.rain = S.rain;
  if (CLIP.video) closeClip();
  clipReset();
  RP.on = false; $('#rpbar').hidden = true; $('#results').hidden = false;
  if (RP.ctl && R.input) R.input.steer = 0; RP.ctl = false; rpCtlUi();
  if (RP.hum) { HUM = RP.hum; RP.hum = null; follow = HUM.id; setupDriveUI(); }
}
function applyReplay() {
  const F = R.rec.frames, L = T.L;
  let lo = 0, hi = F.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m].t <= RP.t) lo = m; else hi = m; }
  const a = F[lo], b = F[hi], u = clamp((RP.t - a.t) / Math.max(1e-6, b.t - a.t), 0, 1);
  R.cars.forEach((c, k) => {
    const A = a.f, B = b.f, o = k * 7, jump = Math.abs(B[o] - A[o]) > 200;   // pas d'interpolation à travers la voie des stands
    const lerp = j => jump ? A[o + j] : A[o + j] + (B[o + j] - A[o + j]) * u;
    c.dist = lerp(0); c.s = SIM.mod(c.dist, L); c.d = lerp(1); c.v = lerp(3); c.vd = Math.tan(lerp(2)) * Math.max(c.v, 3); c.yaw = Math.abs(B[o + 4] - A[o + 4]) < 2 ? lerp(4) : A[o + 4]; c.soc = A[o + 5]; c.wear = A[o + 6];
    const fl = a.g[k * 2];
    c.state = fl & 2 ? 'out' : fl & 1 ? 'pit' : 'run'; c.gone = !!(fl & 4); c.xmode = !!(fl & 8); c.otActive = !!(fl & 16);
    c.brake = fl & 32 ? 1 : 0; c.throttle = c.brake ? 0 : 1; c.fin = !!(fl & 64); c.finGhost = c.fin; c.clip = !!(fl & 128);
    c.tyre = TY[a.g[k * 2 + 1]] || 'M'; c.lapsDone = Math.floor(c.dist / L);
  });
  R.t = RP.t; R.flag = a.flag; R.wet = a.wet; if (R.wx) R.wx.rain = a.rain;
  R.sc = a.sc ? { s: a.sc[0], d: a.sc[1], v: 0 } : null;
  R.yellows = a.yel.map(s => ({ s, until: 1e9 }));
  const S = RP.saved;
  R.finishOrder = S.finishOrder.filter(id => R.cars[id].fin);
  R.leaderDone = R.finishOrder.length > 0; R.finishedAt = S.finishedAt;
  const ranked = R.cars.slice().sort((x, y) => {
    const xo = x.state === 'out' ? 1 : 0, yo = y.state === 'out' ? 1 : 0; if (xo !== yo) return xo - yo;
    if (x.fin && y.fin) return R.finishOrder.indexOf(x.id) - R.finishOrder.indexOf(y.id);
    if (x.fin !== y.fin) {
      const f = x.fin ? x : y, o = x.fin ? y : x;
      const fAhead = (f.finLaps ?? Math.floor(f.dist / L)) >= Math.floor(o.dist / L) + 1;
      return (fAhead === x.fin) ? -1 : 1;
    }
    return y.dist - x.dist;
  });
  const lead = ranked[0], li = lead.id * 7;
  // écart en temps : instant où le leader est passé à la distance actuelle de la voiture (comme un vrai chronométrage)
  const tLead = d => {
    let a0 = 0, b0 = lo; if (F[b0].f[li] < d) return RP.t;
    while (b0 - a0 > 1) { const m = (a0 + b0) >> 1; if (F[m].f[li] < d) a0 = m; else b0 = m; }
    const A0 = F[a0], B0 = F[b0], da = A0.f[li], db = B0.f[li];
    return db > da ? A0.t + (B0.t - A0.t) * clamp((d - da) / (db - da), 0, 1) : B0.t;
  };
  ranked.forEach((c, i) => {
    c.pos = i + 1;
    const lb = Math.floor((lead.dist - c.dist) / L);
    c.gap = c.state === 'out' ? null : i === 0 ? 0 : lb >= 1 ? -lb : Math.max(0, RP.t - tLead(c.dist));
    const p = ranked[i - 1];
    c.int = i && c.gap != null && c.gap >= 0 && p.gap != null && p.gap >= 0 ? c.gap - p.gap : null;
  });
  R.ranked = ranked;
  while (RP.evIdx < R.events.length && R.events[RP.evIdx].t <= RP.t) { const e = R.events[RP.evIdx++]; if (RP.t - e.t < 3) toast(e); }
  if (!RP.drag) $('#rp-slider').value = Math.round((RP.t - F[0].t) / Math.max(1, RP.end - F[0].t) * 1000);
  const mm = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  $('#rp-time').textContent = `REPLAY · ${mm(RP.t - F[0].t)} / ${mm(RP.end - F[0].t)}`;
}

/* ---- clip libre : début et fin choisis dans le replay, vidéo verticale (9:16) avec la caméra et le pilote suivis ---- */
const CLIP = { a: null, b: null, video: false, done: false, speed: 1, endT: 0 };
const rpClock = t => { const x = t - R.rec.frames[0].t; return `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`; };
function clipReset() {
  Object.assign(CLIP, { a: null, b: null });
  $('#rpclip').hidden = true; $('#rp-clip').setAttribute('aria-pressed', 'false'); clipUi();
}
function clipUi() {
  const ok = CLIP.a != null && CLIP.b != null && CLIP.b - CLIP.a >= 1;
  $('#clip-a').classList.toggle('set', CLIP.a != null); $('#clip-b').classList.toggle('set', CLIP.b != null);
  $('#clip-a').textContent = CLIP.a != null && R && R.rec ? `Début ${rpClock(CLIP.a)}` : 'Début ici';
  $('#clip-b').textContent = CLIP.b != null && R && R.rec ? `Fin ${rpClock(CLIP.b)}` : 'Fin ici';
  $('#clip-span').textContent = ok ? `${Math.round(CLIP.b - CLIP.a)} s` : CLIP.a == null ? 'Place le début' : 'Place la fin';
  $('#clip-go').disabled = !ok;
  // zone du clip sur la barre de temps
  const sl = $('#rp-slider'), F = R && R.rec && R.rec.frames, pc = t => F ? clamp((t - F[0].t) / Math.max(1, RP.end - F[0].t), 0, 1) * 100 : 0;
  if (!F || (CLIP.a == null && CLIP.b == null)) { sl.style.background = ''; return; }
  const a = pc(CLIP.a ?? CLIP.b), b = pc(CLIP.b ?? CLIP.a), x0 = Math.min(a, b), x1 = Math.max(a, b, x0 + 0.6);
  sl.style.background = `linear-gradient(90deg, transparent ${x0}%, rgba(225,6,0,.55) ${x0}%, rgba(225,6,0,.55) ${x1}%, transparent ${x1}%)`;
}
function clipMark(which) {
  if (!RP.on) return;
  CLIP[which] = RP.t;
  if (CLIP.a != null && CLIP.b != null && CLIP.b < CLIP.a) [CLIP.a, CLIP.b] = [CLIP.b, CLIP.a];
  clipUi();
}
function startClipVideo() {
  if (!RP.on || CLIP.a == null || CLIP.b == null || CLIP.b - CLIP.a < 1) return;
  if (!HL.cv) { HL.cv = $('#hl'); HL.cv.width = HL_W; HL.cv.height = HL_H; HL.g = HL.cv.getContext('2d'); }
  HL.who = null; HL.pd = hlPitData(); HL.pits = HL.pd.pin;
  Object.assign(CLIP, { video: true, done: false, speed: ST.speed, endT: 0 });
  seekReplay(CLIP.a); applyReplay();
  document.body.classList.add('hl');
  renderer.setPixelRatio(1); renderer.setSize(HL_W, HL_H, false);
  camera.aspect = HL_W / HL_H; BASE_FOV = camera.fov = 60; camera.updateProjectionMatrix(); camInit = false;
  paused = false; ST.speed = 1;   // la vidéo est toujours à vitesse réelle
  $('#hl-ui').hidden = false; $('#hl-ui').classList.remove('fade'); $('#hl-rec').hidden = true; $('#hl-share').hidden = true;
  $('#hl-cam').hidden = false; $('#hl-cam').textContent = '🎥 ' + CAM_MODES.find(m => m[0] === camMode)[1];
  if (expOk()) expStart(); else hlRecordStart();
  if (HL.recording) $('#hl-status').textContent = `Enregistrement du clip (${Math.round(CLIP.b - CLIP.a)} s)… tu peux changer de caméra`;
}
function clipStep() {
  if (CLIP.done) return;
  if (HL.recording && !paused) $('#hl-status').textContent = `Enregistrement… ${Math.max(0, Math.ceil(CLIP.b - RP.t))} s restantes · tu peux changer de caméra`;
  if (RP.t >= CLIP.b - 1e-3) { CLIP.done = true; paused = true; $('#hl-cam').hidden = true; if (HL.recording) hlRecordStop(false); }
}
function closeClip() {
  if (!CLIP.video) return;
  if (HL.recording) hlRecordStop(true);
  CLIP.video = false; CLIP.done = false; paused = false; $('#btn-pause').textContent = 'Pause'; ST.speed = CLIP.speed; $('#btn-speed').textContent = spdLabel(ST.speed);
  document.body.classList.remove('hl'); $('#hl-ui').hidden = true; $('#hl-rec').hidden = false; $('#hl-cam').hidden = true;
  renderer.setPixelRatio(QUAL.pr()); resize(); camInit = false;
  $('#btn-cam').textContent = CAM_MODES.find(m => m[0] === camMode)[1];
}
function clipCompose() {
  const g = HL.g, W = HL_W, H = HL_H;
  g.drawImage(renderer.domElement, 0, 0, W, H);
  let gr = g.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 260);
  gr = g.createLinearGradient(0, H - 340, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = gr; g.fillRect(0, H - 340, W, 340);
  g.save(); safeZone(g);
  try {
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, W, 6); g.fillStyle = '#e10600'; g.fillRect(0, 0, W * clamp((RP.t - CLIP.a) / Math.max(1, CLIP.b - CLIP.a), 0, 1), 6);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = '#fff'; g.font = `900 34px ${HF.t}`; g.fillText('PADDOCK', 34, 70);
  g.fillStyle = '#e10600'; g.fillText('26', 34 + g.measureText('PADDOCK ').width, 70);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `700 24px ${HF.t}`; g.fillText(`${T.circ.flag || ''} ${tr(T.circ.name)}`.trim(), 34, 104);
  const fc = R.cars[follow], lead = R.ranked && R.ranked[0];
  const lap = lead ? Math.min(R.laps, Math.max(1, Math.floor(lead.dist / T.L) + 1)) : 1;
  const lapTxt = RP.t < R.startT ? 'GRILLE' : lap === R.laps && !R.leaderDone ? 'DERNIER TOUR' : R.leaderDone ? 'ARRIVÉE' : `TOUR ${lap}/${R.laps}`, lapTr = tr(lapTxt);
  g.font = `800 26px ${HF.m}`; const lw = g.measureText(lapTr).width + 28;
  hlBox(g, W - 34 - lw, 44, lw, 40, lapTxt === 'DERNIER TOUR' ? '#e10600' : 'rgba(10,12,16,.75)', 8);
  g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(lapTr, W - 48, 73); g.textAlign = 'left';
  if (R.flag !== 'green' && R.flag) { const ft = /vsc/.test(R.flag) ? 'VSC' : 'SAFETY CAR'; g.font = `900 22px ${HF.t}`; const fw = g.measureText(ft).width + 24; hlBox(g, W - 34 - fw, 92, fw, 34, '#ffa000', 8); g.fillStyle = '#111'; g.textAlign = 'right'; g.fillText(ft, W - 46, 117); g.textAlign = 'left'; }
  hlTower(g, { focus: follow, rival: -1, near: true });
  hlTicker(g, W, H);
  if (fc) {
    g.fillStyle = tcol(fc); g.fillRect(34, H - 200, 10, 92);
    g.fillStyle = '#fff'; g.font = `900 54px ${HF.t}`; g.fillText(`P${fc.pos} ${fc.code}`, 58, H - 142);
    g.font = `600 26px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText(`${fc.driver.name} · ${fc.team.name}`, 58, H - 112, W - 260);
    hlTyre(g, 74, H - 70, fc.tyre, 20);
    g.font = `700 22px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.8)'; const ns = HL.pits ? HL.pits[fc.id].filter(t => t <= RP.t).length : 0;
    g.fillText(L(`${ns} arrêt${ns > 1 ? 's' : ''}`, `${ns} stop${ns !== 1 ? 's' : ''}`) + (fc.gap > 0 && fc.pos > 1 && RP.t > R.startT + 12 ? ' · +' + fc.gap.toFixed(1) + L(' s du leader', ' s to leader') : ''), 104, H - 62);
    g.textAlign = 'right'; g.font = `700 64px ${HF.m}`; g.fillStyle = '#fff'; g.fillText(Math.round(fc.v * 3.6), W - 34, H - 134);
    g.font = `700 22px ${HF.m}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('KM/H', W - 34, H - 106); g.textAlign = 'left';
  }
  } finally { g.restore(); }
}

/* =====================================================================
   HIGHLIGHTS : les meilleurs moments de la course (2 min max), réalisés en vertical (9:16)
   façon vidéo courte, avec export vidéo (MediaRecorder sur un canevas composité)
   ===================================================================== */
const HL = { on: false, clips: [], i: 0, rt: 0, shot: -1, cv: null, g: null, rec: null, chunks: [], recording: false, total: 0, played: 0, endT: 0 };
const HL_W = 720, HL_H = 1280;
/* zone de sécurité TikTok (image 720×1280) : le haut (onglets), le bas (légende, musique) et la droite (boutons) sont recouverts
   par l'appli ; les textes des vidéos sont réduits et placés dans la zone libre, l'image 3D reste plein cadre */
const SAFE = { l: 40, t: 110, r: 96, b: 290 };
const SAFE_K = Math.min((HL_W - SAFE.l - SAFE.r) / HL_W, (HL_H - SAFE.t - SAFE.b) / HL_H);
function safeZone(g) { if (ST.tiktok) { g.translate(SAFE.l, SAFE.t); g.scale(SAFE_K, SAFE_K); } }
/* contexte d'avant-course pour les highlights : grille, temps de qualif, championnat, forces en présence */
function hlContext(qres) {
  const ctx = { qt: Object.fromEntries((qres || []).map(r => [r.entry.driver.name, r.best])) };
  const teams = activeTeams();
  ctx.perf = teams.map(t => ({ name: t.name, color: t.tv || t.color, r: perfRating(t) })).sort((a, b) => b.r - a.r);
  if (CH.inRace && CH.season) {
    const S = CH.season, { sortD, sortT } = standings();
    ctx.champ = { round: S.round + 1, n: S.rounds.length, year: S.year || 2026,
      d: sortD.map(d => ({ name: d.name, team: d.team, color: d.color, pts: d.pts })), t: sortT.map(t => ({ name: t.name, color: t.color, pts: t.pts })) };
    const ups = (S.rounds[S.round] || {}).upgrades || [];
    ctx.ups = Object.fromEntries(ups.map(u => [u.team, u]));
  }
  return ctx;
}
const hlMax = who => who != null ? 180 : clamp(80 + R.laps * 2, 95, 170);   // 3 min par pilote ; 1 min 35 à 2 min 50 pour la course
/* positions des voitures (ordre de course) à un instant du replay */
function hlFrameAt(t) {
  const F = R.rec.frames; let lo = 0, hi = F.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m].t <= t) lo = m; else hi = m; }
  return F[lo];
}
function hlOrderAt(t) {
  const f = hlFrameAt(t);
  return R.cars.map((c, k) => ({ id: c.id, dist: f.f[k * 7], v: f.f[k * 7 + 3], out: !!(f.g[k * 2] & 2), pit: !!(f.g[k * 2] & 1) }))
    .filter(x => !x.out).sort((a, b) => b.dist - a.dist);
}
const hlPosAt = (id, t) => hlOrderAt(t).findIndex(x => x.id === id) + 1 || 99;
const hlSAt = (id, t) => SIM.mod(hlFrameAt(t).f[id * 7], T.L);
/* entrées / sorties des stands et relais (pneus) de chaque voiture, d'après l'enregistrement */
function hlPitData() {
  const F = R.rec.frames, n = R.cars.length, pin = R.cars.map(() => []), pout = R.cars.map(() => []), stints = R.cars.map((c, k) => [{ t: F[0].t, ty: TY[F[0].g[k * 2 + 1]] || 'M' }]);
  for (let fi = 1; fi < F.length; fi++) for (let k = 0; k < n; k++) {
    const a = F[fi - 1].g[k * 2] & 1, b = F[fi].g[k * 2] & 1;
    if (b && !a) pin[k].push(F[fi].t);
    if (a && !b) pout[k].push(F[fi].t);
    const ty = TY[F[fi].g[k * 2 + 1]] || 'M', st = stints[k];
    if (ty !== st[st.length - 1].ty) st.push({ t: F[fi].t, ty });
  }
  return { pin, pout, stints };
}
/* pilote du jour : la plus belle remontée (places gagnées entre la grille et l'arrivée) */
function hlDotd() {
  const F = hlFinal(), best = F.ids.map((id, i) => ({ id, d: R.cars[id].gridPos - (i + 1) })).filter(x => !F.rows[x.id].out && !F.rows[x.id].dsq).sort((p, q) => q.d - p.d)[0];
  return best && best.d >= 2 ? best.id : null;
}
/* tous les moments de la course : candidats (spectacle) et récit (ce qu'il faut pour comprendre) */
function hlMoments(who, full) {
  const one = who != null, ev = R.events, st = R.startT, ctx = R.hlCtx || {};
  const hum = R.cars.find(c => c.human) || (RP.hum || null);
  const key = id => one ? id === who : !!(hum && id === hum.id);
  const inv = ids => !one || ids.includes(who);
  const lastLapAt = t => { const o = hlOrderAt(t); return o.length && o[0].dist > (R.laps - 1) * T.L; };
  const P = HL.pd || (HL.pd = hlPitData());
  const cand = [];
  // dépassements : regroupés quand une même voiture en passe plusieurs d'affilée (double, triple…)
  const ots = ev.filter(e => e.type === 'overtake' && e.cars.length >= 2 && e.t > st + 4), groups = [];
  for (const e of ots) { const g = groups[groups.length - 1]; if (g && g[0].cars[0] === e.cars[0] && e.t - g[g.length - 1].t < 6) g.push(e); else groups.push([e]); }
  for (const g of groups) {
    const A = R.cars[g[0].cars[0]], vic = g.map(e => R.cars[e.cars[1]]), last = g[g.length - 1];
    if (!inv([A.id, ...vic.map(v => v.id)])) continue;
    const pos = +(/P(\d+)/.exec(last.msg) || [0, 20])[1], n = g.length, ll = lastLapAt(g[0].t), mate = vic.some(v => v.team.name === A.team.name);
    const o = hlOrderAt(g[0].t), va = (o.find(x => x.id === A.id) || {}).v || 0, vb = (o.find(x => x.id === vic[0].id) || {}).v || 0;
    const lost = one && A.id !== who;
    const title = lost ? (pos <= 1 ? 'PERD LA TÊTE' : 'DÉPASSÉ') : n >= 3 ? 'TRIPLE DÉPASSEMENT !' : n === 2 ? 'DOUBLE DÉPASSEMENT !' : pos === 1 ? 'PRISE DE LA TÊTE !' : ll ? 'DANS LE DERNIER TOUR !' : mate ? 'DUEL ENTRE COÉQUIPIERS' : key(A.id) ? 'QUEL DÉPASSEMENT !' : 'DÉPASSEMENT';
    const sub = `${A.code} passe ${vic.map(v => v.code).join(' et ')} · P${pos}` + (g.some(e => /OVERTAKE/.test(e.msg)) ? ' · mode Overtake' : '');
    const score = 120 - pos * 7 + (n - 1) * 30 + (key(A.id) || vic.some(v => key(v.id)) ? 70 : 0) + (ll ? 25 : 0) + (mate ? 12 : 0) + Math.min(25, Math.abs(va - vb) * 2);
    cand.push({ t0: g[0].t - 6, t1: last.t + 2.6, ev: g[0].t, kind: 'overtake', focus: A.id, rival: vic[0].id, passS: hlSAt(A.id, g[0].t), score, title, sub, tag: n > 1 ? 'x' + n : '' });
  }
  for (const e of ev) {
    if ((e.type === 'crash' || e.type === 'contact') && e.cars.length) {
      if (!inv(e.cars)) continue;
      const c = R.cars[e.cars[0]], pos = hlPosAt(c.id, e.t);
      if (e.type === 'contact' && pos > 10 && !e.cars.some(key)) continue;
      if (/touche le mur|Blocage/.test(e.msg) && !e.cars.some(key)) continue;
      cand.push({ t0: e.t - 4.5, t1: e.t + 4, ev: e.t, kind: 'crash', focus: c.id, rival: e.cars[1], passS: hlSAt(c.id, e.t), score: (e.type === 'crash' ? 115 : 70) - pos * 3 + (e.cars.some(key) ? 50 : 0),
        title: e.type === 'crash' ? (/ABANDON/.test(e.msg) ? 'ABANDON' : 'CRASH !') : /Crevaison/.test(e.msg) ? 'CREVAISON !' : 'ACCROCHAGE', sub: e.msg.replace(/^(CRASH ! |ABANDON : )/, '').replace(/ !$/, '').slice(0, 44) });
    } else if (e.type === 'sc' && /DÉPLOYÉE/.test(e.msg)) {
      const o = hlOrderAt(e.t); if (!o.length) continue;
      cand.push({ t0: e.t - 1, t1: e.t + 5, kind: 'sc', focus: one ? who : o[0].id, score: one ? 30 : 55, title: 'SAFETY CAR', sub: 'La course est neutralisée' });
    } else if (e.type === 'pit' && e.cars.length) {
      const c = R.cars[e.cars[0]], pos = hlPosAt(c.id, e.t - 25);
      if (!(one ? c.id === who : pos <= 3 || key(c.id))) continue;
      const m = /— ([\d.]+) s · (.+)$/.exec(e.msg), dur = m ? +m[1] : 2.5;
      cand.push({ t0: e.t - dur - 4, t1: e.t + 3.5, kind: 'pit', focus: c.id, score: (one ? 85 : 60) - pos * 4, title: 'ARRÊT AUX STANDS', sub: `${c.code} · ${dur.toFixed(1)} s · ${m ? m[2].toLowerCase() : ''}` });
    }
  }
  // undercut : une voiture ressort des stands derrière celle qui la suivait avant son arrêt
  R.cars.forEach((B, kb) => P.pout[kb].forEach((tout, i) => {
    const tin = P.pin[kb][i]; if (tin == null || tout - tin > 60) return;
    const before = hlOrderAt(tin - 2), after = hlOrderAt(tout + 3);
    const ib = before.findIndex(x => x.id === B.id); if (ib < 0 || ib > 9) return;
    const A = before[ib + 1]; if (!A || (before[ib].dist - A.dist) / Math.max(30, A.v) > 2.5) return;
    if (!P.pin[A.id].some(t => t < tin && t > tin - 300)) return;   // A s'est arrêté avant B
    const ia = after.findIndex(x => x.id === A.id), ib2 = after.findIndex(x => x.id === B.id);
    if (ia < 0 || ib2 < 0 || ia > ib2 || !inv([A.id, B.id])) return;
    cand.push({ t0: tout - 3, t1: tout + 4.5, kind: 'undercut', focus: B.id, rival: A.id, score: 100 - ib * 6 + (key(A.id) || key(B.id) ? 50 : 0),
      title: 'UNDERCUT RÉUSSI !', sub: `${R.cars[A.id].code} passe devant ${B.code} grâce aux stands` });
  }));
  // batailles : deux voitures à moins de 0,7 s pendant au moins 12 s
  const F = R.rec.frames, step = Math.max(1, Math.round(2 / REC_DT)), run = new Map(), seen = new Map();
  for (let fi = 0; fi < F.length; fi += step) {
    const t = F[fi].t; if (t < st + 15) continue;
    const o = hlOrderAt(t), now = new Set();
    for (let i = 1; i < Math.min(o.length, one ? 22 : 14); i++) {
      const a = o[i - 1], b = o[i]; if (a.pit || b.pit) continue;
      if ((a.dist - b.dist) / Math.max(b.v, 30) > 0.7) continue;
      const k = a.id + '-' + b.id; now.add(k);
      const r = run.get(k) || { from: t }; run.set(k, r);
      const pairKey = [a.id, b.id].sort().join('-');
      if (t - r.from >= 12 && !seen.has(pairKey) && inv([a.id, b.id])) {
        seen.set(pairKey, t);
        const A = R.cars[b.id], B = R.cars[a.id], mate = A.team.name === B.team.name;
        cand.push({ t0: t - 8, t1: t, kind: 'battle', focus: A.id, rival: B.id, score: 95 - (i + 1) * 5 + (key(A.id) || key(B.id) ? 45 : 0) + Math.min(20, t - r.from - 12) + (mate ? 10 : 0),
          title: mate ? 'GUERRE INTERNE !' : i === 1 ? 'BATAILLE POUR LA VICTOIRE' : 'BATAILLE !', sub: `${A.code} dans les échappements de ${B.code} · P${i}` });
      }
    }
    for (const k of [...run.keys()]) if (!now.has(k)) run.delete(k);
  }
  // vidéo d'un pilote : un passage par tour pour suivre toute sa course (position, écart)
  if (one && R.cars[who]) {
    const Fr = R.rec.frames, me = R.cars[who];
    for (let L = 2; L <= R.laps; L++) {
      const target = (L - 1 + 0.35) * T.L, fr = Fr.find(f => f.f[who * 7] >= target);
      if (!fr || (fr.g[who * 2] & 3)) continue;
      const o = hlOrderAt(fr.t), i = o.findIndex(x => x.id === who); if (i < 0) continue;
      const ah = o[i - 1], gap = ah ? (ah.dist - o[i].dist) / Math.max(30, o[i].v) : 0;
      const rd = clamp(hlMax(who) / R.laps * 0.6, 10, 24);   // course courte : passages plus longs pour bien la raconter
      cand.push({ t0: fr.t - rd * 0.4, t1: fr.t + rd * 0.6, kind: 'run', focus: who, rival: ah ? ah.id : undefined, score: 18 + (gap < 1.5 ? 12 : 0) + (i < 10 ? 6 : 0),
        title: L === R.laps ? 'DERNIER TOUR' : `TOUR ${L}/${R.laps}`, sub: `${me.code} · P${i + 1}${ah ? ` · à ${gap.toFixed(1)} s de ${R.cars[ah.id].code}` : ' · en tête'}` });
    }
  }
  // ---- le RÉCIT de la course (vidéo complète) : tout ce qu'il faut pour comprendre, gardé en priorité ----
  const story = [];
  if (!one && !full) {
    const endT = R.leaderDone && R.winnerId != null && R.cars[R.winnerId].finishT ? R.cars[R.winnerId].finishT : R.t;
    const lead = R.cars.find(c => c.id === (hlOrderAt(st + 9)[0] || {}).id);
    const retires = ev.filter(e => e.type === 'crash' && /^ABANDON/.test(e.msg) && e.cars.length);
    // 1. chaque changement de leader (tenu au moins 6 s)
    const seq = []; let cur = lead ? lead.id : null;
    for (let t = st + 10; t < endT - 1; t += 1) { const o = hlOrderAt(t); if (o.length && o[0].id !== cur) { seq.push({ t, id: o[0].id, from: cur }); cur = o[0].id; } }
    const changes = [];   // on ignore les passages en tête de moins de 6 s, et le « précédent leader » est le dernier retenu
    seq.forEach((x, i) => { if ((seq[i + 1] ? seq[i + 1].t : endT) - x.t < 6) return; const prev = changes.length ? changes[changes.length - 1].id : lead && lead.id;
      if (prev != null && prev !== x.id) changes.push({ t: x.t, id: x.id, from: prev }); });
    for (const x of changes) {
      const A = R.cars[x.id], B = R.cars[x.from];
      const ot = cand.find(c => c.kind === 'overtake' && c.focus === A.id && Math.abs(c.ev - x.t) < 5);
      if (ot) { ot.prio = 100; ot.title = 'NOUVEAU LEADER !'; story.push(ot); continue; }
      const dnf = retires.find(e => e.cars[0] === B.id && Math.abs(e.t - x.t) < 8);
      if (dnf) { dnf.heir = A.code; continue; }   // raconté par le clip de l'abandon
      const pitted = P.pin[B.id].some(t => t > x.t - 40 && t < x.t + 3);
      story.push({ t0: x.t - 1.5, t1: x.t + 6, kind: 'lead', focus: A.id, rival: B.id, prio: 100, score: 200,
        title: 'NOUVEAU LEADER !', sub: pitted ? `${A.code} en tête : ${B.code} est aux stands` : `${A.code} prend la tête devant ${B.code}` });
    }
    // 2. tous les abandons (deux abandons dans le même accident = un seul moment)
    for (let i = 0; i < retires.length; i++) {
      const e = retires[i], grp = [e]; while (retires[i + 1] && retires[i + 1].t - e.t < 3) grp.push(retires[++i]);
      const cs = grp.map(x => R.cars[x.cars[0]]), why = (/— (.+)$/.exec(e.msg) || [])[1] || '';
      const heir = grp.find(x => x.heir);
      story.push({ t0: e.t - 5, t1: e.t + 3, ev: e.t, kind: 'crash', focus: cs[0].id, rival: cs[1] ? cs[1].id : e.cars[1], prio: 90, score: 180, passS: hlSAt(cs[0].id, e.t),
        title: 'ABANDON !', sub: (cs.length > 1 ? `${cs.map(c => c.code).join(' et ')} hors course` : `${cs[0].code} · ${why}`) + (heir ? ` · ${heir.heir} hérite de la tête` : '') });
    }
    // 3. safety car / VSC : déploiement + qui en profite pour s'arrêter
    const neutral = ev.filter(e => (e.type === 'sc' && /DÉPLOYÉE/.test(e.msg)) || (e.type === 'vsc' && e.msg === 'VIRTUAL SAFETY CAR'));
    for (const e of neutral) {
      const vsc = e.type === 'vsc', g = ev.find(x => x.type === 'green' && x.t > e.t), t2 = g ? g.t : endT;
      const o = hlOrderAt(e.t); if (!o.length) continue;
      story.push({ t0: e.t - 1, t1: e.t + 4.5, kind: 'sc', focus: o[0].id, prio: 85, score: 150, title: vsc ? 'VIRTUAL SAFETY CAR' : 'SAFETY CAR !', sub: 'La course est neutralisée' });
      const pitters = R.cars.map((c, k) => ({ c, t: P.pin[k].find(t => t > e.t && t < t2) })).filter(x => x.t != null).map(x => ({ ...x, pos: o.findIndex(y => y.id === x.c.id) + 1 })).sort((a, b) => a.pos - b.pos);
      if (pitters.length) {
        const f = pitters[0], stay = !pitters.some(x => x.c.id === o[0].id) ? ` · ${R.cars[o[0].id].code} reste en piste` : '';
        const tyN = {}; pitters.forEach(x => { const sx = P.stints[x.c.id].find(y => y.t > x.t); if (sx) tyN[sx.ty] = (tyN[sx.ty] || 0) + 1; });
        const ty = Object.keys(tyN).sort((a, b) => tyN[b] - tyN[a])[0];
        story.push({ t0: f.t - 2.5, t1: f.t + 5, kind: 'scpit', focus: f.c.id, prio: 80, score: 140, title: 'COUP STRATÉGIQUE',
          sub: `Arrêt « gratuit » sous ${vsc ? 'VSC' : 'SC'} : ${pitters.slice(0, 4).map(x => x.c.code).join(', ')}${pitters.length > 4 ? ` +${pitters.length - 4}` : ''}${ty ? ' → ' + SIM.COMP[ty].name.toLowerCase() : ''}${stay}` });
      }
    }
    // 4. pluie : quand elle arrive / s'arrête, et le premier qui change de pneus
    const wetTy = ty => ty === 'I' || ty === 'W';
    for (const e of ev.filter(e => e.type === 'wx' && /pluie (commence|s'arrête)/.test(e.msg))) {
      const on = /commence/.test(e.msg), o = hlOrderAt(e.t); if (!o.length) continue;
      story.push({ t0: e.t - 1, t1: e.t + 4.5, kind: 'rain', focus: o[0].id, prio: 75, score: 130,
        title: on ? 'LA PLUIE ARRIVE !' : 'FIN DE LA PLUIE', sub: on ? 'Qui osera passer aux pneus pluie en premier ?' : 'La piste sèche : qui repassera aux slicks ?' });
      let first = null;
      R.cars.forEach((c, k) => { const sw = P.stints[k].find((x, i) => i > 0 && x.t > e.t && (on ? wetTy(x.ty) && !wetTy(P.stints[k][i - 1].ty) : !wetTy(x.ty) && wetTy(P.stints[k][i - 1].ty))); if (sw && (!first || sw.t < first.t)) first = { c, t: sw.t, ty: sw.ty }; });
      if (first) story.push({ t0: first.t - 6, t1: first.t + 3, kind: 'pit', focus: first.c.id, prio: 72, score: 120,
        title: on ? 'LE PREMIER À CHANGER' : 'RETOUR AUX SLICKS', sub: `${first.c.code} passe en ${SIM.COMP[first.ty].name.toLowerCase()} · P${hlPosAt(first.c.id, first.t - 20)}` });
    }
    // 5. undercuts (déjà détectés) + overcuts : un pilote reste plus longtemps en piste et ressort devant celui qui s'est arrêté avant
    R.cars.forEach((B, kb) => P.pout[kb].forEach((tout, i) => {
      const tin = P.pin[kb][i]; if (tin == null || tout - tin > 60) return;
      const after = hlOrderAt(tout + 3), ib2 = after.findIndex(x => x.id === B.id); if (ib2 < 0 || ib2 > 9) return;
      for (const A of R.cars) {
        if (A === B) continue;
        const ta = P.pin[A.id].filter(t => t < tin - 4 && t > tin - 300).pop(); if (ta == null) continue;   // A s'est arrêté avant B
        const before = hlOrderAt(ta - 2), ia0 = before.findIndex(x => x.id === A.id), ib0 = before.findIndex(x => x.id === B.id);
        if (ia0 < 0 || ib0 !== ia0 + 1 || (before[ia0].dist - before[ib0].dist) / Math.max(30, before[ib0].v) > 3) continue;   // B juste derrière A avant
        const ia = after.findIndex(x => x.id === A.id); if (ia < 0 || ia < ib2) continue;                                   // B ressort devant
        cand.push({ t0: tout - 3, t1: tout + 4.5, kind: 'undercut', focus: B.id, rival: A.id, score: 100 - ib2 * 6, title: 'OVERCUT RÉUSSI !', sub: `${B.code} reste en piste et ressort devant ${A.code}` });
      }
    }));
    cand.filter(c => c.kind === 'undercut').sort((a, b) => b.score - a.score).slice(0, 4).forEach(c => { c.prio = 65; story.push(c); });
  }

  return { cand, story };
}
function buildHighlights(who, full) {
  const one = who != null, ev = R.events, st = R.startT, ctx = R.hlCtx || {};
  const hum = R.cars.find(c => c.human) || (RP.hum || null);
  const P = HL.pd || (HL.pd = hlPitData());
  const { cand, story } = hlMoments(who, full);
  // obligatoires : départ et arrivée
  const o0 = hlOrderAt(st + 9);
  const start = { t0: st - 1.5, t1: st + 10, kind: 'start', focus: one ? who : (o0.length ? o0[0].id : 0), mid: o0.length > 6 ? o0[5].id : null, score: 1e4, title: 'EXTINCTION DES FEUX !', sub: `${T.circ.flag} ${T.circ.name} · ${R.laps} tours` };
  const win = R.winnerId != null ? R.winnerId : hlFinal().ids[0], done = RP.on && RP.saved ? RP.saved.leaderDone : R.leaderDone;
  const fin = done && win != null && R.cars[win].finishT > 0 ? { t0: R.cars[win].finishT - 7, t1: R.cars[win].finishT + 3.5, kind: 'finish', focus: win, score: 1e4, title: 'VICTOIRE !', sub: R.cars[win].driver.name } : null;
  const W0 = one ? R.cars[who] : hum;
  const FR = hlFinal(), fpos = W0 ? FR.ids.indexOf(W0.id) + 1 : 99;
  const myFin = W0 && FR.rows[W0.id].finishT > 0 && !FR.rows[W0.id].out && W0.id !== win && (one || fpos <= 12) ? { t0: W0.finishT - (one ? 9 : 5), t1: W0.finishT + 2.5, kind: 'myfinish', focus: W0.id, score: 600, title: 'ARRIVÉE', sub: `${W0.driver.name} · P${fpos}` } : null;
  const effDur = c => c.t1 - c.t0;
  let chosen = [start];
  if (fin && (!one || win === who)) chosen.push(fin);
  if (myFin) chosen.push(myFin);
  if (full) {
    // version complète (pilote du jour) : tous ses dépassements et tous ses arrêts, quitte à fusionner les moments qui se suivent
    const must = cand.filter(c => (c.kind === 'overtake' && c.focus === who) || (c.kind === 'pit' && c.focus === who) || (c.kind === 'undercut' && c.rival === who));
    const all = [...chosen, ...must].sort((a, b) => a.t0 - b.t0), merged = [];
    for (const c of all) {
      const p = merged[merged.length - 1];
      if (p && c.t0 < p.t1 + 1) {
        p.t1 = Math.max(p.t1, c.t1); p.merged = true;
        if (c.kind === 'overtake') { p.nOt = (p.nOt || (p.kind === 'overtake' ? 1 : 0)) + 1; if (p.kind === 'overtake' || p.kind === 'pit') { p.kind = 'overtake'; p.title = 'REMONTÉE !'; p.sub = `${R.cars[who].code} enchaîne ${p.nOt} dépassements`; p.passS = p.passS ?? c.passS; p.ev = p.ev ?? c.ev; } }
      } else merged.push(Object.assign({}, c));
    }
    chosen = merged;
  }
  // cartons fixes (introduction, bilans) : leur durée compte dans la limite
  const cardDur = one ? 3 + 4 : 2.2 + 3 + (ctx.champ ? 3.2 : 0) + 3.2 + 2.8 + 4 + (ctx.champ ? 3 : 0) + 3;
  let total = chosen.reduce((a, c) => a + effDur(c), 0) + cardDur;
  const free = c => chosen.every(x => c.t1 + 1 < x.t0 || c.t0 > x.t1 + 1);
  const MAX = full ? 420 : hlMax(who), maxBattles = full ? 8 : Math.max(1, Math.round(MAX / 35));
  let battles = 0;
  const take = c => {
    if (c.kind === 'battle' && battles >= maxBattles) return false;
    const cutF = one && myFin ? myFin : fin;
    if (c.t0 < st - 1 || (cutF && c.t1 > cutF.t0 + 1 && c.kind !== 'crash')) return false;
    const d = effDur(c);
    if (total + d > MAX || !free(c)) return false;
    chosen.push(c); total += d; if (c.kind === 'battle') battles++;
    return true;
  };
  // d'abord le récit (on s'autorise à dépasser un peu la durée prévue pour ne rien rater), puis le spectacle
  if (story.length) {
    const cutF = fin;
    for (const c of story.sort((a, b) => b.prio - a.prio || a.t0 - b.t0)) {
      if (chosen.includes(c) || c.t0 < st - 1 || (cutF && c.t1 > cutF.t0 + 1 && c.kind !== 'crash')) continue;
      const clash = chosen.find(x => !(c.t1 + 1 < x.t0 || c.t0 > x.t1 + 1));
      if (clash) {   // deux moments du récit qui se chevauchent : un seul clip, qui raconte les deux
        if (clash.kind !== 'start' && clash.kind !== 'finish') {
          if (c.prio >= 80) { clash.t0 = Math.min(clash.t0, c.t0); clash.t1 = Math.max(clash.t1, c.t1); }
          if (!clash.sub.includes(c.sub)) clash.sub += ` · ${c.title === clash.title ? c.sub : c.prio >= 80 ? c.title.replace(/ !$/, '').toLowerCase() : c.title.replace(/ !$/, '').toLowerCase() + ' : ' + c.sub}`;
        }
        continue;
      }
      if (total + effDur(c) > MAX * 1.35) continue;
      chosen.push(c); total += effDur(c);
    }
    // et au moins 3 beaux dépassements pour le spectacle
    let spec = 0;
    for (const c of cand.filter(c => c.kind === 'overtake' && !chosen.includes(c)).sort((a, b) => b.score - a.score)) {
      if (spec >= 3) break; if (free(c) && c.t0 >= st - 1 && (!fin || c.t1 < fin.t0)) { chosen.push(c); total += effDur(c); spec++; }
    }
  }
  // le meilleur moment de chaque tranche de course (pour raconter toute la course), puis les meilleurs restants
  const end = fin ? fin.t0 : R.t, nb = Math.max(3, Math.round(MAX / 24));
  const sorted = cand.sort((a, b) => b.score - a.score);
  for (let k = 0; k < nb; k++) {
    const a = st + (end - st) * k / nb, b = st + (end - st) * (k + 1) / nb;
    for (const c of sorted) if (c.t0 >= a && c.t0 < b && take(c)) break;
  }
  for (const c of sorted) { if (chosen.includes(c)) continue; take(c); if (total > MAX - 5) break; }
  const clips = chosen.sort((a, b) => a.t0 - b.t0);
  // vidéo d'un pilote : la caméra reste sur lui, l'autre voiture du moment devient l'adversaire
  if (one) for (const c of clips) if (c.focus !== who) { c.rival = c.focus; c.focus = who; }
  // habillage : cartons d'introduction, bilan du 1er tour, stratégies à mi-course, résultats
  const card = (name, dur, bgT, focus, extra) => Object.assign({ kind: 'card', card: name, dur, bgT, focus, title: '', sub: '' }, extra || {});
  const pole = R.cars.slice().sort((a, b) => a.gridPos - b.gridPos)[0];
  const out = [];
  if (one) out.push(card('driver', full ? 3.5 : 3, st - 1.5, who));
  else {
    // accroche : 3 s du plus gros moment de la course, avant même le titre — seulement s'il est vraiment fort
    // (accident, prise de la tête, dépassement multiple, dernier tour) ; sinon la vidéo démarre direct sur le titre
    const shock = c => c.ev != null && (c.kind === 'crash' ? c.prio >= 90 || /CRASH|ABANDON/.test(c.title || '') : c.kind === 'overtake' && (c.prio === 100 || /TÊTE|LEADER|DOUBLE|TRIPLE|DERNIER/.test(c.title || '')));
    const best = clips.filter(shock).sort((a, b) => b.score - a.score)[0];
    if (best) out.push(Object.assign({}, best, { t0: best.ev - 2.4, t1: best.ev + 1.2, hook: true, merged: false, hookWhy: best.kind === 'crash' ? 'crash' : /DOUBLE|TRIPLE/.test(best.title) ? 'multi' : /DERNIER/.test(best.title) ? 'last' : 'lead', title: best.kind === 'crash' ? 'ÇA VA MAL FINIR…' : 'REGARDE ÇA…', sub: 'La suite dans la vidéo 👀' }));
    out.push(card('title', 2.2, st - 1.5, pole.id));
    if (ctx.champ) out.push(card('champ', 3.2, st - 1.5, pole.id));
    out.push(card('perf', 3, st - 1.5, pole.id));
    out.push(card('grid', 3.2, st - 1.5, pole.id));
  }
  const lap1T = (() => { const lead = R.cars.find(c => c.id === (o0[0] || {}).id); for (const f of R.rec.frames) if (Math.max(...R.cars.map((c, k) => f.f[k * 7])) > T.L * 1.02) return f.t; return st + 90; })();
  const midT = st + (end - st) * 0.55;
  let stratDone = one || !P.pin.some(x => x.length);
  clips.forEach((c, i) => {
    out.push(c);
    if (c.kind === 'start' && !one) out.push(card('lap1', 2.8, Math.min(lap1T, (clips[i + 1] || {}).t0 || lap1T), c.focus, { at: lap1T }));
    if (!stratDone && c.t1 > midT && c.kind !== 'start' && c.kind !== 'finish' && c.kind !== 'myfinish') { stratDone = true; out.push(card('strat', 4, c.t1, c.focus, { at: c.t1 })); }
  });
  const lastT = (clips[clips.length - 1] || start).t1;
  if (one) out.push(card('driverEnd', 4, lastT, who));
  else {
    out.push(card('results', 5.5, lastT, win != null ? win : pole.id));
    if (ctx.champ) out.push(card('champ2', 4.5, lastT, win != null ? win : pole.id));
    out.push(card('champT', 4, lastT, win != null ? win : pole.id));
  }
  return out;
}
/* =====================================================================
   ÉPISODE = un Grand Prix, en PARTIES (une vidéo chacune) : 1. présentation, 2. grille, 3. le départ (≈ 35 s de course),
   puis la course relais par relais. Une safety car, un VSC ou la pluie ouvrent une nouvelle partie, et un relais chargé
   est coupé en plusieurs parties d'environ 2 min. Chaque dépassement de la course est montré.
   ===================================================================== */
const EP_START = 36;    // secondes de course montrées dans la partie du départ
const EP_TARGET = 110;  // secondes de moments au plus par partie (≈ 2 min avec les cartons)
const EP_P0 = 3;        // numéro de la partie du départ (1 : présentation du GP, 2 : grille)
function hlFinishT() {
  const win = R.winnerId != null ? R.winnerId : hlFinal().ids[0], done = RP.on && RP.saved ? RP.saved.leaderDone : R.leaderDone;
  return done && win != null && R.cars[win].finishT > 0 ? { id: win, t: R.cars[win].finishT } : null;
}
const hlLapAt = t => { const o = hlOrderAt(t); return o.length ? clamp(Math.floor(o[0].dist / T.L) + 1, 1, R.laps) : 1; };
/* tous les dépassements, regroupés quand une même voiture en passe plusieurs d'affilée (double, triple…) ; k : numéro dans la course */
function hlOtGroups() {
  if (HL.otOf === R) return HL.ots;
  const out = [];
  for (const e of R.events) {
    if (e.type !== 'overtake' || e.cars.length < 2) continue;
    const pos = +(/P(\d+)/.exec(e.msg) || [0, 99])[1], ot = /OVERTAKE/.test(e.msg);
    let g = null; for (let i = out.length - 1; i >= 0 && e.t - out[i].t1 < 6; i--) if (out[i].a === e.cars[0]) { g = out[i]; break; }
    if (g) { g.vic.push(e.cars[1]); g.ts.push(e.t); g.t1 = e.t; g.pos = pos; g.ot = g.ot || ot; g.n++; }
    else out.push({ t: e.t, t1: e.t, ts: [e.t], a: e.cars[0], vic: [e.cars[1]], pos, ot, n: 1 });
  }
  let k = 0; for (const g of out) { g.k = k + 1; k += g.n; }
  HL.otOf = R; HL.ots = out; return out;
}
const andList = a => a.length < 2 ? a[0] || '' : a.slice(0, -1).join(', ') + L(' et ', ' and ') + a[a.length - 1];
/* un dépassement à l'écran : titre, phrase, instant (at : la manœuvre vient de se faire) */
function epMark(g) {
  const A = R.cars[g.a], vic = g.vic.map(i => R.cars[i]), mate = g.n === 1 && vic[0].team.name === A.team.name;
  const back = g.n === 1 && R.events.some(e => e.type === 'overtake' && e.cars[0] === g.vic[0] && e.cars[1] === g.a && e.t < g.t && e.t > g.t - 40);   // la riposte
  const o = hlOrderAt(g.t), ll = o.length && o[0].dist > (R.laps - 1) * T.L;
  const title = g.n >= 4 ? L(`${g.n} VOITURES D'UN COUP !`, `${g.n} CARS IN ONE GO!`) : g.n === 3 ? L('TRIPLE DÉPASSEMENT !', 'TRIPLE OVERTAKE!') : g.n === 2 ? L('DOUBLE DÉPASSEMENT !', 'DOUBLE OVERTAKE!')
    : g.pos === 1 ? L('PRISE DE LA TÊTE !', 'INTO THE LEAD!') : back ? L('LA RIPOSTE !', 'STRAIGHT BACK PAST!') : ll ? L('DANS LE DERNIER TOUR !', 'ON THE LAST LAP!') : mate ? L('DUEL ENTRE COÉQUIPIERS', 'TEAMMATE BATTLE') : L('DÉPASSEMENT', 'OVERTAKE');
  const sub = L(`${A.code} passe ${andList(vic.map(v => v.code))} · P${g.pos}`, `${A.code} passes ${andList(vic.map(v => v.code))} · P${g.pos}`) + (g.ot ? ' · Overtake' : '');
  return { t: g.t, at: g.t - 2.2, a: g.a, vic: g.vic, n: g.n, pos: g.pos, k: g.k, back, title, sub, score: 120 - g.pos * 7 + (g.n - 1) * 30 + (g.pos === 1 ? 30 : 0) + (ll ? 20 : 0) };
}
/* les dépassements d'une fenêtre en clips continus : la caméra va chercher chaque dépassement (un plan par voiture, sans
   coupe pendant la manœuvre). Deux dépassements au même moment à deux endroits du circuit : le second est remontré juste après */
function epOtClips(gs) {
  const out = [], later = [];
  let C = null;
  const close = () => {
    if (!C) return;
    const D = C.t1 - C.t0, m0 = C.marks[0];
    out.push({ t0: C.t0, t1: C.t1, kind: 'overtake', ev: m0.t, focus: m0.a, rival: m0.vic[0], marks: C.marks, title: m0.title, sub: m0.sub,
      score: Math.max(...C.marks.map(m => m.score)), shots: [['tv', 0, m0.a], ...C.sw.map(([t, id]) => ['tv', (t - C.t0) / D, id])] });
    C = null;
  };
  for (const g of gs) {
    const m = epMark(g), t0 = g.t - 5.5, t1 = g.t1 + 1.8;
    if (C && t0 <= C.t1 + 1.5) {
      const f = hlFrameAt(g.t - 3), grow = () => { C.marks.push(m); C.t1 = Math.max(C.t1, t1); C.last = Math.max(C.last, g.t1); };
      if (Math.abs(f.f[g.a * 7] - f.f[C.follow * 7]) < 150) { grow(); continue; }               // au même endroit : le plan en cours le montre
      if (g.t - 4 >= C.last + 0.8) { C.sw.push([g.t - 4, g.a]); C.follow = g.a; grow(); continue; }   // la caméra va le chercher
      later.push(g); continue;
    }
    close();
    C = { t0, t1, follow: g.a, last: g.t1, marks: [m], sw: [] };
  }
  close();
  if (later.length) out.push(...epOtClips(later));
  return out;
}
/* contenu d'une partie de course : tous les dépassements, les faits de course, les arrêts et les coups de stratégie */
function epBody(a, b, last, M) {
  const P = HL.pd, fin = hlFinishT(), { cand, story } = M;
  const inT = t => t >= a && t < b, anchor = c => c.ev ?? (c.t0 + c.t1) / 2, cp = c => Object.assign({}, c);
  const ovl = (c, x) => !(c.t1 + 1 < x.t0 || c.t0 > x.t1 + 1);
  const body = epOtClips(hlOtGroups().filter(g => last ? g.t >= a : inT(g.t)));   // dernière partie : jusqu'au dernier pilote à l'arrivée
  const add = (c, force) => { if (!force && body.some(x => ovl(c, x))) return false; body.push(c); return true; };
  // 1. faits de course (neutralisation, abandon, changement de leader, arrivée) : toujours montrés, chacun avec son propre clip
  // (la caméra sur la voiture concernée) ; seuls l'accident et la safety car qu'il provoque, ou deux accidents au même endroit, font un clip
  const facts = [];
  for (const c of story.filter(c => c.prio >= 80 && c.kind !== 'overtake' && inT(anchor(c))).sort((x, y) => y.prio - x.prio || x.t0 - y.t0)) {
    const x = facts.find(x => x.kind === 'crash' && (c.kind === 'sc' || c.kind === 'crash') && ovl(c, x));
    if (!x) { facts.push(cp(c)); continue; }
    if ((x.also || []).includes(c.kind)) continue;
    x.t0 = Math.min(x.t0, c.t0); x.t1 = Math.max(x.t1, c.t1); x.also = [...(x.also || []), c.kind];
    if (c.kind === 'crash') x.sub += ' · ' + c.sub;   // l'accident d'à côté : qui et comment
    else if (!x.sub.includes(c.title)) x.sub += ' · ' + c.title.replace(/ !$/, '').toLowerCase();
  }
  if (last && fin) facts.push({ t0: fin.t - 7, t1: fin.t + 3.5, kind: 'finish', focus: fin.id, title: 'VICTOIRE !', sub: R.cars[fin.id].driver.name });
  facts.forEach(c => add(c, true));
  // 2. stratégie : arrêts du top 10 (avec le pneu chaussé), undercuts / overcuts, changements de pneus sous la pluie, incidents
  const strat = [], seen = new Set();
  for (const e of R.events) {
    if (e.type !== 'pit' || !e.cars.length || !inT(e.t)) continue;
    const c = R.cars[e.cars[0]], pos = hlPosAt(c.id, e.t - 25), m = /— ([\d.]+) s · (.+)$/.exec(e.msg), dur = m ? +m[1] : 2.5;
    if (pos > 10) continue;
    const s = P.stints[c.id].find(x => x.t > e.t - dur - 4 && x.t < e.t + 5.5);
    strat.push({ t0: e.t - dur - 4, t1: e.t + 3.5, kind: 'pit', focus: c.id, pos, ty: s && s.ty, score: 75 - pos * 4, title: 'ARRÊT AUX STANDS', sub: `${c.code} · P${pos} · ${dur.toFixed(1)} s · ${m ? m[2].toLowerCase() : ''}` });
  }
  for (const c of [...story.filter(c => c.prio < 80 && c.kind !== 'overtake'), ...cand.filter(c => c.kind === 'undercut' || c.kind === 'crash')]) {
    if (seen.has(c) || !inT(anchor(c))) continue; seen.add(c);
    if (c.kind === 'crash' && facts.some(f => f.kind === 'crash' && Math.abs(anchor(f) - anchor(c)) < 4)) continue;   // déjà raconté (abandon)
    strat.push(cp(c));
  }
  const dup = (c, x) => c.kind === x.kind && c.focus === x.focus && Math.abs(c.t0 - x.t0) < 6;
  const kept = [];
  for (const c of strat.sort((x, y) => (y.prio || 0) - (x.prio || 0) || (y.score || 0) - (x.score || 0))) {
    if (kept.some(x => dup(c, x)) || body.some(x => dup(c, x))) continue;
    const must = c.prio != null || c.kind === 'undercut' || /CREVAISON/.test(c.title) || (c.kind === 'pit' && c.pos <= 4);
    if (add(c, must)) kept.push(c);
  }
  // 3. partie calme : quelques passages pour suivre la course (les voitures les plus proches du top 8), jamais sous neutralisation
  const neutral = []; let n0 = null;
  for (const e of R.events) { if ((e.type === 'sc' && /DÉPLOYÉE/.test(e.msg)) || (e.type === 'vsc' && e.msg === 'VIRTUAL SAFETY CAR')) n0 = e.t; else if (e.type === 'green' && n0 != null) { neutral.push([n0, e.t]); n0 = null; } }
  if (n0 != null) neutral.push([n0, 1e9]);
  const tot = () => body.reduce((s, c) => s + c.t1 - c.t0, 0);
  for (let k = 0; tot() < 50 && k < 12; k++) {
    const t = a + (b - a) * ((k * 0.618) % 1 * 0.8 + 0.1), o = hlOrderAt(t);
    if (neutral.some(([x, y]) => t > x - 8 && t < y + 10)) continue;
    let best = null; for (let i = 1; i < Math.min(8, o.length); i++) { if (o[i].pit || o[i - 1].pit) continue; const gap = (o[i - 1].dist - o[i].dist) / Math.max(30, o[i].v); if (!best || gap < best.gap) best = { i, gap }; }
    if (!best) continue;
    const A = R.cars[o[best.i].id], B = R.cars[o[best.i - 1].id];
    if (body.some(x => x.kind === 'run' && x.focus === A.id && x.rival === B.id)) continue;
    add({ t0: t - 6, t1: t + 8, kind: 'run', focus: A.id, rival: B.id, gap: best.gap, pos: best.i + 1, title: `TOUR ${hlLapAt(t)}/${R.laps}`, sub: `${A.code} à ${best.gap.toFixed(1)} s de ${B.code} · P${best.i + 1}` });
  }
  body.sort((x, y) => x.t0 - y.t0);
  // un clip qui revient en arrière dans le temps (deux choses au même moment) : « au même moment »
  let mx = -1e9; for (const c of body) { c.again = c.kind !== 'finish' && c.t0 < mx - 0.5; mx = Math.max(mx, c.t1); }
  return body;
}
function hlEpisodes() {
  if (HL.epsOf === R && HL.epsLang === ST.lang && HL.eps) return HL.eps;
  const st = R.startT, P = HL.pd = hlPitData(), F = R.rec.frames, fin = hlFinishT();
  const endT = fin ? fin.t + 3.5 : F[F.length - 1].t, a0 = st + EP_START;
  const lead = hlOrderAt(endT - 4)[0], lapLen = (endT - 4 - st) / Math.max(1, lead ? lead.dist / T.L : 1);
  // ruptures : safety car, VSC, pluie (la partie suivante commence juste avant)
  const brk = [];
  for (const e of R.events) {
    const why = e.type === 'sc' && /DÉPLOYÉE/.test(e.msg) ? 'sc' : e.type === 'vsc' && e.msg === 'VIRTUAL SAFETY CAR' ? 'vsc' : e.type === 'wx' && /pluie commence/.test(e.msg) ? 'rain' : e.type === 'wx' && /pluie s'arrête/.test(e.msg) ? 'dry' : null;
    if (!why || e.t < a0 + 0.5 * lapLen || e.t > endT - lapLen) continue;
    if (brk.length && e.t - brk[brk.length - 1].t < 1.5 * lapLen) continue;
    brk.push({ t: e.t - 2, why });
  }
  // vagues d'arrêts (hors arrêts provoqués par une neutralisation / la pluie) : le relais se termine quand la vague est finie
  const stops = [];
  R.cars.forEach((c, k) => P.pin[k].forEach((tin, i) => {
    const tout = P.pout[k][i]; if (tout == null || (fin && tin > fin.t)) return;
    if (brk.some(b => tin > b.t && tin < b.t + 3 * lapLen)) return;
    stops.push({ tin, tout });
  }));
  stops.sort((x, y) => x.tin - y.tin);
  const waves = []; let cur = null;
  for (const s of stops) { if (cur && s.tin - cur.last < 2.2 * lapLen) { cur.outs.push(s.tout); cur.last = s.tin; } else waves.push(cur = { outs: [s.tout], last: s.tin }); }
  const cuts = brk.map(b => ({ t: b.t, why: b.why }));
  for (const w of waves) {
    w.n = w.outs.length; w.outs.sort((x, y) => x - y);
    const t = w.outs[Math.floor(0.7 * (w.n - 1))] + 4;   // quand la plupart sont passés : les retardataires ouvrent le relais suivant
    if (w.n < Math.max(4, Math.round(R.cars.length / 4)) || t < a0 + 1.5 * lapLen || t > endT - 1.2 * lapLen || cuts.some(c => Math.abs(c.t - t) < 1.5 * lapLen)) continue;
    cuts.push({ t, why: 'pit' });
  }
  cuts.sort((x, y) => x.t - y.t);
  // chaque relais, coupé en parties d'environ EP_TARGET secondes de moments (entre deux clips, jamais pendant un dépassement)
  const M = hlMoments(null, false), eps = [{ kind: 'start', t0: st - 2.5, t1: a0, lapA: 1, lapB: 1 }];
  let from = 'start', t0 = a0, n = 0;
  for (const c of [...cuts, { t: endT, why: 'finish' }]) {
    if (c.why !== 'finish' && c.t - t0 < 1.2 * lapLen) continue;
    n++;
    const body = epBody(t0, c.t, c.why === 'finish', M), tot = body.reduce((s, x) => s + x.t1 - x.t0, 0), k = Math.max(1, Math.ceil(tot / EP_TARGET));
    const ts = [t0];
    let mx = -1e9, cum = 0;
    for (let j = 0; j < body.length - 1 && ts.length < k; j++) {
      mx = Math.max(mx, body[j].t1); cum += body[j].t1 - body[j].t0;
      const nx = body[j + 1], cut = (mx + nx.t0) / 2;
      if (cum >= tot * ts.length / k && nx.t0 > mx + 0.5 && cut - ts[ts.length - 1] > 25 && c.t - cut > 25) ts.push(cut);
    }
    ts.push(c.t);
    for (let j = 0; j + 1 < ts.length; j++) eps.push({ kind: 'stint', n, k: j + 1, kn: ts.length - 1, t0: ts[j], t1: ts[j + 1], from: j ? 'cont' : from, to: j + 2 < ts.length ? 'cont' : c.why });
    from = c.why; t0 = c.t;
  }
  eps.forEach((e, i) => {
    e.i = i; e.of = eps.length; e.no = i + EP_P0; e.tot = eps.length + EP_P0 - 1; e.last = i === eps.length - 1;
    if (e.kind === 'stint') { e.lapA = hlLapAt(e.t0 + 1); e.lapB = e.last && fin ? R.laps : hlLapAt(e.t1 - 1); e.body = epBody(e.t0, e.t1, e.last, M); }
    else e.body = [];
    const ins = g => (g.t >= e.t0 && (g.t < e.t1 || e.last)) || (e.kind === 'start' && g.t < e.t1);
    e.nOt = hlOtGroups().filter(ins).reduce((s, g) => s + g.n, 0);
  });
  HL.epsOf = R; HL.epsLang = ST.lang; HL.eps = eps;
  return eps;
}
const epLabel = E => E.kind === 'start' ? L('Le départ', 'The start') : L(`Relais ${E.n}`, `Stint ${E.n}`) + (E.kn > 1 ? ` (${E.k}/${E.kn})` : '');
const epCause = w => ({ sc: L('safety car', 'safety car'), vsc: L('VSC', 'VSC'), rain: L('pluie', 'rain'), dry: L('fin de la pluie', 'drying track') })[w] || '';
const epTag = E => { const ch = (R.hlCtx || {}).champ; return (ch ? L(`Épisode ${ch.round} · `, `Episode ${ch.round} · `) : '') + L(`Partie ${E.no}`, `Part ${E.no}`); };
function buildEpisode(E) {
  const st = R.startT, card = (name, dur, bgT, focus, extra) => Object.assign({ kind: 'card', card: name, dur, bgT, focus, title: '', sub: '' }, extra || {});
  const out = [], grid = R.cars.slice().sort((a, b) => a.gridPos - b.gridPos), fin = hlFinishT();
  if (E.kind === 'start') {
    const o0 = hlOrderAt(st + 9), lead = o0.length ? o0[0].id : grid[0].id;
    out.push(card('title', 2.4, st - 1.5, grid[0].id, { ep: E }));
    out.push(card('grid', 3.4, st - 1.5, grid[0].id));
    const c = { t0: st - 2.5, t1: E.t1, kind: 'start', long: true, focus: lead, mid: o0.length > 6 ? o0[5].id : null, title: 'EXTINCTION DES FEUX !', sub: `${T.circ.flag} ${T.circ.name} · ${R.laps} tours` };
    c.shots = epShots(c);
    out.push(c);
    out.push(card('lap1', 5.5, E.t1, lead, { at: E.t1, ep: E }));
    return out;
  }
  const a = E.t0, b = E.t1, clips = E.body.map(c => Object.assign({}, c));
  // accroche : 3 s du plus beau moment de la partie, avant le titre — seulement s'il est vraiment fort (accident, prise de la tête,
  // dépassement multiple, dernier tour) ; sinon la partie démarre direct (pas de « regarde ça » pour rien)
  let hk = null;
  for (const c of clips) {
    if (c.kind === 'overtake') for (const m of c.marks) {
      const why = m.n >= 2 ? 'multi' : m.pos === 1 ? 'lead' : /DERNIER|LAST/.test(m.title) ? 'last' : null;
      if (why && m.t > a + 20 && (!hk || m.score > hk.score)) hk = { score: m.score, t: m.t, focus: m.a, rival: m.vic[0], crash: false, why };
    } else if (c.kind === 'crash' && c.ev != null && c.ev > a + 20 && /ABANDON|CRASH/.test(c.title || '') && (!hk || 150 > hk.score)) hk = { score: 150, t: c.ev + 1.5, focus: c.focus, rival: c.rival, crash: true, why: 'crash' };
  }
  if (hk) out.push({ t0: hk.t - 3.6, t1: hk.t + 0.4, kind: hk.crash ? 'crash' : 'overtake', focus: hk.focus, rival: hk.rival, hook: true, hookWhy: hk.why, title: hk.crash ? 'ÇA VA MAL FINIR…' : 'REGARDE ÇA…', sub: 'La suite dans la vidéo 👀' });
  const lead = hlOrderAt(a + 0.5)[0];
  out.push(card('stint', 4.5, a + 0.5, lead ? lead.id : grid[0].id, { at: a + 0.5, ep: E }));
  out.push(...clips);
  const lastT = (clips[clips.length - 1] || { t1: b }).t1;
  if (E.last && fin) {
    out.push(card('results', 6, lastT, fin.id));
    if ((R.hlCtx || {}).champ) out.push(card('champ2', 5, lastT, fin.id));
    out.push(card('champT', 4.5, lastT, fin.id));
  } else {
    const ob = hlOrderAt(b - 0.5)[0];
    out.push(card('stintEnd', 5.5, Math.min(lastT, b - 0.5), ob ? ob.id : grid[0].id, { at: b - 0.5, ep: E }));
  }
  return out;
}
/* plans du long départ : hélico sur les feux, puis la caméra va chercher chaque dépassement du peloton */
function epShots(c) {
  const L = c.t1 - c.t0, fr = t => clamp((t - c.t0) / L, 0, 1), st = R.startT;
  const sh = [['heli', 0], ['tv', fr(st + 5)], ['heli', fr(st + 13), c.mid]];
  let last = st + 13;
  for (const e of R.events) {
    if (e.type !== 'overtake' || e.cars.length < 2 || e.t < st + 9 || e.t > c.t1 - 1) continue;
    const pos = +(/P(\d+)/.exec(e.msg) || [0, 99])[1];
    if (pos > 14 || e.t - 3.5 < last + 4.5) continue;
    sh.push(['tv', fr(e.t - 3.5), e.cars[0]]); last = e.t - 3.5;
  }
  if (last < c.t1 - 10) sh.push(['heli', fr(Math.max(last + 5, c.t1 - 8)), c.focus]);
  return sh;
}
/* plans de caméra par type de moment : [caméra, début (fraction du moment), voiture suivie] — plans larges pour voir l'action.
   Jamais de coupe pendant l'action : le plan qui montre le dépassement / l'accrochage commence ~3 s avant et dure jusqu'après. */
function hlShots(c) {
  if (c.shots) return c.shots;
  if (c.kind === 'overtake') return [['tv', 0]];   // dépassement (ou remontée fusionnée) : un seul plan, sans aucune coupe
  if (c.merged && c.ev != null) { const L = c.t1 - c.t0; return [['heli', 0], ['tv', Math.max(0.05, (c.ev - c.t0 - 3) / L)]]; }   // moment fusionné : un seul long plan
  if (c.ev != null && c.kind === 'crash') {
    const L = c.t1 - c.t0, e = (c.ev - c.t0) / L, cut = Math.max(0.12, e - 3 / L);
    const wide = c.kind === 'crash' ? 'heli' : 'tv';
    return [['heli', 0], [wide, cut], ...(e + 1.6 / L < 0.95 ? [['heli', e + 1.6 / L]] : [])].filter((x, i, a) => !i || x[0] !== a[i - 1][0]);
  }
  switch (c.kind) {
    case 'card': return [['orbit', 0]];
    case 'start': return [['heli', 0], ['tv', 0.3], ['heli', 0.62, c.mid]];
    case 'battle': return [['tv', 0], ['heli', 0.4], ['fixed', 0.68]];
    case 'crash': return [['tv', 0], ['fixed', 0.38], ['heli', 0.7]];
    case 'pit': return [['heli', 0], ['tv', 0.55]];
    case 'run': return [['tv', 0], ['fixed', 0.4], ['heli', 0.72]];
    case 'undercut': return [['heli', 0], ['tv', 0.5, c.rival]];
    case 'lead': return [['tv', 0]];
    case 'scpit': case 'rain': return [['heli', 0]];
    case 'sc': return [['heli', 0]];
    case 'finish': case 'myfinish': return [['tv', 0], ['heli', 0.4], ['fixed', 0.62]];
  }
  return [['tv', 0]];
}
function hlRate() { return 1; }   // pas de ralenti : tout est montré à vitesse réelle
const hlDur = c => c.kind === 'card' ? c.dur : c.t1 - c.t0;
function hlRestart() { HL.played = 0; HL.endT = 0; HL.done = false; if (HL.edit) { editAudioStop(); HL.i = -1; editStep(0); } else hlSeek(0); }
function hlSeek(i) {
  HL.i = i; const c = HL.clips[i]; if (!c) return;
  HL.rt = Math.max(R.rec.frames[0].t, c.kind === 'card' ? Math.min(c.bgT, RP.end) : c.t0); HL.shot = -1; HL.cardT = 0;
  seekReplay(HL.rt); RP.t = HL.rt; applyReplay();
  follow = c.focus; camInit = false; HL.clipStart = HL.played; HL.orbit0 = Math.random() * 6.28;
  if (c.kind === 'finish' || c.kind === 'myfinish') { DIR.finDone = true; }
}
function startHighlights(record, who, full, ep) {
  if (!R || !R.rec || R.rec.frames.length < 20) return;
  if (!RP.on) startReplay();
  HL.edit = null; HL.mwait = false;
  HL.who = ep != null || who == null ? null : who;
  HL.pd = hlPitData(); HL.pits = HL.pd.pin;
  hlFinal(); HL.podium = finalOrder().slice(0, 3);
  HL.full = !!full && HL.who != null;
  HL.ep = ep != null ? hlEpisodes()[ep] : null;
  HL.clips = HL.ep ? buildEpisode(HL.ep) : buildHighlights(HL.who, HL.full);
  if (!HL.clips.length) return;
  HL.on = true; HL.played = 0; HL.endT = 0; HL.done = false; HL.endDur = 3;
  HL.total = HL.clips.reduce((a, c) => a + hlDur(c), 0) + 3;
  if (!HL.cv) { HL.cv = $('#hl'); HL.cv.width = HL_W; HL.cv.height = HL_H; HL.g = HL.cv.getContext('2d'); }
  document.body.classList.add('hl');
  renderer.setPixelRatio(1); renderer.setSize(HL_W, HL_H, false);
  camera.aspect = HL_W / HL_H; BASE_FOV = camera.fov = 60; camera.updateProjectionMatrix();
  paused = false; ST.speed = 1;
  $('#hl-ui').hidden = false; $('#hl-status').textContent = ''; hlShowUi();
  hlSeek(0);
  if (COM.on) comAudio();
  comSet(comHLLines());
  if (record) comReady(() => expOk() ? expStart() : hlRecordStart());
}
function hlShowUi() { HL.uiT = 3.5; $('#hl-ui').classList.remove('fade'); }
function stopHighlights() {
  if (!HL.on) return;
  HL.on = false; if (HL.recording) hlRecordStop(true);
  editAudioStop(); HL.edit = null; HL.mwait = false;
  comSet([]); COM.after = null;
  document.body.classList.remove('hl'); $('#hl-ui').hidden = true;
  renderer.setPixelRatio(QUAL.pr()); resize();
  camMode = 'auto'; $('#btn-cam').textContent = 'Réalisateur';
  stopReplay();
}
/* avance le temps des highlights (appelé à chaque image à la place du replay normal) */
function hlStep(dt) {
  dt = Math.max(0, dt);
  if (HL.uiT > 0 && !HL.recording && (HL.uiT -= dt) <= 0) $('#hl-ui').classList.add('fade');
  if (HL.edit) return editStep(dt);
  if (HL.done) return;   // fin : on reste sur le carton final
  if (COM.wait) return;   // le commentaire se prépare : la vidéo attend
  comTick(HL.played);
  if (HL.endT) { HL.endT -= dt; HL.played += dt; if (HL.endT <= 0) { HL.done = true; if (HL.recording) hlRecordStop(false); } return; }
  const c = HL.clips[HL.i];
  HL.played += dt;
  if (c.kind === 'card') {   // carton : l'image de fond reste figée, la caméra tourne lentement
    HL.cardT += dt;
    if (HL.shot !== 0) { HL.shot = 0; FIX.lock = false; camMode = 'orbit'; camInit = false; }
    if (HL.cardT >= c.dur) { if (HL.i + 1 < HL.clips.length) hlSeek(HL.i + 1); else HL.endT = HL.endDur || 3; }
    return;
  }
  HL.rt += dt * hlRate(c, HL.rt);
  if (HL.rt >= c.t1) {
    if (HL.i + 1 < HL.clips.length) hlSeek(HL.i + 1);
    else { HL.endT = HL.endDur || 3; }
    return;
  }
  RP.t = Math.min(HL.rt, RP.end); applyReplay();
  // plan courant
  const fr = (HL.rt - c.t0) / (c.t1 - c.t0), shots = hlShots(c);
  let k = 0; for (let j = 0; j < shots.length; j++) if (fr >= shots[j][1]) k = j;
  if (k !== HL.shot) {
    HL.shot = k; const cam = shots[k][0];
    follow = HL.who == null && shots[k][2] != null ? shots[k][2] : c.focus;
    if (cam === 'fixed') hlFixCam(c, follow); else FIX.lock = false;
    camMode = cam; camInit = false;
  }
}
/* caméra posée au bord de la piste, juste après l'endroit du dépassement / de l'arrivée : les voitures arrivent vers elle */
function hlFixCam(c, id) {
  const fc = R.cars[id], fin = c.kind === 'finish' || c.kind === 'myfinish';
  const at = fin ? 28 : c.passS != null ? SIM.mod(c.passS + 28, T.L) : SIM.mod(fc.s + fc.v * 1.6, T.L);
  const i = SIM.idxOf(T, at), side = fin ? -T.pitSide : -(T.csign[i] || 1);
  Object.assign(FIX, { s: at, d: side * (T.w / 2 + (T.street ? 1.2 : 6)), h: T.street ? 12 : 8, id, lock: true, fresh: true });
}
/* ---------- habillage de l'image (dessiné dans la vidéo) ---------- */
const HF = { t: '"Titillium Web", "Arial Black", sans-serif', m: '"JetBrains Mono", monospace' };
const tcol = c => c.team.tv || c.team.color;
function hlBox(g, x, y, w, h, fill, r) { g.fillStyle = fill; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r || 0) : g.rect(x, y, w, h); g.fill(); }
function hlTyre(g, x, y, ty, r) {
  const col = SIM.COMP[ty] ? SIM.COMP[ty].col : '#ccc';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill(); g.lineWidth = Math.max(2, r * 0.27); g.strokeStyle = col; g.stroke();
  g.fillStyle = col; g.font = `900 ${Math.round(r * 1.1)}px ${HF.t}`; g.textAlign = 'center'; g.fillText(ty, x, y + r * 0.4); g.textAlign = 'left';
}
function hlCompose() {
  if (HL.edit) return editCompose();
  const g = HL.g, W = HL_W, H = HL_H;
  const c = HL.clips[HL.i];
  // montage nerveux : petit zoom + flash à chaque nouveau plan, « coup » de zoom au moment du dépassement, l'image tremble à l'accident
  let z = 1, sx = 0, sy = 0, fl = 0;
  if (c && c.kind !== 'card' && !HL.endT && !HL.done) {
    const k = HL.played - HL.clipStart;
    if (k < 0.3) { z = 1 + 0.08 * (1 - k / 0.3) ** 2; fl = 0.3 * Math.max(0, 1 - k / 0.14); }
    for (const te of c.marks ? c.marks.map(m => m.t) : c.ev != null ? [c.ev] : []) {
      const x = HL.rt - te; if (x < 0 || x > 0.8) continue;
      if (c.kind === 'crash') { const amp = 13 * (1 - x / 0.8); sx = (Math.random() * 2 - 1) * amp; sy = (Math.random() * 2 - 1) * amp; z = Math.max(z, 1 + amp * 2.4 / W); }
      else if (x < 0.35) z = Math.max(z, 1 + 0.05 * (1 - x / 0.35) ** 2);
    }
  }
  g.drawImage(renderer.domElement, (W - W * z) / 2 + sx, (H - H * z) / 2 + sy, W * z, H * z);
  if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, W, H); }
  let gr = g.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 260);
  gr = g.createLinearGradient(0, H - 340, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = gr; g.fillRect(0, H - 340, W, 340);
  g.save(); safeZone(g);
  try {
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, W, 6); g.fillStyle = '#e10600'; g.fillRect(0, 0, W * Math.min(1, HL.played / HL.total), 6);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = '#fff'; g.font = `900 34px ${HF.t}`; g.fillText('PADDOCK', 34, 70);
  g.fillStyle = '#e10600'; g.fillText('26', 34 + g.measureText('PADDOCK ').width, 70);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `700 24px ${HF.t}`; g.fillText(`${T.circ.flag || ''} ${tr(T.circ.name)}${HL.who != null ? ' · ' + R.cars[HL.who].code : ''}${HL.ep ? ' · ' + epTag(HL.ep).toUpperCase() : ''}`.trim(), 34, 104, W - 250);
  if (HL.endT || HL.done) { if (HL.ep && !HL.ep.last) hlNextCard(g, W, H); else hlEndCard(g, W, H); return; }
  if (c.kind === 'card') { hlCard(g, W, H, c); return; }
  // dépassement en cours (clip qui en enchaîne plusieurs) : le dernier qui s'est produit, sinon le prochain
  const mk = c.marks ? c.marks.filter(m => m.at <= HL.rt).pop() || null : null, cur = mk || (c.marks ? c.marks[0] : null);
  const fid = cur ? cur.a : c.focus, rid = cur ? cur.vic : [c.rival];
  const fc = R.cars[follow], lead = R.ranked && R.ranked[0];
  const lap = lead ? Math.min(R.laps, Math.max(1, Math.floor(lead.dist / T.L) + 1)) : 1;
  // tour en cours (en rouge au dernier tour)
  const lapTxt = c.kind === 'start' && HL.rt < R.startT ? 'GRILLE' : lap === R.laps && !R.leaderDone ? 'DERNIER TOUR' : R.leaderDone ? 'ARRIVÉE' : `TOUR ${lap}/${R.laps}`, lapTr = tr(lapTxt);
  g.font = `800 26px ${HF.m}`; const lw = g.measureText(lapTr).width + 28;
  hlBox(g, W - 34 - lw, 44, lw, 40, lapTxt === 'DERNIER TOUR' ? '#e10600' : 'rgba(10,12,16,.75)', 8);
  g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(lapTr, W - 48, 73); g.textAlign = 'left';
  if (R.flag !== 'green' && R.flag) { const ft = /vsc/.test(R.flag) ? 'VSC' : 'SAFETY CAR'; g.font = `900 22px ${HF.t}`; const fw = g.measureText(ft).width + 24; hlBox(g, W - 34 - fw, 92, fw, 34, '#ffa000', 8); g.fillStyle = '#111'; g.textAlign = 'right'; g.fillText(ft, W - 46, 117); g.textAlign = 'left'; }
  if (fc) {   // fiche de la voiture suivie : en haut à droite, sous les bandeaux (le milieu de l'image reste à la voiture)
    const bw = 318, bx = W - 34 - bw, by = 412;
    hlBox(g, bx, by, bw, 112, 'rgba(10,12,16,.78)', 10); g.fillStyle = tcol(fc); g.fillRect(bx, by, 8, 112);
    g.fillStyle = '#fff'; g.font = `900 40px ${HF.t}`; g.fillText(`P${fc.pos} ${fc.code}`, bx + 22, by + 44);
    g.textAlign = 'right'; g.font = `700 40px ${HF.m}`; g.fillText(Math.round(fc.v * 3.6), bx + bw - 62, by + 44);
    g.font = `700 16px ${HF.m}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('KM/H', bx + bw - 14, by + 44); g.textAlign = 'left';
    g.font = `600 20px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText(`${fc.driver.name} · ${fc.team.name}`, bx + 22, by + 72, bw - 36);
    hlTyre(g, bx + 36, by + 94, fc.tyre, 13);
    g.font = `700 17px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.8)'; const ns = HL.pits ? HL.pits[fc.id].filter(t => t <= RP.t).length : 0;
    g.fillText(L(`${ns} arrêt${ns > 1 ? 's' : ''}`, `${ns} stop${ns !== 1 ? 's' : ''}`) + ` · ${L('usure', 'wear')} ${Math.round(clamp(fc.wear || 0, 0, 1) * 100)} %` + (fc.gap > 0 && fc.pos > 1 && HL.rt > R.startT + 12 ? ' · +' + fc.gap.toFixed(1) + L(' s', ' s') : ''), bx + 58, by + 100, bw - 70);
    for (const id of [fid, ...rid]) {
      const o = R.cars[id]; if (!o || o.gone) continue;
      const p = carPose(o), v = new THREE.Vector3(p.x, 2.2, -p.y).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H - 18;
      g.font = `900 26px ${HF.t}`; const tw = g.measureText(o.code).width + 22;
      g.fillStyle = 'rgba(10,12,16,.78)'; g.fillRect(x - tw / 2, y - 30, tw, 36);
      g.fillStyle = tcol(o); g.fillRect(x - tw / 2, y - 30, 5, 36);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(o.code, x + 2, y - 3); g.textAlign = 'left';
    }
  }
  { const o = R.cars[follow]; if (o && !o.gone) { const p = carPose(o), v = new THREE.Vector3(p.x, 1, -p.y).project(camera); HL.fy = v.z < 1 && Math.abs(v.x) <= 1.1 ? (1 - v.y) / 2 * H : null; } else HL.fy = null; }   // hauteur de la voiture suivie à l'image (les textes l'évitent)
  hlTower(g, c, fid, rid);
  hlTicker(g, W, H);
  if (HL.full || HL.ep) {   // compteur de dépassements (pilote du jour : les siens ; épisode : toute la course)
    const n = R.events.filter(e => e.type === 'overtake' && (HL.ep || e.cars[0] === HL.who) && e.t <= RP.t).length;
    g.font = `900 22px ${HF.t}`; const tx = `${tr('DÉPASSEMENTS')} ${n}`, w = g.measureText(tx).width + 28;
    hlBox(g, W - 34 - w, 140, w, 40, '#d4af37', 8); g.fillStyle = '#111'; g.textAlign = 'right'; g.fillText(tx, W - 48, 168); g.textAlign = 'left';
  }
  // retour en arrière dans le temps (deux moments au même instant)
  if (c.again && !c.hook && HL.rt - c.t0 < 2.8) {
    g.font = `900 24px ${HF.t}`; const tx = L('⟲ AU MÊME MOMENT…', '⟲ MEANWHILE…'), w = g.measureText(tx).width + 28;
    hlBox(g, W - 34 - w, 540, w, 44, '#ffd400', 8); g.fillStyle = '#111'; g.textAlign = 'right'; g.fillText(tx, W - 48, 570); g.textAlign = 'left';
  }
  // titre du moment, en bas de l'image (le classement occupe la gauche) : le mot-clé « claque » (zoom), puis la phrase qui explique
  const since = c.marks ? (mk ? HL.rt - mk.at : -1) : HL.played - HL.clipStart;
  if (since >= 0 && since < 2.9) {
    const a = Math.min(1, (2.9 - since) / 0.35), pop = since < 0.18 ? 0.6 + since / 0.18 * 0.55 : since < 0.3 ? 1.15 - (since - 0.18) / 0.12 * 0.15 : 1;
    const cTitle = tr(mk ? mk.title : c.title), cSub = tr(mk ? mk.sub : c.sub), Y = comCapOn() ? 1056 : 1000;   // en bas : la voiture suivie est au milieu de l'image
    g.save(); g.globalAlpha = a;
    g.font = `900 64px ${HF.t}`; const tw = Math.min(W - 60, g.measureText(cTitle).width + 40);
    g.translate(34 + tw / 2, Y + 40); g.scale(pop, pop); g.translate(-(34 + tw / 2), -(Y + 40));
    g.fillStyle = '#e10600'; g.fillRect(24, Y, tw, 80);
    g.fillStyle = '#fff'; g.fillText(cTitle, 44, Y + 62, W - 90);
    g.restore(); g.save(); g.globalAlpha = a * Math.min(1, Math.max(0, (since - 0.25) / 0.25));
    if (comCapOn()) g.globalAlpha = 0;   // les sous-titres du commentaire prennent la place de la phrase d'explication
    g.font = `700 30px ${HF.t}`;
    // sous-titre sur 2 lignes max (lisible sur téléphone)
    const lines = []; let ln = '';
    for (const w of cSub.split(' ')) { const nx = ln ? ln + ' ' + w : w; if (g.measureText(nx).width > W - 100 && ln) { lines.push(ln); ln = w; } else ln = nx; }
    if (ln) lines.push(ln);
    if (lines.length > 2) { lines[1] = lines.slice(1).join(' '); lines.length = 2; }
    const sw = Math.min(W - 60, Math.max(...lines.map(l => g.measureText(l).width)) + 34), sh = 48 + (lines.length - 1) * 38;
    g.fillStyle = 'rgba(10,12,16,.85)'; g.fillRect(24, Y + 84, sw, sh);
    const fo = R.cars[fid]; if (fo && c.kind !== 'sc' && c.kind !== 'rain') { g.fillStyle = tcol(fo); g.fillRect(24, Y + 84, 6, sh); }
    g.fillStyle = '#fff'; lines.forEach((l, j) => g.fillText(l, 42, Y + 118 + j * 38, W - 90));
    g.restore();
  }
  } finally {
    // sous-titres : tout en bas (le milieu de l'image reste libre pour la voiture suivie)
    comCaption(g, HL.played, W / 2, 1152, W - 90);
    g.restore();
  }
}
/* bandeaux d'info (à droite, sous le tour) : dépassements, arrêts, abandons, pénalités, meilleur tour, météo */
function hlTicker(g, W, H) {
  const ev = R.events, out = [], ep = !!HL.ep, life = ep ? 4.2 : 3.2, code = i => R.cars[i] ? R.cars[i].code : '?';
  for (let i = Math.max(0, RP.evIdx - 80); i < RP.evIdx; i++) {
    const e = ev[i]; if (!e || RP.t - e.t > life || RP.t < e.t) continue;
    if (e.type === 'fastest') out.push(['#b36bff', 'MEILLEUR TOUR', e.msg.replace('Meilleur tour : ', '')]);
    else if (e.type === 'penalty' && e.cars.length && !/Changement de pneus/.test(e.msg)) out.push(['#ffa000', 'PÉNALITÉ', e.msg.replace(/^PÉNALITÉ de /, '').replace(/^FAUX DÉPART de /, 'faux départ · ')]);
    else if (e.type === 'pit' && e.cars.length && (ep || (HL.who == null ? (R.cars[e.cars[0]].pos || 99) <= 8 : e.cars[0] === HL.who))) { const m = /— ([\d.]+) s · (.+)$/.exec(e.msg); if (m) out.push(['#39c7ff', 'STANDS', `${code(e.cars[0])} · ${m[1]} s · ${m[2].toLowerCase()}`]); }
    else if (e.type === 'wx') out.push(['#6fb6ff', 'MÉTÉO', e.msg]);
    else if (ep && e.type === 'crash' && /^ABANDON/.test(e.msg) && e.cars.length) out.push(['#ff4d4d', L('ABANDON', 'OUT'), code(e.cars[0])]);
    else if (ep && e.type === 'overtake' && e.cars.length >= 2) {
      const gp = hlOtGroups().find(x => x.a === e.cars[0] && x.ts.includes(e.t)), j = gp ? gp.ts.indexOf(e.t) + 1 : 1, pos = (/P(\d+)/.exec(e.msg) || [0, '?'])[1];
      out.push(['#39ff88', j >= 3 ? L('TRIPLE', 'TRIPLE') : j === 2 ? L('DOUBLE', 'DOUBLE') : L('DÉPASSEMENT', 'OVERTAKE'), L(`${code(e.cars[0])} passe ${code(e.cars[1])} · P${pos}`, `${code(e.cars[0])} passes ${code(e.cars[1])} · P${pos}`)]);
    }
  }
  out.slice(ep ? -4 : -2).reverse().forEach(([col, k, txt], j) => {   // le plus récent en haut
    k = tr(k); txt = tr(txt);
    const y = 196 + j * 50; g.font = `900 18px ${HF.t}`; const kw = g.measureText(k).width + 20; g.font = `700 22px ${HF.t}`; const w = Math.min(W - 34 - 300, kw + g.measureText(txt).width + 28);
    hlBox(g, W - 34 - w, y, w, 42, 'rgba(10,12,16,.85)', 8); hlBox(g, W - 34 - w, y, kw, 42, col, 8);
    g.fillStyle = '#111'; g.font = `900 18px ${HF.t}`; g.fillText(k, W - 34 - w + 10, y + 28);
    g.fillStyle = '#fff'; g.font = `700 22px ${HF.t}`; g.fillText(txt, W - 34 - w + kw + 11, y + 29, w - kw - 18);
  });
}
/* classement complet, à gauche de l'image : position, pneu, jauge d'usure, arrêts, écart (vidéo d'un pilote : ses voisins) */
function hlTower(g, c, fid, rid) {
  if (!R.ranked) return;
  const all = R.ranked.filter(o => !o.gone || o.state === 'out'), fc = R.cars[follow];
  let list;
  if (c.only) list = all.filter(o => c.only.includes(o.id));   // edit : seulement les pilotes concernés
  else if (HL.who != null) {   // vidéo d'un pilote : 2 voitures devant, 2 derrière
    const me = all.indexOf(R.cars[HL.who]), i0 = clamp((me < 0 ? all.length : me) - 2, 0, Math.max(0, all.length - 5));
    list = all.slice(i0, i0 + 5);
  } else if (c.near) {   // clip manuel : pilote suivi, celui devant et celui derrière
    const me = all.indexOf(fc), i0 = clamp((me < 0 ? all.length : me) - 1, 0, Math.max(0, all.length - 3));
    list = all.slice(i0, i0 + 3);
  } else list = all;
  const arw = HL.edit ? 44 : 0, x = 24, y0 = 164, w = 262 + arw, rh = list.length > 12 ? Math.min(30, 660 / list.length) : 33, fs = rh < 28 ? 0.9 : 1;
  g.fillStyle = 'rgba(10,12,16,.74)'; g.fillRect(x, y0 - 26, w, 26 + list.length * rh + 4);
  g.fillStyle = '#e10600'; g.fillRect(x, y0 - 26, w, 24);
  g.fillStyle = '#fff'; g.font = `900 15px ${HF.t}`; g.fillText(tr('CLASSEMENT'), x + 8, y0 - 8);
  g.font = `700 11px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'center';
  g.fillText(tr('PNEU'), x + 112, y0 - 9); g.fillText(L('USURE', 'WEAR'), x + 146, y0 - 9); g.fillText(tr('ARR.'), x + 182, y0 - 9); g.textAlign = 'left';
  list.forEach((o, k) => {
    const y = y0 + k * rh, m = y + rh / 2, hi = HL.who != null ? o.id === HL.who : o.id === fid || (rid || []).includes(o.id), out = o.state === 'out';
    if (hi) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, y + 1, w, rh - 1); }
    g.save(); if (out) g.globalAlpha *= 0.45;
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 ${Math.round(17 * fs)}px ${HF.m}`; g.textAlign = 'right'; g.fillText(o.pos, x + 27, m + 6); g.textAlign = 'left';
    g.fillStyle = tcol(o); g.fillRect(x + 33, y + 5, 4, rh - 9);
    g.fillStyle = '#fff'; g.font = (hi ? '900' : '700') + ` ${Math.round(19 * fs)}px ${HF.t}`; g.fillText(o.code, x + 43, m + 7, 50);
    if (!out) {
      hlTyre(g, x + 112, m, o.tyre, Math.round(10 * fs));
      const wv = clamp(o.wear || 0, 0, 1), bx = x + 126, bw = 40;   // jauge d'usure des pneus
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, m - 4, bw, 8);
      g.fillStyle = wv < 0.45 ? '#39ff88' : wv < 0.75 ? '#ffd400' : '#ff4d4d'; g.fillRect(bx, m - 4, Math.max(2, bw * wv), 8);
      const stops = HL.pits ? HL.pits[o.id].filter(t => t <= RP.t).length : o.stops || 0;
      g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `700 ${Math.round(15 * fs)}px ${HF.m}`; g.textAlign = 'center'; g.fillText(stops, x + 182, m + 5); g.textAlign = 'left';
      const dg = c.arrows ? c.arrows[o.id] || 0 : 0;   // edit : places gagnées (▲) ou perdues (▼) dans le dépassement en cours
      if (dg) { g.fillStyle = dg > 0 ? '#39ff88' : '#ff4d4d'; g.font = `800 ${Math.round(15 * fs)}px ${HF.m}`; g.textAlign = 'center'; g.fillText((dg > 0 ? '▲' : '▼') + Math.abs(dg), x + 224, m + 5); g.textAlign = 'left'; }
    }
    const gap = out ? 'OUT' : RP.t < R.startT + 3 ? '' : o.state === 'pit' ? tr('STAND') : o.pos === 1 ? tr(o.fin ? 'ARRIVÉ' : 'TÊTE') : o.gap != null && o.gap < 0 ? `+${-o.gap} ${L('T', 'L')}` : o.int != null ? '+' + Math.max(0, o.int).toFixed(1) : '';
    g.fillStyle = o.state === 'pit' ? '#39c7ff' : 'rgba(255,255,255,.85)'; g.font = `600 ${Math.round(15 * fs)}px ${HF.m}`; g.textAlign = 'right'; g.fillText(gap, x + w - 6, m + 5); g.textAlign = 'left';
    g.restore();
  });
}
/* ---------- cartons plein écran ---------- */
function hlPanel(g, W, H, kicker, title, y0, h) {
  hlBox(g, 30, y0, W - 60, h, 'rgba(8,10,14,.86)', 18);
  g.fillStyle = '#e10600'; g.font = `900 22px ${HF.t}`; g.fillText(tr(kicker).toUpperCase(), 58, y0 + 44);
  g.fillStyle = '#fff'; g.font = `900 52px ${HF.t}`; g.fillText(tr(title), 56, y0 + 100, W - 120);
  return y0 + 140;
}
function hlRow(g, W, y, pos, color, main, sub, right, opts) {
  opts = opts || {};
  if (opts.hi) hlBox(g, 46, y - 30, W - 92, 50, 'rgba(255,255,255,.14)', 8);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `800 26px ${HF.m}`; g.textAlign = 'right'; g.fillText(pos, 100, y + 4); g.textAlign = 'left';
  g.fillStyle = color; g.fillRect(114, y - 22, 7, 34);
  g.fillStyle = '#fff'; g.font = `800 30px ${HF.t}`; g.fillText(main, 134, y + 5, opts.mainW || 300);
  if (right) { g.fillStyle = opts.rcol || '#fff'; g.font = `800 26px ${HF.m}`; g.textAlign = 'right'; g.fillText(right, W - 62, y + 4); g.textAlign = 'left'; }
}
/* classement complet (jusqu'à 22 lignes compactes) : { pos, color, main, right, rcol, hi, dim, mainW, extra(y) } */
function hlFullTable(g, W, H, a, reveal, kicker, title, rows, note, foot) {
  const n = rows.length, rh = Math.min(42, (note ? 780 : 820) * (comCapOn() ? 0.89 : 1) / Math.max(1, n)), top = 120;   // place en bas pour les sous-titres
  let y = hlPanel(g, W, H, kicker, title, top, 140 + (note ? 44 : 0) + n * rh + (foot ? 48 : 6)) - 6;
  if (note) { g.fillStyle = note.col || '#fff'; g.font = `900 26px ${HF.t}`; g.fillText(note.text, 58, y + 2, W - 120); y += 44; }
  rows.forEach((r, i) => {
    g.globalAlpha = a * reveal(i, n);
    const yy = y + i * rh;
    if (r.hi) hlBox(g, 46, yy - rh * 0.7, W - 92, rh - 3, 'rgba(255,255,255,.14)', 6);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `800 20px ${HF.m}`; g.textAlign = 'right'; g.fillText(r.pos, 96, yy); g.textAlign = 'left';
    g.fillStyle = r.color; g.fillRect(106, yy - Math.min(26, rh * 0.62), 6, Math.min(30, rh * 0.75));
    g.fillStyle = r.dim ? 'rgba(255,255,255,.55)' : '#fff'; g.font = `800 22px ${HF.t}`; g.fillText(r.main, 122, yy, r.mainW || 250);
    if (r.right) { g.fillStyle = r.rcol || '#fff'; g.font = `800 20px ${HF.m}`; g.textAlign = 'right'; g.fillText(r.right, W - 60, yy); g.textAlign = 'left'; }
    if (r.extra) r.extra(yy);
  });
  g.globalAlpha = a;
  if (foot) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 24px ${HF.t}`; g.fillText(foot, 58, y + n * rh + 18, W - 120); }
}
/* les voitures hors course, en bas d'un classement complet */
function hlOuts(order, rows) {
  R.cars.filter(car => !order.some(x => x.id === car.id)).forEach(car => rows.push({ pos: '—', color: tcol(car), main: car.driver.name, mainW: 270, right: tr('ABANDON'), rcol: '#ff6b66', dim: true }));
}
/* jauge d'usure des pneus (0 : neufs, 1 : crevés) */
function hlGauge(g, x, y, w, wv) {
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 8);
  g.fillStyle = wv < 0.45 ? '#39ff88' : wv < 0.75 ? '#ffd400' : '#ff4d4d'; g.fillRect(x, y, Math.max(2, w * wv), 8);
}
/* constructeurs : points marqués dans ce Grand Prix (gain) et, en carrière, total au championnat après la course */
function hlTeamRows() {
  const ctx = R.hlCtx || {}, F = hlFinal().rows, gain = new Map(), col = new Map();
  finalOrder().forEach((o, i) => { col.set(o.team.name, tcol(o)); if (!F[o.id].out && !F[o.id].dsq) gain.set(o.team.name, (gain.get(o.team.name) || 0) + (POINTS[i] || 0)); });
  const rows = ctx.champ ? ctx.champ.t.map(t => ({ name: t.name, color: t.color, pts: t.pts + (gain.get(t.name) || 0), gain: gain.get(t.name) || 0 }))
    : [...col.keys()].map(n => ({ name: n, color: col.get(n), pts: gain.get(n) || 0, gain: gain.get(n) || 0 }));
  return rows.sort((p, q) => q.pts - p.pts || q.gain - p.gain);
}
function hlCard(g, W, H, c) {
  const k = HL.cardT, a = Math.min(1, k / 0.3) * Math.min(1, (c.dur - k) / 0.3);
  g.save(); g.globalAlpha = a;
  const ctx = R.hlCtx || {}, Cs = R.cars, byName = n => Cs.find(x => x.driver.name === n);
  const reveal = (i, n) => Math.min(1, Math.max(0, (k - 0.25 - i * Math.min(0.12, 1.6 / Math.max(1, n))) / 0.25));   // lignes qui arrivent une à une
  if (c.card === 'title') {
    hlBox(g, 30, 360, W - 60, 470, 'rgba(8,10,14,.82)', 18);
    g.textAlign = 'center';
    g.fillStyle = '#e10600'; g.font = `900 26px ${HF.t}`; g.fillText(c.ep && ctx.champ ? L(`ÉPISODE ${ctx.champ.round} · MANCHE ${ctx.champ.round}/${ctx.champ.n} · ${ctx.champ.year}`, `EPISODE ${ctx.champ.round} · ROUND ${ctx.champ.round}/${ctx.champ.n} · ${ctx.champ.year}`) : tr(ctx.champ ? `MANCHE ${ctx.champ.round}/${ctx.champ.n} · ${ctx.champ.year}` : 'GRAND PRIX'), W / 2, 420, W - 100);
    if (c.ep) { hlBox(g, W / 2 - 250, 850, 500, 64, '#e10600', 12); g.fillStyle = '#fff'; g.font = `900 34px ${HF.t}`; g.fillText(L(`PARTIE ${c.ep.no} · LE DÉPART`, `PART ${c.ep.no} · THE START`), W / 2, 894, 460); g.fillStyle = '#fff'; }
    g.fillStyle = '#fff'; g.font = `900 92px ${HF.t}`; g.fillText(tr(T.circ.name).toUpperCase(), W / 2, 520, W - 100);
    g.font = `700 30px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(`${tr(T.circ.sub)} · ${R.laps} ${L('tours', 'laps')} · ${(R.laps * T.L / 1000).toFixed(0)} km`, W / 2, 570, W - 100);
    // tracé du circuit
    const p = T.circ.pts; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    const sc = Math.min(360 / (x1 - x0), 190 / (y1 - y0)), ox = W / 2 - (x1 - x0) * sc / 2, oy = 610;
    g.strokeStyle = '#e10600'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < p.length; i += 2) { const X = ox + (p[i] - x0) * sc, Y = oy + (y1 - p[i + 1]) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
    g.closePath(); g.stroke(); g.textAlign = 'left';
  } else if (c.card === 'champ' || c.card === 'champ2') {
    const after = c.card === 'champ2';
    let rows = ctx.champ.d.map(d => ({ ...d }));
    if (after) { finalOrder().forEach((o, i) => { const r = rows.find(x => x.name === o.driver.name), F = hlFinal().rows[o.id]; if (r && !F.out && !F.dsq) r.gain = POINTS[i] || 0; }); rows.forEach(r => { r.pts += r.gain || 0; }); rows.sort((a, b) => b.pts - a.pts); }
    const me = HL.who != null ? Cs[HL.who].driver.name : (Cs.find(x => x.human) || {}).driver?.name;
    if (after) { hlFullTable(g, W, H, a, reveal, L('Après la course', 'After the race'), L('CHAMPIONNAT PILOTES', 'DRIVERS’ STANDINGS'), rows.map((r, i) => ({ pos: i + 1, color: r.color, main: r.name, right: `${r.pts} pts` + (r.gain ? `  +${r.gain}` : ''), hi: r.name === me, mainW: 300 }))); g.restore(); return; }
    let y = hlPanel(g, W, H, `Avant la manche ${ctx.champ.round}`, 'CHAMPIONNAT', 300, 600);
    rows.slice(0, 6).forEach((r, i) => { g.globalAlpha = a * reveal(i, 6); hlRow(g, W, y + i * 66, i + 1, r.color, r.name, '', `${r.pts} pts` + (after && r.gain ? `  +${r.gain}` : ''), { hi: r.name === me, mainW: 330 }); });
    g.globalAlpha = a;
    const mi = rows.findIndex(r => r.name === me); if (mi >= 6) hlRow(g, W, y + 6 * 66 + 10, mi + 1, rows[mi].color, rows[mi].name, '', `${rows[mi].pts} pts`, { hi: true, mainW: 330 });
  } else if (c.card === 'perf') {
    let y = hlPanel(g, W, H, ctx.ups ? 'Évolutions de la semaine' : 'Forces en présence', 'HIÉRARCHIE', 230, 840);
    const P = ctx.perf || [], top = P.length ? P[0].r : 1, bot = P.length ? P[P.length - 1].r : 0;
    P.forEach((t, i) => {
      g.globalAlpha = a * reveal(i, P.length);
      const yy = y + i * 58, wbar = 120 + (W - 380) * (t.r - bot + 0.5) / Math.max(0.5, top - bot + 0.5);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(60, yy - 24, W - 120, 44);
      g.fillStyle = t.color; g.fillRect(60, yy - 24, wbar * reveal(i, P.length), 44);
      g.fillStyle = '#fff'; g.font = `800 25px ${HF.t}`; g.fillText(t.name, 74, yy + 7, W - 300);
      const u = ctx.ups && ctx.ups[t.name];
      if (u) { g.textAlign = 'right'; g.font = `800 22px ${HF.t}`; g.fillStyle = u.fail ? '#ff6b66' : '#39ff88'; g.fillText(u.fail ? tr('▼ raté') : `▲ ${tr(u.big ? 'GROS PACKAGE' : 'évolution')}`, W - 74, yy + 6); g.textAlign = 'left'; }
    });
  } else if (c.card === 'grid') {
    const grid = Cs.slice().sort((x, y) => x.gridPos - y.gridPos), me = HL.who != null ? HL.who : (Cs.find(x => x.human) || {}).id;
    let y = hlPanel(g, W, H, 'Qualifications', 'GRILLE DE DÉPART', 250, 820);
    const F0 = R.rec.frames[0], pole = ctx.qt && ctx.qt[grid[0].driver.name];
    grid.slice(0, 10).forEach((o, i) => {
      g.globalAlpha = a * reveal(i, 10);
      const qt = ctx.qt && ctx.qt[o.driver.name], rt = i === 0 && qt < 900 ? fmt(qt) : qt < 900 && pole < 900 ? '+' + (qt - pole).toFixed(3) : '';
      hlRow(g, W, y + i * 60, o.gridPos, tcol(o), o.driver.name, '', rt, { hi: o.id === me, mainW: 300 });
      hlTyre(g, W - 230, y + i * 60 - 6, TY[F0.g[o.id * 2 + 1]] || 'M', 16);
    });
    g.globalAlpha = a;
    const m = Cs[me]; if (m && m.gridPos > 10) hlRow(g, W, y + 10 * 60 + 8, m.gridPos, tcol(m), m.driver.name, '', '', { hi: true });
  } else if (c.card === 'lap1') {
    const now = hlOrderAt(c.at), moves = now.map((x, i) => ({ c: Cs[x.id], d: Cs[x.id].gridPos - (i + 1), pos: i + 1 })).filter(m => m.d !== 0).sort((p, q) => q.d - p.d);
    if (c.ep) {   // partie du départ : tout le peloton, place sur la grille → place après le départ
      const rows = now.map((x, i) => { const car = Cs[x.id], d = car.gridPos - (i + 1);
        return { pos: 'P' + (i + 1), color: tcol(car), main: car.driver.name, mainW: 270, right: d ? (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) : '=', rcol: d > 0 ? '#39ff88' : d < 0 ? '#ff6b66' : 'rgba(255,255,255,.6)',
          extra: yy => { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `700 18px ${HF.m}`; g.textAlign = 'right'; g.fillText(L(`grille P${car.gridPos}`, `grid P${car.gridPos}`), W - 130, yy); g.textAlign = 'left'; } }; });
      hlOuts(now, rows);
      hlFullTable(g, W, H, a, reveal, L(`Après ${EP_START} s de course`, `After ${EP_START} s of racing`), L('APRÈS LE DÉPART', 'AFTER THE START'), rows);
      g.restore(); return;
    }
    let y = hlPanel(g, W, H, 'Bilan', 'APRÈS LE 1ER TOUR', 330, 560);
    const show = [...moves.slice(0, 3), ...moves.filter(m => m.d < 0).slice(-2)].filter((m, i, arr) => arr.indexOf(m) === i);
    if (!show.length) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 30px ${HF.t}`; g.fillText(tr('Aucun changement de position'), 60, y + 10); }
    show.forEach((m, i) => { g.globalAlpha = a * reveal(i, show.length); hlRow(g, W, y + i * 66, 'P' + m.pos, tcol(m.c), m.c.driver.name, '', (m.d > 0 ? '▲ ' : '▼ ') + Math.abs(m.d), { rcol: m.d > 0 ? '#39ff88' : '#ff6b66', mainW: 330 }); });
  } else if (c.card === 'strat') {
    const o = hlOrderAt(c.at).slice(0, 8), P = HL.pd;
    let y = hlPanel(g, W, H, `Tour ${Math.min(R.laps, Math.floor((o[0] ? o[0].dist : 0) / T.L) + 1)}/${R.laps}`, 'STRATÉGIES', 280, 700);
    o.forEach((x, i) => {
      g.globalAlpha = a * reveal(i, o.length);
      const car = Cs[x.id], st = P.stints[x.id].filter(s => s.t <= c.at);
      hlRow(g, W, y + i * 64, i + 1, tcol(car), car.code, '', '', { mainW: 120 });
      st.forEach((s, j) => { if (j) { g.fillStyle = 'rgba(255,255,255,.4)'; g.font = `700 22px ${HF.t}`; g.fillText('›', 238 + j * 64 - 28, y + i * 64 + 6); } hlTyre(g, 250 + j * 64, y + i * 64 - 4, s.ty, 18); });
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `700 22px ${HF.t}`; g.textAlign = 'right'; g.fillText(L(`${st.length - 1} arrêt${st.length > 2 ? 's' : ''}`, `${st.length - 1} stop${st.length !== 2 ? 's' : ''}`), W - 62, y + i * 64 + 4); g.textAlign = 'left';
    });
  } else if (c.card === 'stint') {   // début d'une partie : classement complet, pneus, usure et écarts
    const E = c.ep, o = hlOrderAt(c.at), lead = o[0], f = hlFrameAt(c.at);
    const why = { sc: L('🚨 Safety car en piste', '🚨 Safety car out'), vsc: L('🚨 Virtual safety car', '🚨 Virtual safety car'), rain: L('🌧 La pluie arrive', '🌧 Rain is falling'), dry: L('☀️ La piste sèche', '☀️ The track is drying') }[E.from];
    const rows = o.map((x, i) => { const car = Cs[x.id], gap = i ? (lead.dist - x.dist) / Math.max(30, x.v) : 0, wv = clamp(f.f[x.id * 7 + 6] || 0, 0, 1);
      return { pos: i + 1, color: tcol(car), main: car.driver.name, mainW: 250, right: x.pit ? tr('STAND') : i ? '+' + gap.toFixed(1) : tr('TÊTE'),
        extra: yy => { hlTyre(g, W - 262, yy - 7, TY[f.g[x.id * 2 + 1]] || 'M', 13); hlGauge(g, W - 242, yy - 11, 46, wv); } }; });
    hlOuts(o, rows);
    hlFullTable(g, W, H, a, reveal, `${epTag(E)} · ${L(`tours ${E.lapA} à ${E.lapB}`, `laps ${E.lapA} to ${E.lapB}`)}`, L(`RELAIS ${E.n}`, `STINT ${E.n}`) + (E.k > 1 ? L(' · LA SUITE', ' · CONTINUED') : ''), rows, why ? { text: why, col: '#ffa000' } : null);
  } else if (c.card === 'stintEnd') {   // fin d'une partie : places gagnées / perdues, pneus utilisés
    const E = c.ep, o = hlOrderAt(c.at), o0 = hlOrderAt(E.t0 + 0.5), P = HL.pd;
    const rows = o.map((x, i) => { const car = Cs[x.id], p0 = o0.findIndex(z => z.id === x.id) + 1, d = p0 ? p0 - (i + 1) : 0, sts = P.stints[x.id].filter(s => s.t <= c.at).slice(-4);
      return { pos: i + 1, color: tcol(car), main: car.driver.name, mainW: 200, right: d ? (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) : '=', rcol: d > 0 ? '#39ff88' : d < 0 ? '#ff6b66' : 'rgba(255,255,255,.6)',
        extra: yy => sts.forEach((s, j) => { if (j) { g.fillStyle = 'rgba(255,255,255,.4)'; g.font = `700 18px ${HF.t}`; g.fillText('›', 352 + j * 40 - 23, yy - 1); } hlTyre(g, 352 + j * 40, yy - 7, s.ty, 13); }) }; });
    hlOuts(o, rows);
    const np = P.pin.reduce((n, l) => n + l.filter(t => t >= E.t0 && t < E.t1).length, 0);
    const whole = E.kn === 1;
    hlFullTable(g, W, H, a, reveal, `${epTag(E)} · ${L(`tours ${E.lapA} à ${E.lapB}`, `laps ${E.lapA} to ${E.lapB}`)}`, whole ? L(`BILAN DU RELAIS ${E.n}`, `STINT ${E.n} REVIEW`) : L('BILAN DE LA PARTIE', 'PART REVIEW'), rows, null,
      L(`${E.nOt} dépassement${E.nOt > 1 ? 's' : ''} · ${np} arrêt${np > 1 ? 's' : ''} aux stands`, `${E.nOt} overtake${E.nOt !== 1 ? 's' : ''} · ${np} pit stop${np !== 1 ? 's' : ''}`));
  } else if (c.card === 'results') {
    const order = finalOrder(), FR = hlFinal().rows, win = order[0], wl = FR[win.id];
    const di = hlDotd(), dotd = di != null ? { o: R.cars[di], d: R.cars[di].gridPos - (order.indexOf(R.cars[di]) + 1) } : null;
    const rows = order.map((o, i) => { const F = FR[o.id], down = Math.max(0, wl.laps - F.laps), sts = HL.pd.stints[o.id].slice(0, 5);
      const t = F.dsq ? tr('DISQ.') : F.out ? tr('ABANDON') : i === 0 ? fmt(F.t - R.startT) : F.finishT > 0 && down === 0 ? '+' + (F.t - wl.t).toFixed(1) : down > 0 ? `+${down} ${L('tour', 'lap')}${down > 1 ? 's' : ''}` : '—';
      return { pos: i + 1, color: tcol(o), main: o.driver.name, mainW: 250, right: t, dim: F.out || F.dsq, rcol: F.out || F.dsq ? '#ff6b66' : '#fff', extra: yy => sts.forEach((s, j) => hlTyre(g, W - 262 + j * 24, yy - 7, s.ty, 10)) }; });
    hlFullTable(g, W, H, a, reveal, 'Classement final', 'RÉSULTATS', rows, null,
      dotd && dotd.d >= 3 ? `${tr('PILOTE DU JOUR')} : ${dotd.o.driver.name} · P${dotd.o.gridPos} → P${order.indexOf(dotd.o) + 1}` : '');
  } else if (c.card === 'champT') {   // classement des constructeurs (championnat, ou points de ce Grand Prix)
    const rows = hlTeamRows(), champ = !!ctx.champ;
    hlFullTable(g, W, H, a, reveal, champ ? L('Après la course', 'After the race') : L('Points marqués dans ce Grand Prix', 'Points scored in this Grand Prix'), L('CONSTRUCTEURS', 'CONSTRUCTORS'),
      rows.map((r, i) => ({ pos: i + 1, color: r.color, main: r.name, mainW: 330, right: champ ? `${r.pts} pts` + (r.gain ? `  +${r.gain}` : '') : `${r.gain} pts` })));
  } else if (c.card === 'driver' || c.card === 'driverEnd') {
    const o = Cs[c.focus], FR = hlFinal().rows[c.focus], fp = hlFinal().ids.indexOf(c.focus) + 1, end = c.card === 'driverEnd';
    hlBox(g, 30, 330, W - 60, 560, 'rgba(8,10,14,.86)', 18); g.fillStyle = tcol(o); g.fillRect(30, 330, 14, 560);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.font = `900 260px ${HF.t}`; g.textAlign = 'right'; g.fillText(o.driver.num, W - 50, 600); g.textAlign = 'left';
    g.fillStyle = '#e10600'; g.font = `900 24px ${HF.t}`; g.fillText(tr(end ? 'BILAN' : HL.full ? '★ PILOTE DU JOUR' : 'SA COURSE'), 70, 390);
    g.fillStyle = '#fff'; g.font = `900 64px ${HF.t}`; g.fillText(o.driver.name.toUpperCase(), 68, 470, W - 140);
    g.font = `700 30px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(`${o.driver.nat || ''} ${o.team.name} · ${L('n°', '#')}${o.driver.num}`.trim(), 70, 515, W - 140);
    const nOt = R.events.filter(e => e.type === 'overtake' && e.cars[0] === o.id).length;
    const stats = (end ? [['DÉPART', 'P' + o.gridPos], ['ARRIVÉE', FR.out ? tr('ABANDON') : 'P' + fp], [L('ARRÊTS', 'STOPS'), String(HL.pd.pin[o.id].length)], HL.full ? ['DÉPASSEMENTS', String(nOt)] : ['MEILLEUR TOUR', o.bestLap ? fmt(o.bestLap) : '—']]
      : [['GRILLE', 'P' + o.gridPos], ['QUALIF', ctx.qt && ctx.qt[o.driver.name] < 900 ? fmt(ctx.qt[o.driver.name]) : '—'], ['PNEUS', TY[R.rec.frames[0].g[o.id * 2 + 1]] || 'M']]).map(([l, v]) => [tr(l), v]);
    stats.forEach(([l, v], i) => { const x = 70 + (i % 2) * 300, y = 600 + Math.floor(i / 2) * 120; g.globalAlpha = a * reveal(i, stats.length); g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `800 22px ${HF.t}`; g.fillText(l, x, y); g.fillStyle = '#fff'; g.font = `900 52px ${HF.m}`; g.fillText(v, x, y + 56, 280); });
    g.globalAlpha = a;
    if (end && !FR.out) { const d = o.gridPos - fp; g.fillStyle = d > 0 ? '#39ff88' : d < 0 ? '#ff6b66' : '#fff'; g.font = `900 34px ${HF.t}`; g.fillText(d > 0 ? L(`▲ ${d} place${d > 1 ? 's' : ''} gagnée${d > 1 ? 's' : ''}`, `▲ ${d} place${d > 1 ? 's' : ''} gained`) : d < 0 ? L(`▼ ${-d} place${d < -1 ? 's' : ''} perdue${d < -1 ? 's' : ''}`, `▼ ${-d} place${d < -1 ? 's' : ''} lost`) : tr('= position conservée'), 70, 860); }
  }
  g.restore();
}
/* fin d'un épisode (pas le dernier) : à suivre, avec ce qui attend le prochain */
function hlNextCard(g, W, H) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(8,10,14,.85)'; g.fillRect(0, 0, HL_W, HL_H); g.restore();
  const E = HL.ep, N = hlEpisodes()[E.i + 1], o = hlOrderAt(E.t1 - 0.5);
  g.textAlign = 'center';
  g.fillStyle = '#fff'; g.font = `900 44px ${HF.t}`; g.fillText('PADDOCK', W / 2 - 30, 300);
  g.fillStyle = '#e10600'; g.fillText('26', W / 2 + 112, 300);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 30px ${HF.t}`; g.fillText(`${T.circ.flag || ''} ${tr(T.circ.name)} · ${L('tour', 'lap')} ${E.lapB}/${R.laps}`, W / 2, 350, W - 80);
  g.fillStyle = '#e10600'; g.font = `900 28px ${HF.t}`; g.fillText(L('EN TÊTE', 'LEADING'), W / 2, 430);
  o.slice(0, 3).forEach((x, i) => {
    const c = R.cars[x.id], y = 500 + i * 90;
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `800 34px ${HF.m}`; g.fillText('P' + (i + 1), W / 2 - 230, y + 12);
    g.fillStyle = tcol(c); g.fillRect(W / 2 - 140, y - 26, 8, 50);
    g.fillStyle = '#fff'; g.font = `900 38px ${HF.t}`; g.fillText(c.driver.name, W / 2 - 118, y + 12, W / 2 + 80);
    g.textAlign = 'center';
  });
  if (N) {
    const tease = { sc: L('🚨 SAFETY CAR !', '🚨 SAFETY CAR!'), vsc: L('🚨 VIRTUAL SAFETY CAR !', '🚨 VIRTUAL SAFETY CAR!'), rain: L('🌧 LA PLUIE ARRIVE !', '🌧 HERE COMES THE RAIN!'), dry: L('☀️ LA PISTE SÈCHE…', '☀️ THE TRACK IS DRYING…') }[E.to];
    hlBox(g, 60, 800, W - 120, tease ? 190 : 140, '#e10600', 16);
    g.fillStyle = '#fff'; g.font = `900 26px ${HF.t}`; g.fillText(L('À SUIVRE', 'COMING NEXT'), W / 2, 845);
    g.font = `900 46px ${HF.t}`; g.fillText(L(`PARTIE ${N.no} · ${epLabel(N).toUpperCase()}`, `PART ${N.no} · ${epLabel(N).toUpperCase()}`), W / 2, 905, W - 160);
    if (tease) { g.font = `900 36px ${HF.t}`; g.fillText(tease, W / 2, 960, W - 160); }
  }
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `700 26px ${HF.t}`; g.fillText(L('Abonne-toi pour la suite', 'Follow for the next part'), W / 2, 1060);
  g.textAlign = 'left';
}
function hlEndCard(g, W, H) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(8,10,14,.85)'; g.fillRect(0, 0, HL_W, HL_H); g.restore();
  g.textAlign = 'center';
  g.fillStyle = '#fff'; g.font = `900 44px ${HF.t}`; g.fillText('PADDOCK', W / 2 - 30, 300);
  g.fillStyle = '#e10600'; g.fillText('26', W / 2 + 112, 300);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 30px ${HF.t}`; g.fillText(`${T.circ.flag || ''} ${tr(T.circ.name)}`, W / 2, 350);
  const order = HL.podium || finalOrder().slice(0, 3);
  g.fillStyle = '#e10600'; g.font = `900 28px ${HF.t}`; g.fillText(tr('PODIUM'), W / 2, 420);
  order.forEach((c, i) => {
    const y = 520 + i * 150;
    g.fillStyle = ['#d4af37', '#c0c0c0', '#cd7f32'][i]; g.font = `900 80px ${HF.t}`; g.fillText(`P${i + 1}`, W / 2 - 220, y + 26);
    g.textAlign = 'left'; g.fillStyle = tcol(c); g.fillRect(W / 2 - 130, y - 44, 8, 82);
    g.fillStyle = '#fff'; g.font = `900 44px ${HF.t}`; g.fillText(c.driver.name, W / 2 - 108, y, W / 2 + 70);
    g.font = `600 26px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(c.team.name, W / 2 - 108, y + 34);
    g.textAlign = 'center';
  });
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `700 26px ${HF.t}`; g.fillText(tr('Abonne-toi pour le prochain Grand Prix'), W / 2, 1060);
  g.textAlign = 'left';
}
/* =====================================================================
   EDIT TIKTOK : la course d'un pilote montée sur une musique rythmée composée par l'appli (aucun droit d'auteur).
   Tout est calé sur le tempo : chaque coupe tombe sur un temps, chaque dépassement sur un temps, l'extinction des feux
   sur le « drop » et le passage de la ligne sur le dernier impact. Accroche (4 plans) · grille (montée) · départ ·
   moments forts · arrivée · carton final.
   ===================================================================== */
const EDIT_STYLES = { phonk: { bpm: 140 }, electro: { bpm: 128 }, none: { bpm: 128 } };
const EDIT_TV = [['tv', 0]];
const EDIT_TXT = false;   // gros textes après le départ (chiffres, position) : retirés ; restent l'accroche, la grille, le classement et le bilan final   // toujours en vue TV : on voit la course, les écarts et les autres voitures
function editPlan(who, bpm, short) {   // short : edit sur ta musique, plus court (≈ 25 s)
  const bt = 60 / bpm, F = R.rec.frames, f0 = F[0].t, st = R.startT, me = R.cars[who], fin = hlFinal(), row = fin.rows[who];
  if (!me || !row) return null;
  const P = HL.pd || (HL.pd = hlPitData()), { cand } = hlMoments(who, false);
  const outF = row.out ? F.find(f => f.g[who * 2] & 2) : null, dnf = !!outF;
  const endT = dnf ? outF.t : row.fin && row.finishT ? row.finishT : RP.end - 3;
  // moments forts : ses vrais dépassements (jamais sur une voiture qui rentre aux stands), batailles, arrêts, accrochages
  const keys = [], runs = [];
  // ses dépassements en piste, pris dans l'enregistrement à l'instant exact où il passe devant (le message de course arrive
  // 2 à 5 s plus tard, et pas pour tous) : tenus au moins 3 s, jamais sur une voiture qui rentre ou sort des stands (otOk)
  const ok = (f, k) => !(f.g[k * 2] & 7), nC = R.cars.length, hold = Math.round(3 / REC_DT);
  for (let fi = 1; fi < F.length; fi++) {
    const a = F[fi - 1], b = F[fi]; if (b.t < st + 2 || !ok(a, who) || !ok(b, who)) continue;
    for (let B = 0; B < nC; B++) {
      if (B === who || !ok(a, B) || !ok(b, B) || a.f[who * 7] >= a.f[B * 7] || b.f[who * 7] < b.f[B * 7] || b.f[who * 7] - b.f[B * 7] > 30) continue;
      if (!F.slice(fi, fi + hold).every(f => f.f[who * 7] >= f.f[B * 7] || (f.g[B * 2] & 7)) || !otOk(F, who, B, b.t, 0.6)) continue;
      let pos = 1; for (let k = 0; k < nC; k++) if (k !== who && !(b.g[k * 2] & 6) && b.f[k * 7] > b.f[who * 7]) pos++;
      const prev = keys[keys.length - 1];
      if (prev && prev.kind === 'overtake' && b.t - prev.evEnd < 6) { prev.n++; prev.evEnd = b.t; prev.big = '+' + prev.n; prev.pos = pos; prev.vic.push(R.cars[B].code); prev.passes.push({ t: b.t, id: B }); prev.score += 30; continue; }   // double, triple…
      keys.push({ kind: 'overtake', ev: b.t, evEnd: b.t, n: 1, pos, vic: [R.cars[B].code], passes: [{ t: b.t, id: B }], eb: 2, big: '+1', col: '#39ff88', v: 1, cams: EDIT_TV, passS: SIM.mod(b.f[who * 7], T.L),
        score: 230 - pos * 6 + (pos === 1 ? 60 : 0) + (b.f[who * 7] > (R.laps - 1) * T.L ? 25 : 0) });
    }
  }
  for (const k of keys) k.span = k.evEnd - k.ev + 1;   // une série de dépassements est montrée jusqu'au dernier (en accéléré entre les deux)
  for (const k of keys) k.small = L(`P${k.pos} · passe ${k.vic.join(' et ')}`, `P${k.pos} · passes ${k.vic.join(' and ')}`);
  for (const c of cand) {
    let k = null;
    if (c.kind === 'battle' && (c.focus === who || c.rival === who)) {
      const o = R.cars[c.focus === who ? c.rival : c.focus];
      k = { ev: c.t1 - 2, eb: 2, big: 'DUEL', small: 'vs ' + o.code, col: '#ffd23f', v: 0.6, cams: EDIT_TV, inv: [o.id] };
    } else if (c.kind === 'pit' && c.focus === who) {
      const m = /· ([\d.]+) s/.exec(c.sub);
      k = { ev: c.t0 + 4, eb: 2, span: (m ? +m[1] : 2.5) + 2, big: m ? (+m[1]).toFixed(1) + ' s' : 'PIT', small: L('ARRÊT AUX STANDS', 'PIT STOP'), col: '#39c7ff', v: 0.8, cams: EDIT_TV };
    } else if (c.kind === 'crash' && (c.focus === who || c.rival === who) && !(dnf && Math.abs(c.ev - endT) < 12)) {
      k = { ev: c.ev, eb: 2, span: 2.5, big: tr(c.title), small: '', col: '#ff3b3b', v: 1.3, cams: EDIT_TV, inv: [c.focus, c.rival].filter(x => x != null && x !== who) };
    } else if (c.kind === 'undercut' && c.focus === who) {
      k = { ev: c.t0 + 3, eb: 2, span: 2, big: 'UNDERCUT', small: c.sub.replace(/^.* passe devant (\S+) .*$/, 'vs $1'), col: '#39c7ff', v: 0.9, cams: EDIT_TV, inv: [c.rival] };
    } else if (c.kind === 'run') runs.push(c.t0 + (c.t1 - c.t0) * 0.4);
    if (k) keys.push(Object.assign(k, { kind: c.kind, score: c.score * ({ battle: 0.4, pit: 0.6 }[c.kind] || 1), passS: c.passS }));   // les dépassements d'abord
  }
  // plans courts, calés sur la musique : l'approche à vitesse réelle jusqu'au moment fort, posé sur un temps fort (1er ou 3e de la
  // mesure : les plans commencent toujours sur un temps impair et durent un nombre pair de temps), puis la suite en accéléré
  // (la vitesse monte jusqu'à ×3) pour tenir dans le moins de temps possible ; un nombre pair de temps par plan
  // un plan = 4 temps, toujours ; on change de vidéo sur le temps qui précède chaque accent (1er temps de chaque mesure, comptée
  // depuis le drop), et l'accent assombrit l'image. Le moment fort tombe sur le 3e temps de la mesure (4e temps du plan) ;
  // tout à vitesse réelle : si le moment déborde du plan, il est coupé
  const fit = k => { k.nb = 4; k.eb = k.kind === 'run' ? 0 : 3; k.r1 = 1; return k; };
  keys.forEach(fit);
  const start = { nb: 4 };
  // dépassement dans les dernières secondes : l'approche de l'arrivée passe en accéléré pour le montrer
  const late = keys.filter(k => k.kind === 'overtake' && k.ev < endT && endT - k.ev < 10).map(k => k.ev);
  const finEb = 3, preS = Math.max(3 * bt, endT - Math.min(endT, ...late) + 1), finFr = 1;
  const t1st = st + 3 * bt, tEnd = endT - finEb * bt * finFr, pick = [], duels = keys.filter(k => k.kind !== 'battle').length >= 2 ? 1 : 2;
  const w = k => [k.ev - k.eb * bt, k.ev + (k.span || (k.nb - k.eb) * bt)];
  let used = 0;
  for (const k of keys.sort((a, b) => b.score - a.score)) {
    const [w0, w1] = w(k);
    if (w0 < t1st || w1 > tEnd || used + k.nb > (short ? 20 : 40)) continue;
    if (pick.some(p => { const [p0, p1] = w(p); return w0 < p1 + 1 && p0 < w1 + 1; })) continue;
    if (k.kind === 'battle' && pick.filter(p => p.kind === 'battle').length >= duels) continue;
    pick.push(k); used += k.nb;
  }
  const hookFrom = pick.slice(0, 4).map(k => k.ev);
  pick.sort((a, b) => a.ev - b.ev);
  // plans de remplissage (2 temps) dans les plus longs trous, pour que la course respire et tienne au moins ~30 temps
  const near = (a, b) => runs.filter(t => t > a + 4 && t < b - 4 && !pick.some(p => Math.abs(p.ev - t) < 5)).sort((x, y) => Math.abs(x - (a + b) / 2) - Math.abs(y - (a + b) / 2))[0];
  for (let n = 0; n < (short ? 2 : 6) && (used < (short ? 12 : 20) || (!short && n < 2)); n++) {
    const anch = [t1st, ...pick.map(p => p.ev), tEnd];
    let best = null;
    for (let i = 1; i < anch.length; i++) { const t = near(anch[i - 1], anch[i]); if (t != null && (!best || anch[i] - anch[i - 1] > best.gap)) best = { t, gap: anch[i] - anch[i - 1] }; }
    if (!best || best.gap < 25) break;
    pick.push({ kind: 'run', ev: best.t, nb: 4, eb: 0, r1: 1, cams: EDIT_TV }); used += 4;
    pick.sort((a, b) => a.ev - b.ev);
  }
  // montage
  const segs = [], stamps = [], hits = [];
  let b = 0;
  const add = o => { o.b0 = b; o.focus = who; segs.push(o); b += o.nb; return o; };
  const hook = hookFrom.length ? hookFrom : [];
  for (const t of runs) if (hook.length < 4 && !hook.some(x => Math.abs(x - t) < 10)) hook.push(t);
  while (hook.length < 4) hook.push(Math.min(endT - 5, st + 20 + hook.length * 25));
  // avant le départ, les coupes tombent sur les accents (temps 0, 4, 8, 12) ; le dernier plan de grille s'arrête un temps avant le drop
  add({ kind: 'hook', nb: 4, t0: hook[0] - 2 * bt, cams: EDIT_TV }); add({ kind: 'hook', nb: 4, t0: hook[1] - 2 * bt, cams: EDIT_TV });
  add({ kind: 'grid', nb: 4, t0: Math.max(f0, st - 8 * bt), cams: EDIT_TV }); add({ kind: 'grid', nb: 3, t0: Math.max(f0, st - 4 * bt), cams: EDIT_TV });
  const dropB = b + 1;   // l'extinction des feux tombe sur l'accent, un temps après la coupe
  add({ kind: 'start', nb: 4, t0: st - bt, cams: [['heli', 0]] });   // le départ vu d'hélico : tout le peloton
  stamps.push({ b: dropB, big: 'GO !', small: '', col: '#39ff88', dur: 2 }); hits.push({ t: dropB * bt, v: 1.4 });
  let nOv = 0;
  for (const k of pick) {
    // dépassements : drone (au-dessus, sur le côté) et caméra fixe posée au bord de la piste juste après l'endroit du dépassement,
    // en alternance ; duels au drone
    if (k.kind === 'overtake') k.cams = [[nOv++ % 2 ? 'fixed' : 'drone', 0]]; else if (k.kind === 'battle') k.cams = [['drone', 0]];
    const inShot = (k.passes || []).filter(p => p.t <= k.ev + (k.nb - k.eb) * bt);   // dépassements visibles avant la coupe
    const s = add({ kind: k.kind, nb: k.nb, t0: k.ev - k.eb * bt, pre: k.eb * bt, r1: k.r1, span: k.span, cams: k.cams, passS: k.passS, inv: k.passes ? inShot.map(p => p.id) : k.inv, passes: k.passes && inShot });
    if (k.big) { stamps.push({ b: s.b0 + k.eb, big: k.big, small: k.small, col: k.col, dur: Math.min(3, k.nb - k.eb) }); hits.push({ t: (s.b0 + k.eb) * bt, v: k.v }); }
  }
  const pos = fin.ids.indexOf(who) + 1, gain = me.gridPos - pos;
  const fs = add({ kind: dnf ? 'crash' : 'finish', nb: 4, t0: tEnd, pre: finEb * bt, fr: finFr, r1: 1, cams: EDIT_TV, passS: dnf ? hlSAt(who, endT) : undefined });
  const finB = fs.b0 + finEb;
  stamps.push(dnf ? { b: finB, big: 'ABANDON', small: tr(R.cars[who].retiredWhy || ''), col: '#ff3b3b', dur: 4 }
    : { b: finB, big: 'P' + pos, size: 290, small: pos === 1 ? L('VICTOIRE !', 'VICTORY!') : pos <= 3 ? 'PODIUM !' : gain > 0 ? L(`+${gain} PLACE${gain > 1 ? 'S' : ''}`, `+${gain} PLACE${gain > 1 ? 'S' : ''}`) : gain < 0 ? L(`${gain} PLACE${gain < -1 ? 'S' : ''}`, `${gain} PLACE${gain < -1 ? 'S' : ''}`) : tr('ARRIVÉE'),
      col: ['#ffd700', '#e3e3e3', '#e08a3c'][pos - 1] || '#fff', dur: 4 });
  hits.push({ t: finB * bt, v: 1.6 });
  add({ kind: 'card', nb: short ? 6 : 8, t0: Math.min(RP.end, endT + 2 * bt), cams: EDIT_TV });
  for (const sg of segs) sg.bt = bt;
  const nOt = R.events.filter(e => e.type === 'overtake' && e.cars[0] === who && e.cars.length >= 2 && e.t > st + 4 && otOk(F, who, e.cars[1], e.t)).length;
  return { beat: bt, bpm, segs, stamps, hits, dropB, finB, drops: [{ t: dropB * bt, v: 1 }], total: b * bt, dnf, pos, grid: me.gridPos, nOt, stops: P.pin[who].length };
}

/* la musique : synthétisée hors ligne (grosse caisse, clap, charleston, basse, accords / cloches phonk), avec une montée
   avant le départ, un drop à l'extinction des feux, un impact à chaque moment fort et une fin qui s'éteint après l'arrivée.
   Les mesures qui se répètent (accroche, drop) sont rendues une seule fois en boucles de 4 mesures, gardées pour les edits
   suivants ; le morceau est ensuite assemblé avec la montée, les impacts et le filtre général */
const EDIT_LOOPS = {};
function editKit(ctx, style, bt, dest) {
  const sr = ctx.sampleRate, phonk = style === 'phonk', mtof = m => 440 * 2 ** ((m - 69) / 12);
  const nz = ctx.createBuffer(1, sr * 2, sr), nd = nz.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const pump = ctx.createGain(); pump.connect(dest);     // instruments « pompés » par la grosse caisse
  const drums = ctx.createGain(); drums.connect(dest);
  const rv = ctx.createConvolver(), ir = ctx.createBuffer(2, Math.round(sr * 1.4), sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; }
  rv.buffer = ir; const rvG = ctx.createGain(); rvG.gain.value = 0.22; rv.connect(rvG); rvG.connect(dest);
  const dist = ctx.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) cv[i] = Math.tanh((i / 511.5 - 1) * 3.2);
  dist.curve = cv; const distG = ctx.createGain(); distG.gain.value = 0.55; dist.connect(distG); distG.connect(dest);
  const env = (g, t, a, v, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const noise = (t, dur, type, fq, q, v, d, to, a = 0.002) => {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nz; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(fq, t); fl.Q.value = q; env(g, t, a, v, d);
    s.connect(fl); fl.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + dur); return { fl, g };
  };
  const K = { phonk, mtof, pump, drums, rv, dist, noise };
  K.kick = (t, v) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(phonk ? 190 : 165, t); o.frequency.exponentialRampToValueAtTime(phonk ? 48 : 44, t + 0.1);
    env(g, t, 0.002, v, phonk ? 0.32 : 0.42); o.connect(g); g.connect(phonk ? dist : drums); o.start(t); o.stop(t + 0.5);
    noise(t, 0.03, 'highpass', 2500, 0.7, v * 0.3, 0.012, drums);
    pump.gain.setValueAtTime(0.3, t); pump.gain.linearRampToValueAtTime(1, t + bt * 0.6);
  };
  K.clap = (t, v) => { for (const [dt, k] of [[0, 0.55], [0.011, 0.7], [0.023, 1]]) { const n = noise(t + dt, 0.35, 'bandpass', phonk ? 1700 : 1400, 1.1, v * k, dt > 0.02 ? 0.17 : 0.012, drums); if (dt > 0.02) n.g.connect(rv); } };
  K.hat = (t, v) => noise(t, 0.07, 'highpass', 7800, 0.8, v, 0.035, drums);
  K.tone = (t, dur, m, type, v, cut, to, o = {}) => {
    const g = ctx.createGain(), fl = ctx.createBiquadFilter(), a = o.a || 0.004, r = Math.min(o.r || 0.06, dur * 0.5);
    fl.type = o.bp ? 'bandpass' : 'lowpass'; fl.frequency.setValueAtTime(cut, t); if (o.cutEnd) fl.frequency.exponentialRampToValueAtTime(o.cutEnd, t + dur); fl.Q.value = o.q || 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
    if (o.dec) g.gain.exponentialRampToValueAtTime(0.0001, t + dur); else { g.gain.setValueAtTime(v, t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    for (const [dt, mul] of o.osc || [[0, 1]]) {
      const os = ctx.createOscillator(); os.type = type; os.frequency.setValueAtTime(mtof(m) * mul, t);
      if (o.glide != null) os.frequency.exponentialRampToValueAtTime(mtof(o.glide) * mul, t + Math.min(dur, bt * 0.5));
      os.detune.value = dt; os.connect(fl); os.start(t); os.stop(t + dur + 0.03);
    }
    fl.connect(g); g.connect(to); if (o.rv) { const s = ctx.createGain(); s.gain.value = o.rv; g.connect(s); s.connect(rv); }
  };
  // grille d'accords (une mesure chacun) : basse + accord ; cloches phonk sur deux motifs qui alternent
  K.prog = phonk ? [[30, [66, 69, 73]], [26, [62, 66, 69]], [28, [64, 68, 71]], [25, [61, 65, 68]]]
    : [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
  const bells = [[[0, 12], [0.5, 12], [1, 15], [1.5, 12], [2, 19], [2.25, 17], [2.75, 15], [3.25, 12]], [[0, 12], [0.5, 15], [1, 17], [1.5, 15], [2, 12], [2.5, 19], [3, 17], [3.5, 15]]];
  const arp = [0, 1, 2, 1, 2, 0, 1, 2];
  // une mesure de groove : accroche (plus léger) ou drop (phrase 1 : arpège en plus, en électro)
  K.bar = (bar, t0, drop, phrase) => {
    const [root, ch] = K.prog[bar % 4], T = b => t0 + b * bt;
    for (let q = 0; q < 4; q++) {
      K.kick(T(q), drop ? 1 : 0.75);
      if (q % 2 === 1) K.clap(T(q), drop ? 0.55 : 0.35);
      K.hat(T(q + 0.5), 0.12); if (drop) { K.hat(T(q + 0.25), 0.05); K.hat(T(q + 0.75), 0.05); }
      if (!phonk) {
        K.tone(T(q + 0.5), bt * 0.42, root, 'sawtooth', 0.3, 800, pump, { osc: [[0, 1], [-8, 1], [0, 0.5]], cutEnd: 220, dec: 1 });
        if (drop && phrase) for (let s = 0; s < 4; s++) K.tone(T(q + s / 4), bt * 0.22, ch[arp[(q * 4 + s) % 8]] + 12, 'square', 0.035, 4200, pump, { dec: 1, rv: 0.4 });
      }
    }
    if (phonk) {
      for (const [o, n] of bells[bar % 2]) K.tone(T(o), bt * 0.45, root + 36 + n, 'square', drop ? 0.09 : 0.06, mtof(root + 36 + n) * 1.15, pump, { osc: [[0, 1], [0, 1.48]], bp: 1, q: 3, dec: 1, rv: 0.25 });
      K.tone(T(0), bt * 1.6, root + 12, 'sine', 0.85, 900, dist, { glide: root, a: 0.005, dec: 1 });
      K.tone(T(2.5), bt * 0.9, root + 12, 'sine', 0.6, 900, dist, { glide: root + 7, dec: 1 });
    } else for (const o of [0, 1.5, 3]) for (const m of ch) K.tone(T(o), bt * 0.38, m, 'sawtooth', 0.03, 3400, pump, { osc: [[-14, 1], [0, 1], [14, 1]], cutEnd: 1100, dec: 1, rv: 0.3 });
  };
  return K;
}
const EDIT_TAIL = 1.5;
async function editLoops(style, bpm) {
  const key = style + bpm; if (EDIT_LOOPS[key]) return EDIT_LOOPS[key];
  const bt = 60 / bpm, sr = 48000;
  const one = async (bars, drop, phrase) => {
    const ctx = new OfflineAudioContext(2, Math.ceil((bars * 4 * bt + EDIT_TAIL) * sr), sr), K = editKit(ctx, style, bt, ctx.destination);
    for (let b = 0; b < bars; b++) K.bar(b, b * 4 * bt, drop, phrase);
    return ctx.startRendering();
  };
  const L0 = { hook: await one(2, false, 0), drop: [await one(4, true, 0)] };
  L0.drop.push(style === 'phonk' ? L0.drop[0] : await one(4, true, 1));
  return (EDIT_LOOPS[key] = L0);
}
async function editMusic(style, E) {
  const sr = 48000, bt = E.beat, len = E.total + 2, ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  const T = b => b * bt, D = E.dropB, Fb = E.finB, N = E.total / bt;
  const LP = await editLoops(style, E.bpm);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15; comp.connect(ctx.destination);
  const fade = ctx.createGain(); fade.connect(comp);
  fade.gain.setValueAtTime(1, T(N - 2.5)); fade.gain.linearRampToValueAtTime(0.0001, T(N));
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9; lp.connect(fade);   // intro étouffée, drop grand ouvert, fin qui se referme
  const f = lp.frequency;
  f.setValueAtTime(450, 0); f.exponentialRampToValueAtTime(1600, T(8)); f.setValueAtTime(900, T(8)); f.exponentialRampToValueAtTime(5500, T(D - 0.3));
  f.setValueAtTime(19000, T(D)); f.setValueAtTime(19000, T(Fb + 0.5)); f.exponentialRampToValueAtTime(1300, T(Fb + 4));
  const fx = ctx.createGain(); fx.connect(fade);       // montée et impacts : hors du filtre
  const K = editKit(ctx, style, bt, lp);
  const loopG = ctx.createGain(); loopG.gain.value = 1.5; loopG.connect(lp);
  const play = (buf, t, dur) => { const s = ctx.createBufferSource(); s.buffer = buf; s.connect(loopG); s.start(t, 0, dur); };
  play(LP.hook, 0, T(8));
  for (let b = D, j = 0; b < Fb; b += 16, j++) play(LP.drop[Math.floor(j / 2) % 2], T(b), Math.min(T(16) + EDIT_TAIL, T(Fb - b) + 0.05));
  // montée avant le départ : nappe qui s'ouvre, roulement de caisse claire qui accélère, souffle ; une demi-temps de silence, puis le drop
  for (const m of K.prog[0][1]) K.tone(T(8), T(D - 8.5), m, 'sawtooth', 0.022, 500, K.pump, { osc: [[-12, 1], [0, 1], [12, 1]], cutEnd: 4000, a: 0.8, rv: 0.4 });
  K.tone(T(8), T(D - 8.5), K.prog[0][0] + 12, 'sine', 0.15, 300, K.pump, { a: 0.6 });
  K.noise(T(8), 2, 'lowpass', 7000, 0.5, 0.2, 1.4, fx).g.connect(K.rv);   // cymbale au passage accroche → grille
  for (let b = 8; b < D - 0.5; ) { const u = (b - 8) / (D - 8); K.noise(T(b), 0.15, 'bandpass', 1200 + 2600 * u, 1, 0.05 + 0.22 * u, 0.09, K.drums); b += u < 0.5 ? 0.5 : u < 0.75 ? 0.25 : 0.125; }
  const rs = K.noise(T(8), T(D - 8.5) + 0.02, 'bandpass', 300, 1.2, 0.14, 0.001, fx, T(D - 8.5)); rs.fl.frequency.exponentialRampToValueAtTime(7000, T(D - 0.5));
  // après l'arrivée : l'accord tenu, une grosse caisse tous les deux temps
  for (const m of K.prog[0][1]) K.tone(T(Fb), T(N - Fb), m, 'sawtooth', 0.035, 1800, K.pump, { osc: [[-12, 1], [0, 1], [12, 1]], cutEnd: 500, a: 0.02, r: 1, rv: 0.5 });
  K.tone(T(Fb), T(N - Fb), K.prog[0][0], 'sine', 0.35, 400, K.pump, { a: 0.01, r: 1 });
  for (let b = Fb + 2; b < N - 1; b += 2) K.kick(T(b), 0.45);
  // impacts : souffle qui monte sur le temps d'avant, puis boum grave + souffle
  for (const h of E.hits) {
    const big = Math.abs(h.t - T(D)) < 0.01 || Math.abs(h.t - T(Fb)) < 0.01, v = h.v * (big ? 1 : 0.55);
    if (!big) { const n = K.noise(h.t - bt, bt + 0.02, 'bandpass', 900, 1.4, 0.16 * h.v, 0.001, fx, bt * 0.98); n.fl.frequency.exponentialRampToValueAtTime(5000, h.t); }
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, h.t); o.frequency.exponentialRampToValueAtTime(32, h.t + 0.6);
    g.gain.setValueAtTime(0.0001, h.t); g.gain.exponentialRampToValueAtTime(0.6 * v, h.t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, h.t + 1.1);
    o.connect(g); g.connect(fx); o.start(h.t); o.stop(h.t + 1.3);
    K.noise(h.t, 2, 'lowpass', 9000, 0.5, 0.35 * v, 1.6, fx).g.connect(K.rv);
  }
  const ab = await ctx.startRendering();
  let pk = 1e-6; for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { const x = Math.abs(d[i]); if (x > pk) pk = x; } }
  const k = 0.9 / pk; for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
  return ab;
}
/* ta propre musique (fichier audio du téléphone, pour TikTok) : tempo et premier temps détectés, puis le « drop » du morceau
   (la plus forte montée d'énergie) est posé sur l'extinction des feux ; le morceau est bouclé par mesures entières s'il est trop court */
let EDIT_USER = null;
function editAnalyze(buf) {
  const sr = buf.sampleRate, hop = Math.round(sr / 100), n = Math.floor(buf.length / hop), c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : c0;
  // énergie grave (grosse caisse, basse) et aiguë (charleston, clap : le tempo le plus net) toutes les 10 ms
  const lo = new Float32Array(n), hi = new Float32Array(n);
  let y = 0, xp = 0; const a = 1 - Math.exp(-2 * Math.PI * 150 / sr);
  for (let i = 0, k = 0; k < n; k++) {
    let sl = 0, sh = 0;
    for (const e = (k + 1) * hop; i < e; i++) { const x = (c0[i] + c1[i]) * 0.5; y += a * (x - y); sl += y * y; sh += (x - xp) ** 2; xp = x; }
    lo[k] = Math.log(1e-9 + sl / hop); hi[k] = Math.log(1e-9 + sh / hop);
  }
  const on = new Float32Array(n);
  for (let k = 1; k < n; k++) on[k] = 0.5 * Math.max(0, lo[k] - lo[k - 1]) + Math.max(0, hi[k] - hi[k - 1]);
  // tempo : autocorrélation des attaques, préférence autour de 125 BPM (un edit coupe à chaque temps)
  let best = null;
  for (let lag = Math.round(6000 / 180); lag <= Math.round(6000 / 75); lag++) {
    let s = 0; for (let k = lag; k < n; k++) s += on[k] * on[k - lag];
    s /= (n - lag); const bpm = 6000 / lag, w = Math.exp(-0.5 * (Math.log2(bpm / 125) / 0.45) ** 2);
    if (!best || s * w > best.v) best = { lag, v: s * w };
  }
  // affinage du tempo (±2 %) et du premier temps : la grille qui tombe le plus sur les attaques
  let fit = null;
  for (let f = 0.98; f <= 1.0201; f += 0.002) {
    const P = best.lag * f;
    for (let ph = 0; ph < P; ph += 0.5) {
      let s = 0; for (let t = ph; t < n - 1; t += P) { const k = Math.round(t); s += on[k] + 0.5 * (on[k + 1] || 0); }
      if (!fit || s > fit.v) fit = { v: s, P, ph };
    }
  }
  let bpm = 6000 / fit.P; if (bpm < 90) bpm *= 2; else if (bpm > 175) bpm /= 2;
  // tempo et premier temps au plus près sur les attaques nettes (charleston, caisse claire) toutes les 5 ms : la basse 808,
  // saturée et pleine de roulements, traîne et décalait la grille de quelques dizaines de ms
  const h5 = Math.round(sr / 200), n5 = Math.floor(buf.length / h5), hf = new Float32Array(n5);
  { let xp = 0, pv = 0; for (let i = 0, k = 0; k < n5; k++) { let sm = 0; for (const e = (k + 1) * h5; i < e; i++) { const x = (c0[i] + c1[i]) * 0.5; sm += (x - xp) ** 2; xp = x; } const l = Math.log(1e-9 + sm / h5); hf[k] = Math.max(0, l - pv); pv = l; } }
  let fin = null; const P0 = 12000 / bpm;
  for (let f = 0.994; f <= 1.0061; f += 0.0005) {
    const P = P0 * f;
    for (let ph = 0; ph < P; ph += 0.5) {
      let sm = 0; for (let t = ph; t < n5 - 1; t += P) { const k = Math.floor(t), u = t - k; sm += hf[k] * (1 - u) + hf[k + 1] * u; }
      if (!fin || sm > fin.v) fin = { v: sm, P, ph };
    }
  }
  bpm = 12000 / fin.P;
  const bt = 60 / bpm, t0 = (fin.ph * h5) / sr % bt, nb = Math.floor((buf.duration - t0) / bt);
  // énergie par temps, puis le drop : le temps où l'énergie grave saute le plus (4 temps après contre 4 avant) ; les mesures se comptent depuis lui
  const eb = []; for (let b = 0; b < nb; b++) { let s = 0, m = 0; for (let k = Math.round((t0 + b * bt) * 100); k < Math.round((t0 + (b + 1) * bt) * 100) && k < n; k++) { s += Math.exp(lo[k]); m++; } eb.push(m ? s / m : 0); }
  let drop = 0, dv = -1;
  for (let b = 2; b + 4 <= nb; b++) {
    const after = (eb[b] + eb[b + 1] + eb[b + 2] + eb[b + 3]) / 4, before = (eb[b - 4] + eb[b - 3] + eb[b - 2] + eb[b - 1]) / 4;
    const v = after / (before + 1e-9); if (v > dv) { dv = v; drop = b; }
  }
  if (dv < 1.6) drop = 0;   // pas de vrai drop : le morceau démarre sur l'extinction des feux
  const ofs = drop % 4, L = Math.floor((nb - ofs) / 4) * 4;      // boucle = mesures entières alignées sur le drop
  // intensité de chaque temps (énergie grave, 0..1) et tous les drops (l'énergie repart après un passage calme) avec leur force
  const top = Math.max(...eb, 1e-9), inten = [], drops = [];
  for (let j = 0; j < L; j++) inten.push(eb[j + ofs] / top);
  for (let j = 0; j < L; j++) {
    const at = k => inten[((k % L) + L) % L], after = (at(j) + at(j + 1) + at(j + 2) + at(j + 3)) / 4, before = (at(j - 4) + at(j - 3) + at(j - 2) + at(j - 1)) / 4;
    if (after > 1.6 * before && at(j) > 0.5 && !drops.some(d => Math.abs(d.j - j) < 6)) drops.push({ j, v: after / (before + 1e-9) });
  }
  return { bpm, t0: t0 + ofs * bt, nb: L, drop: drop - ofs, jump: dv, inten, drops };
}
/* la bande-son de l'edit : temps du morceau ↔ temps de la vidéo (le drop du morceau = le temps du drop de la vidéo) */
async function editUserTrack(E, U) {
  const sr = 48000, bt = E.beat, ctx = new OfflineAudioContext(2, Math.ceil((E.total + 0.5) * sr), sr), N = Math.ceil(E.total / bt);
  const out = ctx.createGain(); out.connect(ctx.destination);
  out.gain.setValueAtTime(1, Math.max(0, E.total - 2.2)); out.gain.linearRampToValueAtTime(0.0001, E.total);
  const L = U.nb, idx = b => (((U.drop + b - E.dropB) % L) + L) % L;
  // morceaux continus du fichier, recollés aux bouclages par un fondu de 15 ms
  for (let b = 0; b < N; ) {
    const j = idx(b); let k = 1; while (b + k < N && idx(b + k) === j + k) k++;
    const s = ctx.createBufferSource(), g = ctx.createGain(), t = b * bt, d = k * bt;
    s.buffer = U.buf; s.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.015); g.gain.setValueAtTime(1, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.015);
    s.start(t, U.t0 + j * bt, d + 0.02);
    b += k;
  }
  return ctx.startRendering();
}
async function editLoadFile(file) {
  const data = await file.arrayBuffer();
  const buf = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(data);
  const A = editAnalyze(buf);
  EDIT_USER = Object.assign({ name: file.name.replace(/\.[^.]+$/, ''), buf }, A);
  return EDIT_USER;
}
async function startEdit(who, style) {
  if (!R || !R.rec || R.rec.frames.length < 20) return;
  if (!RP.on) startReplay();
  HL.who = who; HL.ep = null; HL.full = false; HL.pd = hlPitData(); HL.pits = HL.pd.pin;
  hlFinal(); HL.podium = finalOrder().slice(0, 3);
  if (style === 'file' && !EDIT_USER) style = 'none';
  // ta musique : ses drops suivants (et ceux de chaque reprise de la boucle), en temps de la vidéo, avec leur force
  const U = style === 'file' ? EDIT_USER : null, bpm = U ? U.bpm : (EDIT_STYLES[style] || EDIT_STYLES.electro).bpm, d2 = [];
  if (U) for (let k = 0; k < 8; k++) for (const d of U.drops) { const vb = 16 + (((d.j - U.drop) % U.nb) + U.nb) % U.nb + k * U.nb; if (vb > 16) d2.push({ t: vb * 60 / bpm, v: d.v }); }
  const E = editPlan(who, bpm, !!U); if (!E) return;
  if (U) { const main = U.drops.find(d => d.j === U.drop); E.drops = [{ t: E.dropB * E.beat, v: main ? main.v : 3 }, ...d2.filter(d => d.t < E.total - 0.5)]; }
  E.style = style; HL.edit = E; HL.clips = [];
  HL.on = true; HL.played = 0; HL.endT = 0; HL.done = false; HL.i = -1; HL.total = E.total; HL.orbit0 = Math.random() * 6.28;
  if (!HL.cv) { HL.cv = $('#hl'); HL.cv.width = HL_W; HL.cv.height = HL_H; HL.g = HL.cv.getContext('2d'); }
  document.body.classList.add('hl');
  renderer.setPixelRatio(1); renderer.setSize(HL_W, HL_H, false);
  camera.aspect = HL_W / HL_H; BASE_FOV = camera.fov = 60; camera.updateProjectionMatrix();
  paused = false; ST.speed = 1;
  $('#hl-ui').hidden = false; $('#hl-status').textContent = ''; hlShowUi();
  comSet([]);
  editStep(0);
  if (style === 'none') return;
  HL.mwait = true; $('#hl-status').textContent = L('Composition de la musique…', 'Composing the music…');
  try { E.buf = style === 'file' ? await editUserTrack(E, EDIT_USER) : await editMusic(style, E); } catch (e) { console.error(e); E.buf = null; }
  if (HL.edit !== E) return;
  HL.mwait = false; $('#hl-status').textContent = '';
}
function editAudioStop() { const E = HL.edit; if (E && E.src) { try { E.src.stop(); } catch (e) { /* déjà arrêtée */ } E.src = null; } }
/* la musique suit l'image (relancée au bon endroit si l'image a pris du retard) */
function editAudioSync() {
  const E = HL.edit; if (!E || !E.buf || EXP.on || !ST.sound) return;
  const ctx = comAudio(); if (!ctx) return;
  // le son sort du haut-parleur avec du retard (latence audio d'Android : 0,1 à 0,25 s) : on le lance d'autant plus loin
  // dans le morceau, sinon les coupes de l'aperçu arrivent avant le temps (l'export MP4, lui, est calé à l'image près)
  const lat = Math.min(0.4, (ctx.baseLatency || 0.02) + (ctx.outputLatency || (/Android/.test(navigator.userAgent) ? 0.06 : 0.01))), want = HL.played + lat;   // A17 : 0,08 + 0,06 (sortie non indiquée)
  if (E.src && Math.abs(ctx.currentTime - E.src.t0 - want) < 0.12) return;
  editAudioStop();
  if (want >= E.buf.duration - 0.05) return;
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = E.buf; g.gain.value = 0.9; s.connect(g); g.connect(ctx.destination);
  if (SND.recDest) g.connect(SND.recDest);
  s.start(0, want); s.t0 = ctx.currentTime - want; E.src = s;
}
function editStep(dt) {
  const E = HL.edit;
  if (HL.done || HL.mwait) return;
  HL.played += dt;
  if (HL.played >= E.total) { HL.played = E.total; HL.done = true; editAudioStop(); if (HL.recording) hlRecordStop(false); return; }
  editAudioSync();
  const tb = HL.played / E.beat;
  let i = E.segs.length - 1; while (i > 0 && E.segs[i].b0 > tb + 1e-6) i--;
  const sg = E.segs[i];
  if (i !== HL.i) { HL.i = i; HL.shot = -1; seekReplay(sg.t0); RP.t = clamp(sg.t0, R.rec.frames[0].t, RP.end); applyReplay(); if (sg.kind === 'finish') DIR.finDone = true; }
  if (sg.kind !== 'card') { RP.t = clamp(editRT(sg, HL.played - sg.b0 * E.beat), R.rec.frames[0].t, RP.end); applyReplay(); }
  let k = 0; sg.cams.forEach((c, j) => { if (tb - sg.b0 >= c[1]) k = j; });
  if (k !== HL.shot) {
    HL.shot = k; follow = sg.focus; const cam = sg.cams[k][0];
    if (cam === 'fixed') hlFixCam(sg, follow); else FIX.lock = false;
    camMode = cam; camInit = false;
  }
}
/* temps du replay à l'instant x du plan : vitesse fr (×1 par défaut) jusqu'au moment fort, puis elle monte jusqu'à r1 à la fin du plan */
function editRT(sg, x) {
  const pre = sg.pre != null ? sg.pre : 1e9, fr = sg.fr || 1;
  if (x <= pre) return sg.t0 + x * fr;
  const D = sg.nb * sg.bt - pre, u = Math.min(1, (x - pre) / Math.max(1e-6, D));
  return sg.t0 + pre * fr + D * (u + ((sg.r1 || 1) - 1) * u * u / 2);
}
function editText(g, txt, x, y, size, col, sc, rot, maxW) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(sc, sc);
  g.font = `900 ${size}px ${HF.t}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(4, size * 0.09); g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(txt, 0, 0, maxW); g.fillStyle = col; g.fillText(txt, 0, 0, maxW);
  g.restore();
}
const editPop = x => x < 0 ? 0 : x < 0.12 ? 1.7 - 0.7 * (x / 0.12) : 1 + 0.04 * Math.exp(-(x - 0.12) * 6);
function editCompose() {
  const g = HL.g, W = HL_W, H = HL_H, E = HL.edit, bt = E.beat, t = HL.played, tb = t / bt;
  const sg = E.segs[Math.max(0, HL.i)], k = t - sg.b0 * bt, me = R.cars[HL.who];
  // coup de zoom + flash à chaque coupe, pulsation sur chaque temps du drop, l'image tremble sur les impacts
  let z = 1, sx = 0, sy = 0, fl = 0, gh = 0;
  if (sg.kind !== 'card') { if (k < 0.22) { z += 0.1 * (1 - k / 0.22) ** 2; fl = 0.3 * Math.max(0, 1 - k / 0.1); } }
  const calm = E.style === 'file';   // ta musique : ni pulsation sur chaque temps ni tremblement sur les moments forts
  if (!calm && tb >= E.dropB && tb < E.finB) z += 0.028 * Math.exp(-(tb % 1) * bt * 9);
  for (const h of calm ? [] : E.hits) {
    const x = t - h.t; if (x < 0 || x > 0.4) continue;
    const a = (1 - x / 0.4) ** 2 * h.v; sx += (Math.random() * 2 - 1) * 16 * a; sy += (Math.random() * 2 - 1) * 16 * a; z += 0.05 * a; gh = Math.max(gh, a);
    if (x < 0.08 && !E.drops.some(d => Math.abs(d.t - h.t) < 0.01) && Math.abs(E.finB * bt - h.t) > 0.01) fl = Math.max(fl, 0.45 * Math.min(1, h.v));
  }
  const dw = W * z, dh = H * z, dx = (W - dw) / 2 + sx, dy = (H - dh) / 2 + sy;
  g.drawImage(renderer.domElement, dx, dy, dw, dh);
  const atDrop = E.drops.concat([{ t: E.finB * bt }]).some(d => t >= d.t && t - d.t < 0.45);   // pas d'image dédoublée sur un drop ni à l'arrivée
  if (gh > 0.25 && !atDrop) { g.save(); g.globalAlpha = Math.min(0.4, gh * 0.3); g.globalCompositeOperation = 'lighter'; g.drawImage(renderer.domElement, dx - 14 * gh, dy, dw, dh); g.drawImage(renderer.domElement, dx + 14 * gh, dy, dw, dh); g.restore(); }   // image dédoublée sur les gros impacts
  // accent (1er temps de chaque mesure, un temps après la coupe) : l'image s'assombrit d'un coup et reste sombre jusqu'au plan
  // suivant, qui repart en pleine lumière ; plus sombre après un drop
  let dim = 0;
  const ax = (tb - E.dropB - Math.floor((tb - E.dropB) / 4) * 4) * bt;
  if (tb >= E.dropB - 0.01 && ax < 3 * bt && sg.kind !== 'card') {   // pas avant le départ (accroche, grille)
    const aT = t - ax, dr = E.drops.find(d => Math.abs(d.t - aT) < 0.05);
    dim = (dr ? 0.5 : 0.38) * Math.min(1, ax / 0.04);
  }
  if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, W, H); }
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (dim > 0.01) { g.fillStyle = `rgba(0,0,0,${dim})`; g.fillRect(0, 0, W, H); }
  // bandes noires « cinéma » pendant l'accroche et la montée, qui s'ouvrent au drop
  const bar = tb < E.dropB ? 110 : tb < E.dropB + 0.5 ? 110 * (1 - (tb - E.dropB) / 0.5) : 0;
  if (bar > 0) { g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar); }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, W, 6); g.fillStyle = tcol(me); g.fillRect(0, 0, W * Math.min(1, t / E.total), 6);
  g.save(); safeZone(g);
  try {
    const ix = W / 2, nm = me.driver.name.split(' '), last = (nm.length > 1 ? nm.slice(1).join(' ') : nm[0]).toUpperCase(), first = nm.length > 1 ? nm[0] : '';
    if (sg.kind === 'card') {   // carton final : le bilan ligne par ligne, une ligne par temps
      const x = t - sg.b0 * bt;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(8,10,14,${Math.min(0.8, x * 2.5)})`; g.fillRect(0, 0, HL_W, HL_H); g.restore();
      const at = n => t - (sg.b0 + n) * bt;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = '#fff'; g.font = `900 30px ${HF.t}`; g.fillText('PADDOCK', ix - 22, 250); g.fillStyle = '#e10600'; g.fillText('26', ix + 82, 250);
      if (first) editText(g, first, ix, 360, 44, '#fff', editPop(at(0)), 0, W - 80);
      editText(g, last, ix, 440, 104, tcol(me), editPop(at(0)), -0.03, W - 60);
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 30px ${HF.t}`; g.textAlign = 'center'; g.fillText(`${me.team.name} · ${T.circ.flag || ''} ${tr(T.circ.name)}`, ix, 520, W - 60);
      const rows = [[L('DÉPART', 'START'), 'P' + E.grid], [L('ARRIVÉE', 'FINISH'), E.dnf ? 'OUT' : 'P' + E.pos], [L('DÉPASSEMENTS', 'OVERTAKES'), String(E.nOt)], [L('ARRÊTS', 'STOPS'), String(E.stops)]];
      rows.forEach(([a, v], i) => {
        const x2 = at(1 + i); if (x2 < 0) return; const y = 620 + i * 96, s = editPop(x2);
        g.save(); g.translate(ix, y); g.scale(s, s);
        hlBox(g, -250, -40, 500, 80, 'rgba(255,255,255,.08)', 14); g.fillStyle = tcol(me); g.fillRect(-250, -40, 8, 80);
        g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 28px ${HF.t}`; g.fillText(a, -220, 2);
        g.textAlign = 'right'; g.fillStyle = i === 1 && !E.dnf && E.pos <= 3 ? ['#ffd700', '#e3e3e3', '#e08a3c'][E.pos - 1] : '#fff'; g.font = `900 46px ${HF.t}`; g.fillText(v, 225, 2);
        g.restore();
      });
      if (at(5) >= 0) { g.globalAlpha = Math.min(1, at(5) * 4); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.font = `800 30px ${HF.t}`; g.fillText(tr('Abonne-toi pour le prochain Grand Prix'), ix, 1030, W - 60); g.globalAlpha = 1; }
      return;
    }
    if (sg.kind === 'hook') {   // accroche : le nom, puis la question « P8 → ? »
      const x0 = t, x1 = t - 4 * bt;
      if (tb < 4) {
        if (first) editText(g, first, ix, 460, 56, '#fff', editPop(x0), 0, W - 80);
        editText(g, last, ix, 565, 150, tcol(me), editPop(x0), -0.04, W - 50);
        if (tb >= 2) editText(g, me.team.name.toUpperCase(), ix, 670, 44, '#fff', editPop(t - 2 * bt), 0, W - 80);
      } else {
        editText(g, `${T.circ.flag || ''} ${tr(T.circ.name)}`.trim().toUpperCase(), ix, 460, 50, '#fff', editPop(x1), 0, W - 80);
        editText(g, `P${E.grid} → ?`, ix, 590, 190, '#ffd23f', editPop(x1), -0.04, W - 60);
      }
    } else {
      // la position du pilote en gros, au centre (au-dessus de la voiture : pas besoin de détourner le regard) ; une flèche (sans nombre) quand il vient de gagner ▲ ou de perdre ▼ une place
      const f = hlFrameAt(RP.t), out = !!(f.g[HL.who * 2] & 2), pos = RP.t < R.startT ? E.grid : hlPosAt(HL.who, RP.t);
      const was = RP.t - 1.8 < R.startT ? E.grid : hlPosAt(HL.who, RP.t - 1.8), dir = out || RP.t < R.startT + 2 ? 0 : Math.sign(was - pos);
      const txt = out ? 'OUT' : 'P' + pos;
      g.font = `900 120px ${HF.t}`; const tw = g.measureText(txt).width, bw = tw + (dir ? 120 : 52);
      const lap = clamp(Math.floor(f.f[HL.who * 7] / T.L) + 1, 1, R.laps), lapTxt = RP.t < R.startT ? tr('GRILLE') : `${L('TOUR', 'LAP')} ${lap}/${R.laps}`;
      const BW = Math.max(bw, 250), X = ix - BW / 2, Y = 330;
      hlBox(g, X, Y, BW, 200, 'rgba(10,12,16,.62)', 18); g.fillStyle = tcol(me); g.fillRect(X, Y, 12, 200);
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(txt, X + 30, Y + 75);
      g.font = `800 38px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(lapTxt, X + 32, Y + 162);   // le tour, sous la position
      if (dir) {
        const ax = X + 30 + tw + 50, ay = Y + 75, k = dir > 0 ? -1 : 1;
        g.fillStyle = dir > 0 ? '#39ff88' : '#ff4d4d'; g.beginPath(); g.moveTo(ax - 32, ay - 22 * k); g.lineTo(ax + 32, ay - 22 * k); g.lineTo(ax, ay + 30 * k); g.closePath(); g.fill();
      }
    }
    if (EDIT_TXT && sg.kind !== 'hook') {
      // pilote, position et tour, en haut à gauche
      const f = hlFrameAt(RP.t), out = !!(f.g[HL.who * 2] & 2), lap = clamp(Math.floor(f.f[HL.who * 7] / T.L) + 1, 1, R.laps);
      const pos = RP.t < R.startT ? E.grid : hlPosAt(HL.who, RP.t);
      hlBox(g, 34, 140, 300, 96, 'rgba(10,12,16,.78)', 14); g.fillStyle = tcol(me); g.fillRect(34, 140, 9, 96);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.font = `900 62px ${HF.t}`; g.fillText(out ? 'OUT' : 'P' + pos, 56, 212);
      const pw = g.measureText(out ? 'OUT' : 'P' + pos).width;
      g.font = `900 30px ${HF.t}`; g.fillText(me.code, 72 + pw, 184);
      g.font = `700 22px ${HF.t}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(RP.t < R.startT ? tr('GRILLE') : `${L('TOUR', 'LAP')} ${lap}/${R.laps}`, 72 + pw, 216);
    }
    if (sg.kind === 'grid') {   // les cinq feux rouges s'allument sur les derniers temps de la montée, et s'éteignent au drop
      const y = 610; hlBox(g, ix - 230, y - 56, 460, 112, 'rgba(10,12,16,.82)', 20);
      for (let j = 0; j < 5; j++) {
        const on = tb >= E.dropB - 5 + j && tb < E.dropB, cx = ix - 176 + j * 88;
        g.beginPath(); g.arc(cx, y, 32, 0, Math.PI * 2); g.fillStyle = on ? '#ff1e1e' : '#2a2d33'; g.fill();
        if (on) { g.save(); g.globalAlpha = 0.35; g.beginPath(); g.arc(cx, y, 44, 0, Math.PI * 2); g.fill(); g.restore(); }
      }
      if (tb < E.dropB - 5) editText(g, L('PRÊT ?', 'READY?'), ix, 740, 70, '#fff', editPop(t - (E.dropB - 8) * bt), 0, W - 80);
    }
    for (const s of E.stamps) {   // le gros chiffre / mot au centre, posé sur le temps
      const x = t - s.b * bt, d = s.dur * bt; if (x < 0 || x > d || (!EDIT_TXT && s.b > E.dropB)) continue;
      g.globalAlpha = x > d - 0.18 ? Math.max(0, (d - x) / 0.18) : 1;
      editText(g, s.big, ix, EDIT_TXT ? 590 : 680, s.size || 200, s.col, editPop(x), -0.05, W - 60);   // sous la position du pilote
      if (s.small) {
        g.font = `800 42px ${HF.t}`; const w = Math.min(W - 80, g.measureText(s.small).width + 52), sc = editPop(x - 0.06);
        if (sc > 0) { g.save(); g.translate(ix, 750); g.scale(sc, sc); hlBox(g, -w / 2, -36, w, 72, 'rgba(10,12,16,.85)', 12); g.fillStyle = s.col; g.fillRect(-w / 2, -36, 8, 72);
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.small, 4, 2, w - 30); g.restore(); }
      }
      g.globalAlpha = 1;
    }
  } finally { g.restore(); }
}
/* enregistrement vidéo : image composée + son du moteur */
function hlRecordStart(silent) {
  if (!window.MediaRecorder || !HL.cv.captureStream) { $('#hl-status').textContent = 'Export vidéo non disponible sur cet appareil'; return; }
  const stream = HL.cv.captureStream(30);
  if (!silent) try {
    if (COM.on) comAudio();
    if (SND.ctx) { if (!SND.recDest) { SND.recDest = SND.ctx.createMediaStreamDestination(); SND.master.connect(SND.recDest); } for (const tr of SND.recDest.stream.getAudioTracks()) stream.addTrack(tr); }
    if (COM.out && !COM.outRec) { COM.out.connect(SND.recDest); COM.outRec = true; }   // la voix du commentaire est enregistrée avec l'image
  } catch (e) { /* vidéo sans son */ }
  const types = silent ? ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] : ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  HL.mime = mime || 'video/webm';
  HL.chunks = [];
  HL.rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3.5e6 } : { videoBitsPerSecond: 3.5e6 });
  HL.rec.ondataavailable = e => { if (e.data && e.data.size) HL.chunks.push(e.data); };
  HL.rec.start(1000);
  HL.recording = true;
}
function hlRecordStop(cancel) {
  const rec = HL.rec; HL.recording = false; if (!rec) return;
  rec.onstop = () => {
    if (cancel) { HL.chunks = []; return; }
    const blob = new Blob(HL.chunks, { type: HL.mime.split(';')[0] });
    hlSave(blob);
  };
  try { rec.stop(); } catch (e) { /* déjà arrêté */ }
  HL.rec = null;
  if (!cancel) $('#hl-status').textContent = 'Préparation de la vidéo…';
}
async function hlSave(blob) {
  const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
  const name = `paddock26-${T.circ.id}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`;
  const N = window.PaddockNative;
  if (N && N.saveBegin) {
    // appli Android : le fichier est écrit dans Films/Paddock26 par morceaux
    try {
      N.saveBegin(name, blob.type);
      const CH = 768 * 1024;
      for (let o = 0; o < blob.size; o += CH) {
        const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob.slice(o, o + CH)); });
        N.saveChunk(b64);
        $('#hl-status').textContent = `Enregistrement… ${Math.round(Math.min(1, (o + CH) / blob.size) * 100)} %`;
      }
      const where = N.saveEnd();
      $('#hl-status').textContent = `Vidéo enregistrée : ${where}`;
      $('#hl-share').hidden = false;
    } catch (e) { $('#hl-status').textContent = 'Échec de l’enregistrement de la vidéo'; }
    return;
  }
  // page publiée sur claude.ai : l'enregistrement passe par la capacité « downloads » (le spectateur confirme)
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); $('#hl-status').textContent = `Vidéo enregistrée : ${name}`; }
    catch (e) { $('#hl-status').textContent = e && e.code === 'declined' ? 'Enregistrement annulé' : 'Enregistrement impossible ici'; }
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  $('#hl-status').textContent = `Vidéo téléchargée : ${name}`;
}

/* =====================================================================
   EXPORT RAPIDE : la vidéo est calculée image par image, aussi vite que le téléphone le peut (pas besoin de la regarder
   jusqu'au bout), puis encodée en vrai MP4 (H.264 + AAC via WebCodecs, assemblé par mp4-muxer) avec sa durée complète.
   Le son (moteurs + commentaire) est rendu dans un contexte audio hors ligne calé sur le temps de la vidéo.
   Sans WebCodecs : ancien enregistrement en temps réel (MediaRecorder).
   ===================================================================== */
const EXP = { on: false, voice: null, fps: 30 };
const expOk = () => !!(window.VideoEncoder && window.VideoFrame && window.OfflineAudioContext && window.Mp4Muxer);
const expYield = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
async function expVideoCfg() {
  for (const codec of ['avc1.640028', 'avc1.4D4028', 'avc1.42E028', 'avc1.42001F']) {
    const cfg = { codec, width: HL_W, height: HL_H, bitrate: 6e6, framerate: EXP.fps, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) { /* suivant */ }
  }
  return null;
}
async function expAudioCfg() {
  if (!window.AudioEncoder) return null;
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 };
    try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, mux }; } catch (e) { /* suivant */ }
  }
  return null;
}
/* la vidéo en cours (highlights, vidéo du championnat, tour record, clip) : ce qui la fait avancer, la dessine, et sa fin */
function expMode() {
  if (VID.on) return { step: dt => vidStep(dt), compose: vidCompose, done: () => VID.done, live: () => VID.on, max: VID.total + 2 };
  if (HL.on) return { step: dt => hlStep(dt), compose: hlCompose, done: () => HL.done, live: () => HL.on, max: HL.total + 6 };
  if (TLR.video) { const S = TLR.neu.samples; return { step: dt => ttReplayStep(dt), compose: ttCompose, done: () => TLR.vdone, live: () => TLR.video, max: S[S.length - 1][0] - TLR.t + 7 }; }
  if (CLIP.video) return { step: dt => { RP.t = Math.min(RP.t + dt, CLIP.b); applyReplay(); clipStep(); }, compose: clipCompose, done: () => CLIP.done, live: () => CLIP.video, max: CLIP.b - RP.t + 2 };
  return null;
}
const expStatus = t => { $('#hl-status').textContent = t; };
async function expStart() {
  const M = expMode(); if (!M || EXP.on) return;
  const vcfg = await expVideoCfg();
  if (!vcfg) { hlRecordStart(); return; }   // pas d'encodeur H.264 : enregistrement en temps réel
  const acfg = await expAudioCfg(), fps = EXP.fps, sr = 48000, maxDur = Math.max(3, M.max);
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: HL_W, height: HL_H, frameRate: fps }, audio: acfg ? { codec: acfg.mux, sampleRate: sr, numberOfChannels: 2 } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
  let err = null;
  const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { err = e; } });
  venc.configure(vcfg);
  // son : le jeu est rejoué dans un contexte audio hors ligne (le vrai est coupé pendant l'export)
  const off = new OfflineAudioContext(2, Math.ceil((maxDur + 1) * sr), sr);
  const live = Object.assign({}, SND);
  if (SND.ctx && SND.master) { try { SND.master.gain.cancelScheduledValues(SND.ctx.currentTime); SND.master.gain.setValueAtTime(0, SND.ctx.currentTime); } catch (e) { /* ignoré */ } }
  if (COM.cur) comStop();
  for (const k of Object.keys(SND)) delete SND[k];
  SND.ctx = off; SND.offT = 0; sndBuild(off);
  EXP.on = true; EXP.voice = []; paused = false;
  $('#hl-rec').disabled = true; $('#hl-share').hidden = true;
  requestWake();
  let n = 0, dur = 0;
  try {
    const t0 = performance.now();
    for (; n < maxDur * fps; n++) {
      if (!M.live() || err) break;
      const dt = 1 / fps, ms = n * 1000 / fps;
      SND.offT = n / fps;
      M.step(dt);
      updateCars(dt); director(ms); updateCamera(dt); updateWeatherFx(dt); updateAudio(dt);
      renderer.render(scene, camera);
      M.compose();
      if (R.tt) updateTimeTrial();
      const fr = new VideoFrame(HL.cv, { timestamp: Math.round(n * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(fr, { keyFrame: n % (fps * 2) === 0 }); fr.close();
      if (M.done()) { n++; break; }
      while (venc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
      if (n % 2 === 0) await expYield();
      if (n % 15 === 0) { const sp = (n / fps) / Math.max(0.001, (performance.now() - t0) / 1000); expStatus(L(`Export de la vidéo… ${Math.min(99, Math.round(n / fps / Math.max(1, maxDur - 3) * 100))} % (×${sp.toFixed(1)})`, `Exporting the video… ${Math.min(99, Math.round(n / fps / Math.max(1, maxDur - 3) * 100))} % (×${sp.toFixed(1)})`)); }
    }
    dur = n / fps;
    await venc.flush();
  } catch (e) { err = err || e; }
  // fin de l'image : on rend le son, voix comprise
  const voices = EXP.voice;
  for (const k of Object.keys(SND)) delete SND[k];
  Object.assign(SND, live);
  EXP.on = false; COM.cur = null;
  $('#hl-rec').disabled = false;
  if (err || !M.live()) { try { venc.close(); } catch (e) { /* ignoré */ } expStatus(err ? L('Échec de l’export vidéo', 'Video export failed') : ''); if (err) console.error(err); return; }
  try {
    if (acfg) {
      expStatus(L('Export de la vidéo… son', 'Exporting the video… audio'));
      const vin = comChain(off).in;
      for (const v of voices) { const src = off.createBufferSource(); src.buffer = v.buf; src.connect(vin); src.start(v.t); if (v.stop != null) src.stop(v.stop); }
      if (HL.on && HL.edit && HL.edit.buf) { const src = off.createBufferSource(), gn = off.createGain(); src.buffer = HL.edit.buf; gn.gain.value = 0.9; src.connect(gn); gn.connect(off.destination); src.start(0); }   // musique de l'edit
      if (VID.on) for (const e of vidSfx()) { const src = off.createBufferSource(), gn = off.createGain(); src.buffer = sfxBuf(off, e.k); gn.gain.value = e.v; src.connect(gn); gn.connect(off.destination); src.start(e.t); }   // effets de transition
      const ab = await off.startRendering(), N = Math.min(ab.length, Math.round(dur * sr)), c0 = ab.getChannelData(0), c1 = ab.getChannelData(1);
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: e => { err = e; } });
      aenc.configure(acfg.cfg);
      for (let i = 0; i < N; i += 4800) {
        const k = Math.min(4800, N - i), d = new Float32Array(k * 2);
        d.set(c0.subarray(i, i + k), 0); d.set(c1.subarray(i, i + k), k);
        const a = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(i / sr * 1e6), data: d });
        aenc.encode(a); a.close();
        if (aenc.encodeQueueSize > 20) await new Promise(r => setTimeout(r, 2));
      }
      await aenc.flush();
    }
    muxer.finalize();
    if (err) throw err;
    expStatus(L('Préparation de la vidéo…', 'Preparing the video…'));
    await hlSave(new Blob([target.buffer], { type: 'video/mp4' }));
  } catch (e) { console.error(e); expStatus(L('Échec de l’export vidéo', 'Video export failed')); }
}

/* =====================================================================
   VIDÉOS DU CHAMPIONNAT (format TikTok 9:16, ~1 min) : présentation du Grand Prix et grille de départ
   La scène 3D du circuit sert de fond (survol en drone, ou travelling le long de la grille) ;
   les textes sont dessinés dans la zone de sécurité TikTok. Pas de son : la voix off est ajoutée au montage.
   ===================================================================== */
const VID = { on: false, kind: '', t: 0, segs: [], total: 0, back: '', done: false, s0: 0, camS: 0, camD: 0, focus: 0 };
/* cadre de dessin : zone de sécurité TikTok (ou presque toute l'image) */
const vbox = () => ST.tiktok ? { x: SAFE.l, y: SAFE.t, w: HL_W - SAFE.l - SAFE.r, h: HL_H - SAFE.t - SAFE.b } : { x: 28, y: 40, w: HL_W - 56, h: HL_H - 80 };
const fmtGap = (x, d) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d ?? 3).replace('.', L(',', '.'));
function vidScene(ci, entries, weather) {
  const circ = CIRCUITS[ci];
  ST.circuit = ci;
  T = getTrack(ci);
  R = SIM.createRace(T, entries, { laps: lapsFor(circ), weather: weather || 'dry', chaos: 1 });
  R.over = true; R.resultsShown = true; R.vid = true;   // aucune simulation : les voitures restent sur la grille
  HUM = null; follow = 0; camMode = 'tv';
  enterView(circ);
  if (SND.ctx) { try { SND.master.gain.setValueAtTime(0, SND.ctx.currentTime); SND.ctx.suspend(); } catch (e) { /* ignoré */ } }
}
function vidStart(kind) {
  if (!PRO) { openPro(); return; }
  const back = curScreen();
  if (kind === 'preview') {
    const S = CH.season; if (!S || S.round >= S.rounds.length) return;
    const circ = champCircuit(), rd = S.rounds[S.round];
    const entries = champTeams().flatMap(t => t.drivers.map(d => ({ team: t, driver: d })));
    vidScene(CIRCUITS.indexOf(circ), entries, rd.weather === 'mixed' ? 'dry' : rd.weather);
    VID.segs = vidPreviewSegs(S, circ, rd);
  } else if (kind === 'season') {
    const S = CH.season; if (!S) return;
    const r0 = S.rounds[0], circ = CIRCUITS.find(c => c.id === r0.id);
    // engagés rangés par performance de début de saison : la meilleure écurie en tête de grille
    const teams = careerBase().slice().sort((a, b) => perfRating(b) - perfRating(a));
    vidScene(CIRCUITS.indexOf(circ), teams.flatMap(t => t.drivers.map(d => ({ team: t, driver: d }))), 'dry');
    VID.segs = vidSeasonSegs(S, teams, circ);
  } else if (kind === 'recap') {
    const S = CH.season; if (!S || S.round < S.rounds.length) return;
    // grille rangée selon le classement final : le champion en pole (caméra sur sa voiture à la fin)
    const order = standings().sortD.map(d => d.name), teams = champTeams();
    const entries = order.map(nm => { const t = teams.find(x => x.drivers.some(d => d.name === nm)); return t && { team: t, driver: t.drivers.find(d => d.name === nm) }; }).filter(Boolean);
    const circ = CIRCUITS.find(c => c.id === S.rounds[S.rounds.length - 1].id);
    vidScene(CIRCUITS.indexOf(circ), entries, 'dry');
    VID.segs = vidRecapSegs(S, entries.map(e => e.driver.name));
  } else if (kind === 'driver') {
    const S = CH.season, P = VID.pre; if (!S || S.round < S.rounds.length || !P) return;
    const order = standings().sortD.map(d => d.name), teams = champTeams();
    const entries = order.map(nm => { const t = teams.find(x => x.drivers.some(d => d.name === nm)); return t && { team: t, driver: t.drivers.find(d => d.name === nm) }; }).filter(Boolean);
    vidScene(CIRCUITS.indexOf(CIRCUITS.find(c => c.id === S.rounds[S.rounds.length - 1].id)), entries, 'dry');
    VID.segs = vidDriverSegs(S, P.name, P.packs);
  } else if (kind === 'exploits') {
    const S = CH.season; if (!S || S.round < S.rounds.length) return;
    // grille : le « roi de l'exploit » en pole (caméra sur sa voiture), puis les autres selon leurs exploits
    const F = exploitFacts(S), teams = champTeams(), first = [...F.kings.map(p => p.name)];
    const order = [...new Set([...first, ...standings().sortD.map(d => d.name)])];
    const entries = order.map(nm => { const t = teams.find(x => x.drivers.some(d => d.name === nm)); return t && { team: t, driver: t.drivers.find(d => d.name === nm) }; }).filter(Boolean);
    vidScene(CIRCUITS.indexOf(CIRCUITS.find(c => c.id === S.rounds[S.rounds.length - 1].id)), entries, 'dry');
    VID.segs = vidExploitSegs(S, nm => { const i = entries.findIndex(e => e.driver.name === nm); return i >= 0 ? i : null; });
  } else if (kind === 'dev' || kind === 'titleD' || kind === 'titleT') {
    const S = CH.season; if (!S || S.round < S.rounds.length) return;
    const teams = champTeams(), circ = CIRCUITS.find(c => c.id === S.rounds[S.rounds.length - 1].id);
    let entries, carOf;
    if (kind === 'titleD') {   // grille rangée selon le classement final des pilotes
      const order = standings().sortD.map(d => d.name);
      entries = order.map(nm => { const t = teams.find(x => x.drivers.some(d => d.name === nm)); return t && { team: t, driver: t.drivers.find(d => d.name === nm) }; }).filter(Boolean);
      carOf = nm => { const i = entries.findIndex(e => e.driver.name === nm); return i >= 0 ? i : null; };
    } else {   // écuries rangées par performance finale (évolutions) ou par classement (titre des écuries) : leurs deux voitures côte à côte
      const tOrder = kind === 'dev' ? teams.slice().sort((a, b) => perfRating(b) - perfRating(a)) : standings().sortT.map(x => teams.find(t => t.name === x.name)).filter(Boolean);
      entries = tOrder.flatMap(t => t.drivers.map(d => ({ team: t, driver: d })));
      carOf = nm => { const i = entries.findIndex(e => e.team.name === nm); return i >= 0 ? i : null; };
      if (kind === 'dev') { vidScene(CIRCUITS.indexOf(circ), entries, 'dry'); VID.segs = vidDevSegs(S, tOrder); }
    }
    if (kind !== 'dev') { vidScene(CIRCUITS.indexOf(circ), entries, 'dry'); VID.segs = vidTitleSegs(S, kind === 'titleT' ? 't' : 'd', carOf); }
  } else {
    if (!ST.quali) return;
    const noLap = r => r.entry.driver.name === ST.human && !r.mine;
    const rows = [...ST.quali.filter(r => !noLap(r)), ...ST.quali.filter(noLap)];
    vidScene(ST.circuit, rows.map(r => r.entry), ST.weather === 'mixed' ? 'dry' : ST.weather);
    VID.segs = vidGridSegs(rows);
  }
  VID.kind = kind; VID.noVoice = kind === 'driver'; VID.back = back; VID.on = true; VID.t = 0; VID.done = false; VID.lastCam = '';
  VID.total = VID.segs.reduce((a, s) => a + s.dur, 0);
  let t0 = 0; for (const s of VID.segs) { s.t0 = t0; t0 += s.dur; }
  VID.s0 = SIM.mod(R.cars[0].s + 60, T.L); VID.camS = VID.s0;
  if (!HL.cv) { HL.cv = $('#hl'); HL.cv.width = HL_W; HL.cv.height = HL_H; HL.g = HL.cv.getContext('2d'); }
  document.body.classList.add('hl');
  renderer.setPixelRatio(1); renderer.setSize(HL_W, HL_H, false);
  camera.aspect = HL_W / HL_H; BASE_FOV = camera.fov = 60; camera.updateProjectionMatrix(); camInit = false;
  paused = false;
  $('#hl-ui').hidden = false; $('#hl-ui').classList.remove('fade'); $('#hl-rec').hidden = false; $('#hl-share').hidden = true; $('#hl-cam').hidden = true;
  $('#hl-status').textContent = '';
  VID.cur = null; vidClipTick();
  if (COM.on) comAudio();
  comSet(comVidLines());
}
function vidStop() {
  if (!VID.on) return;
  if (HL.recording) hlRecordStop(true);
  comSet([]); COM.after = null;
  VID.on = false; document.body.classList.remove('hl'); $('#hl-ui').hidden = true;
  renderer.setPixelRatio(QUAL.pr()); resize();
  R = null; HUM = null;
  if (VID.back === 'quali') { renderQuali(); show('quali'); } else openChamp();
}
/* ---- effets sonores des vidéos (synthétisés, aucun fichier) : « whoosh » à chaque transition, impact quand le résultat apparaît ---- */
function sfxBuf(ctx, kind) {
  const sr = ctx.sampleRate, T = kind === 'whoosh' ? 0.42 : 0.55, len = Math.round(sr * T), b = ctx.createBuffer(2, len, sr), L0 = b.getChannelData(0), R0 = b.getChannelData(1);
  let y = 0, y2 = 0, pk = 1e-6;
  for (let i = 0; i < len; i++) {
    const t = i / sr, u = t / T;
    let v;
    if (kind === 'whoosh') {   // bruit filtré dont le filtre s'ouvre puis se referme, qui passe de gauche à droite
      const a = 0.03 + 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 2;
      y += a * (Math.random() * 2 - 1 - y); y2 += a * (y - y2);
      v = y2 * Math.sin(Math.PI * u) ** 1.6;
      L0[i] = v * (1.1 - u); R0[i] = v * (0.1 + u);
    } else {   // impact grave : sinus qui descend + petit clic
      const f = 95 - 50 * u;
      v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 7) + (Math.random() * 2 - 1) * Math.exp(-t * 260) * 0.6;
      L0[i] = R0[i] = v;
    }
    pk = Math.max(pk, Math.abs(L0[i]), Math.abs(R0[i]));
  }
  const g = (kind === 'whoosh' ? 0.55 : 0.8) / pk;
  for (let i = 0; i < len; i++) { L0[i] *= g; R0[i] *= g; }
  return b;
}
/* moments des effets : séquences « wipe » (montage course par course) */
function vidSfx() {
  const out = [];
  for (const sg of VID.segs) {
    if (sg.wipe) { out.push({ t: Math.max(0, sg.t0 - 0.12), k: 'whoosh', v: 1.4 }); out.push({ t: sg.t0 + 0.15, k: 'hit', v: 0.7 }); }
    else if (sg.flashCut) out.push({ t: Math.max(0, sg.t0 - 0.05), k: 'whoosh', v: 0.8 });
  }
  return out;
}
function vidSfxTick(t0, t1) {
  if (EXP.on || !COM.on) return;
  const ev = vidSfx().filter(e => e.t > t0 && e.t <= t1); if (!ev.length) return;
  const ctx = comAudio(); if (!ctx) return;
  for (const e of ev) { const src = ctx.createBufferSource(), gn = ctx.createGain(); src.buffer = sfxBuf(ctx, e.k); gn.gain.value = e.v; src.connect(gn); gn.connect(ctx.destination); src.start(); }
}
function vidRestart() { VID.t = 0; VID.done = false; VID.lastCam = ''; camInit = false; VID.cur = null; VID.compSeg = null; vidClipTick(); comRewind(); }
function vidStep(dt) {
  if (HL.uiT > 0 && !HL.recording && (HL.uiT -= dt) <= 0) $('#hl-ui').classList.add('fade');
  if (VID.done || COM.wait) return;   // la vidéo démarre quand le commentaire est prêt
  const tPrev = VID.t; VID.t += dt; comTick(VID.t); vidClipTick(); vidSfxTick(tPrev, VID.t);
  if (VID.t >= VID.total) { VID.t = VID.total; VID.done = true; if (HL.recording) hlRecordStop(false); }
}
const vidSeg = () => { let s = VID.segs[0]; for (const x of VID.segs) if (VID.t >= x.t0) s = x; return s; };
/* caméras : survol du circuit en drone, ou travelling le long de la grille de départ */
function vidCamera(dt) {
  const sg = vidSeg(), k = 1 - Math.exp(-dt * 2.2);
  if (sg.cam !== VID.lastCam) { VID.lastCam = sg.cam; camInit = false; }   // changement de type de plan : coupe franche
  let pos, look;
  const P = (s, d, y) => { const w = SIM.worldPos(T, SIM.mod(s, T.L), d); return new THREE.Vector3(w.x, y, -w.y); };
  if (sg.cam === 'car') {   // ligne de la grille : caméra devant la ligne, regard vers les deux voitures
    const ids = [sg.focus, sg.focus2].filter(i => i != null && R.cars[i]), s0 = R.cars[ids[0]].s, sm = s0 + ids.reduce((a, i) => a + (SIM.mod(R.cars[i].s - s0 + T.L / 2, T.L) - T.L / 2), 0) / ids.length, u = (VID.t - sg.t0) / sg.dur;
    // dans l'axe de la grille, devant la ligne : les deux voitures sont visibles, en haut de l'image (le carton occupe le bas)
    pos = P(sm + 20 - u * 1.5, 0, 7.5); look = P(sm + (sg.look ?? 6.5) - u * 1.5, 0, 0);
  } else if (sg.cam === 'pole') {
    const c = R.cars[sg.focus ?? 0], p = carPose(c), h = p.h, fx = Math.cos(h), fz = -Math.sin(h), sx = -fz, sz = fx;
    const side = (c.d >= 0 ? -1 : 1), u = (VID.t - sg.t0) / sg.dur;
    const car = new THREE.Vector3(p.x, 0, -p.y);
    const ahead = 12 - u * 3, lat = 6 * side, hgt = 2.4 + u * 0.8;
    pos = car.clone().add(new THREE.Vector3(fx * ahead + sx * lat, hgt, fz * ahead + sz * lat));
    look = car.clone().add(new THREE.Vector3(-fx * 2, 0.7, -fz * 2));
  } else if (sg.cam === 'gridwide') {
    const c0 = R.cars[0], u = (VID.t - sg.t0) / sg.dur;
    pos = P(c0.s + 35 - u * 20, 0, 14 + u * 4); look = P(c0.s - 90, 0, 0);
  } else {   // survol du circuit (vitesse constante le long de la trajectoire)
    VID.camS = SIM.mod(VID.s0 + VID.t * (T.street ? 45 : 62), T.L);
    const s = VID.camS, hgt = (T.street ? 34 : 24) + 10 * Math.sin(VID.t * 0.21);
    pos = P(s - 45, SIM.at(T, T.alpha, s - 45) * 0.5, hgt); look = P(s + 70, SIM.at(T, T.alpha, s + 70), 0);
  }
  if (!camInit) { camPos.copy(pos); camLook.copy(look); camInit = true; }
  else { camPos.lerp(pos, k); camLook.lerp(look, Math.min(1, k * 1.4)); }
  camera.up.set(0, 1, 0);
  camera.position.copy(camPos); camera.lookAt(camLook);
}
/* ---- dessin ---- */
function vidCompose() {
  const g = HL.g, W = HL_W, H = HL_H, B = vbox(), sg = vidSeg(), lt = VID.t - sg.t0;
  // changement de séquence « wipe » : on garde la dernière image de la précédente pour la faire glisser
  g.filter = 'none';   // jamais de flou résiduel sur l'image principale
  if (sg !== VID.compSeg) {
    if (sg.wipe && VID.compSeg) { const c = VID.prevCv || (VID.prevCv = document.createElement('canvas')); c.width = W; c.height = H; c.getContext('2d').drawImage(HL.cv, 0, 0); VID.hasPrev = true; } else VID.hasPrev = false;
    VID.compSeg = sg;
  }
  if (sg.wipe) { const z = 1 + 0.1 * Math.max(0, 1 - lt / 0.35) ** 2; g.drawImage(renderer.domElement, W * (1 - z) / 2, H * (1 - z) / 2, W * z, H * z); }   // petit zoom d'entrée
  else g.drawImage(renderer.domElement, 0, 0, W, H);
  // assombrit le fond pour que les textes ressortent
  g.fillStyle = sg.dim != null ? `rgba(6,8,12,${sg.dim})` : 'rgba(6,8,12,.38)'; g.fillRect(0, 0, W, H);
  g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  // bandeau du haut : logo + progression
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(B.x, B.y, B.w, 5); g.fillStyle = '#e10600'; g.fillRect(B.x, B.y, B.w * Math.min(1, VID.t / VID.total), 5);
  g.fillStyle = '#fff'; g.font = `900 26px ${HF.t}`; g.fillText('PADDOCK', B.x, B.y + 40);
  g.fillStyle = '#e10600'; g.fillText('26', B.x + g.measureText('PADDOCK ').width, B.y + 40);
  // un épisode = un Grand Prix : la présentation est la partie 1, la grille la partie 2
  const part = VID.kind === 'preview' ? 1 : VID.kind === 'grid' ? 2 : 0;
  if (part) {
    const S = CH.season, rd = S && (VID.kind === 'preview' || CH.pending) && S.round < S.rounds.length ? S.round + 1 : null;
    vText(g, (rd ? L(`ÉPISODE ${rd} · `, `EPISODE ${rd} · `) : '') + L(`PARTIE ${part}`, `PART ${part}`), B.x + B.w, B.y + 38, 20, { w: 900, col: 'rgba(255,255,255,.85)', al: 'right' });
  }
  const a = sg.noFade ? 1 : Math.min(1, lt / 0.35) * Math.min(1, (sg.dur - lt) / 0.35);
  g.globalAlpha = VID.done ? 1 : Math.max(0, a);
  sg.draw(g, B, lt, sg);
  g.restore();
  // transition par flou rapide : l'image précédente se dissout dans un flou pendant que la nouvelle sort du flou
  const TW = 0.24;
  if (sg.wipe && VID.hasPrev && lt < TW) {
    // le flou est calculé sur des images à part (le filtre ne touche jamais le canvas principal)
    const e = vEase(Math.min(1, lt / TW)), mk = k => VID[k] || (VID[k] = document.createElement('canvas'));
    const blurred = (src, px, k) => { const c = mk(k); if (c.width !== W) { c.width = W; c.height = H; } const x = c.getContext('2d'); x.filter = 'none'; x.clearRect(0, 0, W, H); x.filter = `blur(${px.toFixed(1)}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; return c; };
    const cur = mk('tmpCv'); if (cur.width !== W) { cur.width = W; cur.height = H; } cur.getContext('2d').drawImage(HL.cv, 0, 0);
    g.save(); g.drawImage(blurred(cur, (1 - e) * 16, 'bCv1'), 0, 0);
    g.globalAlpha = 1 - e; g.drawImage(blurred(VID.prevCv, 8 + 16 * e, 'bCv2'), 0, 0); g.restore();
  }
  if (sg.flashCut && lt < 0.07) { g.fillStyle = `rgba(255,255,255,${0.45 * (1 - lt / 0.07)})`; g.fillRect(0, 0, W, H); }
}
/* éléments communs */
function vText(g, txt, x, y, size, opts) {
  opts = opts || {};
  g.font = `${opts.w || 800} ${size}px ${opts.mono ? HF.m : HF.t}`; g.fillStyle = opts.col || '#fff'; g.textAlign = opts.al || 'left';
  g.fillText(txt, x, y, opts.max); g.textAlign = 'left';
}
function vHead(g, B, kicker, title, y) {
  y = y ?? B.y + 92;
  vText(g, kicker.toUpperCase(), B.x, y, 22, { w: 900, col: '#e10600' });
  vText(g, title, B.x, y + 52, 48, { w: 900, max: B.w });
  g.fillStyle = '#e10600'; g.fillRect(B.x, y + 68, 64, 5);
  return y + 110;
}
const vReveal = (lt, i, n, span) => Math.max(0, Math.min(1, (lt - 0.3 - i * (span ?? 1.6) / Math.max(1, n)) / 0.3));
function vRow(g, B, y, h, pos, color, main, sub, right, opts) {
  opts = opts || {};
  hlBox(g, B.x, y, B.w, h - 6, opts.hi ? 'rgba(225,6,0,.38)' : 'rgba(10,12,16,.78)', 8);
  g.fillStyle = color; g.fillRect(B.x, y, 7, h - 6);
  if (pos != null) vText(g, String(pos), B.x + 46, y + h / 2 + 7, 24, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.75)' });
  const x0 = B.x + (pos != null ? 60 : 20);
  if (sub) { vText(g, main, x0, y + h / 2 - 3, opts.size || 25, { w: 800, max: B.w - (x0 - B.x) - (opts.rw || 120) }); vText(g, sub, x0, y + h / 2 + 20, 16, { w: 600, col: 'rgba(255,255,255,.7)', max: B.w - (x0 - B.x) - (opts.rw || 120) }); }
  else vText(g, main, x0, y + h / 2 + 8, opts.size || 25, { w: 800, max: B.w - (x0 - B.x) - (opts.rw || 120) });
  if (right) vText(g, right, B.x + B.w - 14, y + h / 2 + 8, opts.rsize || 23, { w: 800, mono: true, al: 'right', col: opts.rcol || '#fff' });
}
function vTrack(g, x, y, w, h, prog) {   // tracé du circuit (dessiné progressivement)
  const p = T.circ.pts; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  const sc = Math.min(w / (x1 - x0), h / (y1 - y0)), ox = x + w / 2 - (x1 - x0) * sc / 2, oy = y + h / 2 - (y1 - y0) * sc / 2;
  const n = Math.max(2, Math.floor(p.length / 2 * Math.min(1, prog)));
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 12; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i < p.length; i += 2) { const X = ox + (p[i] - x0) * sc, Y = oy + (y1 - p[i + 1]) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  g.closePath(); g.stroke();
  g.strokeStyle = '#e10600'; g.lineWidth = 6; g.beginPath();
  for (let i = 0; i < n * 2; i += 2) { const X = ox + (p[i] - x0) * sc, Y = oy + (y1 - p[i + 1]) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  if (prog >= 1) g.closePath();
  g.stroke();
}
const WX_VID = { dry: ['☀', 'Sec', 'Dry'], light: ['🌦', 'Pluie légère', 'Light rain'], heavy: ['🌧', 'Pluie forte', 'Heavy rain'], mixed: ['⛅', 'Averses possibles', 'Possible showers'] };
const AREA_EN = { ligne_droite: 'straight-line speed', virage: 'cornering', pneus: 'tyre management' };

/* ---- 1. présentation du Grand Prix : évolutions, hiérarchie, classements ---- */
function vidPreviewSegs(S, circ, rd) {
  const segs = [], round = S.round + 1, n = S.rounds.length, year = S.year || 2026;
  const { sortD, sortT } = standings(), started = S.round > 0 && sortD.some(d => d.pts > 0);
  const ups = (rd.upgrades || []).slice().sort((a, b) => (b.fail ? -1 : b.delta) - (a.fail ? -1 : a.delta));
  const teams = champTeams(), tByName = Object.fromEntries(teams.map(t => [t.name, t]));
  const col = name => { const t = tByName[name]; return t ? t.tv || t.color : '#888'; };
  // titre
  const WX_SAY = { dry: ['Ciel dégagé annoncé.', 'Dry weather expected.'], light: ['Un peu de pluie est attendue.', 'Some light rain is expected.'], heavy: ['Attention, forte pluie annoncée !', 'Heavy rain is forecast!'], mixed: ['Des averses sont possibles.', 'Showers are possible.'] }[rd.weather] || ['', ''];
  segs.push({ dur: 7, cam: 'fly', dim: 0.3, must: true, say: () => L(`Manche ${round} du championnat ${year} : ${tr(circ.name)} ! ${lapsFor(circ)} tours au programme${circ.street ? ', sur un circuit urbain' : ''}. ${WX_SAY[0]}`, `Round ${round} of the ${year} championship: we're off to ${tr(circ.name)}! ${lapsFor(circ)} laps${circ.street ? ' on a street circuit' : ''}. ${WX_SAY[1]}`), draw(g, B, lt) {
    const wx = WX_VID[rd.weather] || WX_VID.dry;
    vText(g, L(`MANCHE ${round}/${n} · SAISON ${year}`, `ROUND ${round}/${n} · ${year} SEASON`), B.x, B.y + 150, 26, { w: 900, col: '#e10600' });
    vText(g, tr(circ.name).toUpperCase(), B.x, B.y + 228, 76, { w: 900, max: B.w });
    vText(g, `${circ.flag} ${tr(circ.sub)}`, B.x, B.y + 274, 28, { w: 700, col: 'rgba(255,255,255,.85)', max: B.w });
    vText(g, `${lapsFor(circ)} ${L('tours', 'laps')} · ${(circ.length / 1000).toFixed(3).replace('.', L(',', '.'))} km${circ.street ? L(' · circuit urbain', ' · street circuit') : ''}`, B.x, B.y + 312, 24, { w: 700, col: 'rgba(255,255,255,.75)', max: B.w });
    hlBox(g, B.x, B.y + 340, 280, 50, 'rgba(10,12,16,.8)', 25);
    vText(g, `${wx[0]}  ${L(wx[1], wx[2])}`, B.x + 22, B.y + 374, 24, { w: 800 });
    vTrack(g, B.x + 10, B.y + 430, B.w - 20, B.h - 470, lt / 3);
  } });
  // évolutions techniques
  if (ups.length) {
    const pages = Math.ceil(ups.length / 7), per = Math.ceil(ups.length / pages);
    for (let p = 0; p < pages; p++) {
      const list = ups.slice(p * per, p * per + per);
      const best = ups.find(u => !u.fail && SEC_PT[u.area]), fail = ups.find(u => u.fail), bs = best ? best.delta * SEC_PT[best.area] : 0;
      segs.push({ dur: pages > 1 ? 8 : 12, cam: 'fly', say: p ? null : () => L(`${ups.length} écurie${ups.length > 1 ? 's arrivent' : ' arrive'} avec des évolutions.${best ? ` La plus efficace pour ${best.team} : ${tr(best.part)}, ${Math.round(bs * 100)} centièmes au tour.` : ''}${fail ? ` En revanche, ça ne fonctionne pas pour ${fail.team}.` : ''}`, `${ups.length} team${ups.length > 1 ? 's bring' : ' brings'} upgrades.${best ? ` The best one for ${best.team}: ${tr(best.part)}, worth ${bs.toFixed(2)} seconds a lap.` : ''}${fail ? ` But it doesn't work for ${fail.team}.` : ''}`), draw(g, B, lt) {
        let y = vHead(g, B, L('Nouveautés du week-end', 'New this weekend') + (pages > 1 ? ` · ${p + 1}/${pages}` : ''), L('ÉVOLUTIONS', 'UPGRADES'));
        list.forEach((u, i) => {
          g.globalAlpha = vReveal(lt, i, list.length, 2.2);
          const sec = SEC_PT[u.area] ? u.delta * SEC_PT[u.area] : null;
          const right = u.fail ? L('RATÉE', 'FAILED') : sec != null ? `−${sec.toFixed(2).replace('.', L(',', '.'))} s` : `▲ ${u.delta.toFixed(1)}`;
          const area = L(DEV_AREAS[u.area] ? DEV_AREAS[u.area].label : u.area, AREA_EN[u.area] || u.area);
          vRow(g, B, y, 92, null, col(u.team), u.team, `${tr(u.part)} · ${area}${u.big ? L(' · gros package', ' · big package') : ''}`, right, { rcol: u.fail ? '#ff6b66' : '#39ff88', rw: 130, size: 26 });
          y += 98;
        });
        g.globalAlpha = 1;
        if (lt > 1.6) vText(g, L('secondes gagnées au tour', 'seconds gained per lap'), B.x, B.y + B.h - 8, 18, { w: 600, col: 'rgba(255,255,255,.6)' });
      } });
    }
  } else segs.push({ dur: 5, cam: 'fly', say: () => L('Pas d\'évolution ce week-end : les écuries arrivent avec les mêmes voitures.', 'No upgrades this weekend: the teams bring the same cars.'), draw(g, B) {
    const y = vHead(g, B, L('Nouveautés du week-end', 'New this weekend'), L('ÉVOLUTIONS', 'UPGRADES'));
    vText(g, L('Aucune évolution ce week-end :', 'No upgrade this weekend:'), B.x, y + 40, 30, { w: 800 });
    vText(g, L('les écuries arrivent avec les mêmes voitures.', 'teams bring the same cars.'), B.x, y + 80, 26, { w: 600, col: 'rgba(255,255,255,.8)', max: B.w });
  } });
  // hiérarchie (performance des voitures)
  const perf = teams.map(t => ({ name: t.name, color: t.tv || t.color, r: perfRating(t), up: ups.find(u => u.team === t.name) })).sort((a, b) => b.r - a.r);
  segs.push({ dur: 9, cam: 'fly', say: () => L(`Sur le papier, ${perf[0].name} a la voiture la plus rapide, devant ${perf[1].name} et ${perf[2].name}. ${perf[perf.length - 1].name} ferme la marche.`, `On paper, ${perf[0].name} has the fastest car, ahead of ${perf[1].name} and ${perf[2].name}. ${perf[perf.length - 1].name} bring up the rear.`), draw(g, B, lt) {
    let y = vHead(g, B, L('Avant les qualifications', 'Before qualifying'), L('HIÉRARCHIE', 'PECKING ORDER'));
    const top = perf[0].r, bot = perf[perf.length - 1].r, rh = Math.min(64, (B.y + B.h - y - 10) / perf.length);
    perf.forEach((t, i) => {
      const r = vReveal(lt, i, perf.length, 2.5); g.globalAlpha = r;
      const yy = y + i * rh, wbar = (B.w - 150) * (0.25 + 0.75 * (t.r - bot) / Math.max(0.01, top - bot)) * r;
      hlBox(g, B.x, yy, B.w, rh - 8, 'rgba(10,12,16,.72)', 6);
      g.fillStyle = t.color; g.globalAlpha = r * 0.9; g.fillRect(B.x, yy, wbar, rh - 8); g.globalAlpha = r;
      g.save(); g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 4; vText(g, `${i + 1}. ${t.name}`, B.x + 12, yy + rh / 2 + 4, 22, { w: 800, max: B.w - 160 }); g.restore();
      vText(g, i ? `+${((top - t.r) * 0.11).toFixed(2).replace('.', L(',', '.'))} s` : L('réf.', 'ref.'), B.x + B.w - 12, yy + rh / 2 + 4, 20, { w: 800, mono: true, al: 'right' });
    });
    g.globalAlpha = 1;
  } });
  // classement des pilotes (ou les engagés à la 1re manche)
  if (started) {
    for (const [a, b, part] of [[0, 11, 1], [11, 22, 2]]) {
      const list = sortD.slice(a, b); if (!list.length) continue;
      const d1 = sortD[0], d2 = sortD[1], dl = list[0];
      segs.push({ dur: 8, cam: 'fly', say: () => part === 1 ? L(`Au championnat, ${d1.name} mène avec ${d1.pts} points, ${d1.pts > d2.pts ? `${d1.pts - d2.pts} de plus que ${d2.name}` : `à égalité avec ${d2.name}`}.`, `In the championship, ${d1.name} leads on ${d1.pts} points, ${d1.pts > d2.pts ? `${d1.pts - d2.pts} clear of ${d2.name}` : `level with ${d2.name}`}.`)
        : dl.pts > 0 ? L(`${dl.name} ouvre la deuxième moitié du classement, avec ${dl.pts} point${dl.pts > 1 ? 's' : ''}.`, `${dl.name} heads the second half of the table on ${dl.pts} point${dl.pts !== 1 ? 's' : ''}.`) : L(`Plus loin, ${dl.name} et les autres attendent encore leurs premiers points.`, `Further back, ${dl.name} and the rest are still waiting for their first points.`), draw(g, B, lt) {
        let y = vHead(g, B, L(`Avant la manche ${round}`, `Before round ${round}`) + ` · ${part}/2`, L('CLASSEMENT PILOTES', 'DRIVERS’ STANDINGS'));
        const rh = Math.min(66, (B.y + B.h - y - 6) / list.length), lead = sortD[0].pts;
        list.forEach((d, i) => { g.globalAlpha = vReveal(lt, i, list.length, 2.4); vRow(g, B, y + i * rh, rh, a + i + 1, d.color, d.name, d.team, `${d.pts}`, { rw: 110, size: 24 }); if (a + i > 0 && lt > 3) vText(g, `−${lead - d.pts}`, B.x + B.w - 84, y + i * rh + rh / 2 + 5, 15, { w: 700, mono: true, al: 'right', col: 'rgba(255,255,255,.5)' }); });
        g.globalAlpha = 1;
      } });
    }
  } else {
    segs.push({ dur: 14, cam: 'fly', say: () => L(`${teams.length} écuries et ${teams.length * 2} pilotes au départ de cette saison ${year}. Voici le plateau.`, `${teams.length} teams and ${teams.length * 2} drivers on the ${year} grid. Here's the entry list.`), draw(g, B, lt) {
      let y = vHead(g, B, L('Saison ' + year, year + ' season'), L('LES ENGAGÉS', 'THE ENTRY LIST'));
      const rh = Math.min(70, (B.y + B.h - y - 6) / teams.length);
      teams.forEach((t, i) => { g.globalAlpha = vReveal(lt, i, teams.length, 4); vRow(g, B, y + i * rh, rh, null, t.tv || t.color, t.name, t.drivers.map(d => `${d.name} #${d.num}`).join(' · '), '', { rw: 10, size: 24 }); });
      g.globalAlpha = 1;
    } });
  }
  // classement des constructeurs
  if (started) segs.push({ dur: 9, cam: 'fly', say: () => L(`Chez les écuries, ${sortT[0].name} est en tête avec ${sortT[0].pts} points, devant ${sortT[1].name}.`, `In the teams' standings, ${sortT[0].name} lead on ${sortT[0].pts} points, ahead of ${sortT[1].name}.`), draw(g, B, lt) {
    let y = vHead(g, B, L(`Avant la manche ${round}`, `Before round ${round}`), L('CLASSEMENT ÉCURIES', 'TEAMS’ STANDINGS'));
    const rh = Math.min(66, (B.y + B.h - y - 6) / sortT.length);
    sortT.forEach((t, i) => { g.globalAlpha = vReveal(lt, i, sortT.length, 2.4); vRow(g, B, y + i * rh, rh, i + 1, t.color, t.name, '', `${t.pts}`, { rw: 110, size: 24 }); });
    g.globalAlpha = 1;
  } });
  // fin
  segs.push({ dur: 5, cam: 'fly', dim: 0.5, say: () => L('Prochaine étape : les qualifications. Abonne-toi pour ne rien manquer !', 'Next up: qualifying. Follow so you don\'t miss a thing!'), draw(g, B) {
    vText(g, L('PROCHAINE ÉTAPE', 'NEXT UP'), B.x + B.w / 2, B.y + B.h * 0.36, 26, { w: 900, col: '#e10600', al: 'center' });
    vText(g, L('QUALIFICATIONS', 'QUALIFYING'), B.x + B.w / 2, B.y + B.h * 0.36 + 70, 62, { w: 900, al: 'center', max: B.w });
    vText(g, `${circ.flag} ${tr(circ.name)}`, B.x + B.w / 2, B.y + B.h * 0.36 + 120, 30, { w: 700, al: 'center', col: 'rgba(255,255,255,.85)', max: B.w });
    vText(g, tr('Abonne-toi pour le prochain Grand Prix'), B.x + B.w / 2, B.y + B.h - 30, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.7)', max: B.w });
  } });
  return vFit(segs, 60);
}
/* ---- 3. présentation de la saison : saison passée, calendrier, écuries une par une, hiérarchie ---- */
function vidSeasonSegs(S, teams, circ) {
  const segs = [], k = career(), year = S.year || k.year, n = S.rounds.length, nt = teams.length;
  const last = k.history.length ? k.history[k.history.length - 1] : null;
  const colOf = name => { const t = teams.find(x => x.name === name); return t ? t.tv || t.color : '#888'; };
  const num = (x, d) => x.toFixed(d).replace('.', L(',', '.'));
  // titre
  const nd = teams.reduce((a, t) => a + t.drivers.length, 0), c0 = CIRCUITS.find(x => x.id === S.rounds[0].id), cN = CIRCUITS.find(x => x.id === S.rounds[n - 1].id);
  segs.push({ dur: 6, cam: 'fly', dim: 0.3, must: true, say: () => L(`Bienvenue dans la saison ${year} ! ${n} Grands Prix, ${nt} écuries et ${nd} pilotes au départ.`, `Welcome to the ${year} season! ${n} Grands Prix, ${nt} teams and ${nd} drivers.`), draw(g, B, lt) {
    vText(g, L('PRÉSENTATION', 'SEASON PREVIEW'), B.x, B.y + 150, 26, { w: 900, col: '#e10600' });
    vText(g, L('SAISON', 'SEASON'), B.x, B.y + 230, 64, { w: 900 });
    vText(g, String(year), B.x, B.y + 370, 150, { w: 900, mono: true });
    g.fillStyle = '#e10600'; g.fillRect(B.x, B.y + 396, 90, 6);
    vText(g, k.name, B.x, B.y + 450, 30, { w: 800, max: B.w });
    const facts = [[n, L('Grands Prix', 'Grands Prix')], [nt, L('écuries', 'teams')], [teams.reduce((a, t) => a + t.drivers.length, 0), L('pilotes', 'drivers')]];
    facts.forEach(([v, l], i) => { g.globalAlpha = Math.max(0, Math.min(1, (lt - 0.8 - i * 0.4) / 0.3));
      const w = (B.w - 24) / 3, x = B.x + i * (w + 12);
      hlBox(g, x, B.y + B.h - 170, w, 130, 'rgba(10,12,16,.8)', 12);
      vText(g, String(v), x + w / 2, B.y + B.h - 92, 58, { w: 900, mono: true, al: 'center' });
      vText(g, l.toUpperCase(), x + w / 2, B.y + B.h - 60, 18, { w: 800, al: 'center', col: 'rgba(255,255,255,.7)' }); });
    g.globalAlpha = 1;
  } });
  // la saison passée
  if (last) segs.push({ dur: 8, cam: 'fly', say: () => L(`L'an dernier, ${last.d[0].name} a été sacré champion avec ${last.d[0].pts} points, et ${last.t[0].name} a remporté le titre des écuries.`, `Last year, ${last.d[0].name} was crowned champion with ${last.d[0].pts} points, and ${last.t[0].name} took the teams' title.`), draw(g, B, lt) {
    let y = vHead(g, B, L(`Saison ${last.year}`, `${last.year} season`), L('LES TENANTS DU TITRE', 'THE CHAMPIONS'));
    const c = last.d[0];
    hlBox(g, B.x, y, B.w, 230, 'rgba(8,10,14,.86)', 14); g.fillStyle = colOf(c.team); g.fillRect(B.x, y, 10, 230);
    vText(g, L('🏆 CHAMPION PILOTES', '🏆 DRIVERS’ CHAMPION'), B.x + 30, y + 44, 22, { w: 900, col: '#ffcc33' });
    vText(g, c.name.toUpperCase(), B.x + 30, y + 104, 50, { w: 900, max: B.w - 60 });
    vText(g, c.team, B.x + 30, y + 142, 24, { w: 700, col: 'rgba(255,255,255,.8)', max: B.w - 60 });
    vText(g, `${c.pts} pts · ${c.wins} ${L('victoires', 'wins')} · ${c.poles || 0} pole${(c.poles || 0) > 1 ? 's' : ''}`, B.x + 30, y + 196, 26, { w: 800, mono: true });
    y += 250;
    const ct = last.t[0];
    g.globalAlpha = Math.max(0, Math.min(1, (lt - 1.2) / 0.3));
    hlBox(g, B.x, y, B.w, 130, 'rgba(8,10,14,.86)', 14); g.fillStyle = colOf(ct.name); g.fillRect(B.x, y, 10, 130);
    vText(g, L('🏆 CHAMPION ÉCURIES', '🏆 TEAMS’ CHAMPION'), B.x + 30, y + 40, 22, { w: 900, col: '#ffcc33' });
    vText(g, ct.name, B.x + 30, y + 88, 36, { w: 900, max: B.w - 200 });
    vText(g, `${ct.pts} pts`, B.x + B.w - 20, y + 88, 28, { w: 800, mono: true, al: 'right' });
    y += 156;
    vText(g, L('LE PODIUM', 'THE TOP 3'), B.x, y, 20, { w: 900, col: '#e10600' }); y += 14;
    last.d.slice(0, 3).forEach((d, i) => { g.globalAlpha = vReveal(lt, i, 3, 1.5) * Math.min(1, Math.max(0, (lt - 2) / 0.3)); vRow(g, B, y + i * 70, 70, i + 1, colOf(d.team), d.name, d.team, `${d.pts}`, { rw: 100, size: 24 }); });
    g.globalAlpha = 1;
  } });
  // calendrier (deux colonnes)
  segs.push({ dur: 10, cam: 'fly', say: () => L(`Le calendrier : ${n} manches. Premier rendez-vous : ${tr(c0.name)}. Dernière étape : ${tr(cN.name)}.`, `The calendar: ${n} rounds. First stop: ${tr(c0.name)}. The finale: ${tr(cN.name)}.`), draw(g, B, lt) {
    const y = vHead(g, B, L(`Saison ${year}`, `${year} season`), L('LE CALENDRIER', 'THE CALENDAR'));
    const half = Math.ceil(n / 2), rh = Math.min(64, (B.y + B.h - y) / half), cw = (B.w - 10) / 2;
    S.rounds.forEach((rd, i) => {
      const c = CIRCUITS.find(x => x.id === rd.id); if (!c) return;
      const col = Math.floor(i / half), row = i % half, x = B.x + col * (cw + 10), yy = y + row * rh;
      g.globalAlpha = vReveal(lt, i, n, 5);
      hlBox(g, x, yy, cw, rh - 6, i === 0 ? 'rgba(225,6,0,.45)' : 'rgba(10,12,16,.78)', 6);
      vText(g, String(i + 1), x + 34, yy + rh / 2 + 4, 18, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.65)' });
      vText(g, `${c.flag} ${tr(c.name)}`, x + 44, yy + rh / 2 + 4, 20, { w: 800, max: cw - 52 });
    });
    g.globalAlpha = 1;
  } });
  // les écuries une par une, de la moins rapide à la plus rapide (caméra sur leurs deux voitures)
  const top = perfRating(teams[0]), lastT = last ? Object.fromEntries(last.t.map(t => [t.name, t.pos])) : {}, lastD = last ? Object.fromEntries(last.d.map(d => [d.name, d.pos])) : {};
  for (let i = nt - 1; i >= 0; i--) {
    const t = teams[i], tc = t.tv || t.color, rank = i + 1;
    const dn = t.drivers.map(d => d.name), dsay = dn.length > 1 ? L(`${dn[0]} et ${dn[1]}`, `${dn[0]} and ${dn[1]}`) : dn[0] || '';
    const say = () => i === nt - 1 ? L(`On commence par ${t.name}, avec ${dsay}.`, `We start with ${t.name}: ${dsay}.`) : i === 0 ? L(`Et la voiture de référence : ${t.name}, avec ${dsay} !`, `And the benchmark: ${t.name}, with ${dsay}!`)
      : V([`${t.name}, avec ${dsay}.`, `${t.name}, with ${dsay}.`], [`${t.name} : ${dsay}.`, `${t.name}: ${dsay}.`]);
    segs.push({ dur: 3.8, cam: 'car', look: 10, say, sayAt: 0.25, must: i === 0, focus: i * 2, focus2: t.drivers.length > 1 ? i * 2 + 1 : null, dim: 0.12, draw(g, B, lt) {
      const h = 470, y = B.y + B.h - h;
      hlBox(g, B.x, B.y + 70, 150, 40, '#e10600', 8);
      vText(g, L(`FORCE N°${rank}`, `POWER RANK ${rank}`), B.x + 75, B.y + 98, 19, { w: 900, al: 'center' });
      hlBox(g, B.x, y, B.w, h, 'rgba(8,10,14,.88)', 14);
      g.fillStyle = tc; g.fillRect(B.x, y, 10, h); g.fillStyle = t.color2 || tc; g.fillRect(B.x + 10, y, 5, h);
      vText(g, t.name.toUpperCase(), B.x + 34, y + 58, 40, { w: 900, max: B.w - 60 });
      const sub = [t.engine ? L(`Moteur ${t.engine}`, `${t.engine} power`) : '', last && lastT[t.name] ? L(`${last.year} : P${lastT[t.name]} au championnat`, `${last.year}: P${lastT[t.name]} in the standings`) : ''].filter(Boolean).join(' · ');
      if (sub) vText(g, sub, B.x + 34, y + 92, 19, { w: 700, col: 'rgba(255,255,255,.7)', max: B.w - 60 });
      // la voiture : trois jauges + écart au tour sur la meilleure
      const stats = [[L('Vitesse', 'Speed'), +t.ligne_droite], [L('Virages', 'Corners'), +t.virage], [L('Pneus', 'Tyres'), +t.pneus]], bw = (B.w - 68 - 24) / 3;
      stats.forEach(([l, v], j) => { const x = B.x + 34 + j * (bw + 12), a = Math.max(0, Math.min(1, (lt - 0.3 - j * 0.15) / 0.5));
        vText(g, l.toUpperCase(), x, y + 132, 15, { w: 800, col: 'rgba(255,255,255,.6)' });
        vText(g, String(Math.round(v)), x + bw, y + 132, 17, { w: 800, mono: true, al: 'right' });
        g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y + 142, bw, 8);
        g.fillStyle = tc; g.fillRect(x, y + 142, bw * clamp((v - 40) / 52, 0.05, 1) * a, 8); });
      vText(g, rank === 1 ? L('La voiture de référence', 'The benchmark car') : L(`+${num((top - perfRating(t)) * 0.11, 2)} s au tour sur la meilleure`, `+${num((top - perfRating(t)) * 0.11, 2)} s per lap off the best`), B.x + 34, y + 182, 18, { w: 700, col: rank === 1 ? '#39ff88' : 'rgba(255,255,255,.75)', max: B.w - 60 });
      // les pilotes
      t.drivers.slice(0, 2).forEach((d, j) => {
        const yy = y + 206 + j * 128; g.globalAlpha = Math.max(0, Math.min(1, (lt - 0.5 - j * 0.35) / 0.3));
        hlBox(g, B.x + 24, yy, B.w - 48, 116, 'rgba(255,255,255,.06)', 10);
        vText(g, String(d.num ?? ''), B.x + 44, yy + 78, 56, { w: 900, mono: true, col: tc });
        vText(g, `${d.nat || ''} ${d.name}`.trim(), B.x + 150, yy + 52, 30, { w: 900, max: B.w - 320 });
        const ds = last && lastD[d.name] ? L(`${last.year} : P${lastD[d.name]}`, `${last.year}: P${lastD[d.name]}`) : last ? L('Nouveau venu', 'Newcomer') : '';
        if (ds) vText(g, ds, B.x + 150, yy + 86, 18, { w: 700, col: 'rgba(255,255,255,.7)', max: B.w - 320 });
        vText(g, L('NOTE', 'RATING'), B.x + B.w - 44, yy + 40, 14, { w: 800, al: 'right', col: 'rgba(255,255,255,.6)' });
        vText(g, String(Math.round(+d.skill)), B.x + B.w - 44, yy + 86, 42, { w: 900, mono: true, al: 'right' });
      });
      g.globalAlpha = 1;
    } });
  }
  // récapitulatif : la hiérarchie
  segs.push({ dur: 7, cam: 'gridwide', dim: 0.5, say: () => L(`Sur le papier, ${teams[0].name} part favori, devant ${teams[1].name} et ${teams[2].name}.`, `On paper, ${teams[0].name} start as favourites, ahead of ${teams[1].name} and ${teams[2].name}.`), draw(g, B, lt) {
    let y = vHead(g, B, L('Avant la première course', 'Before the first race'), L('HIÉRARCHIE', 'PECKING ORDER'));
    const bot = perfRating(teams[nt - 1]), rh = Math.min(64, (B.y + B.h - y - 10) / nt);
    teams.forEach((t, i) => {
      const r = vReveal(lt, i, nt, 2.5), yy = y + i * rh, pr = perfRating(t), wbar = (B.w - 150) * (0.25 + 0.75 * (pr - bot) / Math.max(0.01, top - bot)) * r;
      g.globalAlpha = r; hlBox(g, B.x, yy, B.w, rh - 8, 'rgba(10,12,16,.72)', 6);
      g.fillStyle = t.tv || t.color; g.globalAlpha = r * 0.9; g.fillRect(B.x, yy, wbar, rh - 8); g.globalAlpha = r;
      g.save(); g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 4; vText(g, `${i + 1}. ${t.name}`, B.x + 12, yy + rh / 2 + 4, 22, { w: 800, max: B.w - 160 }); g.restore();
      vText(g, i ? `+${num((top - pr) * 0.11, 2)} s` : L('réf.', 'ref.'), B.x + B.w - 12, yy + rh / 2 + 4, 20, { w: 800, mono: true, al: 'right' });
    });
    g.globalAlpha = 1;
  } });
  // fin
  segs.push({ dur: 5, cam: 'fly', dim: 0.5, say: () => L(`Premier rendez-vous : ${tr(circ.name)}. Abonne-toi pour suivre toute la saison !`, `First stop: ${tr(circ.name)}. Follow to watch the whole season!`), draw(g, B) {
    vText(g, L('PREMIÈRE MANCHE', 'ROUND 1'), B.x + B.w / 2, B.y + B.h * 0.36, 26, { w: 900, col: '#e10600', al: 'center' });
    vText(g, tr(circ.name).toUpperCase(), B.x + B.w / 2, B.y + B.h * 0.36 + 70, 62, { w: 900, al: 'center', max: B.w });
    vText(g, `${circ.flag} ${tr(circ.sub)}`, B.x + B.w / 2, B.y + B.h * 0.36 + 120, 28, { w: 700, al: 'center', col: 'rgba(255,255,255,.85)', max: B.w });
    vText(g, L('Abonne-toi pour suivre toute la saison', 'Follow to watch the whole season'), B.x + B.w / 2, B.y + B.h - 30, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.7)', max: B.w });
  } });
  return vFit(segs, last ? 75 : 68);
}
/* ---- 4. résumé de la saison (une fois la saison terminée) ----
   accroche tirée de la saison réelle, la saison en chiffres, les moments marquants (prises de pouvoir, abandons du leader,
   remontées, premières victoires, séries), la course au titre animée, les classements finaux et le champion */
/* « en Chine », « au Japon », « aux Pays-Bas », « à Monaco » */
const PLACE_AU = new Set(['Japon', 'Canada', 'Mexique', 'Brésil', 'Qatar']), PLACE_AUX = new Set(['Pays-Bas', 'États-Unis']);
const PLACE_EN = new Set(['Australie', 'Chine', 'Arabie Saoudite', 'Autriche', 'Grande-Bretagne', 'Belgique', 'Hongrie', 'Italie', 'Espagne', 'Azerbaïdjan', 'Malaisie', 'Turquie', 'France', 'Allemagne', 'Toscane', 'Russie', 'Argentine', 'Afrique du Sud']);
const inPlace = c => PLACE_AU.has(c.name) ? 'au ' + c.name : PLACE_AUX.has(c.name) ? 'aux ' + c.name : PLACE_EN.has(c.name) ? 'en ' + c.name : c.name === 'Eifel' ? 'dans l’Eifel' : 'à ' + c.name;
function recapFacts(S) {
  const n = S.rounds.filter(rd => rd.result).length, { sortD, sortT } = standings(), { items, hist } = ptsHistory('d', S);
  const names = items.map(x => x.name), wins = [Object.fromEntries(names.map(x => [x, 0]))];
  S.rounds.slice(0, n).forEach(rd => { const w = Object.assign({}, wins[wins.length - 1]); if (rd.result[0]) w[rd.result[0].name]++; wins.push(w); });
  const leaderAt = i => names.slice().sort((a, b) => hist[i][b] - hist[i][a] || wins[i][b] - wins[i][a])[0];
  const champ = sortD[0].name, me = myDriver();
  let decided = n;
  for (let i = 1; i <= n; i++) { if (leaderAt(i) !== champ) continue; const h = hist[i], second = Math.max(...names.filter(x => x !== champ).map(x => h[x])); if (h[champ] - second > (n - i) * POINTS[0]) { decided = i; break; } }
  let changes = 0; for (let i = 2; i <= n; i++) if (leaderAt(i) !== leaderAt(i - 1)) changes++;
  const winners = new Set(S.rounds.slice(0, n).map(rd => rd.result[0] && rd.result[0].name).filter(Boolean));
  // moments marquants (un par manche au plus, les plus forts, remis dans l'ordre)
  const M = [], seen = new Set(), say = (fr, en) => L(fr, en);
  let st = { who: null, k: 0, end: -1 };
  const streak = () => { if (st.k >= 3) M.push({ i: st.end, kind: 'streak', who: st.who, score: 50 + st.k * 6, title: say(`${st.k} VICTOIRES DE SUITE`, `${st.k} WINS IN A ROW`), sub: st.who, text: say(`${st.who} enchaîne ${st.k} victoires d'affilée !`, `${st.who} strings together ${st.k} wins in a row!`) }); };
  for (let i = 0; i < n; i++) {
    const rd = S.rounds[i], res = rd.result, w = res[0]; if (!w) continue;
    const c = CIRCUITS.find(x => x.id === rd.id), gp = tr(c.name), ip = inPlace(c), Ip = ip[0].toUpperCase() + ip.slice(1), lb = i ? leaderAt(i) : null, la = leaderAt(i + 1);
    if (i === 0) M.push({ i, who: w.name, score: 45, title: say('PREMIÈRE MANCHE', 'ROUND ONE'), sub: say(`Victoire de ${w.name}`, `${w.name} wins`), text: say(`Premier Grand Prix, ${ip} : ${w.name} ouvre le bal avec la victoire !`, `First Grand Prix, in ${gp}: ${w.name} opens the season with a win!`) });
    if (w.name === me && !seen.has('mywin')) { seen.add('mywin'); M.push({ i, who: me, score: 95, title: say('TA PREMIÈRE VICTOIRE', 'YOUR FIRST WIN'), sub: `${gp}`, text: say(`${Ip}, ta première victoire de la saison !`, `In ${gp}, your first win of the season!`) }); }
    if (lb && la !== lb) M.push({ i, kind: 'lead', who: la, score: la === champ ? 82 : 70, title: V(['NOUVEAU LEADER', 'NEW LEADER'], ['EN TÊTE DU CHAMPIONNAT', 'CHAMPIONSHIP LEADER']), sub: say(`${la} passe devant ${lb}`, `${la} moves ahead of ${lb}`),
      text: V([`${Ip}, ${la} prend la tête du championnat !`, `In ${gp}, ${la} takes the championship lead!`], [`Changement de leader ${ip} : ${la} passe devant ${lb} !`, `A new leader in ${gp}: ${la} moves ahead of ${lb}!`], [`${Ip}, ${la} s'empare de la première place du championnat !`, `In ${gp}, ${la} grabs top spot in the standings!`]) });
    const lr = lb && res.find(r => r.name === lb);
    if (lr && lr.dnf) M.push({ i, kind: 'ldnf', who: lb, score: 76, title: say('ABANDON DU LEADER', 'LEADER OUT'), sub: lr.why ? `${lb} · ${lr.why}` : lb, text: say(`Coup dur ${ip} : le leader ${lb} abandonne !`, `Disaster in ${gp}: leader ${lb} retires!`) });
    if (w.grid >= 6) M.push({ i, kind: 'comeback', who: w.name, score: 52 + w.grid * 2, title: say(`VICTOIRE DEPUIS LA P${w.grid}`, `WIN FROM P${w.grid}`), sub: `${w.name} · ${gp}`, text: say(`${Ip}, ${w.name} gagne en partant ${w.grid}e sur la grille !`, `In ${gp}, ${w.name} wins from ${w.grid}th on the grid!`) });
    if (i > 0 && !seen.has('w' + w.name)) M.push({ i, kind: 'first', who: w.name, score: 40 + (w.name !== champ ? 8 : 0), title: say('PREMIÈRE VICTOIRE', 'FIRST WIN'), sub: `${w.name} · ${gp}`, text: say(`${w.name} décroche sa première victoire de la saison ${ip} !`, `${w.name} takes a first win of the season in ${gp}!`) });
    seen.add('w' + w.name);
    if (rd.wet ?? rd.weather !== 'dry') M.push({ i, kind: 'rain', who: w.name, score: 42, title: say('SOUS LA PLUIE', 'IN THE RAIN'), sub: `${w.name} · ${gp}`, text: say(`Sous la pluie ${ip}, c'est ${w.name} qui s'impose !`, `In the rain in ${gp}, ${w.name} takes the win!`) });
    if (w.name === st.who) { st.k++; st.end = i; } else { streak(); st = { who: w.name, k: 1, end: i }; }
  }
  streak();
  // un moment par manche au plus, deux du même genre au plus (pas quatre « nouveau leader » d'affilée)
  const best = new Map(), nk = {};
  for (const m of M.sort((a, b) => b.score - a.score)) {
    if (best.has(m.i) || (m.kind && (nk[m.kind] || 0) >= 2) || best.size >= 6) continue;
    best.set(m.i, m); if (m.kind) nk[m.kind] = (nk[m.kind] || 0) + 1;
  }
  const moments = [...best.values()].sort((a, b) => a.i - b.i);
  return { n, sortD, sortT, hist, items, leaderAt, champ, me, decided, changes, winners, moments,
    margin: sortD[0].pts - sortD[1].pts, dnfs: S.rounds.slice(0, n).reduce((a, rd) => a + rd.result.filter(r => r.dnf).length, 0),
    scs: S.rounds.slice(0, n).some(rd => rd.sc != null) ? S.rounds.slice(0, n).reduce((a, rd) => a + (rd.sc || 0), 0) : null,
    wet: S.rounds.slice(0, n).filter(rd => rd.wet ?? rd.weather !== 'dry').length };
}
/* texte sur plusieurs lignes (retour à la ligne aux espaces) ; renvoie le y de la ligne suivante */
function vWrap(g, txt, x, y, size, maxW, opts) {
  opts = opts || {}; g.font = `${opts.w || 900} ${size}px ${HF.t}`;
  const words = String(txt).split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && g.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const lh = opts.lh || size * 1.08;
  lines.forEach((l, k) => vText(g, l, x, y + k * lh, size, Object.assign({}, opts, { max: maxW })));
  return y + lines.length * lh;
}
function vidRecapSegs(S, order) {
  const F = recapFacts(S), segs = [], year = S.year || career().year, n = F.n, c0 = F.sortD[0], c1 = F.sortD[1];
  const base = careerBase(), colT = name => { const t = base.find(x => x.name === name); return t ? t.tv || t.color : '#888'; };
  const colD = name => colT((F.sortD.find(d => d.name === name) || {}).team);
  const carOf = name => { const i = order.indexOf(name); return i >= 0 ? i : null; };
  const lastRd = S.rounds[n - 1], lastC = CIRCUITS.find(x => x.id === lastRd.id);
  // 1. accroche : ce que cette saison a eu de plus fort
  let hook, hookSay;
  if (n > 1 && F.decided === n && F.margin <= POINTS[0]) { hook = L('TITRE JOUÉ À LA DERNIÈRE COURSE', 'TITLE DECIDED IN THE FINAL RACE'); hookSay = L(`Saison ${year} : le titre s'est joué à la toute dernière course !`, `The ${year} season: the title went down to the very last race!`); }
  else if (F.changes >= 3) { hook = L(`${F.changes} CHANGEMENTS DE LEADER`, `${F.changes} LEAD CHANGES`); hookSay = L(`Saison ${year} : la tête du championnat a changé ${F.changes} fois !`, `The ${year} season: the championship lead changed hands ${F.changes} times!`); }
  else if (c0.wins >= n / 2 && n >= 4) { hook = L(`${c0.wins} VICTOIRES SUR ${n}`, `${c0.wins} WINS OUT OF ${n}`); hookSay = L(`Saison ${year} : ${c0.wins} victoires sur ${n}, une domination totale !`, `The ${year} season: ${c0.wins} wins out of ${n}, total domination!`); }
  else if (F.margin <= 10) { hook = L(`${F.margin} POINT${F.margin > 1 ? 'S' : ''} D'ÉCART`, `${F.margin} POINT${F.margin > 1 ? 'S' : ''} IN IT`); hookSay = L(`Saison ${year} : seulement ${F.margin} point${F.margin > 1 ? 's' : ''} d'écart à l'arrivée !`, `The ${year} season: just ${F.margin} point${F.margin > 1 ? 's' : ''} in it at the end!`); }
  else if (F.winners.size >= 6) { hook = L(`${F.winners.size} VAINQUEURS DIFFÉRENTS`, `${F.winners.size} DIFFERENT WINNERS`); hookSay = L(`Saison ${year} : ${F.winners.size} vainqueurs différents !`, `The ${year} season: ${F.winners.size} different winners!`); }
  else { hook = L(`SAISON ${year}`, `${year} SEASON`); hookSay = L(`Toute la saison ${year} en une minute !`, `The whole ${year} season in one minute!`); }
  segs.push({ dur: 3.4, cam: 'fly', dim: 0.5, must: true, e: 3, say: () => hookSay, draw(g, B, lt) {
    const p = Math.min(1, lt / 0.25), y = B.y + B.h * 0.38;
    vText(g, L('LE RÉSUMÉ DE LA SAISON', 'THE SEASON IN REVIEW'), B.x + B.w / 2, y - 40, 26, { w: 900, col: '#e10600', al: 'center' });
    g.save(); g.translate(B.x + B.w / 2, y); g.scale(1.25 - 0.25 * p, 1.25 - 0.25 * p);
    const end = vWrap(g, hook, 0, 70, 76, B.w - 20, { al: 'center' }); g.restore();
    vText(g, String(year), B.x + B.w / 2, y + end + 40, 40, { w: 900, mono: true, al: 'center', col: 'rgba(255,255,255,.8)' });
  } });
  // 2. la saison en chiffres
  const tiles = [[n, L('Grands Prix', 'Grands Prix')], [F.winners.size, L('vainqueurs', 'winners')], [F.dnfs, L('abandons', 'retirements')], F.scs != null ? [F.scs, L('Safety Cars', 'Safety Cars')] : [F.wet, L('courses humides', 'wet races')]];
  segs.push({ dur: 5.5, cam: 'fly', dim: 0.45, say: () => L(`${n} Grands Prix, ${F.winners.size} vainqueurs différents et ${F.dnfs} abandons.`, `${n} Grands Prix, ${F.winners.size} different winners and ${F.dnfs} retirements.`), draw(g, B, lt) {
    const y = vHead(g, B, L(`Saison ${year}`, `${year} season`), L('EN CHIFFRES', 'IN NUMBERS'));
    const w = (B.w - 14) / 2, h = 190;
    tiles.forEach(([v, l], i) => { const x = B.x + (i % 2) * (w + 14), yy = y + 20 + Math.floor(i / 2) * (h + 14), a = vReveal(lt, i, 4, 1.4);
      g.globalAlpha = a; hlBox(g, x, yy, w, h, 'rgba(10,12,16,.82)', 14); g.fillStyle = '#e10600'; g.fillRect(x, yy, w, 6);
      vText(g, String(Math.round(v * Math.min(1, a * 1.2))), x + w / 2, yy + 118, 84, { w: 900, mono: true, al: 'center' });
      vText(g, l.toUpperCase(), x + w / 2, yy + 160, 20, { w: 800, al: 'center', col: 'rgba(255,255,255,.75)', max: w - 20 }); });
    g.globalAlpha = 1;
  } });
  // 3. les moments marquants
  F.moments.forEach((m, k) => {
    const rd = S.rounds[m.i], c = CIRCUITS.find(x => x.id === rd.id), car = carOf(m.who), h = F.hist[m.i + 1];
    const top3 = F.items.map(x => x.name).sort((a, b) => h[b] - h[a]).slice(0, 3);
    segs.push({ dur: 4.6, cam: car != null && k % 2 === 0 ? 'car' : 'fly', focus: car ?? 0, focus2: null, look: 10, dim: car != null && k % 2 === 0 ? 0.12 : 0.4, e: m.score >= 70 ? 3 : 2, sayAt: 0.3, say: () => m.text, draw(g, B, lt) {
      const ch = 420, y = B.y + B.h - ch, col = colD(m.who);
      hlBox(g, B.x, B.y + 70, 230, 42, '#e10600', 8);
      vText(g, L(`MANCHE ${m.i + 1} / ${S.rounds.length}`, `ROUND ${m.i + 1} / ${S.rounds.length}`), B.x + 115, B.y + 99, 20, { w: 900, al: 'center' });
      hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col; g.fillRect(B.x, y, 10, ch);
      vText(g, `${c.flag} ${tr(c.name).toUpperCase()}`, B.x + 34, y + 48, 22, { w: 900, col: '#e10600', max: B.w - 60 });
      g.save(); const s = 1 + 0.12 * Math.max(0, 1 - lt / 0.25); g.translate(B.x + 34, y + 104); g.scale(s, s);
      const ny = vWrap(g, m.title, 0, 0, 50, B.w - 70); g.restore();
      vText(g, m.sub, B.x + 34, y + 104 + ny + 4, 24, { w: 700, col: 'rgba(255,255,255,.85)', max: B.w - 60 });
      // classement après la manche
      const yy = y + ch - 3 * 50 - 18;
      vText(g, L('CHAMPIONNAT APRÈS LA COURSE', 'STANDINGS AFTER THE RACE'), B.x + 34, yy - 10, 15, { w: 800, col: 'rgba(255,255,255,.6)' });
      top3.forEach((nm, j) => { g.globalAlpha = vReveal(lt, j, 3, 0.9);
        hlBox(g, B.x + 24, yy + j * 50, B.w - 48, 44, nm === m.who ? 'rgba(225,6,0,.35)' : 'rgba(255,255,255,.06)', 8);
        g.fillStyle = colD(nm); g.fillRect(B.x + 24, yy + j * 50, 6, 44);
        vText(g, `${j + 1}. ${nm}`, B.x + 44, yy + j * 50 + 30, 21, { w: 800, max: B.w - 200 });
        vText(g, `${h[nm]} pts`, B.x + B.w - 40, yy + j * 50 + 30, 21, { w: 800, mono: true, al: 'right' }); });
      g.globalAlpha = 1;
    } });
  });
  // 4. la course au titre : courbes des points qui se dessinent manche après manche
  const meOn = F.me && F.sortD.findIndex(d => d.name === F.me) >= 4;
  const race = [...F.sortD.slice(0, 4).map(d => d.name), ...(meOn ? [F.me] : [])];
  const raceSay = F.decided === n ? L(`La course au titre : ${c0.name} et ${c1.name} se sont battus jusqu'au bout !`, `The title fight: ${c0.name} and ${c1.name} went at it until the very end!`)
    : F.changes >= 2 ? L(`La course au titre : la tête a changé ${F.changes} fois, avant que ${c0.name} ne fasse la différence.`, `The title fight: the lead changed ${F.changes} times before ${c0.name} pulled clear.`)
    : L(`La course au titre : ${c0.name} assure le titre dès la manche ${F.decided}, avec ${n - F.decided} course${n - F.decided > 1 ? 's' : ''} d'avance.`, `The title fight: ${c0.name} wrapped it up in round ${F.decided}, with ${n - F.decided} race${n - F.decided > 1 ? 's' : ''} to spare.`);
  segs.push({ dur: 10, cam: 'fly', dim: 0.66, must: true, say: () => raceSay, draw(g, B, lt, sg) {
    const y0 = vHead(g, B, L(`Saison ${year}`, `${year} season`), L('LA COURSE AU TITRE', 'THE TITLE FIGHT'));
    const x0 = B.x + 54, x1 = B.x + B.w - 150, yT = y0 + 20, yB = B.y + B.h - 60, top = Math.max(25, Math.ceil(c0.pts / 50) * 50);
    const X = i => x0 + i / n * (x1 - x0), Y = p => yB - p / top * (yB - yT);
    const prog = clamp((lt - 0.4) / Math.max(1, sg.dur - 2.6), 0, 1) * n, iP = Math.floor(prog), fP = prog - iP;
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.14)';
    for (let k = 0; k <= 4; k++) { const yy = Y(top * k / 4); g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); vText(g, String(Math.round(top * k / 4)), x0 - 10, yy + 6, 16, { w: 700, mono: true, al: 'right', col: 'rgba(255,255,255,.55)' }); }
    for (let i = 1; i <= n; i += Math.max(1, Math.ceil(n / 6))) vText(g, String(i), X(i), yB + 28, 16, { w: 700, mono: true, al: 'center', col: 'rgba(255,255,255,.55)' });
    vText(g, L('MANCHES', 'ROUNDS'), x1, yB + 50, 13, { w: 800, al: 'right', col: 'rgba(255,255,255,.45)' });
    if (F.decided < n && prog >= F.decided) {   // manche du titre
      const xd = X(F.decided); g.setLineDash([6, 6]); g.strokeStyle = '#ffcc33'; g.lineWidth = 2; g.beginPath(); g.moveTo(xd, yT); g.lineTo(xd, yB); g.stroke(); g.setLineDash([]);
      vText(g, L('TITRE', 'TITLE'), xd, yT - 6, 16, { w: 900, al: 'center', col: '#ffcc33' });
    }
    const heads = [];
    for (const nm of race.slice().reverse()) {
      const col = colD(nm), pAt = i => F.hist[i][nm], pts = [];
      for (let i = 0; i <= Math.min(iP, n); i++) pts.push([X(i), Y(pAt(i))]);
      if (iP < n) pts.push([X(iP + fP), Y(pAt(iP) + (pAt(iP + 1) - pAt(iP)) * fP)]);
      g.strokeStyle = col; g.lineWidth = nm === c0.name ? 7 : 5; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      const hd = pts[pts.length - 1]; g.fillStyle = col; g.beginPath(); g.arc(hd[0], hd[1], 9, 0, 7); g.fill();
      heads.push({ nm, y: hd[1], x: hd[0], pts: Math.round(iP < n ? pAt(iP) + (pAt(iP + 1) - pAt(iP)) * fP : pAt(n)) });
    }
    heads.sort((a, b) => a.y - b.y);
    for (let k = 1; k < heads.length; k++) if (heads[k].y - heads[k - 1].y < 34) heads[k].y = heads[k - 1].y + 34;
    for (const h of heads) { vText(g, lastName(h.nm).toUpperCase(), h.x + 18, h.y - 2, 21, { w: 900, col: colD(h.nm) }); vText(g, String(h.pts), h.x + 18, h.y + 20, 18, { w: 800, mono: true }); }
  } });
  // 5. classement final (top 10)
  segs.push({ dur: 7, cam: 'gridwide', dim: 0.55, say: () => L(`Le classement final : ${c0.name} devant ${c1.name} et ${F.sortD[2].name}.`, `Final standings: ${c0.name} ahead of ${c1.name} and ${F.sortD[2].name}.`), draw(g, B, lt) {
    const y = vHead(g, B, L(`Saison ${year}`, `${year} season`), L('CLASSEMENT FINAL', 'FINAL STANDINGS')), rows = F.sortD.slice(0, 10), rh = Math.min(70, (B.y + B.h - y) / rows.length);
    rows.forEach((d, i) => { const k = rows.length - 1 - i; g.globalAlpha = vReveal(lt, k, rows.length, 3); vRow(g, B, y + i * rh, rh, i + 1, colD(d.name), d.name, `${d.team} · ${d.wins} ${L('V', 'W')}`, `${d.pts}`, { hi: d.name === F.me, rw: 90, size: 23 }); });
    g.globalAlpha = 1;
  } });
  // 6. titre des écuries
  const t0 = F.sortT[0];
  segs.push({ dur: 5, cam: 'fly', dim: 0.5, say: () => L(`Chez les écuries, ${t0.name} remporte le titre avec ${t0.pts} points.`, `In the teams' championship, ${t0.name} take the title with ${t0.pts} points.`), draw(g, B, lt) {
    const y = vHead(g, B, L('Championnat des écuries', 'Teams’ championship'), L('LES ÉCURIES', 'THE TEAMS')), rows = F.sortT.slice(0, 5);
    rows.forEach((t, i) => { g.globalAlpha = vReveal(lt, rows.length - 1 - i, rows.length, 1.6); vRow(g, B, y + i * 86, 86, i + 1, colT(t.name), t.name, `${t.wins} ${L('victoires', 'wins')}`, `${t.pts}`, { hi: i === 0, rw: 100, size: 26 }); });
    g.globalAlpha = 1;
  } });
  // 7. le champion (caméra sur sa voiture, en tête de la grille)
  const mine = c0.name === F.me;
  segs.push({ dur: 7, cam: 'pole', focus: 0, dim: 0.12, must: true, e: 3, say: () => mine ? L(`Et le champion du monde ${year}, c'est toi ! ${c0.pts} points et ${c0.wins} victoires !`, `And the ${year} world champion is you! ${c0.pts} points and ${c0.wins} wins!`) : L(`${c0.name} remporte le titre ${year} ! ${c0.pts} points et ${c0.wins} victoires !`, `${c0.name} takes the ${year} title! ${c0.pts} points and ${c0.wins} wins!`), draw(g, B, lt) {
    const ch = 400, y = B.y + B.h - ch, col = colD(c0.name), p = Math.min(1, lt / 0.3);
    hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col; g.fillRect(B.x, y, 10, ch);
    vText(g, L(`🏆 CHAMPION DU MONDE ${year}`, `🏆 ${year} WORLD CHAMPION`), B.x + 34, y + 52, 26, { w: 900, col: '#ffcc33', max: B.w - 60 });
    g.save(); g.translate(B.x + 34, y + 124); g.scale(1.2 - 0.2 * p, 1.2 - 0.2 * p); vText(g, c0.name.toUpperCase(), 0, 0, 58, { w: 900, max: B.w - 70 }); g.restore();
    vText(g, c0.team, B.x + 34, y + 164, 24, { w: 700, col: 'rgba(255,255,255,.8)', max: B.w - 60 });
    const st = [[c0.pts, L('points', 'points')], [c0.wins, L('victoires', 'wins')], [c0.poles, L('poles', 'poles')], [c0.pod, L('podiums', 'podiums')]], w = (B.w - 68 - 30) / 4;
    st.forEach(([v, l], i) => { const x = B.x + 34 + i * (w + 10); g.globalAlpha = vReveal(lt, i, 4, 1.2);
      hlBox(g, x, y + 200, w, 150, 'rgba(255,255,255,.07)', 10);
      vText(g, String(v), x + w / 2, y + 290, 50, { w: 900, mono: true, al: 'center' });
      vText(g, l.toUpperCase(), x + w / 2, y + 326, 15, { w: 800, al: 'center', col: 'rgba(255,255,255,.7)', max: w - 8 }); });
    g.globalAlpha = 1;
  } });
  // 8. fin
  segs.push({ dur: 4, cam: 'fly', dim: 0.55, say: () => L(`Rendez-vous en ${year + 1} ! Abonne-toi pour ne rien rater de la suite.`, `See you in ${year + 1}! Follow so you don't miss what comes next.`), draw(g, B) {
    vText(g, L('LA SUITE', 'COMING NEXT'), B.x + B.w / 2, B.y + B.h * 0.38, 26, { w: 900, col: '#e10600', al: 'center' });
    vText(g, L(`SAISON ${year + 1}`, `${year + 1} SEASON`), B.x + B.w / 2, B.y + B.h * 0.38 + 80, 70, { w: 900, al: 'center', max: B.w });
    vText(g, L('Abonne-toi pour suivre la suite', 'Follow to see what happens next'), B.x + B.w / 2, B.y + B.h - 30, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.7)', max: B.w });
  } });
  return vFit(segs, 70);
}
/* ---- 5. la saison des évolutions (fin de saison) : qui a le mieux développé sa voiture ----
   accroche, chiffres, course des performances animée (écart au plus rapide avant chaque GP), meilleures évolutions,
   la plus ratée, plus gros gain / plus grosse chute, hiérarchie finale comparée au début de saison */
const upPerf = u => u.delta * (W_AREA[u.area] || 0) * 0.11;   // effet sur l'écart au tour (même échelle que le graphique Évolutions)
function upSay(u) {
  if (!SEC_PT[u.area]) return u.fail ? L('usure des pneus en hausse', 'higher tyre wear') : L('usure des pneus réduite', 'lower tyre wear');
  const s = Math.abs(u.delta * SEC_PT[u.area]).toFixed(2).replace('.', L(',', '.'));
  return u.fail ? L(`+${s} s au tour`, `+${s} s per lap`) : L(`−${s} s au tour`, `−${s} s per lap`);
}
function vidDevSegs(S, teams) {
  const segs = [], year = S.year || career().year, hist = devHistory(), nH = hist.length, first = hist[0], last = hist[nH - 1];
  const colT = name => { const t = teams.find(x => x.name === name); return t ? t.tv || t.color : '#888'; };
  const num = x => x.toFixed(2).replace('.', L(',', '.'));
  const names = teams.map(t => t.name), rank = h => names.slice().sort((a, b) => h[a] - h[b]);
  const r0 = rank(first), r1 = rank(last);
  const ups = S.rounds.flatMap((rd, i) => (rd.upgrades || []).map(u => Object.assign({ i, c: CIRCUITS.find(x => x.id === rd.id) }, u)));
  const good = ups.filter(u => !u.fail).sort((a, b) => upPerf(b) - upPerf(a)), flops = ups.filter(u => u.fail).sort((a, b) => upPerf(a) - upPerf(b));
  const gain = names.map(n => ({ n, g: first[n] - last[n], p0: r0.indexOf(n) + 1, p1: r1.indexOf(n) + 1 })).sort((a, b) => b.g - a.g);
  const up = gain[0], down = gain[gain.length - 1], carOf = n => { const i = names.indexOf(n); return i >= 0 ? i * 2 : 0; };
  const where = c => L(inPlace(c), 'in ' + tr(c.name));
  // 1. accroche
  let hook, hookSay;
  if (r0[0] !== r1[0]) { hook = L('LA HIÉRARCHIE A BASCULÉ', 'THE PECKING ORDER FLIPPED'); hookSay = L(`${r0[0]} avait la meilleure voiture en début de saison… mais c'est ${r1[0]} qui la finit en tête !`, `${r0[0]} had the best car at the start… but ${r1[0]} ends the season on top!`); }
  else if (up.p0 - up.p1 >= 3) { hook = L(`DE P${up.p0} À P${up.p1}`, `FROM P${up.p0} TO P${up.p1}`); hookSay = L(`${up.n} est passée de la ${up.p0}e à la ${up.p1}e voiture la plus rapide !`, `${up.n} went from the ${up.p0}th to the ${up.p1}th fastest car!`); }
  else { hook = L(`−${num(up.g)} S EN UNE SAISON`, `−${num(up.g)} S IN ONE SEASON`); hookSay = L(`${up.n} a gagné ${num(up.g)} seconde au tour en une saison !`, `${up.n} found ${num(up.g)} of a second per lap in one season!`); }
  segs.push({ dur: 3.4, cam: 'fly', dim: 0.5, must: true, e: 3, say: () => hookSay, draw(g, B, lt) {
    const p = Math.min(1, lt / 0.25), y = B.y + B.h * 0.38;
    vText(g, L(`LES ÉVOLUTIONS ${year}`, `${year} UPGRADES`), B.x + B.w / 2, y - 40, 26, { w: 900, col: '#e10600', al: 'center' });
    g.save(); g.translate(B.x + B.w / 2, y); g.scale(1.25 - 0.25 * p, 1.25 - 0.25 * p); vWrap(g, hook, 0, 70, 76, B.w - 20, { al: 'center' }); g.restore();
  } });
  // 2. en chiffres
  const spread = last[r1[r1.length - 1]], spread0 = first[r0[r0.length - 1]];
  const tiles = [[ups.length, L('évolutions', 'upgrades')], [flops.length, L('ratées', 'failed')], [ups.filter(u => u.big).length, L('gros packages', 'big packages')], [num(spread), L('s d’écart final', 's final spread')]];
  segs.push({ dur: 5.5, cam: 'fly', dim: 0.45, say: () => L(`${ups.length} évolutions apportées cette saison, dont ${flops.length} ratées. L'écart entre la meilleure et la moins bonne voiture est passé de ${num(spread0)} à ${num(spread)} seconde.`, `${ups.length} upgrades this season, ${flops.length} of them failures. The gap from the best to the slowest car went from ${num(spread0)} to ${num(spread)} seconds.`), draw(g, B, lt) {
    const y = vHead(g, B, L(`Saison ${year}`, `${year} season`), L('LE DÉVELOPPEMENT', 'DEVELOPMENT'));
    const w = (B.w - 14) / 2, h = 190;
    tiles.forEach(([v, l], i) => { const x = B.x + (i % 2) * (w + 14), yy = y + 20 + Math.floor(i / 2) * (h + 14);
      g.globalAlpha = vReveal(lt, i, 4, 1.4); hlBox(g, x, yy, w, h, 'rgba(10,12,16,.82)', 14); g.fillStyle = '#e10600'; g.fillRect(x, yy, w, 6);
      vText(g, String(v), x + w / 2, yy + 118, 78, { w: 900, mono: true, al: 'center' });
      vText(g, l.toUpperCase(), x + w / 2, yy + 160, 20, { w: 800, al: 'center', col: 'rgba(255,255,255,.75)', max: w - 20 }); });
    g.globalAlpha = 1;
  } });
  // 3. la course des performances : barres qui se reclassent manche après manche
  const maxG = Math.max(0.3, ...hist.flatMap(h => Object.values(h)));
  segs.push({ dur: 13, cam: 'fly', dim: 0.66, must: true, say: () => L(`Voici l'écart de chaque voiture sur la plus rapide, avant chaque Grand Prix.${r0[0] !== r1[0] ? ` Regarde ${r1[0]} remonter !` : ` ${r1[0]} reste la référence du début à la fin.`}`, `Here's each car's gap to the fastest, before every Grand Prix.${r0[0] !== r1[0] ? ` Watch ${r1[0]} climb!` : ` ${r1[0]} stays the benchmark from start to finish.`}`), draw(g, B, lt, sg) {
    const y0 = vHead(g, B, L('Écart au plus rapide', 'Gap to the fastest'), L('LA COURSE AUX ÉVOLUTIONS', 'THE DEVELOPMENT RACE'));
    const f = clamp((lt - 0.6) / Math.max(1, sg.dur - 2.4), 0, 1) * (nH - 1), i0 = Math.floor(f), i1 = Math.min(nH - 1, i0 + 1), u = vEase(f - i0);
    const ha = hist[i0], hb = hist[i1], ra = rank(ha), rb = rank(hb), nt = names.length;
    const yB = B.y + B.h - 70, rh = Math.min(66, (yB - y0) / nt), x0 = B.x + 8, wMax = B.w - 150;
    const rd = S.rounds[Math.round(f)], c = rd && CIRCUITS.find(x => x.id === rd.id);
    if (c) vText(g, L(`AVANT LA MANCHE ${Math.round(f) + 1} · `, `BEFORE ROUND ${Math.round(f) + 1} · `) + `${c.flag} ${tr(c.name).toUpperCase()}`, B.x, yB + 44, 20, { w: 900, col: 'rgba(255,255,255,.8)', max: B.w });
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(B.x, yB + 58, B.w, 5); g.fillStyle = '#e10600'; g.fillRect(B.x, yB + 58, B.w * f / Math.max(1, nH - 1), 5);
    for (const n of names) {
      const gap = ha[n] + (hb[n] - ha[n]) * u, pos = ra.indexOf(n) + (rb.indexOf(n) - ra.indexOf(n)) * u, yy = y0 + pos * rh;
      const w = wMax * (0.18 + 0.82 * (1 - gap / maxG));
      hlBox(g, x0, yy, B.w - 8, rh - 8, 'rgba(10,12,16,.7)', 6);
      g.fillStyle = colT(n); g.globalAlpha = 0.92; g.fillRect(x0, yy, w, rh - 8); g.globalAlpha = 1;
      g.save(); g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 5; vText(g, n, x0 + 12, yy + rh / 2 + 3, 21, { w: 900, max: w + 60 }); g.restore();
      vText(g, gap < 0.005 ? L('RÉF.', 'REF.') : `+${num(gap)} s`, B.x + B.w - 12, yy + rh / 2 + 3, 20, { w: 800, mono: true, al: 'right' });
    }
  } });
  // 4. les meilleures évolutions (caméra sur la voiture de l'écurie)
  good.slice(0, 3).forEach((u, k) => {
    segs.push({ dur: 4.6, cam: k % 2 ? 'fly' : 'car', focus: carOf(u.team), focus2: carOf(u.team) + 1, look: 10, dim: k % 2 ? 0.4 : 0.12, e: k ? 2 : 3, sayAt: 0.3,
      say: () => k === 0 ? L(`La meilleure évolution de l'année : ${u.part} chez ${u.team}, ${where(u.c)} !`, `The upgrade of the year: ${u.team}'s ${u.part}, ${where(u.c)}!`) : V([`${u.team} frappe fort ${where(u.c)} : ${u.part} !`, `${u.team} strike hard ${where(u.c)}: ${u.part}!`], [`${where(u.c)[0].toUpperCase() + where(u.c).slice(1)}, ${u.team} apporte une grosse évolution : ${u.part}.`, `${where(u.c)[0].toUpperCase() + where(u.c).slice(1)}, ${u.team} bring a big upgrade: ${u.part}.`]),
      draw(g, B, lt) { devCard(g, B, lt, S, u, k === 0 ? L('ÉVOLUTION DE L’ANNÉE', 'UPGRADE OF THE YEAR') : L(`TOP ${k + 1} DES ÉVOLUTIONS`, `TOP ${k + 1} UPGRADE`), colT(u.team), '#39ff88'); } });
  });
  // 5. la plus ratée
  const fl = flops[0];
  if (fl) segs.push({ dur: 4.6, cam: 'car', focus: carOf(fl.team), focus2: carOf(fl.team) + 1, look: 10, dim: 0.12, e: 2, sayAt: 0.3, say: () => L(`Et le flop de la saison : ${fl.part} chez ${fl.team}, ${where(fl.c)}. Raté !`, `And the flop of the season: ${fl.team}'s ${fl.part}, ${where(fl.c)}. A miss!`),
    draw(g, B, lt) { devCard(g, B, lt, S, fl, L('LE FLOP DE LA SAISON', 'FLOP OF THE SEASON'), colT(fl.team), '#ff4d4d'); } });
  // 6. plus gros gain, plus grosse chute
  segs.push({ dur: 6, cam: 'fly', dim: 0.5, say: () => L(`${up.n} a le plus progressé : ${num(up.g)} seconde de gagnée. ${down.g < 0 ? `À l'inverse, ${down.n} a reculé de ${num(-down.g)} seconde.` : `${down.n} a le moins progressé.`}`, `${up.n} improved the most: ${num(up.g)} of a second found. ${down.g < 0 ? `${down.n}, though, fell back by ${num(-down.g)} of a second.` : `${down.n} improved the least.`}`), draw(g, B, lt) {
    let y = vHead(g, B, L('Sur toute la saison', 'Over the season'), L('GAGNANT ET PERDANT', 'WINNER AND LOSER'));
    [[up, L('▲ PLUS GROS PROGRÈS', '▲ BIGGEST GAIN'), '#39ff88'], [down, down.g < 0 ? L('▼ PLUS GROSSE CHUTE', '▼ BIGGEST DROP') : L('▼ PLUS PETIT PROGRÈS', '▼ SMALLEST GAIN'), '#ff4d4d']].forEach(([x, k, col], j) => {
      const yy = y + 10 + j * 300; g.globalAlpha = vReveal(lt, j, 2, 1.4);
      hlBox(g, B.x, yy, B.w, 270, 'rgba(8,10,14,.86)', 14); g.fillStyle = colT(x.n); g.fillRect(B.x, yy, 10, 270);
      vText(g, k, B.x + 34, yy + 48, 22, { w: 900, col });
      vText(g, x.n.toUpperCase(), B.x + 34, yy + 108, 44, { w: 900, max: B.w - 60 });
      vText(g, `${x.g >= 0 ? '−' : '+'}${num(Math.abs(x.g))} s`, B.x + 34, yy + 196, 70, { w: 900, mono: true, col });
      vText(g, L(`P${x.p0} → P${x.p1}`, `P${x.p0} → P${x.p1}`), B.x + B.w - 30, yy + 196, 34, { w: 800, mono: true, al: 'right' });
      vText(g, L('voiture la plus rapide', 'fastest car rank'), B.x + B.w - 30, yy + 232, 16, { w: 700, al: 'right', col: 'rgba(255,255,255,.6)' });
    });
    g.globalAlpha = 1;
  } });
  // 7. hiérarchie finale, comparée au début de saison
  segs.push({ dur: 7, cam: 'gridwide', dim: 0.55, say: () => L(`La hiérarchie en fin de saison : ${r1[0]} devant ${r1[1]} et ${r1[2]}.`, `The pecking order at the end: ${r1[0]} ahead of ${r1[1]} and ${r1[2]}.`), draw(g, B, lt) {
    const y = vHead(g, B, L('Avant la saison prochaine', 'Heading into next season'), L('HIÉRARCHIE FINALE', 'FINAL PECKING ORDER')), rh = Math.min(66, (B.y + B.h - y - 10) / r1.length);
    r1.forEach((n, i) => { const d = r0.indexOf(n) - i; g.globalAlpha = vReveal(lt, i, r1.length, 2.5);
      vRow(g, B, y + i * rh, rh, i + 1, colT(n), n, d ? L(`${d > 0 ? '▲' : '▼'} ${Math.abs(d)} place${Math.abs(d) > 1 ? 's' : ''} depuis le début`, `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} since the start`) : L('= même place qu’au début', '= same as the start'), i ? `+${num(last[n])}` : L('réf.', 'ref.'), { rw: 100, size: 23, rcol: d > 0 ? '#39ff88' : d < 0 ? '#ff6b6b' : '#fff' }); });
    g.globalAlpha = 1;
  } });
  // 8. fin
  segs.push({ dur: 4.5, cam: 'fly', dim: 0.55, say: () => L(`Les trois quarts de ce développement sont conservés pour ${year + 1}. Abonne-toi pour voir qui en profitera !`, `Three quarters of this development carries over to ${year + 1}. Follow to see who makes the most of it!`), draw(g, B) {
    vText(g, L('ET EN', 'AND IN'), B.x + B.w / 2, B.y + B.h * 0.36, 26, { w: 900, col: '#e10600', al: 'center' });
    vText(g, String(year + 1), B.x + B.w / 2, B.y + B.h * 0.36 + 110, 120, { w: 900, mono: true, al: 'center' });
    vWrap(g, L('75 % du développement est conservé', '75% of the development carries over'), B.x + B.w / 2, B.y + B.h * 0.36 + 180, 28, B.w - 40, { w: 700, al: 'center', col: 'rgba(255,255,255,.85)' });
    vText(g, L('Abonne-toi pour la suite', 'Follow for what comes next'), B.x + B.w / 2, B.y + B.h - 30, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.7)', max: B.w });
  } });
  return vFit(segs, 68);
}
/* carton d'une évolution (bas de l'image : la voiture reste visible en haut) */
function devCard(g, B, lt, S, u, kicker, col, accent) {
  const ch = 400, y = B.y + B.h - ch;
  hlBox(g, B.x, B.y + 70, 230, 42, '#e10600', 8);
  vText(g, L(`MANCHE ${u.i + 1} / ${S.rounds.length}`, `ROUND ${u.i + 1} / ${S.rounds.length}`), B.x + 115, B.y + 99, 20, { w: 900, al: 'center' });
  hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col; g.fillRect(B.x, y, 10, ch);
  vText(g, kicker, B.x + 34, y + 48, 22, { w: 900, col: accent, max: B.w - 60 });
  vText(g, u.team.toUpperCase(), B.x + 34, y + 104, 44, { w: 900, max: B.w - 60 });
  g.save(); const s = 1 + 0.12 * Math.max(0, 1 - lt / 0.25); g.translate(B.x + 34, y + 160); g.scale(s, s);
  const ny = vWrap(g, u.part[0].toUpperCase() + u.part.slice(1), 0, 0, 34, B.w - 70, { w: 800 }); g.restore();
  vText(g, `${DEV_AREAS[u.area].label}${u.big ? L(' · gros package', ' · big package') : ''} · ${u.c.flag} ${tr(u.c.name)}`, B.x + 34, y + 160 + ny + 4, 20, { w: 700, col: 'rgba(255,255,255,.75)', max: B.w - 60 });
  g.globalAlpha = Math.max(0, Math.min(1, (lt - 0.5) / 0.3));
  vText(g, upSay(u), B.x + 34, y + ch - 40, 54, { w: 900, mono: true, col: accent, max: B.w - 60 });
  g.globalAlpha = 1;
}
const vEase = x => x * x * (3 - 2 * x);
/* ---- 6. la course au titre, pilotes ou écuries (fin de saison) ----
   accroche, classement animé manche après manche, manches en tête, le tournant, l'écart entre les deux premiers, podium, champion */
function titleFacts(S, kind) {
  const n = S.rounds.filter(rd => rd.result).length, { items, hist } = ptsHistory(kind, S), names = items.map(x => x.name);
  const key = r => kind === 't' ? r.team : r.name, wins = [Object.fromEntries(names.map(x => [x, 0]))];
  S.rounds.slice(0, n).forEach(rd => { const w = Object.assign({}, wins[wins.length - 1]); const r = rd.result[0]; if (r && key(r) in w) w[key(r)]++; wins.push(w); });
  const order = i => names.slice().sort((a, b) => hist[i][b] - hist[i][a] || wins[i][b] - wins[i][a]);
  const fin = order(n), champ = fin[0], second = fin[1], maxR = kind === 't' ? POINTS[0] + POINTS[1] : POINTS[0];
  let decided = n;
  for (let i = 1; i <= n; i++) { if (order(i)[0] !== champ) continue; const h = hist[i]; if (h[champ] - Math.max(...names.filter(x => x !== champ).map(x => h[x])) > (n - i) * maxR) { decided = i; break; } }
  let changes = 0; const led = {};
  for (let i = 1; i <= n; i++) { const l = order(i)[0]; led[l] = (led[l] || 0) + 1; if (i > 1 && l !== order(i - 1)[0]) changes++; }
  // le tournant : la manche où l'écart entre les deux premiers du classement final a le plus bougé
  let turn = null;
  for (let i = 1; i <= n; i++) { const d = (hist[i][champ] - hist[i][second]) - (hist[i - 1][champ] - hist[i - 1][second]); if (!turn || Math.abs(d) > Math.abs(turn.d)) turn = { i, d }; }
  return { n, items, hist, wins, order, fin, champ, second, decided, changes, led, turn, margin: hist[n][champ] - hist[n][second] };
}
function vidTitleSegs(S, kind, carOf) {
  const F = titleFacts(S, kind), segs = [], year = S.year || career().year, n = F.n, T_ = kind === 't';
  const it = Object.fromEntries(F.items.map(x => [x.name, x])), col = nm => (it[nm] || {}).color || '#888', short = nm => T_ ? nm : lastName(nm);
  const h = F.hist, c0 = F.champ, c1 = F.second, me = myDriver(), meIn = !T_ && me && it[me];
  const label = T_ ? L('ÉCURIES', 'TEAMS') : L('PILOTES', 'DRIVERS');
  // 1. accroche
  let hook, hookSay;
  if (n > 1 && F.decided === n && F.margin <= POINTS[0]) { hook = L('DÉCIDÉ À LA DERNIÈRE COURSE', 'DECIDED IN THE FINAL RACE'); hookSay = L(`Le titre ${T_ ? 'des écuries' : 'pilotes'} ${year} s'est joué à la dernière course !`, `The ${year} ${T_ ? 'teams' : 'drivers'}' title went down to the final race!`); }
  else if (F.changes >= 3) { hook = L(`${F.changes} CHANGEMENTS DE LEADER`, `${F.changes} LEAD CHANGES`); hookSay = L(`${F.changes} changements de leader dans la course au titre ${T_ ? 'des écuries' : 'pilotes'} !`, `${F.changes} lead changes in the ${T_ ? 'teams' : 'drivers'}' title fight!`); }
  else if ((F.led[c0] || 0) >= n - 1 && n >= 4) { hook = L(`EN TÊTE DE BOUT EN BOUT`, `LED FROM START TO FINISH`); const all = F.led[c0] === n; hookSay = L(`${c0} a mené le championnat${T_ ? ' des écuries' : ''} ${all ? 'du début à la fin' : 'quasiment toute la saison'} !`, `${c0} led the ${T_ ? 'teams\' ' : ''}championship ${all ? 'from start to finish' : 'almost all season'}!`); }
  else if (F.margin <= 15) { hook = L(`${F.margin} POINT${F.margin > 1 ? 'S' : ''} D'ÉCART`, `${F.margin} POINT${F.margin > 1 ? 'S' : ''} IN IT`); hookSay = L(`Seulement ${F.margin} point${F.margin > 1 ? 's' : ''} entre ${c0} et ${c1} à l'arrivée !`, `Just ${F.margin} point${F.margin > 1 ? 's' : ''} between ${c0} and ${c1} at the end!`); }
  else { hook = L(`TITRE APRÈS ${F.decided} MANCHES`, `TITLE AFTER ${F.decided} ROUNDS`); hookSay = L(`${c0} s'est assuré le titre dès la manche ${F.decided} !`, `${c0} sealed the title as early as round ${F.decided}!`); }
  segs.push({ dur: 3.4, cam: 'fly', dim: 0.5, must: true, e: 3, say: () => hookSay, draw(g, B, lt) {
    const p = Math.min(1, lt / 0.25), y = B.y + B.h * 0.38;
    vText(g, L(`COURSE AU TITRE ${label} ${year}`, `${year} ${label} TITLE FIGHT`), B.x + B.w / 2, y - 40, 24, { w: 900, col: '#e10600', al: 'center', max: B.w });
    g.save(); g.translate(B.x + B.w / 2, y); g.scale(1.25 - 0.25 * p, 1.25 - 0.25 * p); vWrap(g, hook, 0, 70, 76, B.w - 20, { al: 'center' }); g.restore();
  } });
  // 2. le classement qui se reclasse manche après manche
  const shown = F.fin.slice(0, T_ ? 11 : 10), maxP = Math.max(1, h[n][c0]);
  segs.push({ dur: 15, cam: 'fly', dim: 0.66, must: true, say: () => F.changes ? L(`Manche après manche : la tête du championnat a changé ${F.changes} fois, mais c'est ${c0} qui termine devant.`, `Round by round: the lead changed ${F.changes} times, but ${c0} finishes on top.`) : L(`Manche après manche : ${c0} n'a jamais lâché la tête.`, `Round by round: ${c0} never gave up the lead.`), draw(g, B, lt, sg) {
    const y0 = vHead(g, B, L(`Classement ${T_ ? 'des écuries' : 'des pilotes'}`, `${T_ ? 'Teams' : 'Drivers'}’ standings`), L('LA COURSE AU TITRE', 'THE TITLE FIGHT'));
    const f = clamp((lt - 0.6) / Math.max(1, sg.dur - 2.4), 0, 1) * n, i0 = Math.floor(f), i1 = Math.min(n, i0 + 1), u = vEase(f - i0);
    const ra = F.order(i0), rb = F.order(i1), top = Math.max(10, ...shown.map(x => h[i1][x])), yB = B.y + B.h - 70, rh = Math.min(68, (yB - y0) / shown.length), wMax = B.w - 130;
    const k = Math.round(f), rd = S.rounds[k - 1], c = rd && CIRCUITS.find(x => x.id === rd.id);
    vText(g, c ? L(`APRÈS LA MANCHE ${k} · `, `AFTER ROUND ${k} · `) + `${c.flag} ${tr(c.name).toUpperCase()}` : L('AVANT LA PREMIÈRE MANCHE', 'BEFORE ROUND ONE'), B.x, yB + 44, 20, { w: 900, col: 'rgba(255,255,255,.8)', max: B.w });
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(B.x, yB + 58, B.w, 5); g.fillStyle = '#e10600'; g.fillRect(B.x, yB + 58, B.w * f / Math.max(1, n), 5);
    for (const nm of shown) {
      const pa = ra.indexOf(nm), pb = rb.indexOf(nm), pos = pa + (pb - pa) * u; if (pos > shown.length - 0.3) continue;
      const pts = h[i0][nm] + (h[i1][nm] - h[i0][nm]) * u, yy = y0 + pos * rh, w = Math.max(6, wMax * pts / Math.max(top, maxP * Math.min(1, (f + 1) / n)));
      hlBox(g, B.x, yy, B.w, rh - 8, nm === me ? 'rgba(225,6,0,.25)' : 'rgba(10,12,16,.7)', 6);
      g.fillStyle = col(nm); g.globalAlpha = 0.92; g.fillRect(B.x, yy, w, rh - 8); g.globalAlpha = 1;
      g.save(); g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 5; vText(g, (pos < 0.5 ? '👑 ' : '') + short(nm), B.x + 12, yy + rh / 2 + 3, 22, { w: 900, max: B.w - 150 }); g.restore();
      vText(g, String(Math.round(pts)), B.x + B.w - 12, yy + rh / 2 + 4, 23, { w: 800, mono: true, al: 'right' });
    }
  } });
  // 3. manches en tête du championnat
  const ledR = Object.entries(F.led).sort((a, b) => b[1] - a[1]).slice(0, 4);
  segs.push({ dur: 5.5, cam: 'fly', dim: 0.5, say: () => ledR.length > 1 ? L(`${ledR[0][0]} a été en tête après ${ledR[0][1]} manches sur ${n}, ${ledR[1][0]} après ${ledR[1][1]}.`, `${ledR[0][0]} led after ${ledR[0][1]} of ${n} rounds, ${ledR[1][0]} after ${ledR[1][1]}.`) : L(`${ledR[0][0]} a été en tête après chacune des ${n} manches !`, `${ledR[0][0]} led after every one of the ${n} rounds!`), draw(g, B, lt) {
    const y = vHead(g, B, L(`Sur ${n} manches`, `Over ${n} rounds`), L('EN TÊTE DU CHAMPIONNAT', 'LEADING THE STANDINGS'));
    ledR.forEach(([nm, k], i) => { const yy = y + 10 + i * 150, a = vReveal(lt, i, ledR.length, 1.2); g.globalAlpha = a;
      hlBox(g, B.x, yy, B.w, 134, 'rgba(8,10,14,.86)', 12); g.fillStyle = col(nm); g.fillRect(B.x, yy, Math.max(10, B.w * k / n * a), 8); g.fillRect(B.x, yy, 10, 134);
      vText(g, nm, B.x + 30, yy + 64, 32, { w: 900, max: B.w - 200 });
      vText(g, String(k), B.x + B.w - 30, yy + 82, 66, { w: 900, mono: true, al: 'right' });
      vText(g, L('manches', 'rounds'), B.x + 30, yy + 104, 18, { w: 700, col: 'rgba(255,255,255,.65)' }); });
    g.globalAlpha = 1;
  } });
  // 4. le tournant
  const tu = F.turn, trd = tu && S.rounds[tu.i - 1], tc = trd && CIRCUITS.find(x => x.id === trd.id);
  if (tu && tc && Math.abs(tu.d) >= 8) {
    const gainer = tu.d > 0 ? c0 : c1, loser = tu.d > 0 ? c1 : c0, pts = Math.abs(tu.d), cr = carOf(gainer);
    segs.push({ dur: 5, cam: cr != null ? 'car' : 'fly', focus: cr ?? 0, focus2: T_ && cr != null ? cr + 1 : null, look: 10, dim: cr != null ? 0.12 : 0.4, e: 3, sayAt: 0.3,
      say: () => L(`Le tournant : ${inPlace(tc)}, ${gainer} reprend ${pts} points à ${loser} en une seule course !`, `The turning point: in ${tr(tc.name)}, ${gainer} gains ${pts} points on ${loser} in a single race!`), draw(g, B, lt) {
      const ch = 380, y = B.y + B.h - ch;
      hlBox(g, B.x, B.y + 70, 230, 42, '#e10600', 8);
      vText(g, L(`MANCHE ${tu.i} / ${S.rounds.length}`, `ROUND ${tu.i} / ${S.rounds.length}`), B.x + 115, B.y + 99, 20, { w: 900, al: 'center' });
      hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col(gainer); g.fillRect(B.x, y, 10, ch);
      vText(g, `${tc.flag} ${tr(tc.name).toUpperCase()}`, B.x + 34, y + 48, 22, { w: 900, col: '#e10600', max: B.w - 60 });
      vText(g, L('LE TOURNANT', 'THE TURNING POINT'), B.x + 34, y + 110, 52, { w: 900, max: B.w - 60 });
      vText(g, `${gainer}`, B.x + 34, y + 160, 28, { w: 800, max: B.w - 60 });
      g.globalAlpha = Math.max(0, Math.min(1, (lt - 0.5) / 0.3));
      vText(g, L(`+${pts} pts`, `+${pts} pts`), B.x + 34, y + 260, 80, { w: 900, mono: true, col: '#39ff88' });
      vText(g, L(`repris à ${loser}`, `gained on ${loser}`), B.x + 34, y + 310, 22, { w: 700, col: 'rgba(255,255,255,.75)', max: B.w - 60 });
      g.globalAlpha = 1;
    } });
  }
  // 5. l'écart entre les deux premiers, manche après manche (au-dessus : le champion devant)
  const gaps = h.map(x => x[c0] - x[c1]), gMax = Math.max(10, ...gaps.map(Math.abs));
  segs.push({ dur: 8, cam: 'fly', dim: 0.66, say: () => L(`L'écart entre ${c0} et ${c1}, manche après manche : ${F.margin} points à l'arrivée.`, `The gap between ${c0} and ${c1}, round by round: ${F.margin} points at the end.`), draw(g, B, lt, sg) {
    const y0 = vHead(g, B, `${short(c0)} – ${short(c1)}`, L('L’ÉCART', 'THE GAP'));
    const x0 = B.x + 60, x1 = B.x + B.w - 20, yT = y0 + 40, yB = B.y + B.h - 80, ym = (yT + yB) / 2, X = i => x0 + i / n * (x1 - x0), Y = v => ym - v / gMax * (yB - yT) / 2;
    const prog = clamp((lt - 0.4) / Math.max(1, sg.dur - 2.2), 0, 1) * n;
    g.fillStyle = col(c0); g.globalAlpha = 0.12; g.fillRect(x0, yT, x1 - x0, ym - yT); g.fillStyle = col(c1); g.fillRect(x0, ym, x1 - x0, yB - ym); g.globalAlpha = 1;
    vText(g, L(`${short(c0)} devant`, `${short(c0)} ahead`).toUpperCase(), x0 + 10, yT + 28, 18, { w: 900, col: col(c0) });
    vText(g, L(`${short(c1)} devant`, `${short(c1)} ahead`).toUpperCase(), x0 + 10, yB - 14, 18, { w: 900, col: col(c1) });
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, ym); g.lineTo(x1, ym); g.stroke();
    vText(g, '0', x0 - 10, ym + 6, 16, { w: 700, mono: true, al: 'right', col: 'rgba(255,255,255,.6)' });
    vText(g, `+${Math.round(gMax)}`, x0 - 10, yT + 6, 16, { w: 700, mono: true, al: 'right', col: 'rgba(255,255,255,.6)' });
    vText(g, `+${Math.round(gMax)}`, x0 - 10, yB + 6, 16, { w: 700, mono: true, al: 'right', col: 'rgba(255,255,255,.6)' });
    const i0 = Math.floor(prog), pts = [];
    for (let i = 0; i <= Math.min(i0, n); i++) pts.push([X(i), Y(gaps[i])]);
    if (i0 < n) pts.push([X(prog), Y(gaps[i0] + (gaps[i0 + 1] - gaps[i0]) * (prog - i0))]);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    const hd = pts[pts.length - 1], v = Math.round((ym - hd[1]) / ((yB - yT) / 2) * gMax);
    g.fillStyle = v >= 0 ? col(c0) : col(c1); g.beginPath(); g.arc(hd[0], hd[1], 11, 0, 7); g.fill();
    vText(g, `${v > 0 ? '+' : ''}${v}`, Math.min(hd[0], x1 - 60), hd[1] - 22, 28, { w: 900, mono: true, al: 'center' });
  } });
  // 6. podium final
  const pod = F.fin.slice(0, 3);
  segs.push({ dur: 5.5, cam: 'gridwide', dim: 0.55, say: () => L(`Le podium final : ${pod[0]}, ${pod[1]} et ${pod[2]}.`, `The final podium: ${pod[0]}, ${pod[1]} and ${pod[2]}.`), draw(g, B, lt) {
    const y = vHead(g, B, L(`Championnat ${T_ ? 'des écuries' : 'pilotes'} ${year}`, `${year} ${T_ ? 'teams' : 'drivers'}’ championship`), L('LE PODIUM', 'THE PODIUM'));
    const order = [1, 0, 2], hs = [400, 300, 230], w = (B.w - 24) / 3, base = B.y + B.h - 40;
    order.forEach((p, j) => { const nm = pod[p]; if (!nm) return; const x = B.x + j * (w + 12), hh = hs[p] * Math.min(1, vReveal(lt, 2 - p, 3, 1.6) * 1.1);
      g.fillStyle = col(nm); g.globalAlpha = 0.9; g.fillRect(x, base - hh, w, hh); g.globalAlpha = 1;
      vText(g, String(p + 1), x + w / 2, base - hh + 70, 64, { w: 900, mono: true, al: 'center' });
      if (hh > 120) { vWrap(g, short(nm).toUpperCase(), x + w / 2, base - hh - 50, 22, w - 6, { al: 'center' }); vText(g, `${h[n][nm]} pts`, x + w / 2, base - 24, 22, { w: 800, mono: true, al: 'center' }); } });
  } });
  // 7. le champion
  const cc = carOf(c0), mine = !T_ && c0 === me, w0 = F.wins[n][c0];
  segs.push({ dur: 6.5, cam: T_ ? 'car' : 'pole', focus: cc ?? 0, focus2: T_ && cc != null ? cc + 1 : null, look: 10, dim: 0.12, must: true, e: 3,
    say: () => mine ? L(`Champion du monde ${year} : c'est toi !`, `${year} world champion: it's you!`) : L(`${c0}, champion ${T_ ? 'du monde des écuries' : 'du monde'} ${year} : ${h[n][c0]} points et ${w0} victoires !`, `${c0}, ${year} ${T_ ? 'teams\' ' : ''}world champion: ${h[n][c0]} points and ${w0} wins!`), draw(g, B, lt) {
    const ch = 330, y = B.y + B.h - ch, p = Math.min(1, lt / 0.3);
    hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col(c0); g.fillRect(B.x, y, 10, ch);
    vText(g, T_ ? L(`🏆 CHAMPION ÉCURIES ${year}`, `🏆 ${year} TEAMS’ CHAMPION`) : L(`🏆 CHAMPION DU MONDE ${year}`, `🏆 ${year} WORLD CHAMPION`), B.x + 34, y + 52, 26, { w: 900, col: '#ffcc33', max: B.w - 60 });
    g.save(); g.translate(B.x + 34, y + 126); g.scale(1.2 - 0.2 * p, 1.2 - 0.2 * p); vText(g, c0.toUpperCase(), 0, 0, T_ ? 46 : 58, { w: 900, max: B.w - 70 }); g.restore();
    const st = [[h[n][c0], L('points', 'points')], [w0, L('victoires', 'wins')], [F.led[c0] || 0, L('manches en tête', 'rounds led')]], w = (B.w - 68 - 20) / 3;
    st.forEach(([v, l], i) => { const x = B.x + 34 + i * (w + 10); g.globalAlpha = vReveal(lt, i, 3, 1);
      hlBox(g, x, y + 160, w, 140, 'rgba(255,255,255,.07)', 10);
      vText(g, String(v), x + w / 2, y + 245, 50, { w: 900, mono: true, al: 'center' });
      vText(g, l.toUpperCase(), x + w / 2, y + 280, 15, { w: 800, al: 'center', col: 'rgba(255,255,255,.7)', max: w - 8 }); });
    g.globalAlpha = 1;
  } });
  segs.push({ dur: 4, cam: 'fly', dim: 0.55, say: () => L(`Qui détrônera ${c0} en ${year + 1} ? Dis-le en commentaire !`, `Who will dethrone ${c0} in ${year + 1}? Tell me in the comments!`), draw(g, B) {
    vText(g, L('ET EN', 'AND IN'), B.x + B.w / 2, B.y + B.h * 0.36, 26, { w: 900, col: '#e10600', al: 'center' });
    vText(g, String(year + 1), B.x + B.w / 2, B.y + B.h * 0.36 + 110, 120, { w: 900, mono: true, al: 'center' });
    vWrap(g, L(`Qui détrônera ${c0} ?`, `Who will dethrone ${c0}?`), B.x + B.w / 2, B.y + B.h * 0.36 + 190, 34, B.w - 40, { al: 'center' });
    vText(g, L('Abonne-toi pour la suite', 'Follow for what comes next'), B.x + B.w / 2, B.y + B.h - 30, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.7)', max: B.w });
  } });
  return vFit(segs, 65);
}
/* ---- 7. les exploits de la saison (fin de saison) : victoires, podiums (et grosses remontées) avec une voiture peu performante ----
   rang de la voiture = classement des écuries à l'écart au plus rapide avant le GP (graphique Évolutions) ;
   place « attendue » d'un pilote = 2 × rang − 0,5 (deux voitures par écurie) ; l'exploit = places gagnées sur cette attente */
const ordF = (n, fem) => n === 1 ? (fem ? '1re' : '1er') : n + 'e';
const ordE = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function exploitFacts(S) {
  const hist = devHistory(), n = S.rounds.filter(rd => rd.result).length, xs = [], per = {};
  for (let i = 0; i < n; i++) {
    const h = hist[Math.min(i, hist.length - 1)];
    if (Math.max(0, ...Object.values(h)) < 0.12) continue;   // voitures quasi égales (début de première saison) : pas d'exploit mesurable
    S.rounds[i].result.forEach((r, k) => {
      if (!(r.team in h)) return;
      const car = 1 + Object.keys(h).filter(t => h[t] < h[r.team] - 0.02).length;
      const p = per[r.name] || (per[r.name] = { name: r.name, team: r.team, sum: 0, n: 0, best: null });
      if (r.dnf) return;
      const pos = k + 1, over = 2 * car - 0.5 - pos;
      p.sum += over; p.n++; p.team = r.team;
      const x = { i, name: r.name, team: r.team, pos, car, over, gap: h[r.team], score: over + (pos === 1 ? 6 : pos <= 3 ? 3 : 0) };
      if (!p.best || x.score > p.best.score) p.best = x;
      if ((pos <= 3 && car >= 3 && over >= 3) || (pos <= 6 && over >= 6)) xs.push(x);
    });
  }
  // un exploit par pilote au plus dans le top (le plus fort), cinq au total
  const top = [], seen = new Set();
  for (const x of xs.sort((a, b) => b.score - a.score)) { if (seen.has(x.name)) continue; seen.add(x.name); top.push(x); if (top.length >= 5) break; }
  const kings = Object.values(per).filter(p => p.n >= Math.max(3, n * 0.4)).map(p => Object.assign(p, { avg: p.sum / p.n })).sort((a, b) => b.avg - a.avg);
  return { n, top, kings, all: xs };
}
function vidExploitSegs(S, carOf) {
  const F = exploitFacts(S), segs = [], year = S.year || career().year, base = careerBase();
  const colT = name => { const t = base.find(x => x.name === name); return t ? t.tv || t.color : '#888'; };
  const num = x => x.toFixed(1).replace('.', L(',', '.')), what = x => x.pos === 1 ? L('Victoire', 'Win') : x.pos <= 3 ? L(`Podium (P${x.pos})`, `Podium (P${x.pos})`) : `P${x.pos}`;
  const carTxt = x => L(`la ${ordF(x.car, true)} voiture la plus rapide`, `the ${ordE(x.car)} fastest car`);
  const best = F.top[0], king = F.kings[0];
  // 1. accroche
  const hook = best ? (best.pos === 1 ? L(`VICTOIRE AVEC LA ${ordF(best.car, true).toUpperCase()} VOITURE`, `A WIN WITH THE ${ordE(best.car).toUpperCase()} FASTEST CAR`) : L(`PODIUM AVEC LA ${ordF(best.car, true).toUpperCase()} VOITURE`, `A PODIUM WITH THE ${ordE(best.car).toUpperCase()} FASTEST CAR`)) : L('PLUS FORTS QUE LEUR VOITURE', 'BETTER THAN THEIR CARS');
  segs.push({ dur: 3.6, cam: 'fly', dim: 0.5, must: true, e: 3, say: () => best ? L(`${what(best)} avec seulement ${carTxt(best)} ! Voici les exploits de la saison ${year}.`, `${what(best)} with only ${carTxt(best)}! Here are the giant-killing drives of ${year}.`) : L(`Ces pilotes ont fait mieux que leur voiture en ${year} !`, `These drivers outperformed their cars in ${year}!`), draw(g, B, lt) {
    const p = Math.min(1, lt / 0.25), y = B.y + B.h * 0.36;
    vText(g, L(`LES EXPLOITS ${year}`, `${year} GIANT-KILLERS`), B.x + B.w / 2, y - 40, 26, { w: 900, col: '#e10600', al: 'center' });
    g.save(); g.translate(B.x + B.w / 2, y); g.scale(1.25 - 0.25 * p, 1.25 - 0.25 * p); vWrap(g, hook, 0, 70, 70, B.w - 20, { al: 'center' }); g.restore();
  } });
  // 2. le principe
  segs.push({ dur: 4, cam: 'fly', dim: 0.5, say: () => L(`Le principe : on compare la place de chaque pilote à la vitesse de sa voiture ce jour-là.`, `The idea: compare each driver's result with how fast their car was that day.`), draw(g, B, lt) {
    const y = vHead(g, B, L('Le principe', 'How it works'), L('PLUS FORT QUE SA VOITURE', 'BEATING THE CAR'));
    [[L('VOITURE', 'CAR'), L('rang de la voiture à l’écart au plus rapide, avant le GP', 'car rank on pace, before the GP'), '#7d8596'], [L('ARRIVÉE', 'FINISH'), L('la place obtenue par le pilote', 'where the driver finished'), '#39ff88']].forEach(([k, d, c], j) => {
      const yy = y + 20 + j * 190; g.globalAlpha = vReveal(lt, j, 2, 1.2);
      hlBox(g, B.x, yy, B.w, 170, 'rgba(8,10,14,.86)', 12); g.fillStyle = c; g.fillRect(B.x, yy, 10, 170);
      vText(g, k, B.x + 34, yy + 70, 46, { w: 900, col: c });
      vWrap(g, d, B.x + 34, yy + 116, 22, B.w - 70, { w: 700, col: 'rgba(255,255,255,.8)' }); });
    g.globalAlpha = 1;
  } });
  // 3. le top des exploits, du 5e au 1er (caméra sur la voiture du pilote)
  F.top.slice().reverse().forEach((x, k, arr) => {
    const rk = arr.length - k, rd = S.rounds[x.i], c = CIRCUITS.find(y => y.id === rd.id), cr = carOf(x.name);
    segs.push({ dur: 5, cam: k % 2 === 0 && cr != null ? 'car' : 'fly', focus: cr ?? 0, focus2: null, look: 10, dim: k % 2 === 0 && cr != null ? 0.12 : 0.4, e: rk <= 2 ? 3 : 2, sayAt: 0.3, must: rk === 1,
      say: () => L(`Numéro ${rk} : ${inPlace(c)}, ${x.name} décroche ${x.pos === 1 ? 'la victoire' : x.pos <= 3 ? `un podium, ${ordF(x.pos)}` : `la ${ordF(x.pos, true)} place`}, avec ${carTxt(x)} !`, `Number ${rk}: in ${tr(c.name)}, ${x.name} ${x.pos === 1 ? 'wins' : x.pos <= 3 ? `takes a podium in P${x.pos}` : `finishes P${x.pos}`} with ${carTxt(x)}!`),
      draw(g, B, lt) {
        const ch = 440, y = B.y + B.h - ch, col = colT(x.team);
        hlBox(g, B.x, B.y + 70, 120, 64, '#e10600', 10);
        vText(g, `#${rk}`, B.x + 60, B.y + 118, 46, { w: 900, mono: true, al: 'center' });
        vText(g, L(`MANCHE ${x.i + 1} · `, `ROUND ${x.i + 1} · `) + `${c.flag} ${tr(c.name).toUpperCase()}`, B.x + 136, B.y + 112, 20, { w: 900, max: B.w - 140 });
        hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col; g.fillRect(B.x, y, 10, ch);
        vText(g, x.name.toUpperCase(), B.x + 34, y + 64, 44, { w: 900, max: B.w - 60 });
        vText(g, x.team, B.x + 34, y + 100, 22, { w: 700, col: 'rgba(255,255,255,.75)', max: B.w - 60 });
        // voiture n°X → arrivée PY
        const w = (B.w - 68 - 70) / 2, yy = y + 140;
        hlBox(g, B.x + 34, yy, w, 200, 'rgba(255,255,255,.06)', 12);
        vText(g, L('VOITURE', 'CAR'), B.x + 34 + w / 2, yy + 40, 18, { w: 900, al: 'center', col: 'rgba(255,255,255,.6)' });
        vText(g, `${x.car}${L('e', ordE(x.car).slice(-2))}`, B.x + 34 + w / 2, yy + 128, 86, { w: 900, mono: true, al: 'center', col: '#9aa3b5' });
        vText(g, x.gap < 0.005 ? L('la plus rapide', 'fastest') : `+${x.gap.toFixed(2).replace('.', L(',', '.'))} s`, B.x + 34 + w / 2, yy + 176, 20, { w: 800, mono: true, al: 'center', col: 'rgba(255,255,255,.65)' });
        vText(g, '→', B.x + 34 + w + 35, yy + 118, 52, { w: 900, al: 'center', col: '#e10600' });
        const a = Math.max(0, Math.min(1, (lt - 0.6) / 0.3)); g.globalAlpha = a;
        const x2 = B.x + 34 + w + 70; hlBox(g, x2, yy, w, 200, 'rgba(57,255,136,.12)', 12);
        vText(g, L('ARRIVÉE', 'FINISH'), x2 + w / 2, yy + 40, 18, { w: 900, al: 'center', col: '#39ff88' });
        g.save(); g.translate(x2 + w / 2, yy + 128); const s = 1 + 0.3 * Math.max(0, 1 - (lt - 0.6) / 0.25); g.scale(s, s);
        vText(g, `P${x.pos}`, 0, 0, 86, { w: 900, mono: true, al: 'center', col: '#39ff88' }); g.restore();
        vText(g, x.pos === 1 ? L('VICTOIRE', 'WIN') : x.pos <= 3 ? L('PODIUM', 'PODIUM') : L('DANS LES POINTS', 'IN THE POINTS'), x2 + w / 2, yy + 176, 20, { w: 900, al: 'center', col: '#39ff88' });
        vText(g, L(`+${Math.round(x.over)} places sur sa voiture`, `+${Math.round(x.over)} places above the car`), B.x + 34, y + ch - 40, 30, { w: 900, col: '#ffcc33', max: B.w - 60 });
        g.globalAlpha = 1;
      } });
  });
  // 4. le roi de l'exploit (en pole de la grille : caméra sur sa voiture)
  if (king) segs.push({ dur: 6, cam: 'pole', focus: carOf(king.name) ?? 0, dim: 0.12, must: true, e: 3,
    say: () => L(`Et le roi de l'exploit ${year} : ${king.name} ! En moyenne, ${num(king.avg)} places de mieux que sa voiture à chaque course.`, `And the ${year} king of overachievers: ${king.name}! On average, ${num(king.avg)} places better than the car, every race.`), draw(g, B, lt) {
    const ch = 330, y = B.y + B.h - ch, col = colT(king.team), p = Math.min(1, lt / 0.3);
    hlBox(g, B.x, y, B.w, ch, 'rgba(8,10,14,.88)', 14); g.fillStyle = col; g.fillRect(B.x, y, 10, ch);
    vText(g, L('👑 LE ROI DE L’EXPLOIT', '👑 KING OF OVERACHIEVERS'), B.x + 34, y + 52, 26, { w: 900, col: '#ffcc33', max: B.w - 60 });
    g.save(); g.translate(B.x + 34, y + 122); g.scale(1.2 - 0.2 * p, 1.2 - 0.2 * p); vText(g, king.name.toUpperCase(), 0, 0, 52, { w: 900, max: B.w - 70 }); g.restore();
    vText(g, king.team, B.x + 34, y + 160, 22, { w: 700, col: 'rgba(255,255,255,.75)', max: B.w - 60 });
    g.globalAlpha = Math.max(0, Math.min(1, (lt - 0.6) / 0.3));
    vText(g, `+${num(king.avg)}`, B.x + 34, y + 270, 84, { w: 900, mono: true, col: '#39ff88' });
    vText(g, L('places / course', 'places / race'), B.x + 34 + g.measureText(`+${num(king.avg)}`).width + 16, y + 270, 24, { w: 800, col: 'rgba(255,255,255,.8)' });
    g.globalAlpha = 1;
  } });
  // 5. ceux qui ont le plus tiré de leur voiture
  const rows = F.kings.slice(0, 8);
  if (rows.length) segs.push({ dur: 6.5, cam: 'gridwide', dim: 0.55, say: () => rows.length > 2 ? L(`Derrière, ${rows[1].name} et ${rows[2].name} ont eux aussi fait mieux que leur voiture.`, `Behind, ${rows[1].name} and ${rows[2].name} also beat their machinery.`) : '', draw(g, B, lt) {
    const y = vHead(g, B, L('Places gagnées sur la voiture, par course', 'Places above the car, per race'), L('PLUS FORTS QUE LEUR VOITURE', 'BETTER THAN THEIR CARS')), rh = Math.min(78, (B.y + B.h - y) / rows.length);
    rows.forEach((p, i) => { g.globalAlpha = vReveal(lt, rows.length - 1 - i, rows.length, 2.5); vRow(g, B, y + i * rh, rh, i + 1, colT(p.team), p.name, p.team, `${p.avg >= 0 ? '+' : ''}${num(p.avg)}`, { rw: 100, size: 24, rcol: p.avg > 0 ? '#39ff88' : '#ff6b6b' }); });
    g.globalAlpha = 1;
  } });
  // 6. fin
  segs.push({ dur: 4, cam: 'fly', dim: 0.55, say: () => L(`Quel exploit t'a le plus marqué ? Dis-le en commentaire !`, `Which drive impressed you most? Tell me in the comments!`), draw(g, B) {
    vWrap(g, L('QUEL EXPLOIT T’A LE PLUS MARQUÉ ?', 'WHICH DRIVE WAS THE BEST?'), B.x + B.w / 2, B.y + B.h * 0.4, 58, B.w - 30, { al: 'center' });
    vText(g, L('Dis-le en commentaire 👇', 'Tell me in the comments 👇'), B.x + B.w / 2, B.y + B.h * 0.4 + 200, 30, { w: 800, al: 'center', col: '#ffcc33', max: B.w });
    vText(g, L('Abonne-toi pour la suite', 'Follow for what comes next'), B.x + B.w / 2, B.y + B.h - 30, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.7)', max: B.w });
  } });
  return vFit(segs, 60);
}
/* ---- extraits de course dans les vidéos : la scène bascule sur le circuit de la manche et rejoue l'enregistrement ---- */
function vidRender() { renderer.setPixelRatio(1); renderer.setSize(HL_W, HL_H, false); camera.aspect = HL_W / HL_H; BASE_FOV = camera.fov = 60; camera.updateProjectionMatrix(); }
function vidClipEnter(cl) {
  const ci = CIRCUITS.findIndex(c => c.id === cl.circ); if (ci < 0) return;
  ST.circuit = ci; T = getTrack(ci);
  R = SIM.createRace(T, cl.entries, { laps: cl.laps, weather: 'dry', chaos: 1 });
  R.over = true; R.resultsShown = true; R.vid = true; R.rec = { frames: cl.frames }; R.events = [];
  RP.saved = { finishOrder: cl.fin || [], finishedAt: 0 }; RP.evIdx = 0; RP.t = cl.frames[0].t;
  buildScene(); buildTower(); buildLabels(); vidRender();
  follow = cl.focus; camMode = cl.cam || 'tv'; FIX.lock = false; camInit = false; VID.lastCam = 'clip';
  applyReplay();
}
/* à chaque image : entrée dans un extrait, puis avance de l'enregistrement (la fin de l'extrait tombe sur la fin de la séquence) */
function vidClipTick() {
  const sg = vidSeg(); if (!sg) return;
  if (sg !== VID.cur) { VID.cur = sg; if (sg.clip) vidClipEnter(sg.clip); }
  if (!sg.clip || !R || !R.rec) return;
  const cl = sg.clip, f0 = cl.frames[0].t, start = Math.max(f0, cl.t1 - sg.dur);
  RP.t = Math.min(cl.frames[cl.frames.length - 1].t, start + (VID.t - sg.t0)); applyReplay();
}
const cap1 = x => x ? x[0].toUpperCase() + x.slice(1) : x;
/* mini classement des extraits (à gauche) : 2 voitures devant, le pilote, 2 derrière ; écart sur la voiture qui précède (distance / vitesse) */
function vClipTower(g, B, fid, ft) {
  if (!R || !R.ranked) return;
  const lead = ft ? Math.min(...ft.ft.filter(x => x > 0)) : 0;
  const all = R.ranked.filter(o => o.state !== 'out'), me = all.findIndex(o => o.id === fid); if (me < 0) return;
  const i0 = clamp(me - 2, 0, Math.max(0, all.length - 5)), list = all.slice(i0, i0 + 5), x = B.x, y0 = B.y + 150, w = 210, rh = 40;
  hlBox(g, x, y0 - 30, w, 30 + list.length * rh + 6, 'rgba(10,12,16,.78)', 8);
  g.fillStyle = '#e10600'; g.fillRect(x, y0 - 30, w, 28);
  vText(g, L('CLASSEMENT', 'STANDINGS'), x + 10, y0 - 9, 15, { w: 900 }); vText(g, ft ? L('AU 1ER', 'TO P1') : L('ÉCART', 'GAP'), x + w - 10, y0 - 9, 13, { w: 800, al: 'right', col: 'rgba(255,255,255,.85)' });
  list.forEach((o, k) => {
    const y = y0 + k * rh, m = y + rh / 2, hi = o.id === fid, prev = all[i0 + k - 1];
    if (hi) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y + 2, w, rh - 2); }
    vText(g, String(i0 + k + 1), x + 32, m + 7, 19, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.8)' });
    g.fillStyle = tcol(o); g.fillRect(x + 40, y + 7, 5, rh - 12);
    vText(g, o.code, x + 54, m + 8, 21, { w: hi ? 900 : 700, max: 70 });
    const fx = ft && ft.ft[o.id] > 0 ? ft.ft[o.id] : 0, down = ft && ft.fl[o.id] ? ft.laps - ft.fl[o.id] : 0;
    const gap = ft ? (!fx ? '' : down > 0 ? `+${down} ${L('T', 'L')}` : fx - lead < 0.05 ? L('1ER', 'WIN') : '+' + (fx - lead).toFixed(1).replace('.', L(',', '.')))
      : o.state === 'pit' ? L('STAND', 'PIT') : i0 + k === 0 ? L('TÊTE', 'LEAD') : prev ? '+' + Math.max(0, (prev.dist - o.dist) / Math.max(20, o.v)).toFixed(1).replace('.', L(',', '.')) : '';
    vText(g, gap, x + w - 10, m + 7, 17, { w: 700, mono: true, al: 'right', col: o.state === 'pit' ? '#39c7ff' : '#fff' });
  });
}
/* ---- 8. la saison d'un pilote (fin de saison), épisode d'environ 1 min 35 sans voix (montage TikTok) : accroche en images rapides,
   niveau de la voiture sur la saison (fixe l'objectif) comparé au classement des constructeurs, la saison course par course
   (2 s par GP, résultat en gros, courbe des points avec 2 concurrents), duel interne, verdict, puis la place du prochain épisode ---- */
async function vidDriverStart(name) {
  const k = career(); if (!k || !name) return;
  $('#ch-pvid').disabled = true;
  const b = $('#ch-pvid'), lbl = b.textContent; b.textContent = L('Préparation des extraits…', 'Preparing clips…');
  let packs = []; try { packs = await seasonClipsLoad(k); } catch (e) { packs = []; }
  try { await seasonClipsFromReplays(k, packs); } catch (e) { /* replays illisibles : on fait sans */ }
  b.textContent = lbl;
  $('#ch-pvid').disabled = false;
  VID.pre = { name, packs };
  vidStart('driver');
}
function vidDriverSegs(S, nm, packs) {
  const segs = [], year = S.year || career().year, n = S.rounds.filter(rd => rd.result).length, { sortD, sortT } = standings();
  const D = sortD.find(d => d.name === nm), pos = sortD.indexOf(D) + 1, base = careerBase(), teams = champTeams();
  const team = base.find(t => t.name === D.team) || {}, col = team.tv || team.color || '#e10600', mate = (team.drivers || []).map(d => d.name).find(x => x !== nm);
  const short = lastName(nm), cap = x => x[0].toUpperCase() + x.slice(1), sec = x => x.toFixed(2).replace('.', L(',', '.'));
  const res = S.rounds.slice(0, n).map((rd, i) => { const k = rd.result.findIndex(r => r.name === nm), r = rd.result[k]; return r ? { i, pos: k + 1, dnf: r.dnf, why: r.why, pts: r.pts, grid: r.grid, c: CIRCUITS.find(x => x.id === rd.id) } : { i, pos: 99, dnf: true, pts: 0, c: CIRCUITS.find(x => x.id === rd.id) }; });
  const { items, hist } = ptsHistory('d', S), names = items.map(x => x.name), cpos = hist.slice(1).map(h => names.slice().sort((a, b) => h[b] - h[a]).indexOf(nm) + 1);
  // niveau de la voiture sur toute la saison : écart moyen au plus rapide (avant chaque GP) de chaque écurie ; c'est lui qui fixe l'objectif
  const dh = devHistory(), tn = Object.keys(dh[0] || {}), nh = Math.max(1, dh.length);
  const avg = Object.fromEntries(tn.map(t => [t, dh.reduce((a, h) => a + (h[t] || 0), 0) / nh])), best0 = Math.min(...tn.map(t => avg[t]));
  tn.forEach(t => { avg[t] -= best0; });   // référence = la meilleure voiture en moyenne
  const carOrder = tn.slice().sort((a, b) => avg[a] - avg[b]), rankT = t => 1 + tn.filter(x => avg[x] < avg[t] - 0.02).length;
  const rCar = rankT(D.team), carEq = Math.max(0, ...tn.map(t => avg[t])) < 0.12, cRank = sortT.findIndex(t => t.name === D.team) + 1, nTeams = tn.length || 11;
  const skills = base.flatMap(t => t.drivers.map(d => [d.name, +d.skill])).sort((a, b) => b[1] - a[1]), drvRank = skills.findIndex(x => x[0] === nm) + 1 || 11;
  const equalD = skills.length > 1 && skills[0][1] - skills[skills.length - 1][1] < 1.5, allEq = carEq && equalD;
  const lvl = allEq ? 7 : carEq ? (drvRank <= 1 ? 1 : drvRank <= 3 ? 2 : drvRank <= 7 ? 4 : drvRank <= 13 ? 7 : 9) : rCar;
  const OBJ = lvl <= 1 ? [L('le titre', 'the title'), p => p === 1, L('champion', 'champion')] : lvl <= 2 ? [L('jouer le titre (top 2)', 'fight for the title (top 2)'), p => p <= 2, 'top 2'] : lvl <= 4 ? [L('le top 5', 'the top 5'), p => p <= 5, 'top 5'] : lvl <= 7 ? [L('le top 10', 'the top 10'), p => p <= 10, 'top 10'] : [L('marquer des points', 'score points'), () => D.pts > 0, L('des points', 'points')];
  const objOk = OBJ[1](pos), expP = carEq ? null : Math.round(2 * rCar - 0.5), dnfs = res.filter(r => r.dnf).length;
  // extraits de ce pilote
  const cand = [], entOf = pk => { const e = pk.names.map(x => { const t = teams.find(y => y.drivers.some(d => d.name === x)); return t && { team: t, driver: t.drivers.find(d => d.name === x) }; }); return e.some(x => !x) ? null : e; };
  packs.forEach((pk, i) => {
    if (!pk || i >= n) return;
    const k = pk.names.indexOf(nm), entries = k >= 0 && entOf(pk); if (!entries) return;
    for (const cl of pk.clips) {
      if (cl.focus !== k) continue;
      const clip = { circ: pk.circ, laps: pk.laps, entries, frames: cl.frames, fin: pk.fin, focus: k, cam: 'tv' };
      if (cl.kind === 'finish') cand.push({ i, clip, act: cl.t1 - 1.5, score: [0, 100, 70, 60][cl.other] || 50 });
      else if (cl.kind === 'ot') { if (otOk(cl.frames, k, cl.other.b, cl.t0 + 5)) cand.push({ i, clip, act: cl.t0 + 5, score: 50 }); }
      else if (cl.kind === 'out') cand.push({ i, clip: Object.assign(clip, { cam: 'heli' }), act: cl.t0 + 5, score: 45 });
    }
  });
  // 1. accroche : plein d'images rapides de sa saison, avec la phrase qui accroche par-dessus (pas de titre d'épisode)
  const early = cpos[Math.min(3, n - 1)], peak = Math.min(...cpos), peakR = cpos.indexOf(peak);
  let hookA, hookB;
  if (pos === 1) { const alw = cpos.every(p => p === 1); hookA = L(`Champion du monde ${year}…`, `${year} world champion…`); hookB = alw ? L('une saison de patron', 'a season of total control') : L('mais le titre a failli lui échapper', 'but the title nearly slipped away'); }
  else if (peak <= 3 && pos - peak >= 3) { hookA = L(`${peak === 1 ? '1er' : peak + 'e'} du championnat après ${peakR + 1} manche${peakR ? 's' : ''}…`, `${ordE(peak)} in the standings after ${peakR + 1} round${peakR ? 's' : ''}…`); hookB = L('et pourtant, tout va basculer', 'and yet, it all fell apart'); }
  else if (early - pos >= 5 && pos <= 10) { hookA = L(`${early}e après ${Math.min(4, n)} courses…`, `${ordE(early)} after ${Math.min(4, n)} races…`); hookB = L('personne n’imaginait la suite', 'nobody saw what came next'); }
  else if (expP != null && expP - pos >= 3) { hookA = L(`Avec la ${rCar}e voiture du plateau…`, `With the ${ordE(rCar)} fastest car…`); hookB = L('des miracles', 'pure miracles'); }
  else if (expP != null && pos - expP >= 3) { hookA = L(`Une voiture taillée pour le top ${Math.max(3, expP)}…`, `A car built for the top ${Math.max(3, expP)}…`); hookB = L('une saison cauchemar', 'a nightmare season'); }
  else if (dnfs >= 4) { hookA = L(`${dnfs} abandons en ${n} courses…`, `${dnfs} DNFs in ${n} races…`); hookB = L('une saison maudite ?', 'a cursed season?'); }
  else { hookA = L(`Sa saison ${year} en 90 secondes…`, `The ${year} season in 90 seconds…`); hookB = L('accroche-toi', 'hold on tight'); }
  const lineClip = res.map((r, i) => {
    const pk = packs[i]; if (!pk || !pk.names) return null;
    const k = pk.names.indexOf(nm), entries = k >= 0 && entOf(pk); if (!entries) return null;
    const cl = pk.clips.find(c => c.focus === k && (r.dnf ? c.kind === 'out' : c.kind === 'line')) || (!r.dnf && pk.clips.find(c => c.focus === k && c.kind === 'finish'));
    if (!cl) return null;
    const tEnd = cl.kind === 'out' ? cl.t0 + 5.5 : cl.kind === 'finish' ? cl.t1 - 0.9 : cl.t1;
    return { circ: pk.circ, laps: pk.laps, entries, frames: cl.frames, fin: pk.fin, focus: k, t0: tEnd - 2, t1: tEnd, cam: r.dnf ? 'heli' : 'tv', ft: pk.ft && !r.dnf ? { ft: pk.ft, fl: pk.fl, laps: pk.laps } : null };
  });
  const cuts = [], usedR = new Set();
  for (const m of cand.slice().sort((a, b) => b.score - a.score)) { if (usedR.has(m.i) || cuts.length >= 8) continue; usedR.add(m.i); cuts.push({ i: m.i, clip: Object.assign({}, m.clip, { t0: m.act - 0.4, t1: m.act + 0.15 }) }); }
  for (const r of res.filter(r => !r.dnf).sort((a, b) => a.pos - b.pos)) { if (cuts.length >= 8) break; const lc = lineClip[r.i]; if (!lc || usedR.has(r.i)) continue; usedR.add(r.i); cuts.push({ i: r.i, clip: Object.assign({}, lc, { t1: lc.t1 - 0.5 }) }); }
  const hookDraw = (g, B) => {
    const ht = VID.t, p = Math.min(1, ht / 0.25);
    g.save(); g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 16;
    g.translate(B.x + B.w / 2, B.y + 200); g.scale(1.25 - 0.25 * p, 1.25 - 0.25 * p); const y2 = vWrap(g, nm.toUpperCase(), 0, 0, 76, B.w - 20, { al: 'center' }); g.restore();
    g.save(); g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 14;
    g.globalAlpha = Math.max(0, Math.min(1, (ht - 0.5) / 0.2)); const y3 = vWrap(g, hookA, B.x + B.w / 2, B.y + 225 + y2, 38, B.w - 30, { al: 'center' });
    const pb = Math.max(0, Math.min(1, (ht - 1.6) / 0.15)); g.globalAlpha = pb; g.translate(B.x + B.w / 2, y3 + 34); g.scale(1.3 - 0.3 * pb, 1.3 - 0.3 * pb);
    vWrap(g, hookB.toUpperCase(), 0, 0, 50, B.w - 30, { al: 'center', col: '#ffcc33' }); g.restore();
  };
  if (cuts.length >= 3) cuts.slice(0, 8).sort(() => Math.random() - 0.5).forEach(c => segs.push({ dur: 0.45, fixed: true, flashCut: true, noFade: true, cam: 'clip', dim: 0.15, clip: c.clip, draw: hookDraw }));
  else segs.push({ dur: 3.6, fixed: true, noFade: true, cam: 'fly', dim: 0.5, draw: hookDraw });
  // 2. le niveau de la voiture sur la saison, comparé au classement des constructeurs : il fixe l'objectif
  segs.push({ dur: 7.5, cam: 'fly', dim: 0.66, draw(g, B, lt) {
    const y = vHead(g, B, L('Écart moyen au plus rapide sur la saison', 'Average gap to the fastest car'), L('LE NIVEAU DE LA VOITURE', 'HOW GOOD WAS THE CAR?'));
    const rh = Math.min(44, (B.h - (y - B.y) - 200) / Math.max(1, carOrder.length)), mx = Math.max(0.2, ...carOrder.map(t => avg[t]));
    vText(g, L('CONSTR.', 'TEAMS'), B.x + B.w - 6, y - 6, 13, { w: 800, al: 'right', col: 'rgba(255,255,255,.6)' });
    carOrder.forEach((t, k) => { const me = t === D.team, yy = y + k * rh, a = vReveal(lt, k, carOrder.length, 1.6), tc = (base.find(x => x.name === t) || {}).tv || (base.find(x => x.name === t) || {}).color || '#888';
      g.globalAlpha = a * (me ? 1 : 0.55); hlBox(g, B.x, yy, B.w, rh - 6, me ? 'rgba(255,255,255,.16)' : 'rgba(10,12,16,.6)', 6);
      const w = (B.w - 190) * (1 - 0.8 * avg[t] / mx); g.fillStyle = tc; g.fillRect(B.x, yy, w, rh - 6);
      g.save(); g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 4; vText(g, `${rankT(t)}. ${t}`, B.x + 10, yy + rh / 2 + 3, me ? 20 : 17, { w: me ? 900 : 700, max: B.w - 200 }); g.restore();
      vText(g, avg[t] < 0.005 ? L('réf.', 'ref.') : `+${sec(avg[t])} s`, B.x + B.w - 70, yy + rh / 2 + 3, me ? 19 : 16, { w: 800, mono: true, al: 'right' });
      vText(g, `P${sortT.findIndex(x => x.name === t) + 1}`, B.x + B.w - 6, yy + rh / 2 + 3, me ? 19 : 16, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.8)' }); });
    g.globalAlpha = Math.max(0, Math.min(1, (lt - 2.2) / 0.3));
    const by = B.y + B.h - 170; hlBox(g, B.x, by, B.w, 170, 'rgba(225,6,0,.32)', 14);
    vText(g, carEq ? (allEq ? L('Mêmes voitures, mêmes notes : tous à égalité', 'Same cars, same ratings: all level') : L(`Voitures à égalité · ${drvRank}e note des pilotes`, `Cars all level · ${ordE(drvRank)} best driver rating`)) : L(`${D.team} : ${rCar}e voiture · P${cRank} constructeurs`, `${D.team}: ${ordE(rCar)} car · P${cRank} in the teams' standings`), B.x + 24, by + 44, 22, { w: 800, max: B.w - 48 });
    vText(g, L('🎯 OBJECTIF', '🎯 GOAL'), B.x + 24, by + 92, 22, { w: 900, col: '#ffcc33' });
    vWrap(g, OBJ[0].toUpperCase(), B.x + 24, by + 142, 42, B.w - 48);
    g.globalAlpha = 1;
  } });
  // 3. la saison course par course : 2 s d'images de chaque GP (sa ligne d'arrivée, ou son abandon), la courbe se construit
  // courbe des points : le pilote et ses 2 concurrents directs au classement final
  const iMe = pos - 1, lo3 = clamp(iMe - 1, 0, Math.max(0, sortD.length - 3)), rivals = sortD.slice(lo3, lo3 + 3).map(d => d.name);   // lui + 2 concurrents (devant / derrière)
  const colOf = x => { const t = base.find(tt => tt.drivers.some(d => d.name === x)); return t ? t.tv || t.color : '#888'; };
  const ptsTop = Math.max(10, ...rivals.map(x => hist[n][x]));
  const montageDraw = (g, B, lt, i, cl) => {
    const r = res[i], d = i ? cpos[i - 1] - cpos[i] : 0;
    if (cl) vClipTower(g, B, cl.focus, cl.ft);
    // la manche (en haut à droite) : circuit et place au championnat
    const bw = 250, bx = B.x + B.w - bw, by = B.y + 120;
    hlBox(g, bx, by, bw, 132, 'rgba(8,10,14,.84)', 10); g.fillStyle = col; g.fillRect(bx, by, bw, 6);
    vText(g, L(`MANCHE ${i + 1}/${n}`, `ROUND ${i + 1}/${n}`), bx + 14, by + 32, 16, { w: 900, col: 'rgba(255,255,255,.7)' });
    vText(g, `${r.c.flag} ${tr(r.c.name).toUpperCase()}`, bx + 14, by + 62, 21, { w: 900, max: bw - 28 });
    vText(g, L('CHAMPIONNAT', 'STANDINGS'), bx + 14, by + 112, 14, { w: 800, col: 'rgba(255,255,255,.6)' });
    vText(g, `P${cpos[i]}`, bx + bw - 14, by + 116, 34, { w: 900, mono: true, al: 'right' });
    if (d) vText(g, d > 0 ? `▲${d}` : `▼${-d}`, bx + bw - 14 - g.measureText(`P${cpos[i]}`).width - 10, by + 114, 19, { w: 900, al: 'right', col: d > 0 ? '#39ff88' : '#ff6b6b' });
    // le résultat en très gros au centre (pop)
    const pop = Math.max(0, Math.min(1, (lt - 0.15) / 0.18)), sc = 1.6 - 0.6 * pop, big = r.dnf ? L('ABANDON', 'DNF') : `P${r.pos}`;
    const bc = r.dnf ? '#ff4d4d' : r.pos === 1 ? '#ffcc33' : r.pos <= 3 ? '#e6ebf3' : r.pts > 0 ? '#ffffff' : 'rgba(255,255,255,.9)';
    if (pop > 0) {
      g.save(); g.globalAlpha *= pop; g.translate(B.x + B.w / 2, B.y + B.h * 0.54); g.scale(sc, sc);
      g.font = `900 ${r.dnf ? 88 : 140}px ${HF.t}`; g.textAlign = 'center'; g.lineJoin = 'round';
      g.lineWidth = 16; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(big, 0, 0); g.fillStyle = bc; g.fillText(big, 0, 0);
      const tag = r.dnf ? (r.why || '') : r.pos === 1 ? L('VICTOIRE', 'WIN') : r.pos <= 3 ? L('PODIUM', 'PODIUM') : r.pts > 0 ? `+${r.pts} pt${r.pts > 1 ? 's' : ''}` : '';
      if (tag) { g.font = `900 34px ${HF.t}`; g.lineWidth = 9; g.strokeText(tag.toUpperCase(), 0, 52, B.w - 40); g.fillStyle = bc; g.fillText(tag.toUpperCase(), 0, 52, B.w - 40); }
      g.restore(); g.textAlign = 'left';
    }
    // la courbe des points (en bas) : lui en gras, ses concurrents directs autour
    const ph = 240, py = B.y + B.h - ph, x0 = B.x + 14, x1 = B.x + B.w - 170, yT = py + 40, yB = py + ph - 18;
    hlBox(g, B.x, py, B.w, ph, 'rgba(8,10,14,.6)', 12);
    vText(g, L('POINTS AU CHAMPIONNAT', 'CHAMPIONSHIP POINTS'), B.x + 14, py + 28, 18, { w: 900, col: 'rgba(255,255,255,.8)' });
    const X = j => x0 + j / Math.max(1, n) * (x1 - x0), Y = v => yB - v / ptsTop * (yB - yT), u = Math.min(1, lt / 0.6);
    const heads = [];
    for (const who of rivals.slice().sort(x => x === nm ? 1 : -1)) {   // lui en dernier (au-dessus des autres)
      const me = who === nm, c2 = colOf(who), at = j => hist[j][who];
      g.strokeStyle = me ? '#fff' : c2; g.lineWidth = me ? 5 : 2.5; g.globalAlpha = me ? 1 : 0.85; g.lineJoin = 'round'; g.beginPath();
      for (let j = 0; j <= i + 1; j++) { const v = j === i + 1 ? at(i) + (at(i + 1) - at(i)) * u : at(j), x = j === i + 1 ? X(i) + (X(i + 1) - X(i)) * u : X(j); j ? g.lineTo(x, Y(v)) : g.moveTo(x, Y(v)); }
      g.stroke(); g.globalAlpha = 1;
      const v = Math.round(at(i) + (at(i + 1) - at(i)) * u); const yy = Y(at(i) + (at(i + 1) - at(i)) * u); heads.push({ who, me, c2, x: X(i) + (X(i + 1) - X(i)) * u, y: yy, ry: yy, v });   // ry : position réelle sur la courbe, y : étiquette
    }
    heads.sort((p1, p2) => p1.y - p2.y); for (let k = 1; k < heads.length; k++) if (heads[k].y - heads[k - 1].y < 30) heads[k].y = heads[k - 1].y + 30;
    if (heads.length && heads[heads.length - 1].y > yB + 6) { const sh = heads[heads.length - 1].y - yB - 6; heads.forEach(h => { h.y -= sh; }); }
    for (const h of heads) {
      g.fillStyle = h.me ? '#fff' : h.c2; g.beginPath(); g.arc(h.x, h.ry, h.me ? 6 : 4, 0, 7); g.fill();   // le point reste sur sa courbe
      if (Math.abs(h.y - h.ry) > 2) { g.strokeStyle = h.me ? '#fff' : h.c2; g.lineWidth = 1.5; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(h.x + 6, h.ry); g.lineTo(x1 + 6, h.y); g.stroke(); g.globalAlpha = 1; }   // étiquette décalée : petit trait vers son point
      vText(g, lastName(h.who).slice(0, 3).toUpperCase(), x1 + 12, h.y + 9, h.me ? 26 : 22, { w: 900, col: h.me ? '#fff' : h.c2 }); vText(g, String(h.v), B.x + B.w - 12, h.y + 9, h.me ? 26 : 22, { w: 900, mono: true, al: 'right', col: h.me ? '#fff' : h.c2 });
    }
  };
  res.forEach((r, i) => { const cl = lineClip[i]; segs.push({ dur: 2, fixed: true, wipe: true, noFade: true, cam: cl ? 'clip' : 'fly', dim: cl ? 0 : 0.45, clip: cl || undefined, draw(g, B, lt) { montageDraw(g, B, lt, i, cl); } }); });
  // 4. le duel avec le coéquipier : face-à-face course / qualif / points, statistiques, courbe des points, le détail qui tue
  if (mate) {
    const M = sortD.find(d => d.name === mate) || { pts: 0, wins: 0, pod: 0 }, mcol = col, me2 = '#ffffff';
    let ra = 0, rb = 0, qa = 0, qb = 0, qn = 0, da = 0, db = 0, fa = [], fb = [];
    S.rounds.slice(0, n).forEach(rd => {
      const x = rd.result.findIndex(r => r.name === nm), y = rd.result.findIndex(r => r.name === mate); if (x < 0 || y < 0) return;
      const A = rd.result[x], Bm = rd.result[y];
      if (A.dnf) da++; else fa.push(x + 1); if (Bm.dnf) db++; else fb.push(y + 1);
      if (!(A.dnf && Bm.dnf)) { if (!A.dnf && (Bm.dnf || x < y)) ra++; else rb++; }
      if (A.grid && Bm.grid) { qn++; if (A.grid < Bm.grid) qa++; else qb++; }
    });
    const avgP = a => a.length ? a.reduce((s2, v) => s2 + v, 0) / a.length : null, bestP = a => a.length ? Math.min(...a) : null;
    const rows = [[L('COURSES', 'RACES'), ra, rb, 1], ...(qn ? [[L('QUALIFS', 'QUALIFYING'), qa, qb, 1]] : []), [L('POINTS', 'POINTS'), D.pts, M.pts, 1], [L('VICTOIRES', 'WINS'), D.wins, M.wins || 0, 1], [L('PODIUMS', 'PODIUMS'), D.pod, M.pod || 0, 1],
      [L('MEILLEUR RÉSULTAT', 'BEST FINISH'), bestP(fa), bestP(fb), -1, 'p'], [L('PLACE MOYENNE', 'AVERAGE FINISH'), avgP(fa), avgP(fb), -1, 'avg'], [L('ABANDONS', 'DNFs'), da, db, -1]];
    // le détail : le face-à-face le plus déséquilibré
    const dets = [[ra, rb, L('en course', 'in races'), ra + rb], ...(qn ? [[qa, qb, L('en qualif', 'in qualifying'), qn]] : [])].sort((p1, p2) => Math.abs(p2[0] - p2[1]) / Math.max(1, p2[3]) - Math.abs(p1[0] - p1[1]) / Math.max(1, p1[3]));
    const dt = dets[0], dWho = dt[0] >= dt[1] ? short : lastName(mate), dOther = dt[0] >= dt[1] ? lastName(mate) : short;
    const detail = L(`Le détail : ${dt[2]}, ${dWho} devance ${dOther} ${Math.max(dt[0], dt[1])} fois sur ${dt[3]}.`, `The detail: ${dt[2]}, ${dWho} beats ${dOther} ${Math.max(dt[0], dt[1])} times out of ${dt[3]}.`);
    const fmtV = (v, f) => v == null ? '—' : f === 'avg' ? v.toFixed(1).replace('.', L(',', '.')) : f === 'p' ? `P${v}` : String(v);
    segs.push({ dur: 8, cam: 'fly', dim: 0.66, draw(g, B, lt) {
      const y = vHead(g, B, D.team, L('LE DUEL INTERNE', 'TEAM-MATE BATTLE')), hw = (B.w - 20) / 2;
      [[short, me2, B.x], [lastName(mate), mcol, B.x + hw + 20]].forEach(([w2, c2, x]) => { hlBox(g, x, y, hw, 56, 'rgba(10,12,16,.82)', 10); g.fillStyle = c2; g.fillRect(x, y + 50, hw, 6); vText(g, w2.toUpperCase(), x + hw / 2, y + 38, 28, { w: 900, al: 'center', max: hw - 16 }); });
      const rh = Math.min(62, (B.y + B.h - y - 200) / rows.length);
      rows.forEach(([lab, a, b, dir, f], k) => { const yy = y + 76 + k * rh, al = vReveal(lt, k, rows.length, 2.2); g.globalAlpha = al;
        const A2 = a == null ? null : a, B2 = b == null ? null : b, aWin = A2 != null && (B2 == null || (dir > 0 ? A2 > B2 : A2 < B2)), bWin = B2 != null && (A2 == null || (dir > 0 ? B2 > A2 : B2 < A2));
        vText(g, lab, B.x + B.w / 2, yy + 18, 15, { w: 800, al: 'center', col: 'rgba(255,255,255,.65)' });
        vText(g, fmtV(a, f), B.x + 10, yy + 40, 32, { w: 900, mono: true, col: aWin ? '#39ff88' : '#fff' });
        vText(g, fmtV(b, f), B.x + B.w - 10, yy + 40, 32, { w: 900, mono: true, al: 'right', col: bWin ? '#39ff88' : '#fff' });
        if (dir > 0 && a != null && b != null) { const tot = Math.max(1, a + b), bw2 = B.w - 260, bx = B.x + 130; g.fillStyle = me2; g.fillRect(bx, yy + 28, bw2 * a / tot * al, 10); g.fillStyle = mcol; g.fillRect(bx + bw2 * a / tot, yy + 28, bw2 * b / tot * al, 10); } });
      g.globalAlpha = Math.max(0, Math.min(1, (lt - 3.2) / 0.3));
      const by = B.y + B.h - 120; hlBox(g, B.x, by, B.w, 120, 'rgba(225,6,0,.32)', 12); vText(g, L('🔎 LE DÉTAIL', '🔎 THE DETAIL'), B.x + 20, by + 34, 20, { w: 900, col: '#ffcc33' });
      vWrap(g, detail.replace(/^[^:]*: /, ''), B.x + 20, by + 72, 24, B.w - 40, { w: 800 }); g.globalAlpha = 1;
    } });
    // la courbe des points des deux pilotes
    segs.push({ dur: 6, cam: 'fly', dim: 0.66, draw(g, B, lt, sg) {
      const y0 = vHead(g, B, D.team, L('POINTS, MANCHE APRÈS MANCHE', 'POINTS, ROUND BY ROUND')), x0 = B.x + 50, x1 = B.x + B.w - 150, yT = y0 + 20, yB = B.y + B.h - 60;
      const top = Math.max(10, hist[n][nm], hist[n][mate] || 0), X = j => x0 + j / Math.max(1, n) * (x1 - x0), Y = v => yB - v / top * (yB - yT), prog = clamp((lt - 0.3) / Math.max(1, sg.dur - 2), 0, 1) * n;
      g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.14)'; [0, 0.5, 1].forEach(f => { g.beginPath(); g.moveTo(x0, Y(top * f)); g.lineTo(x1, Y(top * f)); g.stroke(); vText(g, String(Math.round(top * f)), x0 - 8, Y(top * f) + 6, 16, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.55)' }); });
      const i0 = Math.floor(prog), heads = [];
      [[mate, mcol, 5], [nm, me2, 7]].forEach(([w2, c2, lw]) => { const at = j => hist[j][w2] || 0, pts = [];
        for (let j = 0; j <= i0; j++) pts.push([X(j), Y(at(j))]); if (i0 < n) pts.push([X(prog), Y(at(i0) + (at(i0 + 1) - at(i0)) * (prog - i0))]);
        g.strokeStyle = c2; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
        const hd = pts[pts.length - 1]; g.fillStyle = c2; g.beginPath(); g.arc(hd[0], hd[1], 9, 0, 7); g.fill(); heads.push({ w2, c2, x: hd[0], y: hd[1], v: Math.round(at(i0) + (i0 < n ? (at(i0 + 1) - at(i0)) * (prog - i0) : 0)) }); });
      heads.sort((a, b) => a.y - b.y); if (heads.length > 1 && heads[1].y - heads[0].y < 56) heads[1].y = heads[0].y + 56;
      heads.forEach(h => { vText(g, lastName(h.w2).toUpperCase(), h.x + 16, h.y - 4, 24, { w: 900, col: h.c2 }); vText(g, `${h.v} pts`, h.x + 16, h.y + 24, 22, { w: 800, mono: true }); });
      if (prog >= n - 0.01) { const df = (hist[n][nm] || 0) - (hist[n][mate] || 0); vText(g, `${df >= 0 ? '+' : '−'}${Math.abs(df)} pts`, x0 + 10, yT + 40, 44, { w: 900, mono: true, col: df >= 0 ? '#39ff88' : '#ff6b6b' }); }
    } });
  }
  // 5. le verdict : la courbe de sa place au championnat, la place finale, l'objectif (fixé par le niveau de la voiture)
  segs.push({ dur: 8.5, cam: 'fly', dim: 0.62, must: true, draw(g, B, lt) {
    const y0 = vHead(g, B, L(`Championnat ${year}`, `${year} championship`), L('LE VERDICT', 'THE VERDICT')), x0 = B.x + 50, x1 = B.x + B.w - 30, yT = y0 + 20, yB = y0 + 300, worst = Math.max(5, ...cpos);
    const X = i => x0 + i / Math.max(1, cpos.length - 1) * (x1 - x0), Y = p => yT + (p - 1) / (worst - 1) * (yB - yT), prog = clamp((lt - 0.2) / 2.6, 0, 1) * (cpos.length - 1);
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.14)';
    [1, Math.ceil(worst / 2), worst].forEach(p => { g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x1, Y(p)); g.stroke(); vText(g, `P${p}`, x0 - 10, Y(p) + 6, 16, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.6)' }); });
    const i0 = Math.floor(prog), pts = []; for (let i = 0; i <= i0; i++) pts.push([X(i), Y(cpos[i])]);
    if (i0 < cpos.length - 1) pts.push([X(prog), Y(cpos[i0] + (cpos[i0 + 1] - cpos[i0]) * (prog - i0))]);
    g.strokeStyle = col; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    const hd = pts[pts.length - 1]; g.fillStyle = '#fff'; g.beginPath(); g.arc(hd[0], hd[1], 10, 0, 7); g.fill();
    const rv = Math.max(0, Math.min(1, (lt - 3) / 0.25));
    if (rv > 0) {
      g.globalAlpha = rv; hlBox(g, B.x, yB + 40, B.w, 350, 'rgba(8,10,14,.9)', 16); g.fillStyle = col; g.fillRect(B.x, yB + 40, 10, 350);
      g.save(); g.translate(B.x + B.w / 2, yB + 170); g.scale(1 + 0.4 * (1 - rv), 1 + 0.4 * (1 - rv)); vText(g, `P${pos}`, 0, 0, 120, { w: 900, mono: true, al: 'center' }); g.restore();
      vText(g, `${D.pts} pts · ${D.wins} ${L('V', 'W')} · ${D.pod} ${L('podiums', 'podiums')}`, B.x + B.w / 2, yB + 220, 24, { w: 800, mono: true, al: 'center', col: 'rgba(255,255,255,.8)' });
      vText(g, L(`Objectif : ${OBJ[0]}`, `Goal: ${OBJ[0]}`) + (carEq ? '' : L(` (${rCar}e voiture)`, ` (${ordE(rCar)} car)`)), B.x + B.w / 2, yB + 262, 22, { w: 700, al: 'center', col: 'rgba(255,255,255,.75)', max: B.w - 30 });
      g.globalAlpha = Math.max(0, Math.min(1, (lt - 4.4) / 0.25));
      g.save(); const s2 = 1 + 0.3 * Math.max(0, 1 - (lt - 4.4) / 0.25); g.translate(B.x + B.w / 2, yB + 340); g.scale(s2, s2);
      vText(g, objOk ? L('✅ OBJECTIF ATTEINT', '✅ GOAL ACHIEVED') : L('❌ OBJECTIF MANQUÉ', '❌ GOAL MISSED'), 0, 0, 38, { w: 900, al: 'center', col: objOk ? '#39ff88' : '#ff6b6b' }); g.restore();
      g.globalAlpha = 1;
    }
  } });
  // 6. le prochain épisode : la place du pilote classé juste devant
  const nx = pos > 1 ? sortD[pos - 2] : null;   // on ne dit pas qui : seulement la place
  segs.push({ dur: 5, cam: 'fly', dim: 0.6, e: 2, say: () => nx ? L(`Prochain épisode :|le ${sayNth(pos - 1)} du championnat… qui est-ce ? Abonne-toi pour le découvrir !`, `Next episode:|the driver who finished ${sayNth(pos - 1)}… who is it? Follow to find out!`) : L(`C'était le champion du monde ${year}. Abonne-toi pour la saison ${year + 1} !`, `That was the ${year} world champion. Follow for the ${year + 1} season!`), draw(g, B, lt) {
    if (!nx) { vText(g, L('FIN DE LA SAISON', 'END OF SEASON'), B.x + B.w / 2, B.y + B.h * 0.38, 26, { w: 900, col: '#e10600', al: 'center' }); vText(g, String(year + 1), B.x + B.w / 2, B.y + B.h * 0.38 + 120, 120, { w: 900, mono: true, al: 'center' }); return; }
    vText(g, L('PROCHAIN ÉPISODE', 'NEXT EPISODE'), B.x + B.w / 2, B.y + B.h * 0.3, 28, { w: 900, col: '#e10600', al: 'center' });
    vText(g, `P${pos - 1}`, B.x + B.w / 2, B.y + B.h * 0.3 + 150, 140, { w: 900, mono: true, al: 'center' });
    g.globalAlpha = Math.max(0, Math.min(1, (lt - 0.6) / 0.3));
    vText(g, L('QUI EST-CE ?', 'WHO IS IT?'), B.x + B.w / 2, B.y + B.h * 0.3 + 280, 56, { w: 900, al: 'center', col: '#ffcc33', max: B.w });
    vText(g, L('Abonne-toi pour ne pas le rater 🔔', 'Follow so you don’t miss it 🔔'), B.x + B.w / 2, B.y + B.h - 30, 24, { w: 800, al: 'center', col: '#ffcc33', max: B.w });
    g.globalAlpha = 1;
  } });
  return vFit(segs, 95);
}
/* ajuste les durées pour viser environ une minute (les extraits de course gardent leur durée réelle : pas de ralenti) */
function vFit(segs, target) {
  const fx = segs.filter(s => s.fixed).reduce((a, s) => a + s.dur, 0), tot = segs.reduce((a, s) => a + (s.fixed ? 0 : s.dur), 0), k = clamp((target - fx) / Math.max(1, tot), 0.75, 1.6);
  segs.forEach(s => { if (!s.fixed) s.dur = +(s.dur * k).toFixed(2); });
  return segs;
}

/* ---- 2. grille de départ après les qualifications ---- */
function vidGridSegs(rows) {
  const segs = [], circ = CIRCUITS[ST.circuit], pole = rows[0], n = rows.length;
  const tm = r => r.best < 900 ? fmt(r.best) : L('sans temps', 'no time');
  const gap = r => r.best < 900 && pole.best < 900 ? fmtGap(r.best - pole.best) : '';
  const elim = k => k >= 16 ? L('éliminé en Q1', 'out in Q1') : k >= 10 ? L('éliminé en Q2', 'out in Q2') : '';
  segs.push({ dur: 5, cam: 'gridwide', dim: 0.3, must: true, say: () => L(`${tr(circ.name)} : les qualifications sont terminées. Voici la grille de départ, en commençant par le fond.`, `Qualifying is over in ${tr(circ.name)}. Here's the starting grid, from the back.`), draw(g, B, lt) {
    vText(g, L('QUALIFICATIONS', 'QUALIFYING'), B.x, B.y + 150, 28, { w: 900, col: '#e10600' });
    vText(g, tr(circ.name).toUpperCase(), B.x, B.y + 226, 72, { w: 900, max: B.w });
    vText(g, `${circ.flag} ${tr(circ.sub)}`, B.x, B.y + 270, 28, { w: 700, col: 'rgba(255,255,255,.85)', max: B.w });
    vText(g, L('LA GRILLE DE DÉPART', 'THE STARTING GRID'), B.x, B.y + B.h - 60, 40, { w: 900, max: B.w });
    g.fillStyle = '#e10600'; g.fillRect(B.x, B.y + B.h - 44, 80, 5);
  } });
  const pc = pole.entry;
  const p2 = rows[1], pg = p2 && p2.best < 900 && pole.best < 900 ? p2.best - pole.best : null;
  const poleSeg = { dur: 7, cam: 'pole', focus: 0, dim: 0.18, must: true, sayAt: 0.5, say: () => L(`Et la pole position est pour ${pc.driver.name}, ${pc.team.name} !${pg != null ? ` ${sayGap(pg)} d'avance.` : ''}`, `And pole position goes to ${pc.driver.name}, ${pc.team.name}!${pg != null ? ` ${sayGap(pg)} clear.` : ''}`), draw(g, B, lt) {
    hlBox(g, B.x, B.y + B.h - 300, B.w, 290, 'rgba(8,10,14,.86)', 16);
    g.fillStyle = pc.team.tv || pc.team.color; g.fillRect(B.x, B.y + B.h - 300, 10, 290);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.font = `900 180px ${HF.t}`; g.textAlign = 'right'; g.fillText(pc.driver.num, B.x + B.w - 16, B.y + B.h - 60); g.textAlign = 'left';
    vText(g, 'POLE POSITION', B.x + 34, B.y + B.h - 248, 26, { w: 900, col: '#e10600' });
    vText(g, pc.driver.name.toUpperCase(), B.x + 34, B.y + B.h - 188, 52, { w: 900, max: B.w - 60 });
    vText(g, `${pc.driver.nat || ''} ${pc.team.name}`.trim(), B.x + 34, B.y + B.h - 146, 26, { w: 700, col: 'rgba(255,255,255,.8)', max: B.w - 60 });
    vText(g, tm(pole), B.x + 34, B.y + B.h - 62, 56, { w: 800, mono: true, col: '#b36bff' });
    if (rows[1] && rows[1].best < 900 && pole.best < 900 && lt > 1) vText(g, `${fmtGap(rows[1].best - pole.best)} ${L('sur', 'to')} ${rows[1].entry.driver.name}`, B.x + 34, B.y + B.h - 24, 20, { w: 700, col: 'rgba(255,255,255,.7)', max: B.w - 60 });
  } };
  // la grille, ligne par ligne (2 voitures par ligne, comme sur la piste), du fond de grille jusqu'à la première ligne ;
  // en première ligne on ne montre que le 2e : la pole est dévoilée juste après
  for (let k = (n - 1) & ~1; k >= 0; k -= 2) {
    const pair = k === 0 ? rows.slice(1, 2) : rows.slice(k, k + 2), p0 = k === 0 ? 1 : k;
    const nA = pair[0].entry.driver.name, nB = pair[1] ? pair[1].entry.driver.name : '', row = k / 2 + 1, back = k === ((n - 1) & ~1);
    const gapP2 = k === 0 && pair[0].best < 900 && pole.best < 900 ? pair[0].best - pole.best : null;
    const say = () => k === 0 ? L(`En première ligne, ${nA}, à ${gapP2 != null ? sayGap(gapP2) : 'peu'} de la pole…`, `On the front row, ${nA}, ${gapP2 != null ? sayGap(gapP2) : 'just'} off pole…`)
      : back ? (nB ? L(`En fond de grille, ${nB} et ${nA}.`, `At the back of the grid, ${nB} and ${nA}.`) : L(`En fond de grille, ${nA}.`, `At the back of the grid, ${nA}.`))
      : !nB ? L(`${nA} partira ${sayNth(p0 + 1)}.`, `${nA} starts ${sayNth(p0 + 1)}.`)
      : V([`Ligne ${row} : ${nB} et ${nA}.`, `Row ${row}: ${nB} and ${nA}.`], [`${nA} partira ${sayNth(p0 + 1)}, ${nB} ${sayNth(p0 + 2)}.`, `${nA} starts ${sayNth(p0 + 1)}, ${nB} ${sayNth(p0 + 2)}.`], [`En ${row}e ligne, ${nB}, à côté de ${nA}.`, `On row ${row}, ${nB} alongside ${nA}.`]);
    segs.push({ dur: 4, cam: 'car', focus: p0, focus2: pair.length > 1 ? p0 + 1 : null, dim: 0.12, say, must: k === 0, draw(g, B, lt) {
      // rappel des lignes déjà dévoilées (juste derrière), en petit
      const prev = rows.slice(k + 2, k + 8), y0 = B.y + 70;
      prev.forEach((r, i) => { g.globalAlpha = 0.85; hlBox(g, B.x, y0 + i * 36, 250, 31, 'rgba(10,12,16,.72)', 6); g.fillStyle = r.entry.team.tv || r.entry.team.color; g.fillRect(B.x, y0 + i * 36, 5, 31);
        vText(g, `P${k + 3 + i}`, B.x + 14, y0 + i * 36 + 22, 17, { w: 800, mono: true, col: 'rgba(255,255,255,.7)' });
        vText(g, r.entry.driver.name, B.x + 64, y0 + i * 36 + 22, 17, { w: 700, max: 176 }); });
      g.globalAlpha = 1;
      hlBox(g, B.x, B.y + B.h - 326, 120, 36, '#e10600', 8);
      vText(g, L(`LIGNE ${k / 2 + 1}`, `ROW ${k / 2 + 1}`), B.x + 60, B.y + B.h - 300, 20, { w: 900, al: 'center' });
      pair.forEach((r, j) => {
        const y = B.y + B.h - 270 + j * 136, e = r.entry, a = Math.max(0, Math.min(1, (lt - (pair.length - 1 - j) * 0.45) / 0.3));   // la voiture de derrière d'abord
        g.globalAlpha = a;
        hlBox(g, B.x, y, B.w, 126, 'rgba(8,10,14,.86)', 12); g.fillStyle = e.team.tv || e.team.color; g.fillRect(B.x, y, 8, 126);
        vText(g, `P${p0 + j + 1}`, B.x + 24, y + 58, 46, { w: 900, mono: true });
        vText(g, e.driver.name, B.x + 140, y + 50, 34, { w: 900, max: B.w - 330 });
        vText(g, `${e.driver.nat || ''} ${e.team.name}`.trim(), B.x + 140, y + 84, 20, { w: 600, col: 'rgba(255,255,255,.75)', max: B.w - 330 });
        vText(g, tm(r), B.x + B.w - 16, y + 50, 30, { w: 800, mono: true, al: 'right', col: p0 + j === 0 ? '#b36bff' : '#fff' });
        vText(g, p0 + j ? gap(r) : 'POLE', B.x + B.w - 16, y + 84, 20, { w: 700, mono: true, al: 'right', col: 'rgba(255,255,255,.75)' });
        const el = elim(p0 + j); if (el) vText(g, el, B.x + 140, y + 112, 16, { w: 700, col: '#ffb000' });
      });
      g.globalAlpha = 1;
    } });
  }
  segs.push(poleSeg);
  // récapitulatif
  segs.push({ dur: 6, cam: 'gridwide', dim: 0.55, say: () => L('La grille est en place. Extinction des feux dans quelques instants !', 'The grid is set. Lights out is coming up!'), draw(g, B, lt) {
    let y = vHead(g, B, `${circ.flag} ${tr(circ.name)}`, L('GRILLE DE DÉPART', 'STARTING GRID'));
    const half = Math.ceil(n / 2), rh = Math.min(58, (B.y + B.h - y - 70) / (half + 0.5)), cw = (B.w - 12) / 2;
    rows.forEach((r, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = B.x + col * (cw + 12), yy = y + row * rh + col * rh * 0.45;
      g.globalAlpha = vReveal(lt, i, n, 2.5);
      hlBox(g, x, yy, cw, rh - 8, 'rgba(10,12,16,.78)', 6); g.fillStyle = r.entry.team.tv || r.entry.team.color; g.fillRect(x, yy, 5, rh - 8);
      vText(g, String(i + 1), x + 30, yy + rh / 2 + 3, 18, { w: 800, mono: true, al: 'right', col: 'rgba(255,255,255,.7)' });
      vText(g, r.entry.driver.name, x + 40, yy + rh / 2 + 3, 19, { w: 800, max: cw - 48 });
    });
    g.globalAlpha = 1;
    vText(g, L('Extinction des feux à suivre…', 'Lights out coming up…'), B.x + B.w / 2, B.y + B.h - 14, 24, { w: 800, al: 'center', max: B.w });
  } });
  return vFit(segs, 60);
}

/* =====================================================================
   COMMENTAIRE DES VIDÉOS (voix de synthèse générique du téléphone) : présentation du GP, grille, saison, highlights.
   Appli Android : chaque phrase est rendue en audio à l'ouverture de la vidéo, puis jouée dans le contexte audio du jeu,
   au bon moment ; elle est donc aussi enregistrée dans la vidéo exportée.
   Navigateur : la phrase est lue par speechSynthesis (on l'entend, mais elle n'est pas dans le fichier exporté).
   ===================================================================== */
const COM_KEY = 'paddock26-com';
const COM = { on: true, voice: { fr: '', en: '' }, rate: 1.12, pitch: 0.95, lines: [], fired: 0, wait: false, gen: 0, seq: 0, buf: new Map(), cb: new Map(), cur: null, out: null };
try { const s = JSON.parse(localStorage.getItem(COM_KEY) || 'null'); if (s) { COM.on = s.on !== false; COM.voice = Object.assign(COM.voice, s.voice || {}); } } catch (e) { /* réglages par défaut */ }
const comSave = () => { try { localStorage.setItem(COM_KEY, JSON.stringify({ on: COM.on, voice: COM.voice })); } catch (e) { /* stockage plein */ } };
const comLang = () => ST.lang === 'en' ? 'en' : 'fr';
const comNative = () => { try { return !!window.PaddockTTS && PaddockTTS.state() === 1; } catch (e) { return false; } };
const comLive = () => !comNative() && !!window.speechSynthesis && !window.PaddockTTS;
window.__tts = { done(id, b64) { const f = COM.cb.get(id); if (f) { COM.cb.delete(id); f(b64); } } };
const pickV = a => a[Math.floor(Math.random() * a.length)];
const V = (...pairs) => { const p = pickV(pairs); return L(p[0], p[1]); };   // une formulation au hasard, en français ou en anglais
const sayNth = n => L(n === 1 ? 'premier' : `${n}e`, `P${n}`);
const sayGap = x => x < 1 ? L(`${Math.round(x * 1000)} millièmes`, `${x.toFixed(3)} seconds`) : L(`${x.toFixed(3).replace('.', ',')} secondes`, `${x.toFixed(3)} seconds`);
/* voix installées pour la langue en cours (les voix locales seulement : pas besoin de réseau) */
function comVoices() {
  const lang = comLang();
  if (window.PaddockTTS) {
    try {
      const pref = lang === 'en' ? 'en-GB' : 'fr-FR';
      // voix masculines de Google en tête (ton de commentateur), puis l'accent local, puis la qualité
      const male = lang === 'en' ? ['en-gb-x-rjs-local', 'en-gb-x-gbd-local', 'en-gb-x-gbb-local'] : ['fr-fr-x-frd-local', 'fr-fr-x-frb-local'], rk = n => { const i = male.indexOf(n); return i < 0 ? 99 : i; };
      return JSON.parse(PaddockTTS.voices(lang)).filter(v => !v.net && /-x-/.test(v.name)).sort((a, b) => rk(a.name) - rk(b.name) || (b.loc === pref) - (a.loc === pref) || b.q - a.q || (a.name < b.name ? -1 : 1)).map(v => v.name);
    } catch (e) { return []; }
  }
  if (window.speechSynthesis) return speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(lang)).map(v => v.name);
  return [];
}
/* chaîne « voix de commentateur » : coupe le grave, présence vers 2,5 kHz, compresseur (voix dense et en avant) */
function comAudio() {
  initAudio(); const ctx = SND.ctx; if (!ctx) return null;
  if (ctx.state !== 'running') ctx.resume();
  if (!COM.out) { const c = comChain(ctx); COM.in = c.in; COM.out = c.out; }
  return ctx;
}
function comChain(ctx) {
  const out = ctx.createGain(); out.gain.value = 1.5; out.connect(ctx.destination);
  const hp = ctx.createBiquadFilter(), pr = ctx.createBiquadFilter(), cp = ctx.createDynamicsCompressor();
  hp.type = 'highpass'; hp.frequency.value = 110;
  pr.type = 'peaking'; pr.frequency.value = 2600; pr.Q.value = 0.9; pr.gain.value = 4;
  cp.threshold.value = -24; cp.knee.value = 8; cp.ratio.value = 4; cp.attack.value = 0.004; cp.release.value = 0.12;
  hp.connect(pr); pr.connect(cp); cp.connect(out);
  return { in: hp, out };
}
/* ÉNERGIE d'une phrase (0 posé · 1 vivant · 2 excité · 3 explosion) : débit et hauteur de la voix. Une phrase peut être
   découpée en morceaux par « | » : les premiers montent en tension (un cran plus bas), le dernier éclate */
const COM_E = [[1.1, 0.98], [1.2, 1.03], [1.3, 1.09], [1.38, 1.16]];
const comProso = e => COM_E[clamp(Math.round(e ?? 1), 0, 3)];
function comParts(l) {
  if (l.parts) return l.parts;
  const e = l.e ?? 1, a = String(l.text).split('|').map(s => s.trim()).filter(Boolean);
  l.parts = a.map((s, i) => [s, l.es ? l.es[i] ?? e : i < a.length - 1 ? Math.max(0, e - 1) : e]);
  l.text = a.join(' ');
  return l.parts;
}
/* durée estimée d'une phrase (avant la synthèse, ou dans le navigateur) */
const comEst = l => comParts(l).reduce((s, [t, e]) => s + (t.length + (t.match(/[,.!?…:;]/g) || []).length * 4) / (14.5 * comProso(e)[0]), 0.15);
/* rend un morceau de phrase en audio (Android) */
function comSynth1(text, e) {
  const lang = comLang(), voice = COM.voice[lang] || comVoices()[0] || '', [rate, pitch] = comProso(e), key = `${lang}|${voice}|${rate}|${pitch}|${text}`;
  if (COM.buf.has(key)) return Promise.resolve(COM.buf.get(key));
  const ctx = comAudio(); if (!ctx) return Promise.resolve(null);
  const id = 'u' + (++COM.seq);
  return new Promise(res => {
    const tm = setTimeout(() => { COM.cb.delete(id); res(null); }, 15000);
    COM.cb.set(id, async b64 => {
      clearTimeout(tm); if (!b64) { res(null); return; }
      try { const buf = await ctx.decodeAudioData(b64dec(b64).buffer); COM.buf.set(key, comTrim(ctx, buf)); res(COM.buf.get(key)); } catch (e) { res(null); }
    });
    let ok = false; try { ok = PaddockTTS.synth(id, text, lang, voice, rate, pitch); } catch (e) { /* pas de synthèse */ }
    if (!ok) { clearTimeout(tm); COM.cb.delete(id); res(null); }
  });
}
/* enlève le silence que la synthèse laisse avant et après la phrase (la voix démarre pile au bon moment) */
function comTrim(ctx, b) {
  const d = b.getChannelData(0), th = 0.012; let i0 = 0, i1 = d.length - 1;
  while (i0 < i1 && Math.abs(d[i0]) < th) i0++;
  while (i1 > i0 && Math.abs(d[i1]) < th) i1--;
  i0 = Math.max(0, i0 - Math.round(b.sampleRate * 0.02)); i1 = Math.min(d.length - 1, i1 + Math.round(b.sampleRate * 0.06));
  if (i1 - i0 < b.sampleRate * 0.1) return b;
  const o = ctx.createBuffer(b.numberOfChannels, i1 - i0 + 1, b.sampleRate);
  for (let c = 0; c < b.numberOfChannels; c++) o.getChannelData(c).set(b.getChannelData(c).subarray(i0, i1 + 1));
  return o;
}
/* une phrase complète : ses morceaux mis bout à bout (petit souffle entre deux) ; l.pd = durée de chaque morceau (sous-titres) */
function comSynth(l) {
  const P = comParts(l);
  return Promise.all(P.map(([t, e]) => comSynth1(t, e))).then(bs => {
    if (bs.some(b => !b)) return null;
    if (bs.length === 1) { l.pd = [bs[0].duration]; return bs[0]; }
    const ctx = SND.ctx, sr = bs[0].sampleRate, gap = Math.round(sr * 0.07), n = bs.reduce((s, b) => s + b.length + gap, -gap);
    const o = ctx.createBuffer(1, n, sr), d = o.getChannelData(0); let k = 0;
    bs.forEach(b => { d.set(b.getChannelData(0), k); k += b.length + gap; });
    l.pd = bs.map((b, i) => b.duration + (i < bs.length - 1 ? gap / sr : 0));
    return o;
  });
}
const comStatus = t => { if (VID.on || HL.on) $('#hl-status').textContent = t; };
/* nouvelle piste de commentaire : [{ t (s dans la vidéo), text, must (coupe la phrase en cours) }] */
function comSet(lines) {
  const g = ++COM.gen; comStop();
  COM.lines = (lines || []).filter(l => l && l.text).sort((a, b) => a.t - b.t); COM.fired = 0; COM.wait = false;
  COM.lines.forEach(comParts);
  comButtons();
  if (!COM.on || !COM.lines.length) return;
  if (comNative()) {
    COM.wait = true; let n = 0; const N = COM.lines.length;
    comStatus(L(`Préparation du commentaire… 0/${N}`, `Preparing the commentary… 0/${N}`));
    Promise.all(COM.lines.map(l => comSynth(l).then(b => { l.buf = b; n++; if (g === COM.gen) comStatus(L(`Préparation du commentaire… ${n}/${N}`, `Preparing the commentary… ${n}/${N}`)); })))
      .then(() => { if (g !== COM.gen) return; if (VID.on) vidFitVoice(); else if (HL.on) hlFitVoice(); comDone(); comStatus(COM.lines.some(l => l.buf) ? '' : L('Voix de synthèse indisponible sur ce téléphone', 'Text-to-speech unavailable on this phone')); });
  } else if (window.PaddockTTS) {   // moteur de synthèse pas encore prêt (démarrage) : on réessaie un peu plus tard
    COM.wait = true; comStatus(L('Préparation du commentaire…', 'Preparing the commentary…'));
    setTimeout(() => { if (g === COM.gen) { if (PaddockTTS.state() === 0) comSet(COM.lines); else { comDone(); comStatus(PaddockTTS.state() === 1 ? '' : L('Voix de synthèse indisponible sur ce téléphone', 'Text-to-speech unavailable on this phone')); if (PaddockTTS.state() === 1) comSet(COM.lines); } } }, 800);
  }
}
function comRewind() { comStop(); COM.fired = 0; }
/* lance fn quand le commentaire est prêt (export de la vidéo) */
function comReady(fn) { if (COM.wait) COM.after = fn; else fn(); }
function comDone() { COM.wait = false; if (COM.after) { const f = COM.after; COM.after = null; f(); } }
function comStop() {
  if (COM.cur && COM.cur.off && EXP.voice) { const v = EXP.voice[EXP.voice.length - 1]; if (v && v.line === COM.cur.line && v.t + v.buf.duration > COM.vt) v.stop = COM.vt; }   // export : la phrase coupée s'arrête là
  if (COM.cur && COM.cur.src) try { COM.cur.src.stop(); } catch (e) { /* déjà fini */ }
  if (COM.cur && COM.cur.u && window.speechSynthesis) speechSynthesis.cancel();
  COM.cur = null;
}
const comCapOn = () => COM.on && COM.lines.length > 0;
const comSpeaking = () => !!COM.cur && (COM.cur.off ? COM.vt < COM.cur.until : COM.cur.src ? performance.now() / 1000 < COM.cur.until : !!window.speechSynthesis && speechSynthesis.speaking);
/* appelé à chaque image avec le temps de la vidéo */
function comTick(t) {
  COM.vt = t;
  if (!COM.on || COM.wait) return;
  while (COM.fired < COM.lines.length && COM.lines[COM.fired].t <= t) {
    const l = COM.lines[COM.fired];
    if (t - l.t > (l.wait || 1.5)) { COM.fired++; continue; }   // moment déjà passé (retour en arrière, image ratée)
    if (comSpeaking() && !l.must) return;   // la phrase attend la fin de la précédente (au plus 1,5 s, sinon elle saute)
    COM.fired++; comSay(l, t);
  }
}
/* vt : temps de la vidéo au début de la phrase (les sous-titres suivent la voix mot à mot) */
function comSay(l, vt) {
  comStop();
  if (EXP.on) {   // export rapide : rien n'est joué, la phrase est placée dans la piste son de la vidéo
    const dur = l.buf ? l.buf.duration : comEst(l);
    if (l.buf) EXP.voice.push({ buf: l.buf, t: vt, line: l });
    COM.cur = { line: l, vt, dur, until: vt + dur, off: true };
    return;
  }
  if (l.buf) {
    const ctx = comAudio(); if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = l.buf; src.connect(COM.in || COM.out); src.start();
    COM.cur = { src, until: performance.now() / 1000 + l.buf.duration, line: l, vt, dur: l.buf.duration };
  } else if (comLive()) {
    const lang = comLang(), vs = speechSynthesis.getVoices();
    speechSynthesis.cancel();
    let u;
    for (const [t, e] of comParts(l)) {
      u = new SpeechSynthesisUtterance(t); u.lang = lang === 'en' ? 'en-GB' : 'fr-FR'; [u.rate, u.pitch] = comProso(e);
      const v = vs.find(x => x.name === COM.voice[lang]) || vs.find(x => x.lang === u.lang) || vs.find(x => x.lang.toLowerCase().startsWith(lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    }
    COM.cur = { u, line: l, vt, dur: comEst(l) };
  } else if (vt != null) COM.cur = { line: l, vt, dur: comEst(l), until: performance.now() / 1000 + comEst(l) };   // pas de voix : les sous-titres défilent quand même
}
/* ---- SOUS-TITRES façon TikTok : tout ce que dit le commentateur, par groupes de quelques mots, le mot prononcé en jaune ---- */
const CAP = { fs: 50, lh: 60 };
function comCapWords(l) {
  if (l.cw) return l.cw;
  const P = comParts(l), out = [];
  const tot = l.pd && l.pd.length === P.length ? null : comEst(l);
  let t = 0;
  P.forEach(([txt, e], pi) => {
    const ws = txt.split(/\s+/).filter(Boolean).reduce((a, w) => { if (a.length && /^[!?:;»…]+$/.test(w)) a[a.length - 1] += '\u202f' + w; else a.push(w); return a; }, []), wt = w => w.length + 1 + (/[.!?…]$/.test(w) ? 6 : /[,;:]$/.test(w) ? 3 : 0);
    const sum = ws.reduce((s, w) => s + wt(w), 0), D = l.pd && l.pd.length === P.length ? l.pd[pi] : tot * (comEst({ parts: [[txt, e]] }) / Math.max(0.1, comEst(l)));
    ws.forEach((w, i) => { out.push({ w: w.toUpperCase(), t, e, end: i === ws.length - 1 }); t += D * wt(w) / Math.max(1, sum); });
  });
  return (l.cw = out);
}
/* découpe en groupes : au plus 2 lignes et 7 mots, coupés de préférence à la ponctuation (jamais un mot orphelin d'une phrase) */
function comCapChunks(g, l, maxW) {
  if (l.cc && l.ccW === maxW) return l.cc;
  const ws = comCapWords(l), out = [];
  g.font = `900 ${CAP.fs}px ${HF.t}`; const sp = g.measureText(' ').width * 1.5 + 6, wd = x => g.measureText(x.w).width;
  // lignes nécessaires pour une suite de mots (retour à la ligne automatique)
  const nLines = a => { let n = 1, lw = 0; for (const x of a) { const w = wd(x); if (lw && lw + sp + w > maxW) { n++; lw = w; } else lw += (lw ? sp : 0) + w; } return n; };
  const fits = a => a.length <= 7 && nLines(a) <= 2;
  // phrases : coupées après la ponctuation
  const ph = []; let cur = [];
  ws.forEach(x => { cur.push(x); if (/[.!?…,:;]$/.test(x.w)) { ph.push(cur); cur = []; } });
  if (cur.length) ph.push(cur);
  let ch = [];
  for (const p of ph) {
    if (fits([...ch, ...p])) { ch.push(...p); continue; }
    if (ch.length) { out.push(ch); ch = []; }
    if (fits(p)) { ch = [...p]; continue; }
    const k = Math.ceil(p.length / Math.ceil(p.length / 5));   // phrase trop longue : morceaux égaux
    for (let i = 0; i < p.length; i += k) { const piece = p.slice(i, i + k); if (i + k < p.length) out.push(piece); else ch = piece; }
  }
  if (ch.length) out.push(ch);
  for (const c of out) { let lw = 0; c.forEach((x, i) => { const w = wd(x); x.br = !!(i && lw + sp + w > maxW); lw = x.br ? w : lw + (i ? sp : 0) + w; }); }
  l.ccW = maxW; return (l.cc = out);
}
function comCaption(g, t, cx, y, maxW) {
  const cur = COM.cur; if (!cur || !cur.line || cur.vt == null || !COM.on) return;
  const l = cur.line, el = t - cur.vt; if (el < 0 || el > cur.dur + 0.4) return;
  const ws = comCapWords(l), now = el;
  let wi = 0; for (let i = 0; i < ws.length; i++) if (ws[i].t <= now) wi = i;
  const chunks = comCapChunks(g, l, maxW), ci = chunks.findIndex(c => c.includes(ws[wi])), C = chunks[Math.max(0, ci)];
  if (!C) return;
  g.save();
  g.font = `900 ${CAP.fs}px ${HF.t}`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const sp = g.measureText(' ').width * 1.5 + 6, rows = []; for (const x of C) { if (x.br || !rows.length) rows.push([]); rows[rows.length - 1].push(x); }
  const pop = clamp((now - C[0].t) / 0.12, 0, 1), sc0 = 0.82 + 0.18 * pop;   // chaque groupe de mots arrive en « pop »
  rows.forEach((r, ri) => {
    const wd = r.map(x => g.measureText(x.w).width), tw = wd.reduce((s, w) => s + w, 0) + sp * (r.length - 1);
    let x = cx - tw / 2; const yy = y + ri * CAP.lh + CAP.lh / 2;
    r.forEach((w, j) => {
      const on = w === ws[wi], said = ws.indexOf(w) <= wi, hot = w.e >= 3;
      const s = sc0 * (on ? 1 + 0.12 * clamp(1 - (now - w.t) / 0.18, 0, 1) : 1);
      g.save(); g.translate(x + wd[j] / 2, yy); g.scale(s, s);
      g.lineWidth = 11; g.strokeStyle = 'rgba(0,0,0,.92)'; g.strokeText(w.w, -wd[j] / 2, 0);
      g.fillStyle = on ? (hot ? '#ff3b30' : '#ffd400') : said ? '#fff' : 'rgba(255,255,255,.88)';
      g.fillText(w.w, -wd[j] / 2, 0);
      g.restore();
      x += wd[j] + sp;
    });
  });
  g.restore();
}
/* boutons du lecteur : commentaire oui / non, choix de la voix */
function comButtons() {
  const b = $('#hl-com'), v = $('#hl-voice'); if (!b) return;
  b.dataset.noi18n = ''; v.dataset.noi18n = '';
  b.textContent = COM.on ? L('🎙 Commentaire : oui', '🎙 Commentary: on') : L('🎙 Commentaire : non', '🎙 Commentary: off');
  b.setAttribute('aria-pressed', COM.on);
  const vs = COM.on ? comVoices() : [], i = Math.max(0, vs.indexOf(COM.voice[comLang()]));
  v.hidden = vs.length < 2; v.textContent = L(`🗣 Voix ${i + 1}/${vs.length}`, `🗣 Voice ${i + 1}/${vs.length}`);
}
function comRebuild() {
  if (VID.on) comSet(comVidLines()); else if (HL.on) comSet(comHLLines()); else comButtons();
}
function comToggle() {
  COM.on = !COM.on; comSave();
  if (!COM.on) { comStop(); COM.gen++; comDone(); comStatus(''); comButtons(); return; }
  comRebuild();
}
function comNextVoice() {
  const vs = comVoices(); if (vs.length < 2) return;
  const lang = comLang(); COM.voice[lang] = vs[(Math.max(0, vs.indexOf(COM.voice[lang])) + 1) % vs.length]; comSave();
  const fired = COM.fired; comRebuild(); COM.fired = fired;
  // aperçu de la voix
  const demo = { t: 0, text: L('Voici ma voix pour la course…|et ça va être SPECTACULAIRE !', 'This is my voice for the race…|and it is going to be SPECTACULAR!'), e: 3, must: true };
  if (comNative()) comSynth(demo).then(b => { demo.buf = b; if (b) comSay(demo); }); else comSay(demo);
}
/* ---- textes : vidéos du championnat (chaque séquence porte sa phrase dans say) ---- */
function comVidLines() { if (VID.noVoice) return []; return VID.segs.filter(s => s.say).map(s => ({ t: s.t0 + (s.sayAt ?? 0.4), text: s.say(), must: !!s.must, seg: s, e: s.e })); }
/* une fois les phrases rendues : chaque séquence dure au moins le temps de sa phrase (rien n'est coupé ni sauté) */
function vidFitVoice() {
  for (const l of COM.lines) if (l.seg && l.buf) { const need = (l.seg.sayAt ?? 0.4) + l.buf.duration + 0.45; if (l.seg.dur < need) l.seg.dur = +need.toFixed(2); }
  let t0 = 0; for (const sg of VID.segs) { sg.t0 = t0; t0 += sg.dur; }
  VID.total = t0;
  for (const l of COM.lines) if (l.seg) l.t = l.seg.t0 + (l.seg.sayAt ?? 0.4);
  COM.lines.sort((a, b) => a.t - b.t);
}
/* ---- textes : highlights de la course ----
   Le commentateur parle presque tout le temps : la phrase de chaque moment (e : énergie de la voix), une montée en tension
   avant l'action, une réaction juste après, et dans les blancs des phrases de « remplissage » tirées de la course
   (écarts, pneus, tours restants…). Les phrases fill sautent si elles tombent sur une autre. */
function comHLLines() {
  const out = []; let t = 0;
  for (const c of HL.clips) {
    let d = hlDur(c); const ls = comClip(c);
    for (const l of (Array.isArray(ls) ? ls : [ls])) {
      if (!l || !l.text) continue;
      const at = clamp(l.at ?? 0.4, 0.15, Math.max(0.2, d - (l.fill ? 0.3 : 1)));
      if (c.kind === 'card') { const need = +(at + comEst(l) + 0.35).toFixed(2); if (c.dur < need) { c.dur = need; d = need; } }   // un carton dure le temps de sa phrase
      out.push(Object.assign({}, l, { t: t + at, at, clip: c }));
    }
    if (c.long || c.kind === 'start') for (const x of comLong(c)) out.push({ ...x, t: t + x.at, clip: c, wait: x.wait ?? 2.5 });
    if (c.marks) comMarks(c).forEach((x, i) => out.push({ ...x, t: t + x.at, clip: c, text: (i === 0 && c.again && !x.fill ? L('Au même moment…|', 'Meanwhile…|') : '') + x.text, wait: x.wait ?? 3.5 }));
    t += d;
  }
  const E = HL.ep, N = E && !E.last ? hlEpisodes()[E.i + 1] : null;
  const ask = V(['Qui va gagner selon toi ? Dis-le en commentaire !', 'Who do you think wins this? Tell me in the comments!'], ['Ton pronostic en commentaire !', 'Drop your prediction in the comments!']);
  out.push({ t: t + 0.4, end: true, e: 2, text: N ? ({ sc: L('Et la safety car va tout relancer…|La suite dans la prochaine partie !', 'And the safety car is about to shake it all up…|More in the next part!'), vsc: L('Et voilà la virtual safety car…|La suite dans la prochaine partie !', 'And here comes the virtual safety car…|More in the next part!'), rain: L('Et la pluie arrive…|La suite dans la prochaine partie, abonne-toi !', 'And here comes the rain…|More in the next part, hit follow!'), dry: L('Et la pluie s\'arrête… qui osera repasser aux slicks ?|La suite dans la prochaine partie !', 'And the rain stops… who gambles on slicks?|More in the next part!') }[E.to] || V([`La suite dans la partie ${N.no} !|Abonne-toi pour ne rien rater !`, `Part ${N.no} is next!|Hit follow so you don't miss it!`], ['Abonne-toi pour ne pas rater la suite !', 'Follow so you don\'t miss what happens next!'])) + ' ' + ask
    : V(['Abonne-toi pour le prochain Grand Prix !', 'Follow for the next Grand Prix!'], ['Rendez-vous au prochain Grand Prix… abonne-toi !', 'See you at the next Grand Prix… hit follow!']) });
  HL.total = t + (HL.endDur || 3);
  comFillers(out);
  out.sort((a, b) => a.t - b.t);
  return comPrune(out, comEst);
}
/* enlève les phrases de remplissage qui tomberaient sur la phrase d'avant (dur : durée d'une phrase) */
function comPrune(lines, dur) {
  let end = -1;
  return lines.filter(l => {
    if (l.fill && l.t < end + 0.2) return false;
    const s = l.must ? l.t : Math.max(l.t, end);
    if (!l.must && s - l.t > (l.wait || 1.5)) return true;   // elle sautera à la lecture
    end = s + dur(l); return true;
  });
}
/* remplit les blancs de chaque moment filmé : une phrase dès qu'il y a ~1,5 s de libre */
function comFillers(out) {
  const iv = out.map(l => [l.t, l.t + comEst(l)]), used = new Map();
  let t = 0;
  for (const c of HL.clips) {
    const d = hlDur(c);
    if (c.kind !== 'card' && !c.hook) {
      let a = t + 0.35;
      for (let k = 0; k < 12 && a < t + d - 1.4; k++) {
        const blk = iv.filter(([x, y]) => x < a + 1.2 && y > a - 0.35).sort((p, q) => q[1] - p[1])[0];
        if (blk) { a = blk[1] + 0.4; continue; }
        const nx = iv.filter(([x]) => x >= a).reduce((m, [x]) => Math.min(m, x), t + d + 0.6), room = nx - a - 0.35;
        if (room < 1.2) { a = nx + 0.1; continue; }
        const l = comFill(c, c.t0 + (a - t), used, room);
        if (!l) break;
        const e = comEst(l);
        out.push(Object.assign(l, { t: a, at: a - t, clip: c, fill: true, wait: 0.5 })); iv.push([a, a + e]);
        a += e + 0.45;
      }
    }
    t += d;
  }
}
const sayG = x => x < 0.95 ? L(Math.round(x * 10) <= 1 ? 'un dixième' : `${Math.round(x * 10)} dixièmes`, `${x.toFixed(1)} seconds`) : L(`${x.toFixed(1).replace('.', ',')} seconde${x >= 1.95 ? 's' : ''}`, `${x.toFixed(1)} seconds`);
/* ce que montre la caméra à l'instant rt d'un moment : la voiture suivie (comme hlStep) et le type de plan */
function hlShotAt(c, rt) {
  const sh = hlShots(c), fr = (rt - c.t0) / Math.max(0.01, c.t1 - c.t0); let k = 0;
  for (let j = 0; j < sh.length; j++) if (fr >= sh[j][1]) k = j;
  return { id: HL.who == null && sh[k][2] != null ? sh[k][2] : c.focus, cam: sh[k][0] };
}
/* une voiture est-elle à l'image ? (la suivie, ou assez près d'elle sur la piste pour être dans le même plan) */
function hlSeen(c, id, rt) {
  const S = hlShotAt(c, rt); if (id === S.id) return true;
  const f = hlFrameAt(rt), d = Math.abs(f.f[id * 7] - f.f[S.id * 7]);
  return d < (S.cam === 'heli' ? 140 : S.cam === 'fixed' ? 90 : 60);
}
/* une phrase sur ce qu'on voit à l'instant rt (la voiture suivie par la caméra, et celles autour d'elle) qui tient dans room secondes */
function comFill(c, rt, used, room) {
  if (rt < R.startT + 12) return null;
  const nm = i => R.cars[i].driver.name, f = hlFrameAt(rt), o = hlOrderAt(rt), id = hlShotAt(c, rt).id;
  const i = o.findIndex(x => x.id === id); if (i < 0) return null;
  const me = o[i], A = nm(id), gap = (p, q) => (p.dist - q.dist) / Math.max(30, q.v), lap = hlLapAt(rt), left = R.laps - lap + 1;
  const C = [], add = (k, cat, e, text) => { if (!used.has(k)) C.push({ k, cat, e, text }); };
  if (/sc|vsc/.test(f.flag || '')) {
    add('sc1', 'sc', 1, L('Tout le monde roule au ralenti… les écarts sont effacés !', 'Everyone is crawling… the gaps are wiped out!'));
    add('sc2', 'sc', 2, L('Le peloton se regroupe… la relance va être chaude !', 'The pack bunches up… the restart is going to be wild!'));
    add(`sc3${id}`, 'sc', 1, i === 0 ? L(`${A} mène et attend la relance…`, `${A} leads and waits for the restart…`) : L(`${A} attend la relance, ${sayNth(i + 1)}.`, `${A} waits for the restart, in ${sayNth(i + 1)}.`));
    add('sc4', 'sc', 1, L('Qui va tenter le coup aux stands ?', 'Who will gamble on a pit stop?'));
    add('sc5', 'sc', 2, L('Tout est à refaire… et ça va attaquer à la relance !', 'It\'s all to play for again… expect fireworks at the restart!'));
  } else {
    const ah0 = o[i - 1], bh0 = o[i + 1], ah = ah0 && hlSeen(c, ah0.id, rt) && hlSeen(c, ah0.id, rt + 1.5) ? ah0 : null, bh = bh0 && hlSeen(c, bh0.id, rt) && hlSeen(c, bh0.id, rt + 1.5) ? bh0 : null;   // on ne parle que des voitures à l'image
    const ga = ah ? gap(ah, me) : 99, gb = bh ? gap(me, bh) : 99, wv = clamp(f.f[id * 7 + 6] || 0, 0, 1), kmh = Math.round(me.v * 3.6);
    if (c.kind === 'pit' && c.focus === id) {   // l'arrêt aux stands en direct
      if (me.pit) { add(`pt${id}a${lap}`, 'pit', 1, V(['Les mécaniciens sont prêts…', 'The mechanics are ready…'], ['Tout se joue sur cet arrêt…', 'It all comes down to this stop…'])); add(`pt${id}b${lap}`, 'pit', 2, L('Où va-t-il ressortir ?', 'Where will he come out?')); }
      else add(`pt${id}c${lap}`, 'pit', 1, L(`${A} plonge vers la voie des stands…`, `${A} dives into the pit lane…`));
    }
    const gp = R.cars[id].gridPos - (i + 1), mate = ah && R.cars[ah.id].team.name === R.cars[id].team.name;
    if (left === 1) add('ll', 'laps', 3, V(['Dernier tour ! Tout se joue maintenant !', 'Last lap! It all comes down to this!'], ['Cloche ! Dernier tour !', 'There\'s the bell! Last lap!']));
    if (ah && !ah.pit && !me.pit && ga < 1) add(`gf${id}-${lap}`, 'gap', 2, V([`${A} est collé à ${nm(ah.id)} ! ${sayG(ga)} seulement !`, `${A} is glued to ${nm(ah.id)}! Just ${sayG(ga)}!`], [`${A} est dans l'aspiration de ${nm(ah.id)}…`, `${A} is in the slipstream of ${nm(ah.id)}…`], [`${A} met une pression énorme sur ${nm(ah.id)} !`, `${A} is piling the pressure on ${nm(ah.id)}!`]));
    if (ah && !ah.pit && !me.pit && ga < 0.35) add(`ww${id}-${lap}`, 'gap', 3, V(['Roue contre roue !', 'Wheel to wheel!'], ['Ils sont côte à côte !', 'They\'re side by side!']));
    if (mate && !ah.pit && !me.pit && ga < 1.5) add(`tm${id}-${lap}`, 'gap', 2, L(`Duel entre coéquipiers : ${A} contre ${nm(ah.id)} !`, `Teammate fight: ${A} against ${nm(ah.id)}!`));
    if (wv > 0.72) add('w' + id, 'tyre', 2, L(`Les pneus ${deN(A)} sont à bout… ${Math.round(wv * 100)} % d'usure !`, `${A}'s tyres are finished… ${Math.round(wv * 100)} % worn!`));
    if (bh && !bh.pit && !me.pit && gb < 0.9) add(`gb${id}-${lap}`, 'gap', 1, V([`Mais attention, ${nm(bh.id)} est juste derrière !`, `But watch out, ${nm(bh.id)} is right behind!`], [`Et ${nm(bh.id)} pousse derrière, à ${sayG(gb)} !`, `And ${nm(bh.id)} is pushing behind, ${sayG(gb)} back!`]));
    if (gp >= 3) add('pg' + id, 'pos', 2, L(`${A} a déjà gagné ${gp} places depuis le départ !`, `${A} has gained ${gp} places since the start!`));
    else if (gp <= -3) add('pl' + id, 'pos', 1, L(`${A} a perdu ${-gp} places depuis le départ…`, `${A} has lost ${-gp} places since the start…`));
    if (left > 1 && lap >= 2 && left <= Math.min(5, Math.ceil(R.laps * 0.4))) add('l' + left, 'laps', 2, L(`Plus que ${left} tours !`, `${left} laps to go!`));
    if (ah && !ah.pit && !me.pit && ga >= 1 && ga < 2.6) add(`gm${id}-${lap}`, 'gap', 1, V([`${A} revient sur ${nm(ah.id)} : ${sayG(ga)}.`, `${A} is reeling in ${nm(ah.id)}: ${sayG(ga)}.`], [`${sayG(ga)} entre ${A} et ${nm(ah.id)}… ça se rapproche !`, `${sayG(ga)} between ${A} and ${nm(ah.id)}… it's closing!`]));
    if (i === 0 && bh0 && gap(me, bh0) >= 0.9) { const g0 = gap(me, bh0); add(`ld-${lap}`, 'gap', 1, V([`${A} en tête, avec ${sayG(g0)} d'avance.`, `${A} leads by ${sayG(g0)}.`], [`${A} contrôle la course devant.`, `${A} is in control out front.`])); }
    if ((f.wet || 0) > 0.35) add('wet' + lap, 'wx', 1, V(['La piste est trempée, ça glisse de partout !', 'The track is soaking, it\'s slippery everywhere!'], ['Avec cette pluie, la moindre erreur se paie cash !', 'In this rain, one mistake and it\'s over!']));
    const st = HL.pd && HL.pd.stints[id].filter(s => s.t <= rt).pop(), age = st ? Math.floor((me.dist - hlFrameAt(st.t).f[id * 7]) / T.L) : 0;
    if (st && age >= 3 && sayTyre(st.ty)) add(`ty${id}-${st.t}`, 'tyre', 0, L(`${A} est en ${sayTyre(st.ty)} depuis ${age} tours.`, `${A} has been on the ${sayTyre(st.ty)} for ${age} laps.`));
    if (wv > 0.5 && wv <= 0.72 && left > 3) add('pw' + id, 'tyre', 1, L(`Il va bientôt falloir s'arrêter pour ${A}…`, `${A} will need to pit soon…`));
    if (kmh >= 300) add('spd' + id, 'spd', 1, V([`${A} lancé à ${kmh} kilomètres-heure !`, `${A} flat out at ${kmh} k p h!`], [`Plus de 300 à l'heure en ligne droite !`, `Over 300 k p h down the straight!`]));
    if (/overtake|battle|run|lead/.test(c.kind)) add('hy' + lap, 'hype', 2, V(['Quelle course !', 'What a race!'], ['Ça bataille à tous les étages !', 'There\'s a fight everywhere you look!'], ['Ça ne lâche rien !', 'Nobody is giving an inch!']));
    if (left > 1) add(`p${id}-${lap}`, 'pos', 0, i === 0 ? L(`Tour ${lap} sur ${R.laps}, ${A} mène toujours.`, `Lap ${lap} of ${R.laps}, ${A} still leads.`) : L(`Tour ${lap} sur ${R.laps}, et ${A} pointe ${sayNth(i + 1)}.`, `Lap ${lap} of ${R.laps}, and ${A} runs ${sayNth(i + 1)}.`));
  }
  const last = used.get('_cat');
  for (const x of [...C.filter(x => x.cat !== last), ...C.filter(x => x.cat === last)]) {
    if ((used.get('#' + x.cat) || 0) >= ({ spd: 2, wx: 3, sc: 5, hype: 2 }[x.cat] || 99)) continue;
    const l = { text: x.text, e: x.e };
    if (comEst(l) > room) { delete l.parts; continue; }
    used.set(x.k, 1); used.set('_cat', x.cat); used.set('#' + x.cat, (used.get('#' + x.cat) || 0) + 1);
    return l;
  }
  return null;
}
/* le long plan du départ : une phrase pour le premier virage et pour chaque dépassement (les suivantes attendent la fin de la précédente) */
function comLong(c) {
  const out = [], st = R.startT, nm = i => R.cars[i].driver.name, at = x => x - c.t0;
  const pole = R.cars.slice().sort((a, b) => a.gridPos - b.gridPos)[0], o = hlOrderAt(st + 11), lead = o[0] && R.cars[o[0].id];
  out.push({ at: at(st + 3.2), e: 2, fill: true, text: V(['Ça frotte au premier freinage !', 'It\'s tight into the first braking zone!'], ['Tout le peloton plonge vers le premier virage !', 'The whole pack dives towards turn one!']) });
  if (lead && !(hlSeen(c, lead.id, st + 8.5) && hlSeen(c, lead.id, st + 10.5))) out.push({ at: at(st + 8.5), e: 2, fill: true, text: V(['Ça bataille dans le peloton !', 'It\'s a scrap in the pack!'], ['Ça se bouscule au milieu du peloton !', 'They\'re jostling in the midfield!']) });   // le leader n'est pas à l'image
  else if (lead) out.push({ at: at(st + 8.5), e: lead.id === pole.id ? 2 : 3, text: lead.id === pole.id ? V([`${nm(lead.id)} garde la tête au premier virage !`, `${nm(lead.id)} keeps the lead into turn one!`], [`Départ parfait ${deN(nm(lead.id))}, qui reste devant !`, `Perfect start from ${nm(lead.id)}, still in front!`]) : L(`Quel départ ${deN(nm(lead.id))} !|Il prend la tête à ${nm(pole.id)} !`, `What a start from ${nm(lead.id)}!|He takes the lead from ${nm(pole.id)}!`) });
  let last = st + 9;
  for (const e of R.events) {
    if (e.type !== 'overtake' || e.cars.length < 2 || e.t < st + 12 || e.t > c.t1 - 1.5 || e.t - last < 2.5) continue;
    if (!hlSeen(c, e.cars[0], e.t) || !hlSeen(c, e.cars[0], e.t - 1.2)) continue;   // seulement les dépassements qu'on voit
    const pos = +(/P(\d+)/.exec(e.msg) || [0, 99])[1];
    const A = nm(e.cars[0]), B = nm(e.cars[1]);
    out.push({ at: at(e.t) - 1.2, e: pos <= 3 ? 3 : 2, text: pos === 1 ? L(`${A} prend la tête à ${B} !`, `${A} takes the lead from ${B}!`) : V([`${A} passe ${B} !`, `${A} gets past ${B}!`], [`${A} prend la ${sayNth(pos)} place à ${B} !`, `${A} takes ${sayNth(pos)} from ${B}!`], [`Et ${A} déborde ${B} !`, `And ${A} goes round ${B}!`]) });
    last = e.t;
  }
  return out;
}
/* une fois les phrases rendues : un carton dure au moins le temps de sa phrase, et la fin attend la dernière */
function hlFitVoice() {
  const dur = l => l.buf ? l.buf.duration : comEst(l);
  for (const l of COM.lines) if (l.clip && l.buf && l.clip.kind === 'card') { const need = l.at + l.buf.duration + 0.35; if (l.clip.dur < need) l.clip.dur = +need.toFixed(2); }
  const starts = new Map(); let t = 0;
  for (const c of HL.clips) { starts.set(c, t); t += hlDur(c); }
  for (const l of COM.lines) { if (l.clip) l.t = starts.get(l.clip) + l.at; else if (l.end) l.t = t + 0.4; }
  const endL = COM.lines.find(l => l.end);
  HL.endDur = Math.max(3, endL && endL.buf ? endL.buf.duration + 1.2 : 3);
  HL.total = t + HL.endDur;
  COM.lines.sort((a, b) => a.t - b.t);
  COM.lines = comPrune(COM.lines, dur);   // durées réelles : les remplissages qui tombent sur une autre phrase sautent
}
/* une phrase par dépassement (avec la montée en tension juste avant et la réaction juste après) ; plusieurs dépassements presque en même temps : une seule phrase */
function comMarks(c) {
  const nm = i => R.cars[i].driver.name, out = [], M = c.marks;
  for (let i = 0; i < M.length;) {
    const grp = [M[i]]; while (M[i + grp.length] && M[i + grp.length].at - grp[grp.length - 1].at < 2.2) grp.push(M[i + grp.length]);
    i += grp.length;
    const at = Math.max(0.3, grp[0].at - c.t0 - 0.6), v = grp[0].vic[0], big = grp.some(x => x.n >= 2 || x.pos <= 3 || /DERNIER|LAST/.test(x.title)), e = big ? 3 : 2;
    if (at >= 2.4 && hlSeen(c, grp[0].a, c.t0 + at - 2.3) && hlSeen(c, v, c.t0 + at - 2.3)) out.push({ at: at - 2.3, e: 1, fill: true, text: V([`${nm(grp[0].a)} revient sur ${nm(v)}…`, `${nm(grp[0].a)} is closing on ${nm(v)}…`], [`${nm(grp[0].a)} prépare son attaque…`, `${nm(grp[0].a)} is lining up a move…`], [`Regardez ${nm(grp[0].a)}…`, `Watch ${nm(grp[0].a)}…`]) });
    if (grp.length === 1) out.push({ at, e, text: comMark(grp[0]) });
    else if (grp.every(x => x.n === 1 && x.vic[0] === v)) out.push({ at, e: 3, text: grp.length === 2 ? L(`${nm(grp[0].a)} et ${nm(grp[1].a)}… passent tous les deux ${nm(v)} !`, `${nm(grp[0].a)} and ${nm(grp[1].a)}… both get past ${nm(v)}!`) : L(`${andList(grp.map(x => nm(x.a)))} passent tous ${nm(v)} !`, `${andList(grp.map(x => nm(x.a)))} all get past ${nm(v)}!`) });
    else if (grp.length === 2) out.push({ at, e: 3, text: grp.map(x => comMark(x, true)).join(' ') });
    else {   // trois dépassements ou plus en même temps : le plus important, puis ceux qui gagnent aussi des places
      const best = grp.slice().sort((x, y) => y.n - x.n || x.pos - y.pos)[0], rest = [...new Set(grp.filter(x => x !== best).map(x => nm(x.a)))];
      const names = rest.length > 3 ? [...rest.slice(0, 3), L(`${rest.length - 3} autres`, `${rest.length - 3} more`)] : rest;
      out.push({ at, e: 3, text: comMark(best, best.n === 1 && best.pos > 3) + ' ' + L(`Et ça bouge aussi pour ${andList(names)} !`, `And ${andList(names)} move up too!`) });
    }
    const lastT = grp[grp.length - 1].t - c.t0;
    out.push({ at: lastT + 0.5, e: big ? 3 : 2, fill: true, text: comWow(big) });
  }
  return out;
}
const comWow = big => big ? V(['Incroyable !', 'Incredible!'], ['Quelle manœuvre !', 'What a move!'], ['Énorme !', 'Huge!'], ['Il l\'a fait !', 'He\'s done it!']) : V(['Propre !', 'Clean!'], ['Superbe !', 'Superb!'], ['Bien joué !', 'Nicely done!'], ['Quel culot !', 'What nerve!'], ['Joli coup !', 'Lovely move!']);
function comMark(m, short) {
  const nm = i => R.cars[i].driver.name, A = nm(m.a), B = nm(m.vic[0]), Bs = andList(m.vic.map(nm)), ll = /DERNIER|LAST/.test(m.title || '');
  if (m.n >= 4) return L(`${A} passe ${m.n} voitures d'un coup !|C'est incroyable !`, `${A} passes ${m.n} cars in one go!|Unbelievable!`);
  if (m.n === 3) return L(`Triple dépassement ${deN(A)} !|${Bs}, tous passés !`, `Triple overtake from ${A}!|${Bs}, all gone!`);
  if (m.n === 2) return V([`Double dépassement ${deN(A)} !|${Bs} d'un coup !`, `Double overtake from ${A}!|${Bs} in one go!`], [`${A} passe ${Bs}…|d'un seul coup !`, `${A} takes ${Bs}…|in one move!`]);
  if (short) return L(`${A} passe ${B} !`, `${A} passes ${B}!`);
  if (m.pos === 1) return V([`${A} attaque ${B}…|et prend la tête !`, `${A} attacks ${B}…|and takes the lead!`], [`${A} passe ${B}…|pour la tête de la course !`, `${A} gets past ${B}…|for the lead of the race!`]);
  if (m.back) return V([`${A} reprend aussitôt sa place !|Quelle riposte !`, `${A} takes the place straight back!|What a response!`], [`Et ${A} riposte immédiatement !`, `And ${A} hits straight back!`]);
  if (ll) return L(`Dans le dernier tour !|${A} passe ${B} !`, `On the last lap!|${A} gets past ${B}!`);
  if (m.pos <= 3) return V([`${A} passe ${B}…|et monte sur le podium !`, `${A} gets past ${B}…|and into a podium place!`], [`${A} plonge à l'intérieur…|et prend la ${sayNth(m.pos)} place !`, `${A} dives down the inside…|and takes ${sayNth(m.pos)}!`]);
  return V([`${A} passe ${B} !`, `${A} goes past ${B}!`], [`Et ${A} déborde ${B} !|${sayNth(m.pos)} place !`, `And ${A} goes round ${B}!|Up to ${sayNth(m.pos)}!`], [`${A} plonge à l'intérieur…|et ça passe !`, `${A} dives down the inside…|and it sticks!`], [`Attaque ${deN(A)} sur ${B}…|ça passe !`, `${A} attacks ${B}…|and he's through!`]);
}
const deN = n => (/^[aeiouyhàâäéèêëîïôöûü]/i.test(n) ? 'd\'' : 'de ') + n;   // « d'Aaron », « de Paul »
const sayTyre = ty => ({ S: L('tendres', 'softs'), M: L('mediums', 'mediums'), H: L('durs', 'hards'), I: L('intermédiaires', 'inters'), W: L('pneus pluie', 'full wets') })[ty] || '';
/* accroche du début de la vidéo : seulement quand le moment est vraiment fort (accident, prise de la tête, dépassement multiple, dernier tour) */
function comClip(c) {
  const Cs = R.cars, nm = i => (Cs[i] ? Cs[i].driver.name : ''), ctx = R.hlCtx || {}, A = nm(c.focus), B = c.rival != null ? nm(c.rival) : '';
  if (c.hook) return { at: 0.15, e: 3, must: true, text: c.hookWhy === 'crash' ? V(['Oh non… regardez ça !', 'Oh no… look at this!'], ['Attention… ça va très mal finir !', 'Watch this… it ends in disaster!']) : c.hookWhy === 'lead' ? V(['Regardez ça… pour la tête de la course !', 'Look at this… for the lead of the race!'], ['La tête de la course va changer… regardez !', 'The lead is about to change… watch!']) : c.hookWhy === 'last' ? L('Dans le dernier tour… regardez ça !', 'On the last lap… look at this!') : V(['Regardez bien… plusieurs voitures d\'un coup !', 'Watch closely… several cars in one move!'], ['Attendez de voir ça…', 'Wait until you see this…']) };
  if (c.kind === 'card') {
    switch (c.card) {
      case 'title': {
        const circ = tr(T.circ.name);
        if (c.ep) return { at: 0.2, must: true, es: [2, 3], text: (ctx.champ ? L(`Épisode ${ctx.champ.round}, ${circ} !`, `Episode ${ctx.champ.round}, ${circ}!`) : L(`Grand Prix : ${circ}, ${R.laps} tours !`, `Grand Prix: ${circ}, ${R.laps} laps!`)) + '|' + L(`Partie ${c.ep.no}… le départ !`, `Part ${c.ep.no}… the start!`) };
        const nOt = R.events.filter(e => e.type === 'overtake').length, F = hlFinal().rows, nDnf = R.cars.filter(x => F[x.id] && F[x.id].out).length, nSc = R.events.filter(e => e.type === 'sc' && /DÉPLOYÉE/.test(e.msg)).length;
        const head = ctx.champ ? L(`Manche ${ctx.champ.round} : ${circ} !`, `Round ${ctx.champ.round}: ${circ}!`) : L(`${circ}, ${R.laps} tours !`, `${circ}, ${R.laps} laps!`);
        const facts = [nOt >= 6 ? L(`${nOt} dépassements`, `${nOt} overtakes`) : '', nDnf ? L(`${nDnf} abandon${nDnf > 1 ? 's' : ''}`, `${nDnf} retirement${nDnf > 1 ? 's' : ''}`) : '', nSc ? L('la safety car', 'the safety car') : ''].filter(Boolean);
        return { at: 0.2, must: true, es: [2, 3], text: head + '|' + (facts.length ? andList(facts) + L('… voici les temps forts !', '… here are the highlights!') : L('Voici les temps forts !', 'Here are the highlights!')) };
      }
      case 'champ': { const d = ctx.champ && ctx.champ.d[0], d2 = ctx.champ && ctx.champ.d[1]; return d && d.pts > 0 ? { e: 1, at: 0.2, text: L(`${d.name} arrive en leader du championnat, ${d.pts} points`, `${d.name} arrives as championship leader on ${d.pts} points`) + (d2 && d.pts - d2.pts <= 12 ? L(`… mais ${d2.name} n'est qu'à ${d.pts - d2.pts} !`, `… but ${d2.name} is only ${d.pts - d2.pts} behind!`) : '.') } : null; }
      case 'perf': { const P = ctx.perf || []; return P.length > 1 ? { e: 1, at: 0.2, text: L(`Sur le papier, ${P[0].name} a la voiture la plus rapide… ${P[1].name} n'est pas loin !`, `On paper, ${P[0].name} has the fastest car… ${P[1].name} isn't far off!`) } : null; }
      case 'grid': { const p = Cs.slice().sort((x, y) => x.gridPos - y.gridPos); return { at: 0.2, es: [2, 1], text: V([`${p[0].driver.name} en pole position !|${p[1].driver.name} à ses côtés, le duel peut commencer.`, `${p[0].driver.name} on pole!|${p[1].driver.name} alongside, let the duel begin.`], [`Pole position pour ${p[0].driver.name} !|${p[1].driver.name} juste à côté…`, `Pole for ${p[0].driver.name}!|${p[1].driver.name} right alongside…`]) }; }
      case 'lap1': if (c.ep) {
        const now = hlOrderAt(c.at), mv = now.map((x, i) => ({ id: x.id, d: Cs[x.id].gridPos - (i + 1) })).sort((p, q) => q.d - p.d), up = mv[0], dn = mv[mv.length - 1];
        return { at: 0.2, e: 2, text: L(`Après le départ, ${now[0] ? nm(now[0].id) : ''} est en tête !`, `After the start, ${now[0] ? nm(now[0].id) : ''} leads!`) + (up && up.d >= 2 ? ' ' + L(`Énorme départ ${deN(nm(up.id))}, ${up.d} places gagnées`, `Huge start from ${nm(up.id)}, ${up.d} places gained`) + (dn && dn.d <= -2 ? L(`… et dur pour ${nm(dn.id)}, qui en perd ${-dn.d}.`, `… and a nightmare for ${nm(dn.id)}, down ${-dn.d}.`) : ' !') : '') };
      } else {
        const now = hlOrderAt(c.at), lead = now[0] ? nm(now[0].id) : '', mv = now.map((x, i) => ({ id: x.id, d: Cs[x.id].gridPos - (i + 1) })).sort((p, q) => q.d - p.d)[0];
        return { at: 0.2, e: 2, text: L(`Fin du premier tour : ${lead} en tête !`, `End of lap one: ${lead} leads!`) + (mv && mv.d >= 3 ? ' ' + L(`${nm(mv.id)} a déjà gagné ${mv.d} places !`, `${nm(mv.id)} has already gained ${mv.d} places!`) : '') };
      }
      case 'stint': {
        const E = c.ep, o = hlOrderAt(c.at), a1 = o[0] ? nm(o[0].id) : '', a2 = o[1] ? nm(o[1].id) : '';
        const g12 = o[1] ? (o[0].dist - o[1].dist) / Math.max(30, o[1].v) : 99, nDnf = (E.body || []).filter(x => x.kind === 'crash' && /ABANDON/.test(x.title || '')).length;
        const why = { sc: L('Safety car en piste !', 'Safety car out!'), vsc: L('Virtual safety car !', 'Virtual safety car!'), rain: L('La pluie tombe !', 'Rain is falling!'), dry: L('La piste sèche !', 'The track is drying!') }[E.from];
        const head = L(`Partie ${E.no} !`, `Part ${E.no}!`) + (why ? ' ' + why : E.nOt >= 3 || nDnf ? '' : ' ' + L(`Tours ${E.lapA} à ${E.lapB}.`, `Laps ${E.lapA} to ${E.lapB}.`));
        const lead = g12 < 1.5 ? L(`${a1} en tête… mais ${a2} est à ${sayG(g12)} !`, `${a1} leads… but ${a2} is just ${sayG(g12)} behind!`) : L(`${a1} mène devant ${a2}.`, `${a1} leads from ${a2}.`);
        const tease = E.nOt >= 3 || nDnf ? ' ' + L(`Au programme : ${andList([E.nOt >= 3 ? `${E.nOt} dépassements` : '', nDnf ? `${nDnf} abandon${nDnf > 1 ? 's' : ''}` : ''].filter(Boolean))} !`, `Coming up: ${andList([E.nOt >= 3 ? `${E.nOt} overtakes` : '', nDnf ? `${nDnf} retirement${nDnf > 1 ? 's' : ''}` : ''].filter(Boolean))}!`) : '';
        return { at: 0.2, must: true, es: [2, 1], text: head + '|' + lead + tease };
      }
      case 'stintEnd': {
        const E = c.ep, o = hlOrderAt(c.at), o0 = hlOrderAt(E.t0 + 0.5), lead = o[0] ? o[0].id : null, l0 = o0[0] ? o0[0].id : null;
        const mv = o.slice(0, 12).map((x, i) => ({ id: x.id, d: (o0.findIndex(z => z.id === x.id) + 1 || i + 1) - (i + 1) })).sort((p, q) => q.d - p.d)[0];
        return { at: 0.2, must: true, e: 1, text: (E.kn > 1 && E.k < E.kn ? L('Le point : ', 'Where we are: ') : L('Fin du relais : ', 'End of the stint: ')) + (lead === l0 ? L(`${nm(lead)} toujours en tête.`, `${nm(lead)} still in front.`) : L(`${nm(lead)} a pris la tête !`, `${nm(lead)} has taken the lead!`))
          + (mv && mv.d >= 2 && mv.id !== lead ? ' ' + L(`Et ${nm(mv.id)} a gagné ${mv.d} places !`, `And ${nm(mv.id)} has gained ${mv.d} places!`) : '') };
      }
      case 'strat': { const o = hlOrderAt(c.at); return { at: 0.2, e: 1, text: L(`Mi-course : ${o[0] ? nm(o[0].id) : ''} mène la danse. Le point stratégie !`, `Halfway: ${o[0] ? nm(o[0].id) : ''} leads the way. Strategy check!`) }; }
      case 'results': { const o = finalOrder(); return { at: 0.2, must: true, es: [3, 1], text: L(`Victoire ${deN(o[0].driver.name)} !|${o[1] ? o[1].driver.name + ' deuxième' : ''}${o[2] ? ', ' + o[2].driver.name + ' complète le podium.' : '.'}`, `Victory for ${o[0].driver.name}!|${o[1] ? o[1].driver.name + ' second' : ''}${o[2] ? ', and ' + o[2].driver.name + ' completes the podium.' : '.'}`) }; }
      case 'champ2': {
        if (!ctx.champ) return null;
        const rows = ctx.champ.d.map(d => ({ ...d })), F = hlFinal().rows;
        finalOrder().forEach((o, i) => { const r = rows.find(x => x.name === o.driver.name); if (r && !F[o.id].out && !F[o.id].dsq) r.pts += POINTS[i] || 0; });
        rows.sort((a, b) => b.pts - a.pts);
        const dd = rows[1] ? rows[0].pts - rows[1].pts : 99;
        return { at: 0.2, e: dd <= 10 ? 2 : 1, text: L(`Au championnat, ${rows[0].name} mène avec ${rows[0].pts} points`, `In the championship, ${rows[0].name} leads on ${rows[0].pts} points`) + (rows[1] ? dd <= 10 ? L(`… et seulement ${dd} d'avance sur ${rows[1].name} !`, `… just ${dd} clear of ${rows[1].name}!`) : L(`, ${dd} de plus que ${rows[1].name}.`, `, ${dd} clear of ${rows[1].name}.`) : '.') };
      }
      case 'champT': {
        const rows = hlTeamRows(); if (!rows.length) return null;
        return { at: 0.2, e: 1, text: ctx.champ ? L(`Chez les constructeurs, ${rows[0].name} mène avec ${rows[0].pts} points${rows[1] ? `, devant ${rows[1].name}` : ''}.`, `In the constructors' standings, ${rows[0].name} lead on ${rows[0].pts} points${rows[1] ? `, ahead of ${rows[1].name}` : ''}.`)
          : L(`Chez les constructeurs, ${rows[0].name} marque ${rows[0].gain} points aujourd'hui.`, `Among the constructors, ${rows[0].name} score ${rows[0].gain} points today.`) };
      }
      case 'driver': return { at: 0.2, must: true, e: 2, text: L(`Voici la course ${deN(A)}, parti ${sayNth(Cs[c.focus].gridPos)} !`, `Here's ${A}'s race, from ${sayNth(Cs[c.focus].gridPos)} on the grid!`) };
      case 'driverEnd': { const F = hlFinal().rows[c.focus], p = hlFinal().ids.indexOf(c.focus) + 1, d = Cs[c.focus].gridPos - p; return { at: 0.2, must: true, e: F.out || F.dsq ? 1 : p <= 3 || d >= 3 ? 3 : 1, text: F.out || F.dsq ? L(`Une course difficile pour ${A}, qui ne voit pas l'arrivée.`, `A tough day for ${A}, who doesn't make the finish.`) : L(`${A} termine ${sayNth(p)}`, `${A} finishes ${sayNth(p)}`) + (d >= 3 ? L(`… ${d} places gagnées !`, `… ${d} places gained!`) : p <= 3 ? L(' sur le podium !', ' on the podium!') : '.') }; }
    }
    return null;
  }
  const at = x => x - c.t0;
  switch (c.kind) {
    case 'start': {
      const a = at(R.startT), out = [{ at: a - 0.1, must: true, e: 3, text: V(['Extinction des feux…|et c\'est parti !', 'Lights out…|and away we go!'], ['Les feux s\'éteignent…|c\'est parti !', 'The lights go out…|and we\'re racing!']) }];
      if (a - 2.3 >= 0.15) out.unshift({ at: a - 2.3, e: 1, fill: true, text: V(['Les feux rouges s\'allument…', 'The red lights come on…'], ['Tout le monde est prêt…', 'Everyone is ready…']) });
      return out;
    }
    case 'overtake': {
      if (c.marks) return null;   // chaque dépassement a sa phrase (comMarks)
      if (/REMONT/.test(c.title || '')) return { at: 0.8, e: 3, text: L(`${A} enchaîne les dépassements !|Il est inarrêtable !`, `${A} is carving through the field!|He's unstoppable!`) };
      const e = c.ev != null && R.events.find(x => x.type === 'overtake' && Math.abs(x.t - c.ev) < 1.5 && x.cars.includes(c.focus));
      const P1 = e ? nm(e.cars[0]) : A, P2 = e ? nm(e.cars[1]) : B, big = /TÊTE|LEADER|DOUBLE|TRIPLE|DERNIER/.test(c.title || '');
      const ca = c.ev != null ? at(c.ev) - 1.3 : 1;
      const call = /TÊTE|LEADER/.test(c.title || '') ? L(`${P1} attaque ${P2}…|et prend la tête !`, `${P1} attacks ${P2}…|and takes the lead!`) : /TRIPLE/.test(c.title || '') ? L(`Triple dépassement ${deN(P1)} !`, `Triple overtake from ${P1}!`) : /DOUBLE/.test(c.title || '') ? L(`Double dépassement ${deN(P1)} !|Deux voitures d'un coup !`, `Double overtake from ${P1}!|Two cars in one go!`)
        : /DERNIER/.test(c.title || '') ? L(`Dans le dernier tour !|${P1} passe ${P2} !`, `On the last lap!|${P1} gets past ${P2}!`) : V([`${P1} passe ${P2} !`, `${P1} goes past ${P2}!`], [`${P1} plonge à l'intérieur…|et ça passe !`, `${P1} dives down the inside…|and it sticks!`], [`Attaque ${deN(P1)} sur ${P2}…|ça passe !`, `${P1} attacks ${P2}…|and he's through!`]);
      const out = [{ at: ca, e: big ? 3 : 2, text: call }, { at: ca + 2.9, e: big ? 3 : 2, fill: true, text: comWow(big) }];
      if (ca - 2.4 >= 0.3) out.unshift({ at: ca - 2.4, e: 1, fill: true, text: V([`${P1} revient sur ${P2}…`, `${P1} is closing on ${P2}…`], [`${P1} prépare son attaque…`, `${P1} is lining up a move…`], [`${P1} est dans l'aspiration de ${P2}…`, `${P1} is in ${P2}'s slipstream…`]) });
      return out;
    }
    case 'crash': {
      const a = c.ev != null ? at(c.ev) : 1, out = [];
      if (a - 2.6 >= 0.3 && hlSeen(c, c.focus, c.ev - 2.6)) out.push({ at: a - 2.6, e: 1, fill: true, text: c.rival != null && B ? V(['Attention, ça se resserre…', 'Careful, it\'s getting tight…'], [`${A} et ${B}, roue contre roue…`, `${A} and ${B}, wheel to wheel…`], [`${A} tente quelque chose sur ${B}…`, `${A} tries something on ${B}…`], ['Ça devient chaud au freinage…', 'It\'s getting hot under braking…'], [`Regardez ${A} et ${B}…`, `Watch ${A} and ${B}…`]) : V([`Attention à ${A}…`, `Watch ${A}…`], [`${A} est à la limite…`, `${A} is right on the limit…`]) });
      if (c.also && /sc/.test(c.also.join())) out.push({ at: a, must: true, e: 3, text: (c.rival != null && B ? L(`Oh ! Accrochage entre ${A} et ${B} !`, `Oh! ${A} and ${B} collide!`) : L(`Oh ! ${A} est hors course !`, `Oh! ${A} is out!`)) + '|' + L('Et la safety car entre en piste !', 'And out comes the safety car!') });
      else out.push({ at: a, must: true, e: 3, text: c.rival != null && B ? V([`Oh ! Contact entre ${A} et ${B} !`, `Oh! Contact between ${A} and ${B}!`], [`Oh là là ! ${A} et ${B} se touchent !`, `Oh no! ${A} and ${B} have touched!`], [`Ça touche ! ${A} et ${B} !`, `They've touched! ${A} and ${B}!`], [`Accrochage ! ${A} percute ${B} !`, `Collision! ${A} hits ${B}!`], [`Oh non ! ${A} et ${B}, c'est le choc !`, `Oh no! ${A} and ${B} collide!`]) : V([`Oh ! ${A} est en difficulté !`, `Oh! ${A} is in trouble!`], [`Oh ! Sortie de piste pour ${A} !`, `Oh! ${A} goes off!`]) });
      if (/ABANDON/.test((c.title || '') + (c.sub || ''))) out.push({ at: a + 2.6, e: 1, fill: true, text: V([`C'est terminé pour ${A}…`, `It's all over for ${A}…`], [`Course finie pour ${A}… quelle déception.`, `Race over for ${A}… what a shame.`]) });
      return out;
    }
    case 'sc': return { at: 0.5, must: true, e: 2, text: /VIRTUAL/.test(c.title || '') ? L('Virtual safety car !|Tout le monde ralentit.', 'Virtual safety car!|Everybody slows down.') : L('Safety car !|La course est neutralisée !', 'Safety car!|The race is neutralised!') };
    case 'scpit': return { at: 0.8, e: 2, text: L(`Coup de poker !|${A} plonge aux stands sous neutralisation !`, `Big gamble!|${A} dives into the pits under the neutralisation!`) };
    case 'rain': return { at: 0.5, e: 2, text: /FIN/.test(c.title || '') ? L('La pluie s\'arrête…|qui osera repasser en slicks ?', 'The rain stops…|who dares go back to slicks?') : L('La pluie arrive !|Attention, ça va glisser !', 'Here comes the rain!|Careful, it\'s going to be slippery!') };
    case 'pit': {
      const d = hlDur(c), out = [{ at: 0.4, e: c.pos <= 3 ? 2 : 1, text: V([`${A} rentre aux stands !`, `${A} comes into the pits!`], [`Arrêt aux stands pour ${A} !`, `Pit stop for ${A}!`]) }];
      const m = /([\d.]+) s/.exec(c.sub || '');
      if (c.ty || m) out.push({ at: d - 3.3, e: 1, text: (m ? L(`${m[1].replace('.', ',')} secondes`, `${m[1]} seconds`) : L('Et c\'est reparti', 'And away he goes')) + (c.ty ? L(`, il repart en ${sayTyre(c.ty)} !`, `, back out on the ${sayTyre(c.ty)}!`) : ' !') });
      return out;
    }
    case 'run': {
      const lap = hlLapAt(c.t0 + 6);
      if (c.gap == null || (c.rival != null && !hlSeen(c, c.rival, c.t0 + 1))) return { at: 0.6, e: 1, text: L(`Tour ${lap} pour ${A}, ${sayNth(hlPosAt(c.focus, c.t0 + 6))}.`, `Lap ${lap} for ${A}, running ${sayNth(hlPosAt(c.focus, c.t0 + 6))}.`) };
      return { at: 0.6, e: c.gap < 1 ? 2 : 1, text: c.pos === 2 ? L(`Tour ${lap} : ${A} chasse ${B} pour la tête… ${sayG(c.gap)} d'écart !`, `Lap ${lap}: ${A} hunts ${B} for the lead… ${sayG(c.gap)}!`) : V([`Tour ${lap} : ${A} est à ${sayG(c.gap)} ${deN(B)}.`, `Lap ${lap}: ${A} is ${sayG(c.gap)} behind ${B}.`], [`Tour ${lap}, bagarre pour la ${sayNth(c.pos - 1)} place : ${A} sur ${B} !`, `Lap ${lap}, the fight for ${sayNth(c.pos - 1)}: ${A} on ${B}!`]) };
    }
    case 'undercut': return { at: 0.8, es: [2, 3], text: /OVERCUT/.test(c.title || '') ? L(`L'overcut a marché !|${A} ressort devant ${B} !`, `The overcut works!|${A} comes out ahead of ${B}!`) : L(`L'undercut a marché !|${A} ressort devant ${B} !`, `The undercut has worked!|${A} comes out ahead of ${B}!`) };
    case 'battle': return { at: 0.6, e: 2, text: V([`Quelle bagarre entre ${A} et ${B} !`, `What a battle between ${A} and ${B}!`], [`${A} est collé à ${B}… ça va craquer !`, `${A} is glued to ${B}… something has to give!`]) };
    case 'lead': return { at: 1, must: true, es: [2, 3], text: L(`Changement de leader !|${A} prend la tête !`, `Change of leader!|${A} takes the lead!`) };
    case 'finish': {
      const a = at(Cs[c.focus].finishT), out = [{ at: a - 2.2, must: true, es: [2, 3], text: V([`${A} franchit la ligne…|et remporte le Grand Prix !`, `${A} crosses the line…|and wins the Grand Prix!`], [`Drapeau à damier…|victoire ${deN(A)} !`, `Chequered flag…|victory for ${A}!`]) }, { at: a + 1, e: 3, fill: true, text: V(['Quelle victoire !', 'What a win!'], ['Magnifique !', 'Magnificent!']) }];
      if (a - 5.2 >= 0.3) out.unshift({ at: a - 5.2, e: 2, fill: true, text: V([`Plus que quelques virages pour ${A}…`, `Just a few corners left for ${A}…`], [`${A} est tout près du but…`, `${A} is almost there…`]) });
      return out;
    }
    case 'myfinish': { const p = hlFinal().ids.indexOf(c.focus) + 1; return { at: Math.max(0.5, at(Cs[c.focus].finishT) - 2), e: p <= 3 ? 3 : 1, text: L(`${A} termine ${sayNth(p)}`, `${A} finishes ${sayNth(p)}`) + (p <= 3 ? L(' sur le podium !', ' on the podium!') : '.') }; }
  }
  return null;
}

/* =====================================================================
   REPLAYS SAUVEGARDÉS : la course complète (état final + enregistrement) dans IndexedDB,
   à revoir plus tard (replay, clips, highlights), exportable en fichier .p26r pour ne rien perdre
   ===================================================================== */
const RPL_KEY = 'paddock26-replays';
const rplList = () => { try { return JSON.parse(localStorage.getItem(RPL_KEY) || '[]') || []; } catch (e) { return []; } };
const rplSaveList = l => { try { localStorage.setItem(RPL_KEY, JSON.stringify(l)); } catch (e) { /* stockage plein */ } };
function rplMeta(R0, id) {
  const order = hlFinal().ids.map(i => R0.cars[i]), k = career(), circ = R0.T.circ;
  return { id, circ: circ.id, name: circ.name, flag: circ.flag, at: Date.now(), laps: R0.laps, winner: order[0] ? order[0].driver.name : '',
    podium: order.slice(0, 3).map(c => c.code), career: R0.hlCtx && R0.hlCtx.champ && k ? k.name : '', round: R0.hlCtx && R0.hlCtx.champ ? R0.hlCtx.champ.round : null, engine: SIM.engine };
}
async function saveReplay() {
  if (!R || !R.rec || R.fromSave) return false;
  const id = 'r' + Date.now(), meta = rplMeta(R, id), T0 = R.T;
  R.T = null;
  try { await rsvOp('readwrite', st => st.put({ v: 1, meta, R }, id), 'replays'); }
  catch (e) { R.T = T0; return false; }
  R.T = T0;
  const l = rplList(); l.unshift(meta); rplSaveList(l);
  return true;
}
function setLangBtns() { for (const id of ['#tn-lang', '#hl-lang']) { const b = $(id); b.dataset.noi18n = ''; b.textContent = ST.lang === 'en' ? '🇫🇷 FR' : '🇬🇧 EN'; } }
async function rplLoad(id) {
  try { return await rsvOp('readonly', st => st.get(id), 'replays'); } catch (e) { return null; }
}
async function rplOpen(id) {
  $('#rpl-msg').textContent = 'Chargement…';
  const snap = await rplLoad(id);
  if (!snap || !snap.R) { $('#rpl-msg').textContent = 'Fichier de replay illisible.'; return; }
  $('#rpl-msg').textContent = '';
  const ci = CIRCUITS.findIndex(c => c.id === snap.meta.circ); if (ci < 0) return;
  CH.inRace = false; CH.pending = false;
  ST.circuit = ci; SIM.setEngine(snap.meta.engine || 'hybrid');
  T = getTrack(ci);
  R = snap.R; R.T = T; R.fromSave = true; SIM.uniqueCodes(R.cars); R.over = true; R.resultsShown = true; R.net = null;
  HUM = null; follow = (R.final && R.final.ids[0]) || 0; camMode = 'auto';
  enterView(CIRCUITS[ci]);
  if (SND.ctx) initAudio();
  showResults();
}
async function rplDelete(id) {
  try { await rsvOp('readwrite', st => st.delete(id), 'replays'); } catch (e) { /* déjà supprimé */ }
  rplSaveList(rplList().filter(m => m.id !== id)); renderReplays();
}
function renderReplays() {
  const l = rplList(), box = $('#rpl-list');
  if (!l.length) { box.innerHTML = `<p class="note">Aucun replay sauvegardé. À la fin d’une course, touche « 💾 Sauvegarder le replay ».</p>`; return; }
  const dt = x => new Date(x).toLocaleDateString(ST.lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  box.innerHTML = l.map(m => `<div class="rpl" data-id="${m.id}"><div><b>${m.flag} ${escapeHtml(m.name)}</b><small>${m.career ? escapeHtml(m.career) + ' · ' + L('manche', 'round') + ' ' + m.round + ' · ' : ''}${m.laps} ${L('tours', 'laps')} · ${dt(m.at)}</small><small>🏆 ${escapeHtml(m.winner)} · ${m.podium.join(' · ')}</small></div>
    <div class="acts"><button class="btn go" data-a="open">${L('Regarder', 'Watch')}</button><button class="btn ghost" data-a="exp">${L('Exporter', 'Export')}</button><button class="btn ghost" data-a="del">${L('Supprimer', 'Delete')}</button></div></div>`).join('');
  $$('#rpl-list .rpl').forEach(el => {
    const id = el.dataset.id;
    el.querySelector('[data-a=open]').onclick = () => rplOpen(id);
    el.querySelector('[data-a=exp]').onclick = () => rplExport(id);
    const del = el.querySelector('[data-a=del]');
    del.onclick = () => { if (del.dataset.armed) { rplDelete(id); return; } del.dataset.armed = 1; del.textContent = L('Sûr ?', 'Sure?'); setTimeout(() => { delete del.dataset.armed; del.textContent = L('Supprimer', 'Delete'); }, 3000); };
  });
}
/* ---- fichier .p26r : JSON compressé (gzip), avec tableaux typés, Map, Set et références partagées ---- */
function b64enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function b64dec(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function packObj(root) {
  const ids = new Map(); let n = 0;
  const enc = v => {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : { $n: String(v) };
    if (typeof v !== 'object') return undefined;
    if (ids.has(v)) return { $r: ids.get(v) };
    const id = n++; ids.set(v, id);
    if (ArrayBuffer.isView(v)) return { $i: id, $t: v.constructor.name, b: b64enc(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    if (v instanceof Map) return { $i: id, $m: [...v].map(([k, x]) => [enc(k), enc(x) ?? null]) };
    if (v instanceof Set) return { $i: id, $s: [...v].map(x => enc(x) ?? null) };
    if (Array.isArray(v)) return { $i: id, $a: v.map(x => enc(x) ?? null) };
    const o = { $i: id }; for (const k of Object.keys(v)) { const e = enc(v[k]); if (e !== undefined) o[k] = e; } return o;
  };
  return enc(root);
}
function unpackObj(root) {
  const ref = new Map();
  const dec = v => {
    if (v === null || typeof v !== 'object') return v;
    if ('$n' in v) return Number(v.$n);
    if ('$r' in v) return ref.get(v.$r);
    if ('$t' in v) { const C = globalThis[v.$t], u = b64dec(v.b), out = new C(u.buffer, 0, u.byteLength / (C.BYTES_PER_ELEMENT || 1)); ref.set(v.$i, out); return out; }
    if ('$m' in v) { const m = new Map(); ref.set(v.$i, m); for (const [k, x] of v.$m) m.set(dec(k), dec(x)); return m; }
    if ('$s' in v) { const s = new Set(); ref.set(v.$i, s); for (const x of v.$s) s.add(dec(x)); return s; }
    if ('$a' in v) { const a = []; ref.set(v.$i, a); for (const x of v.$a) a.push(dec(x)); return a; }
    const o = {}; ref.set(v.$i, o); for (const k of Object.keys(v)) if (k !== '$i') o[k] = dec(v[k]); return o;
  };
  return dec(root);
}
async function rplExport(id) {
  const msg = $('#rpl-msg'); msg.textContent = 'Chargement…';
  const snap = await rplLoad(id); if (!snap) { msg.textContent = 'Fichier de replay illisible.'; return; }
  let blob = new Blob([JSON.stringify({ paddock26: 'replay', v: 1, data: packObj(snap) })], { type: 'application/json' });
  if (window.CompressionStream) blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const m = snap.meta, name = `paddock26-${m.circ}-${new Date(m.at).toISOString().slice(0, 10)}-${m.id.slice(-5)}.p26r`;
  await saveFile(new Blob([blob], { type: 'application/octet-stream' }), name, t => { msg.textContent = t; });
}
async function rplImport(file) {
  const msg = $('#rpl-msg'); msg.textContent = 'Chargement…';
  try {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    const gz = head[0] === 0x1f && head[1] === 0x8b;
    const txt = gz ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await file.text();
    const o = JSON.parse(txt); if (!o || o.paddock26 !== 'replay') throw new Error('format');
    const snap = unpackObj(o.data);
    if (!snap || !snap.R || !snap.meta || !CIRCUITS.some(c => c.id === snap.meta.circ)) throw new Error('format');
    if (!rplList().some(m => m.id === snap.meta.id)) {
      await rsvOp('readwrite', st => st.put(snap, snap.meta.id), 'replays');
      const l = rplList(); l.unshift(snap.meta); l.sort((a, b) => b.at - a.at); rplSaveList(l);
    }
    msg.textContent = 'Replay importé ✓'; renderReplays();
  } catch (e) { msg.textContent = 'Fichier de replay illisible.'; }
}
/* enregistre un fichier : appli Android (Téléchargements/Paddock26 ou Films/Paddock26), page publiée, ou téléchargement */
async function saveFile(blob, name, status) {
  const N = window.PaddockNative;
  if (N && N.saveBegin) {
    try {
      N.saveBegin(name, blob.type);
      const CHK = 768 * 1024;
      for (let o = 0; o < blob.size; o += CHK) {
        const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob.slice(o, o + CHK)); });
        N.saveChunk(b64);
        status(`${L('Enregistrement…', 'Saving…')} ${Math.round(Math.min(1, (o + CHK) / blob.size) * 100)} %`);
      }
      status(`${L('Fichier enregistré', 'File saved')} : ${N.saveEnd()}`);
    } catch (e) { status(L('Échec de l’enregistrement', 'Saving failed')); }
    return;
  }
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); status(`${L('Fichier enregistré', 'File saved')} : ${name}`); }
    catch (e) { status(e && e.code === 'declined' ? tr('Enregistrement annulé') : tr('Enregistrement impossible ici')); }
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  status(`${L('Fichier téléchargé', 'File downloaded')} : ${name}`);
}

/* =====================================================================
   GRILLE « RÉGIONS DE FRANCE » : chaque écurie devient une région, chaque pilote une grande ville
   (noms, couleurs et drapeaux propres à la carrière ; performances inchangées)
   ===================================================================== */
const REGIONS = {
  'Brackley Silver': ['Île-de-France', '#1D3E8A', '#E30613', '#2F5BD3', 'Paris', 'Versailles'],
  'Maranello Rosso': ['Auvergne-Rhône-Alpes', '#C8102E', '#F5F5F5', '#E8243E', 'Lyon', 'Grenoble'],
  'Woking Papaya': ['Provence-Alpes-Côte d’Azur', '#F4F4F4', '#0096D6', '#4FC3F7', 'Marseille', 'Nice'],
  'Milton Keynes Racing': ['Occitanie', '#E75480', '#FFD200', '#E75480', 'Toulouse', 'Montpellier'],
  'Enstone Blue': ['Nouvelle-Aquitaine', '#6D1A36', '#E8C547', '#B03A5B', 'Bordeaux', 'Limoges'],
  'Grove Racing': ['Hauts-de-France', '#FFD200', '#1B1B1D', '#FFD200', 'Lille', 'Amiens'],
  'Kannapolis Racing': ['Grand Est', '#FF8A00', '#FFFFFF', '#FF8A00', 'Strasbourg', 'Reims'],
  'Faenza Racing': ['Bretagne', '#111111', '#FFFFFF', '#E6E6E6', 'Rennes', 'Brest'],
  'Gaydon Green': ['Pays de la Loire', '#00A859', '#FFFFFF', '#22C55E', 'Nantes', 'Angers'],
  'Hinwil Racing': ['Normandie', '#5B2A86', '#FFD200', '#A066D3', 'Rouen', 'Caen'],
  'Motor City Racing': ['Bourgogne-Franche-Comté', '#0F766E', '#F5F5F5', '#14B8A6', 'Dijon', 'Besançon'],
};
function regionsGrid() {   // { names: nom du jeu → région / ville, livery: nom du jeu → couleurs }
  const names = {}, livery = {};
  for (const t of ST.teams) {
    const r = REGIONS[t.base]; if (!r) { names[t.base] = t.name; t.drivers.forEach(d => { names[d.base] = d.name; }); continue; }
    names[t.base] = r[0]; livery[t.base] = { color: r[1], color2: r[2], tv: r[3] };
    t.drivers.forEach((d, i) => { names[d.base] = r[4 + i] || d.name; livery[d.base] = { nat: '🇫🇷' }; });
  }
  return { names, livery };
}

/* =====================================================================
   MULTIJOUEUR WI-FI : un téléphone héberge (simulation complète), les autres affichent et envoient leurs commandes
   ===================================================================== */
const MPN = window.PaddockMP || null;            // pont Android (serveur + découverte), absent dans un navigateur
const NET = { role: null, ws: null, players: [], cars: new Map(), inputs: new Map(), found: new Map(), snap: null, snapAt: 0, sendT: 0, endSent: false, evSent: 0, settings: {} };
const mpName = () => ($('#mp-name').value || '').trim().slice(0, 14) || 'Joueur';
const allDrivers = () => ST.teams.flatMap(t => t.drivers.map(d => ({ team: t.name, driver: d.name })));
function netSend(o) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
function hostSend(id, o) { if (MPN) MPN.send(id, JSON.stringify(o)); }
function hostBroadcast(o) { if (MPN) MPN.broadcast(JSON.stringify(o)); }
/* --- écran de connexion (menu) --- */
function mpMenu() {
  try { $('#mp-name').value = $('#mp-name').value || localStorage.getItem('paddock26-mpname') || ''; } catch (e) { /* ignoré */ }
  $('#mp-avail').textContent = MPN ? 'Tous les téléphones doivent être sur le même Wi-Fi. Crée la partie sur un téléphone, les autres la rejoignent.'
    : 'Le multijoueur Wi-Fi fonctionne dans l’appli Android : dans un navigateur, tu peux seulement rejoindre une partie avec l’adresse de l’hôte.';
  $('#mp-host').hidden = !MPN;
  NET.found.clear(); mpRenderFound();
  if (MPN) MPN.discover();
}
function mpRenderFound() {
  const box = $('#mp-found');
  if (!NET.found.size) { box.innerHTML = `<p class="note">${MPN ? 'Recherche des parties…' : 'Recherche automatique indisponible ici.'}</p>`; return; }
  box.innerHTML = [...NET.found.values()].map(f => `<button class="btn ghost" data-ip="${f.ip}" data-port="${f.port}">▶ ${f.name.replace(/^Paddock26 /, '')} <small>${f.ip}</small></button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => mpJoin(b.dataset.ip, +b.dataset.port));
}
window.__mp = {
  onFound(name, ip, port) { if (ip) { NET.found.set(name, { name, ip, port }); mpRenderFound(); } },
  onLost(name) { NET.found.delete(name); mpRenderFound(); },
  onOpen() { /* on attend le message « hello » */ },
  onMessage(id, text) { try { hostOnMessage(id, JSON.parse(text)); } catch (e) { /* message invalide */ } },
  onClose(id) { hostOnClose(id); },
};
/* --- hôte --- */
function mpHost() {
  if (!MPN) return;
  try { localStorage.setItem('paddock26-mpname', mpName()); } catch (e) { /* ignoré */ }
  const addr = MPN.host(mpName());
  if (!addr) { $('#mp-note').textContent = 'Impossible de créer la partie (Wi-Fi ?)'; return; }
  MPN.stopDiscover();
  const mine = allDrivers().find(x => x.driver === ST.human) || allDrivers()[0];
  Object.assign(NET, { role: 'host', addr, players: [{ id: 0, name: mpName(), driver: mine.driver }], cars: new Map(), inputs: new Map(), endSent: false });
  NET.settings = { circuit: ST.circuit, lapsKey: ST.lapsKey, weather: ST.weather };
  lobbyRender(); show('lobby');
}
function takenBy(driver, exceptId) { return NET.players.find(p => p.driver === driver && p.id !== exceptId); }
function freeDriver(want, id) { if (want && !takenBy(want, id)) return want; return (allDrivers().find(x => !takenBy(x.driver, id)) || {}).driver; }
function hostOnMessage(id, m) {
  if (m.t === 'hello') {
    if (R && R.net === 'host') { hostSend(id, { t: 'refused', why: 'Course déjà lancée' }); MPN.kick(id); return; }
    NET.players.push({ id, name: String(m.name || 'Joueur').slice(0, 14), driver: freeDriver(m.driver, id) });
    hostSend(id, { t: 'welcome', id });
    lobbyRender(); lobbyBroadcast();
  } else if (m.t === 'pick') {
    const p = NET.players.find(x => x.id === id); if (p) { p.driver = freeDriver(m.driver, id); lobbyRender(); lobbyBroadcast(); }
  } else if (m.t === 'in') {
    const k = NET.cars.get(id); if (k == null || !R) return;
    const c = R.cars[k]; if (c && c.input) Object.assign(c.input, { thr: +m.thr || 0, brk: +m.brk || 0, steer: clamp(+m.steer || 0, -1, 1), ers: m.ers || 'normal', ot: !!m.ot, assist: m.assist || 'on' });
  } else if (m.t === 'box') {
    const k = NET.cars.get(id); if (k == null || !R) return;
    const c = R.cars[k]; if (!c || c.state !== 'run') return;
    c.pitReq = !!m.on; c.pitReason = 'appel du pilote'; c.wantTyre = m.on ? (SIM.COMP[m.tyre] ? m.tyre : SIM.autoTyre(R, c)) : null;
  } else if (m.t === 'tyre') {
    const k = NET.cars.get(id); if (k != null && R && R.cars[k].pitReq && SIM.COMP[m.tyre]) R.cars[k].wantTyre = m.tyre;
  }
}
function hostOnClose(id) {
  const i = NET.players.findIndex(p => p.id === id); if (i < 0) return;
  const p = NET.players.splice(i, 1)[0];
  const k = NET.cars.get(id);
  if (k != null && R && R.cars[k]) { R.cars[k].human = false; toast({ type: 'info', msg: `${p.name} s’est déconnecté : l’IA reprend sa voiture`, cars: [k] }); }
  NET.cars.delete(id);
  if (!$('#lobby').hidden) { lobbyRender(); lobbyBroadcast(); }
}
function lobbyBroadcast() {
  const c = CIRCUITS[NET.settings.circuit];
  hostBroadcast({ t: 'lobby', players: NET.players.map(p => ({ id: p.id, name: p.name, driver: p.driver })), circuit: `${c.flag} ${c.name}`, laps: lapsKeyFor(c, NET.settings.lapsKey), weather: NET.settings.weather });
}
const lapsKeyFor = (c, k) => k === '50' ? Math.round(c.laps / 2) : k === '100' ? c.laps : +k;
/* --- client --- */
function mpJoin(ip, port) {
  ip = (ip || '').trim(); if (!ip) return;
  try { localStorage.setItem('paddock26-mpname', mpName()); } catch (e) { /* ignoré */ }
  if (MPN) MPN.stopDiscover();
  $('#mp-note').textContent = `Connexion à ${ip}…`;
  let ws;
  try { ws = new WebSocket(`ws://${ip}:${port || 47626}`); } catch (e) { $('#mp-note').textContent = 'Adresse invalide'; return; }
  Object.assign(NET, { role: 'client', ws, players: [], snap: null, me: null });
  ws.onopen = () => { netSend({ t: 'hello', name: mpName(), driver: ST.human }); NET.addr = ip; lobbyRender(); show('lobby'); };
  ws.onmessage = e => { try { clientOnMessage(JSON.parse(e.data)); } catch (x) { /* ignoré */ } };
  ws.onerror = () => { if ($('#lobby').hidden && !R) $('#mp-note').textContent = `Pas de partie à ${ip} (même Wi-Fi ?)`; };
  ws.onclose = () => {
    if (NET.role !== 'client') return;
    const inRace = R && R.net === 'client' && !R.over;
    NET.role = null; NET.ws = null;
    if (inRace) { toast({ type: 'error', msg: 'Connexion avec l’hôte perdue', cars: [] }); setTimeout(() => { R = null; HUM = null; document.body.classList.remove('driving'); show('menu'); setMode('mp'); }, 2500); }
    else if (!$('#lobby').hidden) { show('menu'); setMode('mp'); $('#mp-note').textContent = 'L’hôte a fermé la partie.'; }
  };
}
function clientOnMessage(m) {
  if (m.t === 'welcome') { NET.myId = m.id; lobbyRender(); }
  else if (m.t === 'lobby') { NET.players = m.players; NET.info = m; lobbyRender(); }
  else if (m.t === 'refused') { $('#mp-note').textContent = m.why; }
  else if (m.t === 'start') clientStart(m);
  else if (m.t === 's' && R && R.net === 'client') { NET.snap = m; NET.snapAt = performance.now(); }
  else if (m.t === 'end' && R && R.net === 'client') clientEnd(m);
}
/* --- salon --- */
function lobbyRender() {
  const host = NET.role === 'host';
  $('#lb-title').textContent = host ? 'Ta partie multijoueur' : 'Salon multijoueur';
  $('#lb-addr').textContent = host ? `Adresse : ${NET.addr}` : NET.addr ? `Hôte : ${NET.addr}` : '';
  $('#lb-note').textContent = host ? 'Les autres téléphones trouvent ta partie dans « Multijoueur Wi-Fi », ou entrent cette adresse.' : '';
  const names = new Map(allDrivers().map(x => [x.driver, x.team]));
  $('#lb-players').innerHTML = NET.players.map(p => `<li><b>${p.name}</b> <span>· ${p.driver || '—'}${names.get(p.driver) ? ' (' + names.get(p.driver) + ')' : ''}${p.id === 0 ? ' · hôte' : ''}</span></li>`).join('') || '<li><span>En attente…</span></li>';
  const me = host ? NET.players[0] : NET.players.find(p => p.id === NET.myId);
  const sel = $('#lb-driver');
  sel.innerHTML = ST.teams.map(t => t.drivers.map(d => { const tk = NET.players.find(p => p.driver === d.name && p !== me); return `<option value="${d.name}" ${me && me.driver === d.name ? 'selected' : ''} ${tk ? 'disabled' : ''}>${d.name} · ${t.name}${tk ? ' (' + tk.name + ')' : ''}</option>`; }).join('')).join('');
  sel.onchange = () => { if (host) { NET.players[0].driver = freeDriver(sel.value, 0); lobbyRender(); lobbyBroadcast(); } else netSend({ t: 'pick', driver: sel.value }); };
  $('#lb-host').hidden = !host; $('#lb-start').hidden = !host;
  if (host) {
    const cs = $('#lb-circuit');
    cs.innerHTML = CIRCUITS.map((c, i) => `<option value="${i}" ${i === NET.settings.circuit ? 'selected' : ''}>${c.flag} ${c.name}${c.bonus ? ' (bonus)' : ''}</option>`).join('');
    cs.onchange = () => { NET.settings.circuit = +cs.value; lobbyRender(); lobbyBroadcast(); };
    const c = CIRCUITS[NET.settings.circuit];
    chipGroup($('#lb-laps'), [{ v: '3', l: '3' }, { v: '5', l: '5' }, { v: '10', l: '10' }, { v: '20', l: '20' }, { v: '50', l: `50 % · ${Math.round(c.laps / 2)}` }, { v: '100', l: `Complet · ${c.laps}` }], NET.settings.lapsKey, v => { NET.settings.lapsKey = v; lobbyRender(); lobbyBroadcast(); });
    chipGroup($('#lb-wx'), [{ v: 'dry', l: 'Sec' }, { v: 'light', l: 'Pluie légère' }, { v: 'heavy', l: 'Pluie forte' }, { v: 'mixed', l: 'Variable' }], NET.settings.weather, v => { NET.settings.weather = v; lobbyRender(); lobbyBroadcast(); });
    $('#lb-wait').textContent = NET.players.length < 2 ? 'En attente d’autres joueurs… (tu peux aussi lancer seul)' : `${NET.players.length} joueurs prêts.`;
  } else {
    const i = NET.info;
    $('#lb-wait').textContent = i ? `Course : ${i.circuit} · ${i.laps} tours · ${WX_LABEL[i.weather] || ''}. En attente du lancement par l’hôte…` : 'Connexion…';
  }
}
function netLeave() {
  if (NET.role === 'host' && MPN) MPN.stopHost();
  if (NET.role === 'client' && NET.ws) { const w = NET.ws; NET.role = null; try { w.close(); } catch (e) { /* ignoré */ } }
  Object.assign(NET, { role: null, ws: null, players: [], cars: new Map(), snap: null });
  if (MPN) MPN.stopDiscover();
}
/* --- départ --- */
function hostStart() {
  const ci = NET.settings.circuit, circ = CIRCUITS[ci];
  ST.circuit = ci; ST.weather = NET.settings.weather;
  T = getTrack(ci);
  const entries = activeTeams().flatMap(t => t.drivers.map(d => ({ team: t, driver: d })));
  const grid = SIM.qualifying(getTrack(ci, true), entries, startWet(), qPace(), null).map(r => r.entry);   // grille : qualifs simulées pour tous
  const idxOf = name => grid.findIndex(e => e.driver.name === name);
  const humans = NET.players.map(p => idxOf(p.driver));
  const laps = lapsKeyFor(circ, NET.settings.lapsKey);
  R = SIM.createRace(T, grid, { laps, wearMode: ST.wear, chaos: ST.chaos, human: humans, assist: ST.assist, weather: ST.weather, level: levelOf(ST), noDnf: ST.noDnf, dmgLite: ST.dmgLite, colEvery: RULE_N.col[ST.colRule] || 0 });
  R.net = 'host'; NET.endSent = false; NET.evSent = R.events.length; NET.sendT = 0;
  NET.cars = new Map(NET.players.filter(p => p.id).map(p => [p.id, idxOf(p.driver)]));
  hostBroadcast({ t: 'start', circuit: ci, laps, grid: grid.map(e => { const ti = ST.teams.findIndex(t => t.name === e.team.name); return [e.team.name, e.driver.name, ti, ti >= 0 ? ST.teams[ti].drivers.findIndex(d => d.name === e.driver.name) : -1]; }), cars: [...NET.cars.entries()], level: levelOf(ST), noDnf: ST.noDnf, dmgLite: ST.dmgLite, engine: ST.engine, weather: ST.weather,
    names: NET.players.map(p => [idxOf(p.driver), p.name]) });
  initAudio();
  follow = humans[0]; HUM = R.cars[humans[0]];
  recStart(); enterView(circ);
  toast({ type: 'start', msg: `Multijoueur : ${NET.players.map(p => p.name + ' (' + R.cars[idxOf(p.driver)].code + ')').join(', ')}`, cars: [] });
}
function clientStart(m) {
  const circ = CIRCUITS[m.circuit]; if (!circ) return;
  const byName = new Map(ST.teams.flatMap(t => t.drivers.map(d => [d.name, { team: t, driver: d }])));
  const grid = m.grid.map(([tn, dn, ti, di]) => byName.get(dn) || (ST.teams[ti] && ST.teams[ti].drivers[di] ? { team: Object.assign({}, ST.teams[ti], { name: tn }), driver: Object.assign({}, ST.teams[ti].drivers[di], { name: dn }) } : null) || { team: ST.teams.find(t => t.name === tn) || ST.teams[0], driver: { name: dn, num: 0, skill: 60 } });
  const mine = m.cars.find(([id]) => id === NET.myId);
  const k = mine ? mine[1] : grid.findIndex(e => e.driver.name === ST.human);
  ST.circuit = m.circuit;
  T = getTrack(m.circuit);
  R = SIM.createRace(T, grid, { laps: m.laps, human: k >= 0 ? k : null, assist: ST.assist, weather: m.weather, level: m.level, noDnf: m.noDnf, dmgLite: m.dmgLite, engine: m.engine || 'hybrid' });
  R.net = 'client'; NET.snap = null; NET.sendT = 0; NET.lastEv = 0;
  initAudio();
  follow = k >= 0 ? k : 0; HUM = k >= 0 ? R.cars[k] : null;
  recStart(); enterView(circ);
  toast({ type: 'start', msg: `Multijoueur : ${m.names.map(([i, n]) => n + ' (' + R.cars[i].code + ')').join(', ')}`, cars: [] });
}
/* --- pendant la course --- */
const r2 = (x, n) => Math.round(x * n) / n;
function hostSnapshot() {
  const cars = R.cars.map(c => [r2(c.dist, 10), r2(c.d, 100), r2(c.vd, 100), r2(c.v, 100), r2(c.yaw || 0, 100),
    (c.state === 'pit' ? 1 : 0) | (c.state === 'out' ? 2 : 0) | (c.gone ? 4 : 0) | (c.xmode ? 8 : 0) | (c.otActive ? 16 : 0) | (c.fin ? 64 : 0) | (c.clip ? 128 : 0) | (c.otAvail ? 256 : 0) | (c.pitReq ? 512 : 0),
    Math.max(0, TY.indexOf(c.tyre)), Math.round(c.soc / 1000), r2(c.wear, 1000), c.lapsDone, r2(c.lastLap || 0, 1000), r2(c.bestLap || 0, 1000), c.penalty || 0, c.stops || 0,
    c.gap == null ? null : r2(c.gap, 100), c.int == null ? null : r2(c.int, 100), c.pos, r2(c.throttle || 0, 100), r2(c.brake || 0, 100), Math.round(c.otE / 1000) || 0]);
  const ev = R.events.slice(NET.evSent); NET.evSent = R.events.length;
  return { t: 's', rt: r2(R.t, 1000), ph: R.phase, lo: R.lightsOn, st: R.startT, fl: R.flag, sc: R.sc ? [r2(R.sc.s, 10), r2(R.sc.d, 100)] : null, wet: r2(R.wet || 0, 100), rain: R.wx ? r2(R.wx.rain, 100) : 0,
    fo: R.finishOrder, ld: R.leaderDone, fa: R.finishedAt, w: R.winnerId, fast: R.fastest, cars, ev };
}
function netTick(now) {
  if (NET.role === 'host' && R.net === 'host') {
    if (now - NET.sendT > 50) { NET.sendT = now; hostBroadcast(hostSnapshot()); }
    if (R.over && !NET.endSent) {
      NET.endSent = true;
      hostBroadcast({ t: 'end', cars: R.cars.map(c => [c.state === 'out' ? 1 : 0, c.fin ? 1 : 0, c.finishT || 0, c.penalty || 0, !!(c.fin && SIM.missedCompound(R, c)), c.gridPos, c.stops || 0, c.bestLap || 0, c.retiredWhy || '', c.dist, c.lapsDone]),
        fo: R.finishOrder, w: R.winnerId, fast: R.fastest, fa: R.finishedAt });
    }
  } else if (NET.role === 'client' && R.net === 'client') {
    if (HUM && now - NET.sendT > 33) { NET.sendT = now; const I = R.input; netSend({ t: 'in', thr: r2(I.thr, 100), brk: r2(I.brk, 100), steer: r2(I.steer, 100), ers: I.ers, ot: !!I.ot, assist: ST.assist }); }
    clientApply(now);
  }
}
function clientApply(now) {
  const m = NET.snap; if (!m) return;
  const dt = clamp((now - NET.snapAt) / 1000, 0, 0.2), L = T.L;   // extrapolation jusqu'à la prochaine image de l'hôte
  m.cars.forEach((a, k) => {
    const c = R.cars[k]; if (!c) return;
    const fl = a[5];
    c.state = fl & 2 ? 'out' : fl & 1 ? 'pit' : 'run'; c.gone = !!(fl & 4); c.xmode = !!(fl & 8); c.otActive = !!(fl & 16); c.fin = !!(fl & 64); c.finGhost = c.fin; c.clip = !!(fl & 128);
    c.otAvail = !!(fl & 256); c.pitReq = !!(fl & 512);
    c.v = a[3]; c.dist = a[0] + (c.state === 'out' ? 0 : c.v * dt); c.s = SIM.mod(c.dist, L); c.d = a[1]; c.vd = a[2]; c.yaw = a[4];
    c.tyre = TY[a[6]] || 'M'; c.soc = a[7] * 1000; c.wear = a[8]; c.lapsDone = a[9]; c.lastLap = a[10] || null; c.bestLap = a[11] || null;
    c.penalty = a[12]; c.stops = a[13]; c.gap = a[14]; c.int = a[15]; c.pos = a[16]; c.throttle = a[17]; c.brake = a[18]; c.otE = a[19] * 1000;
  });
  R.t = m.rt + dt; R.phase = m.ph; R.lightsOn = m.lo; R.startT = m.st; R.flag = m.fl; R.wet = m.wet; if (R.wx) R.wx.rain = m.rain;
  R.sc = m.sc ? { s: m.sc[0], d: m.sc[1], v: 0 } : null;
  R.finishOrder = m.fo || []; R.leaderDone = !!m.ld; R.finishedAt = m.fa || 0; R.winnerId = m.w; R.fastest = m.fast;
  R.ranked = R.cars.slice().sort((a, b) => (a.pos || 99) - (b.pos || 99));
  if (m.ev && m.ev.length && m !== NET.evDone) { NET.evDone = m; for (const e of m.ev) R.events.push(e); }
  if (R.rec && R.t >= R.rec.next) recFrame(R);
  if (R.rec && HUM) recInput();
}
function clientEnd(m) {
  m.cars.forEach((a, k) => {
    const c = R.cars[k]; if (!c) return;
    if (a[0]) c.state = 'out'; c.fin = !!a[1]; c.finishT = a[2]; c.penalty = a[3]; c.usedComps = new Set(a[4] ? ['M'] : ['M', 'H']); c.gridPos = a[5]; c.stops = a[6]; c.bestLap = a[7] || null; c.retiredWhy = a[8]; c.dist = a[9]; c.lapsDone = a[10];
  });
  R.finishOrder = m.fo || []; R.winnerId = m.w; R.fastest = m.fast; R.finishedAt = m.fa; R.leaderDone = true;
  R.ranked = R.cars.slice().sort((a, b) => (a.pos || 99) - (b.pos || 99));
  R.over = true;
}

/* après un abandon du joueur : simuler la fin de course ou la regarder */
function fastForward() {
  $('#dnf-btns').hidden = true; $('#dnf-prog').hidden = false;
  paused = true;
  const total = R.laps * T.L;
  const tick = () => {
    if (!R) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 30 && !R.over && R.t < 20000) stepSim(1 / 30);
    $('#dnf-prog').firstElementChild.style.transform = `scaleX(${Math.min(1, (R.ranked ? R.ranked[0].dist : 0) / total)})`;
    if (R.over || R.t >= 20000) { R.over = true; $('#dnf').hidden = true; paused = false; }
    else setTimeout(tick, 0);
  };
  tick();
}
function watchAfterDnf() {
  $('#dnf').hidden = true;
  HUM = null; document.body.classList.remove('driving'); SEC = null; $('#sectors').hidden = true; document.body.classList.remove('secs');
  $('#dcontrols').hidden = true; $('#tyrepick').hidden = true; $('#controls').hidden = false; $('#pads').hidden = true; $('#steerbar').hidden = true; $('#coast').hidden = true;
  follow = R.ranked[0].id; camInit = false;
  camMode = 'auto'; $('#btn-cam').textContent = 'Réalisateur';
}

/* résultat du tour de qualification du joueur */
function showQualiResult() {
  const q = R.qualiRun, mine = ST.quali.find(r => r.entry.driver.name === ST.human);
  const pole = ST.quali.filter(r => r !== mine)[0].best;
  let txt;
  if (q.invalid || !q.time) txt = `<b>Tour annulé</b><span>${q.why || 'tour non terminé'}</span>`;
  else {
    const better = !mine.mine || q.time < mine.best;
    if (better) { mine.best = q.time; mine.q3 = q.time; mine.mine = true; }
    ST.quali.sort((a, b) => a.best - b.best).forEach((r, k) => { r.pos = k + 1; });
    if (CH.pending) saveChampQuali();
    const d = q.time - pole;
    if (SEC) updateSectors();
    const secs = SEC && SEC.cells.every(x => x) ? `<span class="qsec">${SEC.cells.map((x, k) => `<i class="${x.col}">S${k + 1} ${x.t.toFixed(3)}</i>`).join('')}</span>` : '';
    txt = secs + `<b>${fmt(q.time)}</b><span>${d <= 0 ? 'Pole position ! ' + d.toFixed(3) : '+' + d.toFixed(3) + ' sur la pole'} · P${mine.pos} sur la grille${better ? '' : ' (ton meilleur reste ' + fmt(mine.best) + ')'}</span>`;
  }
  $('#qres-body').innerHTML = txt;
  $('#qres').hidden = false;
}

/* classement final */
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
/* classement final figé (le replay modifie l'état des voitures : les highlights s'appuient sur cette copie) */
function hlFinal() {
  if (!RP.on || !R.final) {
    const { order, pen } = classify(R);
    R.final = { ids: order.map(c => c.id), rows: Object.fromEntries(order.map(c => [c.id, { out: c.state === 'out', dsq: !!c.dsq, fin: !!c.fin, laps: Math.floor(c.dist / R.T.L), t: c.finishT + pen(c), finishT: c.finishT }])) };
  }
  return R.final;
}
const finalOrder = () => hlFinal().ids.map(id => R.cars[id]);
function classify(R) {   // classement officiel : les pénalités de temps s'ajoutent au temps de course
  const T = R.T, pen = c => c.penalty || 0;
  for (const c of R.ranked) if (c.state !== 'out' && c.fin && SIM.missedCompound(R, c)) c.dsq = true;   // un seul type de slick utilisé
  const lead = R.ranked.filter(c => c.state !== 'out' && !c.dsq && c.fin && Math.floor(c.dist / T.L) >= R.laps).sort((a, b) => (a.finishT + pen(a)) - (b.finishT + pen(b)));
  const order = [...lead, ...R.ranked.filter(c => !lead.includes(c) && !c.dsq), ...R.ranked.filter(c => c.dsq)];
  return { order, lead, pen };
}
function showResults() {
  if (!RP.on) hlFinal();
  const { order, lead, pen } = classify(R);
  const win = order[0];
  const rows = order.map((c, i) => {
    let res;
    if (c.dsq) res = 'Disqualifié';
    else if (c.state === 'out') res = 'Abandon';
    else if (i === 0) res = fmt(c.finishT + pen(c) - R.startT).replace(/^(\d+):/, (m, a) => `${Math.floor(a / 60) ? Math.floor(a / 60) + 'h' : ''}${a % 60}:`);
    else if (lead.includes(c)) res = '+' + (c.finishT + pen(c) - win.finishT - pen(win)).toFixed(3);
    else res = `+${Math.max(1, R.laps - Math.floor(c.dist / T.L))} tour${R.laps - Math.floor(c.dist / T.L) > 1 ? 's' : ''}`;
    const pts = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][i] || 0;
    return `<tr class="${c.state === 'out' ? 'dnf' : ''}"><td class="n">${i + 1}</td><td><i class="tb" style="background:${(c.team.tv || c.team.color)}"></i>${c.driver.name}<small>${c.team.name}${c.state === 'out' ? ' · ' + c.retiredWhy : ''}${c.dsq ? ' · un seul type de pneu utilisé' : ''}${pen(c) ? ' · pénalité +' + pen(c) + ' s' : ''}</small></td><td class="t">${res}</td><td class="t">${c.gridPos}</td><td class="t">${c.stops}</td><td class="t ${R.fastest && R.fastest.id === c.id ? 'fl' : ''}">${fmt(c.bestLap)}</td><td class="t">${c.state === 'out' || c.dsq ? 0 : pts}</td></tr>`;
  }).join('');
  $('#res-title').textContent = `${T.circ.flag} Grand Prix · ${T.circ.name}`;
  $('#res-sub').textContent = `${R.laps} tours · ${(R.laps * T.L / 1000).toFixed(1)} km · ${R.cars.filter(c => c.state === 'out').length} abandon(s)` + (R.fastest ? ` · meilleur tour ${R.cars[R.fastest.id].code} ${fmt(R.fastest.t)}` : '');
  $('#res-body').innerHTML = rows;
  $('#results').hidden = false;
  if (!RP.on || !R.posChart) R.posChart = posChartData(order);
  drawPosChart();
  $('#res-replay').hidden = !(R.rec && R.rec.frames.length > 8);
  $('#res-hl').hidden = !(R.rec && R.rec.frames.length > 40);
  $('#res-replay').classList.toggle('locked', !PRO); $('#res-hl').classList.toggle('locked', !PRO);
  $('#res-new').textContent = R.net ? 'Retour au multijoueur' : CH.inRace ? 'Suite du championnat' : R.fromSave ? 'Retour aux replays' : 'Nouveau Grand Prix';
  $('#res-new').dataset.act = R.net ? 'mp' : CH.inRace ? 'champ' : R.fromSave ? 'replays' : 'menu';
  $('#res-save').hidden = !(R.rec && R.rec.frames.length > 8) || !!R.fromSave || !!R.net; $('#res-save').disabled = false; $('#res-save').textContent = '💾 Sauvegarder le replay';
  if (CH.inRace) { recordChampRace(R); CH.inRace = false; }
}

/* ---------- graphique d'évolution des positions (tour par tour) ---------- */
// position à chaque tour = ordre de passage sur la ligne à ce tour ; tour 0 = grille ; dernier point = classement officiel
function posChartData(order) {
  const cars = R.cars.filter(c => c.cross && c.gridPos);
  const n = Math.max(0, ...cars.map(c => c.cross.length - 1));
  if (!n) return null;
  const pos = new Map(cars.map(c => [c.id, [c.gridPos]]));
  for (let k = 1; k <= n; k++) {
    cars.filter(c => c.cross[k] != null).sort((a, b) => a.cross[k] - b.cross[k]).forEach((c, i) => { pos.get(c.id)[k] = i + 1; });
  }
  order.forEach((c, i) => { const p = pos.get(c.id); if (p && c.state !== 'out' && !c.dsq && p.length > 1) p[p.length - 1] = i + 1; });
  const mate = {};
  return { n, rows: order.map((c, i) => {
    const t = c.team.name, second = mate[t] = (t in mate);
    return { id: c.id, code: c.code, col: c.team.tv || c.team.color, dash: second, out: c.state === 'out' || !!c.dsq, fin: i + 1, p: pos.get(c.id) || [c.gridPos], human: !!c.human };
  }) };
}
const PC = { sel: null };
function drawPosChart() {
  const box = $('#res-pos'), D = R.posChart;
  box.hidden = !D;
  if (!D) return;
  if (PC.sel != null && !D.rows.some(r => r.id === PC.sel)) PC.sel = null;
  if (PC.sel == null) { const h = D.rows.find(r => r.human); if (h) PC.sel = h.id; }
  const svgEl = $('#pc-svg'), W = Math.max(300, svgEl.parentElement.clientWidth), N = D.rows.length, rowH = W < 500 ? 17 : 20;
  const ml = 40, mr = 44, mt = 8, mb = 26, H = mt + N * rowH + mb, pw = W - ml - mr;
  const x = k => ml + (D.n ? k / D.n * pw : 0), y = p => mt + (p - 0.5) * rowH;
  const step = D.n <= 12 ? 1 : D.n <= 30 ? 5 : 10;
  let g = '';
  for (let p = 1; p <= N; p++) if (p === 1 || p % 5 === 0) g += `<line class="pc-grid" x1="${ml}" x2="${ml + pw}" y1="${y(p)}" y2="${y(p)}"/>`;
  for (let k = 0; k <= D.n; k += step) g += `<line class="pc-grid" x1="${x(k)}" x2="${x(k)}" y1="${mt}" y2="${mt + N * rowH}"/><text class="pc-ax" x="${x(k)}" y="${H - 8}" text-anchor="middle">${k === 0 ? 'Grille' : k}</text>`;
  const line = (r, cls) => {
    const pts = r.p.map((p, k) => p == null ? null : `${x(k).toFixed(1)},${y(p).toFixed(1)}`).filter(Boolean).join(' ');
    const last = r.p.length - 1, lx = x(last), ly = y(r.p[last]);
    const end = r.out ? `<path class="pc-x" d="M${lx - 4},${ly - 4}L${lx + 4},${ly + 4}M${lx - 4},${ly + 4}L${lx + 4},${ly - 4}" stroke="${r.col}"/>` : '';
    return `<g class="pc-car ${cls}" data-id="${r.id}"><polyline points="${pts}" stroke="${r.col}"${r.dash ? ' stroke-dasharray="6 4"' : ''}/>${end}<polyline class="pc-hit" points="${pts}"/></g>`;
  };
  const sel = D.rows.find(r => r.id === PC.sel);
  const lines = D.rows.filter(r => r !== sel).map(r => line(r, sel ? 'dim' : '')).join('') + (sel ? line(sel, 'on') : '');
  const lab = D.rows.map(r => {
    const c = sel ? (r === sel ? ' on' : ' dim') : '';
    const right = r.out ? '' : `<g class="pc-lab${c}" data-id="${r.id}"><rect x="${ml + pw + 6}" y="${y(r.fin) - 6}" width="3" height="12" fill="${r.col}"/><text x="${ml + pw + 12}" y="${y(r.fin) + 4}">${r.code}</text></g>`;
    return `<g class="pc-lab${c}" data-id="${r.id}"><text x="${ml - 6}" y="${y(r.p[0]) + 4}" text-anchor="end">${r.code}</text></g>` + right;
  }).join('');
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`); svgEl.setAttribute('width', W); svgEl.setAttribute('height', H);
  svgEl.innerHTML = g + lines + lab + `<line id="pc-cross" class="pc-cross" y1="${mt}" y2="${mt + N * rowH}" visibility="hidden"/>`;
  $('#pc-sel').textContent = sel ? `${sel.code} : P${sel.p[0]} au départ → ${sel.out ? 'abandon' : 'P' + sel.fin} · touche une autre ligne ou ici pour tout voir` : 'Touche une ligne ou un code pour suivre un pilote';
  PC.geo = { x, y, ml, pw, mt, rowH, N };
}
function posChartPick(e) {
  const D = R.posChart, G = PC.geo; if (!D || !G) return null;
  const svgEl = $('#pc-svg'), b = svgEl.getBoundingClientRect(), sx = svgEl.viewBox.baseVal.width / b.width;
  const px = (e.clientX - b.left) * sx, py = (e.clientY - b.top) * sx;
  const k = clamp(Math.round((px - G.ml) / G.pw * D.n), 0, D.n), p = Math.round((py - G.mt) / G.rowH + 0.5);
  const r = D.rows.find(r => r.p[k] === p) || null;
  return { k, p, r, px, py };
}
function initPosChart() {
  const svgEl = $('#pc-svg'), tip = $('#pc-tip');
  svgEl.addEventListener('click', e => {
    const t = e.target.closest('[data-id]'), hit = t ? R.posChart.rows.find(r => r.id === +t.dataset.id) : (posChartPick(e) || {}).r;
    PC.sel = hit && hit.id !== PC.sel ? hit.id : null; drawPosChart();
  });
  svgEl.addEventListener('pointermove', e => {
    const h = posChartPick(e), cr = $('#pc-cross'); if (!h || !cr) return;
    const D = R.posChart, G = PC.geo, X = G.x(h.k);
    cr.setAttribute('x1', X); cr.setAttribute('x2', X); cr.setAttribute('visibility', 'visible');
    const r = D.rows.find(r => r.id === PC.sel) || h.r;
    if (!r || r.p[h.k] == null) { tip.hidden = true; return; }
    const b = svgEl.getBoundingClientRect(), s = b.width / svgEl.viewBox.baseVal.width;
    tip.innerHTML = `<i style="background:${r.col}"></i><b>${r.code}</b> ${h.k === 0 ? 'grille' : 'tour ' + h.k} · <b>P${r.p[h.k]}</b>`;
    tip.hidden = false;
    const tx = X * s, ty = G.y(r.p[h.k]) * s;
    tip.style.left = `${clamp(tx + (tx > b.width / 2 ? -tip.offsetWidth - 10 : 10), 0, b.width - tip.offsetWidth)}px`; tip.style.top = `${Math.max(0, ty - 34)}px`;
  });
  svgEl.addEventListener('pointerleave', () => { tip.hidden = true; const cr = $('#pc-cross'); if (cr) cr.setAttribute('visibility', 'hidden'); });
  $('#pc-sel').addEventListener('click', () => { PC.sel = null; drawPosChart(); });
  addEventListener('resize', () => { if (!$('#results').hidden && R && R.posChart) drawPosChart(); });
}
initPosChart();

/* =====================================================================
   NAVIGATION & CONTRÔLES
   ===================================================================== */
function show(id) {
  if (id === 'menu') restoreMenuSettings();
  if (id !== 'race' && SND.ctx) { SND.master.gain.cancelScheduledValues(SND.ctx.currentTime); SND.master.gain.setValueAtTime(0, SND.ctx.currentTime); try { SND.ctx.suspend(); } catch (e) { /* ignoré */ } }   // aucun bruit de moteur dans les menus
  for (const s of ['menu', 'quali', 'race', 'champ', 'cnew', 'lobby']) $('#' + s).hidden = s !== id;
  if (id !== 'menu') { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; }
  window.scrollTo(0, 0); updateNavBack();
  document.body.classList.toggle('racing', id === 'race');
  if (id !== 'race') { try { wakeLock?.release(); } catch (e) { /* ignoré */ } }
  if (id === 'menu') { renderHome(); }
  if (id === 'menu') requestAnimationFrame(() => $$('.gp').forEach(b => drawThumb(b.querySelector('canvas'), CIRCUITS[+b.dataset.i], +b.dataset.i === ST.circuit)));
}
/* ---------------- championnat du monde ---------------- */
const CH = { season: null, tab: 'drivers', inRace: false, pending: false };
const RAINY = { 'be-1925': 0.35, 'gb-1948': 0.3, 'br-1940': 0.35, 'jp-1962': 0.25, 'sg-2008': 0.25, 'ca-1978': 0.2, 'hu-1986': 0.15, 'nl-1948': 0.25, 'at-1969': 0.2, 'mc-1929': 0.15, 'cn-2004': 0.2, 'au-1953': 0.15, 'us-2022': 0.15, 'es-2026': 0.1 };
/* ---- carrières : plusieurs sauvegardes, saisons enchaînées ----
   carrière = { id, name, driver, created, year, teams (écuries & pilotes au début de la saison en cours), season, history: [bilans] } */
const CAR = { list: [], active: -1 };
const snapTeams = teams => teams.map(t => ({ name: t.name, ligne_droite: +t.ligne_droite, virage: +t.virage, pneus: +t.pneus, depart: +t.depart,
  drivers: t.drivers.map(d => ({ name: d.name, skill: +d.skill, consistency: +(d.consistency ?? d.skill) })) }));
function career() { return CAR.list[CAR.active] || null; }
/* écuries d'une carrière : la liste de base, avec le pilote ou l'écurie créés par le joueur */
/* noms figés à la création : renommer écuries / pilotes plus tard ne touche pas aux carrières en cours */
const nameSnap = () => Object.fromEntries(ST.teams.flatMap(t => [t, ...t.drivers]).map(x => [x.base, x.name]));
function careerTeams(k) {
  const nm = k && k.names; if (!nm) return ST.teams;
  const lv = k.livery || {};
  return ST.teams.map(t => Object.assign({}, t, lv[t.base] || {}, { name: nm[t.base] || t.base, drivers: t.drivers.map(d => Object.assign({}, d, lv[d.base] || {}, { name: nm[d.base] || d.base })) }));
}
function careerRoster(k) {
  const c = k && k.custom, teams = careerTeams(k);
  if (!c) return teams;
  if (c.team) return c.replace ? teams.map(t => t.name === c.replace ? c.team : t) : [...teams, c.team];   // anciennes carrières : l'écurie créée en remplaçait une
  if (c.driver) return teams.map(t => t.name !== c.teamName ? t : Object.assign({}, t, { drivers: t.drivers.map((d, i) => i === c.slot ? c.driver : d) }));
  return teams;
}
function careerBase() {   // écuries au début de la saison en cours (livrées et numéros repris de la liste de base)
  const k = career(); if (!k) return ST.teams;
  return careerRoster(k).map(t => { const b = k.teams.find(x => x.name === t.name); if (!b) return t;
    return Object.assign({}, t, { ligne_droite: b.ligne_droite, virage: b.virage, pneus: b.pneus, depart: b.depart,
      drivers: t.drivers.map((d, i) => Object.assign({}, d, b.drivers[i] || {})) }); });
}
try {
  const sv = JSON.parse(localStorage.getItem('paddock26-careers') || 'null');
  if (sv) { CAR.list = sv.list || []; CAR.active = sv.active ?? -1; }
  else {   // ancienne sauvegarde : un seul championnat → première carrière
    const old = JSON.parse(localStorage.getItem('paddock26-champ') || 'null');
    if (old) { CAR.list = [{ id: Date.now(), name: 'Carrière 1', driver: ST.human, created: old.created, year: 2026, teams: snapTeams(ST.teams), start: Object.fromEntries(ST.teams.flatMap(t => t.drivers.map(d => [d.name, +d.skill]))), season: old, history: [] }]; CAR.active = 0; }
  }
} catch (e) { CAR.list = []; CAR.active = -1; }
if (CAR.list.some(k => !k.names)) { CAR.list.forEach(k => { if (!k.names) k.names = nameSnap(); }); try { localStorage.setItem('paddock26-careers', JSON.stringify({ active: CAR.active, list: CAR.list })); } catch (e) { /* stockage indisponible */ } }
CH.season = career() ? career().season : null;
function saveChamp() {
  const k = career(); if (k) k.season = CH.season;
  try { localStorage.setItem('paddock26-careers', JSON.stringify({ active: CAR.active, list: CAR.list })); } catch (e) { /* stockage indisponible */ }
}
function newCareer(cf) {
  const n = CAR.list.length + 1, custom = cf ? customFromForm(cf) : null, drv = custom ? custom.me : cf ? cf.driver : ST.human;
  const k = { id: Date.now(), name: `Carrière ${n}` + (custom && custom.c.team ? ' · ' + custom.c.team.name : drv ? ' · ' + drv.split(' ').pop() : ' · spectateur'), driver: drv,
    settings: Object.fromEntries(CKEYS.map(x => [x, (cf || ST)[x]])), created: new Date().toISOString().slice(0, 10), year: 2026, season: null, history: [] };
  if (custom) k.custom = custom.c;
  k.names = nameSnap();
  if (cf && cf.grid === 'regions') {   // régions de France : noms et couleurs propres à la carrière
    const rg = regionsGrid(), byName = n => { const x = ST.teams.flatMap(t => [t, ...t.drivers]).find(y => y.name === n); return x ? rg.names[x.base] || n : n; };
    k.names = rg.names; k.livery = rg.livery; k.grid = 'regions';
    if (k.driver && !custom) k.driver = byName(k.driver);
    if (k.custom && k.custom.teamName) k.custom.teamName = byName(k.custom.teamName);
    k.name = `Carrière ${n} · ` + (custom && custom.c.team ? custom.c.team.name : k.driver ? k.driver.split(' ').pop() : 'Régions de France');
  }
  const roster = careerRoster(k);
  k.teams = snapTeams(roster); k.start = Object.fromEntries(roster.flatMap(t => t.drivers.map(d => [d.name, +d.skill])));
  CAR.list.push(k);
  CAR.active = CAR.list.length - 1; CH.hl = null;
  newSeason();
}
/* réglages propres à chaque carrière : fixés à la création, indépendants de ceux du menu */
const CKEYS = ['lapsKey', 'wear', 'chaos', ...DIFF_KEYS, 'assist', 'noDnf', 'dmgLite', 'engine'];
function careerSettings(k) {
  if (!k.settings) { k.settings = Object.fromEntries(CKEYS.map(x => [x, ST[x]])); saveChamp(); }   // ancienne carrière : on fige les réglages actuels
  if (k.settings.tlRule == null) { k.settings.tlRule = k.settings.limits === false ? 'off' : 'indulgent'; k.settings.colRule = 'indulgent'; delete k.settings.limits; saveChamp(); }
  if (k.settings.level || k.settings.aiPace == null) {   // ancienne carrière à niveaux → réglages équivalents
    Object.assign(k.settings, OLD_LEVELS[k.settings.level] || OLD_LEVELS.pro); delete k.settings.level; saveChamp();
  }
  if (k.settings.engine !== 'ice' && k.settings.engine !== 'hybrid') { k.settings.engine = 'hybrid'; saveChamp(); }   // anciennes carrières (le motoriste écrasait ce réglage)
  return k.settings;
}
function applyCareerSettings() {   // les réglages du menu sont mis de côté le temps de la carrière
  const k = career(); if (!k) return;
  if (!ST._menu) ST._menu = Object.fromEntries([...CKEYS, 'human', 'circuit', 'weather'].map(x => [x, ST[x]]));
  Object.assign(ST, careerSettings(k), { human: k.driver || '' });
}
function restoreMenuSettings() {
  if (!ST._menu) return;
  Object.assign(ST, ST._menu); ST._menu = null; ST.quali = null;
}
const LAPS_LABEL = { '50': '50 % de la distance', '100': 'distance complète' };
function careerSummary(k) {
  const c = careerSettings(k), L = levelOf(c);
  const laps = LAPS_LABEL[c.lapsKey] || c.lapsKey + ' tours';
  return (k.driver ? `<b>${k.driver}</b> · ${L.name} · pénalités ${RULE_L[c.tlRule]} / ${RULE_L[c.colRule]} · direction ${({ on: 'assistée', semi: 'semi', off: 'libre' })[c.assist]} · ${c.noDnf ? 'sans abandon' : c.dmgLite ? 'abandons seuls' : 'dégâts réalistes'}` : '<b>Spectateur</b>')
    + (k.driver ? '' : c.noDnf ? ' · sans abandon' : c.dmgLite ? ' · abandons seuls' : '') + ` · ${c.engine === 'ice' ? '100 % thermique' : 'hybride'} · ${laps} · ${c.wear === 'real' ? 'usure réelle' : 'stratégie complète'} · incidents ${({ 1: 'réalistes', 2.5: 'agités', 5: 'chaos' })[c.chaos] || c.chaos}`;
}
/* formulaire de nouvelle carrière */
const CF = {};
function openCareerForm() {
  restoreMenuSettings();
  Object.assign(CF, Object.fromEntries(CKEYS.map(x => [x, ST[x]])), { driver: ST.human, role: CF.role || 'join', grid: CF.grid || 'off',
    dname: CF.dname || '', dnum: CF.dnum || 7, dlevel: CF.dlevel || 'mid', dperf: CF.dperf || dPerf(CF.dlevel || 'mid'), mlevel: CF.mlevel || 'mid', mperf: CF.mperf || dPerf(CF.mlevel || 'mid'), dteam: CF.dteam || ST.teams[ST.teams.length - 3].name, slot: CF.slot ?? 1,
    tname: CF.tname || '', col1: CF.col1 || '#7A1FA2', col2: CF.col2 || '#F2C200', motor: ENGINES.includes(CF.motor) ? CF.motor : 'Brackley', tlevel: CF.tlevel || 'mid',
    perf: CF.perf || Object.fromEntries(STATS.map(k => [k, (T_LEVELS[CF.tlevel] || T_LEVELS.mid).v])), mate: CF.mate || randomName() });
  ['dname', 'dnum', 'tname', 'mate'].forEach(k => { $('#cf-' + k).value = CF[k]; });
  renderCareerForm(); show('cnew');
}
/* ---- création d'un pilote ou d'une écurie pour la carrière ---- */
const CF_COLORS = ['#E10600', '#FF8000', '#F2C200', '#2BB24C', '#00A19C', '#1E5BFF', '#0A1F5C', '#7A1FA2', '#FF5FA2', '#F4F4F4', '#9AA0A6', '#111111'];
const ENGINES = ['Brackley', 'Maranello', 'Milton Keynes', 'Sakura', 'Neuburg'];
const T_LEVELS = { back: { l: 'Fond de grille', v: 61 }, mid: { l: 'Milieu de grille', v: 66 }, top: { l: 'Top team', v: 71 }, max: { l: 'Fusée', v: 78 } };
const PERF_L = [['ligne_droite', 'Moteur / vitesse de pointe'], ['virage', 'Aéro / virages'], ['pneus', 'Gestion des pneus'], ['depart', 'Départs']];
/* rang estimé de la voiture créée parmi les 12 du plateau */
function cfPerfNote() {
  const mine = perfRating(CF.perf), rk = 1 + ST.teams.filter(t => perfRating(t) > mine).length, n = ST.teams.length + 1;
  return `Voiture estimée ${rk === 1 ? '1re' : rk + 'e'} sur ${n} · ` + (rk <= 2 ? 'de quoi jouer les victoires… et la pression qui va avec.' : rk <= 5 ? 'une voiture de podium.' : rk <= 9 ? 'de quoi viser les points chaque week-end.' : 'marquer des points sera déjà une victoire.');
}
const D_LEVELS = { rookie: { l: 'Débutant', v: 64 }, mid: { l: 'Confirmé', v: 69 }, star: { l: 'Star', v: 74 }, legend: { l: 'Légende', v: 79 } };
const dPerf = lv => ({ skill: (D_LEVELS[lv] || D_LEVELS.mid).v, consistency: (D_LEVELS[lv] || D_LEVELS.mid).v });
const DPERF_L = [['skill', 'Talent (vitesse)'], ['consistency', 'Régularité (peu d’erreurs)']];
/* préréglages + curseurs (performance de la voiture, niveau des pilotes) ; o = objet modifié, onSet = après chaque changement */
function presetSliders(chips, box, note, levels, keys, o, cur, setLv, noteFn, max) {
  const lvOf = () => Object.keys(levels).find(v => keys.every(([k]) => +o[k] === levels[v].v)) || 'custom';
  chipGroup(chips, [...Object.entries(levels).map(([v, x]) => ({ v, l: x.l })), { v: 'custom', l: 'Sur mesure' }], cur, v => {
    if (levels[v]) keys.forEach(([k]) => { o[k] = levels[v].v; });
    setLv(v); renderCareerForm(); });
  const id = box.id;
  box.innerHTML = keys.map(([k, l]) => `<label for="${id}-${k}">${l}<output id="${id}-o-${k}">${(+o[k]).toFixed(1)}</output></label>
    <input type="range" id="${id}-${k}" min="50" max="${max}" step="0.5" value="${o[k]}" data-k="${k}">`).join('');
  box.querySelectorAll('input').forEach(inp => inp.oninput = () => {
    o[inp.dataset.k] = +inp.value; $('#' + id + '-o-' + inp.dataset.k).textContent = (+inp.value).toFixed(1);
    const lv = lvOf(); setLv(lv);
    chips.querySelectorAll('[data-v]').forEach(b => { b.classList.toggle('on', b.dataset.v === lv); b.setAttribute('aria-pressed', String(b.dataset.v === lv)); });
    note.textContent = noteFn();
  });
  note.textContent = noteFn();
}
/* rang estimé d'un pilote créé parmi les 24 (ou 22) du plateau */
function cfDriverNote(p, isMate) {
  const field = ST.teams.flatMap((t, ti) => t.drivers.filter((d, i) => !(CF.role === 'driver' && t.name === CF.dteam && i === CF.slot)).map(d => +d.skill));
  const rk = 1 + field.filter(v => v > +p.skill).length, n = field.length + (CF.role === 'team' ? 2 : 1);
  return `${isMate ? 'Coéquipier' : 'Pilote'} estimé ${rk === 1 ? '1er' : rk + 'e'} sur ${n} en talent` + (+p.consistency < 64 ? ' · attention aux erreurs' : +p.consistency >= 76 ? ' · très peu d’erreurs' : '');
}
function randomName() {
  const F = ['Alex', 'Sam', 'Léo', 'Nina', 'Max', 'Eva', 'Tom', 'Jade', 'Ivan', 'Mila', 'Oscar', 'Lina', 'Hugo', 'Zoé', 'Marco', 'Sofia'];
  const L = ['Durand', 'Kessler', 'Moreau', 'Silva', 'Novak', 'Rossi', 'Bauer', 'Hansen', 'Costa', 'Petit', 'Varga', 'Lindgren', 'Okafor', 'Tanaka', 'Romero', 'Fischer'];
  return F[Math.floor(Math.random() * F.length)] + ' ' + L[Math.floor(Math.random() * L.length)];
}
const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim();
function cfError(cf) {
  if (cf.role === 'join') return '';
  const me = cleanName(cf.dname), others = ST.teams.flatMap(t => t.drivers.filter((d, i) => !(cf.role === 'driver' && t.name === cf.dteam && i === cf.slot)).map(d => d.name.toLowerCase()));
  if (me.length < 3 || !me.includes(' ')) return 'Donne un prénom et un nom à ton pilote.';
  if (others.includes(me.toLowerCase())) return 'Ce nom de pilote est déjà pris.';
  const n = +cf.dnum; if (!(n >= 2 && n <= 99)) return 'Choisis un numéro entre 2 et 99.';
  if (cf.role === 'team') {
    const tn = cleanName(cf.tname), mate = cleanName(cf.mate);
    if (tn.length < 3) return 'Donne un nom à ton écurie.';
    if (ST.teams.some(t => t.name.toLowerCase() === tn.toLowerCase())) return 'Une écurie porte déjà ce nom.';
    if (mate.length < 3 || !mate.includes(' ')) return 'Donne un prénom et un nom à ton coéquipier.';
    if (mate.toLowerCase() === me.toLowerCase() || others.includes(mate.toLowerCase())) return 'Ton coéquipier doit avoir un autre nom.';
    if (cf.col1.toLowerCase() === cf.col2.toLowerCase()) return 'Choisis deux couleurs différentes.';
  }
  return '';
}
/* { c: description stockée dans la carrière, me: nom du pilote du joueur } ou null (écurie existante) */
function customFromForm(cf) {
  if (cf.role === 'join' || cfError(cf)) return null;
  const me = cleanName(cf.dname), drv = { name: me, num: +cf.dnum, skill: +cf.dperf.skill, consistency: +cf.dperf.consistency, custom: true };
  if (cf.role === 'driver') return { me, c: { teamName: cf.dteam, slot: cf.slot, driver: drv } };
  const mateNum = drv.num === 99 ? 98 : drv.num + 1;
  const team = { name: cleanName(cf.tname), color: cf.col1, color2: cf.col2, tv: cf.col1.toLowerCase() === '#111111' ? cf.col2 : cf.col1, engine: cf.motor, custom: true,
    ...Object.fromEntries(STATS.map(k => [k, +cf.perf[k]])),
    drivers: [drv, { name: cleanName(cf.mate), num: mateNum, skill: +cf.mperf.skill, consistency: +cf.mperf.consistency }] };
  return { me, c: { team } };   // 12e écurie : aucune écurie n'est retirée
}
/* aperçu de la voiture vue de dessus, aux couleurs choisies */
function carSVG(c1, c2, num) {
  return `<svg viewBox="0 0 360 130" role="img">
  <g stroke="#2a2e36" stroke-width="3" stroke-linecap="round"><path d="M72 30 L100 54 M98 30 L112 52 M72 100 L100 76 M98 100 L112 78 M262 32 L236 50 M286 34 L262 52 M262 98 L236 80 M286 96 L262 78"/></g>
  <g fill="#0d0f13"><rect x="62" y="8" width="46" height="24" rx="6"/><rect x="62" y="98" width="46" height="24" rx="6"/><rect x="250" y="4" width="54" height="30" rx="7"/><rect x="250" y="96" width="54" height="30" rx="7"/></g>
  <path d="M14 26 h18 v78 h-18 z" fill="${c2}"/><path d="M18 34 h18 v62 h-18 z" fill="${c1}"/>
  <path d="M30 58 C70 54 110 50 140 46 L150 30 C190 26 222 28 240 38 L300 48 L318 56 L318 74 L300 82 L240 92 C222 102 190 104 150 100 L140 84 C110 80 70 76 30 72 Z" fill="${c1}"/>
  <path d="M150 30 C190 26 222 28 240 38 L246 44 L150 44 Z M150 100 C190 104 222 102 240 92 L246 86 L150 86 Z" fill="${c2}"/>
  <path d="M30 58 C70 54 110 50 140 46 L300 50 L300 62 L30 62 Z" fill="#fff" opacity=".13"/>
  <path d="M176 52 C190 46 214 46 226 52 L226 78 C214 84 190 84 176 78 Z" fill="#0d0f13"/><path d="M168 65 C180 48 214 46 230 56 M168 65 C180 82 214 84 230 74" stroke="${c2}" stroke-width="4" fill="none"/>
  <circle cx="204" cy="65" r="8" fill="${c2}"/>
  <path d="M312 18 h28 v94 h-28 z" fill="${c2}"/><path d="M316 24 h20 v82 h-20 z" fill="${c1}"/>
  <text x="96" y="65" text-anchor="middle" dominant-baseline="central" font-family="JetBrains Mono, monospace" font-weight="700" font-size="17" fill="${c2}" transform="rotate(90 96 65)">${num || ''}</text></svg>`;
}
function renderCfPreview() {
  const box = $('#cf-preview'); if (box.hidden) return;
  const t = CF.role === 'team' ? { name: cleanName(CF.tname) || 'Ton écurie', color: CF.col1, color2: CF.col2 } : ST.teams.find(x => x.name === CF.dteam) || ST.teams[0];
  box.innerHTML = carSVG(t.color, t.color2 || '#fff', CF.dnum) + `<div class="cap">${escapeHtml(cleanName(CF.dname) || 'Ton pilote')} · #${+CF.dnum || ''}<small>${escapeHtml(t.name)}${CF.role === 'team' ? ' · moteur ' + CF.motor : ''}</small></div>`;
  const err = cfError(CF); $('#cf-err').hidden = !err; $('#cf-err').textContent = err; $('#cf-ok').disabled = !!err;
}
function escapeHtml(x) { return String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]); }
function swatches(el, cur, pick) {
  el.innerHTML = CF_COLORS.map(c => `<button style="background:${c}" class="${c.toLowerCase() === cur.toLowerCase() ? 'on' : ''}" data-c="${c}" aria-label="Couleur ${c}"></button>`).join('')
    + `<label title="Autre couleur" class="${CF_COLORS.some(c => c.toLowerCase() === cur.toLowerCase()) ? '' : 'on'}" style="${CF_COLORS.some(c => c.toLowerCase() === cur.toLowerCase()) ? '' : 'background:' + cur + ';border-style:solid'}">+<input type="color" value="${cur}" aria-label="Autre couleur"></label>`;
  el.querySelectorAll('button').forEach(b => b.onclick = () => pick(b.dataset.c));
  el.querySelector('input').onchange = e => pick(e.target.value);
}
function renderCareerForm() {
  chipGroup($('#cf-grid'), [{ v: 'off', l: 'Officielle' }, { v: 'regions', l: 'Régions de France' }], CF.grid, v => { CF.grid = v; renderCareerForm(); });
  $('#cf-grid-note').textContent = CF.grid === 'regions' ? 'Les écuries deviennent des régions françaises et les pilotes de grandes villes (noms, couleurs et drapeaux), le temps de la carrière.' : 'Les noms et couleurs du jeu (ou ton pack de noms).';
  chipGroup($('#cf-role'), [{ v: 'join', l: 'Écurie existante' }, { v: 'driver', l: 'Créer mon pilote' }, { v: 'team', l: 'Créer mon écurie' }], CF.role, v => { CF.role = v; renderCareerForm(); });
  $$('#cnew [data-role]').forEach(el => { el.hidden = !el.dataset.role.split(' ').includes(CF.role); });
  if (CF.role !== 'join') {
    swatches($('#cf-col1'), CF.col1, c => { CF.col1 = c; renderCareerForm(); });
    swatches($('#cf-col2'), CF.col2, c => { CF.col2 = c; renderCareerForm(); });
    chipGroup($('#cf-engine'), ENGINES.map(e => ({ v: e, l: e })), CF.motor, v => { CF.motor = v; renderCareerForm(); });
    // préréglages + réglage fin de chaque domaine (mêmes échelles que l'écran Écuries)
    presetSliders($('#cf-tlevel'), $('#cf-perf'), $('#cf-tlevel-note'), T_LEVELS, PERF_L, CF.perf, CF.tlevel, v => { CF.tlevel = v; }, cfPerfNote, 85);
    presetSliders($('#cf-dlevel'), $('#cf-dperf'), $('#cf-dlevel-note'), D_LEVELS, DPERF_L, CF.dperf, CF.dlevel, v => { CF.dlevel = v; }, () => cfDriverNote(CF.dperf), 90);
    presetSliders($('#cf-mlevel'), $('#cf-mperf'), $('#cf-mlevel-note'), D_LEVELS, DPERF_L, CF.mperf, CF.mlevel, v => { CF.mlevel = v; }, () => cfDriverNote(CF.mperf, true), 90);
    const ds = $('#cf-dteam'); ds.innerHTML = ST.teams.map(t => `<option value="${escapeHtml(t.name)}" ${t.name === CF.dteam ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
    ds.onchange = () => { CF.dteam = ds.value; renderCareerForm(); };
    const dt = ST.teams.find(t => t.name === CF.dteam) || ST.teams[0];
    chipGroup($('#cf-slot'), dt.drivers.map((d, i) => ({ v: i, l: d.name })), CF.slot, v => { CF.slot = +v; renderCareerForm(); });
    for (const k of ['dname', 'dnum', 'tname', 'mate']) $('#cf-' + k).oninput = e => { CF[k] = e.target.value; renderCfPreview(); };
  } else { $('#cf-err').hidden = true; $('#cf-ok').disabled = false; }
  renderCfPreview();
  const sel = $('#cf-driver');
  sel.innerHTML = '<option value="">Spectateur (toutes les voitures en IA)</option>' + ST.teams.map(t => t.drivers.map(d => `<option value="${d.name}" ${d.name === CF.driver ? 'selected' : ''}>${d.name} · ${t.name}</option>`).join('')).join('');
  sel.onchange = () => { CF.driver = sel.value; renderCareerForm(); };
  const drv = CF.role !== 'join' || !!CF.driver;
  for (const id of ['cf-pace', 'cf-brake', 'cf-help', 'cf-assist', 'cf-tl', 'cf-col']) $('#' + id).closest('.row').hidden = !drv;
  chipGroup($('#cf-laps'), [{ v: '1', l: '1' }, { v: '3', l: '3' }, { v: '5', l: '5' }, { v: '10', l: '10' }, { v: '20', l: '20' }, { v: '50', l: '50 %' }, { v: '100', l: 'Complet' }], CF.lapsKey, v => { CF.lapsKey = v; renderCareerForm(); });
  renderDiff('cf', CF, renderCareerForm);
  chipGroup($('#cf-assist'), [{ v: 'on', l: 'Assistée' }, { v: 'semi', l: 'Semi' }, { v: 'off', l: 'Libre' }], CF.assist, v => { CF.assist = v; renderCareerForm(); });
  chipGroup($('#cf-dmg'), DMG_CHIPS, dmgOf(CF), v => { setDmg(CF, v); renderCareerForm(); });
  chipGroup($('#cf-eng'), [{ v: 'hybrid', l: 'Hybride 2026' }, { v: 'ice', l: '100 % thermique' }], CF.engine, v => { CF.engine = v; renderCareerForm(); });
  $('#cf-eng-note').textContent = CF.engine === 'ice' ? 'Moteurs thermiques seuls (≈ 815 ch) : pas de batterie, pas de mode Overtake. Fixé pour toute la carrière.' : 'Hybride 2026 : batterie, récupération d’énergie et mode Overtake.';
  chipGroup($('#cf-wear'), [{ v: 'prop', l: 'Stratégie complète' }, { v: 'real', l: 'Usure réelle' }], CF.wear, v => { CF.wear = v; renderCareerForm(); });
  chipGroup($('#cf-chaos'), [{ v: 1, l: 'Réaliste' }, { v: 2.5, l: 'Agité' }, { v: 5, l: 'Chaos' }], CF.chaos, v => { CF.chaos = +v; renderCareerForm(); });
  $('#cf-cancel').textContent = career() ? 'Annuler' : 'Retour au menu';
}
function selectCareer(i) { CAR.active = i; CH.season = career().season; CH.hl = null; saveChamp(); }
function deleteCareer() {
  seasonClipsDrop(career());
  CAR.list.splice(CAR.active, 1); CAR.active = CAR.list.length ? 0 : -1;
  CH.season = career() ? career().season : null; CH.hl = null; saveChamp();
}
const myDriver = () => (career() && career().driver) || ST.human;
function newSeason() {
  CH.season = {
    round: 0, year: career() ? career().year : 2026, created: new Date().toISOString().slice(0, 10),
    // développement : rythme propre à chaque écurie et bonus cumulés (s'ajoutent aux réglages de début de saison)
    dev: Object.fromEntries(careerRoster(career()).map(t => [t.name, { rate: 0.6 + Math.random() * 0.8, ligne_droite: 0, virage: 0, pneus: 0, depart: 0 }])),
    form: {},   // évolution de la note de chaque pilote pendant la saison
    rounds: CAL.map(c => {
      const p = (RAINY[c.id] || 0.05) / 3, r = Math.random();   // pluie 3 fois plus rare (mais les averses durent plus longtemps)
      return { id: c.id, weather: r < p * 0.4 ? 'heavy' : r < p * 0.7 ? 'light' : r < p ? 'mixed' : 'dry', result: null };
    }),
  };
  developTeams(CH.season);   // premières évolutions dès l'ouverture de la saison
  saveChamp();
}
/* fin de saison : bilan archivé, voitures et pilotes reportés sur l'année suivante */
function nextSeason() {
  const k = career(), S = CH.season; if (!k || S.round < S.rounds.length) return;
  const { sortD, sortT } = standings();
  const races = new Map(), dnfs = new Map();
  for (const rd of S.rounds) for (const r of rd.result || []) { races.set(r.name, (races.get(r.name) || 0) + 1); if (r.dnf) dnfs.set(r.name, (dnfs.get(r.name) || 0) + 1); }
  const rating = Object.fromEntries(champTeams().flatMap(t => t.drivers.map(d => [d.name, +(+d.skill).toFixed(1)])));
  k.history.push({ year: S.year || k.year,
    d: sortD.map((d, i) => ({ name: d.name, team: d.team, pos: i + 1, pts: d.pts, wins: d.wins, pod: d.pod, poles: d.poles, races: races.get(d.name) || 0, dnf: dnfs.get(d.name) || 0, rating: rating[d.name] })),
    t: sortT.map((t, i) => ({ name: t.name, pos: i + 1, pts: t.pts, wins: t.wins })) });
  // voitures : 75 % du développement est conservé, puis léger resserrement (nouvelle réglementation, plafond budgétaire)
  // la moyenne du plateau revient à son niveau de début de saison : seuls les écarts entre écuries sont reportés
  const end = champTeams(), m0 = {}, m1 = {}, carried = {};
  for (const t of end) { const b = k.teams.find(x => x.name === t.name) || t; carried[t.name] = Object.fromEntries(STATS.map(a => [a, +b[a] + (+t[a] - +b[a]) * 0.75])); }
  for (const a of STATS) { m0[a] = k.teams.reduce((x, t) => x + +t[a], 0) / k.teams.length; m1[a] = end.reduce((x, t) => x + carried[t.name][a], 0) / end.length; }
  k.teams = end.map(t => {
    const b = k.teams.find(x => x.name === t.name) || t, o = { name: t.name };
    for (const a of STATS) o[a] = +clamp(m0[a] + (carried[t.name][a] - m1[a]) * 0.9 + (Math.random() - 0.5) * 3, 40, 92).toFixed(2);
    o.drivers = t.drivers.map(d => { const f = (S.form || {})[d.name] || 0, bd = (b.drivers || []).find(x => x.name === d.name) || d;
      const sk = clamp(+bd.skill + f * 0.8 + (Math.random() - 0.5) * 1.6, 50, 92);
      return { name: d.name, skill: +sk.toFixed(2), consistency: +clamp(+(bd.consistency ?? bd.skill) + f * 0.5 + (Math.random() - 0.5), 50, 92).toFixed(2) }; });
    return o;
  });
  k.year = (S.year || k.year) + 1;
  CH.hl = null;
  seasonClipsDrop(k);   // les extraits de la saison passée ne servent plus
  newSeason();
}
/* ---- évolutions techniques des écuries ---- */
const DEV_AREAS = {
  virage: { w: 0.5, label: 'aéro', parts: ['nouveau fond plat', 'aileron avant revu', 'évolution des pontons', 'nouvelle suspension avant', 'diffuseur modifié'] },
  ligne_droite: { w: 0.3, label: 'moteur / traînée', parts: ['aileron arrière basse traînée', 'mise à jour du moteur', 'capot moteur affiné', 'cartographie ERS optimisée'] },
  pneus: { w: 0.2, label: 'gestion pneus', parts: ['suspension arrière retravaillée', 'refroidissement des freins revu', 'meilleure gestion thermique des pneus'] },
};
const BIG_ROUNDS = new Set([4, 8, 12]);           // gros packages : Miami, Barcelone, Hongrie
function perfRating(t) { return (+t.ligne_droite * 1.0 + +t.virage * 1.3 + +t.pneus * 0.5) / 2.8; }
function champTeams() {
  const S = CH.season, base = careerBase(); if (!S || !S.dev) return base;
  const form = S.form || {};
  return base.map(t => { const d = S.dev[t.name] || {}; return Object.assign({}, t, { ligne_droite: +t.ligne_droite + (d.ligne_droite || 0), virage: +t.virage + (d.virage || 0), pneus: +t.pneus + (d.pneus || 0), depart: +t.depart + (d.depart || 0),
    drivers: t.drivers.map(dr => Object.assign({}, dr, { skill: +dr.skill + (form[dr.name] || 0), consistency: +(dr.consistency ?? dr.skill) + (form[dr.name] || 0) * 0.5 })) }); });
}
function activeTeams() { return (CH.pending || CH.inRace) ? champTeams() : ST.teams; }
function developTeams(S) {
  if (!S.dev) S.dev = Object.fromEntries(careerRoster(career()).map(t => [t.name, { rate: 1, ligne_droite: 0, virage: 0, pneus: 0, depart: 0 }]));
  const base0 = careerBase();
  const cur = champTeams(), ratings = cur.map(perfRating), best = Math.max(...ratings);
  const rd = S.round, late = rd >= 18 ? 0.35 : 1, big = BIG_ROUNDS.has(rd);
  const ups = [];
  cur.forEach((t, k) => {
    const d = S.dev[t.name];
    const catchup = 1 + Math.min(0.5, (best - ratings[k]) * 0.07);   // plafond budgétaire : les retardataires progressent un peu plus
    if (Math.random() > (big ? 0.95 : 0.6)) return;
    let r = Math.random(), area = 'virage';
    for (const [a, A] of Object.entries(DEV_AREAS)) { if (r < A.w) { area = a; break; } r -= A.w; }
    const A = DEV_AREAS[area];
    // ~0,065 s au tour par point (aéro / moteur) : une évolution vaut ~0,1 s, un gros package 0,2 à 0,3 s ;
    // sur une saison, ~1 s d'écart entre l'écurie qui développe le mieux et la moins efficace
    let delta = 1.8 * d.rate * catchup * late * (big ? 2 : 1) * (0.3 + Math.random() * 0.9);
    const fail = Math.random() < 0.1;
    if (fail) delta = -(0.4 + Math.random() * 0.9);
    delta = +delta.toFixed(2);
    d[area] = +Math.min(92 - (+base0.find(x => x.name === t.name)[area]), d[area] + delta).toFixed(2);
    ups.push({ team: t.name, area, delta, part: A.parts[Math.floor(Math.random() * A.parts.length)], fail, big });
  });
  S.rounds[rd].upgrades = ups;
}
const champCircuit = () => CIRCUITS.find(c => c.id === CH.season.rounds[CH.season.round].id);
function standings() {
  const drv = new Map(), team = new Map();
  for (const t of careerBase()) { team.set(t.name, { name: t.name, color: t.tv || t.color, pts: 0, wins: 0 }); for (const d of t.drivers) drv.set(d.name, { name: d.name, team: t.name, color: t.tv || t.color, pts: 0, wins: 0, pod: 0, poles: 0, best: 99 }); }
  for (const rd of CH.season.rounds) {
    if (!rd.result) continue;
    const pole = rd.pole || (rd.quali && rd.quali[0] && rd.quali[0].n), pd = pole && drv.get(pole); if (pd) pd.poles++;
    rd.result.forEach((r, i) => {
      const d = drv.get(r.name); if (!d) return;
      d.pts += r.pts; if (i === 0) d.wins++; if (i < 3 && !r.dnf) d.pod++; if (!r.dnf) d.best = Math.min(d.best, i + 1);
      const t = team.get(d.team); if (t) { t.pts += r.pts; if (i === 0) t.wins++; }
    });
  }
  const sortD = [...drv.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.best - b.best);
  const sortT = [...team.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins);
  return { sortD, sortT };
}
function recordChampRace(Rr) {
  const S = CH.season; if (!S || S.round >= S.rounds.length) return;
  const { order } = classify(Rr);
  // grid / why / sc / wet : pour les moments marquants de la vidéo résumé de la saison
  S.rounds[S.round].result = order.map((c, i) => Object.assign({ name: c.driver.name, team: c.team.name, dnf: c.state === 'out' || !!c.dsq, pts: c.state === 'out' || c.dsq ? 0 : POINTS[i] || 0, grid: c.gridPos },
    c.state === 'out' ? { why: c.retiredWhy || '' } : c.dsq ? { why: 'disqualifié' } : {}));
  S.rounds[S.round].sc = Rr.events.filter(e => e.type === 'sc' || e.type === 'vsc').length;
  S.rounds[S.round].wet = Rr.events.some(e => e.type === 'wx') || Rr.wet >= 0.2;
  S.rounds[S.round].fastest = Rr.fastest ? Rr.cars[Rr.fastest.id].driver.name : null;
  const pc = Rr.cars.find(c => c.gridPos === 1); if (pc) S.rounds[S.round].pole = pc.driver.name;
  dropSavedRace();
  seasonClipsSave(Rr, S.round);
  updateForm(S, S.rounds[S.round].result);
  S.round++;
  if (S.round < S.rounds.length) developTeams(S);
  saveChamp();
}
/* ---- extraits de course de la carrière (pour les vidéos de saison des pilotes) ----
   à chaque manche (regardée ou simulée), on garde quelques secondes d'enregistrement autour du départ, de l'arrivée du podium,
   du meilleur dépassement de chaque pilote et de chaque abandon ; stockés dans IndexedDB (« clips »), effacés à la saison suivante */
const clipKey = (k, rd) => 'c' + k.id + '-' + rd;
function seasonClipsOf(Rr) {
  const F = Rr.rec && Rr.rec.frames; if (!F || F.length < 20) return null;
  const n = Rr.cars.length, st = Rr.startT || F[0].t, out = [];
  const win = (kind, focus, other, t0, t1) => out.push({ kind, focus, other, t0, t1 });
  win('start', null, null, st - 1, st + 9);
  // arrivée des trois premiers (classement officiel)
  const { order } = classify(Rr);
  order.slice(0, 3).forEach((c, i) => { if (c.finishT > 0 && c.state !== 'out') win('finish', c.id, i + 1, c.finishT - 6.5, c.finishT + 1.5); });
  // passage de la ligne de chaque pilote classé (courbe course par course des vidéos de pilote)
  order.forEach((c, i) => { if (c.finishT > 0 && c.state !== 'out' && !c.dsq) win('line', c.id, i + 1, c.finishT - 2, c.finishT + 0.6); });
  // abandons : premier enregistrement où la voiture est hors course
  for (let k = 0; k < n; k++) { const fi = F.findIndex(f => f.g[k * 2] & 2); if (fi > 0) win('out', k, Rr.cars[k].retiredWhy || '', F[fi].t - 5, F[fi].t + 2.5); }
  // meilleur dépassement de chaque pilote (en piste, la meilleure place obtenue), après le premier tour :
  // jamais sur une voiture qui rentre ou sort des stands, qui abandonne ou qui est au ralenti (otOk)
  const best = new Array(n).fill(null);
  for (let fi = 1; fi < F.length; fi++) {
    const a = F[fi - 1], b = F[fi]; if (b.t < st + 25) continue;
    const ok = (f, k) => !(f.g[k * 2] & 7);
    // place en course : toutes les voitures encore en course, y compris celles dans la voie des stands
    const rank = Array.from({ length: n }, (_, k) => k).filter(k => !(b.g[k * 2] & 6)).sort((x, y) => b.f[y * 7] - b.f[x * 7]);
    for (let p = 0; p < Math.min(rank.length, 15); p++) {
      const A = rank[p]; if (!ok(b, A)) continue;
      for (let q = p + 1; q < Math.min(rank.length, p + 4); q++) {
        const B = rank[q];
        if (!ok(a, A) || !ok(a, B) || a.f[A * 7] >= a.f[B * 7] || b.f[A * 7] - b.f[B * 7] > 30) continue;   // A était derrière B juste avant, et le passe en piste
        if ((!best[A] || p + 1 < best[A].pos) && otOk(F, A, B, b.t)) best[A] = { pos: p + 1, t: b.t, B };
      }
    }
  }
  best.forEach((x, k) => { if (x) win('ot', k, { pos: x.pos, b: x.B }, x.t - 5, x.t + 2.5); });
  const clips = out.map(c => { const m = c.kind === 'line' ? 0.3 : 1; return { ...c, frames: F.filter(f => f.t >= c.t0 - m && f.t <= c.t1 + m) }; }).filter(c => c.frames.length > 4);
  return { v: 3, circ: Rr.T.circ.id, laps: Rr.laps, names: Rr.cars.map(c => c.driver.name), fin: Rr.finishOrder.slice(), ft: Rr.cars.map(c => c.finishT || 0), fl: Rr.cars.map(c => c.finLaps || 0), clips };
}
/* un vrai dépassement : la voiture passée ne rentre pas aux stands, n'en sort pas, n'abandonne pas et roule à la même allure */
function otOk(F, A, B, t, slow = 0.82) {   // slow : en dessous de cette fraction de la vitesse de A, B est « au ralenti »
  for (const f of F) {
    if (f.t < t - 8 || f.t > t + 12) continue;
    const gb = f.g[B * 2], ga = f.g[A * 2];
    if (gb & 1 || ((gb & 2) && f.t < t + 6)) return false;
    if (ga & 1 && f.t < t) return false;   // A sort des stands : ce sont les autres qui rentrent, pas un dépassement
    if (Math.abs(f.t - t) < 0.3 && f.f[B * 7 + 3] < slow * f.f[A * 7 + 3]) return false;
  }
  return true;
}
function seasonClipsSave(Rr, rd) {
  const k = career(); if (!k) return;
  let pack = null; try { pack = seasonClipsOf(Rr); } catch (e) { pack = null; }
  if (pack) rsvOp('readwrite', st => st.put(pack, clipKey(k, rd)), 'clips').catch(() => {});
}
async function seasonClipsLoad(k) {
  const out = [];
  for (let rd = 0; rd < 30; rd++) { let x = null; try { x = await rsvOp('readonly', st => st.get(clipKey(k, rd)), 'clips'); } catch (e) { x = null; } out.push(x || null); }
  return out;
}
/* manches sans extraits (courues avant la 2.22) : on les tire des replays sauvegardés de cette carrière
   (même nom de carrière, même manche, même circuit, sauvegardés pendant la saison en cours) */
async function seasonClipsFromReplays(k, packs) {
  const S = k.season, t0 = S && S.created ? Date.parse(S.created) - 864e5 : 0;   // date de création sans l'heure : un jour de marge
  let n = 0;
  for (const m of rplList()) {
    if (m.career !== k.name || !m.round || (m.at || 0) < t0) continue;
    const rd = m.round - 1, r = S.rounds[rd], ci = CIRCUITS.findIndex(c => c.id === m.circ);
    if (!r || !r.result || r.id !== m.circ || (packs[rd] && packs[rd].v >= 3) || ci < 0) continue;   // anciens extraits : on les refait (filtre des dépassements, arrivée de chaque pilote)
    const snap = await rplLoad(m.id); if (!snap || !snap.R) continue;
    snap.R.T = getTrack(ci);
    let pack = null; try { pack = seasonClipsOf(snap.R); } catch (e) { pack = null; }
    if (!pack) continue;
    packs[rd] = pack; n++;
    rsvOp('readwrite', st => st.put(pack, clipKey(k, rd)), 'clips').catch(() => {});
  }
  return n;
}
function seasonClipsDrop(k) { if (k) for (let rd = 0; rd < 30; rd++) rsvOp('readwrite', st => st.delete(clipKey(k, rd)), 'clips').catch(() => {}); }
/* ---- course de carrière sauvegardée : on la quitte en pleine course et on la reprend plus tard (même des semaines après) ----
   l'état complet de la course (R) est copié tel quel dans IndexedDB (clone structuré : Map, Set, tableaux typés, références croisées) ;
   la carrière garde un petit résumé k.saved { round, lap, laps, at } pour l'affichage */
const RSV = { db: null, lastT: 0, busy: false };
function rsvDb() {
  if (RSV.db) return RSV.db;
  RSV.db = new Promise((res, rej) => {
    try {
      const rq = indexedDB.open('paddock26', 3);
      rq.onupgradeneeded = () => { const db = rq.result; for (const n of ['race', 'replays', 'clips']) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  });
  RSV.db.catch(() => { RSV.db = null; });
  return RSV.db;
}
async function rsvOp(mode, fn, store) {
  const db = await rsvDb(); store = store || 'race';
  return new Promise((res, rej) => { const tx = db.transaction(store, mode), st = tx.objectStore(store), rq = fn(st); tx.oncomplete = () => res(rq && rq.result); tx.onerror = tx.onabort = () => rej(tx.error); });
}
const canSaveRace = () => R && CH.inRace && CH.season && !R.qualiRun && !R.tt && !R.net && !R.over && !RP.on && !HL.on && career();
async function saveRaceState() {
  if (!canSaveRace() || RSV.busy) return false;
  const k = career(), S = CH.season, lead = R.ranked && R.ranked[0];
  const T0 = R.T; RSV.busy = true;
  try {
    R.T = null;   // la piste se reconstruit à partir du circuit
    const snap = { v: 1, career: k.id, round: S.round, circuit: ST.circuit, weather: ST.weather, human: ST.human, follow, camMode, at: Date.now(), R };
    const p = rsvOp('readwrite', st => st.put(snap, 'k' + k.id));   // le clone est fait ici, de façon synchrone
    R.T = T0;
    await p;
    k.saved = { round: S.round, lap: lead ? clamp(Math.floor(lead.dist / T0.L) + 1, 1, R.laps) : 1, laps: R.laps, at: snap.at, human: R.cars.some(c => c.human) };
    saveChamp(); RSV.lastT = performance.now();
    return true;
  } catch (e) { R.T = T0; return false; }
  finally { RSV.busy = false; }
}
function dropSavedRace(k) {
  k = k || career(); if (!k) return;
  if (k.saved) { delete k.saved; saveChamp(); }
  rsvOp('readwrite', st => st.delete('k' + k.id)).catch(() => {});
}
async function resumeSavedRace() {
  const k = career(); if (!k || !k.saved) return;
  let snap = null;
  try { snap = await rsvOp('readonly', st => st.get('k' + k.id)); } catch (e) { snap = null; }
  if (!snap || !snap.R || snap.round !== CH.season.round) { dropSavedRace(k); renderChamp(); $('#ch-saved').hidden = false; $('#ch-saved').textContent = 'Sauvegarde de course introuvable : la manche reprend depuis le début.'; return; }
  applyCareerSettings();
  ST.circuit = snap.circuit; ST.weather = snap.weather; ST.quali = null;
  const circ = CIRCUITS[ST.circuit];
  SIM.setEngine(ST.engine);
  T = getTrack(ST.circuit);
  R = snap.R; R.T = T; R.resultsShown = false;
  CH.inRace = true; CH.pending = false;
  initAudio();
  HUM = R.cars.find(c => c.human) || null;
  follow = HUM ? HUM.id : clamp(snap.follow | 0, 0, R.cars.length - 1);
  if (snap.camMode && CAM_MODES.some(m => m[0] === snap.camMode)) camMode = snap.camMode;
  if (HUM) { HUM.input = R.input; Object.assign(R.input, { thr: 0, brk: 0, steer: 0 }); }
  enterView(circ);
  evIdx = R.events.length;
  paused = true; $('#btn-pause').textContent = $('#btn-pause2').textContent = 'Reprendre';
  toast({ type: 'info', msg: `Course reprise · tour ${k.saved.lap}/${k.saved.laps} — appuie sur « Reprendre » pour repartir`, cars: [] });
  RSV.lastT = performance.now();
}
/* sauvegarde automatique pendant une course de carrière (et quand l'appli passe en arrière-plan) */
function autoSaveRace() { if (canSaveRace() && !paused && performance.now() - RSV.lastT > 20000) saveRaceState(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && canSaveRace()) saveRaceState(); });
window.addEventListener('pagehide', () => { if (canSaveRace()) saveRaceState(); });
/* note des pilotes : on compare la place obtenue à la place « attendue » (voiture + note) */
function updateForm(S, result) {
  S.form = S.form || {};
  const teams = champTeams(), score = new Map();
  for (const t of teams) for (const d of t.drivers) score.set(d.name, perfRating(t) * 1.3 + +d.skill * 0.5);
  const exp = [...score.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  result.forEach((r, i) => {
    if (r.dnf) return;
    const e = exp.indexOf(r.name) + 1; if (!e) return;
    const f = (S.form[r.name] || 0) + clamp((e - (i + 1)) * 0.045, -0.35, 0.35);
    S.form[r.name] = +clamp(f, -4, 4).toFixed(3);
  });
}
function openChamp() { if (!PRO) { openPro(); return; }
  if (!career()) { openCareerForm(); return; } CH.season = career().season; applyCareerSettings(); renderChamp(); show('champ'); }
const WX_LABEL = { dry: 'Sec', light: 'Pluie légère', heavy: 'Pluie forte', mixed: 'Averses possibles' };
function renderChamp() {
  const S = CH.season, done = S.round >= S.rounds.length;
  const { sortD, sortT } = standings();
  $('#ch-career').innerHTML = CAR.list.map((k, i) => `<option value="${i}" ${i === CAR.active ? 'selected' : ''}>${k.name} · ${k.year}${k.history.length ? ' (' + (k.history.length + 1) + 'e saison)' : ''}</option>`).join('');
  $('#ch-title').textContent = `Championnat ${S.year || career().year}`;
  $('#ch-set').innerHTML = careerSummary(career());
  $('#ch-round').textContent = done ? 'Saison terminée' : `Manche ${S.round + 1} / ${S.rounds.length}`;
  if (done) {
    $('#ch-next').innerHTML = `<span class="ch-champ">🏆 Champion du monde : <b>${sortD[0].name}</b> (${sortD[0].pts} pts) · Écuries : <b>${sortT[0].name}</b></span>`;
  } else {
    const c = champCircuit(), rd = S.rounds[S.round];
    $('#ch-next').innerHTML = `<b>${c.flag} ${c.name}</b><span>${c.sub} · ${lapsFor(c)} tours · météo : ${WX_LABEL[rd.weather]}</span>` + upgradesNews();
  }
  const sv = !done && career().saved && career().saved.round === S.round ? career().saved : null;
  if (career().saved && !sv) dropSavedRace();
  $('#ch-quali').textContent = done ? `Saison ${(S.year || career().year) + 1} →` : sv ? `▶ Reprendre la course · tour ${sv.lap}/${sv.laps}` : 'Courir ce GP';
  $('#ch-sim').hidden = done; $('#ch-vid').hidden = done; $('#ch-svid').hidden = done; $('#ch-rvid').hidden = $('#ch-dvid').hidden = $('#ch-tdvid').hidden = $('#ch-ttvid').hidden = $('#ch-xvid').hidden = $('#ch-pv').hidden = !done;
  if (done) { const ps = $('#ch-psel'), cur = ps.value || myDriver() || sortD[0].name; ps.innerHTML = sortD.map((d, i) => `<option value="${escapeHtml(d.name)}" ${d.name === cur ? 'selected' : ''}>P${i + 1} · ${escapeHtml(d.name)}</option>`).join(''); }
  $('#ch-sim').textContent = sv ? 'Abandonner et recommencer' : 'Simuler ce GP';
  $('#ch-saved').hidden = !sv;
  if (sv) $('#ch-saved').textContent = `Course en cours sauvegardée le ${new Date(sv.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${new Date(sv.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
  $$('#ch-tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === CH.tab); b.setAttribute('aria-pressed', b.dataset.tab === CH.tab); });
  const me = myDriver();
  let html;
  const extra = $('#ch-extra'); extra.hidden = true;
  const tab = CH.tab === 'pts' ? (CH.pk === 't' ? 'teams' : 'drivers') : CH.tab;   // sous le graphique des points : le classement correspondant
  if (tab === 'drivers') html = `<thead><tr><th></th><th>Pilote</th><th>Pts</th><th>V</th><th>Pole</th><th>Pod.</th></tr></thead><tbody>` +
    sortD.map((d, i) => `<tr><td class="n">${i + 1}</td><td${d.name === me ? ' class="mine"' : ''}><i class="tb" style="background:${d.color}"></i>${d.name}<small>${d.team}</small></td><td class="t"><b>${d.pts}</b></td><td class="t">${d.wins}</td><td class="t">${d.poles}</td><td class="t">${d.pod}</td></tr>`).join('') + '</tbody>';
  else if (tab === 'teams') html = `<thead><tr><th></th><th>Écurie</th><th>Pts</th><th>V</th></tr></thead><tbody>` +
    sortT.map((t, i) => `<tr><td class="n">${i + 1}</td><td><i class="tb" style="background:${t.color}"></i>${t.name}</td><td class="t"><b>${t.pts}</b></td><td class="t">${t.wins}</td></tr>`).join('') + '</tbody>';
  else if (CH.tab === 'dev') {
    const base = Object.fromEntries(careerBase().map(t => [t.name, perfRating(t)]));
    const rows = champTeams().map(t => ({ t, now: perfRating(t), d: perfRating(t) - base[t.name] })).sort((a, b) => b.now - a.now);
    const top = rows[0].now;
    html = `<thead><tr><th></th><th>Écurie</th><th>Performance</th><th>Évol.</th></tr></thead><tbody>` +
      rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td><i class="tb" style="background:${r.t.tv || r.t.color}"></i>${r.t.name}<small>${lastUps(r.t.name)}</small></td><td class="t"><span class="perf"><i style="width:${Math.max(4, 100 - (top - r.now) * 12)}%;background:${r.t.tv || r.t.color}"></i></span>${(top - r.now) < 0.005 ? 'réf.' : '+' + ((top - r.now) * 0.11).toFixed(2) + ' s'}</td><td class="t ${r.d >= 0 ? 'up' : 'down'}">${(r.d >= 0 ? '−' : '+') + Math.abs(r.d * 0.11).toFixed(2).replace('.', ',')} s</td></tr>`).join('') + '</tbody>';
  }
  else if (CH.tab === 'ratings') {
    const start = Object.fromEntries(careerBase().flatMap(t => t.drivers.map(d => [d.name, +d.skill])));
    const first = career().start || {};
    const rows = champTeams().flatMap(t => t.drivers.map(d => ({ d, t, v: +d.skill }))).sort((a, b) => b.v - a.v);
    html = `<thead><tr><th></th><th>Pilote</th><th>Note</th><th>Saison</th><th>Carrière</th></tr></thead><tbody>` +
      rows.map((r, i) => { const ds = r.v - start[r.d.name], dc = first[r.d.name] != null ? r.v - first[r.d.name] : 0, col = r.t.tv || r.t.color;
        const sg = x => `<td class="t ${x > 0.05 ? 'up' : x < -0.05 ? 'down' : ''}">${x > 0.05 ? '▲ +' + x.toFixed(1) : x < -0.05 ? '▼ ' + x.toFixed(1) : '='}</td>`;
        return `<tr><td class="n">${i + 1}</td><td${r.d.name === me ? ' class="mine"' : ''}><i class="tb" style="background:${col}"></i>${r.d.name}<small>${r.t.name} · régularité ${Math.round(+r.d.consistency)}</small></td><td class="t"><span class="rt"><i style="width:${clamp((r.v - 55) / 35 * 100, 3, 100)}%;background:${col}"></i></span><span class="rt-v">${r.v.toFixed(1)}</span></td>${sg(ds)}${sg(dc)}</tr>`; }).join('') + '</tbody>';
  }
  else if (CH.tab === 'career') { html = renderCareer(sortD, sortT, me); extra.hidden = false; }
  else html = `<thead><tr><th></th><th>Grand Prix</th><th>Vainqueur</th><th>Météo</th></tr></thead><tbody>` +
    S.rounds.map((rd, i) => { const c = CIRCUITS.find(x => x.id === rd.id); const w = rd.result && rd.result[0]; return `<tr class="${i === S.round ? 'nextrd' : ''}"><td class="n">${i + 1}</td><td>${c.flag} ${c.name}<small>${c.sub}</small></td><td>${w ? w.name + '<small>' + w.team + '</small>' : i === S.round ? '<em>prochaine manche</em>' : ''}</td><td class="t">${WX_LABEL[rd.weather]}</td></tr>`; }).join('') + '</tbody>';
  $('#ch-table').innerHTML = html;
  const chart = $('#ch-chart');
  chart.hidden = CH.tab !== 'dev' && CH.tab !== 'pts';
  if (CH.tab === 'dev') renderDevChart();
  if (CH.tab === 'pts') renderPtsChart();
}
/* ---- graphique : écart au plus rapide, manche après manche ---- */
const W_AREA = { ligne_droite: 1 / 2.8, virage: 1.3 / 2.8, pneus: 0.5 / 2.8 };
function devHistory() {
  const S = CH.season, n = Math.min(S.round, S.rounds.length - 1);
  const cur = Object.fromEntries(careerBase().map(t => [t.name, perfRating(t)]));
  const hist = [];
  for (let i = 0; i <= n; i++) {
    for (const u of S.rounds[i].upgrades || []) cur[u.team] += u.delta * (W_AREA[u.area] || 0);
    const best = Math.max(...Object.values(cur));
    hist.push(Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, (best - v) * 0.11])));
  }
  return hist;
}
function renderDevChart() {
  const S = CH.season, hist = devHistory(), teams = careerRoster(career());
  if (!CH.hl) {   // par défaut : ton écurie + les 2 premières
    const last = hist[hist.length - 1], order = teams.map(t => t.name).sort((a, b) => last[a] - last[b]);
    const mine = teams.find(t => t.drivers.some(d => d.name === ST.human));
    CH.hl = [...new Set([...(mine ? [mine.name] : []), ...order])].slice(0, 3);
  }
  const W = 340, H = 200, ml = 36, mr = 44, mt = 12, mb = 24, pw = W - ml - mr, ph = H - mt - mb;
  const maxGap = Math.max(0.3, ...hist.flatMap(h => Object.values(h)));
  const top = Math.ceil(maxGap * 10) / 10;
  const X = i => ml + (hist.length > 1 ? i / (hist.length - 1) : 0.5) * pw, Y = g => mt + (g / top) * ph;
  const col = t => t.tv || t.color;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Écart au plus rapide par écurie et par manche">`;
  for (let k = 0; k <= 4; k++) { const g = top * k / 4, y = Y(g); svg += `<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" class="gl"/><text x="${ml - 6}" y="${y + 3}" class="ax" text-anchor="end">${k === 0 ? 'réf.' : '+' + g.toFixed(1).replace('.', ',')}</text>`; }
  const step = Math.max(1, Math.ceil(hist.length / 8));
  hist.forEach((h, i) => { if (i % step === 0 || i === hist.length - 1) svg += `<text x="${X(i)}" y="${H - 6}" class="ax" text-anchor="middle">${i + 1}</text>`; });
  const line = name => hist.map((h, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(h[name]).toFixed(1)}`).join('');
  for (const t of teams) if (!CH.hl.includes(t.name)) svg += `<path d="${line(t.name)}" class="bg"/>`;
  const last = hist[hist.length - 1];
  const labs = CH.hl.map(n => ({ n, y: Y(last[n]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 11) labs[k].y = labs[k - 1].y + 11;   // évite les étiquettes qui se chevauchent
  for (const n of CH.hl) {
    const t = teams.find(x => x.name === n);
    svg += `<path d="${line(n)}" class="hl" stroke="${col(t)}"/>`;
    hist.forEach((h, i) => { svg += `<circle cx="${X(i)}" cy="${Y(h[n])}" r="${hist.length > 12 ? 2 : 3}" fill="${col(t)}" class="pt"/>`; });
    const lb = labs.find(l => l.n === n);
    svg += `<text x="${W - mr + 5}" y="${lb.y + 3}" class="lab">${n.split(' ')[0]}</text>`;
  }
  if (CH.sel != null && CH.sel < hist.length) svg += `<line x1="${X(CH.sel)}" x2="${X(CH.sel)}" y1="${mt}" y2="${mt + ph}" class="cross"/>`;
  svg += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent" id="ch-hit"/></svg>`;
  const chips = teams.map(t => `<button class="chip ${CH.hl.includes(t.name) ? 'on' : ''}" data-team="${t.name}" aria-pressed="${CH.hl.includes(t.name)}"><i style="background:${col(t)}"></i>${t.name}</button>`).join('');
  let tip = '';
  if (CH.sel != null && CH.sel < hist.length) {
    const rd = S.rounds[CH.sel], c = CIRCUITS.find(x => x.id === rd.id), h = hist[CH.sel];
    tip = `<div class="ch-tip"><b>${c.flag} ${c.name} (manche ${CH.sel + 1})</b>` + CH.hl.map(n => `<span><i style="background:${col(teams.find(x => x.name === n))}"></i>${n} ${h[n] < 0.005 ? 'référence' : '+' + h[n].toFixed(2).replace('.', ',') + ' s'}</span>`).join('') + `</div>`;
  }
  $('#ch-chart').innerHTML = `<div class="ch-ct"><b>Écart au plus rapide</b><small>secondes au tour, avant chaque GP · touche une écurie pour la suivre (3 max)</small></div>${svg}${tip}<div class="chips ch-legend">${chips}</div>`;
  $$('#ch-chart .ch-legend .chip').forEach(b => b.onclick = () => {
    const n = b.dataset.team, i = CH.hl.indexOf(n);
    if (i >= 0) CH.hl.splice(i, 1); else { CH.hl.push(n); if (CH.hl.length > 3) CH.hl.shift(); }
    renderDevChart();
  });
  const hit = $('#ch-hit');
  const pick = e => { const r = hit.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width; CH.sel = Math.round(clamp(fx, 0, 1) * (hist.length - 1)); renderDevChart(); };
  hit.addEventListener('pointerdown', pick);
}
/* ---- graphique : points cumulés au fil de la saison (pilotes ou écuries) ---- */
function ptsHistory(kind, S) {
  S = S || CH.season;
  const n = Math.min(S.round, S.rounds.length), base = careerBase(), items = [];
  if (kind === 't') for (const t of base) items.push({ name: t.name, short: t.name.split(' ')[0], color: t.tv || t.color, dash: false });
  else for (const t of base) t.drivers.forEach((d, i) => items.push({ name: d.name, short: lastName(d.name), team: t.name, color: t.tv || t.color, dash: i > 0 }));
  const cum = Object.fromEntries(items.map(x => [x.name, 0])), hist = [Object.assign({}, cum)];
  for (let i = 0; i < n; i++) {
    for (const r of S.rounds[i].result || []) { const k = kind === 't' ? r.team : r.name; if (k in cum) cum[k] += r.pts; }
    hist.push(Object.assign({}, cum));
  }
  return { items, hist };
}
function renderPtsChart() {
  const S = CH.season, kind = CH.pk || 'd', { items, hist } = ptsHistory(kind), n = hist.length - 1, last = hist[n];
  const order = items.map(x => x.name).sort((a, b) => last[b] - last[a]);
  const me = myDriver(), mine = kind === 't' ? (careerBase().find(t => t.drivers.some(d => d.name === me)) || {}).name : me;
  if (!CH.ph || CH.ph.kind !== kind) CH.ph = { kind, on: [...new Set([...order.slice(0, 4), ...(mine && items.some(x => x.name === mine) ? [mine] : [])])].slice(0, 5) };
  const on = CH.ph.on, byName = Object.fromEntries(items.map(x => [x.name, x]));
  const seg = `<div class="chips ch-pk"><button class="chip ${kind === 'd' ? 'on' : ''}" data-pk="d" aria-pressed="${kind === 'd'}">Pilotes</button><button class="chip ${kind === 't' ? 'on' : ''}" data-pk="t" aria-pressed="${kind === 't'}">Écuries</button></div>`;
  let body;
  if (n === 0) body = '<p class="note">Le graphique apparaîtra après la première manche.</p>';
  else {
    const W = 340, H = 220, ml = 30, mr = 82, mt = 10, mb = 24, pw = W - ml - mr, ph = H - mt - mb;
    const mx = Math.max(...Object.values(last)), stp = [5, 10, 25, 50, 100, 150, 200, 250].find(x => x * 4 >= mx) || Math.ceil(mx / 400) * 100, top = stp * 4;   // graduations rondes
    const X = i => ml + i / n * pw, Y = p => mt + (1 - p / top) * ph;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Points cumulés manche après manche">`;
    for (let k = 0; k <= 4; k++) { const p = top * k / 4, y = Y(p); svg += `<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" class="gl"/><text x="${ml - 5}" y="${y + 3}" class="ax" text-anchor="end">${Math.round(p)}</text>`; }
    const step = Math.max(1, Math.ceil(n / 8));
    for (let i = 1; i <= n; i++) if (i % step === 0 || i === n) svg += `<text x="${X(i)}" y="${H - 6}" class="ax" text-anchor="middle">${i}</text>`;
    const line = name => hist.map((h, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(h[name]).toFixed(1)}`).join('');
    for (const x of items) if (!on.includes(x.name)) svg += `<path d="${line(x.name)}" class="bg"/>`;
    const labs = on.map(nm => ({ nm, y: Y(last[nm]) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 11) labs[k].y = labs[k - 1].y + 11;
    for (const nm of on.slice().reverse()) {
      const x = byName[nm]; if (!x) continue;
      svg += `<path d="${line(nm)}" class="hl" stroke="${x.color}"${x.dash ? ' stroke-dasharray="5 3"' : ''}/>`;
      if (n <= 12) hist.forEach((h, i) => { if (i) svg += `<circle cx="${X(i)}" cy="${Y(h[nm])}" r="2.5" fill="${x.color}" class="pt"/>`; });
      const lb = labs.find(l => l.nm === nm);
      svg += `<text x="${W - mr + 5}" y="${lb.y + 3}" class="lab">${x.short} ${last[nm]}</text>`;
    }
    if (CH.psel != null && CH.psel <= n && CH.psel > 0) svg += `<line x1="${X(CH.psel)}" x2="${X(CH.psel)}" y1="${mt}" y2="${mt + ph}" class="cross"/>`;
    svg += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent" id="ch-phit"/></svg>`;
    let tip = '';
    if (CH.psel != null && CH.psel > 0 && CH.psel <= n) {
      const rd = S.rounds[CH.psel - 1], c = CIRCUITS.find(x => x.id === rd.id), h = hist[CH.psel], w = rd.result && rd.result[0];
      tip = `<div class="ch-tip"><b>${c.flag} ${c.name} (manche ${CH.psel})${w ? ' · victoire ' + w.name : ''}</b>` + on.slice().sort((a, b) => h[b] - h[a]).map(nm => `<span><i style="background:${byName[nm].color}"></i>${nm} · ${h[nm]} pts (+${h[nm] - hist[CH.psel - 1][nm]})</span>`).join('') + `</div>`;
    }
    body = svg + tip;
  }
  const chips = order.map(nm => { const x = byName[nm]; return `<button class="chip ${on.includes(nm) ? 'on' : ''}" data-who="${nm}" aria-pressed="${on.includes(nm)}"><i style="background:${x.color}"></i>${kind === 'd' ? x.short : nm}</button>`; }).join('');
  $('#ch-chart').innerHTML = `<div class="ch-ct"><b>Course au titre</b><small>points cumulés après chaque manche · touche un nom pour le suivre (5 max)</small></div>${seg}${body}<div class="chips ch-legend">${chips}</div>`;
  $$('#ch-chart .ch-pk .chip').forEach(b => b.onclick = () => { CH.pk = b.dataset.pk; CH.psel = null; renderChamp(); });
  $$('#ch-chart .ch-legend .chip').forEach(b => b.onclick = () => {
    const nm = b.dataset.who, i = on.indexOf(nm);
    if (i >= 0) on.splice(i, 1); else { on.push(nm); if (on.length > 5) on.shift(); }
    renderPtsChart();
  });
  const hit = $('#ch-phit');
  if (hit) hit.addEventListener('pointerdown', e => { const r = hit.getBoundingClientRect(); CH.psel = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * n); renderPtsChart(); });
}
function lastUps(team) {
  const S = CH.season;
  for (let i = Math.min(S.round, S.rounds.length - 1); i >= 0; i--) {
    const u = (S.rounds[i].upgrades || []).find(x => x.team === team);
    if (u) return `${CIRCUITS.find(c => c.id === S.rounds[i].id).name} : ${u.part}${u.fail ? ' (ratée)' : ''}`;
  }
  return 'aucune évolution';
}
const SEC_PT = { virage: 0.06, ligne_droite: 0.065 };   // secondes au tour par point (mesuré, tools/stat_sens.js)
function upSec(u) {
  if (!SEC_PT[u.area]) return (u.fail ? '— ratée : usure des pneus en hausse' : '— usure des pneus réduite') + ` (${u.delta > 0 ? '+' : ''}${u.delta.toFixed(1)})`;
  const s = u.delta * SEC_PT[u.area];
  return u.fail ? `— ratée : ${('+' + (-s).toFixed(2)).replace('.', ',')} s au tour` : `: ${('−' + s.toFixed(2)).replace('.', ',')} s au tour`;
}
function upgradesNews() {
  const S = CH.season; if (S.round >= S.rounds.length) return '';
  const ups = S.rounds[S.round].upgrades || [];
  if (!ups.length) return '';
  return `<details class="ups"><summary>${ups.length} évolution(s) apportée(s) pour ce GP${ups.some(u => u.big) ? ' · gros packages' : ''}</summary>` +
    ups.map(u => `<div class="${u.fail ? 'down' : 'up'}"><b>${u.team}</b> · ${u.part} (${DEV_AREAS[u.area].label}) ${upSec(u)}</div>`).join('') + `</details>`;
}
/* statistiques de carrière : bilan de chaque saison + saison en cours */
function careerSeasons(sortD) {
  const k = career(), S = CH.season, out = k.history.slice();
  if (S.round > 0) {
    const races = new Map(), dnfs = new Map();
    for (const rd of S.rounds) for (const r of rd.result || []) { races.set(r.name, (races.get(r.name) || 0) + 1); if (r.dnf) dnfs.set(r.name, (dnfs.get(r.name) || 0) + 1); }
    const rating = Object.fromEntries(champTeams().flatMap(t => t.drivers.map(d => [d.name, +d.skill])));
    out.push({ year: S.year || k.year, live: S.round < S.rounds.length, d: sortD.map((d, i) => ({ name: d.name, team: d.team, pos: i + 1, pts: d.pts, wins: d.wins, pod: d.pod, poles: d.poles, races: races.get(d.name) || 0, dnf: dnfs.get(d.name) || 0, rating: rating[d.name] })), t: standings().sortT.map((t, i) => ({ name: t.name, pos: i + 1, pts: t.pts, wins: t.wins })) });
  }
  return out;
}
function renderCareer(sortD, sortT, me) {
  const seasons = careerSeasons(sortD), k = career();
  const tot = new Map();
  for (const se of seasons) for (const d of se.d) {
    const x = tot.get(d.name) || { name: d.name, team: d.team, titles: 0, wins: 0, pod: 0, poles: 0, pts: 0, races: 0, dnf: 0, best: 99, seasons: 0 };
    x.team = d.team; x.wins += d.wins; x.pod += d.pod; x.poles += d.poles || 0; x.pts += d.pts; x.races += d.races; x.dnf += d.dnf; x.seasons++;
    if (!se.live) { if (d.pos === 1) x.titles++; x.best = Math.min(x.best, d.pos); }
    tot.set(d.name, x);
  }
  let card = '';
  const mine = tot.get(me);
  if (mine) {
    const hist = seasons.map(se => ({ y: se.year, r: (se.d.find(d => d.name === me) || {}).rating, p: (se.d.find(d => d.name === me) || {}).pos }));
    const pts = [{ y: k.year - k.history.length - (CH.season.round > 0 ? 0 : 0), r: (k.start || {})[me] }, ...hist].filter(h => h.r != null);
    let spark = '';
    if (pts.length > 1) {
      const lo = Math.min(...pts.map(p => p.r)) - 0.5, hi = Math.max(...pts.map(p => p.r)) + 0.5, W = 300, H = 60;
      const X = i => 20 + i / (pts.length - 1) * (W - 40), Y = r => 8 + (1 - (r - lo) / (hi - lo)) * (H - 22);
      spark = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution de ta note"><path class="spark" d="${pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.r).toFixed(1)).join('')}"/>` +
        pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.r)}" r="3" fill="var(--ot)"/><text x="${X(i)}" y="${H - 2}" class="ax" text-anchor="middle">${i ? p.y : 'début'} · ${p.r.toFixed(1)}</text>`).join('') + '</svg>';
    }
    card = `<div class="cr-card"><h3>${me}<small>${mine.team} · ${mine.seasons} saison${mine.seasons > 1 ? 's' : ''}</small></h3>` +
      [['Titres', mine.titles], ['Victoires', mine.wins], ['Poles', mine.poles], ['Podiums', mine.pod], ['Points', mine.pts], ['Courses', mine.races], ['Abandons', mine.dnf], ['Meilleur class.', mine.best < 99 ? 'P' + mine.best : '—'], ['% podiums', mine.races ? Math.round(mine.pod / mine.races * 100) + ' %' : '—']]
        .map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('') + spark + '</div>';
  }
  const top = [...tot.values()].sort((a, b) => b.titles - a.titles || b.wins - a.wins || b.pts - a.pts).slice(0, 10);
  $('#ch-extra').innerHTML = card + `<div class="cr-h">Meilleurs pilotes de la carrière</div><div class="tbl-wrap"><table><thead><tr><th></th><th>Pilote</th><th>Titres</th><th>V</th><th>Pole</th><th>Pod.</th><th>Pts</th></tr></thead><tbody>` +
    top.map((d, i) => `<tr><td class="n">${i + 1}</td><td${d.name === me ? ' class="mine"' : ''}>${d.name}<small>${d.team}</small></td><td class="t"><b>${d.titles}</b></td><td class="t">${d.wins}</td><td class="t">${d.poles}</td><td class="t">${d.pod}</td><td class="t">${d.pts}</td></tr>`).join('') + `</tbody></table></div><div class="cr-h">Palmarès</div>`;
  return `<thead><tr><th>Année</th><th>Champion</th><th>Écuries</th><th>${me ? 'Toi' : ''}</th></tr></thead><tbody>` +
    seasons.slice().reverse().map(se => { const m = se.d.find(d => d.name === me);
      return `<tr><td class="t">${se.year}${se.live ? '<small>en cours</small>' : ''}</td><td>${se.d[0].name}<small>${se.live ? 'en tête · ' : ''}${se.d[0].pts} pts</small></td><td>${se.t[0].name}${se.live ? '<small>en tête</small>' : ''}</td><td class="t">${m ? 'P' + m.pos + '<small>' + m.pts + ' pts · ' + m.wins + ' V · ' + (m.poles || 0) + ' pole' + ((m.poles || 0) > 1 ? 's' : '') + '</small>' : ''}</td></tr>`; }).join('') + '</tbody>';
}
function renderChampCard() {
  const box = $('#champ-card');
  if (!CH.season) { $('#champ-card-t').textContent = 'Carrière'; box.textContent = 'Crée ton pilote ou ton écurie et vise le titre : 24 manches, évolutions des voitures, saisons enchaînées.'; return; }
  const { sortD } = standings(), S = CH.season, done = S.round >= S.rounds.length, me = career().driver;
  $('#champ-card-t').textContent = done ? 'Carrière · saison terminée' : 'Continuer la carrière';
  box.textContent = `${career().name} · ${S.year || career().year} · ${done ? 'saison terminée' : 'manche ' + (S.round + 1) + '/24'} — ${sortD[0].pts ? 'leader : ' + sortD[0].name + ' · ' + sortD[0].pts + ' pts' : 'aucune course disputée'}${me && sortD[0].pts && sortD.find(d => d.name === me) ? ' · toi : P' + (sortD.findIndex(d => d.name === me) + 1) : ''}${CAR.list.length > 1 ? ' · ' + CAR.list.length + ' carrières' : ''}`;
}
/* course simulée sans affichage (calcul par tranches pour ne pas bloquer l'écran) */
function simulateChampRace() {
  const c = champCircuit(), rd = CH.season.rounds[CH.season.round];
  const Tt = getTrack(CIRCUITS.indexOf(c));
  const wet0 = rd.weather === 'heavy' ? 0.9 : rd.weather === 'light' ? 0.4 : 0;
  const ents = champTeams().flatMap(t => t.drivers.map(d => ({ team: t, driver: d })));
  const grid = (champQuali(ents) || SIM.qualifying(getTrack(CIRCUITS.indexOf(c), true), ents, wet0)).map(r => r.entry);
  const Rs = SIM.createRace(Tt, grid, { laps: lapsFor(c), wearMode: ST.wear, chaos: ST.chaos, weather: rd.weather, noDnf: ST.noDnf, dmgLite: ST.dmgLite, colEvery: RULE_N.col[ST.colRule] || 0 });
  Rs.rec = { next: 0, frames: [] };
  const bar = $('#ch-prog'); bar.hidden = false; $('#ch-sim').disabled = $('#ch-quali').disabled = true;
  const total = lapsFor(c) * Tt.L;
  const tick = () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 30 && !Rs.over && Rs.t < 20000) { SIM.step(Rs, 1 / 30); if (Rs.t >= Rs.rec.next) recFrame(Rs); }
    const lead = Rs.ranked ? Rs.ranked[0].dist : 0;
    bar.firstElementChild.style.transform = `scaleX(${Math.min(1, lead / total)})`;
    if (Rs.over || Rs.t >= 20000) {
      recordChampRace(Rs);
      bar.hidden = true; $('#ch-sim').disabled = $('#ch-quali').disabled = false;
      const w = classify(Rs).order[0];
      renderChamp();
      $('#ch-next').insertAdjacentHTML('afterbegin', `<span class="ch-last">Dernier GP (${c.name}) : victoire de <b>${w.driver.name}</b></span>`);
    } else setTimeout(tick, 0);
  };
  tick();
}

/* ---------------- son : moteur V6 synthétisé (Web Audio) ---------------- */
const SND = { ctx: null };
function setSndBtn() { const b = $('#btn-snd'); b.setAttribute('aria-label', ST.sound ? 'Couper le son' : 'Activer le son'); b.setAttribute('aria-pressed', ST.sound); }
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (SND.ctx) { if (SND.ctx.state !== 'running') SND.ctx.resume(); return; }
  const ctx = new AC(); SND.ctx = ctx;
  sndBuild(ctx);
}
/* le son du jeu (moteurs, vent, pluie) dans un contexte audio : celui du téléphone, ou un contexte hors ligne pour l'export */
function sndBuild(ctx) {
  SND.master = ctx.createGain(); SND.master.gain.value = 0; SND.master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(SND.master);
  SND.bus = comp;
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
  SND.noise = buf;
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); }
  SND.curve = curve;
  const c2 = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c2[i] = Math.tanh(x * 1.8) * 0.95 + 0.05 * Math.sin(x * 9); }
  SND.curve2 = c2;
  SND.eng = engineVoice(1);
  SND.pass = engineVoice(0.8);
  SND.wind = noiseVoice('bandpass', 700, 0.7);
  SND.rain = noiseVoice('highpass', 3000, 0.3);
}
/* ---- moteur V6 turbo-hybride 2026 ----
   onde harmonique calée sur la fréquence d'allumage (3 explosions par tour), grondement du vilebrequin,
   « rugosité » d'échappement (bruit modulé au rythme des explosions), sifflement turbo, MGU-K électrique,
   et crépitements au lever de pied à haut régime */
function engineWave() {
  if (SND.wave) return SND.wave;
  const n = 40, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (1 / Math.pow(k, 0.85)) * (k === 2 ? 1.5 : k === 3 ? 1.25 : k === 4 ? 1.1 : 1) * (k % 2 ? 1 : 0.9);
  SND.wave = SND.ctx.createPeriodicWave(re, im);
  return SND.wave;
}
function engineVoice(bright) {
  const ctx = SND.ctx;
  const osc = (type, g) => { const o = ctx.createOscillator(); if (type === 'eng') o.setPeriodicWave(engineWave()); else o.type = type; const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); o.start(); return { o, gn }; };
  const a = osc('eng', 0.5), b = osc('eng', 0.16), crank = osc('sine', 0.22);
  // rugosité : bruit filtré dont le volume pulse à la fréquence d'allumage
  const nz = ctx.createBufferSource(); nz.buffer = SND.noise; nz.loop = true; nz.start();
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  const am = ctx.createGain(); am.gain.value = 0;
  const pulse = ctx.createOscillator(); pulse.type = 'square'; const pd = ctx.createGain(); pd.gain.value = 0.5; pulse.connect(pd); pd.connect(am.gain); pulse.start();
  nz.connect(bp); bp.connect(am);
  const rasp = ctx.createGain(); rasp.gain.value = 0.18 * bright; am.connect(rasp);
  const sh = ctx.createWaveShaper(); sh.curve = SND.curve2;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2 + bright;
  const vol = ctx.createGain(); vol.gain.value = 0;
  a.gn.connect(sh); b.gn.connect(sh); crank.gn.connect(sh); rasp.connect(sh);
  sh.connect(lp); lp.connect(vol);
  const turbo = osc('sine', 0), mguk = osc('triangle', 0);
  turbo.gn.connect(vol); mguk.gn.connect(vol);
  vol.connect(SND.bus);
  return { a, b, crank, pulse, bp, am, turbo, mguk, lp, vol, gear: 0, dip: 0, thr: 0, pops: 0 };
}
function noiseVoice(type, f, q) {
  const ctx = SND.ctx, src = ctx.createBufferSource(); src.buffer = SND.noise; src.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
  const vol = ctx.createGain(); vol.gain.value = 0;
  src.connect(flt); flt.connect(vol); vol.connect(SND.bus); src.start();
  return { vol, flt };
}
/* rapports : régime qui monte jusqu'à ~11 800 tr/min et retombe vers ~9 800 au passage du rapport */
const GEARS = [0, 95, 130, 165, 200, 235, 270, 305, 360];
function rpmOf(v) {
  const kmh = v * 3.6;
  if (kmh < 2) return { rpm: 4800, gear: 0 };
  let g = 1; while (g < 8 && kmh > GEARS[g]) g++;
  const lo = g === 1 ? 0 : GEARS[g - 1], hi = GEARS[g];
  return { rpm: (g === 1 ? 5200 : 9800) + clamp((kmh - lo) / (hi - lo), 0, 1) * (g === 1 ? 6600 : 2000), gear: g };
}
function crackle(V, t, n) {   // pétarades à l'échappement
  const ctx = SND.ctx;
  for (let k = 0; k < n; k++) {
    const t0 = t + 0.03 + Math.random() * 0.45, src = ctx.createBufferSource(); src.buffer = SND.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1600; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.28 * V.vol.gain.value / 0.32 + 0.05, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    src.connect(f); f.connect(g); g.connect(SND.bus); src.start(t0, Math.random()); src.stop(t0 + 0.07);
  }
}
function setVoice(V, c, gain, pitchK, t) {
  const { rpm, gear } = rpmOf(c.v);
  if (gear > V.gear && V.gear > 0) V.dip = 0.06;          // coupure au passage de rapport
  V.gear = gear;
  const f = rpm / 60 * 3 * pitchK;                          // V6 4 temps : 3 explosions par tour
  V.a.o.frequency.setTargetAtTime(f, t, 0.02);
  V.b.o.frequency.setTargetAtTime(f * 1.5, t, 0.02);
  V.crank.o.frequency.setTargetAtTime(f / 3, t, 0.02);
  V.pulse.frequency.setTargetAtTime(f, t, 0.02);
  V.bp.frequency.setTargetAtTime(800 + rpm * 0.25, t, 0.03);
  const thr = c.state === 'pit' ? 0.3 : clamp(c.throttle || 0, 0, 1);
  V.am.gain.setTargetAtTime(0.25 + 0.5 * thr, t, 0.03);
  V.turbo.o.frequency.setTargetAtTime(3200 + rpm * 0.32, t, 0.06);
  V.turbo.gn.gain.setTargetAtTime(0.007 * thr * Math.min(1, rpm / 9000), t, 0.08);
  V.mguk.o.frequency.setTargetAtTime(180 + c.v * 26 * pitchK, t, 0.05);   // moteur électrique : suit la vitesse
  V.mguk.gn.gain.setTargetAtTime(0.012 * (0.3 + 0.7 * thr) * Math.min(1, c.v / 40), t, 0.08);
  V.lp.frequency.setTargetAtTime(700 + thr * 4200 + rpm * 0.18, t, 0.03);
  V.vol.gain.setTargetAtTime(V.dip > 0 ? gain * 0.3 : gain * (0.32 + 0.68 * thr), t, 0.015);
  // lever de pied brutal à haut régime : quelques pétarades
  if (V.thr > 0.6 && thr < 0.15 && rpm > 9500 && gain > 0.05 && t > V.pops) { crackle(V, t, 3 + (Math.random() * 4 | 0)); V.pops = t + 1.2; }
  V.thr = thr;
}
let passPrev = null;
function updateAudio(dt) {
  if (!SND.ctx) return;
  const t = SND.offT ?? SND.ctx.currentTime;   // export : temps de la vidéo
  const on = ST.sound && R && !paused && !$('#race').hidden && !VID.on;
  SND.master.gain.setTargetAtTime(on ? (HL.on && HL.edit && HL.edit.buf ? 0.25 : comSpeaking() ? 0.3 : 0.8) : 0, t, 0.08);   // moteurs en fond sous la musique d'un edit   // le moteur baisse quand le commentateur parle
  if (!on) return;
  const camK = { onboard: 1, chase: 0.9, side: 0.9, front: 0.8, tv: 0.75, fixed: 0.55, heli: 0.4, map: 0.18 }[effCam()] || 0.6;
  const c = R.cars[follow];
  SND.eng.dip = Math.max(0, SND.eng.dip - dt);
  setVoice(SND.eng, c, c.gone || c.state === 'out' ? 0 : 0.32 * camK, 1, t);
  // voiture la plus proche de la caméra (effet Doppler)
  let best = null, bd = 90;
  for (const o of R.cars) {
    if (o === c || o.gone || o.state === 'out') continue;
    const p = carPose(o), d = Math.hypot(p.x - camera.position.x, -p.y - camera.position.z, camera.position.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (best) {
    const rate = passPrev && passPrev.id === best.id && dt > 0 ? (bd - passPrev.d) / dt : 0;
    passPrev = { id: best.id, d: bd };
    SND.pass.dip = Math.max(0, SND.pass.dip - dt);
    setVoice(SND.pass, best, 0.3 * Math.pow(1 - bd / 90, 2) * (effCam() === 'map' ? 0.3 : 1), 343 / (343 + clamp(rate, -120, 120)), t);
  } else { SND.pass.vol.gain.setTargetAtTime(0, t, 0.1); passPrev = null; }
  SND.wind.vol.gain.setTargetAtTime(Math.min(0.12, Math.pow(c.v / 90, 2) * 0.12) * (effCam() === 'onboard' ? 1 : 0.5), t, 0.1);
  SND.wind.flt.frequency.setTargetAtTime(400 + c.v * 12, t, 0.1);
  SND.rain.vol.gain.setTargetAtTime((R.wx ? R.wx.rain : 0) * 0.22, t, 0.3);
}
function crashSound(strength) {
  if (!SND.ctx || !ST.sound) return;
  const ctx = SND.ctx, t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = SND.noise;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * strength, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(f); f.connect(g); g.connect(SND.bus); src.start(t); src.stop(t + 0.7);
}

/* ---------------- pilotage tactile ---------------- */
const KEYS = new Set();
const PTR = new Map();
const PADS = { left: false, right: false, brake: false, gas: false };
let brakeRamp = 0, KEEP_INPUT = false;
function coastOn() { const L = (R && R.level) || levelOf(ST); return L.brake === 'off'; }   // bande « roue libre » : seulement sans aide au freinage
function coastY() {   // limite haute de la bande « roue libre », juste au-dessus des commandes
  const top = $('#dash').getBoundingClientRect().top;
  return top - Math.max(110, top * 0.28);
}
function placeCoast() {
  const z = $('#coast'); if (z.hidden) return;
  const top = $('#dash').getBoundingClientRect().top;
  z.style.top = coastY() + 'px'; z.style.height = (top - coastY() - 4) + 'px';
}
function setupDriveUI() {
  const on = !!HUM;
  document.body.classList.toggle('driving', on);
  $('#dcontrols').hidden = !on; $('#controls').hidden = on; $('#tyrepick').hidden = true;
  $('#pads').hidden = !(on && ST.ctrl === 'pads');
  $('#steerbar').hidden = !(on && ST.ctrl === 'touch');
  $('#coast').hidden = !(on && ST.ctrl === 'touch' && coastOn());
  requestAnimationFrame(placeCoast);
  $('#btn-ers').innerHTML = '<small>ERS</small>NORMAL'; $('#btn-ers').className = 'normal';
  $('#btn-cam2').textContent = CAM_MODES.find(m => m[0] === camMode)[1];
  $('#btn-pause2').textContent = 'Pause';
  if (!KEEP_INPUT) { PTR.clear(); brakeRamp = 0; }   // marathon : on garde le doigt posé d'un circuit à l'autre
}
function setupDrivePointers(cv) {
  const upd = e => { if (HUM && ST.ctrl === 'touch') PTR.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  cv.addEventListener('pointerdown', e => { upd(e); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ } });
  cv.addEventListener('pointermove', e => { if (PTR.has(e.pointerId)) upd(e); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(t, e => PTR.delete(e.pointerId));
  for (const [id, k] of [['pad-left', 'left'], ['pad-right', 'right'], ['pad-brake', 'brake'], ['pad-gas', 'gas']]) {
    const b = $('#' + id);
    const set = v => e => { e.preventDefault(); PADS[k] = v; b.classList.toggle('on', v); if (v) try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ } };
    b.addEventListener('pointerdown', set(true));
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, set(false));
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
}
let BOT = false;   // pilote automatique de test (?bot=1)
function botInput() {
  const I = R.input, k = HUM, env = SIM.at(T, T.env, k.s + 25) * 0.95;
  I.thr = k.v < env ? 1 : 0; I.brk = k.v > env + 3 ? 1 : 0;
  if (R.phase === 'lights' || (R.startT && R.t - R.startT < 0.2 && k.reaction === Infinity)) I.thr = 0;   // le bot attend l'extinction des feux
  I.steer = clamp(-(SIM.at(T, T.alpha, k.s + 10) - k.d) * 0.35, -1, 1);
}
function updateInput(dt) {
  const I = R.input;
  if (BOT) return botInput();
  let thr = 0, brk = 0, st = 0;
  const kb = KEYS.has('ArrowUp') || KEYS.has('ArrowDown') || KEYS.has('ArrowLeft') || KEYS.has('ArrowRight');
  if (kb) {
    thr = KEYS.has('ArrowUp') ? 1 : 0; brk = KEYS.has('ArrowDown') ? 1 : 0;
    st = (KEYS.has('ArrowRight') ? 1 : 0) - (KEYS.has('ArrowLeft') ? 1 : 0);
  } else if (ST.ctrl === 'pads') {
    thr = PADS.gas ? 1 : 0; brk = PADS.brake ? 1 : 0; st = (PADS.right ? 1 : 0) - (PADS.left ? 1 : 0);
  } else {
    const W = window.innerWidth;
    if (PTR.size) {
      const p = [...PTR.values()].pop();
      let v = (p.x - W / 2) / (W * 0.34);
      v = Math.abs(v) < 0.06 ? 0 : v;
      // doigt dans la bande du bas : on tourne sans accélérer (roue libre)
      st = clamp(v, -1, 1); thr = !coastOn() || p.y < coastY() ? 1 : 0; brakeRamp = 0;
    } else {
      brakeRamp = Math.min(1, brakeRamp + dt / 0.35);   // relâcher = freiner, de plus en plus fort
      brk = brakeRamp;
    }
  }
  I.thr = thr; I.brk = brk;
  I.steer += (st - I.steer) * Math.min(1, dt * ({ on: 9, semi: 7.5, off: 6 })[ST.assist]);
  if (I.ot && (!HUM.otAvail || HUM.otE <= 0)) I.ot = false;
  // retour visuel
  if (!$('#steerbar').hidden) {
    $('#steer-dot').style.left = (50 + I.steer * 46) + '%';
    const l = $('#pedal-lbl'); l.textContent = thr ? 'GAZ' : brk ? 'FREIN' : 'ROUE LIBRE'; l.className = thr ? 'gas' : brk ? '' : 'coast';
  }
  if (R.tt || R.qualiRun) {
    $('#btn-ot').textContent = 'RECOMMENCER'; $('#btn-ot').className = '';
    $('#btn-box').textContent = ST.ghost ? 'FANTÔME ✓' : 'FANTÔME'; $('#btn-box').className = ST.ghost && GH ? 'ghost' : '';
    return;
  }
  $('#btn-ot').textContent = 'OVERTAKE';
  const ot = $('#btn-ot'); ot.className = HUM.otActive ? 'live' : HUM.otAvail ? 'arm' : '';
  const tp = $('#tyrepick'), pick = HUM.pitReq && HUM.state === 'run';
  if (tp.hidden === pick) { tp.hidden = !pick; placeCoast(); }
  if (pick) for (const b of tp.querySelectorAll('button')) b.classList.toggle('sel', b.dataset.t === HUM.wantTyre);
  $('#btn-box').className = HUM.pitReq ? 'on' : '';
  $('#btn-box').textContent = HUM.state === 'pit' ? 'STANDS' : HUM.pitReq ? 'BOX ✓' : 'BOX';
}

function bind() {
  $('#btn-quali').onclick = runQuali;
  $('#btn-tt').onclick = startTimeTrial;
  $('#btn-skipq').onclick = () => { ST.quali = null; startRace(); };
  $('#btn-race').onclick = () => { CH.inRace = !!CH.pending; CH.pending = false; startRace(); };
  $('#btn-back').onclick = () => { if (CH.pending) { CH.pending = false; openChamp(); } else show('menu'); };
  $('#btn-cam').onclick = () => { if (RP.ctl) { RP.ctl = false; rpCtlUi(); } const k = CAM_MODES.findIndex(m => m[0] === camMode); camMode = HUM ? (camMode === 'tv' ? 'onboard' : 'tv') : CAM_MODES[(k + 1) % CAM_MODES.length][0]; $('#btn-cam').textContent = CAM_MODES.find(m => m[0] === camMode)[1]; camInit = false; zoom = 1; fixUi(); };
  $('#btn-speed').onclick = () => { ST.speed = SPEEDS[(SPEEDS.indexOf(ST.speed) + 1) % SPEEDS.length]; $('#btn-speed').textContent = spdLabel(ST.speed); };
  $('#btn-pause').onclick = () => { paused = !paused; $('#btn-pause').textContent = paused ? 'Reprendre' : 'Pause'; };
  $('#btn-prev').onclick = () => cycleFollow(-1);
  $('#btn-next').onclick = () => cycleFollow(1);
  $('#btn-snd').onclick = () => { ST.sound = !ST.sound; savePrefs(); initAudio(); setSndBtn(); };
  setSndBtn();
  $('#race').addEventListener('pointerdown', () => { if (SND.ctx && SND.ctx.state !== 'running') SND.ctx.resume(); });
  $('#btn-quit').onclick = () => {
    // deux appuis pour quitter (évite de quitter une course par erreur), sauf en replay ou après l'arrivée
    const qb = $('#btn-quit');
    if (R && !RP.on && !R.over && !qb.classList.contains('armed')) { if (canSaveRace()) toast({ type: 'info', msg: 'Appuie encore sur ✕ : la course est sauvegardée, tu la reprendras plus tard.', cars: [] }); qb.classList.add('armed'); clearTimeout(qb._t); qb._t = setTimeout(() => qb.classList.remove('armed'), 3000); return; }
    qb.classList.remove('armed');
    if (R && R.net) { netLeave(); R = null; HUM = null; document.body.classList.remove('driving'); show('menu'); setMode('mp'); return; }
    if (RP.on) { RP.on = false; RP.hum = null; $('#rpbar').hidden = true; } const wasTT = R && R.tt; if (wasTT) { MAR.on = false; $('#mres').hidden = true; R = null; HUM = null; document.body.classList.remove('driving'); renderMenu(); show('menu'); return; } const wasQ = R && R.qualiRun; if (!wasQ && CH.inRace) { const sv = canSaveRace() ? saveRaceState() : Promise.resolve(false); CH.inRace = false; HUM = null; document.body.classList.remove('driving'); show('champ');
      sv.then(ok => { R = null; openChamp(); if (ok && !$('#ch-saved').hidden) $('#ch-saved').textContent = 'Course sauvegardée ✓ — reprends-la quand tu veux, même dans plusieurs semaines.'; }); return; } R = null; HUM = null; document.body.classList.remove('driving'); if (wasQ) { renderQuali(); show('quali'); } else show('menu'); };
  $('#tower-head').onclick = () => { towerMode = towerMode === 'int' ? 'gap' : 'int'; $('#tower-head').textContent = towerMode === 'int' ? 'INTERVALLE' : 'ÉCART LEADER'; lastTower = 0; };
  $('#res-new').onclick = () => { if (R && R.net) { netLeave(); $('#results').hidden = true; R = null; HUM = null; document.body.classList.remove('driving'); show('menu'); setMode('mp'); return; } const act = $('#res-new').dataset.act; $('#results').hidden = true; R = null; HUM = null; document.body.classList.remove('driving'); if (act === 'champ') openChamp(); else if (act === 'replays') { show('menu'); setMode('replays'); } else show('menu'); };
  $('#btn-champ').onclick = openChamp;
  $('#ch-menu').onclick = () => { show('menu'); setMode('home'); };
  $('#ch-quali').onclick = () => {
    if (CH.season.round >= CH.season.rounds.length) { nextSeason(); CH.tab = 'drivers'; renderChamp(); return; }
    if (career().saved) { resumeSavedRace(); return; }
    applyCareerSettings();
    ST.circuit = CIRCUITS.indexOf(champCircuit()); ST.weather = CH.season.rounds[CH.season.round].weather; ST.quali = null; CH.pending = true; runQuali(); };
  $('#ch-sim').onclick = () => {
    if (!career().saved) { simulateChampRace(); return; }
    const b = $('#ch-sim');   // deux appuis pour effacer une course sauvegardée
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Sûr ? La course en cours sera perdue'; clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('armed'); renderChamp(); }, 3500); return; }
    b.classList.remove('armed'); dropSavedRace(); renderChamp(); };
  $('#ch-new').onclick = () => { const b = $('#ch-new'); if (b.dataset.armed) { delete b.dataset.armed; b.textContent = 'Supprimer la carrière'; deleteCareer(); if (career()) { applyCareerSettings(); renderChamp(); } else { show('menu'); setMode('home'); } } else { b.dataset.armed = 1; b.textContent = 'Confirmer la suppression ?'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Supprimer la carrière'; }, 4000); } };
  $('#ch-newcar').onclick = openCareerForm;
  $('#cf-ok').onclick = () => { if (cfError(CF)) { renderCfPreview(); return; } newCareer(CF); CH.tab = 'drivers'; openChamp(); };
  $('#cf-cancel').onclick = () => { if (career()) openChamp(); else { renderMenu(); show('menu'); } };
  // réglages dans une fenêtre, flèche de retour toujours visible
  for (const id of ['tn-set', 'set-open2', 'set-open3']) $('#' + id).onclick = openSheet;
  $('#sheet-close').onclick = closeSheet; $('#sheet-bg').onclick = closeSheet;
  $('#nav-back').onclick = navBack;
  window.__navBack = navBack;
  $$('.mode[data-go]').forEach(b => b.onclick = () => { if (!PRO && !['gp', 'tt'].includes(b.dataset.go)) { openPro(); return; } setMode(b.dataset.go); });
  $('#pro-close').onclick = closePro; $('#pro-bg').onclick = closePro;
  $('#pro-ok').onclick = () => {
    if (tryUnlock($('#pro-code').value)) { $('#pro-msg').textContent = 'Version complète débloquée. Merci !'; $('#pro-msg').className = 'note good'; renderMenu(); setTimeout(closePro, 1200); }
    else { $('#pro-msg').textContent = 'Code incorrect pour cet appareil.'; $('#pro-msg').className = 'note bad'; }
  };
  $('#pro-open').onclick = openPro;
  if (LITE) { $('#pro-unlock').hidden = true; $('#pro-soon').hidden = false; $('#pro-close').textContent = 'OK'; $('#pro-open').textContent = 'Version complète'; }
  $('#qk-go').onclick = () => { ST.quali = null; startRace(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && MODE === 'home') heroAnim(); });
  $('#legal-open').onclick = () => { $('#legal').hidden = false; $('#pro-bg').hidden = false; };
  $('#legal-close').onclick = closePro;
  $('#ch-career').onchange = e => { selectCareer(+e.target.value); applyCareerSettings(); renderChamp(); };
  $$('#ch-tabs button').forEach(b => b.onclick = () => { CH.tab = b.dataset.tab; renderChamp(); });
  $('#res-close').onclick = () => { $('#results').hidden = true; $('#btn-results').hidden = false; };
  $('#btn-results').onclick = () => { $('#btn-results').hidden = true; $('#results').hidden = false; };
  $('#btn-ttrp').onclick = startTTReplay;
  $('#ttrp-again').onclick = () => { TLR.t = 0; TLR.ended = false; camInit = false; };
  $('#ttrp-end').onclick = stopTTReplay;
  $('#ttrp-video').onclick = () => { if (!PRO) { openPro(); return; } startTTVideo(); };
  $('#btn-myq').onclick = startQualiRun;
  $('#teams-50').onclick = () => setAllTeams(50);
  $('#teams-reset').onclick = () => setAllTeams(null);
  $('#names-export').onclick = () => { $('#names-txt').hidden = false; $('#names-txt').value = namesText(); $('#names-apply').hidden = false; $('#names-msg').textContent = 'Copie ce texte pour le partager, ou modifie la partie après « = » puis applique.'; };
  $('#names-apply').onclick = () => { $('#names-msg').textContent = importNames($('#names-txt').value); };
  $('#names-reset').onclick = () => { try { localStorage.removeItem('paddock26-livery'); } catch (e) { /* ignoré */ } const map = {}; ST.teams.flatMap(t => [t, ...t.drivers]).forEach(x => { if (x.name !== x.base) map[x.name] = x.base; }); if (Object.keys(map).length) applyRenames(map); else location.reload(); };
  $('#dnf-sim').onclick = fastForward;
  $('#res-replay').onclick = () => PRO ? startReplay() : openPro();
  $('#res-hl').onclick = () => {
    if (!PRO) { openPro(); return; }
    const sel = $('#hlp-drv'), ord = finalOrder(), me = R.cars.find(c => c.human);
    sel.innerHTML = ord.map((c, i) => `<option value="${c.id}" ${me && c.id === me.id ? 'selected' : ''}>P${i + 1} · ${escapeHtml(c.driver.name)} · ${escapeHtml(c.team.name)}</option>`).join('');
    const di = hlDotd(), db = $('#hlp-dotd'); db.hidden = di == null;
    if (di != null) { const c = R.cars[di]; db.dataset.id = di; db.innerHTML = `★ Pilote du jour · ${escapeHtml(c.driver.name)}<small>P${c.gridPos} → P${finalOrder().indexOf(c) + 1} · tous ses dépassements et ses arrêts</small>`; }
    const eps = hlEpisodes(), ep = $('#hlp-eps');
    const nOt = n => n ? ' · ' + L(`${n} dépassement${n > 1 ? 's' : ''}`, `${n} overtake${n > 1 ? 's' : ''}`) : '';
    ep.innerHTML = eps.map(E => `<button class="btn ghost" data-ep="${E.i}">${L('Partie', 'Part')} ${E.no} · ${epLabel(E)}<small>${E.kind === 'start' ? L('les 35 premières secondes de course', 'the first 35 seconds of racing') + nOt(E.nOt)
      : L(`tours ${E.lapA} à ${E.lapB}`, `laps ${E.lapA} to ${E.lapB}`) + nOt(E.nOt) + (epCause(E.from) ? ' · ' + L('après : ', 'after: ') + epCause(E.from) : '') + (E.last ? L(' · arrivée', ' · finish') : '')}</small></button>`).join('');
    ep.querySelectorAll('[data-ep]').forEach(b => { b.onclick = () => { $('#hlpick').hidden = true; startHighlights(false, null, false, +b.dataset.ep); }; });
    $('#hlpick').hidden = false;
    const sty = $('#hlp-style').value; if (EDIT_STYLES[sty] && sty !== 'none') editLoops(sty, EDIT_STYLES[sty].bpm).catch(() => {});   // la musique se prépare pendant le choix
  };
  $('#hlp-full').onclick = () => { $('#hlpick').hidden = true; startHighlights(false); };
  $('#hlp-one').onclick = () => { $('#hlpick').hidden = true; startHighlights(false, +$('#hlp-drv').value); };
  if (LITE) $('#hlp-style option[value="file"]').remove();
  $('#hlp-style').onchange = e => { if (e.target.value === 'file') $('#hlp-file').click(); };
  $('#hlp-file').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const m = $('#hlp-mus'); m.textContent = L('Analyse du morceau…', 'Analysing the track…');
    try { const U = await editLoadFile(f); m.textContent = `🎵 ${U.name} · ${Math.round(U.bpm)} BPM` + (U.drop ? L(` · drop à ${(U.t0 + U.drop * 60 / U.bpm).toFixed(1)} s`, ` · drop at ${(U.t0 + U.drop * 60 / U.bpm).toFixed(1)} s`) : ''); $('#hlp-style option[value="file"]').textContent = '🎵 ' + U.name; }
    catch (err) { m.textContent = L('Fichier audio illisible', 'Unreadable audio file'); }
  };
  $('#hlp-edit').onclick = () => { $('#hlpick').hidden = true; startEdit(+$('#hlp-drv').value, $('#hlp-style').value); };
  $('#hlp-dotd').onclick = () => { $('#hlpick').hidden = true; startHighlights(false, +$('#hlp-dotd').dataset.id, true); };
  $('#hlp-close').onclick = () => { $('#hlpick').hidden = true; };
  $('#hl-close').onclick = () => { if (VID.on) vidStop(); else if (TLR.video) closeTTVideo(); else if (CLIP.video) closeClip(); else stopHighlights(); };
  const flipLang = () => {
    ST.lang = ST.lang === 'en' ? 'fr' : 'en'; I18N.set(ST.lang); savePrefs(); setLangBtns();
    if (VID.on || HL.on) comRebuild();
    const sc = curScreen();
    if (sc === 'champ') renderChamp(); else if (sc === 'quali') renderQuali(); else if (sc === 'menu') { if (MODE === 'replays') renderReplays(); renderHome(); }
  };
  $('#tn-lang').onclick = flipLang; $('#hl-lang').onclick = flipLang;
  $('#hl-com').onclick = comToggle; $('#hl-voice').onclick = comNextVoice;
  setLangBtns();
  $('#hl-zones').onclick = () => { const on = !document.body.classList.contains('zones'); document.body.classList.toggle('zones', on); $('#hl-zones').setAttribute('aria-pressed', String(on)); };
  $('#btn-mar').onclick = startMarathon;
  $('#mp-host').onclick = mpHost;
  $('#mp-join').onclick = () => { const [ip, port] = $('#mp-ip').value.trim().split(':'); mpJoin(ip, +port || 47626); };   // « adresse » ou « adresse:port »
  $('#lb-start').onclick = hostStart;
  $('#lb-leave').onclick = () => { netLeave(); show('menu'); setMode('mp'); };
  $('#mres-retry').onclick = startMarathon;
  $('#mres-ok').onclick = () => { $('#mres').hidden = true; MAR.on = false; R = null; HUM = null; document.body.classList.remove('driving'); if (MAR.prev != null) ST.circuit = MAR.prev; renderMenu(); show('menu'); };
  $('#tt-reset').onclick = () => { const b = $('#tt-reset'); if (b.dataset.armed) { delete b.dataset.armed; b.textContent = 'Réinitialiser mes records'; resetRecords(); renderMenu(); } else { b.dataset.armed = 1; b.textContent = 'Confirmer : tout effacer ?'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Réinitialiser mes records'; }, 4000); } };
  $('#hl').addEventListener('pointerdown', hlShowUi);
  $('#hl-rec').onclick = () => { if (HL.recording || EXP.on) return;
    if (COM.wait) { $('#hl-status').textContent = L('Attends la fin de la préparation du commentaire…', 'Wait until the commentary is ready…'); return; }
    if (HL.mwait) { $('#hl-status').textContent = L('Attends la fin de la composition de la musique…', 'Wait until the music is ready…'); return; }
    if (VID.on && expOk()) { vidRestart(); expStart(); return; }
    if (HL.on && expOk()) { hlRestart(); comRewind(); expStart(); return; }
    if (VID.on) { $('#hl-share').hidden = true; vidRestart(); hlRecordStart(!COM.on || !comNative()); $('#hl-status').textContent = HL.recording ? 'Enregistrement de la vidéo… laisse défiler jusqu’au bout' : $('#hl-status').textContent; return; } $('#hl-share').hidden = true; hlRestart(); comRewind(); hlRecordStart(); $('#hl-status').textContent = HL.recording ? 'Enregistrement de la vidéo… laisse défiler jusqu’au bout' : $('#hl-status').textContent; };
  $('#hl-share').onclick = () => { try { window.PaddockNative.share(); } catch (e) { /* indisponible */ } };
  $('#rp-end').onclick = () => { stopReplay(); fixUi(); };
  $('#rp-ctl').onclick = () => { RP.ctl = !RP.ctl; if (!RP.ctl) { camMode = 'auto'; $('#btn-cam').textContent = 'Réalisateur'; if (R.input) R.input.steer = 0; } camInit = false; rpCtlUi(); };
  // placement de la caméra bord de piste
  const fxSet = (k, v) => { FIXM[k] = v; FIXM.on = true; camInit = false; fixmSave(); fixUi(); };
  $('#fx-here').onclick = () => { const c = R && R.cars[follow]; if (!c) return; FIXM.s = SIM.mod(c.s + 120, T.L); FIXM.side = c.d > 0 ? -1 : 1; fxSet('on', true); };
  $('#fx-side').onclick = () => fxSet('side', -FIXM.side);
  $('#fx-more').onclick = () => { const on = $('#fixcam').classList.toggle('open'); $('#fx-more').setAttribute('aria-expanded', String(on)); $('#fx-more').textContent = L('Réglages ', 'Settings ') + (on ? '▴' : '▾'); };
  $('#fx-track').onclick = () => fxSet('track', !FIXM.track);
  $('#fx-auto').onclick = () => { FIXM.on = false; FIX.lock = false; camInit = false; fixmSave(); fixUi(); };
  $('#fx-s').oninput = e => fxSet('s', +e.target.value / 1000 * T.L);
  for (const k of ['off', 'h', 'yaw', 'fov']) $('#fx-' + k).oninput = e => fxSet(k, +e.target.value);
  $('#rp-clip').onclick = () => { const on = $('#rpclip').hidden; $('#rpclip').hidden = !on; $('#rp-clip').setAttribute('aria-pressed', String(on)); clipUi(); };
  $('#clip-a').onclick = () => clipMark('a');
  // clips d'une minute : le départ (depuis la grille), ou la minute qui suit l'instant affiché
  $('#clip-start').onclick = () => { if (!RP.on) return; const f0 = R.rec.frames[0].t; CLIP.a = Math.max(f0, R.startT - 6); CLIP.b = Math.min(RP.end, CLIP.a + 60); seekReplay(CLIP.a); clipUi(); };
  $('#clip-1m').onclick = () => { if (!RP.on) return; CLIP.a = RP.t; CLIP.b = Math.min(RP.end, RP.t + 60); clipUi(); };
  $('#ch-vid').onclick = () => vidStart('preview');
  $('#ch-svid').onclick = () => vidStart('season');
  $('#ch-rvid').onclick = () => vidStart('recap');
  $('#ch-dvid').onclick = () => vidStart('dev');
  $('#ch-tdvid').onclick = () => vidStart('titleD');
  $('#ch-ttvid').onclick = () => vidStart('titleT');
  $('#ch-xvid').onclick = () => vidStart('exploits');
  $('#ch-pvid').onclick = () => vidDriverStart($('#ch-psel').value);
  $('#btn-qvid').onclick = () => vidStart('grid');
  $('#res-save').onclick = async () => {
    const b = $('#res-save'); if (b.disabled) return; b.disabled = true; b.textContent = 'Chargement…';
    const ok = await saveReplay(); b.textContent = ok ? 'Replay sauvegardé ✓' : 'Échec de l’enregistrement'; if (!ok) b.disabled = false;
  };
  $('#rpl-file').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) rplImport(f); e.target.value = ''; };
  $('#clip-b').onclick = () => clipMark('b');
  $('#clip-go').onclick = startClipVideo;
  $('#hl-cam').onclick = () => { const k = CAM_MODES.findIndex(m => m[0] === camMode); camMode = CAM_MODES[(k + 1) % CAM_MODES.length][0]; $('#hl-cam').textContent = '🎥 ' + CAM_MODES.find(m => m[0] === camMode)[1]; camInit = false; zoom = 1; };
  $('#rp-back').onclick = () => seekReplay(RP.t - 10);
  const sl = $('#rp-slider');
  sl.addEventListener('pointerdown', () => { RP.drag = true; });
  sl.addEventListener('input', () => { const F = R.rec.frames; seekReplay(F[0].t + (+sl.value / 1000) * (RP.end - F[0].t)); });
  sl.addEventListener('change', () => { RP.drag = false; });
  sl.addEventListener('pointerup', () => { RP.drag = false; });
  $('#dnf-watch').onclick = watchAfterDnf;
  $('#btn-rw').onclick = () => RW.on ? rwClose(false) : rwOpen();
  $('#dnf-rw').onclick = rwOpen;
  $('#rw-slider').addEventListener('input', e => rwSeek(+e.target.value));
  $('#rw-back').onclick = () => { const sl = $('#rw-slider'); sl.value = Math.max(0, +sl.value - 2); rwSeek(+sl.value); };
  $('#rw-go').onclick = () => rwClose(true);
  $('#rw-cancel').onclick = () => rwClose(false);
  $('#qres-retry').onclick = () => { $('#qres').hidden = true; startQualiRun(); };
  $('#qres-ok').onclick = () => { $('#qres').hidden = true; R = null; HUM = null; document.body.classList.remove('driving'); renderQuali(); show('quali'); };
  window.addEventListener('keydown', e => {
    if (!R) return;
    if (HUM) {
      KEYS.add(e.key);
      if (e.key === 'o' || e.key === 'O') $('#btn-ot').click();
      if (e.key === 'b' || e.key === 'B') $('#btn-box').click();
      if (e.key === 'e' || e.key === 'E') $('#btn-ers').click();
      if (e.key.startsWith('Arrow')) { e.preventDefault(); return; }
    }
    if (e.key === 'ArrowRight') cycleFollow(1);
    if (e.key === 'ArrowLeft') cycleFollow(-1);
    if (e.key === ' ') $('#btn-pause').click();
    if (e.key === 'c') $('#btn-cam').click();
  });
  window.addEventListener('keyup', e => KEYS.delete(e.key));
  window.addEventListener('blur', () => KEYS.clear());
  const tap = (id, fn) => {   // pointerdown : marche même quand un autre doigt tient l'accélérateur
    const b = $('#' + id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    b.onclick = e => { if (e.detail === 0) fn(); };   // clavier / .click()
  };
  // caméra et pause : même prise en compte immédiate que l'ERS (un autre doigt peut tenir le volant)
  tap('btn-cam2', () => { $('#btn-cam').click(); $('#btn-cam2').textContent = $('#btn-cam').textContent; });
  tap('btn-pause2', () => { $('#btn-pause').click(); $('#btn-pause2').textContent = $('#btn-pause').textContent; });
  tap('btn-ers', () => {
    const modes = ['normal', 'attack', 'charge'], names = { normal: 'NORMAL', attack: 'ATTAQUE', charge: 'RECHARGE' };
    R.input.ers = modes[(modes.indexOf(R.input.ers) + 1) % 3];
    $('#btn-ers').innerHTML = '<small>ERS</small>' + names[R.input.ers]; $('#btn-ers').className = R.input.ers;
  });
  tap('btn-ot', () => {
    if (!HUM) return;
    if (R.tt) return startTimeTrial();
    if (R.qualiRun) return startQualiRun();
    R.input.ot = !R.input.ot;
  });
  tap('btn-box', () => {
    if (R && (R.tt || R.qualiRun)) { ST.ghost = !ST.ghost; savePrefs(); return; }
    if (!HUM || HUM.state !== 'run') return;
    HUM.pitReq = !HUM.pitReq; HUM.pitReason = 'appel du pilote';
    const pl = HUM.myPlan && HUM.myPlan[0];
    HUM.wantTyre = HUM.pitReq ? (pl ? pl.comp : SIM.autoTyre(R, HUM)) : null;   // pneu prévu par ta stratégie, sinon choix de l'équipe
    if (R.net === 'client') netSend({ t: 'box', on: HUM.pitReq, tyre: HUM.wantTyre });
  });
  for (const b of $('#tyrepick').querySelectorAll('button')) {
    b.style.color = SIM.COMP[b.dataset.t].col; b.style.borderColor = SIM.COMP[b.dataset.t].col;
    b.title = SIM.COMP[b.dataset.t].name;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (HUM && HUM.pitReq) { HUM.wantTyre = b.dataset.t; if (R && R.net === 'client') netSend({ t: 'tyre', tyre: b.dataset.t }); } });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && R) { lastT = performance.now(); requestWake(); } });
}

bind();
// diagnostic à distance (lecture seule via le débogage du WebView)
window.__paddock = { get follow() { return follow; }, get scene() { return scene; }, FIXM, get camera() { return camera; }, carPose, otOk, editLoadFile, editAnalyze, editUserTrack, get EDIT_USER() { return EDIT_USER; }, startEdit, editPlan, editMusic, editStep, get paused() { return paused; }, set paused(v) { paused = v; }, get startRace() { return startRace; }, get fastForward() { return fastForward; }, sfxBuf, CIRCUITS, SIM, career, champTeams, getTrack, recFrame, rsvOp, clipKey, rplSaveList, seasonClipsLoad, seasonClipsFromReplays, COM, comVidLines, comHLLines, startHighlights, get R() { return R; }, get HL() { return HL; }, get ST() { return ST; }, get GH() { return GH; }, get SEC() { return SEC; }, get renderer() { return renderer; }, QUAL, TLR, startTTReplay, startTTVideo, get HUM() { return HUM; }, VID, CH, CAR, vidStart, saveReplay, stepSim, hlEpisodes, buildEpisode, hlOtGroups, hlSeek, rplOpen, rplList, packObj, unpackObj, openChamp, runQuali, newCareer, setMode, showResults, startReplay };
I18N.set(ST.lang);
setMode('home');
show('menu');
// lien direct vers une course de démonstration : #demo ou #demo7 (numéro de manche)
if (location.hash === '#champ') {
  ST.lapsKey = '3'; openChamp();
  const n = /chsim=(\d+)/.exec(location.search), tab = /tab=(\w+)/.exec(location.search);
  if (tab) { CH.tab = tab[1]; renderChamp(); }
  if (n) { let k = +n[1]; const go = () => { if (k-- <= 0) return; simulateChampRace(); const w = setInterval(() => { if (!$('#ch-sim').disabled) { clearInterval(w); go(); } }, 200); }; go(); }
}
const demo = /^#demo(\d*)$/.exec(location.hash);
if (demo) {
  const Q = location.search;
  if (demo[1]) ST.circuit = clamp(+demo[1] - 1, 0, CIRCUITS.length - 1);
  ST.lapsKey = '5'; ST.quali = null;
  const wq = /wx=(\w+)/.exec(Q); if (wq) ST.weather = wq[1];
  const dv = /drive=(\d)/.exec(Q); if (dv) { ST.human = ST.teams[0].drivers[0].name; ST.ctrl = dv[1] === '2' ? 'pads' : 'touch'; } else ST.human = '';
  if (/tt=1/.test(Q)) { ST.human = ST.teams[0].drivers[0].name; startTimeTrial(); }
  else if (/q=1/.test(Q)) { ST.human = ST.teams[0].drivers[0].name; runQuali(); startQualiRun(); }
  else startRace();
  const cam = /cam=(\w+)/.exec(Q); if (cam) { camMode = cam[1]; $('#btn-cam').textContent = (CAM_MODES.find(m => m[0] === camMode) || ['', 'TV'])[1]; }
  BOT = /bot=1/.test(Q);
  const pre = /[?&]t=(\d+)/.exec(Q);
  if (pre) for (let i = 0; i < +pre[1] * 60 && !R.over; i++) { if (BOT && HUM) botInput(); stepSim(1 / 60); if (R.tt) updateTimeTrial(); }
  const fo = /f=(\d+)/.exec(Q); if (fo) follow = +fo[1];
  const fn = /fin=(\d+)/.exec(Q); if (fn) { while (!R.over && (!R.ranked || R.ranked[0].dist < R.laps * T.L - +fn[1])) stepSim(1 / 60); }
  if (/full=1/.test(Q)) { while (!R.over && R.t < 20000) stepSim(1 / 30); R.resultsShown = true; showResults(); }
  if (/replay=1/.test(Q)) { while (!R.over && R.t < 5000) stepSim(1 / 30); R.resultsShown = true; showResults(); startReplay(); const rt = /rt=(\d+)/.exec(Q); if (rt) RP.t = +rt[1]; }
  if (/dnf=1/.test(Q) && HUM) { HUM.state = 'out'; HUM.retiredWhy = 'test'; HUM.gone = true; if (/ff=1/.test(Q)) setTimeout(() => $('#dnf-sim').click(), 500); }
}
})();
