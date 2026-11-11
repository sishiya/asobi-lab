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

// 体の型（声で決まる。ユーザー「もっと動き自体のバリエーションがほしい」）。骨の名前は同じなので、皮・汚れ・寝姿はそのまま使える
// walk＝歩く（これまでの子）、hop＝ウサギ（長い後ろ足を折りたたんで跳ねる）、bound＝イタチ（胴をしならせて跳ねる）、biped＝トビネズミ（二本足で跳ね、長い尾でつり合う）、seal＝アザラシ（前のヒレとお腹で波打って進む）
// seg・tail＝遺伝子で動く範囲、legK＝足の長さの倍率、fold＝後ろ足の折りたたみの長さ、strong＝足の筋の倍率、spine＝背骨の筋の倍率、wave＝背骨の波のずれ、belly＝胴の摩擦
export const KID_TYPES = {
  walk: { seg: [3, 3], rearAt: 0.1, foreAt: 0.3, strong: 1.7, spine: 2, girthK: 1.1, snout: 0.8 }, // よつあし: クマやイタチと同じく後ろ足は胴のいちばん後ろ（配置を変えて学習し直した。type42〜43）
  // クマ: 後ろ足は胴のいちばん後ろ、前足は胸の下（おしりが足の外へ出ない。手足の配置を先に決めてから学ぶ）。ずんぐりした胴・短い首・長い顔
  donkey: { seg: [2, 2], pairs: 2, rearAt: 0.1, foreAt: 0.3, legK: 1.05, girthK: 1.12, segK: 1.05, strong: 1.7, tail: [1, 1], neck: 1, snout: 0.95, assistK: 1.5, turnRate: 1.1 },
  hop: { seg: [2, 3], pairs: 2, fold: 1.5, strong: 1.8, tail: [0, 1], legTurn: 0, assistK: 2, turnRate: 1.35, slim: 1.85 }, // slim＝節の長さは太さのこの倍まで（細長い胴の子だけ歩けなかった。本物のウサギはずんぐりしている）
  bound: { seg: [3, 3], pairs: 2, rearAt: 0.1, foreAt: 0.3, legK: 0.8, girthK: 0.82, spine: 2, strong: 1.4, tail: [2, 2], neck: 1 }, // イタチ: 細長い胴。クマと同じく後ろ足は胴のいちばん後ろ（手足の配置を先に決めてから学ぶ）
  biped: { tailKind: 'long', tailTaper: [0.36, 0.17], tailLen: 0.8, tailFur: 0.3, seg: [2, 2], pairs: 1, fold: 1.7, strong: 1.8, tail: [3, 4], at: 0.5 }, // tailK＝細長いしっぽ（皮の形だけ）
  seal: { tailKind: 'long', seg: [4, 4], pairs: 1, fore: true, legK: 0.55, girthK: 1.2, spine: 2.5, wave: 0.2, belly: 0.12, fric: { side: 0.5, back: 0.6, front: 0.05 }, strong: 1.2, tail: [1, 2], neck: 0 }, // fric＝毛の流れの摩擦（前へは滑り、うしろへは引っかかる）。スキーのシールと同じ
  // 鳥＝スズメのように二本足を そろえて ちょんちょん跳ねる（左右交互に歩くのは片足で立つつり合いが要り、立てなかった。飛ぶのはあと。GAME.md 9.6）、ヘビ＝足なし。胴を横にくねらせ、うろこの摩擦で前へ（planar＝水平にだけ回る。ひっくり返らない）
  bird: { tailKind: 'long', seg: [2, 2], pairs: 1, fold: 1.7, strong: 1.8, tail: [1, 2], at: 0.5, neck: 1, legTurn: 0, assistK: 2, turnRate: 1.35, snout: 0, tailK: [0.6, 0.3], tailLen: 2 / 3, wing: true }, // snout・tailK・wing は皮の形だけ（物理の骨は同じ）
  snake: { tailKind: 'long', seg: [7, 9], pairs: 0, girthK: 0.6, segK: 0.72, spine: 1, wave: -0.12, belly: 0.3, tail: [1, 2], neck: 0, planar: true },
};
// 遺伝子 → 骨格の寸法（整った形の範囲にしぼる）
export function kidPlan(g) {
  const G = k => cl(g[k] ?? 0.5), type = KID_TYPES[g.type] ? g.type : 'walk', T = KID_TYPES[type];
  const pick = (k, base) => (T[k] ? T[k][0] + Math.round(G(k) * (T[k][1] - T[k][0])) : base);
  const s = lerp(0.75, 1.25, G('vtl'));                     // 体の大きさ（声の筒の長さ）
  const juv = cl(G('stop') * 0.65 + G('bold') * 0.45 - 0.1); // 幼さ（頭が大きく足が短い）
  const seg = pick('seg', 2 + Math.round(G('seg') * 2));    // 胴の節 2〜4（多いと長すぎてくねり、虫に見える）
  const pairs = T.pairs ?? 2; // 足は 2対まで（テストプレイ「6本は奇形に見える」） // 足 2対（よつあし）か 3対（節が3つ以上のときだけ）
  const neck = T.neck ?? Math.round(G('neck') * 2), tail = pick('tail', Math.round(G('tail') * 3));
  const girth = lerp(0.8, 1.25, G('girth')) * (T.girthK ?? 1);
  const r = 0.042 * s * girth;                                // 胴の太さ（半径）
  const segL = 0.085 * s * lerp(1, 0.85, juv) * (T.segK ?? 1); // 胴の節の長さ
  const legL = 0.075 * s * lerp(0.8, 1.25, G('legLen')) * lerp(1, 0.85, juv) * (pairs === 3 ? 0.85 : 1) * (T.legK ?? 1); // 足の1節（もも・すね）の長さ。太さとつり合う範囲
  const legR = Math.max(0.011, r * 0.32);
  const headR = 0.045 * s * lerp(1, 1.3, juv) * (T.planar ? 0.62 : 1); // ヘビの頭は胴より少し太いくらい
  return { type, s, juv, seg, pairs, neck, tail, girth, r, segL: T.slim ? Math.min(segL, r * T.slim) : segL, legL, legR, headR, fluff: G('fluff'), fur: type === 'walk' ? 0.017 : undefined, snout: T.snout, tailKind: T.tailKind ?? (type === 'donkey' || type === 'hop' || type === 'walk' || G('tail') < 0.5 ? 'puff' : 'flat'), // クマは丸いしっぽひとつ（テストプレイ）
      rump: !T.tailKind, rumpCut: T.rearAt != null ? Math.max(0, T.rearAt - 0.08) : 0.42, // rump＝おしりは後ろ足のすぐ上で終わる（テストプレイ。手本はモルモット・ナキウサギ。皮の形だけ）
      twist: !T.planar, twistK: 3, twistM: 0.3 }; // ねじりのつなぎは胴の重さの3割を持たせる（20g のつなぎだと物理がぐらつき、歩けなくなった＝tools/twist-check.mjs） // twist＝背骨のねじりの関節（起き上がりに要る。関節をそろえてから歩き方を学ぶ＝2026-11-08 ユーザー）
}

