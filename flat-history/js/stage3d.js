// 3Dの舞台: ページの束（時空の大地）・主人公・置いた形・置き場所のゴースト・世界線・描きかえの波・追いかけるカメラ
// 3Dの向き: X＝2D世界の横、Y＝高さ、Z＝ -時間（前＝奥＝未来。カメラは主人公のうしろ＝昔の側から見る。ページは表から見える）
import * as THREE from 'three';
import { look, kindColor } from './look/index.js?v=69';
import { radialTexture } from './look/util.js?v=69';
import { S, drawSheet } from './sheet.js?v=69';
import { sectionsAt, DT, pieceDims } from './sim.js?v=69';
import { groundAt } from './hero.js?v=69';

export const GAP = 1.0;
// だめな歴史なら、つまずいた秒（そこから先は刷りそこない）
export const misprintOf = (h) => (h.end.type === 'goal' || h.end.type === 'time' ? (h.nestPass ? h.nestPass.t + 2 : null) : h.end.t + 0.3);
const Z = (t) => -t * GAP;

function textSprite(text, size = 0.9, color = '#5a4430') {
  const cv = document.createElement('canvas');
  // 字の長さに合わせて横を広げる（英語の長い言葉も切れないように）
  const m = document.createElement('canvas').getContext('2d'); m.font = 'italic 34px Georgia, serif';
  const k = Math.max(1, Math.ceil((m.measureText(text).width + 16) / 128));
  cv.width = 128 * k; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'italic 34px Georgia, serif';
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(size * 2 * k, size, 1);
  return sp;
}

// 3Dの形の立体（rot と slope に合わせて、ななめにずらした直方体）
const geoCache = new Map();
// いくつかの形を一つにまとめる（三角形をならべるだけ）
function mergeGeos(list) {
  const pos = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.computeVertexNormals();
  return m;
}
export function pieceGeometry(p) {
  const key = p.kind + ':' + (p.rot ? 1 : 0);
  if (geoCache.has(key)) return geoCache.get(key);
  const d = pieceDims(p);
  // v073: しかけの形
  if (d.comb) { // くし形: 歯ごとの板
    const g = mergeGeos(d.comb.map(([a, b]) => { const bx = new THREE.BoxGeometry(d.wx, d.h, (b - a) * GAP); bx.translate(d.wx / 2, d.h / 2, -(a + b) / 2 * GAP); return bx; }));
    geoCache.set(key, g); return g;
  }
  if (d.spiral) { // らせん: まん中の軸と、まわりを巻く玉の管
    const sp = d.spiral, cx = d.wx / 2, cy = d.h / 2, rad = sp.ball / 2;
    const hub = new THREE.CylinderGeometry(rad, rad, d.dz * GAP, 10); hub.rotateX(Math.PI / 2); hub.translate(cx, cy, -d.dz * GAP / 2);
    const tubes = sp.r.map((rr) => {
      const pts = [];
      for (let k = 0; k <= 48; k++) { const tt = (k / 48) * d.dz, a = -(Math.PI * 2 * sp.turns * tt) / d.dz - Math.PI / 2; pts.push(new THREE.Vector3(cx + rr * Math.cos(a), cy + rr * Math.sin(a), -tt * GAP)); }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, rad, 8, false);
    });
    const g = mergeGeos([hub, ...tubes]); g.userData.edgeAngle = 50;
    geoCache.set(key, g); return g;
  }
  const bw = d.vx ? d.wbase : d.wx;
  const g = new THREE.BoxGeometry(bw, d.h, d.dz * GAP, Math.max(1, Math.round(bw)), 1, Math.max(1, Math.round(d.dz * (d.hump ? 2 : 1))));
  g.translate(bw / 2, d.h / 2, -d.dz * GAP / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const tt = -pos.getZ(i) / GAP;
    if (d.vx) { pos.setX(i, pos.getX(i) + (d.vx > 0 ? d.vx * tt : (d.wx - d.wbase) + d.vx * tt)); continue; } // 平行四辺形
    if (d.dia) { const k = 1 - Math.abs(2 * tt / d.dz - 1); pos.setX(i, d.wx / 2 + (pos.getX(i) - d.wx / 2) * k); continue; } // ひし形
    if (d.hump) { pos.setY(i, pos.getY(i) + d.hump * (1 - Math.abs(2 * tt / d.dz - 1))); continue; } // 「へ」の字
    pos.setY(i, pos.getY(i) + d.slope * (d.along === 'z' ? tt : pos.getX(i)));
  }
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

// 3Dの物体を、Z＝z の面で切った断面（メッシュごとに凸包の多角形）。色はそのメッシュの色
const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function sliceObject(root, z) {
  const out = [];
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.material || o.material.wireframe || !o.material.color) return;
    if (o.material.transparent && !o.userData.slice) return; // すける飾りは断面にしない（ガラスなど、出したいものは userData.slice）
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    const pts = [];
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) _v[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
      for (let k = 0; k < 3; k++) {
        const a = _v[k], b = _v[(k + 1) % 3];
        if ((a.z - z) * (b.z - z) < 0) { const u = (z - a.z) / (b.z - a.z); pts.push([a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u]); }
      }
    }
    if (pts.length < 3) return;
    // 凸包（Andrew の方法）
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
    const lo = [], hi = [];
    for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
    if (hull.length >= 3) out.push({ color: '#' + o.material.color.getHexString(), pts: hull, glass: !!o.material.transparent });
  });
  return out;
}
// 3Dの色を、2D世界の色合いへ: 明るさを紙（明）〜インク（暗）の間に置きかえ、もとの色味を少しだけ残す
const PAPER = [243, 230, 200], INKC = [74, 51, 32];
function toPaper(hex) {
  const c = new THREE.Color(hex);
  const r = c.r * 255, g = c.g * 255, b = c.b * 255;
  const lum = Math.min(1, (0.3 * r + 0.59 * g + 0.11 * b) / 255 * 1.15);
  const base = PAPER.map((p, i) => INKC[i] + (p - INKC[i]) * lum);
  const mix = [r, g, b].map((v, i) => Math.round(base[i] * 0.82 + v * 0.18));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}
