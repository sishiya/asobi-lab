// ニホンノウサギの体（Rapier の剛体と関節）。単位は m・kg・秒。体の前が +x、上が +y、左が +z
// 骨＝剛体（重さは部位ごと。合計 約2.4kg）、筋＝関節のモーター（ねらう角度へ、強さ k［N·m/rad］とねばり d で引く）
// 長い後ろ足（もも・すね・長い足の甲）と短い前足、曲がる背骨（はねるときに丸めて伸ばす）
// 歩き方は決めない: 関節ごとのリズムの数（PARAMS）を手元で学習して入れる（tools/learn.mjs）
export const SELF = (0x0002 << 16) | 0x0001; // 体の部位どうしはぶつからない（地面とだけ）
// HEAD_FUSED: 頭を胸と1つの骨にする（首の関節なし）。いまの首はリズムで動かさず角度を保つだけなので、まとめても動きは変わらず、ぐらつく重さが減る（ユーザーの案）
// 2026-11-07 にくらべて、まとめた体に決めた（すべり 19→14cm/秒・計算 2割軽い・安定さは同じ）
export let HEAD_FUSED = true; export const setHeadFused = b => (HEAD_FUSED = !!b);
export let NODE_M = 0.02, NODE_I = 1e-4; export const setNodeM = (m, i = NODE_I) => { NODE_M = m; NODE_I = i; };
export const GROUND = (0x0001 << 16) | 0xfffe; // 地面は どの子の体ともぶつかる（子ごとに組を分ける＝こえのこ voice.html の groupKid）
// ANAT: 関節を本物の曲がる向きだけにする（2026-11-08 ユーザー「後ろ足が変に折れ曲がったまま走れるようになってしまった。本来の動きを参考に学習し直しても」）
// 向きは tools/jointsign.mjs で測った（＋で先の骨が前・上へ）。ひざ −0.3 曲げ〜＋1.8 のばす、かかと −2.2 のばす〜＋0.3 曲げ、ひじ −0.1〜＋1.8、手首 −1.4〜＋0.15
// これまでの跳び方（turn2 など）は両向きに曲がる体で覚えたので、ANAT=false のまま使う。学習した数の json に anat: true があれば、その体で作る
export let ANAT = false; export const setAnatomical = b => (ANAT = !!b);

// リズムの数（0..1）→ 意味のある値。足ごとの位相は「周」
export const PARAMS = [
  ['freq', 1.5, 5], ['spA', 0, 0.8], ['spO', -0.4, 0.4], ['spP', 0, 1], // 背骨は大きく丸めてのばす（後ろ足を前足の前へ運ぶ）
  ['hipA', 0, 1.1], ['hipO', -0.6, 0.6],
  ['kneeA', 0, 1.1], ['kneeO', -0.8, 0.8], ['kneeP', 0, 1],
  ['ankA', 0, 1.1], ['ankO', -0.8, 0.8], ['ankP', 0, 1],
  ['shA', 0, 1.1], ['shO', -0.6, 0.6], ['shP', 0, 1],
  ['elA', 0, 1.1], ['elO', -0.8, 0.8], ['elP', 0, 1],
  // 左右のずれ: ノウサギは後ろ足を左右ほぼそろえて着き（0〜0.15周）、前足は少しずらして着く（0〜0.35周）。手本: 跳び方と足あと（生き物監修）
  ['hLR', 0, 0], ['fLR', 0, 0], ['turn', -1, 1], ['neck', -0.5, 0.5], // 左右のずれ hLR・fLR は 0 に決めた（GAME.md 9.7。左右対称のほうが体の不自由さに見えにくい。2026-11-07 ユーザー）
  // 立ち直りの反射（前庭のつりあいの見立て）: 体の前後の傾き（ピッチ）とその速さ、左右の傾き（ロール）に応じて足の角度を足す。向きと強さも学習
  ['pK', -2, 2], ['pD', -0.3, 0.3], ['pKf', -2, 2], ['rK', -2, 2],
  // 足を横へ出して支える反射: 左右の傾きとその速さに応じて、股と肩を横へ開く（傾いた側へ足を置く）
  ['aK', -2, 2], ['aD', -0.03, 0.03], // 傾きの速さの項は少しでも大きいと暴れる（立つ試し tools/stand.mjs）
];
export const decodeParams = v => Object.fromEntries(PARAMS.map(([k, a, b], i) => [k, a + (b - a) * Math.max(0, Math.min(1, v[i] ?? 0.5))])); // 古いリズム（数が少ない）は、足りない分を真ん中に

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// 線分（a→b）に沿うカプセルの向き（Rapier のカプセルは y 軸）
function alongQ(a, b) {
  const d = sub(b, a), L = Math.hypot(...d), u = d.map(v => v / L), y = [0, 1, 0];
  const c = [y[1] * u[2] - y[2] * u[1], y[2] * u[0] - y[0] * u[2], y[0] * u[1] - y[1] * u[0]], w = 1 + u[1], n = Math.hypot(c[0], c[1], c[2], w) || 1;
  return w < 1e-6 ? { x: 0, y: 0, z: 1, w: 0 } : { x: c[0] / n, y: c[1] / n, z: c[2] / n, w: w / n };
}

