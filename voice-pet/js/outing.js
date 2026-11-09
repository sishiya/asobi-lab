// でかける（もとの test/run.html「入って走る」を、育てると同じページの場面にした。ユーザー「走るも同じページにして」）
// 自分の草原・藪・物理の世界・カメラを1つ持ち、でかけるたびに いま見ている子の体と皮だけを作る（読みこみなし）。帰ると体と皮を消して、泥の点を返す
// 子には向き（turn）と速さ（g）だけを渡す。関節は操らない。ぬかるみで泥がつき、雨で落ちる（js/dirt.js）。転んだら、起き上がりを覚えた子は自分で起きる
// 秒や着いた速さは出さない（くらべっこをさそう＝RELEASE.md・BRUSHUP.md）
import * as THREE from 'three';
import { height, SIZE } from './ground.js';
import { pose } from './hare.js';
import { makeField, contactPoint } from './trial.js';
import { mud, makeDirt, stepDirt } from './dirt.js';
import { feltify, makeFeltGround, makeFeltBody, makeFeltBall, makeDiorama, HARE_FACE } from './felt.js';
import { kidBody, kidShapes } from './kid.js';
import { lookFur, lookFace } from './kid-look.js';
import { makeBurr, SEED_KINDS } from './garden.js';
import { driveGetup, decodeGetup, GETUP_UP } from './getup.js';
import { gesture } from './gesture.js';

const CSS = `
  #out { position: fixed; inset: 0; pointer-events: none; }
  #out[hidden] { display: none; }
  #out > * { pointer-events: auto; }
  #outHud { position: fixed; left: 16px; top: 72px; background: var(--panel); border-radius: 12px; padding: 8px 12px; line-height: 1.6; font-size: 13px; pointer-events: none; }
  #outTools { position: fixed; right: 12px; top: 62px; }
  #outTools button { border: 0; background: var(--panel); font: inherit; font-size: 13px; color: var(--ink); min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer; }
  #outTools button.on { background: var(--on); color: #fff; }
  #outBottom { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
  #outHint { font-size: 14px; text-shadow: 0 0 8px #faf7f0, 0 0 4px #faf7f0; white-space: nowrap; pointer-events: none; transition: opacity .5s; }
  /* 家に帰る: 押しながら話すと同じ大きさ・同じ高さ（下のふち＋声のみほんのボタンの分） */
  #outHome { border: 0; background: var(--on); color: #fff; font: inherit; font-size: 17px; line-height: normal; padding: 14px 26px; min-width: 220px; margin-bottom: 46px; border-radius: 999px; cursor: pointer; box-shadow: 0 2px 10px rgba(44,42,38,.22); }
  @media (max-height: 500px) and (orientation: landscape) { #outBottom { left: auto; right: 12px; bottom: 10px; width: 290px; transform: none; gap: 6px; } #outHome { min-width: 0; width: 100%; padding: 10px 16px; font-size: 15px; margin-bottom: 42px; } }
  #outNeed { background: var(--panel); border-radius: 14px; padding: 10px 16px; text-align: center; line-height: 1.6; box-shadow: 0 2px 10px rgba(44,42,38,.18); }
  #outNeed[hidden] { display: none; }
  #outMsg { position: fixed; left: 50%; top: 38%; transform: translate(-50%, -50%); font-size: 20px; font-weight: 600; text-shadow: 0 0 8px #faf7f0; opacity: 0; transition: opacity .4s; pointer-events: none; white-space: nowrap; }
`;
const HTML = `
  <div id="outHud"></div>
  <div id="outTools"><button id="outRain">雨</button></div>
  <div id="outMsg"></div>
  <div id="outBottom"><div id="outNeed" hidden></div><div id="outHint"></div><button id="outHome">家に帰る</button></div>
`;

