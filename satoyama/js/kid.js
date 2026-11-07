// 声の子の体（Rapier の剛体と関節）。遺伝子 → 骨格 → 物理の体。ノウサギの体（hare.js）と同じ形の入れ物（parts・joints・feet）を返すので、
// 試し（trial.js）・汚れ（dirt.js）・フェルトの皮（felt.js）がそのまま使える。単位は m・kg・秒。前が +x、上が +y、左が +z
// 遺伝子はこえのこ（../voice-pet/evo/life.js）と同じ名前（seg・neck・tail・legs・legLen・girth・stop・bold・vtl…、0..1）
// 整った形の決まり（GAME.md 9.7 の7）: 左右対称・足はかならず2対か3対（体を支えて歩く数）・太さと長さはつり合う範囲だけ・使わない手足をつけない
import { SELF, NODE_I, pose } from './hare.js';
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function alongQ(a, b) { // 線分（a→b）に沿うカプセルの向き（Rapier のカプセルは y 軸）
  const d = sub(b, a), L = Math.hypot(...d), u = d.map(v => v / L), c = [u[2], 0, -u[0]], w = 1 + u[1], n = Math.hypot(c[0], c[1], c[2], w) || 1;
  return w < 1e-6 ? { x: 0, y: 0, z: 1, w: 0 } : { x: c[0] / n, y: c[1] / n, z: c[2] / n, w: w / n };
}

// 遺伝子 → 骨格の寸法（整った形の範囲にしぼる）
export function kidPlan(g) {
  const G = k => cl(g[k] ?? 0.5);
  const s = lerp(0.75, 1.25, G('vtl'));                     // 体の大きさ（声の筒の長さ）
  const juv = cl(G('stop') * 0.65 + G('bold') * 0.45 - 0.1); // 幼さ（頭が大きく足が短い）
  const seg = 2 + Math.round(G('seg') * 2);                 // 胴の節 2〜4（多いと長すぎてくねり、虫に見える）
  const pairs = seg >= 3 && G('legs') > 0.6 ? 3 : 2;          // 足 2対（よつあし）か 3対（節が3つ以上のときだけ）
  const neck = Math.round(G('neck') * 2), tail = Math.round(G('tail') * 3);
  const girth = lerp(0.8, 1.25, G('girth'));
  const r = 0.042 * s * girth;                                // 胴の太さ（半径）
  const segL = 0.085 * s * lerp(1, 0.85, juv);                // 胴の節の長さ
  const legL = 0.075 * s * lerp(0.8, 1.25, G('legLen')) * lerp(1, 0.85, juv) * (pairs === 3 ? 0.85 : 1); // 足の1節（もも・すね）の長さ。太さとつり合う範囲
  const legR = Math.max(0.011, r * 0.32);
  const headR = 0.045 * s * lerp(1, 1.3, juv);
  return { s, juv, seg, pairs, neck, tail, girth, r, segL, legL, legR, headR, fluff: G('fluff') };
}