function slicePath(g, L, pl) {
  g.beginPath();
  pl.pts.forEach(([x, y], i) => { const px = x * 20, py = (L.H - y) * 20; i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath();
}
// 断面を塗る。hatch なら銅版画のような斜線をのせて、2D世界になじませる
function drawSlices(g, L, polys, hatch) {
  g.save();
  g.lineJoin = 'round';
  for (const pl of polys) {
    slicePath(g, L, pl);
    if (pl.glass) { g.fillStyle = 'rgb(236,228,206)'; g.fill(); g.strokeStyle = '#4a3320'; g.lineWidth = 1; g.stroke(); continue; }
    g.fillStyle = toPaper(pl.color); g.fill();
    if (hatch) {
      g.save(); g.clip();
      g.strokeStyle = 'rgba(42,28,16,.32)'; g.lineWidth = 0.8;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of pl.pts) { x0 = Math.min(x0, x * 20); x1 = Math.max(x1, x * 20); y0 = Math.min(y0, (L.H - y) * 20); y1 = Math.max(y1, (L.H - y) * 20); }
      g.beginPath();
      for (let k = x0 - (y1 - y0); k < x1; k += 3) { g.moveTo(k, y1); g.lineTo(k + (y1 - y0), y0); }
      g.stroke();
      g.restore();
      slicePath(g, L, pl);
    }
    g.strokeStyle = '#4a3320'; g.lineWidth = 1.2; g.stroke();
  }
  g.restore();
}
// 軌跡: 断面のふちを、点線のインクでページに残す
function stampTrail(g, L, polys) {
  g.save();
  g.setLineDash([1.5, 3.5]); g.lineWidth = 0.9; g.strokeStyle = 'rgba(110,80,45,.22)';
  for (const pl of polys) { if (pl.glass) continue; slicePath(g, L, pl); g.stroke(); }
  g.restore();
}

// パレットの絵: 形を斜め上から見た図（半透明の面と、すけて見えるふちの線）。WebGL を使わず 2D で描く
const iconCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const LIGHT = new THREE.Vector3(-0.4, 0.8, 0.5).normalize();
export function drawPieceIcon(cv, kind, rot = 0) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const p = { kind, rot }, d = pieceDims(p), geo = pieceGeometry(p);
  const c = new THREE.Vector3(d.wx / 2, d.h / 2, -d.dz * GAP / 2);
  const yaw = 0.62, pitch = 0.55;
  iconCam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * 50, c.y + Math.sin(pitch) * 50, c.z + Math.cos(yaw) * Math.cos(pitch) * 50);
  iconCam.lookAt(c); iconCam.updateMatrixWorld();
  const inv = iconCam.matrixWorldInverse, pos = geo.attributes.position, idx = geo.index;
  const P = [];
  for (let i = 0; i < pos.count; i++) P.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(inv));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const v of P) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const k = Math.min((W - 10) / (x1 - x0), (H - 10) / (y1 - y0));
  const sx = (v) => W / 2 + (v.x - (x0 + x1) / 2) * k, sy = (v) => H / 2 - (v.y - (y0 + y1) / 2) * k;
  const base = new THREE.Color(kindColor(kind));
  const tris = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const n = idx ? idx.count : pos.count, vi = (i) => (idx ? idx.getX(i) : i);
  for (let i = 0; i < n; i += 3) {
    const a = P[vi(i)], b = P[vi(i + 1)], q = P[vi(i + 2)];
    const nr = e1.subVectors(b, a).cross(e2.subVectors(q, a)).normalize();
    if (nr.z <= 0) continue; // うらの面
    tris.push({ a, b, q, z: (a.z + b.z + q.z) / 3, l: 0.55 + 0.5 * Math.max(0, nr.dot(LIGHT)) });
  }
  tris.sort((u, v) => u.z - v.z);
  for (const t of tris) {
    const col = base.clone().multiplyScalar(t.l);
    g.fillStyle = g.strokeStyle = '#' + col.getHexString();
    g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(sx(t.a), sy(t.a)); g.lineTo(sx(t.b), sy(t.b)); g.lineTo(sx(t.q), sy(t.q)); g.closePath(); g.fill(); g.stroke();
  }
  // ふちの線（うらのふちも、うすく見せる）
  const eg = new THREE.EdgesGeometry(geo, geo.userData.edgeAngle || 1), ep = eg.attributes.position;
  g.strokeStyle = '#' + base.clone().multiplyScalar(0.4).getHexString(); g.lineWidth = 1.2; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < ep.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(ep, i).applyMatrix4(inv), b = new THREE.Vector3().fromBufferAttribute(ep, i + 1).applyMatrix4(inv);
    g.moveTo(sx(a), sy(a)); g.lineTo(sx(b), sy(b));
  }
  g.stroke();
  eg.dispose();
}

