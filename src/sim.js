/* =====================================================================
   MOTEUR DE SIMULATION F1 2026 — indépendant du rendu (testable sous Node)
   Unités SI : mètres, secondes, m/s, kg, W, J.
   Repère piste de Frenet : s = distance le long de l'axe, d = décalage
   latéral (positif = à gauche dans le sens de course).
   ===================================================================== */
const SIM = (() => {
'use strict';

const G = 9.81, RHO = 1.2;
const CAR_LEN = 5.4, CAR_WID = 1.9;
const M0 = 768;                       // masse minimale 2026 (pilote inclus)
const TUNE = (typeof globalThis !== 'undefined' && globalThis.SIM_TUNE) || {};
const MU = TUNE.MU || 1.85, MU_B = MU * 0.9;         // adhérence latérale / freinage
const CLA_Z = TUNE.CLA || 6.5, CDA_Z = 1.55;      // aéro active : mode Z (virages)
const CLA_X = 3.0, CDA_X = 1.2;       // aéro active : mode X (lignes droites)
const BRAKE_CAP = 5.6 * G;
const P_ICE = 400e3, P_K = 350e3;     // 2026 : ~50/50 thermique / électrique
// moteur « 100 % thermique » (option) : puissance constante, ni batterie, ni recharge, ni Overtake : seul le pilotage compte
let ICE_ONLY = false, P_THERM = 600e3;   // ≈ 815 ch : en moyenne aussi rapide que l’hybride en qualif (plus vite à Monza/Spa, moins à Monaco/Singapour)
function setEngine(m) { ICE_ONLY = m === 'ice'; }
const SOC_MAX = 4.0e6, HARVEST_LAP = 8.5e6, OT_BONUS = 0.5e6;

const COMP = {
  S: { g: 1.000, life: 0.30, col: '#E8002D', name: 'TENDRE' },
  M: { g: 0.988, life: 0.47, col: '#FFD12E', name: 'MEDIUM' },
  H: { g: 0.977, life: 0.68, col: '#F0F0EC', name: 'DUR' },
  I: { g: 0.9, life: 0.55, col: '#43B047', name: 'INTER', wet: true },
  W: { g: 0.8, life: 0.65, col: '#1E7BFF', name: 'PLUIE', wet: true },
};
/* ---- pluie : adhérence selon l'humidité de la piste (0 sèche … 1 détrempée) ---- */
let CUR_WET = 0;
/* Profil pneus par circuit (inspiré des données Pirelli) :
   deg = dégradation (1 = moyenne), sm / mh = écart au tour en s entre tendre/medium et medium/dur */
const TYRE_PROFILE = {
  'au-1953': [0.9, 0.6, 0.4], 'cn-2004': [1.2, 0.7, 0.5], 'jp-1962': [1.3, 0.8, 0.6], 'bh-2002': [1.35, 0.7, 0.5],
  'sa-2021': [0.8, 0.5, 0.35], 'us-2022': [1.0, 0.6, 0.45], 'ca-1978': [0.9, 0.6, 0.4], 'mc-1929': [0.6, 0.4, 0.35],
  'es-1991': [1.3, 0.8, 0.6], 'at-1969': [1.0, 0.5, 0.4], 'gb-1948': [1.35, 0.8, 0.6], 'be-1925': [1.1, 0.7, 0.5],
  'hu-1986': [1.1, 0.6, 0.5], 'nl-1948': [1.1, 0.7, 0.5], 'it-1922': [0.8, 0.45, 0.35], 'es-2026': [1.0, 0.55, 0.4],
  'az-2016': [0.8, 0.5, 0.4], 'sg-2008': [1.0, 0.7, 0.55], 'us-2012': [1.2, 0.65, 0.5], 'mx-1962': [0.9, 0.55, 0.4],
  'br-1940': [1.1, 0.55, 0.4], 'us-2023': [0.9, 0.5, 0.4], 'qa-2004': [1.5, 0.8, 0.6], 'ae-2009': [0.9, 0.55, 0.4],
  // circuits bonus (anciens Grands Prix)
  'my-1999': [1.4, 0.8, 0.6], 'pt-2008': [1.2, 0.7, 0.5], 'it-1953': [0.9, 0.6, 0.45], 'tr-2005': [1.3, 0.8, 0.6],
  'fr-1969': [1.0, 0.6, 0.45], 'de-1932': [1.0, 0.55, 0.4], 'de-1927': [1.0, 0.6, 0.45], 'it-1914': [1.3, 0.8, 0.6],
  'ru-2014': [0.7, 0.5, 0.35], 'fr-1960': [1.1, 0.6, 0.45], 'pt-1972': [1.1, 0.6, 0.45], 'br-1977': [1.2, 0.7, 0.5],
  'us-1909': [0.9, 0.5, 0.4], 'ar-1952': [1.0, 0.6, 0.45], 'za-1961': [1.2, 0.7, 0.5], 'us-1956': [1.0, 0.6, 0.45],
};
function tyreProfile(circ) {
  const [deg, sm, mh] = TYRE_PROFILE[circ.id] || [1, 0.5, 0.4];
  // tsens = secondes perdues au tour pour 1 % d'adhérence en moins (mesuré circuit par circuit)
  const sens = (circ.tsens || circ.length / 55 * 0.005) * 1.15;   // +15 % : en course (essence, trafic) l’écart ressort un peu plus fort
  return { deg, sm, mh, g: { S: 1, M: 1 - 0.01 * sm / sens, H: 1 - 0.01 * (sm + mh) / sens } };
}
let CUR_TG = { S: 1, M: 0.988, H: 0.977 };
const SOFTNESS = { S: 1.3, M: 1, H: 0.75, I: 1, W: 1 };   // un pneu tendre perd son rythme plus vite
const WARM_DIST = { S: 1500, M: 2500, H: 3800, I: 2000, W: 2000 };

/* repères réels (écart au tour sec en slicks neufs) : inter ~+8 % dans ses conditions, +12 % sur le sec,
   pluie +14 % (piste mouillée) à +19 % (détrempée) ; slicks +5 % sur piste humide, inconduisibles dès qu'il pleut vraiment */
function compGrip(t, w) {
  if (t === 'I') return w < 0.35 ? 0.73 - 0.07 * (0.35 - w) / 0.35 : 0.73 - 0.16 * Math.pow((w - 0.35) / 0.45, 1.3);
  if (t === 'W') return 0.65 - 0.07 * w;
  return (CUR_TG[t] ?? COMP[t].g) * Math.max(0.3, 1 - 1.64 * Math.pow(w, 1.1));
}
function bestComp(w) { return w < 0.18 ? 'M' : w < 0.72 ? 'I' : 'W'; }

const LOOK = [0, 15, 40, 80];
/* Niveaux de difficulté (quand le joueur pilote) : rythme de l'IA et aides au pilotage */
const LEVELS = {
  debutant: { name: 'Débutant', cues: true, pace: 0.97, brake: 'auto', stab: true, invincible: true, err: 0.6 },
  amateur: { name: 'Amateur', limits: true, cues: true, pace: 0.995, brake: 'aide', stab: true, invincible: false, err: 0.8 },
  pro: { name: 'Pro', limits: true, cues: true, pace: 1.015, brake: 'aide', stab: true, invincible: false, err: 1 },
  legende: { name: 'Légende', limits: true, pace: 1.04, brake: 'off', stab: false, invincible: false, err: 0.6 },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// bornes des facteurs géométriques (écart à la ligne / à l'axe) : assez larges pour rester exactes dans les épingles
const GEO_LO = TUNE.GL || 0.5, GEO_HI = TUNE.GH || 1.6;
const LAT_CAP = (TUNE.CAP || 6.0) * G;             // accélération latérale max (~5 g)
function cornerSpeed(k, mu, cla, m) {
  const ak = Math.abs(k);
  const vcap = Math.sqrt(LAT_CAP * (mu / MU) / Math.max(ak, 1e-9));
  const den = ak - mu * 0.5 * RHO * cla / m;
  const v = den <= 1e-7 ? 100 : Math.sqrt(mu * G / den);
  return Math.min(100, v, vcap);
}
function latAccel(v, mu, m) {
  return Math.min(LAT_CAP * (mu / MU), mu * (G + 0.5 * RHO * CLA_Z * v * v / m));
}
function brakeDecel(v, m, gf) {
  return Math.min(BRAKE_CAP * gf, (MU_B * gf * (m * G + 0.5 * RHO * CLA_Z * v * v) + 0.5 * RHO * CDA_Z * v * v) / m);
}

/* ------------------------------------------------------------------ */
/*  CONSTRUCTION DE LA PISTE                                           */
/* ------------------------------------------------------------------ */
function crPoint(p0, p1, p2, p3, t) {           // Catmull-Rom centripète
  const t0 = 0;
  const t1 = t0 + Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) + 1e-6;
  const t2 = t1 + Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) + 1e-6;
  const t3 = t2 + Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) + 1e-6;
  const tt = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => [((tb - tt) * a[0] + (tt - ta) * b[0]) / (tb - ta), ((tb - tt) * a[1] + (tt - ta) * b[1]) / (tb - ta)];
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  return L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2);
}
function resampleClosed(pts, N) {
  const n = pts.length, cum = [0];
  for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[n], out = []; let j = 0;
  for (let k = 0; k < N; k++) {
    const s = k * total / N;
    while (cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = pts[j], b = pts[(j + 1) % n];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return { pts: out, total };
}
function smoothClosed(arr, passes, w) {
  const N = arr.length; let a = Float64Array.from(arr), b = new Float64Array(N);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) { let s = 0; for (let j = -w; j <= w; j++) s += a[(i + j + N) % N]; b[i] = s / (2 * w + 1); }
    const t = a; a = b; b = t;
  }
  return a;
}
function curvatureOf(x, y, N, smoothW) {
  const hd = new Float64Array(N), k = new Float64Array(N), seg = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    hd[i] = Math.atan2(y[j] - y[i], x[j] - x[i]);
    seg[i] = Math.hypot(x[j] - x[i], y[j] - y[i]);
  }
  for (let i = 0; i < N; i++) {
    const p = (i - 1 + N) % N;
    k[i] = wrapA(hd[i] - hd[p]) / (0.5 * (seg[i] + seg[p]) || 1);
  }
  return { k: smoothClosed(k, 3, smoothW), seg };
}

function buildTrack(circ) {
  const raw = [];
  for (let i = 0; i < circ.pts.length; i += 2) raw.push([circ.pts[i], circ.pts[i + 1]]);
  const n = raw.length, dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = raw[(i - 1 + n) % n], p1 = raw[i], p2 = raw[(i + 1) % n], p3 = raw[(i + 2) % n];
    const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
    for (let j = 0; j < m; j++) dense.push(crPoint(p0, p1, p2, p3, j / m));
  }
  let r = resampleClosed(dense, Math.round(dense.length * 1.2));
  let xs = smoothClosed(Float64Array.from(r.pts, p => p[0]), 3, 9);
  let ys = smoothClosed(Float64Array.from(r.pts, p => p[1]), 3, 9);
  const sm = []; for (let i = 0; i < xs.length; i++) sm.push([xs[i], ys[i]]);
  const L = circ.length;
  const N = Math.round(L / 3);
  r = resampleClosed(sm, N);
  const sc = L / r.total;
  // rg : en course (ligne de courbure minimale, plus sûre en peloton), compense l'écart avec la trajectoire temps minimal des qualifs
  const T = { circ, L, N, ds: L / N, w: circ.width, street: !!circ.street, gk: (circ.grip || 1) * (circ.useLine ? 1 : circ.rg || 1) };
  T.x = new Float64Array(N); T.y = new Float64Array(N);
  for (let i = 0; i < N; i++) { T.x[i] = r.pts[i][0] * sc; T.y[i] = r.pts[i][1] * sc; }
  // Origine sur la ligne de départ
  const x0 = T.x[0], y0 = T.y[0];
  for (let i = 0; i < N; i++) { T.x[i] -= x0; T.y[i] -= y0; }
  T.tx = new Float64Array(N); T.ty = new Float64Array(N); T.nx = new Float64Array(N); T.ny = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    let dx = T.x[b] - T.x[a], dy = T.y[b] - T.y[a]; const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l; T.tx[i] = dx; T.ty[i] = dy; T.nx[i] = -dy; T.ny[i] = dx;
  }
  T.k = curvatureOf(T.x, T.y, N, 2).k;
  T.kS = smoothClosed(T.k, 3, 4);
  T.lim = T.w / 2 - CAR_WID / 2 - 0.25;
  // ligne idéale : toute la largeur utile (roues extérieures sur le vibreur, sans mordre sur l'herbe) ; en ville, marge avec les murs
  T.lineLim = TUNE.LL != null ? T.w / 2 + TUNE.LL : T.street ? T.lim - 0.35 : T.w / 2 - 0.4;
  T.tyre = tyreProfile(circ);
  racingLine(T);
  speedProfile(T);
  pitLayout(T);
  return T;
}

/* Ligne de course à courbure minimale (Gauss-Seidel multigrille) */
function racingLine(T) {
  const N = T.N, lim = T.lineLim, al = new Float64Array(N);
  for (const st of [24, 12, 6, 3, 1]) {
    const M = Math.floor(N / st);
    const idx = q => (((q % M) + M) % M) * st;
    const iters = st >= 12 ? 900 : st >= 3 ? 500 : 250;
    for (let it = 0; it < iters; it++) {
      for (let q = 0; q < M; q++) {
        const i = q * st, a = idx(q - 2), b = idx(q - 1), c = idx(q + 1), d = idx(q + 2);
        const px = j => T.x[j] + al[j] * T.nx[j], py = j => T.y[j] + al[j] * T.ny[j];
        const tx = (4 * (px(b) + px(c)) - (px(a) + px(d))) / 6;
        const ty = (4 * (py(b) + py(c)) - (py(a) + py(d))) / 6;
        const na = (tx - T.x[i]) * T.nx[i] + (ty - T.y[i]) * T.ny[i];
        al[i] = clamp(al[i] + 0.8 * (na - al[i]), -lim, lim);
      }
    }
    if (st > 1) { // interpolation vers la grille fine
      for (let q = 0; q < M; q++) {
        const i = q * st, j = q + 1 < M ? (q + 1) * st : N, aj = al[j % N];
        for (let u = i + 1; u < j; u++) al[u] = al[i] + (aj - al[i]) * (u - i) / (j - i);
      }
    }
  }
  T.alpha = smoothClosed(al, 2, 2);
  // trajectoire « temps minimal » précalculée (tools/minline.js) : 1 valeur tous les 2 points, en décimètres
  const pre = T.circ.line;
  if (pre && T.circ.useLine && pre.length * 2 >= N - 2 && !TUNE.NOLINE) {   // seulement pour les tours seul en piste (qualif, contre-la-montre)
    const mc = T.alpha, lb = TUNE.LB ?? 1;
    for (let i = 0; i < N; i++) {
      const u = i / 2, a0 = Math.floor(u) % pre.length, a1 = (a0 + 1) % pre.length, f = u - Math.floor(u);
      al[i] = clamp(mc[i] + lb * ((pre[a0] * (1 - f) + pre[a1] * f) / 10 - mc[i]), -T.lineLim, T.lineLim);
    }
    T.alpha = smoothClosed(al, TUNE.LSP ?? 1, TUNE.LSW ?? 1);
  }
  setLine(T, T.alpha);
}
function setLine(T, alpha) {
  const N = T.N; T.alpha = alpha;
  const rx = new Float64Array(N), ry = new Float64Array(N);
  for (let i = 0; i < N; i++) { rx[i] = T.x[i] + T.alpha[i] * T.nx[i]; ry[i] = T.y[i] + T.alpha[i] * T.ny[i]; }
  const c = curvatureOf(rx, ry, N, TUNE.KS ?? 2);
  T.kRL = c.k; T.dsRL = c.seg; T.rx = rx; T.ry = ry;
  // tours seul en piste : courbure réelle de la ligne (cercle par 3 points espacés de ~3 m, même mesure que le contrôle d'adhérence)
  if (T.circ.useLine && TUNE.KW3) {   // désactivé par défaut (même raison)
    const kw = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i + N - 1) % N, q = (i + 1) % N;
      const ab = Math.hypot(rx[i] - rx[a], ry[i] - ry[a]), bq = Math.hypot(rx[q] - rx[i], ry[q] - ry[i]), aq = Math.hypot(rx[q] - rx[a], ry[q] - ry[a]);
      const cr = (rx[i] - rx[a]) * (ry[q] - ry[a]) - (ry[i] - ry[a]) * (rx[q] - rx[a]);
      kw[i] = ab * bq * aq > 1e-9 ? 2 * cr / (ab * bq * aq) : 0;
    }
    const ks = smoothClosed(kw, 1, 1);
    for (let i = 0; i < N; i++) if (Math.abs(ks[i]) > Math.abs(T.kRL[i])) T.kRL[i] = Math.sign(T.kRL[i] || ks[i]) * Math.abs(ks[i]);
  }
  // progression le long de l'axe pour une vitesse donnée sur la ligne idéale
  T.prog = new Float64Array(N);
  for (let i = 0; i < N; i++) T.prog[i] = clamp(T.ds / Math.max(0.3, T.dsRL[i]), GEO_LO, GEO_HI);
}

/* Optimisation hors ligne de la trajectoire au temps au tour (ligne « temps minimal ») :
   on déforme localement la ligne et on garde ce qui fait gagner du temps sur un profil de vitesse quasi statique */