// 体を作る。o＝足もとの地面の点、groundH＝地面の高さ、g＝遺伝子、yaw＝向き
export function buildKid(R, world, o, groundH, g, yaw = 0, over = null) { // over＝骨格の寸法を上書き（実在の種、tanuki.js）
  const K = { ...kidPlan(g), ...(over || {}) }, T = KID_TYPES[K.type] ?? {}, cy = Math.cos(yaw), sy = Math.sin(yaw), rot = p => [p[0] * cy - p[2] * sy, p[1], p[0] * sy + p[2] * cy];
  const hipY = K.pairs === 0 ? K.r + 0.002 : K.legL * 1.75 + K.legR, zL = K.r * 0.75, AX = T.planar ? [0, 1, 0] : [0, 0, 1]; // 胴の高さ（足は少し曲げて立つ）・足の左右の間・背骨や尾の曲がる軸
  const len = K.seg * K.segL, x0 = -len / 2;
  // 足の付け根の x（後ろの対は腰、前の対は胸、3対のときは真ん中）。1対の型: トビネズミは重心の真下（at）、アザラシは胸
  const pairX = K.pairs === 0 ? [] : K.pairs === 1 ? [T.fore ? x0 + len - K.segL * 0.5 : x0 + len * T.at] : K.pairs === 3 ? [x0 + K.segL * 0.5, 0, x0 + len - K.segL * 0.5] : [x0 + K.segL * (T.rearAt ?? 0.5), x0 + len - K.segL * (T.foreAt ?? 0.5)];
  const feetPts = pairX.flatMap(x => [[x + K.legL * 0.3, 0, zL], [x + K.legL * 0.3, 0, -zL]]);
  const y0 = Math.max(...(feetPts.length ? feetPts : [[x0, 0, 0], [0, 0, 0], [x0 + len, 0, 0]]).map(p => rot(p)).map(p => groundH(o[0] + p[0], o[2] + p[2]))) + 0.002;
  const P = p => { const q = rot(p); return [o[0] + q[0], y0 + q[1], o[2] + q[2]]; };
  const parts = {}, list = [], feet = [], J = {};
  const vol = (r, L) => Math.PI * r * r * L + 4 / 3 * Math.PI * r ** 3, dens = 900; // 重さは体積から（水よりすこし軽い）
  const seg = (name, a, b, r, opt = {}) => {
    const A = P(a), B = P(b), c = A.map((v, i) => (v + B[i]) / 2), L = Math.hypot(...sub(B, A)), mass = opt.mass ?? vol(r, L) * dens;
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setLinearDamping(0.05).setAngularDamping(0.3).setCcdEnabled(!!opt.foot));
    world.createCollider(R.ColliderDesc.capsule(Math.max(0.001, L / 2 - r * 0.2), r).setRotation(alongQ(A, B)).setMass(mass).setFriction(opt.fr ?? 0.6).setFrictionCombineRule(T.belly && !opt.foot ? R.CoefficientCombineRule.Min : R.CoefficientCombineRule.Average).setCollisionGroups(SELF), body);
    parts[name] = { body, c, a: A, b: B, r, len: L, mass };
    if (opt.foot) feet.push({ name, body, r, hind: opt.hind, side: opt.side, down: false, at: null, ends: [sub(A, c), sub(B, c)] });
    return parts[name];
  };
  const ball = (name, p, r) => { const c = P(p), mass = 4 / 3 * Math.PI * r ** 3 * dens, body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setAngularDamping(0.3)); world.createCollider(R.ColliderDesc.ball(r).setMass(mass).setFriction(T.belly ?? 0.5).setFrictionCombineRule(T.belly ? R.CoefficientCombineRule.Min : R.CoefficientCombineRule.Average).setCollisionGroups(SELF), body); parts[name] = { body, c, r, mass }; return parts[name]; };
  const node = (name, p, mass, I = NODE_I) => { const c = P(p), body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setAngularDamping(0.3)); world.createCollider(R.ColliderDesc.ball(0.005).setMassProperties(mass, { x: 0, y: 0, z: 0 }, { x: I, y: I, z: I }, { x: 0, y: 0, z: 0, w: 1 }).setCollisionGroups(0), body); parts[name] = { body, c, r: 0.005, mass }; return parts[name]; };
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
    torso.push(seg(name, [x0 + i * K.segL + 0.004, hipY, 0], [x0 + (i + 1) * K.segL - 0.004, hipY, 0], K.r, T.belly ? { fr: T.belly } : {}));
  }
  const M0 = torso.reduce((t, p) => t + p.mass, 0);
  const kS = 40 * M0 / 1.4 * (T.spine ?? 1); // 背骨の強さ（ノウサギの胴 1.4kg で 40）
  // 背骨: 上下に曲げる（sp）。twist のときは、その前に体の軸まわりのねじり（tw）をはさむ（起き上がりのため。ロボットの研究で、背のねじりが起き上がりに要る力を大きく減らす。歩くときは 0 に保つ）
  for (let i = 1; i < K.seg; i++) {
    const jp = [x0 + i * K.segL, hipY, 0];
    if (K.twist) { const tk = K.twistK ?? 1, nm = (K.twistM ?? 0) * M0 / K.seg, tn = node('tw' + i, jp, Math.max(0.02, nm), Math.max(NODE_I, 0.4 * nm * K.r * K.r)); J['tw' + i] = hinge('tw' + i, torso[i - 1], tn, jp, kS * tk, kS * tk * 0.03, [-0.8, 0.8], [1, 0, 0]); J['sp' + i] = hinge('sp' + i, tn, torso[i], jp, kS, kS * 0.03, [-0.6, 0.6]); }
    else J['sp' + i] = hinge('sp' + i, torso[i - 1], torso[i], jp, kS, kS * 0.03, [-0.6, 0.6], AX);
  }
  // 首と頭（首の節は角度を保つだけ）
  let prev = torso[K.seg - 1], hx = x0 + len, hy = hipY;
  for (let i = 0; i < K.neck; i++) { const n = seg('neck' + i, [hx, hy, 0], [hx + K.segL * 0.5, hy + K.segL * 0.35, 0], K.r * 0.7); hinge('nk' + i, prev, n, [hx, hy, 0], kS * 0.3, kS * 0.01, [-0.5, 0.5]); prev = n; hx += K.segL * 0.5; hy += K.segL * 0.35; }
  const head = ball('head', [hx + K.headR * 0.8, hy + K.headR * 0.4, 0], K.headR); hinge('hd', prev, head, [hx, hy, 0], kS * 0.3, kS * 0.01, [-0.5, 0.5], AX);
  // 尾（ばねでゆれるだけ。ぶらさげて引きずらないよう、少し上へ）
  prev = torso[0]; let tx = x0, ty = hipY;
  for (let i = 0; i < K.tail; i++) { const r = K.r * lerp(0.55, 0.3, i / Math.max(1, K.tail)), L = K.segL * 0.6, n = seg('tail' + i, [tx, ty, 0], [tx - L, ty + L * (T.planar ? 0 : 0.25), 0], r, T.belly ? { fr: T.belly } : {}); hinge('tl' + i, prev, n, [tx, ty, 0], kS * 0.15, kS * 0.006, [-0.7, 0.7], AX); prev = n; tx -= L; ty += L * (T.planar ? 0 : 0.25); }
  // 足: 付け根（横へ開く節）→ もも → すね → 足先。どの対も同じ作り（前の対は肩、後ろの対は腰）
  const M = M0 + Object.values(parts).filter(p => !torso.includes(p)).reduce((t, p) => t + p.mass, 0);
  const kL = 17 * (M / K.pairs * 2) * (K.legL / 0.12) * 2 * (T.strong ?? 1); // 足の筋の強さ（ノウサギの股 40 を、1対が受け持つ重さと足の長さで）。ねばりは強さの 0.6% ほど（ノウサギと同じ 3% だと、重い体では関節がふるえて崩れた＝tools/kid-diag2.mjs）
  const PN = K.pairs === 0 ? [] : K.pairs === 1 ? [T.fore ? 'f' : 'h'] : K.pairs === 3 ? ['h', 'm', 'f'] : ['h', 'f'];
  PN.forEach((pn, pi) => {
    const x = pairX[pi], host = K.pairs === 1 ? torso[T.fore ? K.seg - 1 : 0] : pi === 0 ? torso[0] : pi === PN.length - 1 ? torso[K.seg - 1] : torso[1];
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', z = zL * s, kx = 1; // 前の対も同じ強さ（頭と首の重さがかかる）
      // 後ろの対はひざが前（＜の逆）、前の対は柱のようにまっすぐ下りてひじが後ろ（本物のよつあしの前足と後ろ足）
      const fr = pn !== 'h', F = !fr && T.fold ? K.legL * T.fold : 0; // F＝長い後ろ足をZ字に折りたたむ長さ（ウサギ・トビネズミ。腰の高さは変えず、ひざを前へ・かかとを後ろへ・足の甲を長く）
      const knee = fr ? [x - K.legL * 0.12, hipY - K.legL * 0.97, z] : F ? [x + F * 0.55, hipY - K.legL * 0.8, z] : [x + K.legL * 0.25, hipY - K.legL * 0.95, z], ankle = fr ? [x + K.legL * 0.02, hipY - K.legL * 1.92 + K.legR, z] : F ? [x - F * 0.45, hipY - K.legL * 1.5, z] : [x - K.legL * 0.05, hipY - K.legL * 1.9 + K.legR, z], toe = [x + (F ? F * 0.55 : K.legL * (fr ? 0.3 : 0.35)), K.legR, z];
      const nd = node(pn + 'N' + L, [x, hipY, z], 0.02);
      J['ab' + pn + L] = hinge('ab' + pn + L, host, nd, [x, hipY, z], kL * 0.75, kL * 0.004, [-0.9, 0.9], [1, 0, 0]); // 横へ開く範囲は起き上がりのために広め（歩くときの目標は ±0.45 まで）
      const th = seg(pn + 'up' + L, [x, hipY, z], knee, K.legR * 1.4);
      const sh = seg(pn + 'lo' + L, knee, ankle, K.legR);
      const ft = seg(pn + 'ft' + L, ankle, toe, K.legR * 0.9, { foot: true, hind: pn === 'h', side: s, fr: 1.6 });
      J['hip' + pn + L] = hinge('hip' + pn + L, nd, th, [x, hipY, z], kL * kx, kL * kx * 0.006, [-1.4, 1.4]);
      J['knee' + pn + L] = hinge('knee' + pn + L, th, sh, knee, kL * 0.75 * kx, kL * 0.0045 * kx, [-1.6, 1.6]);
      J['ank' + pn + L] = hinge('ank' + pn + L, sh, ft, ankle, kL * 0.4 * kx, kL * 0.0025 * kx, [-1.4, 1.4]);
    }
  });
  for (const j of list) j.jt.configureMotorPosition(0, j.k, j.d);
  // うろこ: 節ごとの体の軸の向き（作ったときは回転なしなので、ここで骨の中の向きとして持つ）。頭は前向き。Rapier の回転の固定はモーターと合わせると発散したので、平らなお腹は力で保つ（scaleFriction）
  const scales = T.planar || T.fric ? Object.entries(parts).filter(([n]) => /^(pelvis|mid|chest|tail|head)/.test(n)).map(([, p]) => { const d = p.a ? sub(p.b, p.a) : rot([1, 0, 0]), L = Math.hypot(...d); return { p, ax: d.map(v => v / L), I: p.mass * (p.r * p.r * 0.4 + (p.len ?? 0) ** 2 / 12) }; }) : null;
  const assist = ['hop', 'bound', 'biped', 'bird', 'seal', 'donkey'].includes(K.type) ? Object.values(parts).reduce((t, p) => t + p.mass * ((p.c[0] - o[0]) ** 2 + (p.c[2] - o[2]) ** 2), 0) * (T.assistK ?? 1) : 0; // 回りにくさ（向きを変える補助に使う）
  return { kind: 'kid', plan: K, wave: T.wave ?? 0, scales, fric: T.fric ?? SCALE, belly: T.belly ?? 0, ground: groundH, assist, turnRate: T.turnRate ?? 0.9, legTurn: T.legTurn ?? 1, pairNames: PN, parts, joints: J, list, feet, fallH: T.fore || T.planar ? -1 : K.r * 0.8, maxPitch: K.type === 'walk' ? 0.6 : 0.9, noTouch: T.fore || T.planar ? null : [parts.head, ...torso], mass: Object.values(parts).reduce((t, p) => t + p.mass, 0) }; // fallH＝胴がおなかを地面につけるほど低くなったら転んだ
}

