// ほって つんで 3D: main.s などのうしろにつなぐ表と形（ビルドのときに作る）
//   sin の表・ブロックの模様（16×16・16 色 × 12 枚）と色の表・島（32×32×16）・面の 4 すみ・明るさ・ブロックの性質・字
// 模様はあそびラボで描いたもの（元のゲームの模様に寄せない: 色の組を変え、形も自分で決める）

import { readFileSync } from 'node:fs';
import { encode } from '../../tools/adpcm.mjs';

const words = (label, arr, per = 8) => [label + ':', ...chunk(arr, per).map((r) => '  .word ' + r.join(', '))];
const halves = (label, arr, per = 16) => [label + ':', ...chunk(arr, per).map((r) => '  .half ' + r.map((v) => v & 0xffff).join(', '))];
const bytes = (label, arr, per = 32) => [label + ':', ...chunk(arr, per).map((r) => '  .byte ' + r.map((v) => v & 255).join(', '))];
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
const c15 = ([r, g, b]) => (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
const bgr = ([r, g, b]) => (b << 16) | (g << 8) | r;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---- ブロック ----
// 0 空気・1 草・2 土・3 石・4 砂・5 幹・6 葉・7 板・8 火山ガラス・9 水・10 岩盤・11 たき火・12 のろし（11・12 は作る物）
// 火山の島（手本: 玄武岩の島。赤い火山の土・サンゴの白い砂・火山ガラス）。元のゲームの定番の色と形にしないため
//   火山ガラス: 玄武岩の溶岩が海の水で急に冷えると、結晶になるひまがなく黒いガラスになる（黒曜石はシリカの多い溶岩からなので、玄武岩の島では名前を変えた。2026-10-25 ユーザー）
export const BLOCKS = ['air', 'grass', 'dirt', 'stone', 'sand', 'trunk', 'leaves', 'planks', 'glass', 'water', 'bedrock', 'fire', 'beacon'];
// 模様の番号: 0 草の上・1 草の横・2 土・3 石・4 砂・5 幹の横・6 幹の切り口・7 葉・8 板・9 火山ガラス・10 水・11 岩盤・12〜14 ひび（掘る途中）・15 たき火の上・16 たき火の横・17 のろしの横・18 のろしの上・19 火山ガラスの刃（作る帯の絵）・20 のろしの絵（煙のすじつき。腰袋と作る帯）
//   16 番からは 2 段目（VRAM の y 16〜31）
const TEX_TOP = [0, 0, 2, 3, 4, 6, 7, 8, 9, 10, 11, 15, 18];
const TEX_SIDE = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 16, 17, 19];   // 13 番＝刃（ブロックではない。作る帯の絵）
const TEX_BOT = [0, 2, 2, 3, 4, 6, 7, 8, 9, 10, 11, 16, 17];
const HARD = [0, 18, 16, 50, 12, 36, 6, 30, 60, 0, 255, 10, 20];   // 掘るのにかかるこま（255 は掘れない）
const DROP = [0, 2, 2, 3, 4, 5, 6, 7, 8, 0, 0, 11, 12];            // 掘ると手に入るもの（草 → 土）

// 作る物（SELECT の帯）: [できる物, できる数, 材料 1, 数, 材料 2, 数]。できる物 13 は火山ガラスの刃（掘るのが 2 倍の速さ。1 本だけ）
//   火山ガラスは割ると鋭いふちができ、昔から刃や矢じりに使われてきた（黒曜石と同じ）。のろしは生の葉をくべると白い煙が立つ
const RECIPES = [[7, 4, 5, 1, 0, 0], [11, 1, 7, 2, 3, 2], [13, 1, 7, 1, 8, 1], [12, 1, 7, 3, 6, 3]];