// 体を作る。o＝足もとの地面の点、groundH＝地面の高さ、g＝遺伝子、yaw＝向き
export function buildKid(R, world, o, groundH, g, yaw = 0, over = null) { // over＝骨格の寸法を上書き（実在の種、tanuki.js）
  const K = { ...kidPlan(g), ...(over || {}) }, cy = Math.cos(yaw), sy = Math.sin(yaw), rot = p => [p[0] * cy - p[2] * sy, p[1], p[0] * sy + p[2] * cy];
  const hipY = K.legL * 1.75 + K.legR, zL = K.r * 0.75; // 胴の高さ（足は少し曲げて立つ）・足の左右の間
  const len = K.seg * K.segL, x0 = -len / 2;
  // 足の付け根の x（後ろの対は腰、前の対は胸、3対のときは真ん中）
  const pairX = K.pairs === 3 ? [x0 + K.segL * 0.5, 0, x0 + len - K.segL * 0.5] : [x0 + K.segL * 0.5, x0 + len - K.segL * 0.5];
  const feetPts = pairX.flatMap(x => [[x + K.legL * 0.3, 0, zL], [x + K.legL * 0.3, 0, -zL]]);
  const y0 = Math.max(...feetPts.map(p => rot(p)).map(p => groundH(o[0] + p[0], o[2] + p[2]))) + 0.002;
  const P = p => { const q = rot(p); return [o[0] + q[0], y0 + q[1], o[2] + q[2]]; };
  const parts = {}, list = [], feet = [], J = {};
  const vol = (r, L) => Math.PI * r * r * L + 4 / 3 * Math.PI * r ** 3, dens = 900; // 重さは体積から（水よりすこし軽い）
  const seg = (name, a, b, r, opt = {}) => {
    const A = P(a), B = P(b), c = A.map((v, i) => (v + B[i]) / 2), L = Math.hypot(...sub(B, A)), mass = opt.mass ?? vol(r, L) * dens;
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setLinearDamping(0.05).setAngularDamping(0.3).setCcdEnabled(!!opt.foot));
    world.createCollider(R.ColliderDesc.capsule(Math.max(0.001, L / 2 - r * 0.2), r).setRotation(alongQ(A, B)).setMass(mass).setFriction(opt.fr ?? 0.6).setCollisionGroups(SELF), body);
    parts[name] = { body, c, a: A, b: B, r, len: L, mass };
    if (opt.foot) feet.push({ name, body, r, hind: opt.hind, side: opt.side, down: false, at: null, ends: [sub(A, c), sub(B, c)] });
    return parts[name];
  };
  const ball = (name, p, r) => { const c = P(p), mass = 4 / 3 * Math.PI * r ** 3 * dens, body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setAngularDamping(0.3)); world.createCollider(R.ColliderDesc.ball(r).setMass(mass).setFriction(0.5).setCollisionGroups(SELF), body); parts[name] = { body, c, r, mass }; return parts[name]; };
  const node = (name, p, mass) => { const c = P(p), body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setAngularDamping(0.3)); world.createCollider(R.ColliderDesc.ball(0.005).setMassProperties(mass, { x: 0, y: 0, z: 0 }, { x: NODE_I, y: NODE_I, z: NODE_I }, { x: 0, y: 0, z: 0, w: 1 }).setCollisionGroups(0), body); parts[name] = { body, c, r: 0.005, mass }; return parts[name]; };
  const hinge = (name, pa, pb, j, k, d, lim, ax = [0, 0, 1]) => {
    const Jp = P(j), la = sub(Jp, pa.c), lb = sub(Jp, pb.c), A = rot(ax);
    const jt = world.createImpulseJoint(R.JointData.revolute({ x: la[0], y: la[1], z: la[2] }, { x: lb[0], y: lb[1], z: lb[2] }, { x: A[0], y: A[1], z: A[2] }), pa.body, pb.body, true);
    jt.configureMotorModel(R.MotorModel.ForceBased); if (lim) jt.setLimits(lim[0], lim[1]);
    const o = { name, jt, k, d, target: 0 }; list.push(o); J[name] = o; return o;
  };
  // 胴: 後ろから pelvis・mid1…・chest（試しの「体のむき」は pelvis→chest で見る）
  const torso = [];
  for (let i = 0; i < K.seg; i++) {
    const name = i === 0 ? 'pelvis' : i === K.seg - 1 ? 'chest' : 'mid' + i;
    torso.push(seg(name, [x0 + i * K.segL + 0.004, hipY, 0], [x0 + (i + 1) * K.segL - 0.004, hipY, 0], K.r));
  }
  const M0 = torso.reduce((t, p) => t + p.mass, 0);
  const kS = 40 * M0 / 1.4; // 背骨の強さ（ノウサギの胴 1.4kg で 40）
  for (let i = 1; i < K.seg; i++) J['sp' + i] = hinge('sp' + i, torso[i - 1], torso[i], [x0 + i * K.segL, hipY, 0], kS, kS * 0.03, [-0.6, 0.6]);
  // 首と頭（首の節は角度を保つだけ）
  let prev = torso[K.seg - 1], hx = x0 + len, hy = hipY;
  for (let i = 0; i < K.neck; i++) { const n = seg('neck' + i, [hx, hy, 0], [hx + K.segL * 0.5, hy + K.segL * 0.35, 0], K.r * 0.7); hinge('nk' + i, prev, n, [hx, hy, 0], kS * 0.3, kS * 0.01, [-0.5, 0.5]); prev = n; hx += K.segL * 0.5; hy += K.segL * 0.35; }
  const head = ball('head', [hx + K.headR * 0.8, hy + K.headR * 0.4, 0], K.headR); hinge('hd', prev, head, [hx, hy, 0], kS * 0.3, kS * 0.01, [-0.5, 0.5]);
  // 尾（ばねでゆれるだけ。ぶらさげて引きずらないよう、少し上へ）
  prev = torso[0]; let tx = x0, ty = hipY;
  for (let i = 0; i < K.tail; i++) { const r = K.r * lerp(0.55, 0.3, i / Math.max(1, K.tail)), L = K.segL * 0.6, n = seg('tail' + i, [tx, ty, 0], [tx - L, ty + L * 0.25, 0], r); hinge('tl' + i, prev, n, [tx, ty, 0], kS * 0.15, kS * 0.006, [-0.7, 0.7]); prev = n; tx -= L; ty += L * 0.25; }
  // 足: 付け根（横へ開く節）→ もも → すね → 足先。どの対も同じ作り（前の対は肩、後ろの対は腰）
  const M = M0 + Object.values(parts).filter(p => !torso.includes(p)).reduce((t, p) => t + p.mass, 0);
  const kL = 17 * (M / K.pairs * 2) * (K.legL / 0.12) * 2; // 足の筋の強さ（ノウサギの股 40 を、1対が受け持つ重さと足の長さで）。ねばりは強さの 0.6% ほど（ノウサギと同じ 3% だと、重い体では関節がふるえて崩れた＝tools/kid-diag2.mjs）
  const PN = K.pairs === 3 ? ['h', 'm', 'f'] : ['h', 'f'];
  PN.forEach((pn, pi) => {
    const x = pairX[pi], host = pi === 0 ? torso[0] : pi === PN.length - 1 ? torso[K.seg - 1] : torso[1];
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', z = zL * s, kx = 1; // 前の対も同じ強さ（頭と首の重さがかかる）
      // 後ろの対はひざが前（＜の逆）、前の対は柱のようにまっすぐ下りてひじが後ろ（本物のよつあしの前足と後ろ足）
      const fr = pn !== 'h', knee = fr ? [x - K.legL * 0.12, hipY - K.legL * 0.97, z] : [x + K.legL * 0.25, hipY - K.legL * 0.95, z], ankle = fr ? [x + K.legL * 0.02, hipY - K.legL * 1.92 + K.legR, z] : [x - K.legL * 0.05, hipY - K.legL * 1.9 + K.legR, z], toe = [x + K.legL * (fr ? 0.3 : 0.35), K.legR, z];
      const nd = node(pn + 'N' + L, [x, hipY, z], 0.02);
      J['ab' + pn + L] = hinge('ab' + pn + L, host, nd, [x, hipY, z], kL * 0.75, kL * 0.004, [-0.5, 0.5], [1, 0, 0]);
      const th = seg(pn + 'up' + L, [x, hipY, z], knee, K.legR * 1.4);
      const sh = seg(pn + 'lo' + L, knee, ankle, K.legR);
      const ft = seg(pn + 'ft' + L, ankle, toe, K.legR * 0.9, { foot: true, hind: pn === 'h', side: s, fr: 1.6 });
      J['hip' + pn + L] = hinge('hip' + pn + L, nd, th, [x, hipY, z], kL * kx, kL * kx * 0.006, [-1.4, 1.4]);
      J['knee' + pn + L] = hinge('knee' + pn + L, th, sh, knee, kL * 0.75 * kx, kL * 0.0045 * kx, [-1.6, 1.6]);
      J['ank' + pn + L] = hinge('ank' + pn + L, sh, ft, ankle, kL * 0.4 * kx, kL * 0.0025 * kx, [-1.4, 1.4]);
    }
  });
  for (const j of list) j.jt.configureMotorPosition(0, j.k, j.d);
  return { kind: 'kid', plan: K, pairNames: PN, parts, joints: J, list, feet, fallH: K.r * 0.8, noTouch: [parts.head, ...torso], mass: Object.values(parts).reduce((t, p) => t + p.mass, 0) }; // fallH＝胴がおなかを地面につけるほど低くなったら転んだ
}

