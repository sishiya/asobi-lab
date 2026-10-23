// 火の番の火トカゲ（2026-10-23 ユーザーが選んだ）。黒に黄色の斑点の小さなサンショウウオ（ファイアサラマンダーの色）
// 伝説の火トカゲ（サラマンダー）は、薪の中で冬眠していたサンショウウオが、火にくべられて這い出したのが始まりとも言われる
// 背骨を節の列にして、横にくねらせて歩く（本物のサンショウウオの歩き方）。火を見る・火が小さいと寄って丸くなる・くべると顔を上げる
// 見分けやすさ（2026-10-23 アートディレクターと。ART.md 5章）: たき火側だけのふちの光・灰をかぶった背・熾火のように明滅する斑点・尾を頭へ巻く丸まり・見上げる顔・数歩ごとに止まる歩き
import * as THREE from 'three';
import { H, FIRE } from './util.js';

const K = 1.85; // 島の上で見える大きさに（小屋の壁 0.75 に対して、体長 約0.85）。1.6 では原寸で 10px ほどで、草にうもれた
const N = 12, SEG = 0.04 * K; // 背骨の節（頭から尾の先まで）
const RADIUS = [0.034, 0.04, 0.042, 0.046, 0.047, 0.045, 0.04, 0.032, 0.025, 0.018, 0.012, 0.007].map(r => r * K); // 頭→胴→尾
const CURL = [0, 0.05, 0.25, 0.62, 0.68, 0.7, 0.66, 0.72, 0.64, 0.58, 0.3, 0.12]; // 丸くなるとき、節ごとに曲げる角（合わせて 約300°。きれいな輪にせず、尾の先ははみ出す）
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

// 皮: たき火の向きの、ふちだけの光（むらつき）と、背にかぶった灰。patchDark（火の輪の外を暗く）のあとに足す
const RIM = { uFireW: { value: new THREE.Vector3() }, uRim: { value: 0.6 } };
function patchSkin(mat) {
  let inner = null; // game.js の patchDark が onBeforeCompile を入れ替えるので、それを中で呼ぶ
  Object.defineProperty(mat, 'onBeforeCompile', { get: () => (sh, r) => {
    if (inner) inner(sh, r);
    Object.assign(sh.uniforms, RIM);
    sh.vertexShader = 'varying vec3 vSw; varying vec3 vSn;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vSw = (modelMatrix * vec4(transformed, 1.0)).xyz; vSn = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = 'uniform vec3 uFireW; uniform float uRim; varying vec3 vSw; varying vec3 vSn;\nfloat sHash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sUp = smoothstep(0.15, 0.8, vSn.y), sMot = sHash(vSw * 90.0) * 0.6 + sHash(vSw * 31.0) * 0.4;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.1, 0.09), sUp * smoothstep(0.4, 0.85, sMot) * 0.7);`) // 背の灰（まだらに）
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.55, 0.9, sUp);`) // 横腹はしめって光り、背は灰でかさつく
      .replace('#include <dithering_fragment>', `{
        vec3 sV = normalize(cameraPosition - vSw), sL = uFireW - vSw; float sD = length(sL); sL /= sD;
        float sF = pow(1.0 - max(dot(vSn, sV), 0.0), 3.0) * max(dot(vSn, sL), 0.0);
        gl_FragColor.rgb += vec3(1.0, 0.48, 0.16) * sF * uRim * (0.55 + 0.45 * sHash(vSw * 55.0)) * (1.0 - smoothstep(0.6, 3.2, sD));
      }
      #include <dithering_fragment>`);
  }, set: f => { inner = f; } });
  mat.customProgramCacheKey = () => 'salSkin';
}

