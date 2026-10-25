// ほって つんで 3D: main.s などのうしろにつなぐ表と形（ビルドのときに作る）
//   sin の表・ブロックの模様（16×16・16 色 × 12 枚）と色の表・島（32×32×16）・面の 4 すみ・明るさ・ブロックの性質・字
// 模様はあそびラボで描いたもの（元のゲームの模様に寄せない: 色の組を変え、形も自分で決める）

const words = (label, arr, per = 8) => [label + ':', ...chunk(arr, per).map((r) => '  .word ' + r.join(', '))];
const halves = (label, arr, per = 16) => [label + ':', ...chunk(arr, per).map((r) => '  .half ' + r.map((v) => v & 0xffff).join(', '))];
const bytes = (label, arr, per = 32) => [label + ':', ...chunk(arr, per).map((r) => '  .byte ' + r.map((v) => v & 255).join(', '))];
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
const c15 = ([r, g, b]) => (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
const bgr = ([r, g, b]) => (b << 16) | (g << 8) | r;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---- ブロック ----
// 0 空気・1 草・2 土・3 石・4 砂・5 幹・6 葉・7 板・8 黒曜石・9 水・10 岩盤
// 火山の島（手本: 玄武岩の島。赤い火山の土・サンゴの白い砂・黒曜石）。元のゲームの定番の色と形にしないため
export const BLOCKS = ['air', 'grass', 'dirt', 'stone', 'sand', 'trunk', 'leaves', 'planks', 'obsidian', 'water', 'bedrock'];
// 模様の番号: 0 草の上・1 草の横・2 土・3 石・4 砂・5 幹の横・6 幹の切り口・7 葉・8 板・9 黒曜石・10 水・11 岩盤・12〜14 ひび（掘る途中）
const TEX_TOP = [0, 0, 2, 3, 4, 6, 7, 8, 9, 10, 11];
const TEX_SIDE = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
const TEX_BOT = [0, 2, 2, 3, 4, 6, 7, 8, 9, 10, 11];
const HARD = [0, 18, 16, 50, 12, 36, 6, 30, 60, 0, 255];   // 掘るのにかかるこま（255 は掘れない）
const DROP = [0, 2, 2, 3, 4, 5, 6, 7, 8, 0, 0];            // 掘ると手に入るもの（草 → 土）

// 模様: 16×16 の色の番号（0〜15）と、16 色の色の表を返す。明るさのゆれは ±10% ほどに（地面がざらつかないように）
function textures() {
  const T = [];
  const make = (pal, fn, seed) => { const r = rng(seed); const px = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px.push(Math.max(0, Math.min(pal.length - 1, fn(x, y, r)))); return { px, pal }; };
  // 草の上: 青みの緑に、少し濃い・少し明るい点（花は置かない: どのブロックも同じ所に出て網の目に見えるので）
  const grassPal = [[79, 138, 92], [72, 128, 86], [86, 148, 98], [64, 116, 80], [222, 214, 170]];
  T.push(make(grassPal, (x, y, r) => { const v = r(); return v < 0.22 ? 1 : v < 0.38 ? 2 : v < 0.44 ? 3 : 0; }, 11));
  // 草の横: 赤い火山の土の上 3 点に草の帯（たれない）。帯の下に細い根
  const dirtPal = [[138, 74, 50], [126, 66, 46], [150, 84, 58], [112, 58, 40], [172, 120, 92], ...grassPal.slice(0, 4), [96, 70, 48]];
  T.push(make(dirtPal, (x, y, r) => { if (y < 3) return 5 + (r() < 0.25 ? 1 : 0); if ((x === 3 || x === 9 || x === 13) && y - 3 < (x % 5) + 1) return 9; const v = r(); return v < 0.03 ? 4 : v < 0.24 ? 1 : v < 0.38 ? 2 : v < 0.44 ? 3 : 0; }, 12));
  // 土: 赤い火山の土に、白い軽石のつぶ
  T.push(make(dirtPal.slice(0, 5), (x, y, r) => { const v = r(); return v < 0.03 ? 4 : v < 0.24 ? 1 : v < 0.38 ? 2 : v < 0.44 ? 3 : 0; }, 13));
  // 石: 玄武岩の青い灰。横に長い気泡の穴と、たての柱の割れ目
  const stonePal = [[96, 104, 116], [88, 96, 108], [106, 114, 124], [62, 68, 80], [120, 128, 136]];
  T.push(make(stonePal, (x, y, r) => { if (x === 0 || (x === 8 && y > 5)) return 3; if ([[3, 3], [11, 2], [5, 10], [13, 12], [9, 7]].some(([cx, cy]) => y === cy && Math.abs(x - cx) <= 1)) return 3; const v = r(); return v < 0.04 ? 4 : v < 0.26 ? 1 : v < 0.42 ? 2 : 0; }, 14));
  // 砂: サンゴの白い砂に、小さな貝のかけら
  const sandPal = [[226, 218, 196], [214, 206, 184], [236, 228, 208], [196, 168, 156], [170, 150, 132]];
  T.push(make(sandPal, (x, y, r) => { const v = r(); return v < 0.025 ? 3 : v < 0.035 ? 4 : v < 0.25 ? 1 : v < 0.4 ? 2 : 0; }, 15));
  // 幹の横: ヤシのような幹。葉のつけ根のあとが V の字に互いちがいにならぶ
  const barkPal = [[132, 112, 84], [118, 100, 74], [146, 126, 96], [86, 72, 54]];
  T.push(make(barkPal, (x, y, r) => { const k = (y + Math.floor(Math.abs(x - 7.5) / 2)) % 5; return k === 0 ? 3 : k === 1 ? 2 : r() < 0.2 ? 1 : 0; }, 16));
  // 幹の切り口: 年輪でなく、すじの点がちらばる（ヤシの幹の中）
  const cutPal = [[188, 168, 126], [172, 150, 110], [120, 100, 74], ...barkPal];
  T.push(make(cutPal, (x, y, r) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 7) return 6; if (d > 6) return 3; return r() < 0.18 ? 2 : r() < 0.4 ? 1 : 0; }, 17));
  // 葉: ななめにのびる細い葉（羽のような葉の束）
  const leafPal = [[58, 112, 70], [66, 122, 76], [50, 100, 62], [80, 136, 84], [44, 84, 58]];   // 明るさの幅をせまく（離れて見ると大きな房に）
  T.push(make(leafPal, (x, y, r) => { const d = (x + y) % 6, e = (x - y + 32) % 6; if (d === 0) return 3; if (e === 0) return 4; return r() < 0.3 ? 2 : r() < 0.5 ? 1 : 0; }, 18));
  // 板: たての板 3 枚（板ごとに色がちがい、すきまは暗い）
  const plankPal = [[176, 138, 92], [164, 128, 84], [188, 150, 102], [112, 82, 54], [158, 120, 78]];
  T.push(make(plankPal, (x, y, r) => { if (x % 5 === 4) return 3; if ((x === 2 && y === 3) || (x === 7 && y === 11) || (x === 12 && y === 6)) return 3; const b = Math.floor(x / 5) % 3; return r() < 0.12 ? 4 : b; }, 19));
  // 黒曜石: 黒いガラスに、紫のつやの筋
  const obsPal = [[40, 36, 50], [32, 28, 42], [52, 46, 64], [96, 80, 128], [140, 124, 168]];
  T.push(make(obsPal, (x, y, r) => { const k = (x * 2 + y * 3) % 13; if (k === 0) return 4; if (k === 1 || k === 12) return 3; const v = r(); return v < 0.25 ? 1 : v < 0.4 ? 2 : 0; }, 20));
  // 水: 深い青緑に、うすい波
  const waterPal = [[46, 108, 140], [54, 120, 150], [40, 96, 128], [112, 170, 186]];
  T.push(make(waterPal, (x, y) => { const w = (y + Math.round(Math.sin(x * 0.7) * 1.5)) % 8; return w === 0 ? 3 : w < 3 ? 1 : w > 6 ? 2 : 0; }, 21));
  // 岩盤: 黒っぽい溶岩
  const bedPal = [[52, 46, 46], [40, 36, 36], [66, 58, 56], [28, 24, 24]];
  T.push(make(bedPal, (x, y, r) => Math.floor(r() * 4), 22));
  // ひび 3 段（0 は透明。掘っている面に重ねる）。1 点の太さのぎざぎざの線が、段ごとにのびて枝わかれする
  //   まわりにそろった形（風車や虫の足に見える形）にしないよう、向きも長さもばらばらに
  const crackPal = [null, [30, 24, 22], [120, 106, 96]];
  const cr = rng(41), lines = [];
  for (const [a, len] of [[0.5, 9], [2.6, 6], [4.1, 8], [5.5, 4]]) {
    const pts = []; let x = 7 + cr() * 2, y = 7 + cr() * 2, ang = a;
    for (let i = 0; i < len; i++) { ang += (cr() - 0.5) * 0.9; x += Math.cos(ang); y += Math.sin(ang); pts.push([Math.round(x), Math.round(y)]); }
    lines.push(pts);
  }
  for (let s = 1; s <= 3; s++) {
    const px = new Array(256).fill(0);
    lines.slice(0, s + 1).forEach((pts, li) => pts.slice(0, Math.ceil((pts.length * (s - (li > s - 1 ? 1 : 0) * 0.5)) / 3)).forEach(([x, y]) => {
      if (x < 0 || y < 0 || x > 15 || y > 15) return;
      px[y * 16 + x] = 1;
      if (y < 15 && !px[(y + 1) * 16 + x]) px[(y + 1) * 16 + x] = 2;   // 下に明るいふち（割れ目の段差）
    }));
    T.push({ px, pal: crackPal });
  }
  return T;
}