// リズムの数（0..1）→ 値。左右のずれは「そろえる（0）」か「交互（0.5）」のどちらかの対称な歩き方だけ（GAME.md 9.7）
export const KID_PARAMS = [
  ['freq', 1, 4.5], ['spA', 0, 0.5], ['spP', 0, 1],
  ['hipA', 0, 0.9], ['hipO', -0.5, 0.5], ['kneeA', 0, 1], ['kneeO', -0.6, 0.6], ['kneeP', 0, 1], ['ankA', 0, 0.8], ['ankP', 0, 1],
  ['pairP', 0, 1], ['side', 0, 1], // pairP＝前の対の位相（後ろの対から）、side＝0.5 より上なら左右交互、下ならそろえる
  ['turn', -1, 1], ['pK', -2, 2], ['pD', -0.05, 0.05], ['rK', -2, 2], ['aK', -2, 2], ['aD', -0.03, 0.03],
];
export const decodeKid = v => Object.fromEntries(KID_PARAMS.map(([k, a, b], i) => [k, a + (b - a) * cl(v[i] ?? 0.5)]));
export const encodeKid = o => KID_PARAMS.map(([k, a, b]) => cl(((o[k] ?? (a + b) / 2) - a) / (b - a)));
// 手本の出発点（どの体にも同じ）: よつあしの速歩（左右交互・前後の対は半周ずれ＝対角の足がいっしょ）。横へ足を出す反射は立つ試しの値
// のっそり歩く（横の順: 左後ろ→左前→右後ろ→右前、1.6回/秒）。ひざは前へ振るときに曲げて足を上げる（tools/kid-probe.mjs でタヌキが転ばず 1m）
export const KID_SEED = encodeKid({ freq: 1.6, spA: 0.05, spP: 0.5, hipA: 0.3, hipO: 0, kneeA: 0.3, kneeO: 0, kneeP: 0.75, ankA: 0.25, ankP: 0.25, pairP: 0.25, side: 0.8, turn: 0.5, pK: 0, pD: 0, rK: 0, aK: -0.7, aD: 0 });
export const KID_TROT = encodeKid({ ...decodeKid(KID_SEED), freq: 1.6, pairP: 0.5 });

