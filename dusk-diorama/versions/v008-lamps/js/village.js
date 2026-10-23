// 村: 燃やせる物（柵・たる・木箱・荷車・薪・丸太・梁・灯の柱・戸・よろい戸・屋根・枯れ木）と、燃やせない物（礼拝堂・墓・石垣・塔）
// どの物も、下の塊に乗せる（塊が落ちると、いっしょに落ちる）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, hash, vnoise, fbm, H, PATH, POND, FIRE, HILL, pathDist, pathPoint, rimRadius } from './util.js';
import { chunkIdAt, hangRoots } from './island.js';
import { planarUV, texMat, lumpyRock, bladeGeo, roofTiles, chapelDetail } from './tex.js';

const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
function prism(w, h, d) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return planarUV(g, 2); }
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; return m; }
const B = (a, b, c, s = 2.2) => planarUV(new THREE.BoxGeometry(a, b, c), s);

export function buildVillage(root, isl, TX) {
  const chunks = isl.all, KEEP = [], burnables = [], keepers = [];
  const M = {
    plaster: texMat('#7d705e', TX.plaster, 2, { side: THREE.DoubleSide }), timber: texMat('#3e3026', TX.wood, 1.5), wood: texMat('#4d3d2f', TX.wood, 1.5),
    stone: texMat('#7a756c', TX.stone, 2.5), backing: new THREE.MeshStandardMaterial({ color: '#141112', roughness: 0.8, side: THREE.DoubleSide }), tile: texMat('#655b55', TX.tile, 1.5, { roughness: 0.75 }),
    iron: new THREE.MeshStandardMaterial({ color: '#1d1b1a', roughness: 0.55, metalness: 0.6 }), bark: texMat('#3b3029', TX.bark, 3), path: texMat('#4a443c', TX.rock, 2),
    rock: texMat('#5e5a52', TX.rock, 2, { flatShading: true }), brick: texMat('#ffffff', TX.rock, 2, { roughness: 0.92 }), dark: new THREE.MeshStandardMaterial({ color: '#050404', roughness: 1 }),
    win: new THREE.MeshStandardMaterial({ color: '#0d0907', roughness: 0.6 }),
  };
  // ふちの外にはみ出した物は、まん中へ少し寄せた所の塊に乗せる（まん中の塊にまわすと、岩のまわりに浮いて残った）
  const cid = (x, z) => { for (let k = 1; k > 0.3; k -= 0.03) { const id = chunkIdAt(x * k, z * k); if (id >= 0) return id; } return 0; };
  // 物を塊に乗せる。足もと（中心とまわり）にかかる塊を覚え、どれかが落ちたらいっしょに落ちる
  const onChunk = chunks.map(() => []);
  function place(obj, x, z, r = 0) {
    const ids = new Set([[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => cid(x + dx, z + dz)));
    const c = chunks[cid(x, z)];
    c.group.add(obj); obj.userData.chunks = ids;
    for (const i of ids) onChunk[i].push(obj);
    return c;
  }
  function burnable(obj, name, fuel, kind, extra = {}) {
    const b = Object.assign({ id: burnables.length, obj, name, fuel, kind, burned: false, carried: false }, extra);
    obj.traverse(o => { if (o.isMesh) o.userData.bid = b.id; });
    burnables.push(b); return b;
  }
  // 塊ごとにまとめて描く（草・れんが・岩など、数の多い物）
  const inst = new Map(), merged = new Map();
  function addInst(key, geo, mat, m, color, x, z) { const id = cid(x, z); const k = key + '|' + id; if (!inst.has(k)) inst.set(k, { geo, mat, id, list: [] }); inst.get(k).list.push([m.clone(), color && color.clone()]); }
  function addMerged(key, mat, geo, x, z) { const id = cid(x, z); const k = key + '|' + id; if (!merged.has(k)) merged.set(k, { mat, id, list: [] }); merged.get(k).list.push(geo.index ? geo.toNonIndexed() : geo); }

  // ── 小屋: 戸・よろい戸・屋根をはがしてくべられる。家そのものに火はつけない ──
  const houses = [];
  function cottage(x, z, ry, sc, seed) {
    const g = new THREE.Group(), R = rng(seed), w = 1.1, h = 0.75, d = 0.9, y0 = 0.08, T = M.timber;
    g.add(mesh(B(w + 0.08, 0.16, d + 0.08), M.stone, 0, 0.02, 0));
    g.add(mesh(B(w, h, d), M.plaster, 0, h / 2 + y0, 0));
    for (const bx of [-w / 2, w / 2]) for (const bz of [-d / 2, d / 2]) g.add(mesh(B(0.07, h, 0.07), T, bx, h / 2 + y0, bz));
    const f = d / 2 + 0.014, sd = w / 2 + 0.014;
    for (const zz of [f, -f]) {
      g.add(mesh(B(w + 0.04, 0.05, 0.035), T, 0, y0 + h - 0.02, zz)); g.add(mesh(B(w + 0.02, 0.045, 0.035), T, 0, y0 + 0.04, zz));
      for (const xx of [-w / 4, w / 4]) g.add(mesh(B(0.045, h, 0.035), T, xx, y0 + h / 2, zz));
      for (const s of [-1, 1]) { const dx = w / 4, dy = h * 0.5, L = Math.hypot(dx, dy); g.add(mesh(B(0.04, L, 0.03), T, s * (w / 2 - dx / 2), y0 + dy / 2, zz, 0, 0, Math.atan2(s * dx, dy))); }
    }
    for (const xx of [sd, -sd]) { g.add(mesh(B(0.035, 0.05, d + 0.04), T, xx, y0 + h - 0.02, 0)); g.add(mesh(B(0.035, h, 0.045), T, xx, y0 + h / 2, 0)); }
    // 煙突: 横の壁の外に、地面から立つ石積み（屋根に乗せると、屋根をはがしたとき浮いて見えた）
    { const ch = h + y0 + 0.95, cx = -(w / 2 + 0.1); g.add(mesh(B(0.2, ch, 0.24), M.stone, cx, ch / 2, -d * 0.15)); g.add(mesh(B(0.26, 0.05, 0.3), M.stone, cx, ch + 0.02, -d * 0.15)); }
    g.position.set(x, H(x, z) - 0.04, z); g.rotation.set(0, ry, (R() - .5) * 0.06); g.scale.setScalar(sc);
    const house = { name: '家', g, parts: [], roof: null, x, z };
    place(g, x, z, 0.6 * sc);
    // 窓（わくは残る。よろい戸ははがせる）
    const win = (px, py, pz, wry) => {
      const wg = new THREE.Group(); wg.position.set(px, py, pz); wg.rotation.y = wry; g.add(wg);
      wg.add(mesh(new THREE.PlaneGeometry(0.2, 0.22), M.win, 0, 0, -0.004));
      for (const [a, b2, c2, xx, yy, zz] of [[0.27, 0.035, 0.04, 0, 0.13, 0.01], [0.3, 0.04, 0.06, 0, -0.13, 0.02], [0.035, 0.26, 0.04, -0.12, 0, 0.01], [0.035, 0.26, 0.04, 0.12, 0, 0.01], [0.016, 0.22, 0.02, 0, 0, 0.01], [0.2, 0.016, 0.02, 0, 0.01, 0.01]]) wg.add(mesh(B(a, b2, c2), T, xx, yy, zz));
      for (const s of [-1, 1]) {
        const loose = s > 0 && R() < 0.6, sh = mesh(B(0.1, 0.25, 0.018), M.wood, s * 0.2 + (loose ? 0.005 : 0), loose ? -0.04 : 0, loose ? 0.035 : 0.02, 0, 0, loose ? -0.35 : 0);
        wg.add(sh); house.parts.push(burnable(sh, 'よろい戸', 2, 'dry', { house }));
      }
    };
    win(w * 0.22, h * 0.6, d / 2 + 0.01, 0); win(w / 2 + 0.01, h * 0.6, 0.05, Math.PI / 2);
    const door = new THREE.Group(); door.position.set(-w * 0.22, 0.29, d / 2 + 0.018); g.add(door);
    for (let i = 0; i < 3; i++) door.add(mesh(B(0.072, 0.42 - (i === 2 ? 0.03 : 0), 0.022), M.wood, -0.075 + i * 0.075, i === 2 ? -0.015 : 0, 0));
    door.add(mesh(B(0.3, 0.045, 0.04), T, 0, 0.23, 0.002));
    g.add(mesh(new THREE.PlaneGeometry(0.22, 0.42), M.dark, -w * 0.22, 0.29, d / 2 + 0.004)); // 戸のあとの暗がり
    house.parts.push(burnable(door, '戸', 6, 'dry', { house }));
    // 屋根: 下地＋板石＋棟。ひとまとまりではがす
    const roof = new THREE.Group(); roof.position.y = h + y0; roof.rotation.z = (R() - .5) * 0.08; g.add(roof);
    const hw = (w + 0.3) / 2, rh = 0.75, rd = d + 0.3;
    roof.add(mesh(prism(w + 0.26, 0.72, d + 0.26), M.backing, 0, 0, 0));
    const tl = []; roofTiles(tl, null, hw, rh, rd, R, 0.05, seed === 13 ? (zz, s, t) => s < 0 && zz > -0.25 && zz < 0.4 && t < 0.8 - Math.abs(zz) * 0.6 : null);
    const ti = new THREE.InstancedMesh(planarUV(new THREE.BoxGeometry(0.11, 0.014, 0.1), 4), M.tile, tl.length), c = new THREE.Color();
    tl.forEach((t, i) => { ti.setMatrixAt(i, t.m); c.setScalar(0.75 + t.c * 0.45); if (t.c > 0.9) c.set('#5a6a3a'); ti.setColorAt(i, c); });
    ti.castShadow = ti.receiveShadow = true; roof.add(ti);
    roof.add(mesh(B(0.06, 0.06, rd), M.timber, 0, rh + 0.01, 0, 0, 0, Math.PI / 4));
    house.roof = burnable(roof, '屋根', 22, 'beam', { house });
    houses.push(house); KEEP.push({ x, z, r: 1.0 * sc });
  }
  cottage(-3.5, 0.9, 0.55, 1.0, 11);
  cottage(-2.3, 3.5, 0.15, 0.9, 12);
  cottage(4.0, -1.2, -0.7, 0.95, 13);

  // ── 礼拝堂（燃やせない）。傾いた十字は外して、割れた鐘だけ ──
  let chapel;
  {
    const g = new THREE.Group(), cx = HILL.x - 0.2, cz = HILL.z - 0.3, W = 1.3, Hh = 1.15, D = 2.0;
    g.add(mesh(B(W + 0.1, 0.2, D + 0.1, 1.6), M.stone, 0, 0, 0)); g.add(mesh(B(W, Hh, D, 1.6), M.stone, 0, Hh / 2 + 0.1, 0));
    const roof = mesh(prism(W + 0.28, 1.0, D + 0.2), M.backing, 0, Hh + 0.1, 0); g.add(roof);
    g.add(mesh(B(0.75, 2.3, 0.7, 1.6), M.stone, 0, 1.15, D / 2 + 0.2));
    g.add(mesh(new THREE.ConeGeometry(0.56, 1.5, 4), M.tile, 0, 2.3 + 0.75, D / 2 + 0.2, 0, Math.PI / 4));
    g.add(mesh(new THREE.CircleGeometry(0.16, 20), M.win, 0, 1.7, D / 2 + 0.556));
    g.add(mesh(new THREE.PlaneGeometry(0.3, 0.55), M.dark, 0, 0.38, D / 2 + 0.556));
    for (const sz of [-0.5, 0.1]) for (const sx of [-1, 1]) g.add(mesh(new THREE.PlaneGeometry(0.14, 0.45), M.win, sx * (W / 2 + 0.012), 0.75, sz, 0, sx * Math.PI / 2));
    chapelDetail(g, W, Hh, D, { ...M, win: M.win });
    g.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.material === M.iron && o.position.y > 3.6) o.visible = false; }); // 十字を外す（ディレクター）
    const tl = []; roofTiles(tl, null, (W + 0.28) / 2, 1.0, D + 0.2, rng(17), 0.07, (zz, s, t) => s > 0 && zz < -0.15 && zz > -0.85 && t > 0.2 && t < 0.85);
    const ti = new THREE.InstancedMesh(planarUV(new THREE.BoxGeometry(0.11, 0.014, 0.1), 4), M.tile, tl.length), c = new THREE.Color();
    tl.forEach((t, i) => { ti.setMatrixAt(i, t.m); c.setScalar(0.75 + t.c * 0.45); ti.setColorAt(i, c); }); ti.castShadow = true; roof.add(ti);
    g.position.set(cx, H(cx, cz) - 0.05, cz); g.rotation.y = 0.12;
    place(g, cx, cz, 0.9); KEEP.push({ x: cx, z: cz, r: 1.6 });
    chapel = { name: '礼拝堂', g }; keepers.push(chapel);
  }

  // ── 墓（燃やせない） ──
  const graves = [];
  {
    const R = rng(21), x0 = -3.55, x1 = -1.9, z0 = -2.85, z1 = -1.05;
    for (let i = 0; i < 14; i++) {
      const x = x0 + 0.2 + R() * (x1 - x0 - 0.4), z = z0 + 0.2 + R() * (z1 - z0 - 0.4), kind = R(), parts = [];
      if (kind < 0.55) { const b = new THREE.BoxGeometry(0.17, 0.24, 0.06); b.translate(0, 0.1, 0); const t = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 12, 1, false, 0, Math.PI); t.rotateX(Math.PI / 2); t.rotateZ(Math.PI / 2); t.translate(0, 0.22, 0); parts.push(b, t); }
      else { const a = new THREE.BoxGeometry(0.1, 0.34, 0.1); a.translate(0, 0.15, 0); const c = new THREE.ConeGeometry(0.075, 0.12, 4); c.rotateY(Math.PI / 4); c.translate(0, 0.38, 0); parts.push(a, c); }
      const geo = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return planarUV(p.toNonIndexed(), 3); }));
      const broken = R() < 0.2, m = mesh(geo, M.stone, x, H(x, z) - 0.03, z, broken ? 1.3 : (R() - .5) * 0.4, 0.3 + (R() - .5) * 0.6, (R() - .5) * 0.35);
      m.scale.setScalar(0.8 + R() * 0.5); place(m, x, z); graves.push({ name: '墓', g: m }); KEEP.push({ x, z, r: 0.18 });
    }
    // ゆがんだ鉄柵
    const per = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.13);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (R() < 0.14) continue;
        const lean = R() < 0.2 ? (R() - .5) * 0.7 : (R() - .5) * 0.1, p = new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4); p.translate(0, 0.17, 0);
        const s = new THREE.ConeGeometry(0.016, 0.05, 4); s.translate(0, 0.36, 0);
        for (const q of [p, s]) { q.applyMatrix4(M4(x, H(x, z) - 0.02, z, lean, 0, lean * 0.5)); addMerged('iron', M.iron, q, x, z); }
      }
    };
    per(x0, z0, x1, z0); per(x1, z0, x1, z1); per(x0, z1, x0 + 0.6, z1); per(x0 + 1.0, z1, x1, z1); per(x0, z0, x0, z1);
  }

  // ── れんがの石垣とこわれた塔（燃やせない）。塔からつき出た梁はくべられる ──
  {
    const BR = { w: 0.3, h: 0.15, d: 0.2 }, geo = planarUV(new THREE.BoxGeometry(BR.w, BR.h, BR.d), 3), R = rng(5), c = new THREE.Color();
    const add = (x, y, z, ry, rx = 0, rz = 0) => { c.set('#57534c').lerp(new THREE.Color('#3c3b33'), R() * 0.3); if (R() < 0.15) c.lerp(new THREE.Color('#2f3a24'), 0.6);
      addInst('brick', geo, M.brick, M4(x, y, z, rx + (R() - .5) * 0.06, ry + (R() - .5) * 0.06, rz + (R() - .5) * 0.06), c, x, z); };
    const arc = (cx, cz, Rr, a0, a1, rows, seed) => { const n = Math.floor(Rr * (a1 - a0) / (BR.w + 0.01));
      for (let col = 0; col < n; col++) { const top = Math.floor(rows * (0.15 + 0.85 * Math.pow(vnoise(col * 0.28 + seed, seed * 1.7), 1.4)));
        for (let r = 0; r < top; r++) { const a = a0 + (col + (r % 2) * 0.5) / n * (a1 - a0), x = cx + Math.cos(a) * Rr, z = cz + Math.sin(a) * Rr; add(x, H(x, z) - 0.12 + r * (BR.h + 0.005) + BR.h / 2, z, -a - Math.PI / 2); }
        if (top < rows * 0.5 && hash(col, seed) > 0.6) { const a = a0 + col / n * (a1 - a0), d = 0.35 + hash(seed, col) * 0.5, x = cx + Math.cos(a) * (Rr + d * (hash(col, 3) > 0.5 ? 1 : -1)), z = cz + Math.sin(a) * (Rr + d); add(x, H(x, z) + 0.05, z, hash(col, 9) * 3); } } };
    arc(HILL.x, HILL.z, 3.0, Math.PI * 1.02, Math.PI * 1.42, 11, 3); arc(HILL.x, HILL.z, 3.0, Math.PI * 1.58, Math.PI * 1.98, 9, 8); arc(HILL.x, HILL.z, 3.0, Math.PI * 0.08, Math.PI * 0.2, 6, 14);
    const tx = 2.3, tz = -3.7, TR = 0.72, n = Math.floor(Math.PI * 2 * TR / (BR.w + 0.015)), base = H(tx, tz) - 0.15;
    for (let col = 0; col < n; col++) { const top = Math.floor(22 * (0.62 + 0.38 * vnoise(col * 0.5, 4.2)));
      for (let r = 0; r < top; r++) { const a = (col + (r % 2) * 0.5) / n * Math.PI * 2, facing = Math.cos(a - Math.PI * 0.5); if (facing > 0.93 && r > 13 && r < 18) continue; if (facing > 0.95 && r < 5) continue; add(tx + Math.cos(a) * TR, base + r * (BR.h + 0.004) + BR.h / 2, tz + Math.sin(a) * TR, -a - Math.PI / 2); } }
    for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, d = TR + 0.05 + Math.pow(R(), 1.6) * 1.1, x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d, pile = Math.max(0, 1 - (d - TR) / 0.9); add(x, H(x, z) + 0.04 + R() * 0.2 * pile, z, R() * 6, R() * 3, R() * 3); }
    KEEP.push({ x: tx, z: tz, r: TR + 0.3 }); for (let a = Math.PI * 1.02; a < Math.PI * 1.98; a += 0.08) KEEP.push({ x: HILL.x + Math.cos(a) * 3, z: HILL.z + Math.sin(a) * 3, r: 0.3 });
    for (const [a, y, tilt] of [[0.4, 1.9, 0.5], [2.2, 1.7, -0.4], [4.0, 2.0, 0.8]]) { const bm = mesh(B(0.06, 0.07, 1.1, 2.5), M.wood, tx + Math.cos(a) * 0.4, H(tx, tz) + y, tz + Math.sin(a) * 0.4, tilt, -a, 0.2); place(bm, tx, tz); burnable(bm, '梁', 8, 'beam'); }
    { const bm = mesh(B(0.07, 0.07, 1.6, 2.5), M.wood, tx - 0.9, H(tx - 0.9, tz + 0.4) + 0.55, tz + 0.4, 0.75, 1.2, 0); place(bm, tx - 0.9, tz + 0.4); burnable(bm, '梁', 10, 'beam'); }
  }

  // ── 枯れ木（生木なのでくすぶる。根が塊を支えている） ──
  const trees = [];
  function tree(x, z, seed, sc) {
    const R = rng(seed), geos = [];
    function br(p, dir, len, rad, d) {
      const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 7, 1); g.applyMatrix4(new THREE.Matrix4().compose(p.clone().addScaledVector(dir, len / 2), new THREE.Quaternion().setFromUnitVectors(UP, dir), ONE)); geos.push(g);
      const end = p.clone().addScaledVector(dir, len); if (d === 0) return;
      const nk = d >= 3 ? 2 : (R() < 0.5 ? 2 : 3);
      for (let i = 0; i < nk; i++) { const nd = dir.clone().applyAxisAngle(new THREE.Vector3(R() - .5, 0, R() - .5).normalize(), 0.35 + R() * 0.65); nd.y -= 0.12 * (4 - d) * R(); nd.normalize(); br(end.clone().addScaledVector(dir, -len * 0.04), nd, len * (0.6 + R() * 0.22), rad * 0.62, d - 1); }
    }
    br(new THREE.Vector3(0, -0.15, 0), new THREE.Vector3((R() - .5) * 0.35, 1, (R() - .5) * 0.35).normalize(), 1.0, 0.12, 5);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + R(), d = new THREE.Vector3(Math.cos(a), -0.35, Math.sin(a)).normalize(); const g = new THREE.CylinderGeometry(0.015, 0.07, 0.5, 4, 1); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.05, 0).addScaledVector(d, 0.22), new THREE.Quaternion().setFromUnitVectors(UP, d), ONE)); geos.push(g); }
    const m = mesh(mergeGeometries(geos), M.bark, x, H(x, z), z, 0, R() * 6, 0); m.scale.setScalar(sc);
    const c = place(m, x, z); c.root = true;
    const t = burnable(m, '枯れ木', 18, 'green', { rootChunk: c.id }); trees.push(t);
    hangRoots(c, R, 7, true);
    KEEP.push({ x, z, r: 0.3 });
  }
  tree(-4.6, -1.3, 31, 1.25); tree(4.7, 0.9, 32, 1.05); tree(-1.4, 4.6, 33, 0.95); tree(1.0, -1.7, 34, 0.8); tree(3.2, 4.3, 35, 0.75); tree(-4.2, 3.0, 36, 0.7);
  { const R = rng(7); for (const c of chunks) if (c.rim && !c.root && R() < 0.35) hangRoots(c, R, 2, false); }

  // ── 池 ──
  const water = mesh(new THREE.CircleGeometry(POND.r * 1.25, 48), new THREE.MeshStandardMaterial({ color: '#0a1016', roughness: 0.45 }), POND.x, H(POND.x, POND.z) + 0.34, POND.z, -Math.PI / 2);
  water.castShadow = false; place(water, POND.x, POND.z); KEEP.push({ x: POND.x, z: POND.z, r: POND.r * 1.35 });

  // ── たき火の台（石の輪と丸太）。火そのものは fx.js ──
  { const fy = H(FIRE.x, FIRE.z), R = rng(41);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; place(mesh(planarUV(lumpyRock(0.08 + R() * 0.03, i, vnoise), 3), M.rock, FIRE.x + Math.cos(a) * 0.34, fy + 0.03, FIRE.z + Math.sin(a) * 0.34), FIRE.x, FIRE.z); }
    KEEP.push({ x: FIRE.x, z: FIRE.z, r: 1.05 }); // 火のまわりは踏み固めた土（火トカゲが見えるように）
    for (const a of [2.2, 4.1]) { const x = FIRE.x + Math.cos(a) * 0.85, z = FIRE.z + Math.sin(a) * 0.85, l = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 9), M.bark, x, H(x, z) + 0.06, z, 0, -a, Math.PI / 2); place(l, x, z); burnable(l, '丸太のいす', 8, 'beam'); KEEP.push({ x, z, r: 0.35 }); }
  }

  // ── 小物（燃やせる）: 柵・たる・木箱・薪・荷車・灯の柱 ──
  { const R = rng(101);
    for (let i = 0; i < 3; i++) {
      const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.42), nx = -(bz - az) / L, nz = (bx - ax) / L, side = i % 2 ? -0.55 : 0.55;
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t + nx * side, z = az + (bz - az) * t + nz * side, y = H(x, z);
        if (R() < 0.15) { prev = null; continue; }
        const g = new THREE.Group(), lean = R() < 0.25 ? (R() - .5) * 0.9 : (R() - .5) * 0.15;
        g.position.set(x, y, z); g.add(mesh(B(0.05, 0.42 + R() * 0.1, 0.05, 2.5), M.wood, 0, 0.18, 0, lean, R(), lean * 0.4));
        if (prev && R() < 0.8) { const l = Math.hypot(x - prev[0], z - prev[1]), ry = -Math.atan2(z - prev[1], x - prev[0]); g.add(mesh(B(l * (R() < 0.25 ? 0.6 : 1.0), 0.035, 0.025, 2.5), M.wood, (prev[0] - x) / 2, 0.28 + (R() - .5) * 0.06, (prev[1] - z) / 2, 0, ry, (R() - .5) * (R() < 0.3 ? 0.5 : 0.06))); }
        place(g, x, z); burnable(g, '柵', 4, 'dry'); prev = [x, z];
      }
    }
    const barrel = (x, z, tip) => {
      const g0 = new THREE.CylinderGeometry(0.1, 0.1, 0.27, 14, 4), p = g0.attributes.position; for (let j = 0; j < p.count; j++) { const k = 1 + 0.13 * Math.cos(p.getY(j) / 0.135 * Math.PI / 2); p.setX(j, p.getX(j) * k); p.setZ(j, p.getZ(j) * k); } g0.computeVertexNormals();
      const g = new THREE.Group(); g.position.set(x, H(x, z) + (tip ? 0.1 : 0.13), z); g.rotation.set(tip ? Math.PI / 2 : 0, R(), 0);
      g.add(mesh(planarUV(g0, 3), M.wood)); for (const hy of [-0.08, 0.08]) g.add(mesh(new THREE.TorusGeometry(0.108, 0.007, 4, 18), M.iron, 0, hy, 0, Math.PI / 2));
      place(g, x, z); burnable(g, 'たる', 6, 'dry');
    };
    barrel(-2.75, 1.55, false); barrel(-2.55, 1.75, true); barrel(3.35, -0.55, false);
    for (const [x, z, s] of [[-2.85, 1.25, 0.2], [3.55, -0.4, 0.18], [3.45, -0.2, 0.14]]) { const m = mesh(B(s, s, s, 2.5), M.wood, x, H(x, z) + s / 2, z, 0, R(), (R() - .5) * 0.1); place(m, x, z); burnable(m, '木箱', 5, 'dry'); }
    { const wx = FIRE.x - 0.15, wz = FIRE.z + 0.78, g = new THREE.Group(); g.position.set(wx, H(wx, wz), wz); g.rotation.y = 0.6;
      for (let i = 0; i < 7; i++) { const r = i < 4 ? 0 : 1; g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 7), M.bark, (i % 4 - 1.5) * 0.09 + r * 0.045, 0.04 + r * 0.075, 0, Math.PI / 2)); }
      place(g, wx, wz); burnable(g, '薪', 12, 'beam'); }
    { const x = -1.9, z = 2.6, g = new THREE.Group(); g.position.set(x, H(x, z), z); g.rotation.y = 0.9;
      const add = (geo, mat, lx, ly, lz, rx = 0, ry = 0, rz = 0) => g.add(mesh(geo, mat, lx, ly, lz, rx, ry, rz));
      add(B(0.7, 0.04, 0.4), M.wood, 0, 0.2, 0, 0, 0, -0.22); add(B(0.7, 0.12, 0.03), M.wood, 0, 0.27, 0.19, 0, 0, -0.22); add(B(0.7, 0.12, 0.03), M.wood, 0, 0.27, -0.19, 0, 0, -0.22);
      add(B(0.6, 0.03, 0.03), M.wood, 0.55, 0.14, 0.12, 0, 0, -0.3); add(B(0.6, 0.03, 0.03), M.wood, 0.55, 0.14, -0.12, 0, 0, -0.3);
      const wheel = () => mergeGeometries([new THREE.TorusGeometry(0.16, 0.018, 5, 18), ...[0, 1, 2, 3].map(k => new THREE.BoxGeometry(0.012, 0.31, 0.012).rotateZ(k * Math.PI / 4))].map(p => { p.deleteAttribute('uv'); return planarUV(p.index ? p.toNonIndexed() : p, 3); }));
      add(wheel(), M.wood, -0.08, 0.16, 0.23); add(wheel(), M.wood, 0.3, 0.02, -0.45, Math.PI / 2 - 0.08, 0, 0.3);
      place(g, x, z, 0.3); burnable(g, '荷車', 14, 'beam'); }
    for (const u of [0.12, 0.42, 0.7]) { const p = pathPoint(u), side = u === 0.42 ? -1 : 1, x = p.x + side * 0.45, z = p.z + 0.05, g = new THREE.Group(); g.position.set(x, H(x, z), z);
      g.add(mesh(B(0.05, 0.85, 0.05), M.timber, 0, 0.42, 0)); g.add(mesh(B(0.28, 0.04, 0.04), M.timber, -side * 0.12, 0.83, 0)); g.add(mesh(B(0.1, 0.13, 0.1), M.iron, -side * 0.22, 0.72, 0));
      place(g, x, z); burnable(g, '灯の柱', 3, 'dry'); KEEP.push({ x, z, r: 0.15 }); }
  }

  // ── 踏み石・岩・草・光るきのこ（塊ごとにまとめる） ──
  { const R = rng(102);
    for (let i = 0; i < PATH.length - 1; i++) { const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], n = Math.floor(Math.hypot(bx - ax, bz - az) / 0.3);
      for (let k = 0; k < n; k++) { if (R() < 0.45) continue; const t = (k + R() * 0.5) / n, x = ax + (bx - ax) * t + (R() - .5) * 0.25, z = az + (bz - az) * t + (R() - .5) * 0.25, s = 0.09 + R() * 0.06;
        const g = new THREE.CylinderGeometry(s, s * 1.1, 0.04, 7), p = g.attributes.position; for (let j = 0; j < p.count; j++) p.setX(j, p.getX(j) * (0.8 + 0.4 * vnoise(j, i + k)));
        g.applyMatrix4(M4(x, H(x, z) - 0.012, z, (R() - .5) * 0.15, R() * 3, (R() - .5) * 0.15)); addMerged('path', M.path, planarUV(g, 3), x, z); } } }
  { const R = rng(61);
    for (let i = 0; i < 60; i++) { const a = R() * Math.PI * 2, rr = R() < 0.6 ? rimRadius(a) * (0.88 + R() * 0.1) : rimRadius(a) * R() * 0.85, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (KEEP.some(k => Math.hypot(x - k.x, z - k.z) < k.r) || pathDist(x, z) < 0.4) continue;
      const s = 0.07 + R() * R() * 0.3, g = lumpyRock(s, i * 1.3, vnoise); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, z) + s * 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(1, 0.6 + R() * 0.4, 1)));
      addMerged('rock', M.rock, planarUV(g, 2), x, z); } }
  const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), blade = bladeGeo();
  { const R = rng(71), c = new THREE.Color(); let n = 0;
    for (let tries = 0; tries < 60000 && n < 15000; tries++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * rimRadius(a) * 0.95, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (pathDist(x, z) < 0.3 || KEEP.some(k => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      if (fbm(x * 0.5 + 2, z * 0.5) < 0.35 && R() < 0.6) continue;
      const s = 0.6 + R() * 0.9; c.set('#3d4227').lerp(new THREE.Color('#6a5f3a'), R() * R());
      addInst('grass', blade, grassMat, new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, z) - 0.01, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - .5) * 0.6, R() * 6, (R() - .5) * 0.6)), new THREE.Vector3(1, 0.1 + R() * 0.24 * s, 1)), c, x, z); n++;
    }
    for (let i = 0; i < 2400; i++) { // ふちから垂れる草
      const a = R() * Math.PI * 2, r = rimRadius(a) * (0.97 + R() * 0.03), x = Math.cos(a) * r, z = Math.sin(a) * r, out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const dir = out.clone().multiplyScalar(0.5 + R() * 0.6).add(new THREE.Vector3((R() - .5) * 0.5, -0.4 - R() * 0.9, (R() - .5) * 0.5)).normalize();
      c.set('#3d4227').lerp(new THREE.Color('#6a5f3a'), R() * R());
      addInst('grass', blade, grassMat, new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, z) - 0.2, z), new THREE.Quaternion().setFromUnitVectors(UP, dir), new THREE.Vector3(1, 0.15 + R() * 0.4, 1)), c, x * 0.97, z * 0.97);
    }
  }

  // 塊ごとのまとまりを作る
  for (const { geo, mat, id, list } of inst.values()) { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(([m, c], i) => { im.setMatrixAt(i, m); if (c) im.setColorAt(i, c); }); im.castShadow = mat === M.brick; im.receiveShadow = true; if (mat === grassMat) im.userData.nopick = true; chunks[id].group.add(im); }
  for (const { mat, id, list } of merged.values()) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = m.receiveShadow = true; chunks[id].group.add(m); }

  // 流木: くっついたかけらに乗ってくる燃料（白っぽく乾いた、ねじれた木）
  const driftMat = texMat('#8a7d6c', TX.bark, 2);
  function addDriftwood(c, fuel) {
    const R = rng(c.id * 31 + burnables.length), a = R() * 6.28, d = c.rad * (0.15 + 0.45 * R()), x = c.cx + Math.cos(a) * d, z = c.cz + Math.sin(a) * d, g = new THREE.Group();
    g.position.set(x, H(x, z) + 0.05, z); g.rotation.y = R() * 6;
    const main = new THREE.CylinderGeometry(0.035, 0.055, 0.7, 7, 4), p = main.attributes.position; for (let j = 0; j < p.count; j++) p.setX(j, p.getX(j) + Math.sin(p.getY(j) * 6) * 0.02); main.computeVertexNormals();
    g.add(mesh(main, driftMat, 0, 0, 0, 0, 0, Math.PI / 2)); g.add(mesh(new THREE.CylinderGeometry(0.012, 0.025, 0.25, 5), driftMat, 0.12, 0.05, 0.06, 0.6, 0, Math.PI / 2 - 0.7));
    c.group.add(g); g.userData.chunks = new Set([c.id]); onChunk[c.id].push(g);
    return burnable(g, '流木', fuel, 'dry');
  }
  return { burnables, houses, chapel, graves, trees, keepers, onChunk, M, water, addDriftwood, driftMat };
}