// ---- 島（32×32×16）。海の高さは 5 ----
export const W = 32, D = 32, H = 16, SEA = 5;
function island(seed = 7) {
  const r = rng(seed), world = new Uint8Array(W * D * H), at = (x, y, z) => (y * D + z) * W + x;
  // 8 ます・4 ますの格子のなめらかな山（値のノイズ）
  const grid = (n) => Array.from({ length: (W / n + 2) * (D / n + 2) }, () => r());
  const g8 = grid(8), g4 = grid(4);
  const noise = (g, n, x, z) => {
    const gx = x / n, gz = z / n, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, w = W / n + 2;
    const s = (t) => t * t * (3 - 2 * t), a = g[iz * w + ix], b = g[iz * w + ix + 1], c = g[(iz + 1) * w + ix], d = g[(iz + 1) * w + ix + 1];
    return (a + (b - a) * s(fx)) + ((c + (d - c) * s(fx)) - (a + (b - a) * s(fx))) * s(fz);
  };
  const height = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const dx = (x - 15.5) / 16, dz = (z - 15.5) / 16, edge = Math.max(0, Math.hypot(dx, dz) - 0.35) * 9;   // ふちほど低い（まわりは海）
    height.push(Math.max(1, Math.min(H - 4, Math.round(5 + noise(g8, 8, x, z) * 6 + noise(g4, 4, x, z) * 2.5 - edge))));
  }
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = height[z * W + x];
    for (let y = 0; y < H; y++) {
      let b = 0;
      if (y === 0) b = 10;
      else if (y < h - 3) b = r() < 0.06 && y < h - 4 ? 8 : 3;
      else if (y < h) b = h <= SEA + 1 ? 4 : 2;
      else if (y === h) b = h <= SEA + 1 ? 4 : 1;
      else if (y <= SEA) b = 9;
      world[at(x, y, z)] = b;
    }
  }
  // 木: まばらに（ほかの木と 3 ます以上はなす）。四角い葉の箱にしない:
  //   浜（砂）にはヤシ（細い幹のてっぺんから葉が十字とななめにのび、先がつながったまま 1 段たれる）、草の上には傘の木（2 段の平たい傘）
  const leaf = (x, y, z) => { if (x >= 0 && z >= 0 && x < W && z < D && y < H && world[at(x, y, z)] === 0) world[at(x, y, z)] = 6; };
  const trees = [];
  for (let k = 0; k < 400 && trees.length < 9; k++) {
    const x = 2 + Math.floor(r() * (W - 4)), z = 2 + Math.floor(r() * (D - 4)), h = height[z * W + x], g = world[at(x, h, z)];
    if ((g !== 1 && g !== 4) || h <= SEA || h + 7 >= H) continue;
    if (trees.some(([tx, tz]) => Math.abs(tx - x) < 4 && Math.abs(tz - z) < 4)) continue;
    trees.push([x, z]);
    if (g === 4) {
      const top = h + 5;
      for (let y = h + 1; y <= top; y++) world[at(x, y, z)] = 5;
      leaf(x, top + 1, z);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { leaf(x + dx, top, z + dz); leaf(x + dx * 2, top, z + dz * 2); leaf(x + dx * 3, top, z + dz * 3); leaf(x + dx * 3, top - 1, z + dz * 3); }
      for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { leaf(x + dx, top, z + dz); leaf(x + dx * 2, top, z + dz * 2); leaf(x + dx * 2, top - 1, z + dz * 2); }
    } else {
      const top = h + 4;
      for (let y = h + 1; y <= top; y++) world[at(x, y, z)] = 5;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dz);
        if (d <= 3.2 && d > 0) leaf(x + dx, top, z + dz);
        if (d <= 1.5) leaf(x + dx, top + 1, z + dz);
      }
      leaf(x, top + 1, z);
    }
  }
  // はじめに立つ場所: まん中に近い草の上で、まわり（前の 5 ます・高さ 4）に何もない開けた所
  let best = null;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = height[z * W + x];
    if (world[at(x, h, z)] !== 1) continue;
    let open = true;
    for (let dz = -5; dz <= 1 && open; dz++) for (let dx = -2; dx <= 2 && open; dx++) for (let y = h + 1; y <= h + 4; y++) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= W || zz >= D || world[at(xx, y, zz)] !== 0) { open = false; break; }
    }
    if (!open) continue;
    const d = Math.hypot(x - 16, z - 20);
    if (!best || d < best.d) best = { d, x, y: h + 1, z };
  }
  return { world, start: best };
}