// 体を作る。o＝足もとの地面の点、groundH＝地面の高さの関数、yaw＝向き（0＝+x、+ で左＝+z へ回る。起き直すときに使う）
export function buildHare(R, world, o, groundH, yaw = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), rot = p => [p[0] * cy - p[2] * sy, p[1], p[0] * sy + p[2] * cy]; // 体の中の位置・関節の軸を、向きに合わせて回す
  // 体の高さは、足先（かかと・指先）の下の地面のいちばん高いところに合わせる（傾いた所で前足が地面に埋まらないように）
  const y0 = Math.max(...[[-0.15, 0.05], [-0.02, 0.05], [0.14, 0.035], [0.18, 0.035]].flatMap(([x, z]) => [[x, 0, z], [x, 0, -z]].map(p => rot(p)).map(p => groundH(o[0] + p[0], o[2] + p[2])))) + 0.002;
  const P = p => { const r = rot(p); return [o[0] + r[0], y0 + r[1], o[2] + r[2]]; };
  const parts = {}, joints = [], feet = [];
  const seg = (name, a, b, r, mass, opt = {}) => {
    const A = P(a), Bp = P(b), c = A.map((v, i) => (v + Bp[i]) / 2), L = Math.hypot(...sub(Bp, A));
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setLinearDamping(0.05).setAngularDamping(0.3).setCcdEnabled(!!opt.foot));
    const col = R.ColliderDesc.capsule(Math.max(0.001, L / 2 - r * 0.2), r).setRotation(alongQ(A, Bp)).setMass(mass).setFriction(opt.fr ?? 0.6).setCollisionGroups(SELF);
    world.createCollider(col, body);
    parts[name] = { body, c, a: A, b: Bp, r, len: L, mass };
    if (opt.foot) feet.push({ name, body, r, hind: opt.hind, side: opt.side, down: false, at: null, ends: [sub(A, c), sub(Bp, c)] }); // 足の両はし（かかとと指先）の、骨の中心からの位置
    return parts[name];
  };
  const node = (name, p, mass) => { const c = P(p), body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setAngularDamping(0.3)); world.createCollider(R.ColliderDesc.ball(0.005).setMassProperties(mass, { x: 0, y: 0, z: 0 }, { x: NODE_I, y: NODE_I, z: NODE_I }, { x: 0, y: 0, z: 0, w: 1 }).setCollisionGroups(0), body); /* 回りにくさは骨なみに（小さすぎると、つながった関節が解けずに崩れる） */ parts[name] = { body, c, r: 0.005, mass }; return parts[name]; };
  const ball = (name, p, r, mass) => { const c = P(p), body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setAngularDamping(0.3)); world.createCollider(R.ColliderDesc.ball(r).setMass(mass).setFriction(0.5).setCollisionGroups(SELF), body); parts[name] = { body, c, r, mass }; return parts[name]; };
  // 関節: 2つの部位を、世界の点 j で、軸（ふつうは左右の軸 z）まわりに回るようにつなぐ。モーターがねらう角度へ引く
  const hinge = (name, pa, pb, j, k, d, lim, ax = { x: 0, y: 0, z: 1 }) => {
    const J = P(j), la = sub(J, pa.c), lb = sub(J, pb.c);
    const A = rot([ax.x, ax.y, ax.z]), data = R.JointData.revolute({ x: la[0], y: la[1], z: la[2] }, { x: lb[0], y: lb[1], z: lb[2] }, { x: A[0], y: A[1], z: A[2] });
    const jt = world.createImpulseJoint(data, pa.body, pb.body, true);
    jt.configureMotorModel(R.MotorModel.ForceBased); // 筋の強さは力のモーメント（N·m／rad）。重さで割る形だと、軽い骨の筋が弱くなりすぎる
    if (lim) jt.setLimits(lim[0], lim[1]);
    const o = { name, jt, k, d, target: 0 }; joints.push(o); return o;
  };
  // 大きさは本物のニホンノウサギ: 頭胴長 45〜54cm・後ろ足（足の甲）12〜14.5cm・1.3〜2.5kg。しゃがんだ姿勢で作る（後ろ足は Z 字に折りたたむ）
  // 胴（腰と胸）と頭
  const pelvis = seg('pelvis', [-0.16, 0.17, 0], [-0.01, 0.18, 0], 0.06, 0.75);
  const chest = seg('chest', [0.01, 0.18, 0], [0.15, 0.19, 0], 0.055, 0.65);
  let head = null;
  if (HEAD_FUSED) { // 胸の骨に、頭の玉をずらしてつける（描くときは off だけずらす）
    const hc = P([0.22, 0.24, 0]), off = sub(hc, chest.c);
    world.createCollider(R.ColliderDesc.ball(0.045).setTranslation(...off).setMass(0.22).setFriction(0.5).setCollisionGroups(SELF), chest.body);
    parts.head = { body: chest.body, c: hc, r: 0.045, mass: 0.22, off, col: 1 };
  } else head = ball('head', [0.22, 0.24, 0], 0.045, 0.22);
  const J = {};
  J.spine = hinge('spine', pelvis, chest, [0, 0.18, 0], 40, 1.2, [-0.9, 0.9]);
  if (head) J.neck = hinge('neck', chest, head, [0.17, 0.21, 0], 6, 0.2, [-0.8, 0.8]);
  for (const s of [1, -1]) {
    const z = 0.05 * s, zf = 0.035 * s, L = s > 0 ? 'L' : 'R';
    // 後ろ足: 腰 → ひざ（前） → かかと（後ろ） → つま先（前、長い足の甲は地面につく）
    const th = seg('thigh' + L, [-0.12, 0.15, z], [-0.03, 0.10, z], 0.022, 0.16);   // もも 10cm
    const sh = seg('shank' + L, [-0.03, 0.10, z], [-0.15, 0.04, z], 0.014, 0.07);   // すね 13cm
    const ft = seg('hfoot' + L, [-0.15, 0.04, z], [-0.02, 0.012, z], 0.011, 0.04, { foot: true, hind: true, side: s, fr: 1.6 }); // 足の甲 13cm
    // 股は球関節: 横へ開く節（x 軸）→ 前後に振る（z 軸）
    const X = { x: 1, y: 0, z: 0 }, hn = NODE_M ? node('hipN' + L, [-0.12, 0.15, z], NODE_M) : pelvis;
    if (NODE_M) J['abh' + L] = hinge('abh' + L, pelvis, hn, [-0.12, 0.15, z], 30, 0.9, [-0.5, 0.5], X);
    J['hip' + L] = hinge('hip' + L, hn, th, [-0.12, 0.15, z], 40, 1.2, [-1.4, 1.4]);
    J['knee' + L] = hinge('knee' + L, th, sh, [-0.03, 0.10, z], 30, 0.9, ANAT ? [-0.3, 1.8] : [-1.6, 1.6]);
    J['ank' + L] = hinge('ank' + L, sh, ft, [-0.15, 0.04, z], 20, 0.6, ANAT ? [-2.2, 0.3] : [-1.6, 1.6]);
    // 前足: 肩 → ひじ → 手首 → 指先
    const ua = seg('uarm' + L, [0.12, 0.15, zf], [0.13, 0.08, zf], 0.012, 0.05);
    const fa = seg('farm' + L, [0.13, 0.08, zf], [0.14, 0.025, zf], 0.009, 0.03);
    const ff = seg('ffoot' + L, [0.14, 0.025, zf], [0.18, 0.01, zf], 0.008, 0.015, { foot: true, hind: false, side: s, fr: 1.6 });
    const sn = NODE_M ? node('shN' + L, [0.12, 0.15, zf], NODE_M / 2) : chest;
    if (NODE_M) J['abf' + L] = hinge('abf' + L, chest, sn, [0.12, 0.15, zf], 10, 0.3, [-0.5, 0.5], X);
    J['sh' + L] = hinge('sh' + L, sn, ua, [0.12, 0.15, zf], 12, 0.36, [-1.4, 1.4]);
    J['el' + L] = hinge('el' + L, ua, fa, [0.13, 0.08, zf], 8, 0.24, ANAT ? [-0.1, 1.8] : [-1.6, 1.6]);
    J['wr' + L] = hinge('wr' + L, fa, ff, [0.14, 0.025, zf], 4, 0.12, ANAT ? [-1.4, 0.15] : [-1.2, 1.2]);
  }
  for (const j of joints) j.jt.configureMotorPosition(0, j.k, j.d);
  return { parts, joints: J, list: joints, feet, mass: Object.values(parts).reduce((t, p) => t + p.mass, 0) };
}