// 筋のリズム。g＝歩く強さ、turn＝曲がる（＋で左）
export function driveKid(H, q, t, g = 1, turn = 0, pose) {
  const ph = q.freq * t, S = x => Math.sin(Math.PI * 2 * x);
  const P = pose(H), dp = H.lastPitch == null ? 0 : (P.pitch - H.lastPitch) * 240, dr = H.lastRoll == null ? 0 : (P.roll - H.lastRoll) * 240; H.lastPitch = P.pitch; H.lastRoll = P.roll;
  const ab = Math.max(-0.45, Math.min(0.45, q.aK * P.roll + q.aD * dr)), fb = q.pK * P.pitch + q.pD * dp, alt = q.side > 0.5 ? 0.5 : 0;
  const set = (j, v) => { if (j && Math.abs(v - j.target) > 1e-4) { j.target = v; j.jt.configureMotorPosition(v, j.k, j.d); } };
  for (let i = 1; i < H.plan.seg; i++) set(H.joints['sp' + i], g * q.spA * S(ph + q.spP));
  const n = H.pairNames.length;
  H.pairNames.forEach((pn, pi) => {
    const pp = n === 1 ? 0 : q.pairP * pi / (n - 1);
    for (const [L, s] of [['L', 1], ['R', -1]]) {
      const a = g * (1 - q.turn * turn * s * 0.6), p = ph + pp + (s > 0 ? 0 : alt), rl = q.rK * P.roll * s;
      set(H.joints['hip' + pn + L], q.hipO + a * q.hipA * S(p) + fb);
      const ks = pn === 'h' ? 1 : -1; // 前の対はひざ（ひじ）の向きが逆なので、曲げる・のばすをそろえるため符号を変える
      set(H.joints['knee' + pn + L], ks * (q.kneeO + a * q.kneeA * S(p + q.kneeP)) + rl);
      set(H.joints['ank' + pn + L], a * q.ankA * S(p + q.ankP));
      set(H.joints['ab' + pn + L], ab);
    }
  });
}

