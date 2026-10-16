// 3Dの舞台: ページの束（時空の大地）・標本台・主人公・置いた形・持っている形・世界線・描きかえの波・追いかけるカメラ
// 3Dの向き: X＝2D世界の横、Y＝高さ、Z＝ -時間（前＝奥＝未来。カメラは主人公のうしろ＝昔の側から見る。ページは表から見える）
import * as THREE from 'three';
import { look, kindColor } from './look/index.js?v=17';
import { radialTexture } from './look/util.js?v=17';
import { S, drawSheet } from './sheet.js?v=17';
import { sectionsAt, DT, pieceDims } from './sim.js?v=17';
import { TABLE, tableY } from './hero.js?v=17';

export const GAP = 1.0;
const Z = (t) => -t * GAP;

function textSprite(text, size = 0.9, color = '#5a4430') {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'italic 34px Georgia, serif';
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(size * 2, size, 1);
  return sp;
}

// 3Dの形の立体（rot と slope に合わせて、ななめにずらした直方体）
const geoCache = new Map();
export function pieceGeometry(p) {
  const key = p.kind + ':' + (p.rot ? 1 : 0);
  if (geoCache.has(key)) return geoCache.get(key);
  const d = pieceDims(p);
  const g = new THREE.BoxGeometry(d.wx, d.h, d.dz * GAP, Math.max(1, Math.round(d.wx)), 1, Math.max(1, Math.round(d.dz)));
  g.translate(d.wx / 2, d.h / 2, -d.dz * GAP / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const tt = -pos.getZ(i) / GAP;
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
  const sheets = [];
  for (let t = 0; t <= L.T; t++) {
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
  // ページのふち（5秒ごとに外わく、ほかは上のふち）
  const edgeGeo = new THREE.BufferGeometry();
  {
    const v = [];
    for (let t = 0; t <= L.T; t++) {
      const z = Z(t);
      if (t % 5) { v.push(0, L.H, z, L.W, L.H, z); continue; }
      v.push(0, 0, z, 0, L.H, z, 0, L.H, z, L.W, L.H, z, L.W, L.H, z, L.W, 0, z);
    }
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  }
  const edgeLines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: '#b29a6c', transparent: true, opacity: 0.45 }));
  scene.add(edgeLines);
  for (let t = 0; t <= L.T; t += 5) {
    const sp = textSprite(t + '', 0.9);
    sp.position.set(L.W + 1.6, 0.6, Z(t));
    scene.add(sp);
  }
  // いまのページ（主人公にいちばん近いページ）: 紙の地と真鍮のふち
  const paper = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: '#f8efd8', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(paper);
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, L.H, 0), new THREE.Vector3(L.W, L.H, 0), new THREE.Vector3(L.W, 0, 0)]),
  new THREE.LineBasicMaterial({ color: '#a8742a' }));
  scene.add(frame);

  // ---- 標本台（ブロックの左どなり） ----
  let table = null;
  function buildTable() {
    if (table) scene.remove(table);
    table = new THREE.Group();
    const ty = tableY(L);
    const len = (TABLE.t1 - TABLE.t0) * GAP;
    const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.x1 - TABLE.x0, 0.4, len), new THREE.MeshStandardMaterial({ color: '#7a4e2c', roughness: 0.6 }));
    top.position.set((TABLE.x0 + TABLE.x1) / 2, ty - 0.2, Z((TABLE.t0 + TABLE.t1) / 2));
    const body = new THREE.Mesh(new THREE.BoxGeometry(TABLE.x1 - TABLE.x0 - 0.4, ty + 4.1, len - 0.4), new THREE.MeshStandardMaterial({ color: '#5c3a20', roughness: 0.7 }));
    body.position.set((TABLE.x0 + TABLE.x1) / 2, (ty - 0.4 - 4.5) / 2, top.position.z);
    const brass = new THREE.MeshStandardMaterial({ color: '#c9973d', roughness: 0.3, metalness: 0.85 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len), brass);
    rim.position.set(TABLE.x0 + 0.06, ty + 0.02, top.position.z);
    const label = textSprite('標本台', 1.0, '#4a3320');
    label.position.set((TABLE.x0 + TABLE.x1) / 2, ty + 0.6, Z(TABLE.t0) - 0.3);
    table.add(top, body, rim, label);
    scene.add(table);
  }
  buildTable();

  // ---- 主人公 ----
  let hero = look().makeHero();
  scene.add(hero);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(40,25,10,.45)', 'rgba(40,25,10,0)'), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  let env = look().makeEnv(L);
  scene.add(env);

  // ---- 置いた形・持っている形・ゴースト ----
  const pieceObjs = new Map();
  function makePieceObj(p, ghost) {
    const col = kindColor(p.kind);
    const grp = new THREE.Group();
    const geo = pieceGeometry(p);
    const fill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: col, transparent: true, opacity: ghost ? 0.22 : 0.55, roughness: 0.3, metalness: 0.1, depthWrite: false,
    }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: ghost ? '#ffffff' : new THREE.Color(col).multiplyScalar(0.55), transparent: true, opacity: 0.95 }));
    grp.add(fill, edges);
    grp.userData = { fill, edges };
    return grp;
  }
  let ghost = null, ghostKey = '';
  let carried = null, carriedKey = '';
  // つかめる形の上に、ポコっと出る E のキー
  const eIcon = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#3d2a18'; g.beginPath(); g.roundRect(14, 18, 100, 100, 18); g.fill();
    g.fillStyle = '#fbf5e6'; g.beginPath(); g.roundRect(14, 10, 100, 96, 18); g.fill();
    g.strokeStyle = '#3d2a18'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#3d2a18'; g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('E', 64, 60);
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
    const fr = hist.frames[Math.round(sh.t / DT)];
    drawSheet(sh.g, L, sh.t, fr, sectionsAt(pieces, sh.t), { goalT: hist.end.type === 'goal' ? hist.end.t : null });
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
  let drag = null, lastManual = -10;
  const touches = new Map(); let pinch0 = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 1) e.preventDefault();
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
    }
    drag = { x: e.clientX, y: e.clientY };
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
    if (!drag) return;
    orbit.yaw -= (e.clientX - drag.x) * 0.006;
    orbit.pitch = Math.max(0.08, Math.min(1.35, orbit.pitch + (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX; drag.y = e.clientY;
    lastManual = performance.now() / 1000;
  });
  const endDrag = (e) => { drag = null; canvas.style.cursor = ''; if (e && touches.has(e.pointerId)) { touches.delete(e.pointerId); pinch0 = 0; } };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(6, Math.min(60, orbit.dist * Math.pow(1.0015, e.deltaY))); }, { passive: false });
  canvas.addEventListener('dblclick', () => { Object.assign(orbit, ORBIT0); });
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
      // 軌跡: 少し動いたら、そのときの断面のふちを残す
      const lp = trailLast.get(t);
      if (polys.length && (!lp || Math.hypot(hx - lp.x, hy - lp.y, (ht - lp.t) * 3) > 0.35)) {
        stampTrail(trailCanvas(t).getContext('2d'), L, polys);
        trailLast.set(t, { x: hx, y: hy, t: ht });
      }
      drawOne(sh);
      drawSlices(sh.g, L, polys, hero.userData.sliceHatch);
      sh.tex.needsUpdate = true;
    }
    heroPages = want;
  }
  // 右下の小窓など、ほかの絵にも主人公の断面を描く
  function drawHeroOn(g, t) { drawSlices(g, L, sliceObject(hero, Z(t)), hero.userData.sliceHatch); }
  function drawTrailOn(g, t) { const c = trails.get(Math.round(t)); if (c) g.drawImage(c, 0, 0); }

  // ---- 綴じる: ページの束が閉じて、一枚になる ----
  let book = 0, bookTo = 0, bookAt = 0, bookDone = null;
  function closeBook(atT, done) { bookTo = 1; bookAt = atT; bookDone = done; }
  function openBook() { bookTo = 0; bookDone = null; }

  // ---- 毎フレーム ----
  function update(dt, v) {
    const { hero: h, walking, carry, cand, candOk, revealT, focus, moveX, moveT } = v;
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
    if (!camInit) { camera.position.copy(camPos); camInit = true; }
    camera.position.lerp(camPos, Math.min(1, dt * (drag ? 16 : 7)));
    camera.lookAt(target);

    // ページの見え方: カメラと主人公のあいだのページはうすく（主人公をかくさない）。正面から見ているほどうすく
    const cz = camera.position.z, face = Math.abs(Math.cos(orbit.yaw));
    for (const sh of sheets) {
      const z = Z(sh.t), m = sh.mat;
      const between = (z - hz) * (cz - hz) > 0 && Math.abs(z - hz) > 0.5;
      if (between) {
        m.alphaTest = 0.01; m.depthWrite = false;
        m.opacity = Math.max(0.06, 1 - face * (0.75 + Math.min(0.2, Math.abs(z - hz) * 0.03)));
      } else { m.alphaTest = 0.12; m.depthWrite = true; m.opacity = 1; }
      const c = sh.t === focus ? 1 : 0.94;
      m.color.setRGB(c, c, c);
    }
    paper.position.set(L.W / 2, L.H / 2, Z(focus) + 0.03);
    frame.position.z = Z(focus) + 0.01;

    // 主人公
    hero.position.set(h.x, visY, hz);
    const ud = hero.userData;
    const want = Math.atan2(h.ft, h.fx);
    let d = want - ud.body.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    ud.body.rotation.y += d * Math.min(1, dt * 12);
    const tm = now;
    if (ud.animate) ud.animate(dt, { speed: Math.hypot(moveX, moveT), run: !!v.running, grounded: h.grounded, vy: h.vy, carry: !!carry, landT: h.landT || 0, t: h.t });
    heroOverlay(h.x, visY, h.t);
    // 足もとの影（真下の地面に）
    blob.visible = Number.isFinite(v.groundY);
    if (blob.visible) {
      blob.position.set(h.x, v.groundY + 0.03, hz);
      blob.scale.setScalar(1 / (1 + Math.max(0, h.y - v.groundY) * 0.3));
    }
    // E のアイコン
    const gp = v.grab;
    const gk = gp ? gp.id + ':' + gp.x0 + ':' + gp.t0 : '';
    if (gk !== eKey) { eKey = gk; ePop = 0; }
    eIcon.visible = !!gp;
    if (gp) {
      const dd = pieceDims(gp);
      ePop = Math.min(1, ePop + dt * 6);
      const pop = ePop < 1 ? 1 + Math.sin(ePop * Math.PI) * 0.35 : 1;
      const top = gp.y0 + dd.h + (dd.along === 'z' ? dd.slope * dd.dz : dd.slope * dd.wx);
      eIcon.position.set(gp.x0 + dd.wx / 2, top + 0.7 + Math.sin(tm * 4) * 0.08, Z(gp.t0 + dd.dz / 2));
      eIcon.scale.setScalar(0.5 * pop * ePop);
    }

    // 持っている形（頭の上に小さく）
    const ck = carry ? carry.kind + ':' + (carry.rot ? 1 : 0) : '';
    if (ck !== carriedKey) {
      if (carried) scene.remove(carried);
      carried = carry ? makePieceObj(carry, false) : null;
      if (carried) { carried.scale.setScalar(0.22); scene.add(carried); }
      carriedKey = ck;
    }
    if (carried) {
      const dd = pieceDims(carry);
      carried.position.set(h.x - dd.wx * 0.11, h.y + 3.1 + Math.sin(tm * 3) * 0.06, hz + dd.dz * 0.11);
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
      ghost.userData.edges.material.color.set(candOk ? '#ffffff' : '#ff5a4a');
      ghost.userData.fill.material.color.set(candOk ? kindColor(cand.kind) : '#ff5a4a');
    }
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
    buildTable();
  }

  const camYaw = () => orbit.yaw;
  function resetCamera() { Object.assign(orbit, ORBIT0); lastManual = -10; }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 60 : 45;
    camera.updateProjectionMatrix();
  }

  // 確認用: 波を終わらせる
  function skipWave() { if (waveT === null) return; for (const sh of sheets) if (sh.pending) drawOne(sh); waveT = null; }

  return { setLevel, setHistory, update, resize, applyLook, camYaw, resetCamera, skipWave, drawHeroOn, drawTrailOn, closeBook, openBook, waving: () => waveT !== null };
}