// 面の向き: 0 +x・1 −x・2 +y（上）・3 −y（下）・4 +z・5 −z。4 すみは 左上・右上・左下・右下（外から見て。模様の上が上）
const CORNERS = [
  [[1, 1, 0], [1, 1, 1], [1, 0, 0], [1, 0, 1]],
  [[0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0]],
  [[0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]],
  [[0, 0, 1], [1, 0, 1], [0, 0, 0], [1, 0, 0]],
  [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1]],
  [[0, 1, 0], [1, 1, 0], [0, 0, 0], [1, 0, 0]],
];
const FOG = [216, 220, 203];   // 霧の色（少し黄みのある灰。空の地平線の色）
const SHADE = [0x54, 0x54, 0x80, 0x40, 0x68, 0x68];   // 面の向きの明るさ（0x80 で模様のまま）: 上 100・南北 80・東西 65・下 50%

// 5×7 の字（数と、少しの英字）
const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

export function gen() {
  const out = [];
  const tex = textures(), isl = island();
  out.push(`W = ${W}`, `D = ${D}`, `H = ${H}`, `SEA = ${SEA}`, `NTEX = ${tex.length}`, `FOG_R = ${FOG[0]}`, `FOG_G = ${FOG[1]}`, `FOG_B = ${FOG[2]}`);
  out.push(`START_X = ${isl.start.x * 256 + 128}`, `START_Y = ${isl.start.y * 256}`, `START_Z = ${isl.start.z * 256 + 128}`);
  out.push('.align 4', ...words('sintab', Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * Math.PI * 2) * 4096))));
  // 模様: VRAM の (640, 0) から横に 16 枚（1 枚 16 点＝4 ハーフワード）。4 ビットを 4 つずつ
  const TW = 64, rows = [];
  for (let y = 0; y < 16; y++) for (let hw = 0; hw < TW; hw++) {
    const t = tex[hw >> 2];
    let v = 0;
    if (t) for (let k = 0; k < 4; k++) v |= t.px[y * 16 + (hw & 3) * 4 + k] << (k * 4);
    rows.push(v);
  }
  out.push(...halves('texdata', rows));
  // 色の表: VRAM の (320, 240) から横に 1 枚 16 色ずつ（0x8000 は「半透明」の印。ここでは使わない。0 は透明なので、黒は 1 にずらす）
  const cl = [];
  for (const t of tex) for (let i = 0; i < 16; i++) { if (t.pal[i] === null) { cl.push(0); continue; } const c = t.pal[i] ? c15(t.pal[i]) : 0x0421; cl.push(c || 0x0421); }
  out.push(...halves('clutdata', cl));
  // 模様ごとの平均の色（遠くの一色に）
  out.push(...words('texavg', tex.map((t) => { const s = [0, 0, 0]; for (const p of t.px) for (let k = 0; k < 3; k++) s[k] += (t.pal[p] || [0, 0, 0])[k]; return bgr(s.map((v) => Math.round(v / 256))); })));
  // 近い面の色の倍率の表: 模様 × 向き × 霧の 17 段（t = 段 / 16）。ねらい = 平均 × 明るさ / 128 ×（1 − t）+ 霧の色 × t、倍率 = ねらい × 128 / 平均
  //   遠い面（平均 × 明るさを GTE の DPCS で霧へ）と同じ式なので、模様から一色へ切りかわっても色が飛ばない
  const avg = tex.map((t) => { const s = [0, 0, 0]; for (const p of t.px) for (let k = 0; k < 3; k++) s[k] += (t.pal[p] || [0, 0, 0])[k]; return s.map((v) => Math.max(1, v / 256)); });
  const mod = [];
  for (const a of avg) for (const sh of SHADE) for (let lv = 0; lv <= 16; lv++) {
    const t = lv / 16;
    mod.push(a.map((c, k) => Math.min(255, Math.round((((c * sh) / 128) * (1 - t) + FOG[k] * t) * 128 / c)) << (k * 8)).reduce((x, y) => x | y, 0));
  }
  out.push('.align 4', ...words('modtab', mod));
  out.push(...bytes('textop', TEX_TOP, 16), ...bytes('texside', TEX_SIDE, 16), ...bytes('texbot', TEX_BOT, 16));
  out.push(...bytes('hardness', HARD, 16), ...bytes('dropof', DROP, 16));
  out.push('.align 4', ...halves('corners', CORNERS.flat(2).map((v) => v * 256), 12));
  out.push(...bytes('shadeof', SHADE, 8));
  out.push(...bytes('font', Object.values(FONT).flatMap((g) => g.map((r) => parseInt(r, 2))), 14));
  out.push('.align 4', ...bytes('world0', [...isl.world], 32));
  out.push('.align 4');
  return out.join('\n') + '\n';
}