export function makeSalamander(parent) {
  const g = new THREE.Group(); parent.add(g);
  const skin = new THREE.MeshStandardMaterial({ color: '#0d0b0a', roughness: 0.32, metalness: 0.05 }); patchSkin(skin);
  const spot = new THREE.MeshStandardMaterial({ color: '#c8901a', roughness: 0.7, emissive: '#ffa21a', emissiveIntensity: 0.06 }); // 外（game.js）が光らせる強さを書く。斑点は下の写しが、これを読んで明滅する
  const eye = new THREE.MeshStandardMaterial({ color: '#050404', roughness: 0.08 });
  const glint = new THREE.MeshBasicMaterial({ color: '#ffd9a0' }); // 目に映るたき火（顔の向きが読める）
  const sph = new THREE.SphereGeometry(1, 16, 12), sphLo = new THREE.SphereGeometry(1, 8, 6);
  const segs = RADIUS.map((r, i) => { const m = new THREE.Mesh(sph, skin); m.scale.set(r * 1.25, r * 0.78, r); m.castShadow = true; g.add(m); return m; });
  // 斑点: 節ごとに2〜3個。大きさ・位置をばらつかせ、ところどころ前後につながる。3つの組で、ずれた調子に明滅する
  const spotMats = [0, 1, 2].map(() => spot.clone()), spots = [];
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 1; i < N - 2; i++) for (const s of [-1, 1]) for (let k = 0; k < (rnd(i, s) > 0.75 ? 2 : 1); k++) {
    if (rnd(i * 3 + k, s * 7) < 0.3) continue;
    const m = new THREE.Mesh(sphLo, spotMats[(i + k + (s > 0 ? 1 : 0)) % 3]), r = RADIUS[i], sz = 0.4 + rnd(i + k * 5, s + 3) * 0.48, long = rnd(i, k + s * 2) > 0.75 ? 1.7 : 1;
    m.scale.set(r * 0.42 * sz * long, r * 0.2, r * 0.32 * sz); m.userData = { i, s, off: 0.25 + rnd(i, k * 9 + s) * 0.4, fw: (rnd(k, i + s) - 0.5) * 0.9 }; g.add(m); spots.push(m);
  }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(sphLo, spotMats[s > 0 ? 0 : 2]); m.scale.set(0.024 * K, 0.012 * K, 0.017 * K); m.userData = { i: 0, s, off: 0.5, fw: -0.3, head: true }; g.add(m); spots.push(m); } // 耳の後ろの黄色（耳腺）
  const eyes = [-1, 1].map(s => { const m = new THREE.Mesh(sph, eye), gl = new THREE.Mesh(sphLo, glint); m.scale.setScalar(0.013 * K); gl.scale.setScalar(0.0042 * K); g.add(m, gl); return { m, gl, s }; });
  // 足: 前は2節め、後ろは5節め。ひじを曲げた2本の棒（つけ根が太く、先へ細く）と、平たい手
  const upper = new THREE.CylinderGeometry(0.0085 * K, 0.0135 * K, 1, 6), lower = new THREE.CylinderGeometry(0.0055 * K, 0.0085 * K, 1, 6);
  const legs = [[2, -1], [2, 1], [5, -1], [5, 1]].map(([i, s], k) => { const a = new THREE.Mesh(upper, skin), b = new THREE.Mesh(lower, skin), h = new THREE.Mesh(sphLo, skin); h.scale.set(0.02 * K, 0.006 * K, 0.016 * K); a.castShadow = b.castShadow = true; g.add(a, b, h); return { i, s, a, b, h, ph: k === 0 || k === 3 ? 0 : Math.PI }; });

  // 足もとの暗い影: 橙の灰の地面から、黒い形を切り抜く（ふちは模様でくずす）
  const shadowTex = (() => { const n = 64, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), im = x.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = (i + 0.5) / n * 2 - 1, w = (j + 0.5) / n * 2 - 1, d = Math.hypot(u, w) + (rnd(i >> 2, j >> 2) - 0.5) * 0.35 + (rnd(i, j) - 0.5) * 0.12; im.data[(j * n + i) * 4 + 3] = 255 * Math.max(0, Math.min(1, (1 - d) * 2.2)); }
    x.putImageData(im, 0, 0); return new THREE.CanvasTexture(c); })();
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000', map: shadowTex, transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  shade.rotation.order = 'YXZ'; shade.renderOrder = 1; g.add(shade);
  const P = Array.from({ length: N }, () => new THREE.Vector3());
  const st = { ang: 0.3, target: 0.3, walk: 0, step: 0, look: 0, peek: 0, curl: 0, next: 4, run: 2, halt: 0, go: 1, headYaw: 0, puff: 0 };
  const v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const ctl = { rOv: null, hold: false, goal: null, curl: false, peek: null }; // 外から動かす: 手本の半径の上書き・止まらない・goal＝闇へ歩いていく先（{x, z}）・curl＝丸くなる・peek＝見上げる手の位置（{x, z}。つまむ前・運ぶあいだ）
  function update(t, dt, { F, flare, lost }) {
    // いる場所: 火のまわりの輪の上。ときどき少し歩いて場所をかえる
    st.next -= dt;
    if (st.next <= 0 && !lost && ctl.rOv === null) { st.target = Math.random() * 0.6; /* はじめのカメラから見て火の右よこ（真ん前だと炎のにじみに隠れる）。丸太のいす（2.2・4.1）をよける */ st.next = 6 + Math.random() * 7; }
    const d = st.target - st.ang, moving = Math.abs(d) > 0.02 || ctl.walk;
    // 数歩ごとに止まる（本物のサンショウウオの、歩いては止まる歩き）。止まる長さはばらつかせる
    if (st.walk > 0.5) { st.run -= dt; if (st.run < 0) { st.halt = 0.4 + Math.random() * 0.45; st.run = 1.4 + Math.random() * 1.2; } }
    st.halt = Math.max(0, st.halt - dt); st.go += ((st.halt > 0 ? 0 : 1) - st.go) * Math.min(1, dt * 10);
    st.walk += ((moving ? 1 : 0) - st.walk) * Math.min(1, dt * 4);
    st.ang += Math.sign(d) * Math.min(Math.abs(d), dt * 0.4 * st.go);
    st.step += dt * (1.5 + 4.5 * st.walk) * (0.25 + 0.75 * st.go);
    st.look += ((flare > 0.2 ? 1 : 0) - st.look) * Math.min(1, dt * 3.3);
    st.peek += ((ctl.peek ? 1 : 0) - st.peek) * Math.min(1, dt * 4);
    st.puff += ((flare > 0.2 || ctl.peek ? 1 : 0) - st.puff) * Math.min(1, dt * 2);
    st.curl += ((F < 6 || lost || ctl.curl ? 1 : 0) - st.curl) * Math.min(1, dt * (ctl.curl ? 2.5 : 1.2));
    st.r = st.r ?? 0.66; st.r += ((ctl.rOv ?? (0.66 - 0.16 * st.curl)) - st.r) * Math.min(1, dt * 1.6); const r = st.r; // 火が小さいと、火に寄る
    let hx = FIRE.x + Math.cos(st.ang) * r, hz = FIRE.z + Math.sin(st.ang) * r;
    // 体の向き: 歩くときは輪にそって、止まると火のほうを向く
    const toFire = Math.atan2(FIRE.z - hz, FIRE.x - hx), along = st.ang + Math.sign(d || 1) * Math.PI / 2;
    let yaw = toFire + wrapA(along - toFire) * st.walk * 0.85 + Math.sin(t * 0.4) * 0.15;
    // 闇へ歩く（ctl.goal）: 輪をはなれて、まっすぐ歩いていく。goal を消すと、火のそばの元の場所へ帰る
    if (ctl.goal || st.free) {
      if (!st.free) st.free = { x: hx, z: hz, yaw };
      const home = { x: FIRE.x + Math.cos(st.ang) * 0.66, z: FIRE.z + Math.sin(st.ang) * 0.66 }, g2 = ctl.goal || home;
      const dx = g2.x - st.free.x, dz = g2.z - st.free.z, dist = Math.hypot(dx, dz), go = dist > 0.03;
      if (go) { const sp = Math.min(dist, dt * 1.0 * st.go); st.free.x += dx / dist * sp; st.free.z += dz / dist * sp; const a = Math.atan2(dz, dx); st.free.yaw += wrapA(a - st.free.yaw) * Math.min(1, dt * 6); }
      st.walk += ((go ? 1 : 0) - st.walk) * Math.min(1, dt * 4); st.step += dt * 4 * st.walk * st.go;
      hx = st.free.x; hz = st.free.z; yaw = st.free.yaw + Math.sin(t * 0.4) * 0.1 * (1 - st.walk);
      st.arrived = !go;
      if (!ctl.goal && !go) { st.free = null; st.r = 0.66; st.target = st.ang; } // 帰った
    }
    // 顔: 手（peek）があれば手へ、火がはぜれば火へ。少しおくれて振り向く
    const lookTo = ctl.peek ? Math.atan2(ctl.peek.z - hz, ctl.peek.x - hx) : toFire, lw = Math.max(st.peek, st.look * (1 - st.walk));
    st.headYaw += (THREE.MathUtils.clamp(wrapA(lookTo - yaw), -1.0, 1.0) * lw - st.headYaw) * Math.min(1, dt * 4);
    const lift = (st.look * 0.032 + st.peek * 0.05) * K * (1 - 0.5 * st.curl); // 上へ 25°（火）・35°（手）ほど
    // 背骨: 頭から後ろへ、向きをつないでいく。横のうねり（歩くと大きく）と、丸まり（尾を頭へ巻く）
    let a = yaw + st.headYaw + Math.PI, x = hx, z = hz;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      if (i > 0) {
        a += (i === 1 ? -st.headYaw * 0.55 : i === 2 ? -st.headYaw * 0.45 : 0) + st.curl * CURL[i];
        x += Math.cos(a) * SEG; z += Math.sin(a) * SEG;
      }
      const wave = Math.sin(st.step - i * 0.75) * (0.006 + 0.03 * st.walk) * (0.4 + u) * (1 - st.curl), wx = x - Math.sin(a) * wave, wz = z + Math.cos(a) * wave;
      const breath = 1 + 0.04 * Math.sin(t * (1.6 - st.curl * 0.6)) * (i > 1 && i < 6 ? 1 : 0);
      P[i].set(wx, H(wx, wz) + RADIUS[i] * 0.72 + (i === 0 ? 0.012 * K + lift + st.curl * 0.015 * K : 0) + (i === 1 ? lift * 0.45 : 0), wz);
      segs[i].position.copy(P[i]); segs[i].scale.set(RADIUS[i] * 1.25 * breath, RADIUS[i] * 0.78 * breath * (i === 0 ? 1 + 0.06 * st.puff : 1), RADIUS[i] * breath);
    }
    for (let i = 0; i < N; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)]; v.subVectors(a, b); segs[i].rotation.set(0, Math.atan2(-v.z, v.x), Math.atan2(v.y, Math.hypot(v.x, v.z))); }
    // 斑点: 熾火のように、ゆっくりむらに明滅。闇で丸くなると（外が spot を強く光らせると）明るく
    const glow = Math.max(0, (spot.emissiveIntensity - 0.06) / 1.2);
    spotMats.forEach((m, k) => { m.emissiveIntensity = (0.3 + 0.08 * Math.sin(t * (1.6 + k * 0.35) + k * 2.1) + 0.04 * Math.sin(t * 5.3 + k)) * (1 - glow) + 0.45 * glow; }); // 闇で休むときも、光るのは斑点だけ（体は逆光の影絵）
    for (const m of spots) { const { i, s, off, fw: f } = m.userData, p = P[i], rr = RADIUS[i], q = segs[i].rotation.y; m.position.set(p.x - Math.sin(q) * s * rr * off + Math.cos(q) * rr * f, p.y + rr * 0.55, p.z - Math.cos(q) * s * rr * off - Math.sin(q) * rr * f); m.rotation.set(0, q, segs[i].rotation.z); }
    for (const { m, gl, s } of eyes) { const p = P[0], q = segs[0].rotation.y; m.position.set(p.x + Math.cos(q) * 0.018 * K - Math.sin(q) * s * 0.022 * K, p.y + 0.02 * K, p.z - Math.sin(q) * 0.018 * K - Math.cos(q) * s * 0.022 * K); gl.position.set(m.position.x + Math.cos(q) * 0.006 * K, m.position.y + 0.008 * K, m.position.z - Math.sin(q) * 0.006 * K); }
    // 足: 体のうねりと逆に、交互に前へ。手を見上げると、手のほうの前足を少し上げる
    const peekSide = ctl.peek ? Math.sign(Math.sin(st.headYaw) || 1) : 0;
    for (const L of legs) {
      const p = P[L.i], q = segs[L.i].rotation.y, ox = -Math.sin(q) * L.s, oz = -Math.cos(q) * L.s;
      const swing = Math.sin(st.step + L.ph) * 0.034 * K * st.walk, fwdx = Math.cos(q), fwdz = -Math.sin(q), tuck = 1 - 0.45 * st.curl; // 丸まると足をたたむ
      const sh = new THREE.Vector3(p.x + ox * RADIUS[L.i] * 0.8, p.y, p.z + oz * RADIUS[L.i] * 0.8);
      const raise = L.i === 2 && L.s === -peekSide ? 0.02 * K * st.peek : 0;
      const fx2 = sh.x + ox * 0.045 * K * tuck + fwdx * swing, fz2 = sh.z + oz * 0.045 * K * tuck + fwdz * swing, foot = new THREE.Vector3(fx2, H(fx2, fz2) + 0.004 + Math.max(0, Math.cos(st.step + L.ph)) * 0.012 * K * st.walk * st.go + raise, fz2);
      const knee = sh.clone().lerp(foot, 0.5).add(new THREE.Vector3(ox * 0.012 * K, 0.022 * K, oz * 0.012 * K));
      for (const [m, a, b] of [[L.a, sh, knee], [L.b, knee, foot]]) { m.position.copy(a).lerp(b, 0.5); m.scale.set(1, a.distanceTo(b), 1); m.quaternion.setFromUnitVectors(up, v.subVectors(b, a).normalize()); }
      L.h.position.set(foot.x + fwdx * 0.006 * K, foot.y - 0.001, foot.z + fwdz * 0.006 * K); L.h.rotation.set(0, q, 0);
    }
    { // 影: 頭から尾のつけ根（8節め）までの長さ、体の幅の 1.8 倍。丸まると丸く
      let cx = 0, cz = 0; for (let i = 0; i < 9; i++) { cx += P[i].x / 9; cz += P[i].z / 9; }
      const dx = P[0].x - P[7].x, dz = P[0].z - P[7].z, len = Math.hypot(dx, dz) + 0.1 * K, wid = RADIUS[4] * 2 * 1.8;
      shade.position.set(cx, H(cx, cz) + 0.008, cz); shade.rotation.set(-Math.PI / 2, Math.atan2(-dz, dx), 0, 'YXZ'); shade.scale.set(Math.max(len * 1.25, wid), Math.max(wid * 1.15, len * 0.7 * st.curl), 1);
    }
    // ふちの光: たき火の場所（世界の座標）。火が小さいほど弱く
    RIM.uFireW.value.set(FIRE.x, H(FIRE.x, FIRE.z) + 0.15, FIRE.z); g.localToWorld(RIM.uFireW.value); RIM.uRim.value = 0.6 * Math.min(1, 0.35 + F / 20);
  }
  return { group: g, update, materials: [skin, spot, eye], ctl, get away() { return !!st.free; }, get arrived() { return !!st.free && st.arrived; }, body: () => P[3], goTo: a => { st.target = a; st.next = 99; }, head: () => P[0], get ang() { return st.ang; } };
}
