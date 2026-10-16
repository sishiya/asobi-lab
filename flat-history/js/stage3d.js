// 3Dの舞台: ページの束・ガラスの棚・主人公・置いた形・世界線・描きかえの波
import * as THREE from 'three';
import { KINDS } from './level.js?v=8';
import { look, kindColor } from './look/index.js?v=8';
import { radialTexture } from './look/util.js?v=8';
import { S, drawSheet } from './sheet.js?v=8';
import { sectionsAt, DT } from './sim.js?v=8';

export const GAP = 1.0; // 1秒あたりの奥行き


function textSprite(text, size = 0.9, color = '#3d4c66') {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(size * 2, size, 1);
  return sp;
}

// 3Dの形の立体（手前へ進むほど slope だけ上がる、ななめの直方体）
export function pieceGeometry(kind) {
  const k = KINDS[kind];
  const g = new THREE.BoxGeometry(k.w, k.h, k.d * GAP, 1, 1, Math.max(1, k.d));
  g.translate(k.w / 2, k.h / 2, (k.d * GAP) / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + k.slope * (pos.getZ(i) / GAP));
  g.computeVertexNormals();
  return g;
}

export function createStage(canvas, L) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#dde7ee', 26, 70);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight('#ffffff', '#b4a38c', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 1.5);
  sun.position.set(-12, 30, 24); scene.add(sun);

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
    mesh.position.set(L.W / 2, L.H / 2, t * GAP);
    scene.add(mesh);
    sheets.push({ t, cv, g: cv.getContext('2d'), tex, mat, mesh, pending: false });
  }
  // ページのふち（全部まとめて1本の線）
  {
    const v = [];
    for (let t = 0; t <= L.T; t++) {
      const z = t * GAP, big = t % 5 === 0;
      if (!big) { v.push(0, L.H, z, L.W, L.H, z); continue; }
      v.push(0, 0, z, 0, L.H, z, 0, L.H, z, L.W, L.H, z, L.W, L.H, z, L.W, 0, z);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    var edgeLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#9fb0c4', transparent: true, opacity: 0.55 }));
    scene.add(edgeLines);
  }
  // いまのページ: 紙の地と光るふち
  const paper = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(paper);
  const frameGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, L.H, 0), new THREE.Vector3(L.W, L.H, 0), new THREE.Vector3(L.W, 0, 0)]);
  const frame = new THREE.LineLoop(frameGeo, new THREE.LineBasicMaterial({ color: '#f2a93b' }));
  scene.add(frame);

  // ---- ガラスの棚（主人公が歩く、2D世界のブロックの外） ----
  const shelfLen = L.T * GAP + 6;
  const shelf = new THREE.Mesh(new THREE.PlaneGeometry(L.W + 4, shelfLen),
    new THREE.MeshBasicMaterial({ color: '#cfe3f2', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  shelf.rotation.x = -Math.PI / 2;
  shelf.position.set(L.W / 2, L.H + 0.02, L.T * GAP / 2);
  scene.add(shelf);
  {
    const v = [];
    v.push(-2, L.H + 0.03, -3, -2, L.H + 0.03, L.T * GAP + 3, L.W + 2, L.H + 0.03, -3, L.W + 2, L.H + 0.03, L.T * GAP + 3);
    for (let t = 0; t <= L.T; t += 5) v.push(-2, L.H + 0.03, t * GAP, -0.6, L.H + 0.03, t * GAP);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    var shelfLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#7f9bb8', transparent: true, opacity: 0.8 }));
    scene.add(shelfLines);
    for (let t = 0; t <= L.T; t += 5) {
      const sp = textSprite(t + '秒', 0.8);
      sp.position.set(-3.2, L.H + 0.4, t * GAP);
      scene.add(sp);
    }
    const a = textSprite('← 昔', 0.9, '#6a7891'); a.position.set(L.W + 3.5, L.H + 0.4, -1.5); scene.add(a);
    const b = textSprite('未来 →', 0.9, '#6a7891'); b.position.set(L.W + 3.5, L.H + 0.4, L.T * GAP + 1.5); scene.add(b);
  }

  // ---- 主人公 ----
  let hero = look().makeHero();
  scene.add(hero);
  let env = look().makeEnv(L);
  scene.add(env);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(40,60,90,.38)', 'rgba(40,60,90,0)'), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  // 主人公から下の形へ下ろす糸
  const dropLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.85 }));
  scene.add(dropLine);

  // ---- 置いた形とゴースト ----
  const pieceObjs = new Map();
  const geoCache = {};
  const geoOf = (kind) => (geoCache[kind] ||= pieceGeometry(kind));
  function makePieceObj(kind, ghost) {
    const col = kindColor(kind);
    const grp = new THREE.Group();
    const fill = new THREE.Mesh(geoOf(kind), new THREE.MeshStandardMaterial({
      color: col, transparent: true, opacity: ghost ? 0.18 : 0.42, roughness: 0.25, metalness: 0.05, depthWrite: false,
    }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geoOf(kind)),
      new THREE.LineBasicMaterial({ color: ghost ? '#ffffff' : new THREE.Color(col).multiplyScalar(0.7), transparent: true, opacity: ghost ? 0.9 : 1 }));
    grp.add(fill, edges);
    grp.userData = { fill, edges };
    return grp;
  }
  let ghost = null, ghostKind = null;

  // ---- 世界線のリボン ----
  let ribbon = null, oldRibbons = [], endMark = null;
  const ribbonMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });

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

  function buildRibbon(h) {
    const pts = [];
    const fr = h.frames;
    for (let k = 0; k < fr.length; k += 2) {
      if (fr[k].st === 'dead') break;
      pts.push(new THREE.Vector3(fr[k].x, fr[k].y + 0.45, k * DT * GAP));
    }
    if (h.end.type !== 'goal' && h.end.type !== 'time') {
      const e = h.end;
      pts.push(new THREE.Vector3(e.x, Math.max(e.y, -2.5) + 0.45, e.t * GAP));
    }
    if (pts.length < 2) pts.push(pts[0].clone().add(new THREE.Vector3(0, 0, 0.01)));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const seg = pts.length * 2;
    const geo = new THREE.TubeGeometry(curve, seg, 0.075, 6, false);
    const gold = h.end.type === 'goal';
    const rc = look().ribbon || {};
    const m = new THREE.Mesh(geo, ribbonMat(gold ? (rc.gold || '#f5b82e') : (rc.line || '#3f7fd6'), 0.95));
    m.userData = { seg, tEnd: pts[pts.length - 1].z / GAP };
    return m;
  }

  function setEndMark(h) {
    if (endMark) { scene.remove(endMark); endMark = null; }
    const e = h.end;
    if (e.type === 'goal') {
      endMark = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: (look().ribbon || {}).gold || '#f5b82e' }));
      endMark.position.set(e.x, e.y + 0.5, e.t * GAP);
    } else if (e.type !== 'time') {
      endMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: (look().ribbon || {}).dead || '#e0453a' }));
      endMark.position.set(e.x, Math.max(e.y, -2.5) + 0.45, e.t * GAP);
    }
    if (endMark) { endMark.visible = false; scene.add(endMark); }
  }

  // 歴史を入れかえる。fromT から手前へ波を走らせる（animate=false なら一度に）
  function setHistory(h, ps, fromT, animate) {
    hist = h; pieces = ps;
    // 置いた形の立体
    const ids = new Set(ps.map((p) => p.id));
    for (const [id, o] of pieceObjs) if (!ids.has(id)) { scene.remove(o); pieceObjs.delete(id); }
    for (const p of ps) {
      if (pieceObjs.has(p.id)) continue;
      const o = makePieceObj(p.kind, false);
      o.position.set(p.x0, p.y0, p.t0 * GAP);
      o.userData.drop = animate ? 1 : 0;
      o.userData.y0 = p.y0;
      scene.add(o); pieceObjs.set(p.id, o);
    }
    // リボン
    if (ribbon) {
      ribbon.material = ribbonMat((look().ribbon || {}).old || '#d06a5a', 0.5);
      ribbon.userData.fade = 1;
      oldRibbons.push(ribbon);
    }
    ribbon = buildRibbon(h);
    scene.add(ribbon);
    setEndMark(h);
    if (!animate) {
      for (const sh of sheets) drawOne(sh);
      waveT = null;
      ribbon.geometry.setDrawRange(0, Infinity);
      if (endMark) endMark.visible = true;
      for (const r of oldRibbons) { scene.remove(r); r.geometry.dispose(); }
      oldRibbons = [];
      return;
    }
    for (const sh of sheets) if (sh.t >= Math.floor(fromT)) sh.pending = true;
    waveFrom = Math.floor(fromT);
    waveT = waveFrom - 0.0001 - 0.35; // 形が下りきってから走りだす
  }

  function ribbonRange(tNow) {
    const u = ribbon.userData;
    const frac = Math.max(0, Math.min(1, tNow / Math.max(0.01, u.tEnd)));
    ribbon.geometry.setDrawRange(0, Math.floor(frac * u.seg) * 6 * 6);
  }

  // ---- 毎フレーム ----
  const target = new THREE.Vector3(), camPos = new THREE.Vector3();
  let camInit = false;
  // マウス: 左ドラッグで回す、中・右ドラッグで床と平行に動かす、ホイールで寄る・引く、ダブルクリックでもとへ
  const ORBIT0 = { yaw: 0.33, pitch: 0.51, dist: 38.7 };
  const orbit = { ...ORBIT0 };
  const pan = new THREE.Vector3();
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 1) e.preventDefault(); // 中ボタンの自動スクロールを止める
    drag = { x: e.clientX, y: e.clientY, mode: e.button === 0 ? 'orbit' : 'pan' };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = drag.mode === 'pan' ? 'move' : 'grabbing';
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.mode === 'orbit') {
      orbit.yaw -= dx * 0.006;
      orbit.pitch = Math.max(0.04, Math.min(1.45, orbit.pitch + dy * 0.005));
    } else {
      // 床と平行に動かす: 横のドラッグ＝左右、縦のドラッグ＝奥・手前（つかんで引っぱる向き）
      const k = orbit.dist * 0.0018;
      const rx = Math.cos(orbit.yaw), rz = -Math.sin(orbit.yaw);   // 画面の右
      const fx = -Math.sin(orbit.yaw), fz = -Math.cos(orbit.yaw);  // 画面の奥（床の上）
      pan.x += -rx * dx * k + fx * dy * k;
      pan.z += -rz * dx * k + fz * dy * k;
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = () => { drag = null; canvas.style.cursor = ''; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(10, Math.min(95, orbit.dist * Math.pow(1.0015, e.deltaY))); }, { passive: false });
  canvas.addEventListener('dblclick', () => { Object.assign(orbit, ORBIT0); pan.set(0, 0, 0); });
  let ghostMsgOk = true;

  function update(dt, view) {
    const { heroX, heroT, heroY, focus, facing, cand, candOk, walking, reach } = view;
    // 波
    if (waveT !== null) {
      waveT += dt * 38;
      for (const sh of sheets) if (sh.pending && sh.t <= waveT) drawOne(sh);
      const wz = Math.max(waveFrom, waveT);
      wave.position.set(L.W / 2, L.H / 2, wz * GAP + 0.05);
      wave.material.opacity = waveT < waveFrom ? 0 : 0.35;
      ribbonRange(Math.max(waveFrom, waveT));
      if (waveT > L.T + 1) {
        waveT = null; wave.material.opacity = 0;
        ribbon.geometry.setDrawRange(0, Infinity);
        if (endMark) endMark.visible = true;
      }
    } else wave.material.opacity = Math.max(0, wave.material.opacity - dt * 2);
    for (let i = oldRibbons.length - 1; i >= 0; i--) {
      const r = oldRibbons[i];
      r.userData.fade -= dt * 0.45;
      r.material.opacity = Math.max(0, r.userData.fade * 0.5);
      if (r.userData.fade <= 0) { scene.remove(r); r.geometry.dispose(); oldRibbons.splice(i, 1); }
    }
    // 形が下りてくる
    for (const [, o] of pieceObjs) {
      if (o.userData.drop > 0) {
        o.userData.drop = Math.max(0, o.userData.drop - dt * 3.2);
        const u = o.userData.drop;
        o.position.y = o.userData.y0 + u * u * (L.H - 2);
      }
    }
    // ページの見え方: 昔は不透明な切り絵（霧で遠のく）、未来はうすく
    for (const sh of sheets) {
      const d = sh.t - heroT;
      const m = sh.mat;
      if (d > 0.5) {
        m.alphaTest = 0.01; m.depthWrite = false;
        m.opacity = Math.max(0.1, 0.5 - (d - 0.5) * 0.02);
        sh.mesh.visible = m.opacity > 0.01;
      } else {
        m.alphaTest = 0.5; m.depthWrite = true; m.opacity = 1; sh.mesh.visible = true;
      }
      const c = sh.t === focus ? 1 : Math.max(0.78, 0.97 - Math.abs(d) * 0.004);
      m.color.setRGB(c, c, c);
    }
    paper.position.set(L.W / 2, L.H / 2, focus * GAP - 0.03);
    frame.position.z = focus * GAP + 0.01;

    // 主人公
    hero.position.set(heroX, L.H + heroY, heroT * GAP);
    const ud = hero.userData;
    const want = Math.atan2(facing.z, facing.x);
    let cur = ud.body.rotation.y;
    const goal = -want;
    let diff = goal - cur; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    ud.body.rotation.y = cur + diff * Math.min(1, dt * 10);
    const tm = performance.now() / 1000;
    ud.body.position.y = walking ? Math.abs(Math.sin(tm * 9)) * 0.06 : Math.sin(tm * 2) * 0.02;
    if (ud.armL) ud.armL.rotation.z = walking ? Math.sin(tm * 9) * 0.5 : 0;
    if (ud.armR) ud.armR.rotation.z = reach > 0 ? -1.6 * reach : (walking ? -Math.sin(tm * 9) * 0.5 : 0);
    if (ud.orb && ud.orbMode !== 'hold') ud.orb.position.set(Math.cos(tm * 1.7) * 0.42, 1.05 + Math.sin(tm * 2.3) * 0.08, Math.sin(tm * 1.7) * 0.42);
    if (ud.tick) ud.tick(tm, walking, reach);
    blob.position.set(heroX, L.H + 0.04, heroT * GAP);
    blob.scale.setScalar(1 / (1 + heroY * 0.4));

    // ゴースト
    if (cand) {
      if (ghostKind !== cand.kind) {
        if (ghost) scene.remove(ghost);
        ghost = makePieceObj(cand.kind, true); ghostKind = cand.kind; scene.add(ghost);
      }
      ghost.visible = true;
      const y = cand.y0 === -Infinity ? 1 : cand.y0;
      ghost.position.set(cand.x0, y, cand.t0 * GAP);
      const col = candOk ? '#ffffff' : '#ff5a4a';
      ghost.userData.edges.material.color.set(col);
      ghost.userData.fill.material.color.set(candOk ? kindColor(cand.kind) : '#ff5a4a');
      const k = KINDS[cand.kind];
      const pos = dropLine.geometry.attributes.position;
      pos.setXYZ(0, heroX, L.H, heroT * GAP);
      pos.setXYZ(1, cand.x0 + k.w / 2, y + k.h, cand.t0 * GAP);
      pos.needsUpdate = true;
      dropLine.computeLineDistances();
      dropLine.visible = true;
    } else {
      if (ghost) ghost.visible = false;
      dropLine.visible = false;
    }

    // カメラ: 手前ななめ上から
    target.set(L.W / 2 + (heroX - L.W / 2) * 0.35, L.H * 0.5, heroT * GAP - 1).add(pan);
    const cp = Math.cos(orbit.pitch);
    camPos.set(target.x + Math.sin(orbit.yaw) * cp * orbit.dist, target.y + Math.sin(orbit.pitch) * orbit.dist, target.z + Math.cos(orbit.yaw) * cp * orbit.dist);
    if (!camInit) { camera.position.copy(camPos); camInit = true; }
    camera.position.lerp(camPos, Math.min(1, dt * (drag ? 14 : 5)));
    camera.lookAt(target.x, target.y, target.z);
    renderer.render(scene, camera);
  }

  // 見た目を入れかえる（舞台の色・主人公・台・置いた形・ページの絵）
  function applyLook() {
    const lk = look();
    scene.fog.color.set(lk.fog);
    scene.fog.near = lk.fogNear || 26; scene.fog.far = lk.fogFar || 70;
    hemi.color.set(lk.light.sky); hemi.groundColor.set(lk.light.ground); sun.color.set(lk.light.sun);
    edgeLines.material.color.set(lk.edge);
    paper.material.color.set(lk.paperTint);
    frame.material.color.set(lk.focus);
    shelf.material.color.set(lk.shelf);
    shelfLines.material.color.set(lk.shelfLine);
    scene.remove(hero); hero = lk.makeHero(); scene.add(hero);
    scene.remove(env); env = lk.makeEnv(L); scene.add(env);
    for (const [id, o] of pieceObjs) { scene.remove(o); pieceObjs.delete(id); }
    for (const p of pieces) {
      const o = makePieceObj(p.kind, false);
      o.position.set(p.x0, p.y0, p.t0 * GAP);
      o.userData.drop = 0; o.userData.y0 = p.y0;
      scene.add(o); pieceObjs.set(p.id, o);
    }
    if (ghost) { scene.remove(ghost); ghost = null; ghostKind = null; }
    if (hist) {
      for (const sh of sheets) drawOne(sh);
      if (ribbon) { scene.remove(ribbon); ribbon.geometry.dispose(); }
      ribbon = buildRibbon(hist); scene.add(ribbon);
      setEndMark(hist); if (endMark) endMark.visible = waveT === null;
    }
    document.body.style.background = lk.bg;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 52 : 36;
    camera.updateProjectionMatrix();
  }

  function setLevel(nl) {
    L = nl;
    for (const [id, o] of pieceObjs) { scene.remove(o); pieceObjs.delete(id); }
    if (ghost) { scene.remove(ghost); ghost = null; ghostKind = null; }
    pieces = [];
  }

  return { setLevel, setHistory, update, resize, applyLook, waving: () => waveT !== null };
}