// リズムの数（0..1）→ 値。左右のずれは「そろえる（0）」か「交互（0.5）」のどちらかの対称な歩き方だけ（GAME.md 9.7）
export const KID_PARAMS = [
  ['freq', 1, 4.5], ['spA', 0, 0.5], ['spP', 0, 1],
  ['hipA', 0, 0.9], ['hipO', -0.5, 0.5], ['kneeA', 0, 1], ['kneeO', -0.6, 0.6], ['kneeP', 0, 1], ['ankA', 0, 0.8], ['ankP', 0, 1],
  ['pairP', 0, 1], ['side', 0, 1], // pairP＝前の対の位相（後ろの対から）、side＝0.5 より上なら左右交互、下ならそろえる
  ['turn', -1, 1], ['pK', -2, 2], ['pD', -0.05, 0.05], ['rK', -2, 2], ['aK', -2, 2], ['aD', -0.03, 0.03],
  ['abA', -0.3, 0.3], ['abP', 0, 1], ['abT', -0.3, 0.3], // 足の横の振り（ユーザー「左右に遊びができると動きの幅が広がりそう」）: abA＝外へ振る大きさ（左右は鏡）、abP＝前後の振りとのずれ、abT＝曲がるときに両足をそろって曲がる側へ振る。まんなか（0.5）で 0＝前からの歩き方はそのまま
  ['tlK', -2, 2], // 尾でつり合う反射（体の前後の傾きに応じて尾の付け根を振る。トビネズミ）。まんなかで 0
];
export const decodeKid = v => Object.fromEntries(KID_PARAMS.map(([k, a, b], i) => [k, a + (b - a) * cl(v[i] ?? 0.5)]));
export const encodeKid = o => KID_PARAMS.map(([k, a, b]) => cl(((o[k] ?? (a + b) / 2) - a) / (b - a)));
// 手本の出発点（どの体にも同じ）: よつあしの速歩（左右交互・前後の対は半周ずれ＝対角の足がいっしょ）。横へ足を出す反射は立つ試しの値
// のっそり歩く（横の順: 左後ろ→左前→右後ろ→右前、1.6回/秒）。ひざは前へ振るときに曲げて足を上げる（tools/kid-probe.mjs でタヌキが転ばず 1m）
export const KID_SEED = encodeKid({ freq: 1.6, spA: 0.05, spP: 0.5, hipA: 0.3, hipO: 0, kneeA: 0.3, kneeO: 0, kneeP: 0.75, ankA: 0.25, ankP: 0.25, pairP: 0.25, side: 0.8, turn: 0.5, pK: 0, pD: 0, rK: 0, aK: -0.7, aD: 0 });
export const KID_TROT = encodeKid({ ...decodeKid(KID_SEED), freq: 1.6, pairP: 0.5 });
export const KID_SLOW = encodeKid({ ...decodeKid(KID_SEED), freq: 1.1, hipA: 0.22, kneeA: 0.22, ankA: 0.18 }); // ゆっくり小またの歩き（行きづまったときの出発点）
// 型ごとの出発点。side は 0.5 より下＝左右そろえて跳ねる（学習で交互にもどらないよう、LOCK で止める）
const seedOf = o => encodeKid({ ...decodeKid(KID_SEED), side: 0.2, ...o });
const GAITS = {
  walk: [{ freq: 1.6, side: 0.8, spA: 0.05, spP: 0.5, hipA: 0.3, kneeA: 0.3, kneeP: 0.75, ankA: 0.25, ankP: 0.25, pairP: 0.25 }, { freq: 1.8, side: 0.8, spA: 0.05, spP: 0.5, hipA: 0.28, kneeA: 0.28, kneeP: 0.75, ankA: 0.22, ankP: 0.25, pairP: 0.5 }, { freq: 1.2, side: 0.8, spA: 0.03, spP: 0.5, hipA: 0.22, kneeA: 0.22, kneeP: 0.75, ankA: 0.18, ankP: 0.25, pairP: 0.25 }],
  hop: [{ freq: 2.8, spA: 0.2, spP: 0.5, hipA: 0.45, kneeA: 0.5, kneeP: 0.75, ankA: 0.4, ankP: 0.25, pairP: 0.35 }, { freq: 2.2, spA: 0.12, spP: 0.5, hipA: 0.32, kneeA: 0.36, kneeP: 0.75, ankA: 0.28, ankP: 0.25, pairP: 0.3 }, { freq: 3.2, spA: 0.28, spP: 0.4, hipA: 0.55, kneeA: 0.55, kneeP: 0.7, ankA: 0.45, ankP: 0.25, pairP: 0.45 }],
  bound: [{ freq: 2.6, spA: 0.4, spP: 0.25, hipA: 0.4, kneeA: 0.4, kneeP: 0.75, ankA: 0.3, ankP: 0.25, pairP: 0.5 }, { freq: 2, spA: 0.28, spP: 0.25, hipA: 0.3, kneeA: 0.3, kneeP: 0.75, ankA: 0.22, ankP: 0.25, pairP: 0.5 }, { freq: 3.2, spA: 0.48, spP: 0.2, hipA: 0.45, kneeA: 0.45, kneeP: 0.7, ankA: 0.3, ankP: 0.25, pairP: 0.4 }],
  donkey: [{ freq: 1.6, side: 0.8, spA: 0.05, spP: 0.5, hipA: 0.3, kneeA: 0.3, kneeP: 0.75, ankA: 0.25, ankP: 0.25, pairP: 0.25 }, { freq: 1.8, side: 0.8, spA: 0.05, spP: 0.5, hipA: 0.28, kneeA: 0.28, kneeP: 0.75, ankA: 0.22, ankP: 0.25, pairP: 0.5 }, { freq: 1.2, side: 0.8, spA: 0.03, spP: 0.5, hipA: 0.22, kneeA: 0.22, kneeP: 0.75, ankA: 0.18, ankP: 0.25, pairP: 0.25 }],
  biped: [{ freq: 2, spA: 0, hipA: 0.3, hipO: -0.15, kneeA: 0.36, kneeP: 0.75, ankA: 0.3, ankP: 0.25, pairP: 0, pK: 1, tlK: -1 }, { freq: 3, spA: 0, hipA: 0.15, hipO: 0.15, kneeA: 0.18, kneeP: 0.75, ankA: 0.15, ankP: 0.25, pairP: 0, pK: 0, tlK: -0.6 }, { freq: 2.5, spA: 0, hipA: 0.22, hipO: 0, kneeA: 0.26, kneeP: 0.75, ankA: 0.22, ankP: 0.25, pairP: 0, pK: 0.6, tlK: -1 }],
  bird: [{ freq: 3.4, spA: 0, hipA: 0.15, hipO: 0.15, kneeA: 0.18, kneeP: 0.75, ankA: 0.15, ankP: 0.25, pairP: 0, pK: 0, tlK: -0.5 }, { freq: 2.4, spA: 0, hipA: 0.25, hipO: -0.1, kneeA: 0.3, kneeP: 0.75, ankA: 0.25, ankP: 0.25, pairP: 0, pK: 1, tlK: -0.5 }, { freq: 3, spA: 0, hipA: 0.2, hipO: 0, kneeA: 0.24, kneeP: 0.75, ankA: 0.2, ankP: 0.25, pairP: 0, pK: 0.6, tlK: -0.5 }],
  snake: [{ freq: 1.2, spA: 0.45, spP: 0, turn: -0.25 }, { freq: 1.1, spA: 0.5, spP: 0, turn: -0.25 }, { freq: 2, spA: 0.5, spP: 0, turn: -0.2 }],
  seal: [{ freq: 2.2, spA: 0.5, spP: 0, hipA: 0.3, hipO: 0.3, kneeA: 0.2, kneeP: 0.75, ankA: 0.1, ankP: 0.25, pairP: 0, aK: 0 }, { freq: 1.6, spA: 0.5, spP: 0, hipA: 0.3, hipO: 0.3, kneeA: 0.2, kneeP: 0.75, ankA: 0.1, ankP: 0.25, pairP: 0, aK: 0 }, { freq: 1, spA: 0.5, spP: 0.5, hipA: 0.3, hipO: -0.3, kneeA: 0.2, kneeP: 0.75, ankA: 0.1, ankP: 0.25, pairP: 0, aK: 0 }],
};
// うまく歩けた子の動き（手本）。同じ型のほかの子の出発点にする（tools/logs/type2・type3 の hop 1・biped 1・bird 3、type30 の bound 2）
const LEARNED = {"walk":[0.816,0.026,0.477,0.161,0.859,0.464,0.421,0.813,0.608,0,0.535,0.971,0.288,0.551,0.671,0.376,0.341,0.346,0.541,0.381,0.342,0.5],"hop":[0.576,0.291,0.298,0.313,0.54,0.149,0.247,0.741,0.253,0.119,0.432,0.2,0.962,0.719,0.564,0.607,0.305,0.454,0.388,0.38,0.611,0.5],"bound":[0.707,0.859,0.225,0.423,0.999,0.501,0.571,0.294,0.706,0.052,0.538,0.2,0.473,0.638,0.602,0.104,0.433,0.372,0.537,0.618,0.573,0.5],"biped":[1,0.2,0.492,0.405,0.623,0.084,0.419,0.92,0.217,0.003,0.185,0.2,0.861,0.706,0.282,0.589,0.327,0.375,0.556,0.539,0.599,0.582],"bird":[0.75,0.404,0.732,0.529,0.573,0.014,0.112,0.527,0.268,0.451,0.189,0.2,0.289,0.542,0.483,0.858,0.353,0.387,0.5,0.5,0.5,0.696]};
const TYPE_SEEDS = Object.fromEntries(Object.entries(GAITS).map(([k, a]) => [k, [...(LEARNED[k] ? [LEARNED[k]] : []), ...a.map(seedOf)]]));
const BY_SEG = { donkey: { 2: [0.662,0.252,0.321,0.208,0.618,0.217,0.212,0.584,0.703,0.08,0.448,0.605,0.877,0.423,0.886,0.502,0.278,0.35,0.543,0.837,0.468,0.5] }, bird: { 2: [0.75,0.404,0.732,0.529,0.573,0.014,0.112,0.527,0.268,0.451,0.189,0.2,0.289,0.542,0.483,0.858,0.353,0.387,0.5,0.5,0.5,0.696] }, hop: { 2: [0.631,0.39,0.753,0.446,0.452,0.034,0.369,0.311,0.501,0.449,0.84,0.2,0.491,0.999,0.522,0.502,0.318,0.363,0.476,0.489,0.558,0.5], 3: [0.576,0.832,0.158,0.875,0.752,0.011,0.067,0.425,0.477,0.038,0.347,0.2,0.694,0.744,0.577,0.485,0.284,0.482,0.4,0.4,0.189,0.5] } }; // 手本は、よく歩けた子の動き（胴の節の数ごと。節3は動きの穏やかな子がよかった、節2は穏やかな子だと崩れた。tools/logs/type6 の 5・type7 の 14。鳥は type3 の 3）
const MORE_SEEDS = { walk: [[0.597,0.04,0.202,0.21,0.92,0.29,0.18,0.789,0.764,0.036,0.611,0.753,0.575,0.35,0.559,0.27,0.314,0.38,0.568,0.431,0.323,0.5],[0.414,0.076,0.172,0.203,1,0.305,0.178,0.78,0.789,0.096,0.593,0.8,0.563,0.578,0.468,0.408,0.25,0.347,0.512,0.278,0.3,0.5],[0.34,0.128,0.705,0.356,0.664,0.293,0.449,0.646,0.69,0.132,0.692,0.659,0.435,0.628,0.788,0.514,0.292,0.372,0.541,0.381,0.342,0.5]] }; // タヌキは3つの手本をまぜて出発する（初見12頭で 6/8 以上が9頭。tools/logs/type53-walk-M）
const typeSeeds = g => { const s = TYPE_SEEDS[g?.type], b = BY_SEG[g?.type]?.[kidPlan(g).seg], m = MORE_SEEDS[g?.type] ?? [], o = s && b ? [b, ...s] : s ?? null; return m.length ? [...m, ...(o ?? [])] : o; };
export const kidSeed = g => typeSeeds(g)?.[0] ?? KID_SEED; // その子の型の出発点

