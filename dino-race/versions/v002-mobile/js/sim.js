// 物理: Planck.js（Box2D）で、横から見た2次元の骨格を動かす。単位は m・kg・秒、y は上向き。
// 体の重さは体積から（密度 1000kg/m³）、関節の力の上限は筋肉の体積から（相似則。PLAN.md）。

const GRAV = 9.81;
const DT = 1 / 120;
const RHO = 1000;          // 体の密度 kg/m³（水と同じとする）
const RHO_MUSCLE = 1060;   // 筋肉の密度
const SIGMA = 300e3;       // 筋肉が出せる力 N/m²（Hutchinson & Garcia 2002 が使った値）
const ARM_RATIO = 0.5;     // てこの長さ ÷ 筋線維の長さ（仮）
const SHARE = {hip:0.45, knee:0.30, ankle:0.20, toe:0.05}; // 脚の筋肉の関節ごとの分け方（仮）
const SHAPE = 0.52;        // 箱の体積から丸みのある体の体積へ（楕円体 ≒ π/6）
const CAT_GROUND = 1, CAT_DINO = 2;

// 遺伝子から体の寸法・重さ・力を計算する
function bodyPlan(g) {
  const L = g.legLen;
  // 指（第3趾）は足の甲の 0.8 倍（獣脚類の指は長い。仮）
  const fem = L / (1 + g.tibRatio + g.metaRatio), tib = fem * g.tibRatio, meta = fem * g.metaRatio, toe = meta * 0.8;
  const tl = L * g.bodyLen, th = tl * g.bodyThick;
  const neck = L * g.neckLen, head = L * g.headLen, tail = L * g.tailLen;
  const t1 = tail * 0.4, t2 = tail * 0.6;
  const th_ = {torso: th, neck: th * 0.30, head: head * 0.36, t1: th * 0.48, t2: th * 0.20,
    fem: fem * 0.17, tib: tib * 0.11, meta: meta * 0.13, toe: toe * 0.22};
  const vol = (len, t, depth = t) => len * t * depth * SHAPE;
  const m = {
    torso: RHO * vol(tl, th, th * 0.8),
    neck: RHO * vol(neck, th_.neck),
    head: RHO * vol(head, th_.head, th_.head * 0.7),
    t1: RHO * vol(t1, th_.t1),
    t2: RHO * vol(t2, th_.t2) * 0.6,
  };
  const core = m.torso + m.neck + m.head + m.t1 + m.t2;
  const legFrac = 0.035 + g.muscle;            // 骨と皮 3.5% ＋ 筋肉（脚1本あたり、体重に対する割合）
  const M = core / (1 - 2 * legFrac);
  const legM = legFrac * M, musM = g.muscle * M;
  m.fem = legM * 0.55; m.tib = legM * 0.28; m.meta = legM * 0.12; m.toe = legM * 0.05;
  const torque = {};
  for (const j in SHARE) torque[j] = SIGMA * (musM * SHARE[j] / RHO_MUSCLE) * ARM_RATIO;
  torque.neck = SIGMA * (0.015 * M / RHO_MUSCLE) * ARM_RATIO;
  torque.tail = SIGMA * (0.03 * M / RHO_MUSCLE) * ARM_RATIO;
  return {L, fem, tib, meta, toe, tl, th, neck, head, t1, t2, thick: th_, mass: m, M, torque,
    ts: Math.sqrt(L / GRAV)}; // ts: 体の大きさに合った時間の単位（同じ形なら同じ動き。動的相似）
}