function lineLapTime(T, alpha) {
  const N = T.N, m = M0 + 45, mu = MU * T.gk;
  const rx = new Float64Array(N), ry = new Float64Array(N);
  for (let i = 0; i < N; i++) { rx[i] = T.x[i] + alpha[i] * T.nx[i]; ry[i] = T.y[i] + alpha[i] * T.ny[i]; }
  const { k, seg } = curvatureOf(rx, ry, N, TUNE.KW ?? 1);   // lissage minimal : une cassure coûte vraiment
  const v = new Float64Array(N);
  for (let i = 0; i < N; i++) v[i] = cornerSpeed(k[i], mu, CLA_Z, m);
  for (let rep = 0; rep < 2; rep++)
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N, vj = v[j];
      const lat = vj * vj * Math.abs(k[j]) / latAccel(vj, mu, m);
      const vm = Math.sqrt(vj * vj + 2 * 0.93 * brakeDecel(vj, m, T.gk) * Math.sqrt(Math.max(0.08, 1 - lat * lat)) * seg[i]);
      if (v[i] > vm) v[i] = vm;
    }
  let t = 0;
  for (let rep = 0; rep < 2; rep++) {
    t = 0;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, vi = Math.max(v[i], 5);
      const lat = vi * vi * Math.abs(k[i]) / latAccel(vi, mu, m);
      const acc = (Math.min((P_ICE + P_K * 0.6) / vi, mu * (m * G * 0.64 + 0.25 * RHO * CLA_Z * vi * vi)) * Math.sqrt(Math.max(0, 1 - lat * lat)) - 0.5 * RHO * CDA_Z * vi * vi - 0.012 * m * G) / m;
      const vn = Math.sqrt(Math.max(1, vi * vi + 2 * acc * seg[i]));
      if (vn < v[j]) v[j] = vn;
      t += seg[i] / Math.max(1, (vi + Math.max(v[j], 5)) / 2);
    }
  }
  // régularité : pas de cassure dans la ligne (sinon la voiture zigzague)
  let rough = 0;
  for (let i = 0; i < N; i++) { const d2 = alpha[(i + N - 1) % N] - 2 * alpha[i] + alpha[(i + 1) % N]; rough += d2 * d2; }
  return t + (TUNE.SMOOTH ?? 3) * rough;
}
function optimizeLine(T, log) {
  const N = T.N, lim = T.lineLim, h = 6;
  let al = Float64Array.from(T.alpha), best = lineLapTime(T, al);
  const t0 = best, M = Math.floor(N / h), W = 2 * h;
  const bump = new Float64Array(2 * W + 1); for (let u = -W; u <= W; u++) bump[u + W] = 0.5 * (1 + Math.cos(Math.PI * u / W));
  const tryMove = (c, d) => {
    const old = new Float64Array(2 * W + 1);
    for (let u = -W; u <= W; u++) { const i = (c + u + N) % N; old[u + W] = al[i]; al[i] = clamp(al[i] + d * bump[u + W], -lim, lim); }
    const t = lineLapTime(T, al);
    if (t < best - 1e-5) { best = t; return true; }
    for (let u = -W; u <= W; u++) al[(c + u + N) % N] = old[u + W];
    return false;
  };
  for (const d of [1.6, 0.8, 0.4, 0.2]) {
    for (let pass = 0; pass < 3; pass++) {
      let gained = 0;
      for (let q = 0; q < M; q++) { const c = q * h; if (tryMove(c, d) || tryMove(c, -d)) gained++; }
      if (log) log(`pas ${d} m, passe ${pass + 1} : ${gained} améliorations, ${best.toFixed(3)} s`);
      if (!gained) break;
    }
  }
  if (log) log(`temps théorique ${t0.toFixed(3)} → ${best.toFixed(3)} s`);
  return al;
}

/* Profil de vitesse de référence : limite en virage + enveloppe de freinage */
function speedProfile(T) {
  const N = T.N, m = M0 + 45;
  const vc = new Float64Array(N), env = new Float64Array(N);
  for (let i = 0; i < N; i++) vc[i] = env[i] = cornerSpeed(T.kRL[i], MU * T.gk, CLA_Z, m);
  for (let rep = 0; rep < 2; rep++)
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N, vj = env[j];
      const lat = vj * vj * Math.abs(T.kRL[j]) / latAccel(vj, MU * T.gk, m);
      const dec = brakeDecel(vj, m, T.gk) * Math.sqrt(Math.max(0.08, 1 - lat * lat));
      const vm = Math.sqrt(vj * vj + 2 * 0.93 * dec * T.dsRL[i]);
      if (env[i] > vm) env[i] = vm;
    }
  T.vc = vc; T.env = env;
  // zones de freinage, virages, mode X
  T.brk = new Uint8Array(N);
  for (let i = 0; i < N; i++) T.brk[i] = env[i] < vc[i] - 0.3 ? 1 : 0;
  T.dtb = new Float64Array(N);      // distance jusqu'au prochain freinage
  T.csign = new Int8Array(N);       // sens du prochain virage (+1 gauche)
  T.dApex = new Float64Array(N);
  const apex = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const p = (i - 1 + N) % N; if (T.brk[p] && !T.brk[i]) apex[i] = 1; }
  for (let rep = 0; rep < 2; rep++)
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N;
      T.dtb[i] = T.brk[i] ? 0 : (rep === 0 && j === 0 ? 1e4 : T.dtb[j] + T.ds);
      if (apex[i]) {
        let ks = 0; for (let u = -8; u <= 8; u++) ks += T.kRL[(i + u + N) % N];
        T.csign[i] = ks > 0 ? 1 : -1; T.dApex[i] = 0;
      } else if (!(rep === 0 && j === 0)) { T.csign[i] = T.csign[j]; T.dApex[i] = T.dApex[j] + T.ds; }
    }
  T.xm = new Uint8Array(N);
  const win = Math.round(60 / T.ds);
  for (let i = 0; i < N; i++) {
    let mx = 0; for (let u = -5; u <= win; u++) mx = Math.max(mx, Math.abs(T.kRL[(i + u + N) % N]));
    T.xm[i] = mx < 1 / 500 && !T.brk[i] ? 1 : 0;
  }
  T.vmaxRef = Math.max(...env);
}

/* Voie des stands : côté avec le plus de dégagement */
function pitLayout(T) {
  const N = T.N, off = T.w / 2 + 9;
  T.pitIn = T.L - 420; T.pitOut = 330; T.pitLen = 750;
  let best = -1, bestSide = 1;
  for (const side of [1, -1]) {
    let mind = 1e9;
    for (let s = -420; s <= 330; s += 15) {
      const i = Math.round(((s + T.L) % T.L) / T.ds) % N;
      const px = T.x[i] + side * off * T.nx[i], py = T.y[i] + side * off * T.ny[i];
      for (let j = 0; j < N; j += 2) {
        const dd = Math.min(Math.abs(j - i), N - Math.abs(j - i)) * T.ds;
        if (dd < 90) continue;
        mind = Math.min(mind, Math.hypot(T.x[j] - px, T.y[j] - py));
      }
    }
    if (mind > best) { best = mind; bestSide = side; }
  }
  T.pitSide = bestSide; T.pitD = bestSide * off;
  T.pitLimit = T.circ.id === 'mc-1929' ? 60 / 3.6 : 80 / 3.6;
}

/* Échantillonnage interpolé */
function at(T, A, s) {
  const f = (((s % T.L) + T.L) % T.L) / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, u = f - Math.floor(f);
  return A[i] + (A[j] - A[i]) * u;
}
function idxOf(T, s) { return Math.floor((((s % T.L) + T.L) % T.L) / T.ds) % T.N; }
function worldPos(T, s, d) {
  const f = (((s % T.L) + T.L) % T.L) / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, u = f - Math.floor(f);
  const x = T.x[i] + (T.x[j] - T.x[i]) * u, y = T.y[i] + (T.y[j] - T.y[i]) * u;
  const nx = T.nx[i] + (T.nx[j] - T.nx[i]) * u, ny = T.ny[i] + (T.ny[j] - T.ny[i]) * u;
  const tx = T.tx[i] + (T.tx[j] - T.tx[i]) * u, ty = T.ty[i] + (T.ty[j] - T.ty[i]) * u;
  return { x: x + nx * d, y: y + ny * d, h: Math.atan2(ty, tx) };
}

/* ------------------------------------------------------------------ */
/*  VOITURES                                                           */
/* ------------------------------------------------------------------ */
function makeCar(id, entry, T, opts) {
  const t = entry.team, dr = entry.driver;
  const ld = +t.ligne_droite, vir = +t.virage, pn = +t.pneus, dep = +t.depart, sk = +dr.skill, cons = +(dr.consistency ?? dr.skill);
  const parts = dr.name.split(' ');
  return {
    id, team: t, driver: dr, code: (parts[parts.length - 1] || dr.name).slice(0, 3).toUpperCase(),
    pf: 1 + (ld - 64) * 0.0035, cdaF: 1 - (ld - 64) * 0.0015,
    gripBase: (1 + (vir - 63) * 0.0026) * (1 + (sk - 65) * 0.0011),
    wearF: clamp(1 - (pn - 63) * 0.012, 0.75, 1.25),
    launchSkill: dep, skill: sk, cons,
    aggr: clamp(0.35 + ((dr.num * 37) % 50) / 100 + rnd(-0.1, 0.1), 0.2, 0.95),
    errRate: clamp(1.6 - (sk - 60) / 15, 0.6, 1.8) * clamp(1.5 - (cons - 60) / 20, 0.7, 1.5),
    dist: 0, s: 0, d: 0, vd: 0, v: 0, a: 0, yaw: 0, lapsDone: -1,
    soc: SOC_MAX, harvLap: 0, otAvail: false, otE: 0, otActive: false, xmode: false,
    tyre: 'M', wear: 0, tyreAge: 0, warm: 1, fuel: opts.fuel, damage: 0, puncture: false,
    state: 'grid', pitPhase: 0, pitReq: false, pitReason: '', stopT: 0, stops: 0, usedComps: new Set(),
    ai: { mode: 'line', tgt: -1, side: 1, t: 0, cool: 0, moved: false, yieldT: 0, resolved: false, reckless: 0 },
    errShift: 0, blind: 0, spin: null, prevBrk: 0, offTrack: false, tow: 0, dirty: 0,
    lapStartT: 0, lastLap: 0, bestLap: 0, laps: [], cross: [], finishT: 0, pos: id + 1, gridPos: id + 1,
    gap: 0, int: 0, loopKey: -1, loopT: 0, throttle: 0, brake: 0, noAttackLap: -99, retiredWhy: '',
    reaction: 0, launch: 1, blue: false, contactCD: {}, inPitLane: false, fin: false, gone: false,
  };
}

/* codes à 3 lettres en double (même début de nom) : ces pilotes prennent les 3 premières lettres de leur prénom
   (puis 2 lettres du prénom + l'initiale du nom si ça ne suffit pas) */
function uniqueCodes(cars) {
  const dupes = () => { const n = new Map(); cars.forEach(c => n.set(c.code, (n.get(c.code) || 0) + 1)); return cars.filter(c => n.get(c.code) > 1); };
  for (const c of dupes()) { const p = c.driver.name.split(' '); if (p.length > 1) c.code = p[0].slice(0, 3).toUpperCase(); }
  // prénoms qui commencent pareil : le second prend une combinaison libre (2 lettres du prénom + 1 du nom…)
  for (const c of dupes().slice(1)) {
    const p = c.driver.name.split(' '), f = p[0], l = p[p.length - 1], used = new Set(cars.filter(x => x !== c).map(x => x.code));
    const cand = [f.slice(0, 2) + l[0], ...[...l.slice(1)].map(ch => f.slice(0, 2) + ch), ...[...l.slice(1)].map(ch => f[0] + l[0] + ch), ...[...f.slice(2)].map(ch => f.slice(0, 2) + ch)].map(x => x.toUpperCase());
    const ok = cand.find(x => x.length === 3 && !used.has(x)); if (ok) c.code = ok;
  }
}
/* perte d'adhérence due à l'usure (fraction) : régulière tout au long du relais (en course ≈ 0,3 s/tour en tendres,
   0,14 en mediums, 0,07 en durs, soit 1 à 2 s perdues en fin de relais), puis « falaise » au-delà de 85 % d'usure */
const PUNCT_F = 0.37;   // vitesse max en crevaison (fraction de la vitesse limite) : ≈ deux fois le temps au tour
function tyreLoss(comp, w) {
  return (0.06 * w + 0.04 * w * w) * (SOFTNESS[comp] || 1) + (w > 0.85 ? 1.5 * (w - 0.85) * (w - 0.85) : 0);
}
function tyreGrip(c) {
  const w = c.wear;
  // usure : perte de rythme progressive, puis falaise en fin de vie
  let g = compGrip(c.tyre, CUR_WET) * (1 - tyreLoss(c.tyre, w));
  g *= 1 - 0.018 * c.warm;
  return g;
}

function ersPower(c, v) {
  const kmh = v * 3.6, full = c.otActive ? 337 : 290, zero = 355;
  let p = kmh <= full ? P_K : kmh >= zero ? 0 : P_K * (zero - kmh) / (zero - full);
  if (ICE_ONLY) return 0;
  const e = c.soc + (c.otActive ? c.otE : 0);
  if (e <= 0) return 0;
  // gestion d'énergie : on dose le déploiement selon la charge restante
  if (c.human && c.ersMode === 'charge') return 0;
  if (c.human && c.ersMode === 'attack') return p;
  if (!c.otActive && !c.quali) p *= clamp((c.soc - 0.6e6) / 2.2e6, 0, 1);   // réserve gardée pour défendre / attaquer
  return p;
}

/* ------------------------------------------------------------------ */
/*  COURSE                                                             */
/* ------------------------------------------------------------------ */
function createRace(T, grid, opts) {
  opts = Object.assign({ laps: 10, wearMode: 'prop', realLaps: T.circ.laps }, opts || {});
  const R = {
    T, laps: opts.laps, opts, t: 0, phase: 'lights', lightsOn: 0, lightsOutAt: 5 + rnd(0.4, 2.6),
    flag: 'green', sc: null, scEndT: 0, vscEndT: 0, yellows: [], events: [], fastest: null,
    firstPass: new Map(), nLoops: Math.ceil(T.L / 50), leaderDone: false, finishOrder: [], finishedAt: 0,
    incidents: 0, raceDist: opts.laps * T.L, over: false, startT: 0,
    teamOrder: [...new Set(grid.map(e => e.team.name))], chaos: opts.chaos || 1,
  };
  // durée de vie pneus : proportionnelle à la distance de course (stratégie complète)
  R.wearDist = opts.wearMode === 'real' ? T.circ.laps * T.L : Math.max(R.raceDist, 8 * T.L);   // courses très courtes : pas d'usure absurde
  if (opts.laps < 5 && opts.wearMode !== 'real') R.wearDist = Math.max(R.wearDist, R.raceDist * T.tyre.deg / (COMP.S.life * 0.75));   // moins de 5 tours : un seul train suffit
  const fuelStart = 12 + 88 * (opts.laps / T.circ.laps);
  R.fuelPerLap = (fuelStart - 3) / opts.laps;
  setupWeather(R, opts.weather || 'dry');
  CUR_WET = R.wet; CUR_TG = T.tyre.g;
  const side1 = T.csign[0] || 1, gx = Math.min(3.3, T.lim - 0.5);
  R.cars = grid.map((e, i) => {
    const c = makeCar(i, e, T, { fuel: fuelStart });
    c.dist = -(7 + 8 * i); c.s = ((c.dist % T.L) + T.L) % T.L;
    c.d = (i % 2 === 0 ? side1 : -side1) * gx;
    c.state = 'run';
    c.wxBias = rnd(-0.07, 0.07);
    return c;
  });
  stratSetup(R);   // pneu de départ et plan de chaque voiture
  for (const c of R.cars) { if (R.wet >= 0.2) c.tyre = bestComp(R.wet); c.usedComps.add(c.tyre); }
  uniqueCodes(R.cars);
  R.ranked = R.cars.slice(); R.orderIds = R.cars.map(c => c.id);
  R.noDnf = !!opts.noDnf;
  R.dmgLite = !R.noDnf && !!opts.dmgLite;   // « abandons seuls » : accidents (et Safety Car) possibles, mais aucun dégât qui force un arrêt
  if (opts.colEvery != null) R.colEvery = opts.colEvery;   // collisions provoquées par pénalité de 5 s (0 = aucune), pour toutes les voitures   // option « Sans abandon » : les chocs ralentissent les voitures sans casse ni abandon
  R.input = { thr: 0, brk: 0, steer: 0, ers: 'normal', ot: false, assist: opts.assist === 'semi' ? 'semi' : opts.assist === false || opts.assist === 'off' ? 'off' : 'on' };
  // plusieurs pilotes humains possibles (multijoueur) : chacun a ses propres commandes c.input ; le premier utilise R.input
  const hums = (Array.isArray(opts.human) ? opts.human : opts.human != null ? [opts.human] : []).filter(i => R.cars[i]);
  hums.forEach((i, k) => { const c = R.cars[i]; c.human = true; c.input = k === 0 ? R.input : Object.assign({}, R.input); });
  if (hums.length) {
    R.level = typeof opts.level === 'object' && opts.level ? opts.level : LEVELS[opts.level] || LEVELS.pro;   // réglages à la carte ou niveau prédéfini
    for (const c of R.cars) if (!c.human) { c.latK = R.level.pace * R.level.pace; c.gripBase *= c.latK; c.errRate *= R.level.err; }   // seulement en virage (voir gfL)
  }
  // même physique pour tous : aucune adhérence en plus ou en moins pour le joueur
  return R;
}

function setupWeather(R, mode) {
  const Test = R.laps * R.T.L / 50;             // durée de course estimée (s)
  R.wx = { mode, rain: 0, target: 0, showers: [] };
  R.wet = 0;
  if (mode === 'light') { R.wx.rain = R.wx.target = 0.35; R.wet = 0.4; }
  else if (mode === 'heavy') { R.wx.rain = R.wx.target = 0.9; R.wet = 0.9; }
  else if (mode === 'mixed') {
    // une seule averse, mais longue (en moyenne la moitié de la course)
    if (Math.random() < 0.35) { R.wx.rain = 0.5; R.wet = 0.55; R.wx.showers.push({ t0: 0, t1: Test * rnd(0.3, 0.6), r: 0.5 }); }
    else R.wx.showers.push({ t0: Test * rnd(0.1, 0.4), t1: 0, r: rnd(0.35, 0.95) });
    for (const sh of R.wx.showers) if (!sh.t1) sh.t1 = sh.t0 + Test * rnd(0.4, 0.75);
  }
}
function updateWeather(R, dt) {
  const wx = R.wx, t = R.t - R.startT;
  if (wx.mode === 'mixed') {
    const sh = wx.showers.find(x => t >= x.t0 && t < x.t1);
    const tgt = sh ? sh.r : 0;
    if (tgt > 0.05 && wx.target <= 0.05) note(R, 'wx', 'La pluie commence à tomber !');
    if (tgt <= 0.05 && wx.target > 0.05) note(R, 'wx', 'La pluie s\'arrête, la piste va sécher');
    wx.target = tgt;
  }
  wx.rain += clamp(wx.target - wx.rain, -0.02 * dt, 0.02 * dt);
  const w0 = R.wet;
  if (wx.rain > R.wet) R.wet += (wx.rain - R.wet) * dt / 70;
  else R.wet = Math.max(wx.rain, R.wet - 0.0022 * dt);
  if (w0 >= 0.2 && R.wet < 0.2) note(R, 'wx', 'Piste presque sèche : place aux slicks !');
  if (w0 < 0.2 && R.wet >= 0.2) note(R, 'wx', 'Piste mouillée : les slicks ne tiennent plus');
}

