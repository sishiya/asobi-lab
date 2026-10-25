// 部屋（8ビット互換機の room3d.js を下敷きに、32ビット用にしたもの）: 机の上のブラウン管と本体とコントローラー。Three.js（ほかのゲームと同じ 0.160.0、index.html の importmap）。
// トップの上半分（棚）と、遊ぶ画面の「部屋で遊ぶ」の両方で1つを使い回す（attach で入れ物を移す）。
// - ブラウン管・机・壁は 8ビット互換機と同じボクセル（一辺 0.1）。画面は横 320 ドットの絵（4:3）
// - 本体: 明るい灰白の平たい箱。前にディスクを差しこむ口（スロット）。あそびラボのだいだいの帯と電源・取り出しのボタン
//   （実在の機械の目印＝上のふたが開く丸い形・灰色と紫の組・特定の記号は使わない）
// - ディスク: 平たい円柱。表はラベル（タイトル画面）、裏は虹色の銀。口の前から水平にすべりこむ
// - コントローラー: 白い楕円の板に、十字キーとひし形の4つ（Y 緑・X 青・A 赤・B 黄）、上のふちに L・R。線で本体のうしろへ
// 描くのは動いているときだけ（止まっているあいだは描かない。タブを離れたら止める）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCRT } from './crt/crt-gl.js';

const ORANGE = 0xd9480f, WHITE = 0xf3f1ec, BODY = 0xe4e1da, BODY_D = 0xcfcbc2, PANEL = 0xd6d2c9, IVORY = 0xe9dfcc, IVORY_D = 0xd8ccb6, DARK = 0x2b2826;
const LIGHT = matchMedia('(pointer:coarse)').matches;   // 指の端末は軽く（影なし）
const V = 0.1;   // ボクセルの一辺
const PW = 320, PH = 240;   // 画面の絵の大きさ（はじめ。ソフトが変えたら合わせる）

// ---------- ボクセル（8ビット互換機と同じ） ----------
const AO = [0.5, 0.68, 0.85, 1];
function voxGeometry(x0, y0, z0, nx, ny, nz, fn) {
  const cell = new Int32Array(nx * ny * nz).fill(-1), at = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = fn(x0 + (i + 0.5) * V, y0 + (j + 0.5) * V, z0 + (k + 0.5) * V, i, j, k);
    if (c != null) cell[at(i, j, k)] = c;
  }
  const solid = (p) => p[0] >= 0 && p[1] >= 0 && p[2] >= 0 && p[0] < nx && p[1] < ny && p[2] < nz && cell[at(p[0], p[1], p[2])] >= 0;
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color(), q = [0, 0, 0];
  const off = (p, a, da, b, db, e, de) => { q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; q[a] += da; if (b >= 0) q[b] += db; if (e >= 0) q[e] += de; return q; };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const hex = cell[at(i, j, k)]; if (hex < 0) continue;
    const p = [i, j, k];
    const h = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453, mura = 0.95 + 0.08 * (h - Math.floor(h));
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      if (solid(off(p, a, s, -1, 0, -1, 0))) continue;
      const u = (a + 1) % 3, v = (a + 2) % 3, plane = p[a] + (s > 0 ? 1 : 0), base = pos.length / 3, ao = [];
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const [du, dv] of corners) {
        const s1 = solid(off(p, a, s, u, du ? 1 : -1, -1, 0)), s2 = solid(off(p, a, s, v, dv ? 1 : -1, -1, 0)), cc = solid(off(p, a, s, u, du ? 1 : -1, v, dv ? 1 : -1));
        const o = s1 && s2 ? 0 : 3 - s1 - s2 - cc; ao.push(o);
        const w = [0, 0, 0]; w[a] = plane; w[u] = p[u] + du; w[v] = p[v] + dv;
        pos.push(x0 + w[0] * V, y0 + w[1] * V, z0 + w[2] * V);
        const nn = [0, 0, 0]; nn[a] = s; nor.push(...nn);
        c.setHex(hex).multiplyScalar(mura * AO[o]); col.push(c.r, c.g, c.b);
      }
      if (ao[0] + ao[2] >= ao[1] + ao[3]) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
const voxMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, ...o });
function vox(x0, y0, z0, nx, ny, nz, fn, m = voxMat()) {
  const o = new THREE.Mesh(voxGeometry(x0, y0, z0, nx, ny, nz, fn), m); o.castShadow = o.receiveShadow = true; return o;
}
function rr(x, y, hw, hh, r) {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax >= hw || ay >= hh) return false;
  const dx = ax - (hw - r), dy = ay - (hh - r);
  return dx <= 0 || dy <= 0 || dx * dx + dy * dy < r * r;
}
const inR = (x, a, b) => x > a && x < b;

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
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc8d8ff, 0.6); rim.position.set(5, 5, -6); scene.add(rim);
  const glow = new THREE.SpotLight(0x9fb6ff, 0, 6, 0.8, 0.9, 2); glow.position.set(-1.35, 2.1, 1.3); glow.target.position.set(-1.35, 0, 3.5); scene.add(glow, glow.target);

  function dotTex(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = paint(x, y), o = (y * w + x) * 4; im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255; }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter; t.anisotropy = 8; return t;
  }
  const rnd = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
  function pixText(text, w, h, color, font, x = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, x, h / 2 + 0.5);
    const im = g.getImageData(0, 0, w, h); for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] > 110 ? 255 : 0;
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
  }
  const decal = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.6 }));

  // ---------- 机と壁（8ビット互換機と同じ） ----------
  {
    const t = dotTex(128, 128, (x, y) => {
      const plank = y >> 4, ry = y & 15, sh = 0.88 + 0.16 * rnd(plank, 0, 1);
      const streak = rnd(Math.floor(x / (6 + plank % 4)), y, 2) < 0.18 ? 0.9 : 1;
      const seam = ry === 15 ? 0.62 : ry === 0 ? 1.06 : 1;
      const butt = ((x + plank * 37) % 128) === 0 ? 0.7 : 1;
      const k = sh * streak * seam * butt * (0.95 + 0.08 * rnd(x, y, 3));
      return [141 * k, 104 * k, 68 * k];
    });
    t.repeat.set(90 / 12.8, 50 / 12.8);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ map: t, roughness: 0.72 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);
    const wt = dotTex(64, 64, (x, y) => { const k = 0.93 + 0.1 * rnd(x, y, 5); return [90 * k, 76 * k, 63 * k]; });
    wt.repeat.set(90 / 6.4, 24 / 6.4);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 24), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 }));
    wall.position.set(0, 12, -5); scene.add(wall);
  }

  // ---------- ブラウン管（8ビット互換機と同じ形） ----------
  const tv = new THREE.Group(); tv.position.set(-1.35, 0, 0); scene.add(tv);
  const SY = 2.3;
  tv.add(vox(-2.2, 0, -1.9, 44, 42, 32, (x, y, z, i, j, k) => {
    if (y < 0.3) return rr(x, z - 0.1, 1.5, 1.1, 0.2) ? IVORY_D : null;
    const sy = y - SY;
    if (z > 1.1) {
      if (rr(x, sy, 1.8, 1.4, 0.3) && !rr(x, sy, 1.6, 1.2, 0.2)) return DARK;
      if (inR(y, 0.5, 0.7) && (inR(x, 0.9, 1.1) || inR(x, 1.3, 1.5))) return (j === 6 && (i === 31 || i === 35)) ? 0x9a8e7c : IVORY_D;
      return null;
    }
    if (z > 0.5) {
      const front = z > 1.0;
      if (!(front ? rr(x, y - 2.2, 2.1, 1.8, 0.25) : rr(x, y - 2.2, 2.2, 1.9, 0.35))) return null;
      if (rr(x, sy, 1.6, 1.2, 0.2)) return z > 0.9 ? null : 0x0a0908;
      if (rr(x, sy, 1.8, 1.4, 0.3) && z > 0.9) return DARK;
      if (inR(x, -0.4, 0.5) && inR(y, 0.4, 0.8)) { if ((i + j) % 2 === 0) return front ? null : 0x3c3228; }
      return IVORY;
    }
    const zl = z + 0.55, t = (1.25 - zl) / 2.5, s = 1 - 0.42 * t, cy = 2.205 + (1 - s) * 0.25, hh = 1.575 * s;
    if (!rr(x, y - cy, 1.95 * s, hh, 0.42 * s)) return null;
    if (y > cy + hh - 0.2 && Math.abs(x) < 0.9 && inR(z, -1.5, 0.1) && k % 2 === 0) return 0x8c8273;
    return IVORY_D;
  }));
  // 画面（横 320 の絵を 2.5 倍。4:3 なので画素はたて横同じ）
  const crtCanvas = document.createElement('canvas'); crtCanvas.width = 800; crtCanvas.height = 600;
  const screenTex = new THREE.CanvasTexture(crtCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
  let glass;
  {
    const W = 3.2, H = 2.4, g = new THREE.PlaneGeometry(W, H, 32, 24), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (W / 2), y = p.getY(i) / (H / 2); p.setZ(i, 0.1 * (1 - x * x) * (1 - y * y)); }
    g.computeVertexNormals();
    glass = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.14 }));
    glass.position.set(0, SY, 0.92); tv.add(glass);
  }
  let tvLed;
  {
    const name = decal(pixText('ASOBI-LAB', 64, 12, '#7a8b80', '700 10px "Hiragino Sans","Yu Gothic UI",sans-serif'), 1.28, 0.24);
    name.position.set(-1.3, 0.6, 1.101); tv.add(name);
    tvLed = new THREE.Mesh(new THREE.BoxGeometry(V, V, V), new THREE.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0xff3a2a, emissiveIntensity: 0 })); tvLed.position.set(1.75, 0.6, 1.11); tv.add(tvLed);
  }

  // ---------- 本体（32ビット） ----------
  // 幅 2.6・奥 2.2・高さ 0.7。前の面の口は 幅 1.4・高さ 0.1（y 0.4〜0.5）、奥へ 1.6
  const con = new THREE.Group(); con.position.set(2.35, 0, 0.75); scene.add(con);
  const FRONT = 1.1, SLOT_Y = 0.45;
  con.add(vox(-1.3, 0, -1.1, 26, 7, 23, (x, y, z, i, j, k) => {
    if (y < 0.1) return inR(Math.abs(x), 0.9, 1.1) && inR(Math.abs(z), 0.7, 0.9) ? 0x2a2522 : null;   // 足
    if (z > FRONT) {   // 前に出るボタン（電源・取り出し）
      if (inR(y, 0.3, 0.4) && inR(x, 0.85, 1.15)) return WHITE;
      if (inR(y, 0.3, 0.4) && inR(x, 0.45, 0.75)) return ORANGE;
      return null;
    }
    if (!rr(x, z, 1.3, 1.1, 0.22)) return null;
    if (inR(y, 0.4, 0.5) && Math.abs(x) < 0.72 && z > -0.6) return null;                 // ディスクの口（奥へ）
    if (z > 0.95 && inR(y, 0.3, 0.6) && Math.abs(x) < 0.82) return 0x2a2826;              // 口のふち（暗い）
    if (z > 0.95 && inR(y, 0.1, 0.2)) return ORANGE;                                       // 前の下の帯（あそびラボのだいだい）
    if (y > 0.6) {   // 上の面: 少し沈んだ板と、2 本のみぞ
      if (Math.abs(x) < 1.05 && inR(z, -0.85, 0.75)) return (Math.abs(z + 0.05) < 0.06) ? BODY_D : PANEL;
      return BODY;
    }
    return y < 0.2 ? BODY_D : BODY;
  }));
  let conLed;
  {
    const nm = decal(pixText('ASOBI-LAB 32', 72, 12, '#7a7468', '700 10px "Hiragino Sans","Yu Gothic UI",sans-serif'), 1.15, 0.19);
    nm.position.set(-0.85, 0.29, FRONT + 0.001); con.add(nm);
    conLed = new THREE.Mesh(new THREE.BoxGeometry(V * 0.8, V * 0.8, V * 0.8), new THREE.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0xff3a2a, emissiveIntensity: 0 })); conLed.position.set(1.0, 0.52, FRONT + 0.02); con.add(conLed);
  }
  // ディスク（半径 0.6・厚さ 0.02。表がラベル、裏は虹色の銀）。口の前（OUT）から奥（IN）へ水平にすべる
  const OUT = new THREE.Vector3(0, SLOT_Y, FRONT + 0.85), IN = new THREE.Vector3(0, SLOT_Y, -0.45);
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 256; labelCanvas.height = 256;
  const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 64), [
    new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.8, roughness: 0.25 }),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.5, metalness: 0.15 }),
    new THREE.MeshPhysicalMaterial({ color: 0xcfd6dc, metalness: 0.95, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.6 }),
  ]);
  disc.castShadow = true; disc.visible = false; disc.position.copy(OUT); con.add(disc);

  // ---------- コントローラーと線 ----------
  const pad = new THREE.Group(); pad.position.set(0.5, 0, 2.8); pad.rotation.y = 0.12; scene.add(pad);
  {
    const ell = (x, z, a, b) => (x * x) / (a * a) + (z * z) / (b * b) < 1;
    pad.add(vox(-0.9, 0, -0.45, 18, 3, 9, (x, y, z) => {
      const body = ell(x, z, 0.88, 0.32) || ell(x + 0.55, z - 0.12, 0.3, 0.32) || ell(x - 0.55, z - 0.12, 0.3, 0.32);   // 楕円の板と左右のにぎり
      if (y < 0.1) return body ? WHITE : null;
      if (y < 0.2) {
        if (!body) return null;
        if (z < -0.28 && (inR(x, -0.75, -0.45) || inR(x, 0.45, 0.75))) return ORANGE;   // L・R（上のふち）
        if (Math.abs(z + 0.05) < 0.01 && (Math.abs(x + 0.1) < 0.01 || Math.abs(x - 0.1) < 0.01)) return 0x8b847a;   // SELECT・START
        return WHITE;
      }
      const dp = (Math.abs(x + 0.5) < 0.01 && Math.abs(z) < 0.11) || (Math.abs(z) < 0.01 && Math.abs(x + 0.5) < 0.11);
      if (dp) return 0x3a3734;
      if (Math.abs(x - 0.5) < 0.01 && Math.abs(z + 0.1) < 0.01) return 0x46b86a;   // Y
      if (Math.abs(x - 0.4) < 0.01 && Math.abs(z) < 0.01) return 0x4a7ad8;         // X
      if (Math.abs(x - 0.6) < 0.01 && Math.abs(z) < 0.01) return 0xd8483c;         // A
      if (Math.abs(x - 0.5) < 0.01 && Math.abs(z - 0.1) < 0.01) return 0xe0b030;   // B
      return null;
    }));
    // 線: コントローラーの背面のまん中から、テレビと本体のあいだを通って、本体のうしろの口へ（8ビット互換機と同じ考え方）
    const pts = [new THREE.Vector3(0.5, 0.1, 2.4), new THREE.Vector3(0.42, 0.04, 2.15), new THREE.Vector3(0.1, 0.03, 1.95), new THREE.Vector3(0.2, 0.03, 1.6), new THREE.Vector3(0.7, 0.03, 1.72), new THREE.Vector3(0.95, 0.03, 1.35), new THREE.Vector3(0.85, 0.03, 0.7), new THREE.Vector3(0.95, 0.03, 0.0), new THREE.Vector3(0.9, 0.03, -0.55), new THREE.Vector3(1.25, 0.03, -0.75), new THREE.Vector3(1.55, 0.06, -0.55), new THREE.Vector3(1.55, 0.3, -0.38)];
    const curve = new THREE.CatmullRomCurve3(pts), H = V / 2, seen = new Set(), cells = [];
    for (let i = 0; i <= 800; i++) {
      const p = curve.getPoint(i / 800), a = Math.floor(p.x / H), b = Math.max(0, Math.floor(p.y / H)), c = Math.floor(p.z / H), id = a + ',' + b + ',' + c;
      if (!seen.has(id)) { seen.add(id); cells.push([a, b, c]); }
    }
    const cord = new THREE.InstancedMesh(new THREE.BoxGeometry(H, H, H), new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.75 }), cells.length);
    const m = new THREE.Matrix4();
    cells.forEach(([a, b, c], i) => cord.setMatrixAt(i, m.makeTranslation((a + 0.5) * H, (b + 0.5) * H, (c + 0.5) * H)));
    cord.castShadow = true; scene.add(cord);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.7 }));
    plug.position.set(1.55, 0.35, -0.38); plug.castShadow = true; scene.add(plug);
  }

  // ---------- ブラウン管の絵（RGB。遊ぶ画面と同じ計算） ----------
  let crt = null, worker = null, wbusy = false, crtFrames = 0, glowTick = 0, pw = PW, ph = PH;
  try { crt = createCRT(crtCanvas); crt.setPicture({ w: PW, h: PH, data: new Uint8Array(PW * PH * 4) }); } catch { crt = null; }
  const flat = document.createElement('canvas'); flat.width = PW; flat.height = PH; const fg = flat.getContext('2d');
  if (crt) {
    try {
      worker = new Worker(new URL('./crt/worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        wbusy = false;
        if (sentGen !== gen) { if (queued) post(); else settle(); return; }
        crt.setSignal(e.data.sig, e.data.sigW, ph, pw, ph, e.data.glow || false);
        crt.draw({ view: [0, 0, crtCanvas.width / pw], split: -1, scan: 1, inter: 0, mask: 1, triads: 1.5, gamma: 2.4, bloom: 0.12, curve: 1, par: (crtCanvas.width / pw) / (crtCanvas.height / ph), rowH: 1, dotW: pw / 256, noise: 0, seed: (crtFrames++ % 97) * 0.37 });
        screenTex.needsUpdate = true; lightUp(); kick(2);
        if (queued) post(); else settle();
      };
    } catch { worker = null; }
  }
  if (!crt || !worker) { screenTex.image = flat; screenTex.magFilter = THREE.NearestFilter; }
  let wantOn = false, gen = 0, sentGen = 0, queued = null, waiters = [];
  function lightUp() { if (wantOn) { glass.material.emissiveIntensity = 1.3; glow.intensity = 6; } }
  function settle() { const w = waiters; waiters = []; for (const f of w) f(); }
  function post() {
    const { data, w, h } = queued; queued = null;
    if (w !== pw || h !== ph) { pw = w; ph = h; crt.setPicture({ w, h, data: new Uint8Array(w * h * 4) }); glowTick = 0; }
    const copy = new Uint8ClampedArray(data.buffer.slice(0));
    wbusy = true; sentGen = gen;
    worker.postMessage({ data: copy, w, h, link: 'rgb', glow: (glowTick++ & 3) === 0 }, [copy.buffer]);
  }
  // 映す（frame: { data: RGBA の Uint8ClampedArray, w, h }）。映りおわったら resolve
  function show(frame) {
    const done = new Promise((ok) => waiters.push(ok));
    if (!crt || !worker) {
      if (flat.width !== frame.w || flat.height !== frame.h) { flat.width = frame.w; flat.height = frame.h; }
      fg.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.w, frame.h), 0, 0);
      screenTex.needsUpdate = true; lightUp(); kick(2); settle(); return done;
    }
    queued = frame;
    if (!wbusy) post();
    return done;
  }

  // ---------- 見る向き・描く ----------
  const SHELF = { az: -0.3, el: 0.26, d: 9.4, hw: 4.3, hv: 2.6, t: new THREE.Vector3(0.35, 1.75, 1.2) };
  const TVV = { az: 0, el: 0.06, d: 7.4, hw: 2.4, t: new THREE.Vector3(-1.35, 2.05, 1.2) };
  let view = SHELF, tween = null, frames = 0, running = false, host = null, mode = 'shelf';
  const fitDist = (v) => { const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect); return Math.max(v.d, v.hw / Math.tan(hf) * 1.04, (v.hv || 0) / Math.tan(vf)); };
  const posOf = (v) => { const d = fitDist(v); return new THREE.Vector3(v.t.x + d * Math.sin(v.az) * Math.cos(v.el), v.t.y + d * Math.sin(v.el), v.t.z + d * Math.cos(v.az) * Math.cos(v.el)); };
  function goView(v, ms = 900) {
    view = v;
    if (!ms) { camera.position.copy(posOf(v)); controls.target.copy(v.t); controls.update(); kick(2); return Promise.resolve(); }
    return new Promise((ok) => { tween = { p0: camera.position.clone(), p1: posOf(v), t0: controls.target.clone(), t1: v.t.clone(), s: performance.now(), ms, ok }; kick(); });
  }
  controls.addEventListener('start', () => { if (tween) { const ok = tween.ok; tween = null; ok(); } kick(); });
  controls.addEventListener('change', () => kick(2));
  canvas.addEventListener('dblclick', () => goView(view));
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(e) {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let o = ray.intersectObjects([tv, con], true)[0]?.object;
    while (o && o !== tv && o !== con) o = o.parent;
    return o === tv ? 'tv' : o === con ? 'con' : null;
  }
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    const d = downAt; downAt = null;
    if (!d || !controls.enabled || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const w = pickAt(e); if (w && api.canPick?.(w)) api.onPick?.(w);
  });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons || !controls.enabled) return; const w = pickAt(e); canvas.style.cursor = w && api.canPick?.(w) ? 'pointer' : ''; });
  function kick(n = 0) { frames = Math.max(frames, n); if (!running) { running = true; requestAnimationFrame(loop); } }
  let anims = [];
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

  // ディスクのラベル: 色の地に、タイトル画面の絵をまるく切って、まん中に穴（銀）
  function paintLabel(src, color, title) {
    const g = labelCanvas.getContext('2d'), c = 128;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = color || '#3a4a6a'; g.beginPath(); g.arc(c, c, 128, 0, Math.PI * 2); g.fill();
    if (src) { g.save(); g.beginPath(); g.arc(c, c, 112, 0, Math.PI * 2); g.clip(); g.imageSmoothingEnabled = false; g.drawImage(src, c - 150, c - 112, 300, 225); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(28, 182, 200, 30);
    g.fillStyle = '#fff'; g.font = '700 18px "Hiragino Sans","Yu Gothic UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title || '', c, 197, 190);
    g.fillStyle = '#d8dde2'; g.beginPath(); g.arc(c, c, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9aa2aa'; g.beginPath(); g.arc(c, c, 12, 0, Math.PI * 2); g.fill();
    labelTex.needsUpdate = true;
  }
  function anim(ms, step) { return new Promise((ok) => { anims.push({ s: performance.now(), ms, step, ok }); kick(); }); }

  goView(SHELF, 0);
  const api = {
    canvas,
    attach(el, m) {
      host = el; el.append(canvas); ro.disconnect(); ro.observe(el);
      mode = m;
      controls.enabled = m !== 'play';
      view = m === 'play' ? TVV : SHELF;
      resize(); camera.position.copy(posOf(view)); controls.target.copy(view.t); controls.update(); kick(2);
    },
    // 口の前のディスク（画面の座標）: 棚のディスクをここまで飛ばしてから、3D のディスクに入れかえる
    slotRect() {
      const r = canvas.getBoundingClientRect(), p = OUT.clone(), q = OUT.clone().add(new THREE.Vector3(0.6, 0, 0));
      for (const v of [p, q]) con.localToWorld(v).project(camera);
      const sx = (v) => r.left + (v.x + 1) / 2 * r.width, sy = (v) => r.top + (1 - v.y) / 2 * r.height;
      return { cx: sx(p), cy: sy(p), r: Math.abs(sx(q) - sx(p)) };
    },
    // 入れる: 口の前から奥へすべりこむ（ゆっくり → すっと）
    insertDisc({ color, label, title }) {
      paintLabel(label, color, title);
      disc.visible = true; disc.position.copy(OUT); disc.rotation.y = 0;
      return anim(700, (k) => { const e = k < 0.5 ? 0.25 * (k / 0.5) : 0.25 + 0.75 * ease3((k - 0.5) / 0.5); disc.position.lerpVectors(OUT, IN, e); disc.rotation.y = -e * 3; })
        .then(() => { disc.visible = false; kick(2); });
    },
    // 出す: 奥から口の前へ（そのあと棚のディスクに入れかえる）
    ejectDisc() {
      disc.visible = true;
      return anim(520, (k) => { disc.position.lerpVectors(IN, OUT, ease3(k)); disc.rotation.y = -(1 - k) * 3; }).then(() => { disc.visible = false; kick(2); });
    },
    seatDisc({ color, label, title }) { paintLabel(label, color, title); disc.visible = false; kick(2); },
    removeDisc() { disc.visible = false; kick(2); },
    setPower(on) {
      for (const l of [conLed, tvLed]) l.material.emissiveIntensity = on ? 2.4 : 0;
      wantOn = on; if (!on) { gen++; queued = null; settle(); glass.material.emissiveIntensity = 0; glow.intensity = 0; } kick(2);
    },
    show,
    focusTV(on, ms = 900) { return goView(on ? TVV : SHELF, ms); },
    screenRect() {
      const r = canvas.getBoundingClientRect(); camera.updateMatrixWorld(); tv.updateMatrixWorld();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of [[-1.6, SY - 1.2], [1.6, SY - 1.2], [-1.6, SY + 1.2], [1.6, SY + 1.2]]) {
        const v = tv.localToWorld(new THREE.Vector3(x, y, 0.95)).project(camera);
        const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    },
    renderNow() { controls.update(); renderer.render(scene, camera); },
    resize,
    onPick: null, canPick: null,
    // 確かめ用: ディスクを口の前に出して見る
    peekDisc() { disc.visible = true; disc.position.copy(OUT); kick(2); },
  };
  return api;
}
