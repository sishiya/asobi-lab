// 部屋（v021。2026-10-25 ユーザーと決めた案A＋C）: 机の上のブラウン管と本体とコントローラー。Three.js（ほかのゲームと同じ 0.160.0、index.html の importmap）。
// 見くらべ look/look9.html を部品にしたもの。トップの上半分（案A）と、遊ぶ画面の「部屋で遊ぶ」（案C）の両方で1つを使い回す（attach で入れ物を移す）。
// - v022: ポリゴン感が強かったので、ブラウン管・本体・カセット・コントローラー・線をボクセル（一辺 0.1 の立方体）に（ユーザー）。
//   見える面だけを1つの形にまとめ、すみの暗がり（頂点の AO）と、立方体ごとの色のむらをつける。机と壁も 0.1 のドットの模様。字はドットの字。
// - 本体は 80年代ふうを細くした形。色はあそびラボのアイコン（だいだいと白）。カセットは上から立てて入れ、上が少し出る
// - コントローラーはアイコンの白い丸いパッド（十字とボタンはだいだい）。線で本体につなぐ
// - ブラウン管はうしろがすぼまった箱。画面は遊ぶ画面と同じブラウン管（RGB。v024 まではビデオ端子）の絵を、少しふくらんだガラスに貼る
// - 実在の機械の目印（赤と白・金色・取り出しレバー・本体につながったままのコントローラーの置き場）は使わない
// 描くのは動いているときだけ（止まっているあいだは描かない。タブを離れたら止める）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCRT } from './crt/crt-gl.js';

const ORANGE = 0xd9480f, ORANGE_D = 0xb83c0c, WHITE = 0xf6f1e8, IVORY = 0xe9dfcc, IVORY_D = 0xd8ccb6, DARK = 0x2b2826;
const LIGHT = matchMedia('(pointer:coarse)').matches;   // 指の端末は軽く（影なし）
const V = 0.1;   // ボクセルの一辺