// 立った姿勢での関節の位置（腰を原点に）
const REST = {fem: 0.5, tib: -0.75, meta: 0.35}; // 縦からの角度（下の端が前なら＋）
function restPose(p) {
  const v = (a, len) => [Math.sin(a) * len, -Math.cos(a) * len];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const hip = [0, 0];
  const knee = add(hip, v(REST.fem, p.fem));
  const ankle = add(knee, v(REST.tib, p.tib));
  const mtp = add(ankle, v(REST.meta, p.meta));
  const tip = add(mtp, [p.toe, 0]);
  const lift = -mtp[1] + p.thick.toe / 2 + 0.002;
  const up = q => [q[0], q[1] + lift];
  const H = up(hip);
  const torsoC = add(H, [0.25 * p.tl, 0.15 * p.th]);
  const shoulder = add(H, [0.70 * p.tl, 0.25 * p.th]);
  const neckEnd = add(shoulder, [Math.cos(0.7) * p.neck, Math.sin(0.7) * p.neck]);
  const headEnd = add(neckEnd, [Math.cos(-0.15) * p.head, Math.sin(-0.15) * p.head]);
  const tailBase = add(H, [-0.25 * p.tl, 0.20 * p.th]);
  const tailMid = add(tailBase, [-p.t1, -0.04 * p.t1]);
  const tailEnd = add(tailMid, [-p.t2, 0.01 * p.t2]);
  return {hip: H, knee: up(knee), ankle: up(ankle), mtp: up(mtp), tip: up(tip), torsoC, shoulder, neckEnd, headEnd, tailBase, tailMid, tailEnd};
}

const V2 = (x, y) => new planck.Vec2(x, y);

function fixtureDef(density, user, friction = 0.9) {
  return {density, friction, restitution: 0, filterCategoryBits: CAT_DINO, filterMaskBits: CAT_GROUND, userData: user};
}