// R＝Rapier、renderer＝ページの描き手。onHome＝帰るとき（泥の点を渡す）
export function makeOuting(R, renderer, { onHome }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'out'; root.hidden = true; root.innerHTML = HTML; document.body.appendChild(root);
  const $ = id => root.querySelector('#' + id);

  const BG = new THREE.Color(0xe9e2d4), scene = new THREE.Scene(); scene.background = BG.clone(); scene.fog = new THREE.Fog(BG.clone(), 4, 13);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.01, 60);
  const hemi = new THREE.HemisphereLight(0xf6efe0, 0x6a6448, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 20 }); scene.add(sun, sun.target);
  const G = makeFeltGround(scene, { size: 16, n: 240, cx: 1.5, cz: 2.5 });
  const DIO = makeDiorama(renderer, scene, cam);

  // 藪（目当て）: どの藪でも、ふれるとひっつき虫がつく（でかけるごとに1か所1度）。まだふれていない藪は明るく、ふれると暗くなる（「光る藪だけ」はわかりづらかった）
  const BUSHES = [[3, 0.6], [4.5, 3.4], [1.5, 5.5], [-1.5, 3.5], [-0.5, 0.5]];
  const ball = new THREE.SphereGeometry(1, 20, 14); ball.setAttribute('wet', new THREE.BufferAttribute(new Float32Array(ball.attributes.position.count), 1)); ball.setAttribute('fluff', new THREE.BufferAttribute(new Float32Array(ball.attributes.position.count).fill(1), 1));
  const bushMat = (c, e = 0, shell = 0) => feltify(new THREE.MeshPhysicalMaterial({ color: c, roughness: 1, sheen: 0.8, sheenRoughness: 0.8, sheenColor: 0xdfe8b8, emissive: e ? 0x3a4a14 : 0, emissiveIntensity: e, alphaHash: true }), { shell, len: 0.012, freq: 120, rest: false });
  const bushes = BUSHES.map(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, height(x, z), z); g.userData.fade = 1; g.userData.mats = { off: [], on: [] };
    for (const [, sh] of [[0, 0], [1, 0.34], [2, 0.67], [3, 1]]) { g.userData.mats.off.push(bushMat(0x4a5c36, 0, sh)); g.userData.mats.on.push(bushMat(0x6f8a46, 0.45, sh)); }
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4 + i, r = 0.12 + (k % 3) * 0.05, pos = [Math.cos(a) * 0.15 * (k % 4) / 2, r * 0.8 + (k % 2) * 0.08, Math.sin(a) * 0.15 * (k % 4) / 2];
      for (let s = 0; s < 4; s++) { const m = new THREE.Mesh(ball, g.userData.mats.off[s]); m.scale.setScalar(r); m.position.set(...pos); m.castShadow = s === 0; m.receiveShadow = true; m.userData.s = s; g.add(m); }
    }
    for (let k = 0; k < 9; k++) { const a = k * 2.4 + i, u = 0.25 + (k % 4) * 0.2, f = makeFeltBall(SEED_KINDS[i].petal, { r: 0.022, sy: 0.7, seg: 12, fuzz: 2, len: 0.005 }); f.position.set(Math.cos(a) * 0.3 * (1 - u * 0.4), 0.14 + u * 0.28, Math.sin(a) * 0.3 * (1 - u * 0.4)); f.userData.s = 0; f.userData.flower = true; g.add(f); } // 藪にその花が咲いている（どの花の藪かわかる）
    scene.add(g); return g;
  });
  const BUSH_TOUCH = 0.55, touched = BUSHES.map(() => false), lit = () => bushes.forEach((b, k) => b.children.forEach(m => { if (!m.userData.flower) m.material = b.userData.mats[touched[k] ? 'off' : 'on'][m.userData.s]; })); // BUSH_TOUCH＝藪の見た目のふち＋体の半分
  lit();

  const world = makeField(R);
  let K = null, H = null, D = null, FB = null, Q = null; // いまでかけている子

  // 足あと: ぬかるみでは深く濃く、泥のついた足は草の上にも泥の跡を残す
  const prints = [], printGeo = new THREE.CircleGeometry(1, 14);
  const printMats = [0.25, 0.4, 0.55, 0.7].map(o => new THREE.MeshBasicMaterial({ color: 0x3c3226, transparent: true, opacity: o, depthWrite: false }));
  function addPrint(f, P) {
    const p = f.body.translation(), m0 = mud(p.x, p.z, rainOn ? 1 : 0), fm = D[f.name] ? D[f.name].mud * (1 - D[f.name].dry) : 0, k = Math.max(m0, fm * 0.8);
    if (k < 0.05 && !f.hind) return;
    const m = new THREE.Mesh(printGeo, printMats[Math.min(3, Math.floor(k * 4))]);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -P.yaw; m.scale.set(f.hind ? 0.035 : 0.014, 0.012, 1);
    m.position.set(p.x - (f.hind ? 0.04 * P.fx : 0), height(p.x, p.z) + 0.004, p.z - (f.hind ? 0.04 * P.fz : 0)); scene.add(m); prints.push(m);
    if (prints.length > 400) scene.remove(prints.shift());
  }

  // 雨
  let rainOn = false;
  const RAIN = 2500, rg = new THREE.BufferGeometry(), rp = new Float32Array(RAIN * 6); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfc8d0, transparent: true, opacity: 0.25 })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const drops = Array.from({ length: RAIN }, () => [Math.random() * 5 - 2.5, Math.random() * 3, Math.random() * 5 - 2.5]);
  function setRain(on) {
    rainOn = on; opts.onRain?.(on); $('outRain').classList.toggle('on', on); rain.visible = on; G.setWet(on ? 1 : 0);
    const bg = BG.clone().lerp(new THREE.Color(0x8d939a), on ? 0.4 : 0); scene.background.copy(bg); scene.fog.color.copy(bg); sun.intensity = on ? 0.7 : 2.2; hemi.intensity = on ? 0.8 : 1.0;
  }
  $('outRain').addEventListener('pointerdown', e => { e.stopPropagation(); setRain(!rainOn); });

  // 入力（ユーザー「WASD はいらない。目的地をタップに一本化」）: さわった所へ向かう（そこが光る）。藪そのものをさわっても、その藪へ向かう。ドラッグで見まわす・2本指かホイールで寄る
  let active = false, target = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _sp = new THREE.Sphere();
  const markGeo = new THREE.RingGeometry(0.74, 1, 44).rotateX(-Math.PI / 2), markOf = () => { const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); m.renderOrder = 6; scene.add(m); return m; };
  const mark = markOf(), burst = markOf(); let markT = -1;
  function setTarget(p) { const L = SIZE / 2 - 1.5, x = Math.max(-L, Math.min(L, p.x)), z = Math.max(-L, Math.min(L, p.z)); target = new THREE.Vector3(x, 0, z); markT = 0; mark.position.set(x, height(x, z) + 0.015, z); burst.position.copy(mark.position); $('outHint').style.opacity = 0; }
  function stepMark(dt) { if (markT < 0) return; markT += dt; const u = Math.min(1, markT / 0.55); burst.scale.setScalar(0.05 + 0.34 * u); burst.material.opacity = 0.95 * (1 - u); mark.scale.setScalar(0.1 + 0.012 * Math.sin(markT * 6)); mark.material.opacity += ((target ? 0.85 : 0) - mark.material.opacity) * 0.15; if (!target && u >= 1 && mark.material.opacity < 0.02) { mark.material.opacity = 0; markT = -1; } }
  function pick(e) {
    ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, cam);
    const Pk = pose(H); let best = null, bd = 1e9; for (const b of BUSHES) { _sp.center.set(b[0], height(b[0], b[1]) + 0.25, b[1]); _sp.radius = 0.42; if (Math.hypot(Pk.x - b[0], Pk.z - b[1]) < 1 || cam.position.distanceTo(_sp.center) < 0.55) continue; /* 着いた藪は画面いっぱいになるので素通り＝地面をさわって出られる */ const q = ray.ray.intersectSphere(_sp, _c); if (q) { const d = q.distanceTo(cam.position); if (d < bd) { bd = d; best = { x: b[0], z: b[1] }; } } }
    if (best) return setTarget(best); const h = ray.intersectObject(G.ground)[0]; if (h) setTarget(h.point);
  }
  function turnView(dx, dy, k = 0.006) { const d = dx * k * (invX ? -1 : 1); camYaw += d; camOff += d; camPitch = Math.max(0.18, Math.min(1.25, camPitch + dy * k * (invY ? 1 : -1))); } // 下限＝地面すれすれにしない（藪の向こうの空をさわってしまう）
  gesture(renderer.domElement, { on: () => active, tap: pick, drag: turnView, zoom: f => (camDist = Math.max(0.5, Math.min(3, camDist * f))) });

  const wrap = a => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
  function wish(P) {
    if (!target) return { go: 0 };
    const dx = target.x - P.x, dz = target.z - P.z; if (Math.hypot(dx, dz) < 0.25) { target = null; return { go: 0 }; } return { yaw: Math.atan2(dz, dx), go: 1 };
  }

  // 転んだら、少し待ってその場で起き直す（向きは転ぶ前のまま、場所は地面のはしより内側。泥とぬれは引きつぐ）
  function respawn() {
    const P = pose(H); for (const p of Object.values(H.parts)) world.removeRigidBody(p.body);
    const L = SIZE / 2 - 1.5, keep = D; H = K.B.build(R, world, [Math.max(-L, Math.min(L, P.x)), 0, Math.max(-L, Math.min(L, P.z))], height, P.yaw); D = makeDirt(H);
    for (const k in D) if (keep[k]) Object.assign(D[k], { mud: keep[k].mud, wet: keep[k].wet, dry: keep[k].dry });
    FB.rebind(H, P.yaw); t = 0; gNow = 0; gu = null;
  }

  let gu = null, t = 0, clock = 0, gNow = 0, turnNow = 0, fallT = 0, fallAt = [], needT = 0, reached = 0;
  function step(dt) {
    if (!K) return;
    const n = Math.round(dt * 240);
    for (let k = 0; k < n; k++) {
      if (k % 4 === 0) {
        const P = pose(H), w = wish(P);
        gNow += Math.max(-3 / 60, Math.min(3 / 60, (w.go ? 1 : 0) - gNow));
        turnNow = w.go ? Math.max(-1, Math.min(1, wrap(w.yaw - P.yaw) * 1.5)) : 0;
        BUSHES.forEach((b, i) => { if (!touched[i] && Math.hypot(P.x - b[0], P.z - b[1]) < BUSH_TOUCH) { touched[i] = true; reached++; stick(i, 5); opts.onBurr?.(); show(`${SEED_KINDS[i].name} の ひっつき虫がついた`); lit(); } });
        for (const f of H.feet) { const d = !!contactPoint(f), air = f.air || 0; f.air = d ? 0 : air + 1; if (d && !f.down) { addPrint(f, P); if (air >= 6) opts.onStep?.(f); } f.down = d; } // 足音は 0.1 秒より長く浮いたあとの1歩だけ
        if (clock - walkedT > 1.5) { walkedT = clock; walked.push([+P.x.toFixed(2), +P.z.toFixed(2)]); if (walked.length > 24) walked.shift(); } // 走った地面（帰ると、その子の練習の場所に入る）
        FB.mud.hit(stepDirt(D, H, 4 / 240, rainOn ? 1 : 0));
        // 転んだら: 起き上がりを覚えた子は少し待って自分で起きる（4 秒で起きなければ起き直す）。覚えていない子は、すぐ起き直す（失敗を見せない。GAME.md 9.7）
        if (gu) { if (gu.stopAt == null && gu.t > 0.2 && P.up > GETUP_UP) gu.stopAt = gu.t; if (gu.t > 4) { gu = null; respawn(); fallT = 0; } }
        else if (fallT) { if (K.getup && clock - fallT > 0.6) gu = { t: 0, d: Math.sign(P.roll) || 1, stopAt: null }; else if (!K.getup && clock - fallT > 0.8) { respawn(); fallT = 0; } }
        else if (P.up < 0.35 || P.y - height(P.x, P.z) < (H.fallH ?? 0.05)) { fallT = clock; fallAt.push(clock); opts.onFall?.(); }
        // 20 秒に 3 回より多く転ぶなら「もうすこし練習してから」（責める文にしない）
        while (fallAt.length && clock - fallAt[0] > 20) fallAt.shift(); if (fallAt.length >= 3) needT = clock; $('outNeed').hidden = !(needT && clock - needT < 12);
      }
      if (gu) { gu.t += 1 / 240; if (driveGetup(H, K.getup, gu.t, gu.d, gu.stopAt)) { gu = null; fallT = 0; t = 0; } }
      else K.B.drive(H, Q, t, fallT ? 0 : gNow, turnNow);
      world.step(); t += 1 / 240; clock += 1 / 240;
    }
  }
  // ひっつき虫: 藪にふれると、胴や足の毛に種がつく（泥の点と同じく、骨から見た場所で持ち帰る）。藪の種類ごとに ちがう花になる
  let burrs = [], walked = [], walkedT = 0;
  function stick(kind, n) {
    const parts = Object.entries(H.parts).filter(([, p]) => p.r > 0.012 && p.a);
    for (let i = 0; i < n && burrs.length < 25; i++) {
      const [name, p] = parts[(Math.random() * parts.length) | 0], a = Math.random() * 6.283, u = Math.random() - 0.5, ax = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]];
      const s = new THREE.Vector3(...ax).normalize(), v = new THREE.Vector3(...(Math.abs(s.y) > 0.7 ? [1, 0, 0] : [0, 1, 0])).cross(s).normalize(), w = s.clone().cross(v), o = v.multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a)).multiplyScalar(p.r * 1.25);
      const local = [ax[0] * u + o.x, ax[1] * u + o.y, ax[2] * u + o.z], m = makeBurr(kind);
      if (FB.attach(name, m, local)) burrs.push({ kind, part: name, local });
    }
  }
  let msgT = 0; function show(s) { const el = $('outMsg'); el.textContent = s; el.style.opacity = 1; clearTimeout(msgT); msgT = setTimeout(() => (el.style.opacity = 0), 1400); }
  function stepRain(dt, P) {
    if (!rainOn) return;
    for (let i = 0; i < RAIN; i++) { const d = drops[i]; d[1] -= dt * 6; if (d[1] < -0.2) { d[0] = Math.random() * 5 - 2.5; d[2] = Math.random() * 5 - 2.5; d[1] = 2.5 + Math.random(); }
      const x = P.x + d[0], z = P.z + d[2], y = height(x, z) + d[1]; rp.set([x, y, z, x + 0.01, y + 0.07, z], i * 6); }
    rg.attributes.position.needsUpdate = true;
  }

  // カメラ（ユーザー「もうちょっと顔が見える角度に」）: ななめ＝子のななめうしろから（曲がっても少し遅れてついてくる）・うしろ・見下ろし。どれもドラッグで回せる。種類と回す向きはメニューから
  const CAMS = { follow: { off: 1.15, pitch: 0.5, lag: 0.018, blur: 1.6, dist: 1 }, tps: { off: 0, pitch: 0.35, lag: 0.04, blur: 1.2, dist: 1 }, top: { off: 0, pitch: 1.05, lag: 0, blur: 4, dist: 2.2 } };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 保存できない */ } };
  let camYaw = 0, camOff = 0, camPitch = 0.5, camDist = 1.3, camMode = CAMS[load('satoyama.cam', 'follow')] ? load('satoyama.cam', 'follow') : 'follow', invX = load('satoyama.invX', '0') === '1', invY = load('satoyama.invY', '1') !== '0', frame = 0;
  const camPos = new THREE.Vector3(-1.2, 0.7, 0), aimP = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  let aimInit = false;
  const baseYaw = () => (camMode === 'top' ? -Math.PI / 4 : H ? pose(H).yaw : 0);
  function setCam(m) { camMode = m; camOff = CAMS[m].off; camPitch = CAMS[m].pitch; camYaw = baseYaw() + camOff; save('satoyama.cam', m); }
  $('outHome').addEventListener('click', () => onHome());
  function render(dt) {
    if (!K) return;
    FB.pose(dt); FB.breathe(dt, fallT ? 0 : gNow); FB.mud.step(dt, rainOn ? 1 : 0); if (frame++ % 3 === 0) FB.paint(D);
    const P = pose(H); stepRain(dt, P); stepMark(dt);
    const gy = height(P.x, P.z), k = Math.min(1, dt * 60), first = !aimInit;
    if (first) { aimP.set(P.x, gy + 0.17, P.z); aimInit = true; }
    aimP.x += (P.x - aimP.x) * 0.12 * k; aimP.z += (P.z - aimP.z) * 0.12 * k; aimP.y += (gy + 0.17 - aimP.y) * 0.05 * k; // 跳ぶたびの上下と着地のがたつきをならす
    const A = aimP, C = CAMS[camMode], blur = C.blur, focus = camMode === 'top' ? 0.5 : 0.55;
    if (!C.lag) camYaw = baseYaw() + camOff; else if (gNow > 0.2) camYaw += wrap(baseYaw() + camOff - camYaw) * C.lag * k; // 歩いているときだけ、ゆっくり回りこむ
    const d = camDist * C.dist * (cam.aspect < 1 ? 1.4 : 1), cp = Math.cos(camPitch), want = _a.set(A.x - Math.cos(camYaw) * cp * d, A.y + Math.sin(camPitch) * d, A.z - Math.sin(camYaw) * cp * d);
    want.y = Math.max(want.y, height(want.x, want.z) + 0.12); if (first) camPos.copy(want); else camPos.lerp(want, 0.1 * k); cam.position.copy(camPos); cam.lookAt(A.x, A.y + 0.04, A.z);
    // カメラと子を結ぶ線に近い藪は透かす（目線のときは、目の前の藪だけ）
    const a = cam.position, ab = _b.set(P.x, P.y, P.z).sub(a), L2 = Math.max(ab.lengthSq(), 0.01);
    for (const b of bushes) { const c = _c.copy(b.position).add(_a.set(0, 0.15, 0)), u = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / L2)), d = c.distanceTo(a.clone().addScaledVector(ab, u)); const want = d < 0.4 && u > 0.05 ? 0.2 : 1; b.userData.fade += (want - b.userData.fade) * 0.15; for (const k2 of ['off', 'on']) for (const m of b.userData.mats[k2]) m.opacity = b.userData.fade; for (const m of b.children) m.visible = !m.userData.flower ? m.userData.s === 0 || b.userData.fade > 0.9 : b.userData.fade > 0.5; }
    sun.position.set(P.x + 3, 6, P.z + 2); sun.target.position.set(P.x, 0, P.z);
    DIO.render(blur, focus, 0.3);
    $('outHud').innerHTML = `<b>${K.name.replace(/[<>&]/g, '')}</b><br>${reached ? `藪 ${reached}/${BUSHES.length}` : '<small>藪にふれよう</small>'}`;
  }
  const opts = {};
  return {
    get active() { return active; }, set onStep(f) { opts.onStep = f; }, set on(f) { Object.assign(opts, f); }, get raining() { return rainOn; }, get camMode() { return camMode; }, setCamMode: setCam, get invX() { return invX; }, get invY() { return invY; }, setInv(axis, on) { if (axis === 'X') invX = on; else invY = on; save('satoyama.inv' + axis, on ? '1' : '0'); },
    // でかける: いま見ている子（残してある数）と泥の点。練習の途中でも入れる（いちばんよい歩き、なければいま試している歩き）
    enter(saved, mudBlobs) {
      const B = kidBody(saved.genes);
      K = { name: saved.name || '', B, getup: saved.getup?.v ? decodeGetup(saved.getup.v) : null };
      Q = B.decode(saved.v || saved.trying); H = B.build(R, world, [0, 0, 0], height); D = makeDirt(H);
      FB = makeFeltBody(scene, H, kidShapes(H), { furColor: lookFur(saved.genes.look, H), face: lookFace(saved.genes.look, H.plan, HARE_FACE) });
      FB.mud.blobs = (mudBlobs || []).map(b => ({ ...b })); burrs = []; walked = []; walkedT = clock;
      $('outNeed').textContent = `${K.name} と、もうすこし練習してからにしよう`;
      t = 0; gNow = 0; gu = null; fallT = 0; fallAt = []; needT = 0; reached = 0; touched.fill(false); lit(); target = null; markT = -1; mark.material.opacity = burst.material.opacity = 0; aimInit = false;
      $('outHint').textContent = '行きたい所をさわる・ドラッグで見まわす'; $('outHint').style.opacity = 1; root.hidden = false; active = true; setCam(camMode);
    },
    // 帰る: 体と皮を消して、泥の点を返す
    leave() {
      if (!K) return null; const blobs = FB.mud.blobs.map(b => ({ ...b })), carried = burrs;
      for (const p of Object.values(H.parts)) world.removeRigidBody(p.body); FB.dispose(); prints.splice(0).forEach(m => scene.remove(m));
      K = H = D = FB = Q = null; active = false; root.hidden = true;
      return { mud: blobs, reached, burrs: carried, walked: walked.slice() };
    },
    step, render,
    resize() { DIO.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); },
    // 確かめ用
    aim(i = Math.max(0, touched.indexOf(false))) { const b = BUSHES[i]; setTarget({ x: b[0], z: b[1] }); }, get pose() { return H && pose(H); }, get reached() { return reached; }, get burrs() { return burrs; }, rain: setRain, cam: setCam,
  };
}