// 筋のリズム: 関節ごとに、ねらう角度＝ずれ＋大きさ×sin(2π(f·t＋位相))。g＝歩く強さ（0 で立ち止まる）、turn＝曲がる（＋で左）
// 左右で大きさを変えて曲がる（左へ曲がるときは左の歩はばを小さく）。学習で turn の効き方（向きと強さ）も決まる
export function drive(H, q, t, g = 1, turn = 0, old = 0) {
  const ph = q.freq * t, S = x => Math.sin(Math.PI * 2 * x);
  const P = pose(H), dp = H.lastPitch == null ? 0 : (P.pitch - H.lastPitch) * 240, dr = H.lastRoll == null ? 0 : (P.roll - H.lastRoll) * 240; H.lastPitch = P.pitch; H.lastRoll = P.roll;
  const ab = Math.max(-0.45, Math.min(0.45, (q.aK ?? 0) * P.roll + (q.aD ?? 0) * dr)); // 横へ足を出す（左右の足とも同じ向きへ）。傾いた地面では aK≈−0.7 で立てる
  const fb = q.pK * P.pitch + q.pD * dp, fbF = q.pKf * P.pitch; // 前後の傾きへの反射（後ろ足・前足）
  const set = (j, v) => { if (Math.abs(v - j.target) > 1e-4) { j.target = v; j.jt.configureMotorPosition(v, j.k * (1 - 0.4 * old), j.d); } };
  set(H.joints.spine, q.spO + g * q.spA * S(ph + q.spP));
  if (H.joints.neck) set(H.joints.neck, q.neck);
  for (const [L, s] of [['L', 1], ['R', -1]]) {
    const a = g * (1 - q.turn * turn * s * 0.6), hp = s > 0 ? 0 : q.hLR, fp = (s > 0 ? 0 : q.fLR) + q.shP;
    const rl = q.rK * P.roll * s; // 左右の傾きへの反射（低い側の足をのばす）
    set(H.joints['hip' + L], q.hipO + a * q.hipA * S(ph + hp) + fb);
    set(H.joints['knee' + L], q.kneeO + a * q.kneeA * S(ph + hp + q.kneeP) + rl);
    set(H.joints['ank' + L], q.ankO + a * q.ankA * S(ph + hp + q.ankP));
    set(H.joints['sh' + L], q.shO + a * q.shA * S(ph + fp) + fbF);
    set(H.joints['el' + L], q.elO + a * q.elA * S(ph + fp + q.elP) + rl * 0.5);
    set(H.joints['wr' + L], 0);
    if (H.joints['abh' + L]) { set(H.joints['abh' + L], ab); set(H.joints['abf' + L], ab); }
  }
}

// 体のむき（腰から胸へ）と、腰の上向き
export function pose(H) {
  const p = H.parts.pelvis.body, c = H.parts.chest.body, a = p.translation(), b = c.translation();
  const f = [b.x - a.x, 0, b.z - a.z], n = Math.hypot(f[0], f[2]) || 1;
  const r = p.rotation(), up = 1 - 2 * (r.x * r.x + r.z * r.z); // 腰の y 軸が上を向いている度（1＝まっすぐ）
  const pitch = Math.atan2(b.y - a.y, n); // 前が上がると＋
  const ux = 2 * (r.x * r.y - r.w * r.z), uz = 2 * (r.y * r.z + r.w * r.x); // 腰の上向きの軸（世界の向き）
  const roll = Math.atan2(ux * -(f[2] / n) + uz * (f[0] / n), up); // 体の左へ傾くと＋
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, fx: f[0] / n, fz: f[2] / n, yaw: Math.atan2(f[2] / n, f[0] / n), up, pitch, roll };
}
