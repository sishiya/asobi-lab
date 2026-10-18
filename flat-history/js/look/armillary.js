// 主人公「天球儀の旅人」（2026-10-17〜18 に作った B 天球儀。ART.md 6章）の動き。形は models/armillary.glb（tools/blender/traveler_b.py で書き出す）
// ゲームの主人公と同じかたち: makeTravelerB(gltfScene) → hero（userData.body・userData.animate(dt, s)）。s = { speed, run, grounded, vy, carry, landT }
//
// 動きの考え: 「ポーズを先に決め、そのあいだを、ばねで遅れてついてくる動きでつなぐ」
// - POSES: 待機・歩く・走る・宙・持ち上げる のきめの形（数で書く）。いまの状態のポーズへ、部品ごとのばねが追いかける
// - 慣性のけり: ゲームの主人公は、はなすとその場で止まる。体の速さの急な変化を、ばねの速さに足す（止まると前へつんのめって、戻る＝フォロースルー。
//   動きだすと一瞬うしろへ残る＝ドラッグ）。速さは、ゲームの数字ではなく、主人公の位置の変化から測る
// - 重なる動き: 胴の傾き（はやいばね）→ 頭（少しおそい）→ 黄道の環（いちばんおそく、よくゆれる）の順に、遅れてついてくる
// - 進む向き（カメラはうしろ）: 胴の傾き・環がうしろへ傾く・光のつぶが上へ散る
// - そのほか: 体積を保つ伸び縮み（着地）、二拍の鼓動（芯）、まばたき、ゆらぎは周期のそろわない波を重ねる（くり返しに見せない）
import * as THREE from 'three';

const D = Math.PI / 180;
const LEAN0 = 14 * D;   // モデルの胴の傾き（traveler_b.py）

// きめの形。lean＝胴の前傾、ecl＝黄道の環のうしろ上がり（負でうしろが上がる）、roll＝環の横の傾き、lift＝環の高さ、
// flat＝環を水平に近づける割合、orbit・frame＝星と骨組みの回る速さ（rad/s）、squash＝胴のたての伸び、ring＝足もとの輪の大きさ
export const POSES = {
  idle:  { lean: 14, ecl: 0,   roll: 0, lift: 0,    flat: 0,   orbit: 0.45, frame: 0.3, squash: 1.0,  ring: 1.0, headX: 0 },
  walk:  { lean: 22, ecl: -6,  roll: 0, lift: 0,    flat: 0,   orbit: 1.3,  frame: 1.1, squash: 1.0,  ring: 1.0, headX: 0.09 },
  run:   { lean: 30, ecl: -12, roll: 0, lift: 0,    flat: 0,   orbit: 2.6,  frame: 2.4, squash: 0.97, ring: 0.9, headX: 0.15 },
  air:   { lean: 8,  ecl: 10,  roll: 0, lift: 0.08, flat: 0,   orbit: 1.6,  frame: 1.6, squash: 1.07, ring: 1.4, headX: -0.03 },
  carry: { lean: 8,  ecl: 0,   roll: 0, lift: 0.95, flat: 0.8, orbit: 0.9,  frame: 0.5, squash: 1.0,  ring: 1.0, headX: -0.04 },
};
// 決め絵（1回目）の見なおし: 環のうしろ上がりは半分に（走るで環がほぼ立って車輪に見えた）。骨組みはほぼ丸いので、傾きより頭の前後で前のめりを見せる
// ポーズの絵（決め絵）だけで使う、動きのいちばん大きいところ
export const KEYS = {
  ...POSES,
  start: { ...POSES.walk, lean: 6, ecl: 8, headX: -0.1 },            // 動きだし: 胴が一瞬うしろに残る
  stop:  { ...POSES.idle, lean: 36, ecl: -14, headX: 0.2 },           // 止まる: 前へつんのめる（このあと戻る）
  land:  { ...POSES.idle, squash: 0.78, lean: 18, ring: 1.15 },       // 着地: つぶれる
};