// ヘビのうろこ: 横には強く・うしろへはほどほど・前へはほとんど滑る摩擦（物理エンジンの摩擦はどの向きも同じなので、ここで力を足す。手本: Hu ら 2009「ヘビの腹のうろこの向きによる摩擦のちがい」）
const SCALE = { side: 1.3, back: 0.5, front: 0.3 }; // 起きているヘビの実測は 前 0.3〜0.5・後ろ 0.8（Marvi 2012）。布の上の実測 前 0.11 のままだと地面の起伏で止まる。1回くねって体長の 0.3 倍進む（実測 0.22±0.08。横 0.8・前 0.06 では 0.59 倍で、レールの上のように進んだ）
export function scaleFriction(H, dt = 1 / 240) {
  const F = H.fric, B = H.belly;
  for (const { p, ax, I } of H.scales) {
    const at = p.body.translation(), touching = at.y - p.r - H.ground(at.x, at.z) < 0.012; // 地面についている節だけ（宙では摩擦は働かない）
    const q = p.body.rotation(), v = p.body.linvel(), w = p.body.angvel(), c = 1 - 2 * q.y * q.y, s = 2 * q.w * q.y, fx = ax[0] * c + ax[2] * s, fz = ax[2] * c - ax[0] * s; // ほぼ水平にだけ回るので、y 軸まわりの回転で軸の向きを出す
    const along = v.x * fx + v.z * fz, sx = v.x - along * fx, sz = v.z - along * fz, sv = Math.hypot(sx, sz), J = 9.81 * dt, m = p.mass;
    const a = Math.min(Math.abs(along), Math.max(0, (along > 0 ? F.front : F.back) - B) * J) * Math.sign(along), b = sv > 1e-6 ? Math.min(sv, Math.max(0, F.side - B) * J) / sv : 0; // 物理エンジンの摩擦（どの向きも belly）に、向きで強い分だけを足す
    if (touching) p.body.applyImpulse({ x: -m * (a * fx + b * sx), y: 0, z: -m * (a * fz + b * sz) }, true);
    const ux = 2 * (q.x * q.y - q.w * q.z), uz = 2 * (q.y * q.z + q.w * q.x), W = 30; // 平らなお腹: 上向きへもどす（ばねとねばり）
    p.body.applyTorqueImpulse({ x: I * dt * (W * W * -uz - 2 * W * w.x), y: 0, z: I * dt * (W * W * ux - 2 * W * w.z) }, true);
  }
}