// 模様: 16×16 の色の番号（0〜15）と、16 色の色の表を返す。明るさのゆれは ±10% ほどに（地面がざらつかないように）
function textures() {
  const T = [];
  const make = (pal, fn, seed) => { const r = rng(seed); const px = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px.push(Math.max(0, Math.min(pal.length - 1, fn(x, y, r)))); return { px, pal }; };
  // 草の上: 少し黄みの緑に、少し濃い・少し明るい点（花は置かない: どのブロックも同じ所に出て網の目に見えるので）
  const grassPal = [[92, 140, 78], [84, 130, 72], [100, 150, 84], [76, 118, 66], [222, 214, 170]];
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
  // 葉: 葉の房の斑（明るい房・暗いすきま。並びがそろわないように）
  const leafPal = [[58, 112, 70], [66, 122, 76], [50, 100, 62], [80, 136, 84], [44, 84, 58]];   // 明るさの幅をせまく（離れて見ると大きな房に）
  const blobs = Array.from({ length: 7 }, (_, i) => [((i * 37) % 16) + 0.5, ((i * 23 + 5) % 16) + 0.5, i % 2 ? 3 : 4]);
  T.push(make(leafPal, (x, y, r) => { for (const [bx, by, c] of blobs) if (Math.hypot(((x - bx + 24) % 16) - 8, ((y - by + 24) % 16) - 8) < 2.1) return c; return r() < 0.3 ? 2 : r() < 0.5 ? 1 : 0; }, 18));
  // 板: たての板 3 枚（板ごとに色がちがい、すきまは暗い）
  const plankPal = [[176, 138, 92], [164, 128, 84], [188, 150, 102], [112, 82, 54], [158, 120, 78]];
  T.push(make(plankPal, (x, y, r) => { if (x % 5 === 4) return 3; if ((x === 2 && y === 3) || (x === 7 && y === 11) || (x === 12 && y === 6)) return 3; const b = Math.floor(x / 5) % 3; return r() < 0.12 ? 4 : b; }, 19));
  // 火山ガラス: 黒いガラスに、紫のつやの筋
  const obsPal = [[40, 36, 50], [32, 28, 42], [52, 46, 64], [96, 80, 128], [140, 124, 168]];
  T.push(make(obsPal, (x, y, r) => { const k = (x * 2 + y * 3) % 13; if (k === 0) return 4; if (k === 1 || k === 12) return 3; const v = r(); return v < 0.25 ? 1 : v < 0.4 ? 2 : 0; }, 20));
  // 水: 深い青緑に、うすい波
  const waterPal = [[46, 108, 140], [54, 120, 150], [40, 96, 128], [112, 170, 186]];
  T.push(make(waterPal, (x, y) => { const w = (y + Math.round(Math.sin(x * 0.7) * 1.5)) % 8; return w === 0 ? 3 : w < 3 ? 1 : w > 6 ? 2 : 0; }, 21));
  // 岩盤: 黒っぽい溶岩
  const bedPal = [[52, 46, 46], [40, 36, 36], [66, 58, 56], [28, 24, 24]];
  T.push(make(bedPal, (x, y, r) => Math.floor(r() * 4), 22));
  // ひび 3 段（0 は透明。掘っている面に重ねる）。1 点の太さのぎざぎざの線（ふちどりなし）が、段ごとにのびて枝わかれする
  //   まわりにそろった形（風車や虫の足に見える形）にしないよう、向きも長さもばらばらに
  const crackPal = [null, [8, 8, 8]];   // 半透明の形 0（半分ずつ）で、下の面を半分の明るさにする（黒くならない）   // 半透明の引き算で、下の面をこの分だけ暗くする（黒い線にしない）
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
    }));
    T.push({ px, pal: crackPal, semi: true });   // 色に半透明の印（0x8000）
  }
  // たき火の上: 灰の中に赤い炭（まん中ほど明るい）
  const firePal = [[60, 52, 48], [96, 40, 24], [200, 80, 30], [250, 170, 60], [255, 230, 150], [40, 34, 32]];
  T.push(make(firePal, (x, y, r) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 7) return 5; const v = r() + (6 - d) * 0.12; return v > 1.05 ? 4 : v > 0.85 ? 3 : v > 0.6 ? 2 : v > 0.4 ? 1 : 0; }, 23));
  // たき火の横: 石の輪の上に、ゆらぐ炎（下が明るい）
  T.push(make([...stonePal.slice(0, 4), [200, 80, 30], [250, 170, 60], [255, 230, 150], [40, 30, 28]], (x, y, r) => {
    if (y >= 11) return ((x + (y & 1) * 2) % 4 === 0) ? 3 : r() < 0.5 ? 1 : 0;
    const h = 11 - y, flame = 4 + Math.sin(x * 1.3) * 2.5 + r() * 1.5;
    if (h < flame) return h < flame * 0.35 ? 6 : h < flame * 0.7 ? 5 : 4;
    return 7;
  }, 24));
  // のろしの横: たばねた生の葉を、たての板のわくで囲う
  T.push(make([...leafPal, ...plankPal.slice(0, 4)], (x, y, r) => { if (x < 2 || x > 13) return 5 + (y % 5 === 4 ? 3 : 0); if (y % 6 === 0) return 6; return r() < 0.3 ? 2 : r() < 0.5 ? 1 : 0; }, 25));
  // のろしの上: 葉の束の切り口（まん中が暗い）
  T.push(make([...leafPal, ...plankPal.slice(0, 2)], (x, y, r) => { if (x < 2 || x > 13 || y < 2 || y > 13) return 5; const d = Math.hypot(x - 7.5, y - 7.5); return d < 2 ? 4 : r() < 0.4 ? 2 : 0; }, 26));
  // 火山ガラスの刃（作る帯の絵。0 は透明）: ななめの黒いガラスの刃に、木の柄
  T.push(make([null, [36, 32, 46], [96, 80, 128], [150, 136, 180], [140, 104, 64], [100, 72, 44]], (x, y) => {
    const u = x - y;
    if (x + y > 15 && x + y < 26 && Math.abs(u) <= 2) return x + y > 21 ? (Math.abs(u) <= 1 ? 4 : 5) : 0;
    if (x + y >= 3 && x + y <= 15 && Math.abs(u) <= 3 - (x + y < 6 ? 2 : 0)) return u === -1 ? 3 : u === 0 ? 2 : 1;
    return 0;
  }, 27));
  // のろしの絵（0 は透明）: 葉の束の箱の上に、白い煙のすじ
  T.push(make([null, ...leafPal.slice(0, 3), [112, 82, 54], [210, 210, 206], [170, 170, 168]], (x, y) => {
    if (y >= 6) { if (x < 3 || x > 12) return 0; if (x === 3 || x === 12 || y === 6 || y === 15) return 4; return ((x + y) % 3) + 1; }
    const cx = 7.5 + Math.sin(y * 1.1) * 1.6;
    return Math.abs(x - cx) < 1.2 ? (y < 3 ? 6 : 5) : 0;
  }, 28));
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
  //   浜（砂）にはヤシ（細い幹のてっぺんから葉が十字とななめにのび、先がつながったまま 1 段たれる）、草の上には傘の木（はば 5・7 の傘で、ふちが 1 段たれる）
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
      const top = h + 5;                                           // 傘は目より高く（たれたふちが目の前をふさがないように）
      for (let y = h + 1; y <= top; y++) world[at(x, y, z)] = 5;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dz);
        if (d <= 3.2 && d > 0) leaf(x + dx, top, z + dz);          // まん中の段（はば 7）
        if (d <= 2.3) leaf(x + dx, top + 1, z + dz);               // 上の段（はば 5）
        if (d > 2.5 && d <= 3.2) leaf(x + dx, top - 1, z + dz);    // ふちが 1 段たれる
      }
    }
  }
  // はじめに立つ場所: まん中に近い草の上で、まわり（前の 4 ます・はば 3・高さ 3）に何もない開けた所。
  //   頂上（のろしを置くと勝ち）より 3 段以上低い所から（登るのが旅になるように）
  const summit = Math.max(...height);
  let best = null;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = height[z * W + x];
    if (world[at(x, h, z)] !== 1 || h > summit - 3) continue;
    let open = true;
    for (let dz = -4; dz <= 1 && open; dz++) for (let dx = -1; dx <= 1 && open; dx++) for (let y = h + 1; y <= h + 3; y++) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= W || zz >= D || world[at(xx, y, zz)] !== 0) { open = false; break; }
    }
    if (!open) continue;
    const d = Math.hypot(x - 16, z - 20);
    if (!best || d < best.d) best = { d, x, y: h + 1, z };
  }
  return { world, start: best, summit };   // summit: のろしを置くと勝ちになる高さ（島のいちばん高い地面）
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
const AOFAC = [256, 204, 164, 130];   // すみの陰の段 → 明るさ（100・80・64・51%。/256）
const FOG = [216, 220, 203];   // 昼の霧の色（少し黄みのある灰。空の地平線の色）
// 昼と夜: 明るさの段 0（昼）〜 7（夜）。段ごとに 面の明るさ・霧の色・空の上の色・手前の海の色・霧のはじまりと長さ（奥行き）・見える広さ（ブロック）・霧の上限
//   夕方と明け方は同じ段を通る（赤い霧）。夜は霧を近く濃くして見える広さを 13 ブロックに（描く面が減る）
const LEVELS = [
  { light: 1.00, fog: FOG, top: [88, 160, 224], sea: [48, 104, 160], fog0: 1024, span: 4096, view: 22, cap: 2662 },
  { light: 0.92, fog: [222, 202, 172], top: [100, 142, 204], sea: [48, 92, 142] },
  { light: 0.82, fog: [214, 160, 118], top: [112, 112, 172], sea: [44, 72, 112] },
  { light: 0.70, fog: [168, 112, 100], top: [80, 72, 132], sea: [36, 52, 86] },
  { light: 0.58, fog: [108, 82, 98], top: [50, 46, 98], sea: [26, 36, 62] },
  { light: 0.48, fog: [60, 54, 82], top: [28, 28, 66], sea: [18, 26, 46] },
  { light: 0.40, fog: [34, 38, 64], top: [14, 18, 46], sea: [12, 20, 38] },
  { light: 0.36, fog: [22, 28, 50], top: [8, 12, 32], sea: [10, 16, 32], fog0: 256, span: 2560, view: 13, cap: 4096 },
];
for (let i = 1; i < 7; i++) { const a = LEVELS[0], b = LEVELS[7], k = i / 7; for (const f of ['fog0', 'span', 'view', 'cap']) LEVELS[i][f] = Math.round(a[f] + (b[f] - a[f]) * k); }
// 1 日 = 336 × 64 こま（約 6 分）: 朝 0 → 昼 → 夕方 20 → 夜 86 → 明け方 20。段は 64 こまごと
const DAYU = 336, DUSK = 210, NIGHT = 230, DAWN = 316;
const LVLTAB = Array.from({ length: DAYU }, (_, u) => u < DUSK ? 0 : u < NIGHT ? Math.round(((u - DUSK) / 20) * 7) : u < DAWN ? 7 : Math.round((1 - (u - DAWN) / 20) * 7));
const SHADE = [0x54, 0x54, 0x80, 0x40, 0x68, 0x68];   // 面の向きの明るさ（0x80 で模様のまま）: 上 100・南北 80・東西 65・下 50%