/* ---- modèle de prévision pour le simulateur de stratégie (même usure / adhérence / essence que la course) ---- */
function strategyModel(T, laps, wearMode, baseLap) {
  const L = T.L, raceDist = laps * L;
  let wearDist = wearMode === 'real' ? T.circ.laps * L : Math.max(raceDist, 8 * L);
  if (laps < 5 && wearMode !== 'real') wearDist = Math.max(wearDist, raceDist * T.tyre.deg / (COMP.S.life * 0.75));
  const fuelStart = 12 + 88 * (laps / T.circ.laps), fuelPerLap = (fuelStart - 3) / laps;
  const sens = (T.circ.tsens || T.circ.length / 55 * 0.005) * 1.15;   // secondes perdues par % d'adhérence en moins
  const wearPerLap = c => L * T.tyre.deg / (COMP[c].life * wearDist);
  const grip = (c, w) => (T.tyre.g[c] ?? COMP[c].g) * (1 - tyreLoss(c, w));
  // temps au tour (l = numéro du tour, 1..laps ; w = usure au début du tour ; first = tour de sortie des stands, pneus froids)
  // sp = [rythme de course / tour de qualif, temps perdu par arrêt] mesurés en course sur chaque circuit (tools/stratcal.js) ;
  // baseLap = tour de qualif de référence (sans sp : ancienne estimation, qualif + 1,5 %)
  const sp = T.circ.sp, race = sp ? baseLap * sp[0] : baseLap * 1.015;
  const start = sp && sp[2] != null ? sp[2] : 0;   // tour 1 : départ arrêté et peloton groupé
  const lap = (c, w, l, first) => race + (1 - grip(c, w + wearPerLap(c) / 2)) * 100 * sens + 0.032 * (fuelStart - fuelPerLap * (l - 0.5) - 3) + (first ? 0.9 : 0) + (l === 1 ? start : 0);
  const pitLoss = sp ? sp[1] : T.pitLen / T.pitLimit + 2.4 + 2.5 - T.pitLen / (L / race);
  return { laps, lap, wearPerLap, pitLoss, sens };
}
/* ---- stratégie des IA : calculée, pas tirée au sort ----
   Chaque voiture connaît le coût de chaque relais (même modèle d'usure / adhérence que la course) et cherche par
   programmation dynamique la suite de relais la plus rapide jusqu'à l'arrivée : nombre d'arrêts, tours d'arrêt, pneus,
   en respectant les deux types de slicks et sans jamais risquer la crevaison. Le plan est recalculé à chaque tour
   à partir de l'usure réelle (pneu qui s'use plus ou moins vite que prévu, Safety Car qui rend l'arrêt moins cher…).
   Chaque écurie a ses préférences de gommes (léger biais), d'où des stratégies variées mais toutes cohérentes. */
const DRY = ['S', 'M', 'H'], CBIT = { S: 1, M: 2, H: 4 };
const STRAT_WMAX = 0.95;   // usure maximale prévue en fin de relais (la crevaison arrive à 100 %)
function stratSetup(R) {
  const T = R.T, N = R.laps, L = T.L;
  const sens = (T.circ.tsens || T.circ.length / 55 * 0.005) * 1.15;
  const sp = T.circ.sp, pitLoss = sp ? sp[1] : T.pitLen / T.pitLimit + 2.4 + 2.5 - T.pitLen / (L / 90);
  R.strat = { N, sens, pitLoss, rule: N >= 5 };
  const teamBias = {};
  for (const c of R.cars) {
    const tb = teamBias[c.team.name] = teamBias[c.team.name] || { S: rnd(-0.1, 0.1), M: rnd(-0.06, 0.06), H: rnd(-0.1, 0.1) };
    c.cBias = { S: tb.S + rnd(-0.03, 0.03), M: tb.M + rnd(-0.03, 0.03), H: tb.H + rnd(-0.03, 0.03) };
    stratTables(R, c);
  }
}
/* usure par tour (à l'attaque une partie du temps) et coût d'un tour selon l'usure, hors essence et départ (communs à toutes les stratégies) */
const stratWpl = (R, c, k) => R.T.L * R.T.tyre.deg / (COMP[k].life * R.wearDist) * c.wearF * 1.03;
const stratLap = (R, c, k, w) => (1 - (R.T.tyre.g[k] ?? COMP[k].g) * (1 - tyreLoss(k, w))) * 100 * R.strat.sens + c.cBias[k];
/* V[l][masque] = temps minimal pour couvrir les tours l..N en partant de pneus neufs au tour l (sortie des stands) */
function stratTables(R, c) {
  const { N, pitLoss, rule } = R.strat, INF = 1e9;
  const A = {};   // A[k][n] = coût cumulé d'un relais de n+1 tours en pneus k neufs
  for (const k of DRY) {
    const wpl = stratWpl(R, c, k), a = []; let s = 0;
    for (let n = 0; n < N && wpl * (n + 1) <= STRAT_WMAX; n++) { s += stratLap(R, c, k, wpl * (n + 0.5)); a.push(s); }
    A[k] = a;
  }
  const V = [], P = [];
  for (let l = N + 1; l >= 1; l--) {
    V[l] = new Float64Array(8).fill(INF); P[l] = new Array(8);
    for (let m = 0; m < 8; m++) {
      if (l === N + 1) { V[l][m] = !rule || (m & (m - 1)) ? 0 : INF; continue; }   // au moins deux types de slicks
      for (const k of DRY) {
        const a = A[k], m2 = m | CBIT[k];
        for (let e = l; e <= N && e - l < a.length; e++) {
          if (e < N && e > N - 2) continue;   // pas d'arrêt dans les deux derniers tours
          const nx = e === N ? V[N + 1][m2] : pitLoss + V[e + 1][m2];
          const t = a[e - l] + (l > 1 ? 0.9 : 0) + nx;
          if (t < V[l][m]) { V[l][m] = t; P[l][m] = [k, e]; }
        }
      }
    }
  }
  c.sV = V; c.sP = P;
  if (c.lapsDone < 0) { const p = P[1][0]; if (p) c.tyre = p[0]; }   // pneu de départ
}
const wetTyre = c => !!COMP[c.tyre].wet;
const stratMask = c => { let m = 0; for (const k of c.usedComps) m |= CBIT[k] || 0; return [...c.usedComps].some(k => COMP[k].wet) ? 7 : m; };   // après la pluie, plus d'obligation des deux slicks
/* pneus du prochain relais si l'on s'arrête maintenant */
function stratNext(R, c) {
  if (!c.sP) return null;
  const p = c.sP[clamp(Math.floor((c.dist + mod(R.T.pitIn - c.s, R.T.L)) / R.T.L) + 2, 2, R.strat.N)][stratMask(c)];
  return p ? p[0] : null;
}
/* recalculé à chaque passage devant l'entrée des stands (ou quand le drapeau change) : rentre-t-on à la prochaine entrée,
   et sinon combien de tours encore avec ces pneus ? e = tour au cours duquel on atteint la prochaine entrée */
function stratDecide(R, c, toIn) {
  const { N, pitLoss } = R.strat, k0 = c.tyre, e = Math.floor((c.dist + toIn) / R.T.L) + 1;
  c.boxNow = false;
  if (!c.sV || COMP[k0].wet || e > N) return;
  const m = stratMask(c), wpl = stratWpl(R, c, k0), wE = c.wear + wpl * toIn / R.T.L;   // usure à la prochaine entrée
  const loss = R.flag === 'sc' ? pitLoss * 0.45 : R.flag === 'vsc' ? pitLoss * 0.62 : pitLoss;
  let best = 1e9, bestJ = -1, s = 0;
  for (let j = 0; e + j <= N; j++) {   // j tours de plus avec ces pneus après la prochaine entrée
    if (j > 0) { if (wE + wpl * j > (e + j === N ? 0.985 : STRAT_WMAX)) break; s += stratLap(R, c, k0, wE + wpl * (j - 0.5)); }
    const x = e + j;   // arrêt en fin de tour x (ou arrivée si x = N)
    if (x < N && x > N - 2) continue;   // pas d'arrêt dans les deux derniers tours
    const t = s + (x === N ? c.sV[N + 1][m] : (j === 0 ? loss : pitLoss) + c.sV[x + 1][m]);
    if (t < best) { best = t; bestJ = j; }
  }
  if (bestJ < 0) { c.boxNow = e <= N - 2; return; }   // pneus au bout : on rentre
  // plan complet (pour l'affichage et le choix des pneus)
  const plan = []; let l = e + bestJ + 1, mm = m;
  if (l <= N) plan.push({ comp: null, lap: l - 1 });
  while (l <= N) { const p = c.sP[l][mm]; if (!p) break; plan[plan.length - 1].comp = p[0]; mm |= CBIT[p[0]]; l = p[1] + 1; if (l <= N) plan.push({ comp: null, lap: l - 1 }); }
  c.plan = plan.filter(p => p.comp); c.stratName = c.plan.length + (c.plan.length > 1 ? ' arrêts' : ' arrêt');
  c.boxNow = bestJ === 0 && e < N;
}

function note(R, type, msg, carIds) {
  R.events.push({ t: R.t, lap: leaderLap(R), type, msg, cars: carIds || [] });
  if (R.events.length > 4000) R.events.shift();   // gardés pour les highlights de fin de course
}
function leaderLap(R) {
  let m = -1; for (const c of R.cars) if (c.lapsDone > m) m = c.lapsDone;
  return clamp(m + 1, 1, R.laps);
}
const physDs = (T, a, b) => { let d = (b.s - a.s) % T.L; if (d > T.L / 2) d -= T.L; if (d < -T.L / 2) d += T.L; return d; };
const active = c => c.state === 'run' && !c.gone;
const obstacle = c => !c.gone && !c.ghost && c.state !== 'pit' && !c.fin && !c.finGhost;

/* temps de réaction au départ des pilotes IA : 0,15–0,30 s le plus souvent, parfois plus lent, très rarement anticipé (faux départ) */
function aiReaction(c) {
  const u = Math.random();
  if (u < 0.0015) return rnd(0.0, 0.08);                                          // anticipation = faux départ
  if (u < 0.04) return rnd(0.32, 0.55);                                          // départ endormi
  const g = (Math.random() + Math.random() + Math.random()) / 3;                // en cloche
  return 0.15 + g * 0.14 + (70 - c.skill) * 0.0012;
}
function jumpStart(R, c) {
  c.penalty = (c.penalty || 0) + 5;
  note(R, 'penalty', `FAUX DÉPART de ${c.code} : pénalité de 5 s`, [c.id]);
}
/* ---------- Pas de simulation ---------- */
function step(R, dt) {
  const T = R.T;
  R.t += dt;
  if (R.phase === 'lights') {
    R.lightsOn = Math.min(5, Math.floor(R.t));
    // faux départ du joueur : accélérer alors que les feux s'allument (avant leur extinction)
    if (R.lightsOn >= 1) for (const c of R.cars) if (c.human && !c.jump && (c.input || R.input).thr > 0.3) {
      c.jump = true; jumpStart(R, c);
    }
    if (R.t >= R.lightsOutAt) {
      R.phase = 'race'; R.startT = R.t; R.lightsOn = 0;
      note(R, 'start', 'EXTINCTION DES FEUX !');
      for (const c of R.cars) {
        // motricité selon la note « départ » de l'écurie, pour tous
        c.launch = clamp(rnd(0.97, 1.0) + (c.launchSkill - 62) * 0.004, 0.9, 1.04);
        // le joueur part quand il appuie sur l'accélérateur (temps de réaction réel), ou tout de suite s'il a anticipé
        if (c.human) { c.reaction = c.jump ? R.t : Infinity; continue; }
        c.reaction = R.t + aiReaction(c);
        if (c.reaction < R.t + 0.1) { c.jump = true; jumpStart(R, c); }
        else if (Math.random() < 0.03) c.launch = rnd(0.72, 0.85);
        if (c.launch < 0.8) note(R, 'info', `Mauvais départ de ${c.code} !`, [c.id]);
      }
    }
    return;
  }
  if (R.startT && R.t - R.startT < 30) for (const c of R.cars) if (c.human && c.reaction === Infinity && (c.input || R.input).thr > 0.3) {
    c.reaction = R.t; c.reactT = R.t - R.startT;
    note(R, 'info', `Temps de réaction de ${c.code} : ${c.reactT.toFixed(3)} s`, [c.id]);
  }
  if (R.over) return;
  updateWeather(R, dt);
  CUR_WET = R.wet; CUR_TG = T.tyre.g;
  updateFlags(R, dt);
  const cars = R.cars;
  // Voisinage (O(n²) — 22 voitures)
  for (const c of cars) perceive(R, c);
  for (const c of cars) {
    if (c.gone) continue;
    if (c.state === 'out') { c.v = Math.max(0, c.v - 12 * dt); c.s = mod(c.s + c.v * dt, T.L); c.dist += c.v * dt; continue; }
    if (c.state === 'pit') { pitStep(R, c, dt); continue; }
    if (c.finGhost) { ghostStep(R, c, dt); continue; }
    drive(R, c, dt);
  }
  collisions(R);
  if (R.sc) scStep(R, dt);
  order(R);
  if (R.qualiRun) qualiCheck(R);
  if (R.tt) ttCheck(R);
}
const mod = (a, n) => ((a % n) + n) % n;

function perceive(R, c) {
  const T = R.T;
  c.nb = { ahead: null, aheadDs: 1e9, lane: null, laneDs: 1e9, side: [], tow: 0, dirty: 0, attacker: null, attDs: 1e9, lapper: null, lapDs: 1e9, obst: null, obstDs: 1e9 };
  if (!active(c) || c.finGhost) return;
  const nb = c.nb, kr = Math.abs(at(T, T.kRL, c.s));
  for (const o of R.cars) {
    if (o === c || !obstacle(o)) continue;
    if (o.state === 'out' && o.gone) continue;
    const ds = physDs(T, c, o), dd = o.d - c.d, add = Math.abs(dd);
    if (o.state === 'out' || o.spin || (o.v < c.v * 0.5 && o.v < 25)) {
      if (ds > 0 && ds < 250 && add < CAR_WID + 1 && ds < nb.obstDs) { nb.obst = o; nb.obstDs = ds; }
    }
    if (o.state === 'out') { if (Math.abs(ds) < CAR_LEN + 0.6) nb.side.push({ o, ds, dd }); if (ds > 0 && ds < 200 && add < CAR_WID + 0.3 && ds < nb.laneDs) { nb.lane = o; nb.laneDs = ds; } continue; }
    if (ds > 0 && ds < 160 && ds < nb.aheadDs) { nb.ahead = o; nb.aheadDs = ds; }
    // trajectoire latérale anticipée sur le temps de rapprochement
    const close = c.v - o.v;
    const th = ds > 0 ? clamp(close > 0.5 ? (ds - CAR_LEN) / close : 0.3, 0.3, 1.0) : 0.3;
    const ddp = (o.d + o.vd * th) - (c.d + c.vd * th);
    const inLane = add < CAR_WID + 0.3 || Math.abs(ddp) < CAR_WID + 0.2;
    if (ds > 0 && ds < 200 && inLane && ds < nb.laneDs) { nb.lane = o; nb.laneDs = ds; }
    // voitures à côté ou qui vont l'être dans ~1.2 s (rétroviseurs)
    const fwd = CAR_LEN + 1.5 + Math.max(0, close) * 1.2, back = CAR_LEN + 1.5 + Math.max(0, -close) * 1.3;
    if ((ds > -back && ds < fwd && (add > 0.9 || Math.abs(ds) < CAR_LEN + 0.6))) nb.side.push({ o, ds, dd });
    if (ds > 0 && ds < 95 && add < 2.8) nb.tow = Math.max(nb.tow, Math.pow(1 - ds / 95, 0.8) * (1 - add / 2.8) * 0.2);   // aspiration
    if (ds > 0 && ds < 45 && add < 2.4 && kr > 1 / 300) nb.dirty = Math.max(nb.dirty, 0.075 * (1 - ds / 45));
    if (ds < 0 && ds > -120) {
      if (o.ai.mode === 'attack' && o.ai.tgt === c.id && -ds < nb.attDs) { nb.attacker = o; nb.attDs = -ds; }
      if (o.dist - c.dist > T.L * 0.5 && -ds < nb.lapDs) { nb.lapper = o; nb.lapDs = -ds; }
    }
  }
}