// 跳ねる型の向きを変える補助: 左右の足をそろえて跳ねるので、足の力の差だけでは向きが変わらない（イタチの調査で 1 匹しか曲がれなかった）。本物は宙で体をひねる。言われた回転の速さへ、胴を少しずつ回す
function turnAssist(H, turn, dt = 1 / 240) {
  if (!turn && !H.turning) return; H.turning = !!turn;
  const p = H.parts.pelvis.body, c = H.parts.chest.body, wy = (p.angvel().y + c.angvel().y) / 2, I = H.assist, tau = Math.max(-1, Math.min(1, (-turn * H.turnRate - wy) * 6)) * I * 12 * dt; // 目標 turnRate rad/秒。強さに上限（ひっくり返さない）
  p.applyTorqueImpulse({ x: 0, y: tau / 2, z: 0 }, true); c.applyTorqueImpulse({ x: 0, y: tau / 2, z: 0 }, true);
}

// 筋のリズム。g＝歩く強さ、turn＝曲がる（＋で左）
export function driveKid(H, q, t, g = 1, turn = 0, pose) {
  const ph = q.freq * t, S = x => Math.sin(Math.PI * 2 * x);
  const P = pose(H), dp = H.lastPitch == null ? 0 : (P.pitch - H.lastPitch) * 240, dr = H.lastRoll == null ? 0 : (P.roll - H.lastRoll) * 240; H.lastPitch = P.pitch; H.lastRoll = P.roll;
  const lt = turn * H.legTurn, ab = Math.max(-0.45, Math.min(0.45, q.aK * P.roll + q.aD * dr)), fb = q.pK * P.pitch + q.pD * dp, alt = q.side > 0.5 ? 0.5 : 0;
  const set = (j, v) => { if (j && Math.abs(v - j.target) > 1e-4) { j.target = v; j.jt.configureMotorPosition(v, j.k, j.d); } };
  if (H.joints.tl0 && q.tlK) set(H.joints.tl0, Math.max(-0.6, Math.min(0.6, q.tlK * P.pitch)));
  if (H.scales) scaleFriction(H);
  if (H.assist) turnAssist(H, g * turn);
  for (let i = 1; i < H.plan.seg; i++) { set(H.joints['sp' + i], g * q.spA * S(ph + q.spP - i * (H.wave ?? 0)) + (H.scales ? turn * q.turn * 0.25 : 0)); const tw = H.joints['tw' + i]; if (tw && !tw.walk) { tw.walk = true; tw.target = 0; tw.jt.configureMotorPosition(0, tw.k * 8, tw.d * 8); } } // 背骨のねじりは、歩くときは固く（起き上がるときだけゆるめる＝getup.js）。ゆるいままだと歩くのを覚えにくかった
  const n = H.pairNames.length;
  H.pairNames.forEach((pn, pi) => {
    const pp = n === 1 ? 0 : q.pairP * pi / (n - 1);
    for (const [L, s] of [['L', 1], ['R', -1]]) {
      const a = g * (1 - q.turn * lt * s * 0.6), p = ph + pp + (s > 0 ? 0 : alt), rl = q.rK * P.roll * s;
      set(H.joints['hip' + pn + L], q.hipO + a * q.hipA * S(p) + fb);
      const ks = pn === 'h' ? 1 : -1; // 前の対はひざ（ひじ）の向きが逆なので、曲げる・のばすをそろえるため符号を変える
      set(H.joints['knee' + pn + L], ks * (q.kneeO + a * q.kneeA * S(p + q.kneeP)) + rl);
      set(H.joints['ank' + pn + L], a * q.ankA * S(p + q.ankP));
      const sw = a * q.abA * S(p + q.abP) * -s + lt * q.abT * S(p + q.abP); // 横の振り: 外へ（左は +z＝ab の −、右は −z＝ab の ＋）と、曲がる側へ
      set(H.joints['ab' + pn + L], Math.max(-0.6, Math.min(0.6, ab + sw)));
    }
  });
}