// 肉づき（皮を作るための形）: 胴はなめらかにつなぎ、首と頭、尾、足。太さは毛こみ
export function kidShapes(H) {
  const P = H.parts, K = H.plan, S = [], fur = K.fur ?? 0.006 + 0.008 * K.fluff;
  const cap = (part, a, b, ra, rb, k) => S.push({ part, body: P[part].body, a, b, ra, rb, k });
  for (const [name, p] of Object.entries(P)) {
    if (!p.a) continue;
    if (name === 'pelvis' || name === 'chest' || name.startsWith('mid')) cap(name, p.a, p.b, p.r + fur, p.r + fur, 0.04);
    else if (name.startsWith('neck')) cap(name, p.a, p.b, p.r + fur, p.r * 0.9 + fur, 0.03);
    else if (name.startsWith('tail')) cap(name, p.a, p.b, p.r + fur, p.r * 0.8 + fur, 0.02);
    else if (/up[LR]$/.test(name)) cap(name, p.a, p.b, p.r * 1.25 + fur, p.r * 0.85 + fur, 0.025);
    else cap(name, p.a, p.b, p.r + fur * 0.7, p.r * 0.9 + fur * 0.6, 0.01);
  }
  const h = P.head, sn = K.snout ?? 0.5; S.push({ part: 'head', body: h.body, a: h.c, b: [h.c[0] + h.r * (0.5 + sn), h.c[1] - h.r * 0.15 * (1 + sn), h.c[2]], ra: h.r + fur, rb: h.r * (0.7 - sn * 0.4) + fur * (1 - sn * 0.5), k: 0.03 }); // 鼻づら（snout＝長さ）
  return S;
}

// 確かめ用: 番号から遺伝子をつくる（声のかわり）・試し（trial.js）に渡す体の作り方
export const KID_KEYS = ['seg', 'neck', 'tail', 'legs', 'legLen', 'girth', 'stop', 'bold', 'vtl', 'fluff'];
export function kidGenes(seed) { let s = seed >>> 0 || 1; const r = () => ((s ^= s << 13, s ^= s >>> 17, s ^= s << 5) >>> 0) / 4294967296; return Object.fromEntries(KID_KEYS.map(k => [k, r()])); }
export const kidBody = (g, over = null) => ({ build: (R, w, at, h, yaw = 0) => buildKid(R, w, at, h, g, yaw, over), drive: (H, q, t, gg, tc) => driveKid(H, q, t, gg, tc, pose), decode: decodeKid });
