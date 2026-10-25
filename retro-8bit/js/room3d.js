// 部屋（v021。2026-10-25 ユーザーと決めた案A＋C）: 机の上のブラウン管と本体とコントローラー。Three.js（ほかのゲームと同じ 0.160.0、index.html の importmap）。
// 見くらべ look/look9.html を部品にしたもの。トップの上半分（案A）と、遊ぶ画面の「部屋で遊ぶ」（案C）の両方で1つを使い回す（attach で入れ物を移す）。
// - 本体は 80年代ふうを細くした形。色はあそびラボのアイコン（だいだいと白）。カセットは上から立てて入れ、上が少し出る
// - コントローラーはアイコンの白い丸いパッド（十字とボタンはだいだい）。線で本体につなぐ
// - ブラウン管はうしろがすぼまった箱。画面は遊ぶ画面と同じブラウン管（ビデオ端子）の絵を、ふくらんだガラスに貼る
// - 実在の機械の目印（赤と白・金色・取り出しレバー・本体につながったままのコントローラーの置き場）は使わない
// 描くのは動いているときだけ（止まっているあいだは描かない。タブを離れたら止める）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCRT } from './crt/crt-gl.js';

const ORANGE = 0xd9480f, ORANGE_D = 0xb83c0c, WHITE = 0xf6f1e8, IVORY = 0xe9dfcc, IVORY_D = 0xd8ccb6, DARK = 0x2b2826;
const LIGHT = matchMedia('(pointer:coarse)').matches;   // 指の端末は軽く（影なし・細かさを下げる）