function drive(R, c, dt) {
  const T = R.T, s = c.s, i0 = idxOf(T, s);
  const alpha = at(T, T.alpha, s), kr = at(T, T.kRL, s), kc = at(T, T.k, s);
  const brk = T.brk[i0], dtb = T.dtb[i0], cs = T.csign[i0];
  const m = M0 + c.fuel;
  const nb = c.nb;
  const started = R.t >= c.reaction;
  const green = R.flag === 'green' && c.lapsDone >= c.noAttackLap;
  const lim = T.lim;

  // --- facteurs d'adhérence ---
  c.dirtyS = (c.dirtyS || 0) + (nb.dirty - (c.dirtyS || 0)) * Math.min(1, dt * 1.5);   // l'air sale s'installe progressivement
  let gf = T.gk * c.gripBase * tyreGrip(c) * (1 - c.damage * 0.07) * (1 - c.dirtyS);
  c.dirty = nb.dirty; c.tow = nb.tow;
  if (c.offTrack) gf *= T.street ? 0.9 : 0.55;
  // niveau de l'IA : il ne joue que sur l'adhérence en virage ; freinage et motricité restent ceux de la voiture
  const gfL = gf / (c.latK || 1);
  const massF = 1 - (m - (M0 + 45)) * 0.00008;
  // écart à la ligne idéale : la trajectoire réelle de la voiture est définie par rapport à elle
  const e0 = c.d - alpha;
  const muC = MU * gf;

  // --- vitesse cible : anticipation sur la trajectoire que la voiture suit réellement ---
  // en course on roule à ~97 % de l'adhérence (gestion pneus, marge en trafic) ; en qualif à 100 %
  const muT = muC * (c.quali ? 1 : 0.97);
  const gScale = Math.sqrt(gf / T.gk * (c.quali ? 1 : 0.97)) * massF * (c.quali ? 1 : 1 + 0.06 * R.wet);   // sous la pluie l'IA gardait trop de marge (≈ 3 % plus lente que le joueur)
  let target = at(T, T.env, s - c.errShift) * gScale;   // estimation (affinée après les décisions IA)
  if (c.offTrack) target *= T.street ? 0.8 : 0.6;
  if (c.damage > 0.5) target *= 0.985;
  const aS = (at(T, T.alpha, s + 2) - at(T, T.alpha, s - 2)) / 4;
  let tgtD = alpha, tS = aS, cap = 1e9;
  // pilote humain (le pilote automatique reprend la main pour entrer aux stands)
  const H = c.human && !(c.pitReq && mod(T.pitIn - s, T.L) < 450) ? (c.input || R.input) : null;
  if (H) c.ersMode = H.ers;
  const ai = c.ai;
  if (H) {
    // aide au freinage : vitesse sûre anticipée sur la trajectoire actuelle
    if (R.level && (R.level.brake !== 'off' || R.level.cues)) {
      let tv = 1e9;
      for (const la of LOOK) {
        const sj = s + la, kj = at(T, T.kRL, sj), aj = at(T, T.alpha, sj), kcj = at(T, T.kS, sj);
        let vj = at(T, T.env, sj) * gScale;
        let kEff = Math.abs(kj / clamp(1 - kj * (c.d - aj), GEO_LO, GEO_HI));
        if (Math.abs(c.d - aj) > 0.6) kEff = Math.max(kEff, Math.abs(kcj / clamp(1 - kcj * c.d, GEO_LO, GEO_HI)));
        if (kEff > Math.abs(kj) && Math.abs(kj) > 1 / 1500) vj = Math.min(vj, cornerSpeed(kEff, muT, CLA_Z, m) * massF * 0.995);
        const lu = Math.min(1, vj * vj * Math.abs(kj) / latAccel(vj, muT, m));
        const vr = la === 0 ? vj : Math.sqrt(vj * vj + 2 * (c.quali && !TUNE.HLRACE ? (TUNE.BK || 0.96) : 0.85 + 0.08 * R.wet) * brakeDecel(vj, m, gfL) * (c.quali && !TUNE.HLRACE ? Math.sqrt(Math.max(TUNE.BL || 0.6, 1 - 0.35 * lu * lu)) : Math.sqrt(Math.max(0.15, 1 - (TUNE.LUK || 1.6) * lu * lu))) * la);
        if (vr < tv) tv = vr;
      }
      c.assistV = tv;
    } else c.assistV = 0;
    if (safeCar(R, c)) { c.damage = 0; if (c.wear < 1) c.puncture = false; }   // la crevaison d'usure reste
    // limiteur de vitesse automatique sous neutralisation
    if (R.flag === 'vsc' || R.flag === 'vsc_end') cap = target * 0.6;
    else if (R.flag === 'sc' || R.flag === 'sc_in' || R.flag === 'restart') cap = target * 0.62;
    // neutralisation : impossible de dépasser, on reste derrière la voiture qui précède (ou la Safety Car)
    // (après une relance, pas de dépassement avant la ligne de contrôle)
    if (R.flag !== 'green' || c.lapsDone < c.noAttackLap) {
      let ads = 1e9, ahead = null;
      for (const o of R.cars) if (o !== c && obstacle(o) && o.state === 'run') { const ds = physDs(T, c, o); if (ds > 0 && ds < ads) { ads = ds; ahead = o; } }
      const scDs = R.sc ? mod(R.sc.s - c.s, T.L) : 1e9;
      const gapM = Math.min(ads, scDs), refV = scDs < ads ? R.sc.v : ahead ? ahead.v : 0;
      if ((R.flag === 'sc' || R.flag === 'sc_in') && gapM > 150) cap = target * 0.87;   // loin derrière : on recolle au peloton / à la Safety Car
      if (gapM < 400) cap = Math.min(cap, Math.sqrt(Math.max(0, refV * refV + 2 * 8 * (gapM - CAR_LEN - 8))));
      c.scHold = gapM < 60;
    } else c.scHold = false;
  } else {

  // --- IA : décisions de course ---
  ai.cool = Math.max(0, ai.cool - dt); ai.yieldT = Math.max(0, ai.yieldT - dt);
  c.blind = Math.max(0, c.blind - dt); ai.reckless = Math.max(0, ai.reckless - dt);
  if (!brk && c.prevBrk) { ai.moved = false; if (ai.mode === 'defend') ai.mode = 'line'; c.errShift = 0; ai.resolved = false; }
  if (!brk) ai.resolved = false;
  // Nouvelle erreur de freinage à l'entrée d'une zone de freinage
  if (brk && !c.prevBrk && R.flag === 'green' && started) {
    const traffic = nb.aheadDs < 40 ? 1.8 : 1;
    const lap1 = c.lapsDone < 1 ? 1.8 : 1;
    const p = 0.00045 * (1 + 1.6 * R.wet) * R.chaos * c.errRate * traffic * lap1 * (1 + c.wear) * (ai.mode === 'attack' ? 1.8 : 1);
    if (Math.random() < p) {
      c.errShift = Math.min(40, 6 - Math.log(Math.random()) * 9) * (1 - 0.45 * R.wet);   // sous la pluie on freine plus tôt
      if (c.errShift > 18) note(R, 'error', `Blocage de roues pour ${c.code} !`, [c.id]);
    }
  }
  c.prevBrk = brk;

  if (R.flag === 'green') {
    // drapeau bleu
    c.blue = false;
    if (nb.lapper && nb.lapDs / Math.max(c.v, 10) < 1.2) {
      c.blue = true;
      if (dtb > 60 && Math.abs(nb.lapper.d - c.d) < 2.5) { tgtD = (nb.lapper.d > c.d ? -1 : 1) * lim; tS = 0; }
      cap = Math.min(cap, target * 0.985);
    }
    // attaque
    if (ai.mode === 'attack') {
      const o = R.cars[ai.tgt];
      const ds = o && obstacle(o) && o.state === 'run' ? physDs(T, c, o) : 1e9;
      if (!green || ds > 170 || ds < -CAR_LEN * 1.4) {
        ai.mode = 'line'; ai.cool = ds < 0 ? 0.6 : 2.5;
      } else {
        let want = o.d + ai.side * (CAR_WID + 0.65);
        if (Math.abs(want) > lim) {
          if (dtb > 160 && ds > CAR_LEN) { ai.side = -ai.side; want = o.d + ai.side * (CAR_WID + 0.65); }
        }
        tgtD = clamp(want, -lim - 0.2, lim + 0.2); tS = 0;
        ai.t += dt;
        const gapT = ds / Math.max(10, c.v);
        if (gapT > 1.25 || ai.t > 12) { ai.mode = 'line'; ai.cool = 3; }
        // règle de l'intérieur au point de freinage
        if (brk && !ai.resolved && Math.abs(ds) < CAR_LEN * 1.3) {
          ai.resolved = true;
          const inside = ai.side === cs;
          if (ds < -CAR_LEN * 0.3) { o.ai.yieldT = 2.5; }
          else if (inside && ds < CAR_LEN * 0.35) { o.ai.yieldT = 2.2; c.errShift = Math.max(c.errShift, rnd(0, 9) * c.aggr); }
          else { ai.mode = 'yield'; ai.yieldT = 2.5; }
        }
      }
    } else if (ai.mode === 'yield') {
      if (ai.yieldT <= 0) ai.mode = 'line';
    } else if (ai.mode === 'defend') {
      tgtD = ai.defD; tS = 0;
    }
    // lancer une attaque
    if (ai.mode === 'line' && green && ai.cool <= 0 && nb.ahead && !c.pitReq && started && nb.ahead.state === 'run') {
      const o = nb.ahead, gapT = nb.aheadDs / Math.max(10, c.v);
      const myPace = c.gripBase * tyreGrip(c) * c.pf, hisPace = o.gripBase * tyreGrip(o) * o.pf;
      const faster = myPace > hisPace * 1.004 || (nb.tow > 0.07 && dtb > 250) || o.damage > 0 || o.puncture || c.otActive || o.blue;
      if (gapT < (faster ? 0.6 : 0.3) && dtb > 110 && Math.random() < dt * (0.8 + c.aggr)) {
        let side = cs || 1;
        if (Math.abs(o.d + side * (CAR_WID + 0.65)) > lim) side = -side;
        Object.assign(ai, { mode: 'attack', tgt: o.id, side, t: 0, resolved: false });
        const want = o.d + side * (CAR_WID + 0.65);
        if (Math.random() < 0.003 * c.errRate * R.chaos) c.blind = 0.8;   // angle mort mal évalué
        tgtD = clamp(want, -lim, lim); tS = 0;
      }
    }
    // défense (un seul changement de ligne)
    if (ai.mode === 'line' && nb.attacker && !ai.moved && dtb > 40 && dtb < 450 && green) {
      ai.moved = true;
      const overlapped = nb.attDs < CAR_LEN + 0.4;
      if (!overlapped && Math.random() < 0.45 + c.aggr * 0.4) {
        ai.mode = 'defend'; ai.defD = (cs || 1) * (lim - 0.4); tgtD = ai.defD; tS = 0;
      } else if (overlapped && Math.random() < 0.05 * c.aggr) {
        ai.mode = 'defend'; ai.defD = (cs || 1) * (lim - 0.4); tgtD = ai.defD; tS = 0; ai.reckless = 1.5;
        note(R, 'info', `${c.code} ferme la porte sur ${nb.attacker.code} !`, [c.id, nb.attacker.id]);
      }
    }
    if (ai.yieldT > 0) {
      for (const sd of nb.side) if (sd.o.state === 'run' && Math.abs(sd.ds) < CAR_LEN) cap = Math.min(cap, target * 0.975);
    }
  } else {
    ai.mode = 'line';
  }

  // Évitement d'obstacle (voiture arrêtée / en tête-à-queue)
  if (nb.obst && nb.obstDs < 220) {
    const o = nb.obst, left = o.d + CAR_WID + 1.2, right = o.d - CAR_WID - 1.2;
    const room = x => Math.abs(x) <= T.w / 2 - 0.8;
    if (room(left) && (!room(right) || Math.abs(left - c.d) < Math.abs(right - c.d))) { tgtD = left; tS = 0; }
    else if (room(right)) { tgtD = right; tS = 0; }
    if (o.state === 'out' || o.spin) cap = Math.min(cap, target * 0.8 + 8);
  }

  // Entrée des stands (une IA ne rentre plus dans les deux derniers tours, sauf pour la pluie)
  if (c.pitReq && !c.human && R.laps - c.lapsDone - 1 <= 1 && !c.wxNext && !['intermédiaires', 'pneus pluie', 'retour aux slicks'].includes(c.pitReason) && !R.qualiRun && !R.tt) c.pitReq = false;
  if (c.pitReq) {
    const toIn = mod(T.pitIn - s, T.L);
    if (toIn < 320) { tgtD = T.pitSide * (lim + 0.3); tS = 0; }
    // freinage progressif avant la ligne d'entrée : on arrive dans la voie à peine au-dessus de la limite
    if (toIn < 600) cap = Math.min(cap, Math.sqrt((T.pitLimit + 6) ** 2 + 2 * 14 * Math.max(0, toIn - 5)));
    if (toIn < 4 || toIn > T.L - 4) { enterPit(R, c); return; }
  }

  // Neutralisations
  if (R.flag === 'sc' || R.flag === 'sc_in' || R.flag === 'restart') {
    if (!(nb.obst && nb.obstDs < 220)) { tgtD = alpha; tS = aS; }
    let ahead = null, ads = 1e9;
    for (const o of R.cars) if (o !== c && obstacle(o) && o.state === 'run') { const ds = physDs(T, c, o); if (ds > 0 && ds < ads) { ads = ds; ahead = o; } }
    const scDs = R.sc ? mod(R.sc.s - c.s, T.L) : 1e9;
    const leaderLike = R.sc && scDs < ads && scDs < 600;
    const refV = leaderLike ? R.sc.v : ahead ? ahead.v : 0;
    const gapM = leaderLike ? scDs : ads;
    const s0 = R.flag === 'restart' ? 9 : 16;
    if (gapM < 700) cap = Math.min(cap, Math.sqrt(Math.max(0, refV * refV + 2 * 7 * (gapM - CAR_LEN - s0))) + (gapM > 60 ? 6 : 0));
    const scPace = R.flag === 'restart' && c.pos === 1 ? 0.5 : 0.62;
    if (R.flag !== 'restart' || c.pos === 1) cap = Math.min(cap, target * scPace + (gapM > 150 && R.flag !== 'restart' ? target * 0.25 : 0));   // loin derrière : on recolle vite
  } else if (R.flag === 'vsc' || R.flag === 'vsc_end') {
    cap = Math.min(cap, target * 0.6);
  }
  // Drapeaux jaunes locaux
  for (const y of R.yellows) {
    const rel = mod(y.s - s, T.L);
    if (rel < 250 || rel > T.L - 60) { cap = Math.min(cap, target * 0.93); if (ai.mode === 'attack') ai.mode = 'line'; }
  }

  // Sortie des stands : la voiture qui sort garde sa voie le long du bord (ligne de sortie) tant qu'elle n'est pas dégagée,
  // et les voitures en piste laissent cette voie libre quand quelqu'un sort
  const exitLane = lim + 0.3, keepOut = exitLane - CAR_WID - 0.6;
  if (c.blend > 0) {
    c.blend -= c.v * dt;
    const busy = R.cars.some(o => o !== c && active(o) && !o.blend && Math.abs(physDs(T, c, o)) < CAR_LEN + 6 + Math.max(0, o.v - c.v) * 1.5 && o.d * T.pitSide > keepOut - CAR_WID);
    if (busy && c.blend < 0) c.blend = 1;   // on attend que la voie soit libre avant de rejoindre la trajectoire
    // ... sauf s'il faut contourner une voiture lente ou arrêtée devant dans cette voie
    const blocked = R.cars.some(o => o !== c && !o.gone && !o.ghost && o.state !== 'pit' && o.d * T.pitSide > keepOut - 0.5 && physDs(T, c, o) > 0 && physDs(T, c, o) < 40 + Math.max(0, c.v - o.v) * 2);
    if (c.blend > 0 && !blocked) { tgtD = T.pitSide * exitLane; tS = 0; if (ai.mode === 'attack') ai.mode = 'line'; }
  } else if (!c.pitReq && (c.d * T.pitSide > keepOut || tgtD * T.pitSide > keepOut)) {
    const zone = R.cars.some(o => o !== c && !o.gone && o.state !== 'out' && (o.blend > 0 || (o.state === 'pit' && o.pitPhase === 2 && mod(o.s - T.pitIn, T.L) > T.pitLen - 170))
      && physDs(T, c, o) > -CAR_LEN - 4 && physDs(T, c, o) < 260);
    if (zone && tgtD * T.pitSide > keepOut) { tgtD = T.pitSide * keepOut; tS = 0; }
  }
  // Protection latérale : ne jamais braquer sur une voiture à côté
  if (!(ai.reckless > 0) && !(c.blind > 0)) {
    for (const sd of c.nb.side) {
      const need = CAR_WID + (Math.abs(sd.ds) < CAR_LEN ? 0.4 : 0.6);
      const vs = 0;
      if (c.d >= sd.o.d) { if (sd.o.d + need > tgtD) { tgtD = sd.o.d + need; tS = vs; } }
      else if (sd.o.d - need < tgtD) { tgtD = sd.o.d - need; tS = vs; }
    }
  }
  if (R.forceOff != null) { tgtD = R.forceOff === 'c' ? 0 : alpha + R.forceOff; tS = R.forceOff === 'c' ? 0 : aS; }
  const edgeT = c.pitReq ? T.w / 2 + 0.4 : Math.max(lim + 0.35, T.lineLim + 0.25);   // on ne se laisse pas pousser hors de la piste
  if (Math.abs(tgtD) > edgeT) { tgtD = Math.sign(tgtD) * edgeT; tS = 0; }

  // Suivi de la voiture devant dans la même trajectoire
  if (nb.lane && (R.flag !== 'sc' && R.flag !== 'sc_in' || nb.lane.state === 'out' || nb.lane.spin)) {
    const o = nb.lane, gap = nb.laneDs - CAR_LEN;
    const s0 = 1.2 + 0.1 * c.v * (1.1 - c.aggr * 0.3) + R.wet * 2;   // gerbe d'eau : un peu plus d'espace (×8 avant : le peloton s'étirait trop au départ sous la pluie)
    // freinage réellement disponible : réduit si la voiture tourne déjà (cercle d'adhérence, avec la réserve du pilote)
    const luNow = Math.min(1, (c.latA || 0) / latAccel(Math.max(c.v, 1), muC, m) * (TUNE.AIRES || 1.25));
    const ab = 0.85 * brakeDecel(c.v, m, gfL) * Math.sqrt(Math.max(0.15, 1 - luNow * luNow));
    const vo = o.tgtV != null ? Math.min(o.v, Math.max(o.tgtV, o.v - 6)) : o.v;   // la voiture devant va freiner : on s'y attend
    const vc = gap > s0 ? Math.sqrt(vo * vo + 2 * ab * (gap - s0)) : vo - (s0 - gap) * 0.8;
    cap = Math.min(cap, vc);
  }

  // --- vitesse cible : anticipation sur la trajectoire que la voiture va réellement suivre ---
  {
    let tv = 1e9;
    for (const la of LOOK) {
      const sj = s + la - c.errShift;
      const kj = at(T, T.kRL, sj), aj = at(T, T.alpha, sj);
      let vj = at(T, T.env, sj) * gScale;
      // deux hypothèses : la voiture atteint sa cible, ou reste bloquée à sa position actuelle
      const kcj = at(T, T.kS, sj);
      for (const dj of la === 0 ? [c.d] : la <= 15 ? [clamp(tgtD + tS * la, -T.w / 2, T.w / 2), c.d] : [clamp(tgtD + tS * la, -T.w / 2, T.w / 2)]) {
        let kEff = Math.abs(kj / clamp(1 - kj * (dj - aj), GEO_LO, GEO_HI));
        // hors de la ligne, une trajectoire à écart constant suit la courbure de l'axe de la piste
        if (Math.abs(dj - aj) > (c.quali && !TUNE.HLRACE ? (TUNE.KT || 3) : 0.6)) kEff = Math.max(kEff, Math.abs(kcj / clamp(1 - kcj * dj, GEO_LO, GEO_HI)));
        if (kEff > Math.abs(kj) && Math.abs(kj) > 1 / 1500) vj = Math.min(vj, cornerSpeed(kEff, muT, CLA_Z, m) * massF * 0.995);
      }
      const lu = Math.min(1, vj * vj * Math.abs(kj) / latAccel(vj, muT, m));   // freinage réduit si on tourne déjà (cercle d'adhérence)
      const vr = la === 0 ? vj : Math.sqrt(vj * vj + 2 * (c.quali && !TUNE.HLRACE ? (TUNE.BK || 0.96) : 0.85 + 0.08 * R.wet) * brakeDecel(vj, m, gfL) * (c.quali && !TUNE.HLRACE ? Math.sqrt(Math.max(TUNE.BL || 0.6, 1 - 0.35 * lu * lu)) : Math.sqrt(Math.max(0.15, 1 - (TUNE.LUK || 1.6) * lu * lu))) * la);
      if (vr < tv) tv = vr;
    }
    const f = target / Math.max(1, at(T, T.env, s - c.errShift) * gScale);   // réductions déjà appliquées (crevaison, hors-piste…)
    target = tv * Math.min(1, f);
  }
  // vitesse réellement tenable sur la trajectoire actuelle (évite de dépasser l'adhérence)
  {
    const kNow = Math.abs(kr / clamp(1 - kr * e0, GEO_LO, GEO_HI));
    if (kNow > 1 / 1500) target = Math.min(target, cornerSpeed(kNow, muT, CLA_Z, m) * massF * 0.99);
    if (c.latSat > (TUNE.LS || 0.3)) target = Math.min(target, c.v * 0.97);   // le pilote lève le pied s'il ne peut pas tourner
  }
  }   // fin de la partie IA
  // crevaison : la voiture se traîne (≈ deux fois le temps au tour normal)
  if (c.puncture) cap = Math.min(cap, at(T, T.env, s) * gScale / Math.sqrt(Math.max(0.3, 1 - tyreLoss(c.tyre, c.wear))) * PUNCT_F);
  // --- longitudinal ---
  let hThr = H ? H.thr : 0, hBrk = H ? H.brk : 0;
  if (H) {
    target = 1e9;
    if (c.assistV && R.level.brake !== 'off') {
      const lim2 = R.level.brake === 'auto' ? c.assistV : c.assistV * 1.05;
      if (c.v > lim2) { hBrk = Math.max(hBrk, clamp((c.v - lim2) / 4, 0.35, 1)); hThr = 0; }
      if (R.level.brake === 'auto') target = c.assistV;
    }
    // neutralisation : le limiteur freine réellement (impossible de doubler ou de dépasser la Safety Car en roue libre)
    if (c.v > cap + 0.5) { hBrk = Math.max(hBrk, clamp((c.v - cap) / 5, 0.25, 1)); hThr = 0; }
  }
  target = Math.min(target, cap);
  if (!started) target = 0;
  c.tgtV = target;   // vitesse visée : la voiture qui suit anticipe ainsi un freinage plus précoce (pneus usés)
  const aero = T.xm[i0] && !c.offTrack && R.flag !== 'sc' ? 1 : 0;
  c.xmode = !!aero;
  const cla = aero ? CLA_X : CLA_Z, cda = (aero ? CDA_X : CDA_Z) * c.cdaF * (1 - nb.tow) * (1 + c.damage * 0.05);
  const v = c.v, drag = 0.5 * RHO * cda * v * v + 0.012 * m * G;
  // mode Overtake : activé automatiquement si disponible et en attaque / ligne droite
  c.otActive = c.otAvail && c.otE > 0 && (H ? !!H.ot : (ai.mode === 'attack' || nb.aheadDs < 120)) && R.flag === 'green';
  let a;
  const accel = H ? (started && hBrk <= 0 && hThr > 0 && v < target - 0.05) : v < target - 0.05;
  if (accel) {
    const elapsed = R.t - c.reaction;
    const launch = elapsed < 4 && c.lapsDone < 0 ? c.launch : 1;
    const pe = ersPower(c, v);
    const P = (ICE_ONLY ? P_THERM : P_ICE) * c.pf + pe;
    const trac = MU * gfL * launch * (m * G * 0.64 + 0.5 * RHO * cla * v * v * 0.5);
    const F = Math.min(P / Math.max(v, 3), trac);
    a = ((H ? hThr : 1) * F - drag) / m;
    a = Math.min(a, (target - v) / dt);
    const used = Math.max(0, a * m + drag) * v;  // puissance réellement utilisée
    const eUse = Math.min(pe, Math.max(0, used - P_ICE * c.pf * 0.95)) * dt;
    if (eUse > 0) {
      if (c.otActive && c.otE > 0) { const u = Math.min(c.otE, eUse); c.otE -= u; c.soc -= eUse - u; }
      else c.soc -= eUse;
      if (c.soc < 0) c.soc = 0;
    }
    // « superclipping » : en fin de ligne droite le MGU-K recharge sur le moteur thermique
    c.clip = false;
    const hm = H ? H.ers : 'ai';
    const clipOn = hm === 'charge' ? v > 30 && c.soc < SOC_MAX : hm === 'attack' ? false : v > 72 && c.soc < 3.0e6;
    if (clipOn && !ICE_ONLY && !c.otActive && !c.quali && c.harvLap < HARVEST_LAP && a > 0) {
      const pc = hm === 'charge' ? 300e3 : 200e3, ph = pc * dt; c.soc += ph; c.harvLap += ph; c.clip = true;
      a -= pc / Math.max(v, 3) / m;
    }
    c.throttle = clamp(a > 0 ? (a * m + drag) / (P / Math.max(v, 3)) : 0.1, 0, 1); c.brake = 0;
  } else {
    const baseNow = v * v * Math.abs(kr / clamp(1 - kr * e0, GEO_LO, GEO_HI));
    // cercle d'adhérence : le freinage disponible dépend de l'accélération latérale réelle (y compris le braquage hors trajectoire)
    // même voiture pour tous : le freinage disponible dépend de l'accélération latérale réelle (cercle d'adhérence)
    const latUse = Math.max(baseNow, TUNE.FC === 0 || TUNE.NOLAT ? 0 : c.latA || 0) / latAccel(v, muC, m);
    const amax = brakeDecel(v, m, gfL) * Math.sqrt(Math.max(0.08, 1 - latUse * latUse)) + (c.offTrack && !T.street ? 3 : 0);
    // le pilote de l'IA appuie sur la même pédale que le joueur : juste ce qu'il faut pour atteindre sa vitesse cible
    // en virage, il garde une réserve d'adhérence pour tourner (freinage dégressif), comme un pilote qui ne bloque pas ses roues
    let brk = Math.max(0, hBrk);
    if (!H) {
      const need = (v - target) / dt - drag / m - 0.6;   // décélération à ajouter à la traînée et au frein moteur
      const lu = Math.min(1, latUse * (TUNE.AIRES || 1.25)), room = Math.sqrt(Math.max(0.08, 1 - lu * lu)) / Math.sqrt(Math.max(0.08, 1 - latUse * latUse));
      brk = need > 0 ? clamp(need / Math.max(1, amax), 0, Math.min(1, room)) : 0;
    }
    a = v > 0.05 ? -(amax * brk + drag / m + 0.6) : 0;
    c.brake = brk;
    const pw = Math.min(P_K, -a * m * v * 0.85) * dt;
    if (!ICE_ONLY && c.harvLap < HARVEST_LAP && pw > 0) { const h = Math.min(pw, HARVEST_LAP - c.harvLap, SOC_MAX - c.soc); c.soc += h; c.harvLap += h; }
    c.brake = clamp(-a / (4 * G), 0, 1); c.throttle = 0;
  }
  c.v = Math.max(0, v + a * dt); c.a = a;

  // --- dynamique latérale (repère de la ligne idéale) ---
  // courbure de trajectoire = courbure de la ligne corrigée de l'écart + accélération latérale relative
  const vv = Math.max(c.v, 0.5);
  let e = e0, ed = c.vd - aS * vv;
  const kE = kr / clamp(1 - kr * e, GEO_LO, GEO_HI);
  const base = vv * vv * kE;                    // accélération centripète nécessaire (signée)
  const aAvail = latAccel(vv, muC * 1.03, m);    // marge de 3 % sur la limite
  const ratio = Math.abs(base) / aAvail;
  const rel = clamp(1.2 + c.v * 0.03, 1.2, 2.8);
  // consigne exprimée par rapport à la ligne idéale : suivre la ligne ne demande aucune correction
  let edDes = (tS - aS) * vv + clamp((tgtD - c.d) * 1.6, -rel, rel);
  let edd = clamp((edDes - ed) / 0.15, -80, 80);
  if (H) {
    const st = clamp(H.steer || 0, -1, 1);          // -1 gauche … +1 droite (écran)
    if (H.assist === 'on') {                       // direction assistée : la voiture suit la courbe, le doigt la décale
      edDes = -st * clamp(3 + c.v * 0.045, 3, 7.5) - aS * vv;
      edd = clamp((edDes - ed) / 0.2, -80, 80);
    } else if (H.assist === 'semi') {              // semi-assistée : la voiture suit ~65 % de la courbe, le doigt ajoute ou retire du braquage
      const kMax = Math.min(1 / 12, 1.1 * aAvail / (vv * vv));
      edd = vv * vv * (-st * kMax) - base * 0.35;
      // on amortit la dérive latérale pour que la voiture reste stable sans correction permanente
      edd -= ed * 0.6;
      const dem = Math.abs(base + edd);
      if (dem > 1.35 * aAvail && c.v > 25 && Math.random() < dt * 1.2) startSpin(R, c, 'perd le contrôle');
    } else {                                       // direction libre : le doigt commande la courbure
      const kMax = Math.min(1 / 9, 1.3 * aAvail / (vv * vv));
      edd = vv * vv * (-st * kMax) - base;
      if (Math.abs(st) * kMax * vv * vv > 1.3 * aAvail && c.v > 25 && Math.random() < dt * 1.5) startSpin(R, c, 'perd le contrôle');
    }
  }
  // cercle d'adhérence : |base + ë| <= aAvail ; sinon la voiture élargit (sous-virage)
  // le pilote peut dépasser légèrement la limite pour corriger sa trajectoire, au prix de vitesse (dérive des pneus)
  // cercle d'adhérence : en freinant fort, il reste moins d'adhérence pour tourner
  const longUse = TUNE.FC === 0 || c.a >= 0 ? 0 : clamp(-c.a / Math.max(1, brakeDecel(c.v, m, gfL)), 0, 1);
  const lk = longUse * (TUNE.FCK || 0.8), aCorr = aAvail * (TUNE.AC || 1.1) * Math.sqrt(Math.max(0.2, 1 - lk * lk));   // même limite pour tous : on ne « tire » pas sur les pneus au-delà de 10 %

  const lo = -aCorr - base, hi = aCorr - base;
  const eddWanted = edd;
  if (lo <= hi) edd = clamp(edd, lo, hi); else edd = base > 0 ? hi : lo;
  c.latSat = Math.min(1, Math.abs(eddWanted - edd) / 10);
  c.latA = Math.abs(base + edd);
  // au-delà de l'adhérence, les pneus glissent : la marge sert à corriger, pas à aller plus vite (frottement proportionnel à la glisse réelle)
  const over = Math.abs(base + edd) - aAvail;
  if (over > 0) c.v -= over * (TUNE.SO || 1.5) * dt;
  if (c.offTrack && !T.street) edd *= 0.6;
  if (ratio > 1.0) c.v -= (ratio - 1) * aAvail * (TUNE.SK || 0.4) * dt;       // frottement en glissade
  const spinAt = 1.18 - 0.08 * R.wet;   // sous la pluie, la voiture décroche plus vite
  if (ratio > spinAt && Math.random() < (ratio - spinAt) * 2.5 * dt) startSpin(R, c, 'tête-à-queue');
  ed += edd * dt;
  if (c.v < 1) ed *= 0.5;
  // « laisser la place » : on ne se rabat pas sur une voiture à côté (sauf glissade ou erreur)
  if (!H && ratio < 1 && !(ai.reckless > 0) && !(c.blind > 0)) {
    let vdN = ed + aS * vv;
    for (const sd of nb.side) {
      if (Math.abs(sd.ds) > CAR_LEN + 1 || sd.o.state === 'pit') continue;
      const sg = Math.sign(sd.dd) || 1, gap = Math.abs(sd.dd) - CAR_WID;
      const allowed = Math.max(0, (gap - 0.35) * 3);
      // on limite seulement notre propre mouvement vers l'autre voiture (jamais « poussé » par elle)
      const cap = Math.max(0, sd.o.vd * sg + allowed);
      if (vdN * sg > cap) vdN = sg * cap;
    }
    // bord de piste : le pilote ne sort pas volontairement
    if (!c.pitReq) {
      const sgE = Math.sign(c.d) || 1, room = (lim + 0.5) - Math.abs(c.d);
      const capE = Math.max(0, room * 3);
      if (vdN * sgE > capE) vdN = sgE * capE;
    }
    ed = vdN - aS * vv;
  }
  e += ed * dt;
  c.e = e; c.ed = ed; c.latG = (base + edd) / G;

  if (R.trace) { (c.tr || (c.tr = [])).push([R.t.toFixed(2), c.s.toFixed(1), c.d.toFixed(2), c.vd.toFixed(2), tgtD.toFixed(2), 'tS' + tS.toFixed(3), 'aS' + aS.toFixed(3), 'ob' + (nb.obst ? nb.obst.code : '-'), 'pit' + (c.pitReq ? 1 : 0), (c.v * 3.6).toFixed(0), ai.mode, brk, ratio.toFixed(3), c.nb.side.map(x => x.o.code + ':' + x.ds.toFixed(1) + '/' + x.dd.toFixed(1)).join(' '), 'tg' + (target * 3.6).toFixed(0), 'gf' + gf.toFixed(3), 'a' + (a / G).toFixed(2), c.tyre, 'err' + c.errShift.toFixed(0), 'dirty' + c.dirtyS.toFixed(3)]); if (c.tr.length > 90) c.tr.shift(); }
  const cosT = Math.sqrt(1 - Math.min(0.5, (ed / vv) * (ed / vv)));
  const dsv = c.v * dt * cosT / clamp(1 - kr * e, GEO_LO, GEO_HI) * at(T, T.prog, s);
  advance(R, c, dsv, dt);
  const a2 = at(T, T.alpha, c.s), aS2 = (at(T, T.alpha, c.s + 2) - at(T, T.alpha, c.s - 2)) / 4;
  c.d = a2 + c.e; c.vd = c.ed + aS2 * vv;
  worldGrip(R, c, dt, aAvail);
  wallsAndSpin(R, c, dt);
  if (c.human && R.level && R.level.limits && !R.qualiRun && !R.tt) trackLimits(R, c);
  if (c.human && R.recGhost && c.samples && c.lapsDone >= 0) {
    const tt = R.t - c.lapStartT, S = c.samples;
    if (!S.length || tt - S[S.length - 1][0] >= 0.05) S.push([+tt.toFixed(3), +(c.dist - c.lapsDone * T.L).toFixed(2), +c.d.toFixed(2), +Math.atan2(c.vd, Math.max(c.v, 3)).toFixed(3)]);
  }
}

