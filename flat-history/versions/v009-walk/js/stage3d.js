// 3Dの舞台: ページの束（時空の大地）・標本台・主人公・置いた形・持っている形・世界線・描きかえの波・追いかけるカメラ
// 3Dの向き: X＝2D世界の横、Y＝高さ、Z＝ -時間（前＝奥＝未来。カメラは主人公のうしろ＝昔の側から見る。ページは表から見える）
import * as THREE from 'three';
import { look, kindColor } from './look/index.js?v=9';
import { radialTexture } from './look/util.js?v=9';
import { S, drawSheet } from './sheet.js?v=9';
import { sectionsAt, DT, pieceDims } from './sim.js?v=9';
import { TABLE, tableY } from './hero.js?v=9';

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

  function drawOne(sh) {
    const fr = hist.frames[Math.round(sh.t / DT)];
    drawSheet(sh.g, L, sh.t, fr, sectionsAt(pieces, sh.t));
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
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 1) e.preventDefault();
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    orbit.yaw -= (e.clientX - drag.x) * 0.006;
    orbit.pitch = Math.max(0.08, Math.min(1.35, orbit.pitch + (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX; drag.y = e.clientY;
    lastManual = performance.now() / 1000;
  });
  const endDrag = () => { drag = null; canvas.style.cursor = ''; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(6, Math.min(60, orbit.dist * Math.pow(1.0015, e.deltaY))); }, { passive: false });
  canvas.addEventListener('dblclick', () => { Object.assign(orbit, ORBIT0); });
  const target = new THREE.Vector3(), camPos = new THREE.Vector3();
  let camInit = false;

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
    if (ribbon) {
      const u = ribbon.userData;
      const lim = waveT !== null ? Math.min(revealT, Math.max(waveFrom, waveT)) : revealT;
      const frac = Math.max(0, Math.min(1, lim / Math.max(0.01, u.tEnd)));
      ribbon.geometry.setDrawRange(0, Math.floor(frac * u.seg) * 36);
    }
    if (endMark) endMark.visible = waveT === null && endMark.userData.t <= revealT;
    // 形が下りてくる
    for (const [, o] of pieceObjs) {
      if (o.userData.drop > 0) {
        o.userData.drop = Math.max(0, o.userData.drop - dt * 4);
        o.position.y = o.userData.y0 + o.userData.drop * o.userData.drop * 2.5;
      }
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
    target.set(h.x, h.y + 1.6, hz);
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
      } else { m.alphaTest = 0.5; m.depthWrite = true; m.opacity = 1; }
      const c = sh.t === focus ? 1 : 0.94;
      m.color.setRGB(c, c, c);
    }
    paper.position.set(L.W / 2, L.H / 2, Z(focus) + 0.03);
    frame.position.z = Z(focus) + 0.01;

    // 主人公
    hero.position.set(h.x, h.y, hz);
    const ud = hero.userData;
    const want = Math.atan2(h.ft, h.fx);
    let d = want - ud.body.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    ud.body.rotation.y += d * Math.min(1, dt * 12);
    const tm = now;
    ud.body.position.y = walking && h.grounded ? Math.abs(Math.sin(tm * 10)) * 0.07 : 0;
    if (ud.armL) ud.armL.rotation.z = carry ? -2.6 : (walking ? Math.sin(tm * 10) * 0.6 : 0);
    if (ud.armR) ud.armR.rotation.z = carry ? -2.6 : (walking ? -Math.sin(tm * 10) * 0.6 : 0);
    if (ud.tick) ud.tick(tm, walking);
    // 足もとの影（真下の地面に）
    blob.visible = Number.isFinite(v.groundY);
    if (blob.visible) {
      blob.position.set(h.x, v.groundY + 0.03, hz);
      blob.scale.setScalar(1 / (1 + Math.max(0, h.y - v.groundY) * 0.3));
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
    const gk = cand ? cand.kind + ':' + (cand.rot ? 1 : 0) : '';
    if (gk !== ghostKey) {
      if (ghost) scene.remove(ghost);
      ghost = cand ? makePieceObj(cand, true) : null;
      if (ghost) scene.add(ghost);
      ghostKey = gk;
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
    scene.remove(env); env = lk.makeEnv(L); scene.add(env);
    document.body.style.background = lk.bg;
  }

  function setLevel(nl) {
    L = nl;
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

  return { setLevel, setHistory, update, resize, applyLook, camYaw, resetCamera, waving: () => waveT !== null };
}