export function createRoom() {
  const canvas = document.createElement('canvas');
  canvas.className = 'room3d';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LIGHT, alpha: false });
  renderer.setPixelRatio(Math.min(LIGHT ? 1.5 : 2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = !LIGHT; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a231d);
  scene.fog = new THREE.Fog(0x2a231d, 22, 44);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minAzimuthAngle = -1.1; controls.maxAzimuthAngle = 1.1;

  // 光
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 0.55));
  const key = new THREE.DirectionalLight(0xffe7c8, 2.2);
  key.position.set(-6, 9, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  key.shadow.bias = -0.0004; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc8d8ff, 0.6); rim.position.set(5, 5, -6); scene.add(rim);
  const glow = new THREE.SpotLight(0x9fb6ff, 0, 6, 0.8, 0.9, 2); glow.position.set(-1.35, 2.1, 1.1); glow.target.position.set(-1.35, 0, 3.5); scene.add(glow, glow.target);

  // ---------- 小物の道具 ----------
  function noiseTex(size, k, base, amp) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), im = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) { const v = base + (Math.random() - 0.5) * amp + Math.sin(i * k) * 2; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
  }
  const GRAIN = noiseTex(256, 0.013, 128, 90), RMAP = noiseTex(256, 0.002, 200, 40);
  const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6, bumpMap: GRAIN, bumpScale: 0.6, roughnessMap: RMAP, ...o });
  const box = (w, h, d, r, m, seg = 4) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, LIGHT ? 2 : seg, r), m); o.castShadow = o.receiveShadow = true; return o; };
  function rrShape(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function textTex(lines, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (const l of lines) { g.font = l.font; g.fillStyle = l.color; g.textAlign = l.align || 'left'; g.textBaseline = 'middle'; if (l.ls) g.letterSpacing = l.ls; g.fillText(l.text, l.x, l.y); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const decal = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));

  // ---------- 机と壁 ----------
  {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#8d6844'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1024; i += 2) {
      const a = 0.04 + 0.05 * Math.abs(Math.sin(i * 0.37) * Math.sin(i * 0.071));
      g.fillStyle = `rgba(${90 + (i % 7) * 4},${55 + (i % 5) * 3},25,${a})`;
      g.fillRect(0, i + Math.sin(i * 0.05) * 2, 1024, 1.2);
    }
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(60,35,15,.18)'; g.fillRect(0, k * 170 + 30, 1024, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 6); t.anisotropy = 8;
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ map: t, roughness: 0.68, bumpMap: GRAIN, bumpScale: 0.3 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 24), new THREE.MeshStandardMaterial({ color: 0x5a4c3f, roughness: 0.95 }));
    wall.position.set(0, 12, -5); scene.add(wall);
  }

  // ---------- ブラウン管 ----------
  const tv = new THREE.Group(); tv.position.set(-1.35, 0, 0); scene.add(tv);
  const tvMat = mat(IVORY, { roughness: 0.62, bumpScale: 0.9 }), tvMatD = mat(IVORY_D, { roughness: 0.7, bumpScale: 1.1 });
  const TVW = 4.3, TVH = 3.55, FY = 0.28 + TVH / 2;
  const face = box(TVW, TVH, 0.62, 0.2, tvMat); face.position.set(0, FY, 0.77); tv.add(face);
  {
    const g = new RoundedBoxGeometry(3.9, 3.15, 2.5, LIGHT ? 3 : 6, 0.42), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), t = (1.25 - z) / 2.5, s = 1 - 0.42 * t; p.setX(i, p.getX(i) * s); p.setY(i, p.getY(i) * s + (1 - s) * 0.25); }
    g.computeVertexNormals();
    const back = new THREE.Mesh(g, tvMatD); back.castShadow = back.receiveShadow = true; back.position.set(0, FY + 0.05, -0.55); tv.add(back);
    for (let i = 0; i < 9; i++) { const s = box(1.8, 0.03, 0.06, 0.015, mat(0x8c8273)); s.position.set(0, FY + 1.3 - i * 0.012, -0.2 - i * 0.16); s.scale.x = 1 - i * 0.035; tv.add(s); }
  }
  const plinth = box(3.1, 0.28, 2.3, 0.1, tvMatD); plinth.position.set(0, 0.14, 0.1); tv.add(plinth);
  {
    const outer = rrShape(3.62, 2.8, 0.34); outer.holes.push(rrShape(3.3, 2.5, 0.3));
    const bez = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 16 }), mat(DARK, { roughness: 0.6, clearcoat: 0.1 }));
    bez.position.set(0, FY + 0.25, 1.07); bez.castShadow = true; tv.add(bez);
  }
  // 画面
  const crtCanvas = document.createElement('canvas'); crtCanvas.width = 731; crtCanvas.height = 600;   // 256×8/7×2.5・240×2.5（テレビの横長の画素）
  const screenTex = new THREE.CanvasTexture(crtCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;   // 小さく映るときにブラウン管の網目がしまにならないよう、ミップマップあり
  let glass;
  {
    const W = 3.3, H = 2.5, g = new THREE.PlaneGeometry(W, H, 40, 30), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (W / 2), y = p.getY(i) / (H / 2); p.setZ(i, 0.26 * (1 - x * x * 0.92) * (1 - y * y * 0.92)); }
    g.computeVertexNormals();
    const mc = document.createElement('canvas'); mc.width = 330; mc.height = 250; const mg = mc.getContext('2d');
    mg.fillStyle = '#000'; mg.fillRect(0, 0, 330, 250); mg.fillStyle = '#fff'; mg.beginPath(); mg.roundRect(0, 0, 330, 250, 32); mg.fill();
    glass = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.14, alphaMap: new THREE.CanvasTexture(mc), transparent: true }));
    glass.position.set(0, FY + 0.25, 1.095); tv.add(glass);
    const well = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const o = rrShape(3.36, 2.56, 0.32); o.holes.push(rrShape(3.24, 2.44, 0.29)); return o; })(), { depth: 0.12, bevelEnabled: false, curveSegments: 16 }), new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 0.9 }));
    well.position.set(0, FY + 0.25, 0.99); tv.add(well);
  }
  let tvLed;
  {
    const by = FY - TVH / 2 + 0.3, fz = 1.085;
    const name = decal(textTex([{ text: 'ASOBI-LAB', x: 8, y: 32, font: '800 34px "Hiragino Sans","Yu Gothic UI",sans-serif', color: '#7a8b80', ls: '6px' }], 360, 64), 1.25, 0.22);
    name.position.set(-1.35, by, fz); tv.add(name);
    for (const x of [1.0, 1.42]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.136, 0.12, 32), mat(IVORY_D, { roughness: 0.35 })); k.rotation.x = Math.PI / 2; k.position.set(x, by, fz + 0.03); k.castShadow = true; tv.add(k);
      const n = box(0.025, 0.2, 0.03, 0.01, mat(0x9a8e7c)); n.position.set(x, by, fz + 0.1); tv.add(n);
    }
    tvLed = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0xff3a2a, emissiveIntensity: 0 })); tvLed.position.set(1.78, by, fz + 0.02); tv.add(tvLed);
    const sp = document.createElement('canvas'); sp.width = 256; sp.height = 64; const sg = sp.getContext('2d');
    for (let y = 8; y < 64; y += 12) for (let x = 8; x < 256; x += 12) { sg.fillStyle = 'rgba(60,50,40,.55)'; sg.beginPath(); sg.arc(x, y, 3, 0, 7); sg.fill(); }
    const spk = decal(new THREE.CanvasTexture(sp), 0.9, 0.22); spk.position.set(0.05, by, fz); tv.add(spk);
  }

  // ---------- 本体 ----------
  const con = new THREE.Group(); con.position.set(2.25, 0, 0.75); scene.add(con);
  const oMat = mat(ORANGE, { roughness: 0.45, clearcoat: 0.3, bumpScale: 0.4 }), oMatD = mat(ORANGE_D, { roughness: 0.5 }), wMat = mat(WHITE, { roughness: 0.4, clearcoat: 0.35, bumpScale: 0.3 });
  const CW = 2.2, CH = 0.9, CD = 2.3, TOP = 0.06 + CH;
  const body = box(CW, CH, CD, 0.14, oMat, 6); body.position.y = 0.06 + CH / 2; con.add(body);
  for (const [x, z] of [[-0.85, -0.9], [0.85, -0.9], [-0.85, 0.9], [0.85, 0.9]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.06, 20), mat(0x2a2522, { roughness: 0.9 })); f.position.set(x, 0.03, z); con.add(f); }
  const lid = box(CW - 0.24, 0.06, 1.55, 0.03, wMat); lid.position.set(0, TOP, -0.18); con.add(lid);
  const slotW = 1.32, slotD = 0.24, slotZ = -0.45;
  const slot = box(slotW, 0.05, slotD, 0.02, mat(0x141210, { roughness: 0.8, clearcoat: 0 })); slot.position.set(0, TOP + 0.012, slotZ); con.add(slot);
  {
    const o = rrShape(slotW + 0.14, slotD + 0.14, 0.07); o.holes.push(rrShape(slotW, slotD, 0.03));
    const lip = new THREE.Mesh(new THREE.ExtrudeGeometry(o, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 }), mat(0xeae3d6, { roughness: 0.3 }));
    lip.rotation.x = -Math.PI / 2; lip.position.set(0, TOP + 0.03, slotZ); con.add(lip);
  }
  for (let i = 0; i < 3; i++) { const gr = box(CW - 0.6, 0.012, 0.03, 0.006, mat(0xd8d0c2)); gr.position.set(0, TOP + 0.035, 0.25 + i * 0.12); con.add(gr); }
  let conLed;
  {
    const fz = CD / 2 + 0.002, y = 0.06 + CH / 2;
    const nm = decal(textTex([{ text: 'ASOBI-LAB 8', x: 6, y: 30, font: '800 30px "Hiragino Sans","Yu Gothic UI",sans-serif', color: '#ffffff', ls: '4px' }], 300, 60), 0.92, 0.18);
    nm.position.set(-0.52, y + 0.14, fz); con.add(nm);
    for (const x of [0.38, 0.72]) { const b = box(0.26, 0.11, 0.08, 0.05, wMat); b.position.set(x, y + 0.14, fz + 0.01); con.add(b); }
    conLed = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0xff3a2a, emissiveIntensity: 0 })); conLed.position.set(0.95, y + 0.14, fz + 0.01); con.add(conLed);
    for (const x of [-0.84, -0.6]) { const j = box(0.17, 0.08, 0.04, 0.035, mat(0x1d1a18, { roughness: 0.8, clearcoat: 0 })); j.position.set(x, y - 0.16, fz); con.add(j); }
    const lb = decal(textTex([{ text: '1P', x: 34, y: 16, font: '700 18px sans-serif', color: '#ffe6d8', align: 'center' }, { text: '2P', x: 110, y: 16, font: '700 18px sans-serif', color: '#ffe6d8', align: 'center' }], 150, 32), 0.36, 0.077);
    lb.position.set(-0.72, y - 0.27, fz); con.add(lb);
    const band = box(CW + 0.002, 0.05, CD + 0.002, 0.02, oMatD); band.position.y = 0.11; con.add(band);
  }
  // カセット（幅 1.2・高さ 1.56・厚さ 0.17。棚のカセット 160×208 と同じ形。入ると上 0.7 が見える）
  const CART_H = 1.56, OUT = 0.7, REST = TOP - (CART_H - OUT), ABOVE = TOP + 0.35;
  const cart = new THREE.Group(); cart.position.set(0, REST, slotZ); cart.visible = false; con.add(cart);
  const cartMat = mat(0x3f4f86, { roughness: 0.4, clearcoat: 0.3, bumpScale: 0.3 });
  { const cb = box(1.2, CART_H, 0.17, 0.06, cartMat, 4); cb.position.y = CART_H / 2; cart.add(cb); const grip = box(0.5, 0.04, 0.18, 0.015, mat(0x000000, { transparent: true, opacity: 0.25 })); grip.position.y = CART_H - 0.06; cart.add(grip); }
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 256; labelCanvas.height = 300;
  const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.17), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55 })); label.position.set(0, CART_H - 0.135 - 0.585, 0.087); cart.add(label);

  // ---------- コントローラーと線 ----------
  const pad = new THREE.Group(); pad.position.set(0.55, 0, 2.55); pad.rotation.y = 0.22; scene.add(pad);
  {
    const L = 1.5, Wd = 0.62, r = Wd / 2, s = new THREE.Shape();
    s.absarc(-L / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false); s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    const pb = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: LIGHT ? 3 : 6, curveSegments: 32 }), mat(WHITE, { roughness: 0.28, clearcoat: 0.6 }));
    pb.rotation.x = -Math.PI / 2; pb.position.y = 0.07; pb.castShadow = pb.receiveShadow = true; pad.add(pb);
    const top = 0.23, a = 0.06, b = 0.18, cross = new THREE.Shape();
    cross.moveTo(-a, b); cross.lineTo(a, b); cross.lineTo(a, a); cross.lineTo(b, a); cross.lineTo(b, -a); cross.lineTo(a, -a); cross.lineTo(a, -b); cross.lineTo(-a, -b); cross.lineTo(-a, -a); cross.lineTo(-b, -a); cross.lineTo(-b, a); cross.lineTo(-a, a); cross.closePath();
    const dp = new THREE.Mesh(new THREE.ExtrudeGeometry(cross, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 3 }), oMat);
    dp.rotation.x = -Math.PI / 2; dp.position.set(-0.43, top, 0); dp.castShadow = true; pad.add(dp);
    for (const [x, z] of [[0.36, 0.06], [0.54, -0.1]]) { const bt = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), oMat); bt.scale.y = 0.45; bt.position.set(x, top - 0.005, z); bt.castShadow = true; pad.add(bt); }
    for (const x of [-0.06, 0.1]) { const ss = box(0.12, 0.03, 0.05, 0.02, mat(0x8b847a, { roughness: 0.6 })); ss.position.set(x, top + 0.005, 0.12); ss.rotation.y = -0.4; pad.add(ss); }
    const pts = [new THREE.Vector3(0.62, 0.1, 2.3), new THREE.Vector3(0.7, 0.03, 1.9), new THREE.Vector3(0.6, 0.03, 1.3), new THREE.Vector3(0.95, 0.03, 0.75), new THREE.Vector3(1.15, 0.2, 0.6)];
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.022, 10), mat(0x3a3530, { roughness: 0.7, clearcoat: 0 })); cord.castShadow = true; scene.add(cord);
  }

  // ---------- ブラウン管の絵（ビデオ端子。遊ぶ画面と同じ計算） ----------
  let crt = null, worker = null, wbusy = false, crtFrames = 0, glowTick = 0;
  try { crt = createCRT(crtCanvas); crt.setPicture({ w: 256, h: 240, data: new Uint8Array(256 * 240 * 4) }); } catch { crt = null; }
  const flat = document.createElement('canvas'); flat.width = 256; flat.height = 240; const fg = flat.getContext('2d'), fim = fg.createImageData(256, 240), fpx = new Uint32Array(fim.data.buffer);
  if (crt) {
    try {
      worker = new Worker(new URL('./crt/worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        wbusy = false;
        crt.setSignal(e.data.sig, 1024, 240, 256, 240, e.data.glow || false);
        crt.draw({ view: [0, 0, 2.5], split: -1, scan: 1, inter: 0, mask: 1, triads: 1.5, gamma: 2.4, bloom: 0.12, curve: 1, par: 8 / 7, rowH: 1, dotW: 1, noise: 0, seed: (crtFrames++ % 97) * 0.37 });
        screenTex.needsUpdate = true; lightUp(); kick(2);
      };
    } catch { worker = null; }
  }
  if (!crt || !worker) { screenTex.image = flat; screenTex.magFilter = THREE.NearestFilter; }
  // 電源を入れても、新しい絵がとどくまで画面は暗いまま（前のソフトの絵が一瞬見えないように）
  let wantOn = false;
  function lightUp() { if (wantOn) { glass.material.emissiveIntensity = 1.3; glow.intensity = 6; } }
  function show(frame) {
    if (!crt || !worker) { fpx.set(frame); fg.putImageData(fim, 0, 0); screenTex.needsUpdate = true; lightUp(); kick(2); return; }
    if (wbusy) return;
    wbusy = true;
    const copy = new Uint8ClampedArray(frame.buffer.slice(0));
    worker.postMessage({ data: copy, link: 'composite', glow: (glowTick++ & 3) === 0 }, [copy.buffer]);
  }

  // ---------- 見る向き・描く ----------
  // hw: 横に入れたい半分の幅（画面が細いときは、これが入るまで引く）
  const SHELF = { az: -0.3, el: 0.24, d: 9.4, hw: 4.3, t: new THREE.Vector3(0.3, 1.55, 0.8) };
  const TVV = { az: 0, el: 0.06, d: 7.4, hw: 2.4, t: new THREE.Vector3(-1.35, 2.05, 1.2) };
  let view = SHELF, tween = null, frames = 0, running = false, host = null;
  const fitDist = (v) => { const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect); return Math.max(v.d, v.hw / Math.tan(hf) * 1.04); };
  const posOf = (v) => { const d = fitDist(v); return new THREE.Vector3(v.t.x + d * Math.sin(v.az) * Math.cos(v.el), v.t.y + d * Math.sin(v.el), v.t.z + d * Math.cos(v.az) * Math.cos(v.el)); };
  function goView(v, ms = 900) {
    view = v;
    if (!ms) { camera.position.copy(posOf(v)); controls.target.copy(v.t); controls.update(); kick(2); return Promise.resolve(); }
    return new Promise((ok) => { tween = { p0: camera.position.clone(), p1: posOf(v), t0: controls.target.clone(), t1: v.t.clone(), s: performance.now(), ms, ok }; kick(); });
  }
  controls.addEventListener('start', () => { tween = null; kick(); });
  controls.addEventListener('change', () => kick(2));
  canvas.addEventListener('dblclick', () => goView(view));
  function kick(n = 0) { frames = Math.max(frames, n); if (!running) { running = true; requestAnimationFrame(loop); } }
  let anims = [];   // カセットの上げ下げ
  const ease3 = (t) => 1 - Math.pow(1 - t, 3);
  function loop() {
    let busy = frames > 0 || anims.length > 0 || !!tween;
    if (frames > 0) frames--;
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.s) / tween.ms), e = ease3(k);
      camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (k >= 1) { const ok = tween.ok; tween = null; ok(); }
    }
    const now = performance.now();
    anims = anims.filter((a) => { const k = Math.min(1, (now - a.s) / a.ms); a.step(k); if (k >= 1) { a.ok(); return false; } return true; });
    if (controls.update()) busy = true;
    renderer.render(scene, camera);
    if (busy && !document.hidden) requestAnimationFrame(loop); else running = false;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(2); });
  function resize() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect < 1 ? 40 : 32; camera.updateProjectionMatrix();
    if (!tween) { camera.position.copy(posOf(view)); controls.target.copy(view.t); }
    kick(2);
  }
  const ro = new ResizeObserver(resize);

  function paintLabel(src, title) {
    const g = labelCanvas.getContext('2d');
    g.fillStyle = '#f8f3e8'; g.fillRect(0, 0, 256, 300);
    g.imageSmoothingEnabled = false;
    if (src) g.drawImage(src, 0, 0, src.width, src.height, 10, 10, 236, 221);
    g.fillStyle = '#2a1a10'; g.font = '700 22px "Hiragino Sans","Yu Gothic UI",sans-serif'; g.textBaseline = 'middle';
    g.fillText(title || '', 12, 262, 232);
    labelTex.needsUpdate = true;
  }
  function anim(ms, step) { return new Promise((ok) => { anims.push({ s: performance.now(), ms, step, ok }); kick(); }); }

  goView(SHELF, 0);
  return {
    canvas,
    // 入れ物（トップの上半分、または遊ぶ画面のまん中）へ移す
    attach(el, mode) {
      host = el; el.append(canvas); ro.disconnect(); ro.observe(el);
      controls.enabled = mode !== 'play';
      view = mode === 'play' ? TVV : SHELF;
      resize(); camera.position.copy(posOf(view)); controls.target.copy(view.t); controls.update(); kick(2);
    },
    // 口の真上（画面の座標）: 棚のカセットをここまで飛ばしてから、3D のカセットに入れかえる
    slotRect() {
      const r = canvas.getBoundingClientRect(), p = new THREE.Vector3(0, ABOVE, slotZ), q = new THREE.Vector3(0.6, ABOVE, slotZ), b = new THREE.Vector3(0, ABOVE + CART_H, slotZ);
      for (const v of [p, q, b]) con.localToWorld(v).project(camera);
      const sx = (v) => r.left + (v.x + 1) / 2 * r.width, sy = (v) => r.top + (1 - v.y) / 2 * r.height;
      return { cx: sx(p), bottom: sy(p), top: sy(b), w: (sx(q) - sx(p)) * 2 };
    },
    // 入れる: 口の上から すべりこむ（底に着くのは ms の 82%）
    insertCart({ color, label, title }) {
      cartMat.color.set(color); paintLabel(label, title);
      cart.visible = true; cart.position.y = ABOVE;
      return anim(520, (k) => { cart.position.y = k < 0.82 ? ABOVE + (REST - 0.03 - ABOVE) * Math.pow(k / 0.82, 2) : REST - 0.03 + 0.03 * ease3((k - 0.82) / 0.18); });
    },
    // 抜く: ぴょんと上へ（そのあと棚のカセットに入れかえる）
    ejectCart() {
      return anim(380, (k) => { cart.position.y = REST + (ABOVE - REST) * ease3(k); }).then(() => { cart.visible = false; kick(2); });
    },
    seatCart({ color, label, title }) { cartMat.color.set(color); paintLabel(label, title); cart.visible = true; cart.position.y = REST; kick(2); },
    removeCart() { cart.visible = false; kick(2); },
    setPower(on) {
      for (const l of [conLed, tvLed]) l.material.emissiveIntensity = on ? 2.4 : 0;
      wantOn = on; if (!on) { glass.material.emissiveIntensity = 0; glow.intensity = 0; } kick(2);
    },
    show,
    focusTV(on, ms = 900) { return goView(on ? TVV : SHELF, ms); },
    resize,
  };
}