// 2点を結ぶ骨（箱）の体を作る
function segBody(world, a, b, thick, mass, user, x0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const body = world.createBody({type: 'dynamic', position: V2(x0 + (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), angle: Math.atan2(dy, dx)});
  body.createFixture(new planck.Box(len / 2, thick / 2), fixtureDef(mass / (len * thick), user));
  body.len = len;
  return body;
}

function makeWorld() {
  const world = new planck.World({gravity: V2(0, -GRAV)});
  const ground = world.createBody({type: 'static'});
  ground.createFixture(new planck.Edge(V2(-100, 0), V2(10000, 0)), {friction: 1.0, filterCategoryBits: CAT_GROUND, filterMaskBits: CAT_DINO});
  world.on('begin-contact', c => {
    for (const f of [c.getFixtureA(), c.getFixtureB()]) {
      const u = f.getUserData();
      if (u && (u.part === 'torso' || u.part === 'head') && !u.d.fell) { u.d.fell = true; u.d.fellT = u.d.t; }
    }
  });
  return world;
}

// 1匹を世界に置く
function buildDino(world, g, x0 = 0) {
  const p = bodyPlan(g), r = restPose(p), m = p.mass, th = p.thick;
  const d = {g, p, r, x0, t: 0, fell: false, fellT: null, finishT: null, dist: 0, speed: 0, bodies: [], joints: {}};
  const U = part => ({d, part});
  const torso = world.createBody({type: 'dynamic', position: V2(x0 + r.torsoC[0], r.torsoC[1])});
  torso.createFixture(new planck.Box(p.tl / 2, p.th / 2), fixtureDef(m.torso / (p.tl * p.th), U('torso')));
  const neck = segBody(world, r.shoulder, r.neckEnd, th.neck, m.neck, U('neck'), x0);
  // 頭は首と同じ体に、もう1つの箱として付ける
  const hc = neck.getLocalPoint(V2(x0 + (r.neckEnd[0] + r.headEnd[0]) / 2, (r.neckEnd[1] + r.headEnd[1]) / 2));
  neck.createFixture(new planck.Box(p.head / 2, th.head / 2, hc, -0.15 - neck.getAngle()), fixtureDef(m.head / (p.head * th.head), U('head')));
  d.headLocal = {c: {x: hc.x, y: hc.y}, a: -0.15 - neck.getAngle()};
  const t1 = segBody(world, r.tailBase, r.tailMid, th.t1, m.t1, U('tail'), x0);
  const t2 = segBody(world, r.tailMid, r.tailEnd, th.t2, m.t2, U('tail'), x0);
  d.torso = torso; d.neck = neck; d.t1 = t1; d.t2 = t2;
  d.bodies.push(torso, neck, t1, t2);

  const hinge = (A, B, at, lo, hi, maxT) => {
    const j = world.createJoint(new planck.RevoluteJoint({enableLimit: true, lowerAngle: lo, upperAngle: hi, enableMotor: true, maxMotorTorque: maxT, motorSpeed: 0}, A, B, V2(x0 + at[0], at[1])));
    j.maxT = maxT;
    return j;
  };
  d.joints.neck = hinge(torso, neck, r.shoulder, -0.5, 0.5, p.torque.neck);
  d.joints.tail1 = hinge(torso, t1, r.tailBase, -0.4, 0.4, p.torque.tail);
  d.joints.tail2 = hinge(t1, t2, r.tailMid, -0.4, 0.4, p.torque.tail * 0.4);

  d.legs = [0, 1].map(s => {
    const fem = segBody(world, r.hip, r.knee, th.fem, m.fem, U('leg'), x0);
    const tib = segBody(world, r.knee, r.ankle, th.tib, m.tib, U('leg'), x0);
    const meta = segBody(world, r.ankle, r.mtp, th.meta, m.meta, U('leg'), x0);
    const toe = segBody(world, r.mtp, r.tip, th.toe, m.toe, U('foot'), x0);
    toe.getFixtureList().setFriction(1.0);
    d.bodies.push(fem, tib, meta, toe);
    return {fem, tib, meta, foot: toe,
      hip: hinge(torso, fem, r.hip, -0.9, 1.1, p.torque.hip),
      knee: hinge(fem, tib, r.knee, -1.3, 0.45, p.torque.knee),
      ankle: hinge(tib, meta, r.ankle, -0.7, 1.0, p.torque.ankle),
      toe: hinge(meta, toe, r.mtp, -0.8, 0.6, p.torque.toe)};
  });
  d.Kp = g.kp / p.ts;            // 1/秒
  d.vmax = 25 / p.ts;            // 関節の速さの上限 rad/秒
  d.T = g.period * p.ts;         // 1歩の周期 秒
  d.hipY0 = r.hip[1];
  return d;
}

function servo(j, target, d) {
  const e = target - j.getJointAngle();
  j.setMotorSpeed(clamp(d.Kp * e, -d.vmax, d.vmax));
}

// 重心の位置と速さ
function centerOfMass(d) {
  let m = 0, x = 0, vx = 0;
  for (const b of d.bodies) { const bm = b.getMass(), c = b.getWorldCenter(); m += bm; x += c.x * bm; vx += b.getLinearVelocityFromWorldPoint(c).x * bm; }
  return {x: x / m, vx: vx / m};
}

// 走り方（SIMBICON に寄せたしくみ）: 半歩ごとに支える脚と振る脚を入れかえる。
// 振る脚の股は「地面に対する角度」で決め、重心が足より前にあるほど・速いほど前へ踏み出す（転ばないための足の置き方）。
// 支える脚の股で胴の傾きを保つ。ひざ・足首・指はそれぞれ目標の角度へ。
function control(d) {
  const g = d.g, half = d.T / 2;
  const k = Math.floor(d.t / half), tau = d.t / half - k;
  const st = k % 2, sw = 1 - st, S = d.legs[st], W = d.legs[sw];
  const early = tau < g.split;
  d.stance = st;
  const pitch = d.torso.getAngle(), rate = d.torso.getAngularVelocity() * d.p.ts;
  const c = centerOfMass(d);
  const dd = (c.x - S.foot.getPosition().x) / d.p.L, vv = c.vx / Math.sqrt(GRAV * d.p.L);
  // 振る脚
  servo(W.hip, (early ? g.hipE : g.hipL) + g.cd * dd + g.cv * vv - pitch, d);
  servo(W.knee, early ? g.kneeE : g.kneeL, d);
  servo(W.ankle, early ? g.ankleE : g.ankleL, d);
  servo(W.toe, g.toeW, d);
  // 支える脚: 股は胴の傾きを直す向きへ（前に傾いたら股の角度を小さく → 胴が起きる）
  servo(S.hip, S.hip.getJointAngle() + g.kPitch * (pitch - g.lean) + g.kRate * rate, d);
  servo(S.knee, g.kneeS, d);
  servo(S.ankle, g.ankleS, d);
  servo(S.toe, g.toeS, d);
  servo(d.joints.neck, g.neckC, d);
  servo(d.joints.tail1, g.tailC, d);
  servo(d.joints.tail2, g.tailC * 0.5, d);
}

// 何匹かを同じ世界で走らせる（恐竜どうしはぶつからない）
function makeRace(genomes) {
  const world = makeWorld();
  const dinos = genomes.map(g => buildDino(world, g, 0));
  return {world, dinos, t: 0};
}

// かけっこ: FINISH m のゴールまで。LIMIT 秒で打ち切り
const FINISH = 100, LIMIT = 40;

// removeDone: 転んだ・ゴールした恐竜を世界から消す（GA の評価を速くする。見せるときは消さない）
function stepRace(R, {removeDone = false} = {}) {
  for (const d of R.dinos) if (!d.fell && !d.removed && !(removeDone && d.finishT != null)) control(d); // 見せるときはゴールのあとも走り続ける
  R.world.step(DT, 8, 3);
  R.t += DT;
  for (const d of R.dinos) {
    d.t = R.t;
    const done = d.fell || d.finishT != null;
    if (done) {
      if (removeDone && !d.removed) { for (const b of d.bodies) R.world.destroyBody(b); d.removed = true; }
      if (d.fell || removeDone) continue; // 見せるときは、ゴールしたあとも走り続ける
    }
    const hp = d.legs[0].fem.getWorldPoint(V2(-d.legs[0].fem.len / 2, 0)); // 腰の位置（太ももの上の端）
    const prev = d.dist;
    d.dist = hp.x - d.x0;
    d.speed = d.torso.getLinearVelocity().x;
    if (d.finishT == null && d.dist >= FINISH) d.finishT = R.t - DT * (d.dist - FINISH) / Math.max(1e-6, d.dist - prev); // 線を越えた瞬間に補間
    if (d.finishT == null && (hp.y < d.hipY0 * 0.35 || Math.abs(d.torso.getAngle()) > 1.2 || !isFinite(hp.x))) { d.fell = true; d.fellT = d.t; }
  }
}

function raceOver(R) { return R.t >= LIMIT || R.dinos.every(d => d.fell || d.finishT != null); }

// 記録: ゴールしたらタイム、転んだらその距離、打ち切りならその距離
function recordOf(d) { return {dist: Math.min(d.dist, FINISH), fell: d.fell, fellT: d.fellT, finishT: d.finishT, M: d.p.M}; }

// 走り方の遺伝子をほんの少しずらす（試しの走りを変えるため）
function jitter(g, seed, amount = 0.004) {
  const rng = makeRng(seed), c = {...g};
  for (const d of GENES) if (d.kind === 'gait') c[d.k] = clamp(c[d.k] + gauss(rng) * amount * (d.max - d.min), d.min, d.max);
  return c;
}

// GA の評価: 本番と同じかけっこ（採点の時間を決めると、その直後に転ぶ走り方ばかり育ったため）。
// robust: 走り方を少しずらした2回目も走らせて alt に入れる（値を丸めただけで転ぶ「綱渡り」の走り方を育てないため）
function evaluate(genomes, {robust = false, seed = 1000} = {}) {
  const list = robust ? genomes.flatMap((g, i) => [g, jitter(g, seed + i)]) : genomes;
  const R = makeRace(list);
  while (!raceOver(R)) stepRace(R, {removeDone: true});
  const recs = R.dinos.map(recordOf);
  return robust ? genomes.map((g, i) => ({...recs[2 * i], alt: recs[2 * i + 1]})) : recs;
}