/* Limites de piste : les 4 roues dehors = infraction ; toutes les 3 infractions, 5 s de pénalité */
function trackLimits(R, c) {
  const T = R.T, a = Math.abs(c.d);
  if (c.state !== 'run' || c.spin) return;
  if (!c.tlOff && a > T.w / 2 + 1.0) {
    c.tlOff = true; c.tl = (c.tl || 0) + 1;
    const n = R.level.tlEvery || 3;   // infractions par pénalité (strict 3, indulgent 6)
    if (c.tl % n === 0) {
      c.penalty = (c.penalty || 0) + 5;
      note(R, 'penalty', `PÉNALITÉ de 5 s pour ${c.code} : limites de piste (${c.tl} infractions)`, [c.id]);
    } else note(R, 'error', `Limites de piste pour ${c.code} (${c.tl % n}/${n})${c.tl % n === n - 1 ? ' · drapeau noir et blanc' : ''}`, [c.id]);
  } else if (c.tlOff && a < T.w / 2) c.tlOff = false;
}

/* Contrôle de l'adhérence sur la trajectoire réelle (géométrie de la piste, pas la ligne de référence lissée) :
   au-delà de la limite, les pneus glissent et la voiture perd de la vitesse. Joueur toujours ; IA en tour seul (qualif). */