// 肉づき（皮を作るための形）: 胴はなめらかにつなぎ、首と頭、尾、足。太さは毛こみ
const SEAL_GIRTH = [0.62, 1.25, 1.55, 1.55, 1.15]; // アザラシの胴の太さ（骨の太さに対して。うしろ→首）。いちばん太いのは胸のうしろ〜胴の中ほどで、腰へ細くしぼる。本物は 体長÷胴の径 が 5.5 前後、ここは太らせて 4 弱
export function kidShapes(H) {
  const P = H.parts, K = H.plan, S = [], fur = K.fur ?? 0.006 + 0.008 * K.fluff, T = KID_TYPES[K.type] ?? {}, tk = T.tailK ?? [1, 0.8], FAT = ['walk', 'donkey', 'bound'].includes(K.type), fat = K.type === 'walk' ? 1.08 : FAT ? 1.22 : 1, tanukiTail = (name, a) => { const b = sub(P.pelvis.a, P.pelvis.b), L = Math.hypot(b[0], b[2]) || 1, at = (k, y) => [a[0] + b[0] / L * K.r * k, a[1] - K.r * y, a[2] + b[2] / L * K.r * k], pts = [0, 0.33, 0.66, 1].map(t => at(1.8 * t, 0.55 * t)), rs = [0.5, 0.46, 0.36, 0.18], fw = [1, 0.85, 0.6, 0.3]; for (let i = 0; i < 3; i++) cap(name, pts[i], pts[i + 1], K.r * rs[i] + fur * fw[i], K.r * rs[i + 1] + fur * fw[i + 1], 0.03); }; /* 付け根から先へ細くなりながら、ゆるく下がる（途中でふくらませない） */ // fat＝四つ足の胴を肥えさせる（テストプレイ。皮だけ）。tanukiTail＝タヌキの太いしっぽ（皮だけ）
  const cap = (part, a, b, ra, rb, k) => S.push({ part, body: P[part].body, a, b, ra, rb, k });
  for (const [name, p] of Object.entries(P)) {
    if (!p.a) continue;
    if (K.type === 'seal' && (name === 'pelvis' || name === 'chest' || name.startsWith('mid'))) { const i = name === 'pelvis' ? 0 : name === 'chest' ? K.seg - 1 : +name.slice(3), R = j => K.r * SEAL_GIRTH[j], up = (v, j) => [v[0], v[1] + Math.max(0, R(j) - K.r), v[2]]; cap(name, up(p.a, i), up(p.b, i + 1), R(i) + fur, R(i + 1) + fur, 0.05); } // アザラシの胴は本物の輪郭に（テストプレイ「肉厚ずんぐり」）。太らせた分は上へ逃がして、お腹は地面のまま
    else if (name === 'pelvis' && K.rump) cap(name, [p.a[0] + K.segL * K.rumpCut, p.a[1], p.a[2]], p.b, p.r * 0.86 * fat + fur, p.r * fat + fur, 0.05);
    else if (name === 'pelvis' && !T.planar) cap(name, p.a, p.b, p.r * 0.78 * fat + fur, p.r * fat + fur, 0.05); // おしりは細くしぼる（テストプレイ「おむつみたいにもっこり」。皮の形だけ）
    else if (name === 'pelvis' || name === 'chest' || name.startsWith('mid')) cap(name, p.a, p.b, p.r * fat + fur, p.r * fat + fur, 0.04);
    else if (name.startsWith('neck')) cap(name, p.a, p.b, p.r + fur, p.r * 0.9 + fur, 0.03);
    else if (name.startsWith('tail') && K.type === 'walk') { if (name === 'tail0') { const q = P.pelvis; tanukiTail(name, [q.a[0] + K.segL * K.rumpCut - q.r * 0.6 * fat, q.a[1] + K.r * 0.3, q.a[2]]); } } /* タヌキは尾の1節目に太いしっぽ（2節目から先の皮は作らない） */
    else if (name.startsWith('tail') && K.rump) continue; // おしりの端の小さなしっぽは下で（うしろの骨は見せない）
    else if (K.type === 'walk' && /ft[LR]$/.test(name)) cap(name, p.a, p.b, p.r * 0.85 + fur * 0.22, p.r * 0.72 + fur * 0.18, 0.01); // タヌキの足先は細く
    else if (name.startsWith('tail') && K.tailKind === 'puff') { if (name === 'tail0') cap(name, p.a, [p.b[0] - p.r, p.b[1] + p.r * 0.6, p.b[2]], p.r * 0.7 + fur, p.r * 1.55 + fur, 0.02); } // まるい しっぽ（皮だけ。うしろの骨は見せない）
    else if (name.startsWith('tail') && K.tailKind === 'flat') { if (name === 'tail0') { const mx = (p.a[0] + p.b[0]) / 2, my = (p.a[1] + p.b[1]) / 2, tx = p.b[0] + (p.b[0] - p.a[0]) * 0.55, ty = p.b[1] + (p.b[1] - p.a[1]) * 0.55; cap(name, p.a, [mx, my, p.a[2]], p.r * 0.55 + fur * 0.6, p.r * 0.5 + fur * 0.6, 0.02); for (const s of [0, 1, -1]) { const w = s * p.r * 1.05; cap(name, [mx, my, p.a[2] + w * 0.25], [tx, ty, p.a[2] + w], p.r * 0.42 + fur * 0.6, p.r * 0.55 + fur * 0.6, 0.02); } } } // へら状の しっぽ（横に広い）
    else if (name.startsWith('tail')) { const R0 = P.tail0.a, q = T.tailLen ?? 1, at = v => [R0[0] + (v[0] - R0[0]) * q, R0[1] + (v[1] - R0[1]) * q, R0[2] + (v[2] - R0[2]) * q]; const tf = fur * (T.tailFur ?? 1), tt = T.tailTaper, i = +name.slice(4), R = j => K.r * lerp(tt[0], tt[1], j / K.tail) + tf; if (tt) cap(name, at(p.a), at(p.b), R(i), R(i + 1), i ? 0.008 : 0.04); /* 根もとから先まで一本の細り方で（節ごとに太さをもどさない・つなぎ目をふくらませない。テストプレイ「へんなクビレ」） */ else cap(name, at(p.a), at(p.b), p.r * tk[0] + tf, p.r * tk[1] + tf, 0.04); }
    else if (K.type === 'seal' && /(up|lo|ft)[LR]$/.test(name)) cap(name, p.a, p.b, K.r * (name[1] === 'u' ? 0.42 : 0.34) + fur * 0.6, K.r * (name[1] === 'f' ? 0.26 : 0.34) + fur * 0.6, 0.05); // アザラシの腕は節が見えないよう、ひとつながりに（テストプレイ）
    else if ((K.type === 'hop' || K.type === 'biped' || FAT) && /(up|lo)[LR]$/.test(name)) { const m = name[0] === 'h' || FAT ? 1 : 0.72, L = { bound: [0.85, 0.72, 0.03, 0.7], hop: [1, 0.85, 0.04, 0.85], walk: [0.9, 0.62, 0.05, 0.5] }[K.type] ?? [1, 1, 0.06, 1], f = fur * L[3]; /* L＝太もも・すねの太さ、すねのつなぐ幅、毛の長さ。胴の細い子は毛の長さが同じだと左右がくっつく（テストプレイ） */ if (name[2] === 'u' || name[1] === 'u') cap(name, p.a, p.b, K.r * 0.66 * m * L[0] + f, K.r * 0.46 * m * L[0] + f, 0.06); else cap(name, p.a, p.b, K.r * 0.4 * m * L[1] + f, p.r * 1.3 * L[1] + f * 0.8, L[2]); } // ウサギの脚はふっくら太く、膝は毛の中に（テストプレイ「足が貧弱」。皮だけ）
    else if (T.wing && /lo[LR]$/.test(name)) cap(name, p.a, p.b, K.r * 0.5 + fur, p.r * 0.95 + fur * 0.6, 0.05); // 鳥のすねの付け根もふくらませて、膝を羽毛の中に（テストプレイ）
    else if (/up[LR]$/.test(name)) { if (T.wing) cap(name, p.a, p.b, K.r * 0.76 + fur, K.r * 0.56 + fur, 0.05); else cap(name, p.a, p.b, p.r * 1.05 + fur, p.r * 0.85 + fur, 0.03); } // 鳥の太ももは羽毛の中（本物も外に見えるのはすねから下）
    else cap(name, p.a, p.b, p.r + fur * 0.7, p.r * 0.9 + fur * 0.6, 0.01);
  }
  if (K.type === 'hop') { const p = P.pelvis, n = P.mid1 ? 'mid1' : 'chest', q = P[n], r = p.r, mix = (u, v, t) => u.map((x, i) => x + (v[i] - x) * t), low = v => [v[0], v[1] - r * 0.12, v[2]]; cap('pelvis', mix(p.a, p.b, 0.75), low(p.b), r * 0.92 + fur, r * 1.12 + fur, 0.05); cap(n, low(q.a), mix(q.a, q.b, 0.5), r * 1.12 + fur, r * 0.98 + fur, 0.05); } /* ウサギの腰のくびれを少し埋める（テストプレイ。皮の形だけ） */ if (K.rump && K.type !== 'walk' && (K.tail > 0 || K.type === 'hop')) { const p = P.pelvis, rx = p.a[0] + K.segL * K.rumpCut - p.r * 0.86 * fat, y = p.a[1], z = p.a[2], r = p.r, bb = K.type === 'hop' ? 1.5 : 1; if (K.tailKind === 'puff') cap('pelvis', [rx + r * 0.2, y + r * 0.35, z], [rx - r * 0.12 * bb, y + r * 0.45, z], r * 0.3 * bb + fur, r * 0.42 * bb + fur, 0.02); else { const h = K.type === 'hop' ? 1.5 : 1; for (const s of [0, 1, -1]) cap('pelvis', [rx + r * 0.2, y + r * 0.25, z + s * r * 0.14 * h], [rx - r * 0.62 * h, y + r * (0.4 + (h - 1) * 0.7), z + s * r * 0.44 * h], r * 0.2 * h + fur * 0.8, r * 0.26 * h + fur, 0.015); } } // ウサギは ふっくらした へら状 // まるい しっぽ／へら状の しっぽ
  if (K.type === 'seal') { for (const s of [1, -1]) { const u = P[(K.pairs ? 'fft' : '') + (s > 0 ? 'L' : 'R')]; if (u?.a) { const w = u.r * 1.6, ax = u.a, bx = [u.b[0] - 0.008, u.b[1] + 0.008, u.b[2] + s * K.r]; for (const k of [-1, -0.5, 0, 0.5, 1]) cap('fft' + (s > 0 ? 'L' : 'R'), [ax[0] + k * w * 0.25, ax[1], ax[2]], [bx[0] + k * w * 1.1, bx[1], bx[2]], u.r * 1.1 + fur * 0.5, u.r * 0.85 + fur * 0.5, 0.03); } } const tl = P['tail' + (K.tail - 1)]; if (tl) for (const s of [1, -1]) for (const k of [0, 0.5, 1]) cap('tail' + (K.tail - 1), tl.b, [tl.b[0] - K.segL * 0.7, tl.b[1], tl.b[2] + s * K.r * (0.5 + k * 0.37)], tl.r * 0.7 + fur * 0.4, tl.r * 0.95 + fur * 0.4, 0.03); } // アザラシのヒレ: 前も後ろも、すき間なくつないだへら状（板が分かれて見えないよう）
  if (K.type !== 'seal') for (const s of S) { const m = /^([hmf])(?:lo|ft)([LR])$/.exec(s.part); if (m) { s.limb = m[1] + m[2]; const out = { bound: 0.008, hop: 0.004 }[K.type]; if (out) { const u = P[m[1] + 'upL'].a, w = P[m[1] + 'upR'].a, n = Math.hypot(u[0] - w[0], u[2] - w[2]), k = (m[2] === 'L' ? out : -out) / n, side = v => [v[0] + (u[0] - w[0]) * k, v[1], v[2] + (u[2] - w[2]) * k]; s.a = side(s.a); s.b = side(s.b); } } } // ひざから下は1本ずつ分ける。太ももは胴の毛の中でつないだまま（テストプレイ「癒着しすぎても、分けすぎて関節が見えても奇形に見える」）
  if (T.wing) for (const s of [1, -1]) { const c = P.chest.c, z = c[2] + s * (P.chest.r + fur * 0.5); cap('chest', [c[0] + K.segL * 0.25, c[1] + P.chest.r * 0.25, z], [c[0] - K.segL * 1.05, c[1] + P.chest.r * 0.1, z - s * P.chest.r * 0.12], P.chest.r * 0.34, P.chest.r * 0.1, 0.012); } // たたんだ翼（皮のふくらみ。色は kid-look）
  if (K.type === 'walk' && !P.tail0) tanukiTail('pelvis', [P.pelvis.a[0] + K.segL * K.rumpCut - P.pelvis.r * 0.6 * fat, P.pelvis.a[1] + K.r * 0.3, P.pelvis.a[2]]); // 尾の骨がない子も、タヌキは太いしっぽを皮で
  const h = P.head, sn = K.snout ?? 0.5; S.push({ part: 'head', body: h.body, a: h.c, b: [h.c[0] + h.r * (0.5 + sn), h.c[1] - h.r * 0.15 * (1 + sn), h.c[2]], ra: h.r + fur, rb: h.r * (0.7 - sn * 0.4) + fur * (K.type === 'walk' ? 0.3 : 1 - sn * 0.5), k: 0.03 }); /* 鼻づら（snout＝長さ） */ if (K.type === 'walk') for (const s of [1, -1]) S.push({ part: 'head', body: h.body, a: [h.c[0] - h.r * 0.15, h.c[1] - h.r * 0.2, h.c[2] + s * h.r * 0.55], b: [h.c[0] + h.r * 0.15, h.c[1] - h.r * 0.3, h.c[2] + s * h.r * 0.68], ra: h.r * 0.42 + fur * 1.2, rb: h.r * 0.28 + fur, k: 0.04 }); // タヌキのふくらんだほお（皮だけ）
  return S;
}