const INK = new THREE.MeshBasicMaterial({ color: '#3a2614', side: THREE.BackSide, transparent: true, opacity: 1 });

// 2次のばね（f＝ゆれの速さ Hz、z＝へり。1 で行きすぎない、小さいほどよくゆれる）
class Spring {
  constructor(x, f, z) { this.x = x; this.v = 0; this.w = f * Math.PI * 2; this.z = z; this.target = x; }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));   // こまかく分けて計算（こまの落ちでも同じ動きに）
    const h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (this.w * this.w * (this.target - this.x) - 2 * this.z * this.w * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
  snap(x) { this.x = this.target = x; this.v = 0; }
}

// 決まった順の乱数（録画で毎回同じになるように）
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function makeTravelerB(src, { scale = 1.25, ink = true } = {}) {
  const hero = new THREE.Group(), body = new THREE.Group();
  hero.add(body);
  const m = src.clone(true);
  body.add(m);
  const named = (o, re) => { for (let p = o; p; p = p.parent) if (re.test(p.name)) return true; return false; };
  const meshes = []; m.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    // 2D の断面に出さない部品（ゲームの sliceObject の userData.noSlice）: 環・留め玉・目盛りは、断面では点が散らばって汚れに見える（AD2）
    if (named(o, /^(node|eclRing|haloRing|floorRing|tick)/)) o.userData.noSlice = true;
    // 銅版画のようなインクのふち（ART.md 6章）: 部品はどれも凸なので、まん中から少し大きくした裏返しの殻。すける材質なので断面には出ない
    if (ink && !named(o, /^(eclRing|haloRing|floorRing|tick|aShell)/) && !(o.material.transparent)) {
      o.geometry.computeBoundingSphere();
      const c = o.geometry.boundingSphere.center, r = o.geometry.boundingSphere.radius, k = 1 + 0.016 / Math.max(r, 0.04);
      const sh = new THREE.Mesh(o.geometry, INK);
      sh.position.copy(c).multiplyScalar(1 - k); sh.scale.setScalar(k);
      o.add(sh);
    }
  }
  hero.scale.setScalar(scale);
  const get = (n) => m.getObjectByName(n);
  const torso = get('torso'), frame = get('spinFrame'), inner = get('spinInner'), ecl = get('ecliptic'), orbit = get('spinOrbit');
  const head = get('bobHead'), halo = get('spinHalo'), eye = get('eye'), ring = get('ring');
  const base = {
    torsoPos: torso.position.clone(), eclQ: ecl.quaternion.clone(), eclPos: ecl.position.clone(), headPos: head.position.clone(),
  };
  // 芯の材質は、この主人公だけのものに（鼓動で光の強さを変える）
  inner.material = inner.material.clone();
  const glow0 = inner.material.emissiveIntensity;
  const rootScale = m.getObjectByName('traveler')?.scale.x || 1;   // glb の root（0.85）。位置の数はこの中の単位

  const p0 = POSES.idle;
  const sp = {
    lean: new Spring(p0.lean * D, 3.2, 0.42),   // 胴: はやく、少し行きすぎる
    headX: new Spring(0, 2.4, 0.38),            // 頭: 胴より少しおそい
    headY: new Spring(0, 2.6, 0.45),
    ecl: new Spring(0, 1.5, 0.28),              // 黄道の環: いちばんおそく、よくゆれる
    roll: new Spring(0, 1.5, 0.28),
    lift: new Spring(0, 2.0, 0.55),
    flat: new Spring(0, 2.0, 0.7),
    orbit: new Spring(p0.orbit, 0.8, 1.0),      // 回る速さ: なめらかに上がり下がり（緩急）
    frame: new Spring(p0.frame, 0.6, 1.0),
    squash: new Spring(1, 3.5, 0.3),
    ring: new Spring(1, 2.0, 0.6),
  };

  // 光のつぶ（彗星の尾）: 世界に置く（主人公といっしょに動かないので、うしろに流れて見える）。すける材質なので断面には出ない
  const moteGeo = new THREE.OctahedronGeometry(0.07, 0);
  const moteMat = new THREE.MeshBasicMaterial({ color: '#8ff3e2', transparent: true, opacity: 0.9, depthWrite: false });
  const motes = Array.from({ length: 28 }, () => { const o = new THREE.Mesh(moteGeo, moteMat.clone()); o.visible = false; o.userData.life = 0; return o; });
  let motesAdded = false, emitAcc = 0;
  const rand = rng(7);

  let tm = 0, lastPos = null, vel = new THREE.Vector3(), lastLand = 0, nextBlink = 2.2, blinkT = -1, poseName = 'idle';
  const wp = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), axZ = new THREE.Vector3(0, 0, 1), axX = new THREE.Vector3(1, 0, 0);

  function apply(P, sx) {
    // ばねの今の値を、部品に当てる
    torso.rotation.set(0, 0, -sx.lean);
    const sq = sx.squash, side2 = 1 / Math.sqrt(Math.max(0.5, sq));   // 体積を保つ
    torso.scale.set(side2, sq, side2);
    head.position.set(base.headPos.x + sx.headX / rootScale, base.headPos.y + sx.headY / rootScale + (sq - 1) * 0.3, base.headPos.z);
    // 黄道の環: もとの傾き → 水平へ（flat）→ うしろ上がり（ecl）・横の傾き（roll）
    const q = base.eclQ.clone().slerp(new THREE.Quaternion(), sx.flat);
    // 環は胴の子なので、胴の傾きにつられて立ってしまう。ジャイロ（天球儀のジンバル）のように、胴の傾きの 85% を打ち消して水平をたもち、ばねの遅れだけを見せる
    tmpQ.setFromAxisAngle(axZ, sx.ecl + (sx.lean - LEAN0) * 0.85); q.premultiply(tmpQ);
    tmpQ.setFromAxisAngle(axX, sx.roll); q.premultiply(tmpQ);
    ecl.quaternion.copy(q);
    ecl.position.set(base.eclPos.x, base.eclPos.y + sx.lift / rootScale, base.eclPos.z);
    ring.scale.setScalar(sx.ring);
  }

  hero.userData = {
    body,
    sliceHatch: false,
    get pose() { return poseName; },
    // 決め絵: ばねを止めて、きめの形にする
    setKey(name) {
      const P = KEYS[name];
      const sx = { lean: P.lean * D, headX: P.headX, headY: 0, ecl: P.ecl * D, roll: P.roll * D, lift: P.lift, flat: P.flat, squash: P.squash, ring: P.ring };
      apply(P, sx);
    },
    animate(dt, s) {
      dt = Math.min(dt, 1 / 20);
      tm += dt;
      // 体の速さ（位置の変化から。ゲームの主人公は、はなすとその場で止まる）
      hero.getWorldPosition(wp);
      const prevVel = vel.clone();
      if (lastPos && dt > 0) vel.copy(wp).sub(lastPos).divideScalar(dt * scale).setY(0); // 主人公の大きさの単位に
      lastPos = (lastPos || new THREE.Vector3()).copy(wp);
      const dv = vel.clone().sub(prevVel);
      const ry = body.rotation.y;
      fwd.set(Math.cos(ry), 0, -Math.sin(ry)); side.set(Math.sin(ry), 0, Math.cos(ry));
      const dFwd = dv.dot(fwd), dSide = dv.dot(side);
      const spd = vel.length() * scale / 5.2;   // 歩き＝1

      // いまのポーズ
      const air = s.grounded === false;
      poseName = s.carry ? 'carry' : air ? 'air' : spd > 1.35 ? 'run' : spd > 0.15 ? 'walk' : 'idle';
      const P = POSES[poseName];
      sp.lean.target = P.lean * D; sp.headX.target = P.headX; sp.ecl.target = P.ecl * D; sp.roll.target = P.roll * D;
      sp.lift.target = P.lift; sp.flat.target = P.flat; sp.orbit.target = P.orbit; sp.frame.target = P.frame;
      sp.squash.target = P.squash; sp.ring.target = P.ring;

      // 慣性のけり（止まると前へ・動きだすとうしろへ。横へ曲がると環が外へ傾く）。大きすぎるけりは、まるめる
      const kick = (k, lim) => Math.max(-lim, Math.min(lim, k));
      sp.lean.v += kick(-dFwd * 0.09, 1.6);
      sp.headX.v += kick(-dFwd * 0.08, 1.4);
      sp.ecl.v += kick(dFwd * 0.08, 1.5);
      sp.roll.v += kick(dSide * 0.12, 2.2);
      // 着地: つぶれるけり
      if (s.landT > 0 && lastLand <= 0) sp.squash.v -= 2.8 * Math.min(1, s.landT * 1.5);
      lastLand = s.landT || 0;

      const sx = {};
      for (const k in sp) sx[k] = sp[k].step(dt);
      // ゆらぎ: 周期のそろわない波を重ねる（くり返しに見せない）。頭は胴に少し遅れて
      const bob = Math.sin(tm * 1.3) * 0.035 + Math.sin(tm * 2.9 + 1.1) * 0.015;
      torso.position.y = base.torsoPos.y + bob / rootScale;
      sp.headY.target = bob * 0.9;
      sx.headY = sp.headY.x;
      apply(P, sx);
      // 回るもの（速さはばねで緩急）
      frame.rotation.y += sx.frame * dt;
      orbit.rotation.y += sx.orbit * dt;
      inner.rotation.x += dt * 0.35; inner.rotation.y -= dt * 0.5;
      halo.rotation.y -= dt * (0.6 + sx.orbit * 0.3);
      // 二拍の鼓動（動いているとはやく）
      const period = poseName === 'idle' || poseName === 'carry' ? 1.4 : 0.85;
      const ph = (tm % period) / period;
      const beat = 0.09 * Math.exp(-(((ph - 0.05) / 0.045) ** 2)) + 0.05 * Math.exp(-(((ph - 0.22) / 0.05) ** 2));
      inner.scale.setScalar(1 + beat);
      inner.material.emissiveIntensity = glow0 * (1 + beat * 4);
      // まばたき（2〜5秒ごと）
      if (tm > nextBlink) { blinkT = 0; nextBlink = tm + 2 + rand() * 3; }
      if (blinkT >= 0) { blinkT += dt; eye.scale.set(1, blinkT < 0.12 ? 0.15 : 1, 1); if (blinkT >= 0.12) blinkT = -1; }

      // 光のつぶ
      if (!motesAdded) { let top = hero; while (top.parent) top = top.parent; if (top.isScene) { motes.forEach(o => top.add(o)); motesAdded = true; } }   // つぶは世界（シーン）に置く
      if (motesAdded) {
        emitAcc += dt * (spd > 0.3 ? (spd > 1.35 ? 16 : 10) : 0);
        while (emitAcc >= 1) {
          emitAcc -= 1;
          const o = motes.find(q => q.userData.life <= 0);
          if (!o) break;
          torso.getWorldPosition(o.position);
          o.position.addScaledVector(fwd, -0.35 * scale).addScaledVector(side, (rand() - 0.5) * 0.2 * scale);
          o.position.y += (0.1 + rand() * 0.2) * scale;
          o.userData.v = new THREE.Vector3().addScaledVector(side, (rand() - 0.5) * 0.5 * scale).addScaledVector(fwd, -0.25 * scale);
          o.userData.v.y = 0.5 * scale;
          o.userData.life = 0.8; o.visible = true;
        }
        for (const o of motes) {
          if (o.userData.life <= 0) continue;
          o.userData.life -= dt;
          o.position.addScaledVector(o.userData.v, dt);
          const k = Math.max(0, o.userData.life / 0.8);
          o.scale.setScalar(scale * (0.4 + 0.8 * k));
          o.material.opacity = 0.9 * k;
          o.rotation.y += dt * 3;
          if (o.userData.life <= 0) o.visible = false;
        }
      }
    },
  };
  return hero;
}