function worldGrip(R, c, dt, aAvail) {
  if (!TUNE.WG || !(c.human || c.quali)) return;   // désactivé : la géométrie GPS n'est pas assez lisse pour une courbure exacte
  const w = worldPos(R.T, c.s, c.d), P = c.wpts || (c.wpts = []);
  const last = P[P.length - 1];
  if (!last || Math.hypot(w.x - last.x, w.y - last.y) >= 3) { P.push({ x: w.x, y: w.y }); if (P.length > 3) P.shift(); }
  if (P.length < 3 || c.v < 8) { c.latW = 0; return; }
  const [a, b, q] = P;
  const ab = Math.hypot(b.x - a.x, b.y - a.y), bq = Math.hypot(q.x - b.x, q.y - b.y), aq = Math.hypot(q.x - a.x, q.y - a.y);
  const cross = Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x));
  const k = ab * bq * aq > 1e-6 ? 2 * cross / (ab * bq * aq) : 0;   // courbure du cercle passant par les 3 derniers points
  const lat = c.v * c.v * k; c.latW = lat;
  const lim = aAvail * (TUNE.WGM || 1.05);
  if (lat > lim) {
    // les pneus décrochent : la voiture ne peut pas aller plus vite que ce que permet la courbe réellement suivie
    const vmax = Math.sqrt(lim / k);
    c.v = Math.max(5, TUNE.WGK ? c.v - (lat - lim) * TUNE.WGK * dt : Math.max(vmax, c.v - 40 * dt));
    c.wgHits = (c.wgHits || 0) + 1;
  }
}

function wallsAndSpin(R, c, dt) {
  const T = R.T;
  // hors piste / murs
  const edge = T.w / 2;
  c.offTrack = Math.abs(c.d) > edge + 0.6;
  const wallD = T.street ? edge + 1.6 : edge + 17;
  if (Math.abs(c.d) > wallD - CAR_WID / 2) {
    const imp = Math.abs(c.vd) + c.v * 0.02;
    c.d = Math.sign(c.d) * (wallD - CAR_WID / 2);
    if (imp > (T.street ? 4.5 : 6)) { retire(R, c, 'accident dans le mur', true); return; }
    if (imp > 1.5) shockSlow(c, imp, 1, 0.08);   // le mur freine selon la violence du choc
    if (imp > 1.5 && (R.noDnf || R.dmgLite)) { if (R.dmgLite) note(R, 'contact', `${c.code} touche le mur !`, [c.id]); }   // sans dégâts
    else if (imp > 1.5) {
      c.damage = Math.min(1, c.damage + 0.35);
      if (c.damage >= 0.45) { c.pitReq = true; c.pitReason = 'dégâts'; }
      note(R, 'contact', `${c.code} touche le mur !`, [c.id]);
    }
    c.vd = -c.vd * 0.3;
  }
  if (c.offTrack && !T.street && Math.abs(c.d) > edge + 2 && Math.random() < 0.08 * dt * (c.v / 50)) startSpin(R, c, 'part dans le gravier');

  // tête-à-queue en cours
  // la voiture pivote (de 120 à 200°) en glissant et en perdant toute sa vitesse, puis le pilote la remet dans le bon sens et repart
  if (c.spin) {
    const sp = c.spin; sp.t += dt;
    if (sp.t < sp.dur) {
      const u = sp.t / sp.dur, e = 1 - (1 - u) * (1 - u);
      c.yaw = sp.dir * sp.ang * e;
      c.v = Math.max(sp.t > sp.dur * 0.6 ? 0 : 2, c.v - (8 + 10 * Math.abs(Math.sin(c.yaw))) * dt);   // de travers, la voiture freine fort
      c.vd += sp.out * 2.2 * dt * Math.min(1, c.v / 20);                                                  // elle glisse vers l'extérieur
    } else {
      const u = Math.min(1, (sp.t - sp.dur) / sp.back), e = u * u * (3 - 2 * u);
      c.yaw = sp.dir * sp.ang * (1 - e);
      c.v = Math.min(c.v, 3 + 8 * u);                                                                      // demi-tour au ralenti
    }
    if (sp.t >= sp.dur + sp.back) {
      c.spin = null; c.yaw = 0;
      if (c.offTrack && !T.street && Math.random() < 0.18) { retire(R, c, 'bloqué dans le gravier', false); return; }
    }
  }

}

function advance(R, c, dsv, dt) {
  const T = R.T;
  const prevLap = Math.floor(c.dist / T.L);
  c.dist += dsv; c.s = mod(c.dist, T.L);
  // usure pneus / carburant
  const dirt = c.offTrack ? 3 : 1;
  const wxWear = COMP[c.tyre].wet ? 1 + Math.max(0, 0.2 - R.wet) * 20 : 1 - 0.3 * R.wet;   // pneus pluie qui surchauffent sur le sec
  c.wear += dsv * R.T.tyre.deg / (COMP[c.tyre].life * R.wearDist) * c.wearF * dirt * wxWear * (c.ai.mode === 'attack' ? 1.12 : 1) * (R.flag === 'green' ? 1 : 0.3);
  c.warm = Math.max(0, c.warm - dsv / (WARM_DIST[c.tyre] || 2500));
  if (c.wear >= 1 && !c.puncture && c.state === 'run') {   // pneu usé à 100 % : crevaison
    c.puncture = true; c.pitReq = true; c.pitReason = 'crevaison'; note(R, 'contact', `Crevaison pour ${c.code} !`, [c.id]); }
  c.fuel = Math.max(1, c.fuel - R.fuelPerLap * dsv / T.L);
  timing(R, c);
  const lap = Math.floor(c.dist / T.L);
  if (lap > prevLap) crossLine(R, c, lap);
  // pneus
  if (!c.pitReq && c.state === 'run') decidePit(R, c);
}

function timing(R, c) {
  const T = R.T;
  if (c.dist < 0) return;
  const loop = Math.floor(c.dist / 50);
  if (loop !== c.loopKey) {
    c.loopKey = loop; c.loopT = R.t;
    if (!R.firstPass.has(loop)) R.firstPass.set(loop, R.t);
  }
}

function crossLine(R, c, lap) {
  const T = R.T;
  c.lapsDone = lap;
  if (lap >= 1) {
    const lt = R.t - c.lapStartT;
    c.lastLap = lt; c.laps.push(lt); c.cross[lap] = R.t;   // instant de passage sur la ligne (graphique des positions)
    if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
    if (R.flag === 'green' && (!R.fastest || lt < R.fastest.t) && lap >= 2) {
      R.fastest = { id: c.id, t: lt, lap };
      note(R, 'fastest', `Meilleur tour : ${c.code} ${fmtLap(lt)}`, [c.id]);
    }
  }
  c.lapStartT = R.t;
  // qualif : batterie pleine en début de tour lancé pour tout le monde (rechargée pendant le tour de lancement)
  if (c.quali && lap === 0) { c.soc = SOC_MAX; c.harvLap = 0; }
  if (c.human && R.recGhost) { c.prevSamples = c.samples || null; c.samples = []; }
  c.harvLap = 0;
  // Détection mode Overtake (à moins d'1 s de la voiture devant sur la ligne)
  c.otAvail = false; c.otE = 0;
  if (!ICE_ONLY && lap >= 2 && R.flag === 'green') {
    const ahead = R.cars.filter(o => o !== c && o.state === 'run' && o.dist > c.dist).sort((a, b) => a.dist - b.dist)[0];
    if (ahead && ahead.loopKey >= 0 && (R.t - ahead.loopT) + (ahead.dist - c.dist) / Math.max(ahead.v, 10) < 1.0) {
      c.otAvail = true; c.otE = OT_BONUS;
    }
  }
  if (c.human && !c.fin && missedCompound(R, c) && R.laps - lap <= 3 && R.laps - lap >= 1 && lap >= 1)
    note(R, 'penalty', `Changement de pneus obligatoire : passe aux stands pour un autre type de pneu (${R.laps - lap} tour${R.laps - lap > 1 ? 's' : ''} restant${R.laps - lap > 1 ? 's' : ''}), sinon disqualification`, [c.id]);
  // fin de course
  if (!R.leaderDone && lap >= R.laps) {
    R.leaderDone = true; R.finishedAt = R.t;
    const pen = c.penalty || 0, dsq = missedCompound(R, c);
    if (!pen && !dsq) { R.winnerId = c.id; note(R, 'finish', `DRAPEAU À DAMIER ! ${c.driver.name} remporte le Grand Prix !`, [c.id]); }
    else note(R, 'finish', `DRAPEAU À DAMIER ! ${c.code} passe la ligne en tête, mais ${dsq ? 'risque la disqualification (un seul type de pneu)' : `a ${pen} s de pénalité`} : vainqueur à confirmer…`, [c.id]);
  }
  if (R.leaderDone && !c.fin) {
    c.fin = true; c.finGhost = true; c.finishT = R.t; c.finLaps = lap;
    // ordre d'arrivée : d'abord le nombre de tours, puis l'ordre de passage (une voiture à 1 tour qui coupe la ligne
    // juste après le vainqueur ne doit pas passer devant celles du tour du leader encore en piste)
    let k = R.finishOrder.length;
    while (k > 0 && (R.cars[R.finishOrder[k - 1]].finLaps ?? R.laps) < lap) k--;
    R.finishOrder.splice(k, 0, c.id);
  }
}
/* vainqueur confirmé une fois que plus personne ne peut faire mieux, pénalités de temps comprises */
function confirmWinner(R) {
  if (!R.leaderDone || R.winnerId != null) return;
  let best = null, bt = 1e9;
  for (const id of R.finishOrder) { const c = R.cars[id]; if (c.state === 'out' || missedCompound(R, c) || (c.finLaps ?? R.laps) < R.laps) continue; const t = c.finishT + (c.penalty || 0); if (t < bt) { bt = t; best = c; } }
  const allIn = R.cars.every(c => c.fin || c.state === 'out' || c.gone);
  if (best && (R.t >= bt || allIn)) {
    R.winnerId = best.id;
    const first = R.cars[R.finishOrder[0]];
    note(R, 'finish', best === first ? `${best.driver.name} remporte le Grand Prix malgré sa pénalité !` : `${best.driver.name} remporte le Grand Prix après la pénalité de ${first.code} !`, [best.id]);
  }
}

/* règlement : en course sèche, chaque pilote doit utiliser au moins deux types de slicks (sinon disqualifié) */
function missedCompound(R, c) {
  return R.laps >= 5 && !R.qualiRun && !R.tt && c.usedComps.size < 2 && !c.usedComps.has('I') && !c.usedComps.has('W');
}
function decidePit(R, c) {
  const T = R.T, prog = c.dist / R.raceDist, remLaps = R.laps - c.lapsDone - 1;
  if (remLaps < 1 || prog < 0) return;
  // usure prévue à l'arrivée si on ne s'arrête plus (l'équipe anticipe pour ne jamais aller jusqu'à la crevaison)
  // pneus pluie qui surchauffent quand la piste sèche (l'équipe anticipe le séchage du tour suivant)
  const wetNext = R.wx && R.wx.rain < R.wet ? Math.max(R.wx.rain, R.wet - 0.0022 * T.L / 50) : R.wet;
  const wxW = COMP[c.tyre].wet ? 1 + Math.max(0, 0.2 - (R.wet + wetNext) / 2) * 20 : 1;
  const wpl = T.L * T.tyre.deg / (COMP[c.tyre].life * R.wearDist) * c.wearF * wxW, wearEnd = c.wear + wpl * Math.max(0, R.laps - c.dist / T.L);
  if (c.human && !c.puncture && c.damage < 0.45) return;   // le joueur décide lui-même (bouton BOX)
  const toIn = mod(T.pitIn - c.s, T.L), sKey = Math.floor((c.dist + toIn) / T.L) + R.flag;
  if (c.sKey !== sKey && R.strat) { c.sKey = sKey; stratDecide(R, c, toIn); }
  const planned = !wetTyre(c) && !!c.sV;   // relais calculés (sur le sec)
  // si on laisse passer cette entrée des stands, le pneu atteindrait-il 100 % (crevaison) avant la suivante ?
  const critical = wearEnd > 0.97 && c.wear + wpl * (mod(T.pitIn - c.s, T.L) / T.L + 1.05) > 0.97;
  c.wxNext = null;
  let why = '';
  const want = bestComp(R.wet + c.wxBias), wetT = !!COMP[c.tyre].wet, wantWet = want !== 'M';
  const swapGain = compGrip(want === 'M' ? 'M' : want, R.wet) / compGrip(c.tyre, R.wet);
  if ((wetT !== wantWet || (wetT && want !== c.tyre)) && swapGain > (remLaps > 1 ? 1.04 : 1.35) && remLaps >= 1)
    why = want === 'I' ? 'intermédiaires' : want === 'W' ? 'pneus pluie' : 'retour aux slicks';
  if (why) c.wxNext = want === 'M' ? null : want;
  else if (remLaps <= 1 && !(c.wear > 0.85 && wearEnd >= 0.99) && !critical) return;   // dans les deux derniers tours, on ne rentre plus (on finit avec ses pneus, même abîmés)
  else if (c.puncture) why = 'crevaison';
  else if (c.damage >= 0.45) why = 'dégâts';
  else if (!wetT && R.wet < 0.15 && c.boxNow) why = R.flag === 'green' ? 'stratégie' : 'arrêt sous neutralisation';
  else if (planned ? critical || (c.wear > 0.92 && wearEnd > 0.99) : (remLaps >= 3 && ((wearEnd > 0.97 && (c.wear > 0.72 || remLaps <= 4)) || (c.wear > 0.88 && wearEnd > 0.95))) || (wearEnd >= 0.99 && c.wear > 0.85) || critical) why = 'pneus usés';   // jamais jusqu'à 100 % (crevaison)
  else if (missedCompound(R, c) && remLaps <= 2) why = 'obligatoire';
  if (!why) return;
  // pas d'arrêt si l'entrée est trop proche (ou à peine passée : on attend la suivante)
  if (toIn < 330 || toIn > T.L - 12) return;
  // arrêts séparés dans une même écurie : on attend que le coéquipier soit ressorti, sauf urgence
  // (crevaison, dégâts, pluie) ou sous neutralisation, où le double arrêt vaut le coup
  const mate = R.cars.find(o => o !== c && o.team.name === c.team.name && o.state !== 'out');
  const urgent = why === 'crevaison' || why === 'dégâts' || why === 'intermédiaires' || why === 'pneus pluie' || why === 'retour aux slicks' || why === 'arrêt sous neutralisation' || c.wear > 0.9 || critical || (missedCompound(R, c) && remLaps <= 3);   // dernière occasion de chausser le 2e type de slicks
  if (mate && (mate.state === 'pit' || mate.pitReq) && !urgent) return;
  c.pitReq = true; c.pitReason = why;
}

function enterPit(R, c) {
  const T = R.T;
  c.state = 'pit'; c.pitPhase = 0; c.inPitLane = true; c.ai.mode = 'line'; c.offTrack = false;
  const next = autoTyre(R, c);
  if (R.wet >= 0.2 || c.wxNext || COMP[c.tyre].wet) c.plan = [];
  // le joueur choisit lui-même ses pneus (sinon choix automatique de l'équipe)
  c.nextTyre = c.human && COMP[c.wantTyre] ? c.wantTyre : next;
  c.wantTyre = null;
  c.sKey = null;   // plan recalculé à la sortie des stands
  let st = rnd(2.0, 2.7);
  if (Math.random() < 0.06) st += rnd(1.5, 7);
  if (c.damage >= 0.3) st += 6;
  c.stopDur = st;
  const tIdx = Math.max(0, R.teamOrder.indexOf(c.team.name));
  c.boxPs = 170 + tIdx * 18;
}

/* pneus conseillés par l'équipe pour le prochain arrêt */
function autoTyre(R, c) {
  const remFrac = 1 - c.dist / R.raceDist;
  if (R.wet >= 0.2 || c.wxNext) return c.wxNext || bestComp(R.wet);
  const p = stratNext(R, c);
  if (p) return p;
  let next = remFrac < 0.3 ? 'S' : remFrac < 0.45 ? 'M' : 'H';
  if (COMP[c.tyre].wet) next = remFrac < 0.3 ? 'S' : remFrac < 0.5 ? 'M' : 'H';
  else if (c.usedComps.size < 2 && c.usedComps.has(next)) next = [...'HMS'].find(x => !c.usedComps.has(x) && COMP[x].life >= remFrac * 0.95) || [...'HMS'].find(x => !c.usedComps.has(x));
  return next;
}