export function createStage(canvas, L) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#ddcca8', 30, 90);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight('#fff2d8', '#7a5a3a', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b5', 1.5);
  sun.position.set(-12, 30, 20); scene.add(sun);

  // ---- ページの束 ----
  const planeGeo = new THREE.PlaneGeometry(L.W, L.H);
  // v078: ページの数は図版ごと（L.T）。いちばん多い図版のぶんだけ作っておき、使わないページは出さない
  const TMAX = 60;
  const sheets = [];
  for (let t = 0; t <= TMAX; t++) {
    const cv = document.createElement('canvas');
    cv.width = L.W * S; cv.height = L.H * S;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.set(L.W / 2, L.H / 2, Z(t));
    scene.add(mesh);
    sheets.push({ t, cv, g: cv.getContext('2d'), tex, mat, mesh, pending: false });
  }
  // ---- ページの厚み（v039。v045 で地形だけにもどした）: 真上から見ても地形が見えるよう、地形の上の面と段差に、うすい紙の厚みをつける ----
  // 地形はどのページも同じなので、ひとつの形を61枚ぶん並べる（InstancedMesh）。上の面は明るい紙、段差の面は少し暗い紙
  const THICK = 0.16;
  const slabMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  let slabs = null;
  const _m4 = new THREE.Matrix4();
  function buildSlabs() {
    if (slabs) { scene.remove(slabs); slabs.geometry.dispose(); }
    const v = [], col = [];
    const TOP = new THREE.Color('#f4ead0'), SIDE = new THREE.Color('#c7b289');
    const quad = (a, b, c, d, cc) => { v.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) col.push(cc.r, cc.g, cc.b); };
    const z0 = -THICK / 2, z1 = THICK / 2;
    const topAt = (c) => (c < 0 || c >= L.W || !Number.isFinite(L.tops[c]) ? 0 : L.tops[c]);
    for (let c = 0; c < L.W; c++) {
      const top = L.tops[c];
      if (!Number.isFinite(top)) continue;
      quad([c, top, z1], [c + 1, top, z1], [c + 1, top, z0], [c, top, z0], TOP);
      const lt = topAt(c - 1), rt = topAt(c + 1);
      if (lt < top) quad([c, lt, z0], [c, lt, z1], [c, top, z1], [c, top, z0], SIDE);
      if (rt < top) quad([c + 1, rt, z1], [c + 1, rt, z0], [c + 1, top, z0], [c + 1, top, z1], SIDE);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    slabs = new THREE.InstancedMesh(geo, slabMat, sheets.length);
    sheets.forEach((sh, i) => slabs.setMatrixAt(i, _m4.makeTranslation(0, 0, sh.mesh.position.z)));
    slabs.count = Math.min(sheets.length, L.T + 1); // この図版のページのぶんだけ
    scene.add(slabs);
  }
  buildSlabs();

  // ページのふち（5秒ごとに外わく、ほかは上のふち）
  const edgeGeo = new THREE.BufferGeometry();
  const tSprites = [];
  function buildEdges() {
    const v = [];
    for (let t = 0; t <= L.T; t++) {
      const z = Z(t);
      if (t % 5) { v.push(0, L.H, z, L.W, L.H, z); continue; }
      v.push(0, 0, z, 0, L.H, z, 0, L.H, z, L.W, L.H, z, L.W, L.H, z, L.W, 0, z);
    }
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    for (const sp of tSprites) scene.remove(sp);
    tSprites.length = 0;
    for (let t = 0; t <= L.T; t += 5) {
      const sp = textSprite(t + '', 0.9);
      sp.position.set(L.W + 1.6, 0.6, Z(t));
      scene.add(sp); tSprites.push(sp);
    }
    for (const sh of sheets) sh.mesh.visible = sh.t <= L.T;
  }
  buildEdges();
  const edgeLines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: '#b29a6c', transparent: true, opacity: 0.45 }));
  scene.add(edgeLines);
  // いまのページ（主人公にいちばん近いページ）: 紙の地と真鍮のふち
  const paper = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: '#f8efd8', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(paper);
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, L.H, 0), new THREE.Vector3(L.W, L.H, 0), new THREE.Vector3(L.W, 0, 0)]),
  new THREE.LineBasicMaterial({ color: '#a8742a' }));
  scene.add(frame);


  // ---- 主人公 ----
  let hero = look().makeHero();
  scene.add(hero);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(40,25,10,.45)', 'rgba(40,25,10,0)'), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  // タップの行き先の印（床に、細い輪）
  const goRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 28), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.85, depthTest: false }));
  goRing.rotation.x = -Math.PI / 2; goRing.renderOrder = 9; goRing.visible = false; scene.add(goRing);
  let env = look().makeEnv(L);
  scene.add(env);

  // ---- 置いた形・持っている形・ゴースト ----
  // 太い線（v077）: WebGL の線は 1px なので、辺ごとに細い円柱を立ててひとつにまとめる
  function thickEdges(eg, r) {
    const p = eg.attributes.position, parts = [], a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < p.count; i += 2) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1);
      const len = a.distanceTo(b); if (len < 1e-4) continue;
      const c = new THREE.CylinderGeometry(r, r, len + r * 2, 6, 1, true);
      c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize()));
      c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      parts.push(c.toNonIndexed ? c.toNonIndexed() : c);
    }
    return new THREE.Mesh(mergeGeos(parts), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }));
  }
  const pieceObjs = new Map();
  function makePieceObj(p, ghost) {
    const col = kindColor(p.kind);
    const grp = new THREE.Group();
    const geo = pieceGeometry(p);
    const fill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: col, transparent: true, opacity: ghost ? 0.22 : 0.55, roughness: 0.3, metalness: 0.1, depthWrite: false,
    }));
    const eg = new THREE.EdgesGeometry(geo, geo.userData.edgeAngle || 1);
    const edges = ghost ? thickEdges(eg, 0.04) : new THREE.LineSegments(eg,
      new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.55), transparent: true, opacity: 0.95 }));
    grp.add(fill, edges);
    grp.userData = { fill, edges, edgeCol: edges.material.color.clone() };
    if (ghost) {
      // ゴースト（v077）: 地形にかくれた所はうすく、見えている所はこく、の2回描く。
      // まえは手前のページの地面が形の手前がわをかくして、置き場所の色が奥のほうにしか出ていなかった
      if (!geo.userData.edgeAngle) fill.material.side = THREE.DoubleSide; // 管の形（らせん）は、うらまで描くと色がにごる
      fill.renderOrder = 10; edges.renderOrder = 11; // ページを描いたあとに、深さを見て描く
      const fillHid = new THREE.Mesh(geo, fill.material.clone()), edgesHid = new THREE.Mesh(edges.geometry, edges.material.clone());
      fillHid.material.depthTest = false; edgesHid.material.depthTest = false; // かくれていても見える、うすい下描き
      fillHid.renderOrder = 9; edgesHid.renderOrder = 9;
      grp.add(fillHid, edgesHid);
      Object.assign(grp.userData, { fillHid, edgesHid });
    }
    return grp;
  }
  let ghost = null, ghostKey = '';
  // ほかの受け口（Tab で移れる置き場所）: 床に点線の枠
  const sockMarks = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3].map(() => new THREE.Vector3())),
      new THREE.LineDashedMaterial({ color: '#fff6dc', dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.8 }));
    m.visible = false; scene.add(m); sockMarks.push(m);
  }
  // つかめる形の上に、ポコっと出る「つかむ手」の印（銅版画ふうの線の手）
  const eIcon = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#3d2a18'; g.beginPath(); g.roundRect(14, 18, 100, 100, 18); g.fill();
    g.fillStyle = '#fbf5e6'; g.beginPath(); g.roundRect(14, 10, 100, 96, 18); g.fill();
    g.strokeStyle = '#3d2a18'; g.lineWidth = 6; g.stroke();
    // 手のひらと4本の指・親指（指を軽く曲げた、つかむ手）
    g.save(); g.translate(64, 60); g.fillStyle = '#e9d3a8'; g.strokeStyle = '#3d2a18'; g.lineWidth = 4; g.lineJoin = 'round';
    const finger = (x, y, h) => { g.beginPath(); g.roundRect(x - 6, y - h, 12, h + 8, 6); g.fill(); g.stroke(); };
    finger(-15, -6, 26); finger(-3, -9, 31); finger(9, -8, 29); finger(21, -3, 22);
    g.beginPath(); g.roundRect(-22, -6, 50, 36, 12); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-20, 10); g.quadraticCurveTo(-36, 4, -34, -10); g.quadraticCurveTo(-30, -16, -24, -10); g.quadraticCurveTo(-20, 0, -12, 4); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(61,42,24,.5)'; g.lineWidth = 2;
    for (const x of [-9, 3, 15]) { g.beginPath(); g.moveTo(x, -4); g.lineTo(x, 6); g.stroke(); }
    g.restore();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.renderOrder = 10; sp.visible = false; scene.add(sp);
    return sp;
  })();
  let eKey = '', ePop = 0;

  // ---- 世界線のリボン（見に行ったところまで） ----
  let ribbon = null, oldRibbons = [], endMark = null;
  const ribbonMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });
  function buildRibbon(h) {
    const pts = [];
    const fr = h.frames;
    for (let k = 0; k < fr.length; k += 2) {
      if (fr[k].st === 'dead') break;
      pts.push(new THREE.Vector3(fr[k].x, fr[k].y + 0.45, Z(k * DT)));
    }
    if (h.end.type !== 'goal' && h.end.type !== 'time') pts.push(new THREE.Vector3(h.end.x, Math.max(h.end.y, -2.5) + 0.45, Z(h.end.t)));
    if (pts.length < 2) pts.push(pts[0].clone().add(new THREE.Vector3(0, 0, -0.01)));
    const seg = pts.length * 2;
    const rc = look().ribbon || {};
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, 0.07, 6, false),
      ribbonMat(h.end.type === 'goal' ? (rc.gold || '#c9942e') : (rc.line || '#5a3d22'), 0.95));
    m.userData = { seg, tEnd: -pts[pts.length - 1].z / GAP };
    return m;
  }
  function setEndMark(h) {
    if (endMark) { scene.remove(endMark); endMark = null; }
    const e = h.end, rc = look().ribbon || {};
    if (e.type === 'goal') {
      endMark = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: rc.gold || '#c9942e' }));
      endMark.position.set(e.x, e.y + 0.5, Z(e.t));
    } else if (e.type !== 'time') {
      endMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: rc.dead || '#8f3b2b' }));
      endMark.position.set(e.x, Math.max(e.y, -2.5) + 0.45, Z(e.t));
    }
    if (endMark) { endMark.userData.t = e.t; scene.add(endMark); }
  }

  // ---- 描きかえの波 ----
  const wave = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({
    color: '#ffe3a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  scene.add(wave);
  let waveT = null, waveFrom = 0, hist = null, pieces = [];

  // 主人公の軌跡（ページごとの、点線の押し跡）
  const trails = new Map();
  let trailLast = new Map();
  function trailCanvas(t) {
    if (!trails.has(t)) { const c = document.createElement('canvas'); c.width = L.W * S; c.height = L.H * S; trails.set(t, c); }
    return trails.get(t);
  }
  function drawOne(sh) {
    if (sh.t > L.T) { sh.pending = false; return; } // この図版にはないページ
    const fr = hist.frames[Math.round(sh.t / DT)];
    drawSheet(sh.g, L, sh.t, fr, sectionsAt(pieces, sh.t), { goalT: hist.end.type === 'goal' ? hist.end.t : null, misprintAfter: misprintOf(hist) });
    if (trails.has(sh.t)) sh.g.drawImage(trails.get(sh.t), 0, 0);
    sh.tex.needsUpdate = true;
    sh.pending = false;
  }

  const key = (p) => (p ? `${p.kind}:${p.rot ? 1 : 0}:${p.x0}:${p.t0}:${p.y0}` : '');
  function syncPieces(ps, animate) {
    pieces = ps;
    for (const [id, o] of pieceObjs) {
      const p = ps.find((q) => q.id === id);
      if (!p || o.userData.key !== key(p)) { scene.remove(o); pieceObjs.delete(id); }
    }
    for (const p of ps) {
      if (pieceObjs.has(p.id)) continue;
      const o = makePieceObj(p, false);
      o.userData.key = key(p);
      o.position.set(p.x0, p.y0, Z(p.t0));
      o.userData.drop = animate ? 1 : 0; o.userData.y0 = p.y0;
      scene.add(o); pieceObjs.set(p.id, o);
    }
  }

  // 歴史を入れかえる。fromT から未来へ波を走らせる（fromT=null なら形の立体だけ合わせる）
  function setHistory(h, ps, fromT, animate) {
    syncPieces(ps, animate);
    if (fromT === null) return;
    hist = h;
    if (ribbon) { ribbon.material = ribbonMat((look().ribbon || {}).old || '#a0634f', 0.5); ribbon.userData.fade = 1; oldRibbons.push(ribbon); }
    ribbon = buildRibbon(h); scene.add(ribbon);
    setEndMark(h);
    if (!animate) {
      for (const sh of sheets) drawOne(sh);
      waveT = null;
      for (const r of oldRibbons) { scene.remove(r); r.geometry.dispose(); }
      oldRibbons = [];
      return;
    }
    for (const sh of sheets) if (sh.t >= Math.floor(fromT)) sh.pending = true;
    waveFrom = Math.floor(fromT);
    waveT = waveFrom - 0.3;
  }

  // ---- カメラ: 主人公を追いかける。ドラッグで回す、ホイールで寄る、ダブルクリックでもと ----
  const ORBIT0 = { yaw: 0.35, pitch: 0.52, dist: 17 };
  const orbit = { ...ORBIT0 };
  let homeYaw = ORBIT0.yaw; // はじめの向き（図版の内側を向く。resetCamera で決める）
  let drag = null, lastManual = -10, invX = false, invY = false; // 設定: 回す向きをさかさに
  const touches = new Map(); let pinch0 = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 1) e.preventDefault();
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
    }
    drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) orbit.dist = Math.max(6, Math.min(60, orbit.dist * pinch0 / d));
        pinch0 = d; return;
      }
    }
    if (!drag) {
      // マウスを動かしただけ: 指している地面と形を知らせる（パレットの形のゴーストがついてくる）
      if (e.pointerType === 'mouse' && onHover) { const p = pickGround(e.clientX, e.clientY); onHover(p ? p.x : null, p ? p.t : null, pickPiece(e.clientX, e.clientY)); }
      return;
    }
    orbit.yaw -= (e.clientX - drag.x) * 0.006 * (invX ? -1 : 1);
    orbit.pitch = Math.max(0.08, Math.min(1.35, orbit.pitch + (e.clientY - drag.y) * 0.005 * (invY ? -1 : 1)));
    drag.x = e.clientX; drag.y = e.clientY;
    lastManual = performance.now() / 1000;
  });
  const endDrag = (e) => {
    if (drag && e && e.type === 'pointerup' && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8 && performance.now() - drag.at < 350) {
      // 右クリック（その場で離す）: 持っている形を回す
      if (e.button === 2) { if (onRight) onRight(); }
      else if (onTap) {
        const p = pickGround(e.clientX, e.clientY);
        onTap(p ? p.x : null, p ? p.t : null, pickPiece(e.clientX, e.clientY));
      }
    }
    drag = null; canvas.style.cursor = ''; if (e && touches.has(e.pointerId)) { touches.delete(e.pointerId); pinch0 = 0; } };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(6, Math.min(60, orbit.dist * Math.pow(1.0015, e.deltaY))); }, { passive: false });
  canvas.addEventListener('dblclick', () => { Object.assign(orbit, ORBIT0, { yaw: homeYaw }); });
  // 画面の点 → 時空の大地の (x, t)。主人公の高さの床、だめなら地面の高さで探す
  let onTap = null, onHover = null, onRight = null, heroY = 4;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickGround(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (Math.abs(d.y) < 1e-4) return null;
    // 地形の上面と交わるところ（ざっと、手前から少しずつ進む）
    for (let s = 0; s < 120; s += 0.25) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      const c = Math.floor(x), top = c >= 0 && c < L.W ? L.tops[c] : -1;
      if (y <= Math.max(top, 0)) return { x, t: -z / GAP };
    }
    const s = (heroY - o.y) / d.y;
    return s > 0 ? { x: o.x + d.x * s, t: -(o.z + d.z * s) / GAP } : null;
  }
  // 画面の点にある、置いた形の id（なければ null）
  function pickPiece(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null, bd = Infinity;
    for (const [id, o] of pieceObjs) {
      if (!o.visible) continue;
      const hit = ray.intersectObject(o.userData.fill, false)[0];
      if (hit && hit.distance < bd) { bd = hit.distance; best = id; }
    }
    return best;
  }
  const target = new THREE.Vector3(), camPos = new THREE.Vector3();
  let visY = NaN;
  let camInit = false;

  // 主人公と重なっているページ（中心から 0.9 以内）にだけ、断面を描く
  let heroPages = new Map();
  function heroOverlay(hx, hy, ht) {
    const want = new Map();
    for (let t = Math.ceil(ht - 0.9); t <= Math.floor(ht + 0.9); t++) {
      if (t < 0 || t > L.T) continue;
      want.set(t, `${hx.toFixed(2)}:${hy.toFixed(2)}:${ht.toFixed(2)}:${(hero.userData.body.rotation.y).toFixed(2)}`);
    }
    for (const [t] of heroPages) if (!want.has(t) && hist) drawOne(sheets[t]);
    for (const [t, k] of want) {
      if (heroPages.get(t) === k || !hist) continue;
      const sh = sheets[t];
      const polys = sliceObject(hero, Z(t));
      drawOne(sh);
      drawSlices(sh.g, L, polys, hero.userData.sliceHatch);
      sh.tex.needsUpdate = true;
    }
    heroPages = want;
  }
  // 右下の小窓など、ほかの絵にも主人公の断面を描く
  function heroPortrait(g, px, py) {
    const polys = sliceObject(hero, hero.position.z);
    for (const pl of polys) pl.pts = pl.pts.map(([x, y]) => [x - hero.position.x + px, y - hero.position.y + py]);
    drawSlices(g, L, polys, hero.userData.sliceHatch);
  }
  function drawHeroOn(g, t) { drawSlices(g, L, sliceObject(hero, Z(t)), hero.userData.sliceHatch); }
  function drawTrailOn(g, t) { const c = trails.get(Math.round(t)); if (c) g.drawImage(c, 0, 0); }

  // ---- 綴じる: ページの束が閉じて、一枚になる ----
  let book = 0, bookTo = 0, bookAt = 0, bookDone = null;
  let runVis = false, titleT = 0, shot = null;
  function closeBook(atT, done) { bookTo = 1; bookAt = atT; bookDone = done; }
  function openBook() { bookTo = 0; bookDone = null; }

  // ---- 毎フレーム ----
  function update(dt, v) {
    const { hero: h, walking, cand, candOk, revealT, focus, moveX, moveT } = v;
    heroY = h.y;
    const now = performance.now() / 1000;
    // 波
    if (waveT !== null) {
      waveT += dt * 40;
      for (const sh of sheets) if (sh.pending && sh.t <= waveT) drawOne(sh);
      wave.position.set(L.W / 2, L.H / 2, Z(Math.max(waveFrom, waveT)) - 0.05);
      wave.material.opacity = waveT < waveFrom ? 0 : 0.35;
      if (waveT > L.T + 1) { waveT = null; wave.material.opacity = 0; }
    } else wave.material.opacity = Math.max(0, wave.material.opacity - dt * 2);
    for (let i = oldRibbons.length - 1; i >= 0; i--) {
      const r = oldRibbons[i];
      r.userData.fade -= dt * 0.5;
      r.material.opacity = Math.max(0, r.userData.fade * 0.5);
      if (r.userData.fade <= 0) { scene.remove(r); r.geometry.dispose(); oldRibbons.splice(i, 1); }
    }
    // 世界線は、見に行ったところまで
    if (ribbon) ribbon.visible = !!v.showRoute;
    if (ribbon) {
      const u = ribbon.userData;
      const lim = waveT !== null ? Math.min(revealT, Math.max(waveFrom, waveT)) : revealT;
      const frac = Math.max(0, Math.min(1, lim / Math.max(0.01, u.tEnd)));
      ribbon.geometry.setDrawRange(0, Math.floor(frac * u.seg) * 36);
    }
    if (endMark) endMark.visible = !!v.showRoute && waveT === null && endMark.userData.t <= revealT;
    for (const r of oldRibbons) r.visible = !!v.showRoute;
    // 形が下りてくる
    for (const [, o] of pieceObjs) {
      if (o.userData.drop > 0) {
        o.userData.drop = Math.max(0, o.userData.drop - dt * 4);
        o.position.y = o.userData.y0 + o.userData.drop * o.userData.drop * 2.5;
      }
    }

    // 綴じる演出: ページを主人公のいるページへ寄せて重ね、一枚にする
    if (book !== bookTo) {
      book += Math.sign(bookTo - book) * dt * (bookTo ? 1.3 : 2.5);
      book = Math.max(0, Math.min(1, book));
      if (book === 1 && bookDone) { const f = bookDone; bookDone = null; f(); }
    }
    {
      const e = book * book * (3 - 2 * book), az = Z(bookAt);
      for (const sh of sheets) sh.mesh.position.z = Z(sh.t) + (az - Z(sh.t)) * e + (sh.t - bookAt) * 0.002 * e;
      if (slabs) { sheets.forEach((sh, i) => slabs.setMatrixAt(i, _m4.makeTranslation(0, 0, sh.mesh.position.z))); slabs.instanceMatrix.needsUpdate = true; }
      const show = book < 0.05;
      edgeLines.visible = show; hero.visible = show; blob.visible = blob.visible && show;
      for (const [, o] of pieceObjs) o.visible = show;
      if (ribbon) ribbon.visible = ribbon.visible && show;
      frame.position.z = book > 0 ? az + 0.02 : frame.position.z;
    }
    // カメラ（主人公のうしろ上。動いていて、しばらく手で回していなければ、ゆっくり進む向きのうしろへ）
    const hz = Z(h.t);
    if (walking && now - lastManual > 1.2) {
      const mx3 = moveX, mz3 = -moveT;
      const fwdX = -Math.sin(orbit.yaw), fwdZ = -Math.cos(orbit.yaw);
      if (mx3 * fwdX + mz3 * fwdZ > 0.7) { // 前へ進んでいるときだけ（横歩き・うしろ歩きでは回さない）
        const want = Math.atan2(-mx3, -mz3);
        let d = want - orbit.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        orbit.yaw += d * Math.min(1, dt * 1.2);
      }
    }
    visY = Number.isFinite(visY) && Math.abs(h.y - visY) < 3 ? visY + (h.y - visY) * Math.min(1, dt * 16) : h.y;
    target.set(h.x, visY + 1.6, hz);
    const cp = Math.cos(orbit.pitch);
    camPos.set(target.x + Math.sin(orbit.yaw) * cp * orbit.dist, target.y + Math.sin(orbit.pitch) * orbit.dist, target.z + Math.cos(orbit.yaw) * cp * orbit.dist);
    // タイトル画面だけのカメラ（v071）: ページの束をななめ上から、ゆっくり左右にゆれながら見わたす
    if (v.titleCam) {
      titleT += dt;
      const a = 0.62 + Math.sin(titleT * 0.06) * 0.32;
      target.set(L.W * 0.5, 4.2, Z(L.T * 0.3));
      camPos.set(target.x + Math.sin(a) * 31, target.y + 12.5 + Math.sin(titleT * 0.09) * 1.2, target.z + Math.cos(a) * 31);
    }
    if (!camInit) { camera.position.copy(camPos); camInit = true; }
    camera.position.lerp(camPos, Math.min(1, dt * (v.titleCam ? 1.5 : drag ? 16 : 7)));
    camera.lookAt(target);
    // サムネイルを撮るときの、決めたカメラ（v072。?thumb）
    if (shot) { camera.position.set(shot[0], shot[1], shot[2]); camera.lookAt(shot[3], shot[4], shot[5]); }

    // ページの見え方: カメラと主人公のあいだのページはうすく（主人公をかくさない）。正面から見ているほどうすく
    const cz = camera.position.z, face = Math.abs(Math.cos(orbit.yaw));
    for (const sh of sheets) {
      const z = Z(sh.t), m = sh.mat;
      const between = !v.titleCam && !shot && (z - hz) * (cz - hz) > 0 && Math.abs(z - hz) > 0.5;
      if (between) {
        m.alphaTest = 0.01; m.depthWrite = false;
        m.opacity = Math.max(0.06, 1 - face * (0.75 + Math.min(0.2, Math.abs(z - hz) * 0.03)));
      } else { m.alphaTest = 0.12; m.depthWrite = true; m.opacity = 1; }
      const c = sh.t === focus ? 1 : 0.94;
      // パラパラ: 立ち止まっているあいだ、まわりのページを順に明るく
      if (v.flip != null && Math.abs(sh.t - v.flip) < 0.5) m.color.setRGB(1.12, 1.08, 0.96);
      else m.color.setRGB(c, c, c);
    }
    paper.position.set(L.W / 2, L.H / 2, Z(focus) + 0.03);
    frame.position.z = Z(focus) + 0.01;
    paper.visible = frame.visible = !v.titleCam && !shot; // タイトル・サムネでは、いまのページの印は出さない
    if (shot) edgeLines.visible = false; // サムネでは、ページのふちの線（箱のように見える）も出さない

    // 舞台（奈落のほこり・左右の見えない壁）
    if (env.userData.update) env.userData.update(dt, h);
    // 主人公
    // 浮かんでいる: 足もとの面から少し上に（v038）
    hero.position.set(h.x, visY + 0.3, hz);
    const ud = hero.userData;
    const want = Math.atan2(h.ft, h.fx);
    let d = want - ud.body.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    ud.body.rotation.y += d * Math.min(1, dt * 12);
    const tm = now;
    // 走りの姿勢は、はなしたらすぐ解く（v042）
    runVis = !!v.running;
    if (ud.animate) ud.animate(dt, { speed: h.speed != null ? h.speed : Math.hypot(moveX, moveT), run: runVis, grounded: h.grounded, vy: h.vy, carry: false, landT: h.landT || 0, t: h.t });
    // あなたの断面（透かし）をページに描くか（設定。ふだんは描かない）
    if (v.heroSlice) heroOverlay(h.x, visY, h.t);
    else if (heroPages.size) { for (const [t] of heroPages) if (hist) drawOne(sheets[t]); heroPages = new Map(); }
    // 足もとの影（真下の地面に）
    blob.visible = Number.isFinite(v.groundY);
    if (blob.visible) {
      blob.position.set(h.x, v.groundY + 0.03, hz);
      blob.scale.setScalar(1 / (1 + Math.max(0, h.y - v.groundY) * 0.3));
    }
    // タップの行き先
    goRing.visible = !!v.walkTo;
    if (v.walkTo) {
      const gy = groundAt(L, pieces, v.walkTo.x, v.walkTo.t, h.y + 3);
      goRing.position.set(v.walkTo.x, (Number.isFinite(gy) ? gy : h.y) + 0.05, Z(v.walkTo.t));
      goRing.scale.setScalar(1 + 0.15 * Math.sin(tm * 6));
    }
    // E のアイコン
    const gp = v.grab;
    const gk = gp ? gp.id + ':' + gp.x0 + ':' + gp.t0 : '';
    if (gk !== eKey) { eKey = gk; ePop = 0; }
    eIcon.visible = false;
    // つかめる形: ふちの線が明るくなり、ほんのり光って脈打つ
    for (const [id, o] of pieceObjs) {
      const on = !!gp && gp.id === id, m = o.userData.fill.material, em = o.userData.edges.material;
      if (on) {
        const k = 0.5 + 0.5 * Math.sin(tm * 5);
        m.emissive.set('#ffd98a'); m.emissiveIntensity = 0.3 + 0.35 * k;
        em.color.copy(o.userData.edgeCol).lerp(new THREE.Color('#fff4cf'), 0.6 + 0.4 * k);
      } else if (m.emissiveIntensity) { m.emissiveIntensity = 0; em.color.copy(o.userData.edgeCol); }
    }
    if (gp) {
      const dd = pieceDims(gp);
      ePop = Math.min(1, ePop + dt * 6);
      const pop = ePop < 1 ? 1 + Math.sin(ePop * Math.PI) * 0.35 : 1;
      const top = gp.y0 + dd.h + (dd.rise || 0);
      eIcon.position.set(gp.x0 + dd.wx / 2, top + 0.7 + Math.sin(tm * 4) * 0.08, Z(gp.t0 + dd.dz / 2));
      eIcon.scale.setScalar(0.75 * pop * ePop);
    }

    // 置き場所のゴースト（実物大）
    const gkk = cand ? cand.kind + ':' + (cand.rot ? 1 : 0) : '';
    if (gkk !== ghostKey) {
      if (ghost) scene.remove(ghost);
      ghost = cand ? makePieceObj(cand, true) : null;
      if (ghost) scene.add(ghost);
      ghostKey = gkk;
    }
    if (ghost) {
      ghost.position.set(cand.x0, Number.isFinite(cand.y0) ? cand.y0 : h.y, Z(cand.t0));
      const gu = ghost.userData;
      for (const m of [gu.edges.material, gu.edgesHid.material]) m.color.set(candOk ? '#ffffff' : '#ff5a4a');
      for (const m of [gu.fill.material, gu.fillHid.material]) m.color.set(candOk ? kindColor(cand.kind) : '#ff5a4a');
      // 明滅（v077）: わくと面をゆっくり明るく暗く。どこにどんな形を置くのかを目で追いやすく
      const bl = 0.5 + 0.5 * Math.sin(tm * 5);
      gu.edges.material.opacity = 0.6 + 0.4 * bl; gu.edgesHid.material.opacity = 0.18 + 0.12 * bl;
      gu.fill.material.opacity = 0.14 + 0.16 * bl; gu.fillHid.material.opacity = 0.04 + 0.05 * bl;
    }
    const socks = v.sockets || [];
    sockMarks.forEach((m, i) => {
      const s = socks[i];
      m.visible = !!s && !!cand && !(s.x0 === cand.x0 && s.t0 === cand.t0);
      if (!m.visible) return;
      const dd = pieceDims(s), y = s.y0 + 0.04;
      m.geometry.setFromPoints([new THREE.Vector3(s.x0, y, Z(s.t0)), new THREE.Vector3(s.x0 + dd.wx, y, Z(s.t0)), new THREE.Vector3(s.x0 + dd.wx, y, Z(s.t0 + dd.dz)), new THREE.Vector3(s.x0, y, Z(s.t0 + dd.dz))]);
      m.computeLineDistances();
      m.material.opacity = 0.45 + 0.3 * Math.sin(tm * 4 + i);
    });
    renderer.render(scene, camera);
  }

  function applyLook() {
    const lk = look();
    scene.fog.color.set(lk.fog);
    scene.fog.near = lk.fogNear || 30; scene.fog.far = lk.fogFar || 90;
    hemi.color.set(lk.light.sky); hemi.groundColor.set(lk.light.ground); sun.color.set(lk.light.sun);
    edgeLines.material.color.set(lk.edge);
    paper.material.color.set(lk.paperTint);
    frame.material.color.set(lk.focus);
    scene.remove(hero); hero = lk.makeHero(); scene.add(hero);
    heroPages = new Map();
    if (hist) for (const sh of sheets) drawOne(sh);
    scene.remove(env); env = lk.makeEnv(L); scene.add(env);
    document.body.style.background = lk.bg;
  }

  function setLevel(nl) {
    L = nl;
    heroPages = new Map();
    trails.clear(); trailLast = new Map();
    for (const [id, o] of pieceObjs) { scene.remove(o); pieceObjs.delete(id); }
    pieces = [];
    buildSlabs();
    buildEdges();
    scene.remove(env); env = look().makeEnv(L); scene.add(env); // 深淵の広さも、ページの数に合わせる
  }

  const camYaw = () => orbit.yaw;
  // はじめのカメラ（v077）: 主人公が図版の左はしにいれば左うしろから右（内側）を、右はしにいれば右うしろから左を見る。
  // まんなかあたりなら巣のほうを向く
  function resetCamera(heroX) {
    let right = true;
    if (heroX != null) right = heroX > L.W * 0.7 || (heroX >= L.W * 0.3 && L.goal.x < heroX);
    homeYaw = right ? 0.42 : -0.42;
    Object.assign(orbit, ORBIT0, { yaw: homeYaw }); lastManual = -10;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 60 : 45;
    camera.updateProjectionMatrix();
  }

  // 確認用: 波を終わらせる
  function skipWave() { if (waveT === null) return; for (const sh of sheets) if (sh.pending) drawOne(sh); waveT = null; }

  const setInvert = (x, y) => { invX = !!x; invY = !!y; };
  const setShot = (a) => { shot = a; };
  return { setShot, setInvert, setLevel, setHistory, update, resize, applyLook, camYaw, resetCamera, skipWave, drawHeroOn, drawTrailOn, heroPortrait, pickGround, set onTap(f) { onTap = f; }, set onHover(f) { onHover = f; }, set onRight(f) { onRight = f; }, setCursor: (c) => { if (!drag && canvas.style.cursor !== c) canvas.style.cursor = c; }, closeBook, openBook, waving: () => waveT !== null };
}