// 皮だけの関節の範囲（テストプレイ「脚があらぬ方向に曲がる・体を突き抜ける」）: 物理と学習はそのまま、描くときだけ腿を胴より上へ振り上げず、すねを後ろ上へ折らない
export function kidBends(H) {
  if (!['hop', 'bird', 'biped', 'bound', 'donkey'].includes(H.plan.type)) return [];
  return H.pairNames.flatMap(pn => ['L', 'R'].flatMap(L => { const up = pn + 'up' + L, lo = pn + 'lo' + L, ft = pn + 'ft' + L, p = H.parts, hind = pn === 'h' && H.plan.type !== 'donkey', host = H.plan.pairs === 1 || pn === 'h' ? 'pelvis' : 'chest'; return [{ parent: host, child: up, axis: 'z', min: hind ? -0.5 : -0.75, max: hind ? 0.65 : 0.75, pivot: p[up].a, chain: [lo, ft] }, { parent: up, child: lo, axis: 'z', min: hind ? -0.5 : -0.65, max: 0.7, pivot: p[up].b, chain: [ft] }, { parent: lo, child: ft, axis: 'z', min: -0.42, max: 0.42, pivot: p[lo].b }]; }));
}

// 確かめ用: 番号から遺伝子をつくる（声のかわり）・試し（trial.js）に渡す体の作り方
export const KID_KEYS = ['seg', 'neck', 'tail', 'legs', 'legLen', 'girth', 'stop', 'bold', 'vtl', 'fluff'];
// 生まれる体は、よく歩ける手本の体の近くに（テストプレイ「いくら学習しても歩けない子に当たると、捨てるような悲しいことになる」）。色と耳は声のまま。すでにいる子は変えない
export const BODY_REF = { walk: 8, hop: 6, bird: 3, snake: 9, donkey: 1, bound: 2 }, BODY_NEAR = { walk: 0.15, donkey: 0.25, bird: 0.15, hop: 0.3, bound: 0.15 };
export function blendBody(g) { const id = BODY_REF[g.type]; if (!id) return g; const r = kidGenes(id * 7919); for (const k of KID_KEYS) if (g[k] != null && r[k] != null) g[k] = r[k] + (g[k] - r[k]) * (BODY_NEAR[g.type] ?? 0.45); return g; }
export function kidGenes(seed) { let s = seed >>> 0 || 1; const r = () => ((s ^= s << 13, s ^= s >>> 17, s ^= s << 5) >>> 0) / 4294967296; return Object.fromEntries(KID_KEYS.map(k => [k, r()])); }
const JUMPS = ['hop', 'bound', 'biped', 'seal', 'bird', 'snake'];
export const kidBody = (g, over = null) => ({ fall3: g?.type === 'donkey' || g?.type === 'walk' ? 3 : 1, build: (R, w, at, h, yaw = 0) => buildKid(R, w, at, h, g, yaw, over), drive: (H, q, t, gg, tc) => driveKid(H, q, t, gg, tc, pose), decode: decodeKid, starts: typeSeeds(g), lock: JUMPS.includes(g?.type) ? (g.type === 'biped' || g.type === 'bird' ? ['side'] : g.type === 'snake' ? ['side', 'tlK', 'freq'] : ['side', 'tlK']) : ['tlK'], flightW: JUMPS.includes(g?.type) && g.type !== 'seal' ? 0 : 1.5, noGetup: ['seal', 'snake'].includes(g?.type), gateDist: g?.type === 'snake' || g?.type === 'seal' ? 0.5 : 1, gateStraight: ['hop', 'bound', 'biped', 'bird', 'donkey'].includes(g?.type) }); // starts＝型ごとの出発点、lock＝学習で変えない数（跳ねる型が交互に歩きへもどらない・尾の反射を使わない型）、flightW＝宙に浮いている罰（跳ねる型はなし）