function pitStep(R, c, dt) {
  const T = R.T;
  let ps = mod(c.s - T.pitIn, T.L);           // position dans la voie des stands
  if (ps > T.L - 60) ps -= T.L;               // on bascule dans la voie quelques mètres avant la ligne d'entrée
  const lim = T.pitLimit;
  // deux files : voie rapide (côté piste) et voie des garages, où l'on s'arrête
  const FAST = T.pitD - T.pitSide * 2.2, BOX = T.pitD + T.pitSide * 2.8;
  // double arrêt : si le coéquipier occupe encore le garage, on attend juste derrière
  const busy = c.pitPhase === 0 && R.cars.some(o => o !== c && o.state === 'pit' && o.boxPs === c.boxPs && o.pitPhase > 0 && mod(o.s - T.pitIn, T.L) - c.boxPs < CAR_LEN + 4);
  const toBox = c.boxPs - ps - (busy ? CAR_LEN + 6 : 0);
  let lane = FAST;
  // double arrêt : on attend dans la voie des garages, juste derrière le sien, sans gêner la voie rapide
  if (busy) lane = FAST + (BOX - FAST) * smooth01((15 - (c.boxPs - ps)) / 3.6);   // une fois passé le garage précédent
  else if (c.pitPhase === 0 && toBox < 14) lane = FAST + (BOX - FAST) * smooth01((14 - toBox) / 11);   // on se range devant son garage
  else if (c.pitPhase === 1) lane = BOX;
  else if (c.pitPhase === 2) {
    // une voiture arrêtée devant dans la voie des garages (double arrêt en attente) : on la contourne par la voie rapide
    const stuck = R.cars.some(o => o !== c && o.state === 'pit' && o.v < 2 && Math.abs(o.d - BOX) < 1.5 && mod(o.s - c.s, T.L) < CAR_LEN + 14);
    lane = stuck ? FAST : BOX + (FAST - BOX) * smooth01((ps - c.boxPs - 1) / 12);
  }
  // latéral : entrée et sortie en douceur depuis / vers le bord de la piste
  const edge = T.pitSide * (T.lim + 0.3);
  const tgtD = ps < 130 ? edge + (lane - edge) * smooth01((ps - 10) / 120)
            : ps > T.pitLen - 130 ? lane + (edge - lane) * smooth01((ps - (T.pitLen - 130)) / 120) : lane;
  c.d += (tgtD - c.d) * Math.min(1, dt * 2.5);
  c.xmode = false; c.otActive = false;
  let target;
  if (c.pitPhase === 0) { // vers le garage
    target = ps < 120 ? Math.max(lim, Math.sqrt(lim * lim + 2 * 10 * Math.max(0, 110 - ps))) : lim;
    target = Math.min(target, Math.sqrt(Math.max(0, 2 * 7 * toBox)));
    if (toBox <= 0.3 && !busy) { c.pitPhase = 1; c.v = 0; c.stopT = 0; }
  } else if (c.pitPhase === 1) { // arrêt
    c.stopT += dt; target = 0; c.v = 0;
    if (c.stopT >= c.stopDur) {
      c.pitPhase = 2; c.stops++; c.exitWait = 0;
      c.tyre = c.nextTyre; c.usedComps.add(c.tyre); c.wear = 0; c.warm = 1; c.puncture = false;
      if (c.damage >= 0.3) c.damage = 0;
      note(R, 'pit', `${c.code} s'arrête (${c.pitReason}) — ${c.stopDur.toFixed(1)} s · ${COMP[c.tyre].name}`, [c.id]);
      c.pitReq = false;
    }
  } else {
    target = ps > T.pitLen - 90 ? Math.min(60, at(T, T.env, c.s) * 0.95) : lim;
  }
  // circulation dans la voie : pas de superposition, on garde ses distances
  let waitFast = false;
  if (c.pitPhase !== 1) {
    for (const o of R.cars) {
      if (o === c || o.state !== 'pit' || o.gone) continue;
      const gap = mod(o.s - c.s, T.L);
      if (gap > 60) {
        // en sortant du garage, on laisse passer la voiture qui arrive dans la voie rapide
        const back = T.L - gap;
        // (seulement si elle est vraiment proche, et pas plus de 2,5 s : ensuite c'est à elle de ralentir)
        if (c.pitPhase === 2 && ps - c.boxPs < 12 && back < CAR_LEN + 4 + o.v * 0.9 && o.pitPhase !== 1 && o.v > 2 && Math.abs(o.d - BOX) > 1 && c.exitWait < 2.5) { target = Math.min(target, 0); waitFast = true; }
        continue;
      }
      // en sortant du garage, on ne s'élance pas si une voiture est juste devant dans la voie rapide
      if (c.pitPhase === 2 && ps - c.boxPs < 12 && gap < CAR_LEN + 6 && o.pitPhase !== 1 && Math.abs(o.d - BOX) > 1) { target = 0; continue; }
      if (Math.abs(o.d - c.d) > CAR_WID + 0.5 && Math.abs(o.d - tgtD) > CAR_WID + 0.5) continue;
      target = Math.min(target, gap < CAR_LEN + 2.5 ? 0 : o.v + Math.sqrt(2 * 6 * (gap - CAR_LEN - 2.5)));
    }
  }
  if (c.pitPhase === 2) c.exitWait = waitFast ? (c.exitWait || 0) + dt : c.v > 3 ? 0 : c.exitWait || 0;
  // fin de la voie : on ne rejoint pas la piste sur une voiture qui occupe la voie de sortie (on se cale derrière)
  if (c.pitPhase === 2 && ps > T.pitLen - 120) {
    for (const o of R.cars) {
      if (o === c || o.gone || o.state === 'pit' || o.d * T.pitSide < T.lim + 0.3 - CAR_WID - 0.6) continue;   // seulement une voiture dans la voie de sortie
      const ds = physDs(T, c, o);
      if (ds > -4 && ds < CAR_LEN + 6) target = Math.min(target, Math.max(8, o.v - 3));
      else if (o.state === 'out' && !o.ghost && ds > 0 && ds < 80) target = Math.min(target, 14);   // voiture arrêtée à la sortie : on sort au pas
    }
    // on sort à une vitesse qui permet de freiner pour le virage qui suit (ex. Singapour, virage 1 juste après la sortie)
    for (let k = 0; k <= 200; k += 10) target = Math.min(target, Math.sqrt(at(T, T.env, mod(c.s + k, T.L)) ** 2 * 0.85 + 2 * 11 * k));
  }
  const a = c.v < target ? Math.min(9, (target - c.v) / dt) : -Math.min(c.v < 1 ? 50 : 16, (c.v - target) / dt);
  c.v = Math.max(0, c.v + a * dt); c.a = a; c.throttle = a > 0 ? 0.6 : 0; c.brake = a < 0 ? 0.6 : 0;
  const prevLap = Math.floor(c.dist / T.L);
  c.dist += c.v * dt;
  // jamais dans la voiture qui précède dans la voie des stands
  for (const o of R.cars) {
    if (o === c || o.state !== 'pit' || o.gone || Math.abs(o.d - c.d) > CAR_WID) continue;
    const gap = mod(o.s - mod(c.dist, T.L), T.L);
    if (gap < CAR_LEN + 1 && mod(o.s - c.s, T.L) < 60) { c.dist -= CAR_LEN + 1 - gap; c.v = Math.min(c.v, o.v); }
  }
  c.s = mod(c.dist, T.L);
  c.fuel = Math.max(1, c.fuel - R.fuelPerLap * c.v * dt / T.L);
  timing(R, c);
  const lap = Math.floor(c.dist / T.L);
  if (lap > prevLap) crossLine(R, c, lap);
  if (c.pitPhase === 2 && ps >= T.pitLen - 2 && ps < T.pitLen + 50) {
    c.state = 'run'; c.inPitLane = false; c.d = T.pitSide * (T.lim + 0.3); c.vd = 0; c.ai.cool = 3; c.blend = 220;
  }
}

function ghostStep(R, c, dt) { // tour de décélération après l'arrivée
  const T = R.T;
  const target = at(T, T.env, c.s) * 0.55;
  c.v += clamp(target - c.v, -8 * dt, 5 * dt);
  const alpha = at(T, T.alpha, c.s);
  c.d += (alpha - c.d) * Math.min(1, dt);
  c.dist += c.v * dt; c.s = mod(c.dist, T.L);
  c.xmode = false; c.otActive = false; c.throttle = 0.3; c.brake = 0;
}

function startSpin(R, c, why) {
  if (c.spin) return;
  if (c.human && R.level && R.level.stab) { c.v *= 0.85; return; }   // anti tête-à-queue
  c.spin = { t: 0, dur: rnd(1.3, 2), back: rnd(1.2, 1.8), ang: rnd(2.1, 3.5), dir: Math.random() < 0.5 ? 1 : -1, out: c.d >= 0 ? 1 : -1 };
  c.ai.mode = 'line';
  note(R, 'error', `${c.code} : ${why} !`, [c.id]);
  R.yellows.push({ s: c.s, until: R.t + 18 });
}

/* rythme des IA exprimé en part de la limite physique : à 100 % elles exploitent toute l'adhérence de leur voiture (pas de marge de course) */
const paceFromLimit = p => p / Math.sqrt(0.97);
function safeCar(R, c) { return R.noDnf || (!!c.human && !!(R.level && R.level.invincible)); }   // « sans abandon » : vaut pour toutes les voitures
function retire(R, c, why, onTrack) {
  if (c.state === 'out') return;
  if (safeCar(R, c)) {   // mode débutant ou « sans abandon » : la voiture repart
    c.v *= 0.3; c.vd = 0; c.damage = 0; if (c.wear < 1) c.puncture = false;
    note(R, 'contact', c.human ? `${c.code} : gros choc, mais tu repars !` : `${c.code} : gros choc, mais repart`, [c.id]);
    return;
  }
  c.state = 'out'; c.retiredWhy = why; c.spin = null; c.otActive = false; c.xmode = false;
  c.outT = R.t; c.pitReq = false;
  R.incidents++;
  note(R, 'crash', `ABANDON : ${c.driver.name} — ${why}`, [c.id]);
  const T = R.T;
  const blocking = Math.abs(c.d) < T.w / 2 + 1.2 || T.street;
  if (R.flag === 'green' || R.flag === 'vsc' || R.flag === 'vsc_end') {
    const remaining = R.laps - leaderLap(R);
    if (remaining < 1) { R.yellows.push({ s: c.s, until: R.t + 60 }); }
    else if (blocking || Math.random() < 0.35) deploySC(R);
    else if (R.flag === 'green') deployVSC(R);
  }
  if (!blocking) c.recoverT = R.t + rnd(35, 60); else c.recoverT = R.t + rnd(70, 110);
}

function deploySC(R) {
  const T = R.T;
  if (R.flag === 'sc' || R.flag === 'sc_in') { R.scEndT = Math.max(R.scEndT, R.t + 60); return; }
  const leader = R.cars.filter(c => active(c) && !c.finGhost).sort((a, b) => b.dist - a.dist)[0];
  if (!leader) return;
  R.flag = 'sc';
  R.sc = { s: mod(leader.s + 180, T.L), v: Math.max(35, leader.v * 0.7), d: 0 };
  R.scEndT = R.t + rnd(110, 170);
  note(R, 'sc', 'SAFETY CAR DÉPLOYÉE', []);
  for (const c of R.cars) { c.otAvail = false; c.otE = 0; c.ai.mode = 'line'; }
}
function deployVSC(R) {
  R.flag = 'vsc'; R.vscEndT = R.t + rnd(35, 65);
  note(R, 'vsc', 'VIRTUAL SAFETY CAR', []);
  for (const c of R.cars) { c.otAvail = false; c.otE = 0; c.ai.mode = 'line'; }
}

function updateFlags(R, dt) {
  const T = R.T;
  R.yellows = R.yellows.filter(y => y.until > R.t);
  for (const c of R.cars) if (c.state === 'out' && !c.gone && R.t > c.recoverT) c.gone = true;
  // 5 s après l'abandon, la voiture arrêtée devient un fantôme : plus de choc, les autres passent à travers
  for (const c of R.cars) if (c.state === 'out' && !c.ghost && R.t > c.outT + 5) c.ghost = true;
  if (R.flag === 'vsc' && R.t > R.vscEndT && R.cars.every(c => c.state !== 'out' || c.gone || Math.abs(c.d) > T.w / 2 + 1)) {
    R.flag = 'vsc_end'; R.vscEndT = R.t + 7; note(R, 'vsc', 'FIN DU VSC — préparez-vous', []);
  } else if (R.flag === 'vsc_end' && R.t > R.vscEndT) { R.flag = 'green'; note(R, 'green', 'DRAPEAU VERT', []); }
  if (R.flag === 'sc' && R.t > R.scEndT && R.cars.every(c => c.state !== 'out' || c.gone)) {
    R.flag = 'sc_in'; note(R, 'sc', 'SAFETY CAR RENTRE À CE TOUR', []);
  }
  confirmWinner(R);
  if (R.leaderDone) {
    const allDone = R.cars.every(c => c.fin || c.state === 'out' || c.gone);
    if (allDone || R.t - R.finishedAt > 150) { R.over = true; }
  }
}

function scStep(R, dt) {
  const T = R.T, sc = R.sc;
  const leader = R.cars.filter(c => active(c) && !c.finGhost).sort((a, b) => b.dist - a.dist)[0];
  const gapToLeader = leader ? mod(sc.s - leader.s, T.L) : 1e9;
  let target = at(T, T.env, sc.s) * 0.58;
  if (gapToLeader > 120 && gapToLeader < T.L / 2) target *= 0.65;   // attend le leader (facile à rattraper)
  sc.v += clamp(target - sc.v, -12 * dt, 5 * dt);
  sc.s = mod(sc.s + sc.v * dt, T.L);
  sc.d += (at(T, T.alpha, sc.s) - sc.d) * Math.min(1, dt);
  if (R.flag === 'sc_in' && mod(T.pitIn - sc.s, T.L) < 6) {
    R.sc = null; R.flag = 'restart';
    note(R, 'sc', 'Le leader contrôle la relance…', []);
  }
}

function collisions(R) {
  const T = R.T, cars = R.cars;
  if (R.flag === 'restart') {
    const leader = cars.filter(c => active(c) && !c.finGhost).sort((a, b) => b.dist - a.dist)[0];
    if (!leader || leader.s > T.L - 450) {
      R.flag = 'green'; note(R, 'green', 'RELANCE ! Dépassements autorisés après la ligne', []);
      for (const c of cars) c.noAttackLap = c.lapsDone + 1;
    }
  }
  for (let i = 0; i < cars.length; i++) {
    const A = cars[i];
    if (A.gone || A.ghost || A.state === 'pit' || A.finGhost) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const B = cars[j];
      if (B.gone || B.ghost || B.state === 'pit' || B.finGhost) continue;
      if (A.state === 'out' && B.state === 'out') continue;
      const ds = physDs(T, A, B), dd = B.d - A.d;
      if (Math.abs(ds) >= CAR_LEN + 0.6 || Math.abs(dd) >= CAR_LEN + 0.6) continue;
      const hit = carHit(A, B, ds, dd);
      if (hit) contact(R, A, B, ds, dd, hit);
    }
  }
}

/* pénalités de collision (joueur et IA) : le responsable est celui qui arrive par derrière,
   ou, dans un accrochage latéral, celui qui se rabat le plus vite sur l'autre */
function collisionFault(R, A, B, ds, dd, sev, rearHit) {
  const n = R.colEvery != null ? R.colEvery : R.level && R.level.colEvery;
  if (!n || R.qualiRun || R.tt || sev < 0.8 || R.phase !== 'race' || R.t - R.startT < 3) return;
  let culprit;
  if (rearHit) culprit = ds > 0 ? A : B;
  else { const sg = dd > 0 ? 1 : -1, ia = A.vd * sg, ib = -B.vd * sg; culprit = ia >= ib ? A : B; }
  if (culprit.state === 'out') return;
  const other = culprit === A ? B : A;
  culprit.col = (culprit.col || 0) + 1;
  if (culprit.col % n === 0) {
    culprit.penalty = (culprit.penalty || 0) + 5;
    note(R, 'penalty', `PÉNALITÉ de 5 s pour ${culprit.code} : collisions répétées (${culprit.col})`, [culprit.id, other.id]);
  } else note(R, culprit.human ? 'error' : 'info', `Collision provoquée par ${culprit.code} avec ${other.code} (${culprit.col % n}/${n})`, [culprit.id, other.id]);
}

/* ralentissement dû à un choc, proportionnel à sa violence (vitesse d'impact en m/s) */
function shockSlow(c, imp, k, base = 0.02) { c.v *= 1 - clamp((base + imp * 0.03) * k, 0, 0.5); }

/* forme de la voiture pour les contacts : 3 cercles le long de son axe réel (dérive + tête-à-queue compris),
   ce qui arrondit les coins (aileron avant / roues / aileron arrière) et donne toute sa largeur à une voiture en travers */