// 5×7 の字（数と、少しの英字）
const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],   // 10 番（作る帯の「A で作る」の札）
};

// ---- 音（SPU の ADPCM。音の RAM の SND_BASE から順に置く。場所は 8 バイト単位の数で asm へ） ----
const SND_BASE = 0x1010;
function readWav(url) {
  const b = readFileSync(url), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 12;
  while (o < b.length) {
    const id = b.toString('latin1', o, o + 4), len = dv.getUint32(o + 4, true);
    if (id === 'data') return Int16Array.from({ length: len / 2 }, (_, i) => dv.getInt16(o + 8 + i * 2, true));
    o += 8 + len + (len & 1);
  }
  throw new Error('wav の data がありません');
}
const synth = (n, f) => Int16Array.from({ length: n }, (_, i) => Math.max(-32767, Math.min(32767, Math.round(f(i)))));
// 白いノイズを 1 段の低い通し（a が小さいほどこもる）で。種で決まる
function noise(seed, a) { const r = rng(seed); let y = 0; return () => (y += a * ((r() * 2 - 1) - y)); }
function sounds() {
  const TAU = Math.PI * 2, R = 22050;
  const n1 = noise(51, 0.35), n2 = noise(52, 0.5), n3 = noise(53, 0.12), n4 = noise(54, 0.2);
  return [
    // 浜の環境音（Stable Audio。11025Hz。くり返し。sound/README.md）
    ['SHORE', readWav(new URL('./sound/shore.wav', import.meta.url)), { loop: true }],
    // 掘る: 短い「ざくっ」（こもったノイズが 70ms で消える）。高さはブロックで変える
    ['CRUNCH', synth(1600, (i) => { const t = i / R; return 26000 * Math.exp(-t * 55) * n1(); }), {}],
    // くずれた: ノイズの「ざざっ」と低い「ごと」（0.2 秒）
    ['POP', synth(4400, (i) => { const t = i / R; return 22000 * Math.exp(-t * 22) * n2() + 14000 * Math.exp(-t * 30) * Math.sin(TAU * (130 - 60 * t) * t); }), {}],
    // 置いた: 低い「とん」（120Hz のまるい音と、はじめの小さなこすれ）
    ['THUNK', synth(3300, (i) => { const t = i / R; return 24000 * Math.exp(-t * 32) * Math.sin(TAU * (150 - 80 * t) * t) + 5000 * Math.exp(-t * 400) * n2(); }), {}],
    // 足音: 砂をふむ、こもった短い音
    ['STEP', synth(1100, (i) => { const t = i / R; return 20000 * Math.exp(-t * 70) * n3(); }), {}],
    // 置けない: やわらかく下がる 2 つの音（660Hz → 440Hz）
    ['DENY', synth(4000, (i) => { const t = i / R, f = t < 0.08 ? 660 : 440, e = t < 0.08 ? Math.exp(-t * 20) : Math.exp(-(t - 0.08) * 25); return 9000 * e * Math.sin(TAU * f * t); }), {}],
    // できた: 木の小さな「ころん」2 つ（上がる）
    ['MADE', synth(8800, (i) => { const t = i / R, f = t < 0.1 ? 784 : 1175, e = t < 0.1 ? Math.exp(-t * 18) : Math.exp(-(t - 0.1) * 12); return 11000 * e * (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.76 * t)); }), {}],
    // 着地: 低い「どさっ」
    ['LAND', synth(3000, (i) => { const t = i / R; return 22000 * Math.exp(-t * 40) * (0.6 * Math.sin(TAU * (90 - 30 * t) * t) + 0.5 * n4()); }), {}],
  ];
}

