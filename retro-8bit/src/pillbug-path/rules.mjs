// ダンゴムシのみち の決まり（ROM の game.s の walk_step と同じ。片方を変えたらもう片方も）。
// 面は 16×12 のます。ダンゴムシは前がふさがれたときだけ曲がり、曲がる向きは前の曲がりと逆（交替性転向反応）。
//   . 土・# 岩・L 葉っぱ・o ひなた（入ると丸くなって、やりなおし）・> v < ^ はじめの場所と向き
export const W = 16, H = 12;
export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // 0 右・1 下・2 左・3 上（右回り）
export const CELL = { soil: 0, rock: 1, leaf: 2, sun: 3, stone: 4 };

export function parse(stage) {
  const rows = stage.map;
  if (rows.length !== H || rows.some((r) => r.length !== W)) throw new Error(`${stage.name}: 16×12 ではない`);
  const g = new Uint8Array(W * H);
  let start = null;
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const i = y * W + x;
    if (ch === '#') g[i] = CELL.rock;
    else if (ch === 'L') g[i] = CELL.leaf;
    else if (ch === 'o') g[i] = CELL.sun;
    else if ('>v<^'.includes(ch)) { start = { x, y, h: '>v<^'.indexOf(ch) }; }
    else if (ch !== '.') throw new Error(`${stage.name}: 知らない字 ${ch}`);
  }));
  if (!start) throw new Error(`${stage.name}: はじめの場所がない`);
  return { g, start, stones: stage.stones };
}

const blocked = (g, x, y) => x < 0 || y < 0 || x >= W || y >= H || g[y * W + x] === CELL.rock || g[y * W + x] === CELL.stone;

// 歩かせる。stones = 置いた石のますの番号。返す: { result: 'clear'|'sun'|'loop', path: 通ったます, steps }
export function walk(map, stones = [], max = 600) {
  const g = map.g.slice();
  for (const i of stones) g[i] = CELL.stone;
  let { x, y, h } = map.start;
  let next = 0; // 0 = つぎは左へ・1 = 右へ（はじめは左）
  let leaves = g.reduce((a, c) => a + (c === CELL.leaf), 0);
  const seen = new Set(), path = [];
  for (let step = 0; step < max; step++) {
    const i = y * W + x;
    path.push(i);
    if (g[i] === CELL.leaf) { g[i] = CELL.soil; if (--leaves === 0) return { result: 'clear', path, steps: step }; }
    if (g[i] === CELL.sun) return { result: 'sun', path, steps: step };
    const key = `${i},${h},${next},${leaves}`;
    if (seen.has(key)) return { result: 'loop', path, steps: step };
    seen.add(key);
    if (blocked(g, x + DX[h], y + DY[h])) {
      const t = next ? 1 : 3; // 右 = +1・左 = +3
      const a = (h + t) & 3, b = (h + 4 - t) & 3;
      if (!blocked(g, x + DX[a], y + DY[a])) { h = a; next ^= 1; }
      else if (!blocked(g, x + DX[b], y + DY[b])) h = b; // 逆に曲がった＝つぎはまた同じ向き
      else h = (h + 2) & 3;
      if (blocked(g, x + DX[h], y + DY[h])) return { result: 'loop', path, steps: step }; // どこへも行けない
    }
    x += DX[h]; y += DY[h];
  }
  return { result: 'loop', path, steps: max };
}

// 石を先に置いておく解き方をぜんぶ探す（石は通り道のますにしか効かないので、通ったますだけに置いてみる）
// 返す: { min: いちばん少ない石の数, sols: [石のならび], count: 石の数ごとの解の数 }
export function solve(map, maxStones = map.stones) {
  const found = new Map();
  const free = (i) => map.g[i] === CELL.soil && i !== map.start.y * W + map.start.x;
  const tried = new Set();
  function dfs(stones) {
    const key = [...stones].sort((a, b) => a - b).join(',');
    if (tried.has(key)) return;
    tried.add(key);
    const r = walk(map, stones);
    if (r.result === 'clear') { if (!found.has(key)) found.set(key, stones.slice()); return; }
    if (stones.length >= maxStones) return;
    for (const i of new Set(r.path)) {
      if (!free(i) || stones.includes(i)) continue;
      dfs([...stones, i]);
    }
  }
  dfs([]);
  const sols = [...found.values()];
  const count = {};
  for (const s of sols) count[s.length] = (count[s.length] || 0) + 1;
  const min = sols.length ? Math.min(...sols.map((s) => s.length)) : -1;
  return { min, sols, count };
}