// ---------- ボクセル ----------
// fn(x, y, z, i, j, k) は立方体のまん中の座標から色（なし＝null）を返す。グリッドのかど (x0,y0,z0) から nx×ny×nz 個。
// 見える面だけを作り、面の4すみに AO（となりがふさがっているほど暗い）、立方体ごとに色のむら（汚し）。
const AO = [0.5, 0.68, 0.85, 1];
function voxGeometry(x0, y0, z0, nx, ny, nz, fn) {
  const cell = new Int32Array(nx * ny * nz).fill(-1), at = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = fn(x0 + (i + 0.5) * V, y0 + (j + 0.5) * V, z0 + (k + 0.5) * V, i, j, k);
    if (c != null) cell[at(i, j, k)] = c;
  }
  const n = [nx, ny, nz];
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
// かどの丸い四角（ボクセルでは段々になる）
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

  // ---------- 小物の道具 ----------
  // ドットの模様（1ドット＝ボクセル1つ分に見えるよう repeat を決める。ぼかさない）
  function dotTex(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = paint(x, y), o = (y * w + x) * 4; im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255; }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter; t.anisotropy = 8; return t;
  }
  const rnd = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
  // ドットの字: 小さく書いて、半分より濃いところだけ残す（なめらかにしない）
  function pixText(text, w, h, color, font, x = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, x, h / 2 + 0.5);
    const im = g.getImageData(0, 0, w, h); for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] > 110 ? 255 : 0;
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
  }
  const decal = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.6 }));

  // ---------- 机と壁（0.1 のドット） ----------
  {
    // 板は 16 ドット（1.6）の幅で横に流れる。板ごとに色が少しちがい、すきまは暗い
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

  // ---------- ブラウン管 ----------
  // 前の箱（幅 4.4・y 0.3〜4.1・z 0.5〜1.1）・まわりがすぼまったうしろ・台。画面の穴は 3.2×2.4（4:3）、枠は 1 つ手前に出る
  const tv = new THREE.Group(); tv.position.set(-1.35, 0, 0); scene.add(tv);
  const SY = 2.3;   // 画面のまん中の高さ
  tv.add(vox(-2.2, 0, -1.9, 44, 42, 32, (x, y, z, i, j, k) => {
    if (y < 0.3) return rr(x, z - 0.1, 1.5, 1.1, 0.2) ? IVORY_D : null;   // 台
    const sy = y - SY;
    if (z > 1.1) {   // 手前に出る枠とつまみ
      if (rr(x, sy, 1.8, 1.4, 0.3) && !rr(x, sy, 1.6, 1.2, 0.2)) return DARK;
      if (inR(y, 0.5, 0.7) && (inR(x, 0.9, 1.1) || inR(x, 1.3, 1.5))) return (j === 6 && (i === 31 || i === 35)) ? 0x9a8e7c : IVORY_D;
      return null;
    }
    if (z > 0.5) {   // 前の箱
      const front = z > 1.0;
      if (!(front ? rr(x, y - 2.2, 2.1, 1.8, 0.25) : rr(x, y - 2.2, 2.2, 1.9, 0.35))) return null;   // 上のふちも左右と同じ 3 つ（v023）
      if (rr(x, sy, 1.6, 1.2, 0.2)) return z > 0.9 ? null : 0x0a0908;   // 画面の穴（奥は黒）
      if (rr(x, sy, 1.8, 1.4, 0.3) && z > 0.9) return DARK;
      if (inR(x, -0.4, 0.5) && inR(y, 0.4, 0.8)) { if ((i + j) % 2 === 0) return front ? null : 0x3c3228; }   // スピーカーの穴
      return IVORY;
    }
    // うしろ: 奥へいくほど小さく、少し上へ
    const zl = z + 0.55, t = (1.25 - zl) / 2.5, s = 1 - 0.42 * t, cy = 2.205 + (1 - s) * 0.25, hh = 1.575 * s;
    if (!rr(x, y - cy, 1.95 * s, hh, 0.42 * s)) return null;
    if (y > cy + hh - 0.2 && Math.abs(x) < 0.9 && inR(z, -1.5, 0.1) && k % 2 === 0) return 0x8c8273;   // 上の通気のみぞ
    return IVORY_D;
  }));
  // 画面（ほんの少しふくらむ。穴のふちは枠のうしろにかくれる）
  const crtCanvas = document.createElement('canvas'); crtCanvas.width = 731; crtCanvas.height = 600;   // 256×8/7×2.5・240×2.5（テレビの横長の画素）
  const screenTex = new THREE.CanvasTexture(crtCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;   // 小さく映るときにブラウン管の網目がしまにならないよう、ミップマップあり
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

  // ---------- 本体 ----------
  // 幅 2.2・奥 2.4。だいだいの箱（y 0.1〜1.0）の上に白い板（〜1.1）。口は 1.4×0.3、深さ 0.9
  const con = new THREE.Group(); con.position.set(2.25, 0, 0.75); scene.add(con);
  const TOP = 1.1, slotZ = -0.45;
  const inSlot = (x, z) => Math.abs(x) < 0.7 && inR(z, -0.6, -0.3), nearSlot = (x, z) => Math.abs(x) < 0.8 && inR(z, -0.7, -0.2);
  con.add(vox(-1.1, 0, -1.2, 22, 11, 25, (x, y, z, i, j, k) => {
    if (y < 0.1) return inR(Math.abs(x), 0.7, 0.9) && inR(Math.abs(z), 0.8, 1.0) ? 0x2a2522 : null;   // 足
    if (z > 1.2) {   // 前に出るボタン
      return inR(y, 0.6, 0.7) && inR(x, 0.4, 0.8) ? WHITE : null;   // 電源ボタン（1つ。v023）
    }
    if (y > 1.0) {   // 上の白い板と口のふち
      if (!(Math.abs(x) < 0.9 && inR(z, -1.0, 0.6))) return null;
      return inSlot(x, z) ? null : nearSlot(x, z) ? 0xeae3d6 : WHITE;
    }
    if (!(y > 0.9 ? rr(x, z, 1.0, 1.1, 0.2) : rr(x, z, 1.1, 1.2, 0.25))) return null;
    if (y > 0.2) { if (inSlot(x, z)) return null; if (nearSlot(x, z)) return 0x141210; }   // 口の中は暗い
    if (inR(y, 0.3, 0.4) && inR(x, -0.9, -0.6) && z > 1.0) return z > 1.1 ? null : 0x1d1a18;   // 前のコントローラーの口（1つ。v023）
    if (y > 0.9 && inR(z, 0.7, 1.0) && Math.abs(x) < 0.8 && k % 2 === 0) return 0xd8d0c2;   // 前の上のみぞ
    return y < 0.2 ? ORANGE_D : ORANGE;
  }));
  let conLed;
  {
    const fz = 1.201;
    const nm = decal(pixText('ASOBI-LAB 8', 62, 12, '#ffffff', '700 10px "Hiragino Sans","Yu Gothic UI",sans-serif'), 0.99, 0.19);
    nm.position.set(-0.45, 0.6, fz); con.add(nm);
    conLed = new THREE.Mesh(new THREE.BoxGeometry(V * 0.8, V * 0.8, V * 0.8), new THREE.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0xff3a2a, emissiveIntensity: 0 })); conLed.position.set(0.95, 0.65, fz + 0.02); con.add(conLed);
  }
  // カセット（幅 1.2・高さ 1.5（下の 0.1 は差しこみ口）・厚さ 0.2。棚のカセット 160×208 とほぼ同じ形。入ると上 0.7 が見える）
  // 色は材質の色（白いボクセルにかける）で変える
  const CART_H = 1.5, OUT = 0.7, REST = TOP - (CART_H - OUT), ABOVE = TOP + 0.35;
  const cart = new THREE.Group(); cart.position.set(0, REST, slotZ); cart.visible = false; con.add(cart);
  const cartMat = voxMat({ color: 0x3f4f86, roughness: 0.45 });
  // かどは欠かない（棚の 2D のカセットと同じ形に。v024）。v025: 上をもう1列けずり、下に差しこみ口の1列（2D と同じく、まん中がへこんで金色の端子）
  cart.add(vox(-0.6, 0, -0.1, 12, 15, 2, (x, y, z, i, j, k) => (j === 0 && i >= 2 && i <= 9 ? (k === 1 ? null : 0x707070) : 0xffffff), cartMat));
  {
    const pc = document.createElement('canvas'); pc.width = 36; pc.height = 2; const pg = pc.getContext('2d');
    for (let x = 0; x < 36; x += 2) { pg.fillStyle = '#d9b44a'; pg.fillRect(x, 0, 1, 2); }
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; pt.magFilter = pt.minFilter = THREE.NearestFilter; pt.generateMipmaps = false;
    const pins = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.06), new THREE.MeshStandardMaterial({ map: pt, transparent: true, alphaTest: 0.5, roughness: 0.35, metalness: 0.6 }));
    pins.position.set(0, 0.03, 0.001); cart.add(pins);
  }
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 256; labelCanvas.height = 274;   // 棚のカセットのラベル（272×292）に近い形
  const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.07), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55 })); label.position.set(0, CART_H - 0.15 - 0.535, 0.101); cart.add(label);   // 上 0.15・下 0.28（棚のカセットと同じ割合）

  // ---------- コントローラーと線 ----------
  const pad = new THREE.Group(); pad.position.set(0.4, 0, 2.8); pad.rotation.y = 0.15; scene.add(pad);
  {
    const cap = (x, z, l, r) => { const dx = Math.max(Math.abs(x) - l, 0); return dx * dx + z * z < r * r; };
    pad.add(vox(-0.8, 0, -0.35, 16, 3, 7, (x, y, z) => {
      if (y < 0.1) return cap(x, z, 0.45, 0.35) ? WHITE : null;
      if (y < 0.2) {
        if (!cap(x, z, 0.45, 0.27)) return null;
        return Math.abs(z - 0.1) < 0.01 && (Math.abs(x + 0.05) < 0.01 || Math.abs(x - 0.15) < 0.01) ? 0x8b847a : WHITE;   // SELECT・START
      }
      const dp = (Math.abs(x + 0.45) < 0.01 && Math.abs(z) < 0.11) || (Math.abs(z) < 0.01 && Math.abs(x + 0.45) < 0.11);   // 十字
      const bt = (Math.abs(x - 0.35) < 0.01 && Math.abs(z - 0.1) < 0.01) || (Math.abs(x - 0.55) < 0.01 && Math.abs(z + 0.1) < 0.01);
      return dp || bt ? ORANGE : null;
    }));
    // 線: 曲線をなぞって、半分の大きさ（0.05）の立方体をならべる
    // 線は長めにたるませて、本体の前の口へ（v023。ユーザー「もっと長いほうがいい。届かなそう」）
    // コントローラーの背面のまん中からまっすぐ出して（v024）、奥でまわって前の口へ
    const pts = [new THREE.Vector3(0.35, 0.1, 2.44), new THREE.Vector3(0.31, 0.04, 2.2), new THREE.Vector3(0.42, 0.03, 1.88), new THREE.Vector3(0.95, 0.03, 1.98), new THREE.Vector3(1.3, 0.03, 2.22), new THREE.Vector3(1.5, 0.06, 2.12), new THREE.Vector3(1.5, 0.3, 1.99)];
    const curve = new THREE.CatmullRomCurve3(pts), H = V / 2, seen = new Set(), cells = [];
    for (let i = 0; i <= 400; i++) {
      const p = curve.getPoint(i / 400), a = Math.floor(p.x / H), b = Math.max(0, Math.floor(p.y / H)), c = Math.floor(p.z / H), id = a + ',' + b + ',' + c;
      if (!seen.has(id)) { seen.add(id); cells.push([a, b, c]); }
    }
    const cord = new THREE.InstancedMesh(new THREE.BoxGeometry(H, H, H), new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.75 }), cells.length);
    const m = new THREE.Matrix4();
    cells.forEach(([a, b, c], i) => cord.setMatrixAt(i, m.makeTranslation((a + 0.5) * H, (b + 0.5) * H, (c + 0.5) * H)));
    cord.castShadow = true; scene.add(cord);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.7 }));
    plug.position.set(1.5, 0.35, 1.98); plug.castShadow = true; scene.add(plug);
  }

  // ---------- ブラウン管の絵（RGB。遊ぶ画面と同じ計算） ----------
  let crt = null, worker = null, wbusy = false, crtFrames = 0, glowTick = 0;
  try { crt = createCRT(crtCanvas); crt.setPicture({ w: 256, h: 240, data: new Uint8Array(256 * 240 * 4) }); } catch { crt = null; }
  const flat = document.createElement('canvas'); flat.width = 256; flat.height = 240; const fg = flat.getContext('2d'), fim = fg.createImageData(256, 240), fpx = new Uint32Array(fim.data.buffer);
  if (crt) {
    try {
      worker = new Worker(new URL('./crt/worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        wbusy = false;
        if (sentGen !== gen) { if (queued) post(); else settle(); return; }   // 電源を切る前の絵は捨てる
        crt.setSignal(e.data.sig, 1024, 240, 256, 240, e.data.glow || false);
        crt.draw({ view: [0, 0, 2.5], split: -1, scan: 1, inter: 0, mask: 1, triads: 1.5, gamma: 2.4, bloom: 0.12, curve: 1, par: 8 / 7, rowH: 1, dotW: 1, noise: 0, seed: (crtFrames++ % 97) * 0.37 });
        screenTex.needsUpdate = true; lightUp(); kick(2);
        if (queued) post(); else settle();
      };
    } catch { worker = null; }
  }
  if (!crt || !worker) { screenTex.image = flat; screenTex.magFilter = THREE.NearestFilter; }
  // 電源を入れても、新しい絵がとどくまで画面は暗いまま（前のソフトの絵が一瞬見えないように）
  // 計算中に来た絵は、いちばん新しい1枚だけ待たせる（止めたときに、最後の絵が映るように）。電源を切ると gen が進み、前の絵は捨てる
  let wantOn = false, gen = 0, sentGen = 0, queued = null, waiters = [];
  function lightUp() { if (wantOn) { glass.material.emissiveIntensity = 1.3; glow.intensity = 6; } }
  function settle() { const w = waiters; waiters = []; for (const f of w) f(); }
  function post() {
    const copy = new Uint8ClampedArray(queued.buffer.slice(0)); queued = null;
    wbusy = true; sentGen = gen;
    worker.postMessage({ data: copy, link: 'rgb', glow: (glowTick++ & 3) === 0 }, [copy.buffer]);
  }
  // 映す。映りおわったら resolve
  function show(frame) {
    const done = new Promise((ok) => waiters.push(ok));
    if (!crt || !worker) { fpx.set(frame); fg.putImageData(fim, 0, 0); screenTex.needsUpdate = true; lightUp(); kick(2); settle(); return done; }
    queued = frame;
    if (!wbusy) post();
    return done;
  }

  // ---------- 見る向き・描く ----------
  // hw・hv: 横・たてに入れたい半分の幅（画面が細い・低いときは、これが入るまで引く）
  const SHELF = { az: -0.3, el: 0.26, d: 9.4, hw: 4.3, hv: 2.6, t: new THREE.Vector3(0.3, 1.75, 1.2) };
  const TVV = { az: 0, el: 0.06, d: 7.4, hw: 2.4, t: new THREE.Vector3(-1.35, 2.05, 1.2) };
  let view = SHELF, tween = null, frames = 0, running = false, host = null;
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
  // テレビ・本体を押す（ドラッグで回したときは押したことにしない）。どうするかは api.onPick、押せるかは api.canPick
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
    g.fillStyle = '#f8f3e8'; g.fillRect(0, 0, 256, 274);
    g.imageSmoothingEnabled = false;
    if (src) g.drawImage(src, 0, 0, src.width, src.height, 10, 10, 236, 221);
    g.fillStyle = '#2a1a10'; g.font = '700 22px "Hiragino Sans","Yu Gothic UI",sans-serif'; g.textBaseline = 'middle';
    g.fillText(title || '', 12, 250, 232);
    labelTex.needsUpdate = true;
  }
  function anim(ms, step) { return new Promise((ok) => { anims.push({ s: performance.now(), ms, step, ok }); kick(); }); }

  goView(SHELF, 0);
  const api = {
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
      wantOn = on; if (!on) { gen++; queued = null; settle(); glass.material.emissiveIntensity = 0; glow.intensity = 0; } kick(2);
    },
    show,
    focusTV(on, ms = 900) { return goView(on ? TVV : SHELF, ms); },
    // テレビの画面の四角（ページの座標）。棚 ⇄ 遊ぶ画面で、この四角から遊ぶ画面の画面へのびる
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
    // 確かめ用: 3D のカセットを口の上の高さ y に出して、正面から見る（2D のカセットと見くらべる）
    peekCart(y = 2.6) { cart.visible = true; cart.position.y = y; goView({ az: 0.5, el: 0.05, d: 4, hw: 1, t: new THREE.Vector3(2.25, y + 0.75, 0.3) }, 0); },
  };
  return api;
}