export function gen() {
  const out = [];
  const tex = textures(), isl = island();
  out.push(`W = ${W}`, `D = ${D}`, `H = ${H}`, `SEA = ${SEA}`, `NTEX = ${tex.length}`, `FOG_R = ${FOG[0]}`, `FOG_G = ${FOG[1]}`, `FOG_B = ${FOG[2]}`);
  out.push(`START_X = ${isl.start.x * 256 + 128}`, `START_Y = ${isl.start.y * 256}`, `START_Z = ${isl.start.z * 256 + 128}`, `START_YAW = ${Math.round((Math.atan2(15.5 - isl.start.x, 15.5 - isl.start.z) / (Math.PI * 2)) * 256) & 255}`);   // はじめは島のまん中を向く（歩く向き = sin・cos）
  out.push('.align 4', ...words('sintab', Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * Math.PI * 2) * 4096))));
  // 模様: VRAM の (640, 0) から横に 16 枚（1 枚 16 点＝4 ハーフワード）。4 ビットを 4 つずつ
  //   2 段（y 0〜15 が 0〜15 番、y 16〜31 が 16〜31 番）
  const TW = 64, rows = [];
  for (let yy = 0; yy < 32; yy++) for (let hw = 0; hw < TW; hw++) {
    const y = yy & 15, t = tex[(yy >> 4) * 16 + (hw >> 2)];
    let v = 0;
    if (t) for (let k = 0; k < 4; k++) v |= t.px[y * 16 + (hw & 3) * 4 + k] << (k * 4);
    rows.push(v);
  }
  out.push(...halves('texdata', rows));
  // 色の表: VRAM の (320, 240) から横に 1 枚 16 色ずつ（0x8000 は「半透明」の印。ここでは使わない。0 は透明なので、黒は 1 にずらす）
  const cl = [];
  for (const t of tex) for (let i = 0; i < 16; i++) { if (t.pal[i] === null) { cl.push(0); continue; } const c = t.pal[i] ? c15(t.pal[i]) : 0x0421; cl.push((c || 0x0421) | (t.semi ? 0x8000 : 0)); }
  out.push(...halves('clutdata', cl));
  // 模様ごとの平均の色（遠くの一色に）
  out.push(...words('texavg', tex.map((t) => { const s = [0, 0, 0]; for (const p of t.px) for (let k = 0; k < 3; k++) s[k] += (t.pal[p] || [0, 0, 0])[k]; return bgr(s.map((v) => Math.round(v / 256))); })));
  // 近い面の色の倍率の表: 模様 × 向き × 霧の 17 段（t = 段 / 16）× すみの陰 4 段。ねらい = 平均 × 明るさ / 128 ×（1 − t）+ 霧の色 × t、倍率 = ねらい × 128 / 平均
  //   遠い面（平均 × 明るさを GTE の DPCS で霧へ）と同じ式なので、模様から一色へ切りかわっても色が飛ばない
  const avg = tex.map((t) => { const s = [0, 0, 0]; for (const p of t.px) for (let k = 0; k < 3; k++) s[k] += (t.pal[p] || [0, 0, 0])[k]; return s.map((v) => Math.max(1, v / 256)); });
  //   昼と夜の段ごとに 1 枚（明るさ × 霧の色）。段 L の表は modtab + L × MODSZ
  const mod = [];
  for (const L of LEVELS) for (const a of avg) for (const sh of SHADE) for (let lv = 0; lv <= 16; lv++) {
    const t = lv / 16;
    for (const f of AOFAC) mod.push(a.map((c, k) => Math.min(255, Math.round(((((c * sh * L.light) / 128) * (1 - t) + L.fog[k] * t) * 128 / c) * f / 256)) << (k * 8)).reduce((x, y) => x | y, 0));
  }
  const MODSZ = (mod.length / LEVELS.length) * 4;
  out.push(`MODSZ = ${MODSZ}`, `DAYU = ${DAYU}`, `DAWNT = ${DAWN * 64}`);
  out.push('.align 4', ...words('modtab', mod));
  // 段ごとの数（12 語）: 表の場所・霧のはじまり・霧の倍率（4096 × 256 / 長さ）・明るさ（/256）・見える広さの 2 乗・霧の上限・霧の色・空の上・手前の海
  out.push('lighttab:', ...LEVELS.map((L, i) => `  .word modtab + ${i * MODSZ}, ${L.fog0}, ${Math.round((4096 * 256) / L.span)}, ${Math.round(L.light * 256)}, ${L.view * L.view}, ${L.cap}, ${bgr(L.fog)}, ${bgr(L.top)}, ${bgr(L.sea)}, 0, 0, 0`));
  out.push(...bytes('lvltab', LVLTAB, 32), '.align 4');
  out.push(...bytes('textop', TEX_TOP, 16), ...bytes('texside', TEX_SIDE, 16), ...bytes('texbot', TEX_BOT, 16));
  out.push(...bytes('hardness', HARD, 16), ...bytes('dropof', DROP, 16));
  out.push(...bytes('icontab', TEX_SIDE.map((t, i) => (i === 12 ? 20 : t)), 16));   // 腰袋と作る帯の絵（のろしだけ煙つきの絵）
  out.push(...bytes('recipes', RECIPES.flatMap((r) => [...r, 0, 0]), 32), `SUMMIT = ${isl.summit}`);
  out.push('.align 4', ...halves('corners', CORNERS.flat(2).map((v) => v * 256), 12));
  out.push(...bytes('shadeof', SHADE, 8));
  // すみの陰: 向き × 4 すみ × 3 つ（横・たて・ななめ）の (dx, dy, dz)。面の前のます＋すみの側へ 1 つずつ
  const NORM = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const ao = [];
  CORNERS.forEach((cs, dir) => {
    const n = NORM[dir], axes = [0, 1, 2].filter((k) => n[k] === 0);
    for (const c of cs) {
      const s = axes.map((k) => c[k] * 2 - 1);
      const off = (us, vs) => { const o = [...n]; o[axes[0]] += us; o[axes[1]] += vs; return o; };
      ao.push(...off(s[0], 0), ...off(0, s[1]), ...off(s[0], s[1]));
    }
  });
  out.push(...bytes('aotab', ao, 36));
  // 模様の uv: 模様 × 裏返し 4 × (TL, TR, BL, BR)。TL に CLUT（(320 + 模様 × 16, 240)）、TR にページ（10）
  const uv = [];
  tex.forEach((_, ti) => { for (let v = 0; v < 4; v++) {
    const u0 = (ti & 15) * 16, v0 = (ti >> 4) * 16, ul = v & 1 ? u0 + 15 : u0, ur = v & 1 ? u0 : u0 + 15, vt = v0 + (v & 2 ? 15 : 0), vb = v0 + (v & 2 ? 0 : 15);
    uv.push((ul | (vt << 8) | ((((240 << 6) | (20 + ti)) << 16))) >>> 0, (ur | (vt << 8) | (10 << 16)) >>> 0, ul | (vb << 8), ur | (vb << 8));
  } });
  out.push('.align 4', ...words('uvtab', uv));
  out.push(...bytes('aolut', [0, 1, 1, 3, 1, 2, 2, 3], 8));   // 印 → 段（横とたての両方なら 3）
  out.push(...bytes('font', Object.values(FONT).flatMap((g) => g.map((r) => parseInt(r, 2))), 14));
  // 音: ADPCM を並べて sndbank に（64 バイトの倍数にそろえる＝DMA のかたまり）。S_〜 は音の RAM の場所（8 バイト単位）
  let addr = SND_BASE; const blobs = [];
  for (const [name, pcm, o] of sounds()) {
    const enc = encode(pcm, o);
    out.push(`S_${name} = ${addr / 8}`);
    blobs.push(enc); addr += enc.length;
  }
  let total = blobs.reduce((a, b) => a + b.length, 0);
  const pad = (64 - (total % 64)) % 64; total += pad;
  out.push(`SNDSIZE = ${total}`, `SNDBASE = ${SND_BASE / 8}`);
  const all = new Uint8Array(total); let so = 0; for (const b of blobs) { all.set(b, so); so += b.length; }
  if (SND_BASE + total > 0x80000) throw new Error('音が多すぎます');
  out.push('.align 64', ...bytes('sndbank', [...all], 32));
  out.push('.align 4', ...bytes('world0', [...isl.world], 32));
  out.push('.align 4');
  return out.join('\n') + '\n';
}