const HIT_R = CAR_WID / 2, HIT_K = (CAR_LEN - CAR_WID) / 2;
const carAng = c => Math.atan2(c.vd || 0, Math.max(c.v, 3)) + (c.yaw || 0);
function carHit(A, B, ds, dd) {
  const a = carAng(A), b = carAng(B), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  let best = 1e9, bs = 0, bd = 0;
  for (let i = -1; i <= 1; i++) {
    const as = i * HIT_K * ca, ad = A.d + i * HIT_K * sa;
    for (let j = -1; j <= 1; j++) {
      const xs = ds + j * HIT_K * cb - as, xd = B.d + j * HIT_K * sb - ad, q = xs * xs + xd * xd;
      if (q < best) { best = q; bs = xs; bd = xd; }
    }
  }
  const dist = Math.sqrt(best);
  if (dist >= 2 * HIT_R) return null;
  const n = Math.max(dist, 1e-3);
  return { pen: 2 * HIT_R - dist, ns: dist > 1e-3 ? bs / n : Math.sign(ds) || 1, nd: dist > 1e-3 ? bd / n : 0 };
}
const CRASH_SEV = 6;   // gravité à partir de laquelle un contact entre voitures devient un accident
function contact(R, A, B, ds, dd, hit) {
  const T = R.T;
  const key = Math.min(A.id, B.id) + '-' + Math.max(A.id, B.id);
  const fresh = !(R.t - (A.contactCD[key] || -99) < 1.5);
  A.contactCD[key] = R.t; B.contactCD[key] = R.t;
  // direction du choc : surtout dans l'axe de la piste (choc arrière) ou surtout de côté (accrochage)
  const rearHit = Math.abs(hit.ns) > 0.62 * Math.hypot(hit.ns, hit.nd);
  const penLong = hit.pen * Math.abs(hit.ns), penLat = hit.pen * Math.abs(hit.nd);
  const rear = ds > 0 ? A : B, front = ds > 0 ? B : A;
  let sev;
  if (rearHit) {       // choc arrière
    const dv = Math.max(0, rear.v - front.v);
    sev = dv;
    // séparation longitudinale + échange de quantité de mouvement
    const push = penLong + 0.05;
    rear.dist -= push * 0.6; rear.s = mod(rear.dist, T.L);
    front.dist += push * 0.4; front.s = mod(front.dist, T.L);
    // celui qui arrive par derrière encaisse le choc : il retombe sous la vitesse de la voiture touchée
    const vm = (rear.v + front.v) / 2; rear.v = vm - dv * 0.15; front.v = vm + dv * 0.15;

    front.vd += (Math.random() - 0.5) * dv * 0.3;
  } else {                            // accrochage latéral
    const dvl = Math.abs(A.vd - B.vd);
    sev = dvl * 1.4 + Math.abs(A.v - B.v) * 0.1;
    const sgn = hit.nd > 0 ? 1 : hit.nd < 0 ? -1 : dd > 0 ? 1 : -1, push = penLat / 2 + 0.03;
    A.d -= sgn * push; B.d += sgn * push;
    const vdA = A.vd, vdB = B.vd;
    A.vd = vdB * 0.4 - sgn * 0.8; B.vd = vdA * 0.4 + sgn * 0.8;
  }
  if (!fresh) return;
  if (R.onContact) R.onContact(A, B, ds, dd);
  collisionFault(R, A, B, ds, dd, sev, rearHit);
  // le choc freine les deux voitures, d'autant plus qu'il est violent (comme un contact avec le mur)
  const lat = !rearHit;
  for (const c of [A, B]) if (c.state !== 'out') shockSlow(c, sev, lat ? 1 : c === rear ? 1.4 : 0.4);   // celui qui percute encaisse le plus, pour tous
  if (R.noDnf && A.state !== 'out' && B.state !== 'out') {   // sans abandon : le choc ne fait que ralentir (toutes les voitures)
    note(R, 'contact', `Contact entre ${A.code} et ${B.code}`, [A.id, B.id]);
    return;
  }
  if (A.state === 'out' || B.state === 'out') {
    // voiture arrêtée : seul un vrai choc (pleine vitesse dans l'arrière, pas un frôlement) met hors course
    const mover = A.state === 'out' ? B : A;
    if (sev >= CRASH_SEV) retire(R, mover, 'percute une voiture arrêtée', true);
    else if (sev >= 3 && R.dmgLite) note(R, 'contact', `${mover.code} touche la voiture arrêtée`, [mover.id]);
    else if (sev >= 3) { mover.damage = Math.max(mover.damage, 0.55); mover.pitReq = true; mover.pitReason = 'nouveau museau'; note(R, 'contact', `${mover.code} touche la voiture arrêtée — museau endommagé`, [mover.id]); }
    else note(R, 'contact', `${mover.code} frôle la voiture arrêtée`, [mover.id]);
    return;
  }
  if (sev < 1.2) {
    if (Math.random() < 0.25 && !R.dmgLite) {
      const v = Math.random() < 0.5 ? A : B;
      v.damage = Math.max(v.damage, 0.25);
      note(R, 'contact', `Contact ${A.code} / ${B.code} — aileron endommagé pour ${v.code}`, [A.id, B.id]);
    } else note(R, 'contact', `Léger contact entre ${A.code} et ${B.code}`, [A.id, B.id]);
    return;
  }
  R.incidents++;
  if (sev < CRASH_SEV) {   // accrochage : dégâts possibles, mais pas d'accident (tête-à-queue seulement si le choc est déjà fort)
    note(R, 'contact', `ACCROCHAGE entre ${A.code} et ${B.code} !`, [A.id, B.id]);
    const k = (sev - 1.2) / (CRASH_SEV - 1.2);
    for (const c of [A, B]) {
      const r = Math.random();
      if (R.dmgLite) { /* abandons seuls : pas de dégâts intermédiaires */ }
      else if (r < 0.1 + 0.2 * k) { c.damage = Math.max(c.damage, 0.55); c.pitReq = true; c.pitReason = 'nouveau museau'; }
      else if (r < 0.15 + 0.3 * k) { c.puncture = true; c.pitReq = true; c.pitReason = 'crevaison'; }
      if (sev > 4 && Math.random() < 0.1 * k) startSpin(R, c, 'part en tête-à-queue');
    }
    return;
  }
  // choc violent
  note(R, 'crash', `CRASH ! ${A.code} et ${B.code} s'accrochent violemment`, [A.id, B.id]);
  const pr = clamp(0.35 + sev * 0.05, 0, 0.9);
  let anyOut = false;
  for (const c of [A, B]) {
    if (Math.random() < pr) { retire(R, c, 'accident avec ' + (c === A ? B.code : A.code), true); anyOut = true; }
    else { if (!R.dmgLite) { c.damage = 0.6; c.pitReq = true; c.pitReason = 'réparations'; } startSpin(R, c, 'part en tête-à-queue'); }
  }
  if (!anyOut) retire(R, rear, 'suspension cassée', true);
}

function order(R) {
  const T = R.T;
  const prevOrder = R.orderIds || R.cars.map(c => c.id);
  const ranked = R.cars.slice().sort((a, b) => {
    const ao = a.state === 'out' ? 1 : 0, bo = b.state === 'out' ? 1 : 0;
    if (ao !== bo) return ao - bo;
    if (ao) return b.dist - a.dist;
    if (a.fin && b.fin) return R.finishOrder.indexOf(a.id) - R.finishOrder.indexOf(b.id);
    if (a.fin !== b.fin) {
      // une voiture encore en piste qui bouclera plus de tours que celle déjà arrivée reste devant
      const f = a.fin ? a : b, o = a.fin ? b : a;
      const oLaps = Math.floor(o.dist / T.L) + 1;
      const fAhead = (f.finLaps ?? R.laps) >= oLaps;
      return (fAhead === a.fin) ? -1 : 1;
    }
    return b.dist - a.dist;
  });
  ranked.forEach((c, i) => { c.pos = i + 1; });
  const leader = ranked[0];
  for (const c of ranked) {
    if (c === leader) { c.gap = 0; continue; }
    const lapsBehind = Math.floor((leader.dist - c.dist) / T.L);
    const fp = R.firstPass.get(c.loopKey);
    c.gap = c.state === 'out' ? null : (lapsBehind >= 1 && !leader.fin ? -lapsBehind : fp != null ? c.loopT - fp : 0);
  }
  for (let i = 1; i < ranked.length; i++) {
    const c = ranked[i], p = ranked[i - 1];
    c.int = c.gap != null && p.gap != null && c.gap >= 0 && p.gap >= 0 ? c.gap - p.gap : null;
  }
  // dépassements : confirmés seulement si la manœuvre tient (≥ 1 longueur, 2 s)
  const ids = ranked.map(c => c.id);
  if (R.phase === 'race' && R.t - R.startT > 1) {
    R.pending = R.pending || [];
    for (let i = 0; i < ids.length; i++) {
      const c = R.cars[ids[i]];
      const was = prevOrder.indexOf(c.id);
      if (was > i && c.state === 'run' && !c.fin) {
        const victim = R.cars[prevOrder[i]];
        if (victim && victim.state === 'run' && !victim.pitReq && Math.abs(physDs(T, c, victim)) < 40 && R.flag === 'green' && !R.pending.some(p => p.a === c.id && p.b === victim.id))
          R.pending.push({ a: c.id, b: victim.id, t: R.t, ot: c.otActive });
      }
    }
    R.pending = R.pending.filter(p => {
      const a = R.cars[p.a], b = R.cars[p.b];
      if (a.dist < b.dist || a.state !== 'run' || b.state !== 'run') return false;   // annulé / repris
      if (R.t - p.t < 2) return true;
      if (a.dist - b.dist > CAR_LEN * 1.5 && Math.abs(physDs(T, a, b)) < 400) {
        a.passes = (a.passes || 0) + 1;
        note(R, 'overtake', `${a.code} dépasse ${b.code} pour la P${a.pos}${p.ot ? ' (OVERTAKE)' : ''}`, [a.id, b.id]);
        return false;
      }
      return R.t - p.t < 6;
    });
  }
  R.orderIds = ids; R.ranked = ranked;
}

function fmtLap(t) {
  if (!t) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + s.toFixed(3).padStart(6, '0');
}

/* ------------------------------------------------------------------ */
/*  QUALIFICATIONS : tours lancés simulés avec la même physique        */
/* ------------------------------------------------------------------ */
function hotLap(T, entry, noise, forceOff, wantTrace, wet, force, latK) {   // latK : niveau de l'IA (adhérence en virage seulement)   // force = { tyre, wear } (outils de calibration)
  CUR_WET = wet || 0; CUR_TG = T.tyre.g;
  const R = { forceOff, wet: wet || 0, T, t: 0, flag: 'green', chaos: 1, cars: [], events: [], yellows: [], laps: 99, raceDist: 1e9, wearDist: 1e9, fuelPerLap: 0, firstPass: new Map(), phase: 'race', teamOrder: [] };
  const c = makeCar(0, entry, T, { fuel: 6 });
  c.tyre = (wet || 0) >= 0.2 ? bestComp(wet) : 'S'; c.warm = 0; c.plan = []; c.state = 'run'; c.quali = true;
  if (force) { c.tyre = force.tyre || c.tyre; c.wear = force.wear || 0; }
  c.gripBase *= 1 + noise;
  if (latK) { c.latK = latK; c.gripBase *= latK; }
  c.errRate = 0;
  c.dist = -900; c.s = mod(c.dist, T.L); c.v = at(T, T.env, c.s) * 0.9; c.d = at(T, T.alpha, c.s);
  c.reaction = -1; c.lapsDone = -1; c.nb = { ahead: null, aheadDs: 1e9, lane: null, laneDs: 1e9, side: [], tow: 0, dirty: 0, attacker: null, attDs: 1e9, lapper: null, lapDs: 1e9, obst: null, obstDs: 1e9 };
  R.cars.push(c);
  const dt = 1 / 50;
  let t0 = null, guard = 0;
  let vmax = 0;
  while (guard++ < 200000) {
    R.t += dt;
    const before = c.dist;
    drive(R, c, dt);
    if (c.state !== 'run') return { t: 999, vmax, ev: R.events, s: c.s };
    if (c.pitReq) c.pitReq = false;
    vmax = Math.max(vmax, c.v);
    const ov = Math.abs(c.d) - T.w / 2; if (ov > (R.maxOver || -99)) { R.maxOver = ov; R.maxOverS = c.s; }
    if (before < 0 && c.dist >= 0) t0 = R.t - (c.dist / Math.max(c.v, 1)) ;
    if (wantTrace === 'ghost' && t0 !== null) { R.gh = R.gh || []; const tt = R.t - t0; if (!R.gh.length || tt - R.gh[R.gh.length - 1][0] >= 0.05) R.gh.push([+tt.toFixed(3), +c.dist.toFixed(2), +c.d.toFixed(2), +Math.atan2(c.vd, Math.max(c.v, 3)).toFixed(3)]); }
    else if (wantTrace && t0 !== null) { R.tr = R.tr || []; const k = Math.floor(c.dist / 100); if (R.tr.length <= k) R.tr.push([R.t - t0, c.v * 3.6, c.d]); }
    if (t0 !== null && c.dist >= T.L) return { t: R.t - (c.dist - T.L) / Math.max(c.v, 1) - t0, vmax, spun: c.spin != null || c.errShift > 0, trace: R.tr, ghost: R.gh, maxOver: R.maxOver, maxOverS: R.maxOverS };
  }
  return { t: 999, vmax, ev: R.events, s: c.s };
}

/* Tour de qualification piloté par le joueur : tour lancé seul en piste */
function createQualiRun(T, entry, opts) {
  const R = createRace(T, [entry], { laps: 1, human: 0, assist: opts.assist, weather: opts.weather === 'mixed' ? 'dry' : opts.weather, level: opts.level, noDnf: opts.noDnf });
  const c = R.cars[0];
  c.tyre = R.wet >= 0.2 ? bestComp(R.wet) : 'S'; c.warm = 0; c.fuel = 6; c.plan = []; c.quali = true; c.soc = SOC_MAX;
  c.dist = -650; c.s = mod(c.dist, T.L); c.v = at(T, T.env, c.s) * 0.85; c.d = at(T, T.alpha, c.s);
  R.phase = 'race'; R.startT = 0; c.reaction = 0; c.launch = 1;
  R.raceDist = 1e9; R.wearDist = 1e9;
  R.qualiRun = { invalid: false, done: false, time: null, why: '' };
  return R;
}
/* Contre-la-montre : voiture de performance standard, tours lancés en boucle, tour annulé si hors piste */
const TT_TEAM = { ligne_droite: 64, virage: 63, pneus: 63, depart: 62 };
function createTimeTrial(T, entry, opts) {
  const team = Object.assign({}, entry.team, TT_TEAM);
  const driver = Object.assign({}, entry.driver, { skill: 65, consistency: 65 });
  const R = createQualiRun(T, { team, driver }, { assist: opts.assist, weather: 'dry', level: opts.level, noDnf: opts.noDnf });
  delete R.qualiRun;
  R.laps = 9999; R.tt = { valid: true, laps: [], seen: 0, offs: 0, off: false }; R.recGhost = true;
  R.cars[0].samples = null;
  if (opts.flying) {   // marathon : on arrive lancé, directement sur la ligne, à la vitesse du circuit précédent
    const c = R.cars[0];
    c.dist = -0.5; c.s = mod(c.dist, T.L);
    c.v = Math.min(opts.flying.v, at(T, T.env, c.s)); c.d = clamp(opts.flying.d, -T.lim, T.lim); c.vd = 0;
  }
  return R;
}
function ttCheck(R) {
  const tt = R.tt, c = R.cars[0], T = R.T;
  const outside = Math.abs(c.d) > T.w / 2 + 1.0 && c.state !== 'pit';
  if (c.lapsDone >= 0 && outside && !tt.off) {
    tt.offs++;   // nombre de sorties de piste pendant le tour (marathon : 1 s chacune)
    if (tt.valid && !R.ttNoInvalid) note(R, 'error', 'Tour annulé : limites de piste', [0]);
    else if (R.ttNoInvalid) note(R, 'error', 'Limites de piste : +1 s', [0]);
    tt.valid = false;
  }
  tt.off = outside ? true : Math.abs(c.d) < T.w / 2 ? false : tt.off;
  if (c.lapsDone > tt.seen) {
    tt.seen = c.lapsDone;
    if (c.lapsDone >= 1) tt.laps.push({ time: c.lastLap, valid: tt.valid, offs: tt.offs, samples: c.prevSamples });
    tt.valid = true; tt.offs = 0;
    c.soc = SOC_MAX; c.harvLap = 0; c.wear = 0; c.fuel = 6; c.warm = 0;
  }
  if (c.state === 'out') { tt.crashed = true; }
}

function qualiCheck(R) {
  const q = R.qualiRun, c = R.cars[0], T = R.T;
  if (q.done) return;
  if (c.lapsDone === 0 && !q.invalid && R.level && R.level.limits && Math.abs(c.d) > T.w / 2 + 1.0) {
    q.invalid = true; q.why = 'limites de piste'; note(R, 'error', 'Tour annulé : limites de piste dépassées', [0]);
  }
  if (c.state === 'out') { q.done = true; q.invalid = true; q.why = 'sortie de piste'; R.over = true; }
  if (c.lapsDone >= 1) { q.done = true; q.time = c.lastLap; R.over = true; }
}

/* Fantôme d'un tour de qualif IA : trajectoire (t, distance, écart, glisse) recalée sur le temps officiel */
function ghostLap(T, entry, gn, wet, targetTime, latK) {
  let h = null;
  for (let k = 0; k < 4 && !(h && h.ghost && h.t < 900); k++) h = hotLap(T, entry, gn || 0, undefined, 'ghost', wet, undefined, latK);
  if (!h || !h.ghost) return null;
  const k = targetTime && targetTime < 900 ? targetTime / h.t : 1;
  return { time: targetTime || h.t, samples: h.ghost.map(p => [p[0] * k, p[1], p[2], p[3]]) };
}

function qualifying(T, entries, wet, pace, humanName) {
  // forme du jour : certains pilotes sont dans un bon jour, d'autres pas (même voiture, écarts parfois surprenants)
  const res = entries.map((e, i) => ({ e, i, best: 1e9, times: {}, day: (Math.random() + Math.random() + Math.random() - 1.5) * 0.006 }));
  const lap = r => {
    const cons = +(r.e.driver.consistency ?? r.e.driver.skill);
    const spread = 1.6 - (cons - 60) / 20;
    let noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.007 * spread;
    if (r.e.driver.name !== humanName) {
      noise += r.day;
      const u = Math.random();
      if (u < 0.07) noise += rnd(0.006, 0.016);                   // tour exceptionnel : tout s'aligne
      else if (u < 0.19) noise -= rnd(0.005, 0.016) * spread;     // tour moyen : trafic, pneus pas en température, mauvais virage
    }
    const pc = pace && r.e.driver.name !== humanName ? pace : 1;
    const gn = noise + pc * pc - 1;
    const h = hotLap(T, r.e, noise, undefined, false, wet, undefined, pc * pc);
    r._gn = noise; r._k = pc * pc;
    const er = clamp(1.6 - (+r.e.driver.skill - 60) / 15, 0.6, 1.8);
    if (Math.random() < 0.006 * er * (1 + 3 * (wet || 0))) return 999;              // tour annulé / sortie
    if (Math.random() < 0.07 * er) return h.t + rnd(0.2, 1.4);  // petite erreur
    return h.t;
  };
  const session = (list, name, runs) => {
    for (const r of list) { let b = 1e9; for (let k = 0; k < runs; k++) { const t = lap(r); if (t < b) { b = t; r.bestGn = r._gn; r.bestK = r._k; } } r.times[name] = b; r.best = b; }
    return list.slice().sort((a, b) => a.best - b.best);
  };
  let q1 = session(res, 'Q1', 1);
  const out1 = q1.slice(16);
  let q2 = session(q1.slice(0, 16), 'Q2', 1);
  const out2 = q2.slice(10);
  let q3 = session(q2.slice(0, 10), 'Q3', 2);
  return [...q3, ...out2, ...out1].map((r, k) => ({ entry: r.e, pos: k + 1, q1: r.times.Q1, q2: r.times.Q2, q3: r.times.Q3, best: r.best, gn: r.bestGn, gk: r.bestK, wet: wet || 0 }));
}

return { setEngine, get engine() { return ICE_ONLY ? 'ice' : 'hybrid'; }, setPTherm(p) { P_THERM = p; }, strategyModel, optimizeLine, lineLapTime, setLine, paceFromLimit, autoTyre, missedCompound, tyreProfile, LEVELS, createQualiRun, createTimeTrial, ghostLap, compGrip, bestComp, buildTrack, createRace, uniqueCodes, step, qualifying, hotLap, at, idxOf, worldPos, fmtLap, COMP, CAR_LEN, CAR_WID, SOC_MAX, mod, physDs };
})();
if (typeof module !== 'undefined') module.exports = SIM;
