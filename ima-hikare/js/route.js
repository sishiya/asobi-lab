// いま光れ: 線の道を決める（基板の上の直角の道。部品・字・ほかの端子はなるべくよける）。
// 8こまの格子の上で、曲がる回数・ほかの線との重なり・部品の上を通る所を少なくする A*。線をつないだとき・割り付けが変わったときだけ計算する。
// 板のふちの外へは出ない。部品の上は「とても高い」だけで通れるので、道はかならず見つかる（検証 2026-10-25）。
const CELL = 8;
const COST = { step: 1, turn: 3, used: 5, part: 40 };

class Heap {
  constructor() { this.a = []; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// L: board.js の layout の結果。wires: [{from,to}]。かえすのは 線のキー → 点の列（論理の座標。道が見つからなかったときは pts.fallback = true）
export function routeAll(L, wires) {
  const W = Math.ceil(L.W / CELL), H = Math.ceil(L.H / CELL);
  const soft = new Uint8Array(W * H);       // 1: 部品・字・端子（高いが通れる）
  const hard = new Uint8Array(W * H);       // 1: 板のふち（通れない）
  const mark = (arr, x0, y0, x1, y1) => {
    for (let y = Math.max(0, Math.floor(y0 / CELL)); y <= Math.min(H - 1, Math.floor(y1 / CELL)); y++)
      for (let x = Math.max(0, Math.floor(x0 / CELL)); x <= Math.min(W - 1, Math.floor(x1 / CELL)); x++) arr[y * W + x] = 1;
  };
  mark(hard, 0, 0, L.W, 14); mark(hard, 0, L.H - 16, L.W, L.H); mark(hard, 0, 0, 14, L.H); mark(hard, L.W - 16, 0, L.W, L.H);
  for (const p of L.parts) {
    if (p.type === 'video') { mark(soft, p.x - 16, p.y - 50, p.x + 18, p.y + 50); continue; }
    if (p.type === 'lid') { mark(soft, p.x - 6, p.y - 13, p.x + 28, p.y + 13); continue; }
    mark(soft, p.x - p.w / 2 - 6, p.y - p.h / 2 - 22, p.x + p.w / 2 + 6, p.y + p.h / 2 + 6);
  }
  for (const [, q] of L.pads) mark(soft, q.x - 10, q.y - 10 - (q.dir === 'in' ? 12 : 0), q.x + 10, q.y + 10 + (q.dir === 'out' ? 14 : 0));

  const used = new Uint8Array(W * H);
  const out = new Map();
  const order = wires.map(w => ({ w, a: L.pads.get(w.from), b: L.pads.get(w.to) })).filter(x => x.a && x.b)
    .sort((p, q) => (Math.abs(p.a.x - p.b.x) + Math.abs(p.a.y - p.b.y)) - (Math.abs(q.a.x - q.b.x) + Math.abs(q.a.y - q.b.y)));
  const cell = (x, y) => [Math.max(0, Math.min(W - 1, Math.floor(x / CELL))), Math.max(0, Math.min(H - 1, Math.floor(y / CELL)))];
  // 端子から口の向きへ、部品にかからないマスに出るまで歩く（その道はこの線だけのもの）
  const walk = (q, d) => {
    let [x, y] = cell(q.x, q.y); const lane = [[x, y]];
    for (let k = 0; k < 8; k++) {
      const nx = x + d[0], ny = y + d[1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || hard[ny * W + nx]) break;
      x = nx; y = ny; lane.push([x, y]);
      if (k >= 1 && !soft[y * W + x]) break;
    }
    return lane;
  };
  for (const { w, a, b } of order) {
    const exit = a.dir === 'out' ? [0, 1] : a.dir === 'in' ? [0, -1] : [1, 0];
    const enter = b.dir === 'in' ? [0, -1] : b.dir === 'out' ? [0, 1] : [1, 0];
    const la = walk(a, exit), lb = walk(b, enter);
    const s = la[la.length - 1], e = lb[lb.length - 1];
    const path = astar(W, H, soft, hard, used, s, e);
    const cx = c => c[0] * CELL + CELL / 2, cy = c => c[1] * CELL + CELL / 2;
    let pts;
    if (path) {
      pts = [[a.x, a.y]];
      if (exit[0] === 0) pts.push([a.x, cy(s)]); else pts.push([cx(s), a.y]);
      for (const c of path) pts.push([cx(c), cy(c)]);
      if (enter[0] === 0) pts.push([b.x, cy(e)]); else pts.push([cx(e), b.y]);
      pts.push([b.x, b.y]);
      for (const c of path) used[c[1] * W + c[0]] = 1;
      pts = simplify(pts);
    } else {
      const ym = Math.min(L.H - 20, Math.max(a.y, b.y) + 20);
      pts = [[a.x, a.y], [a.x, ym], [b.x, ym], [b.x, b.y]]; pts.fallback = true;
    }
    out.set(w.from + '>' + w.to, pts);
  }
  return out;
}

function astar(W, H, soft, hard, used, s, e) {
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !hard[y * W + x];
  const N = W * H * 4, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
  const h = (x, y) => Math.abs(x - e[0]) + Math.abs(y - e[1]);
  const heap = new Heap();
  for (let d = 0; d < 4; d++) { const id = ((s[1] * W + s[0]) << 2) | d; g[id] = 0; heap.push([h(s[0], s[1]), id]); }
  let found = -1, guard = 0;
  while (heap.size && guard++ < 40000) {
    const [, id] = heap.pop();
    const d = id & 3, c = id >> 2, x = c % W, y = (c / W) | 0;
    if (x === e[0] && y === e[1]) { found = id; break; }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue;
      const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
      if (!ok(nx, ny)) continue;
      const k = ny * W + nx, nid = (k << 2) | nd;
      const end = nx === e[0] && ny === e[1];
      const cost = g[id] + COST.step + (nd !== d ? COST.turn : 0) + (used[k] ? COST.used : 0) + (soft[k] && !end ? COST.part : 0);
      if (cost < g[nid]) { g[nid] = cost; from[nid] = id; heap.push([cost + h(nx, ny), nid]); }
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let id = found; id >= 0; id = from[id]) { const c = id >> 2; path.push([c % W, (c / W) | 0]); }
  path.reverse();
  return path.filter((c, i) => i === 0 || c[0] !== path[i - 1][0] || c[1] !== path[i - 1][1]);
}

// 一直線の途中の点・同じ点を消す
function simplify(pts) {
  const r = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = r[r.length - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    if (ax === bx && ay === by) continue;
    if ((ax === bx && bx === cx) || (ay === by && by === cy)) continue;
    r.push(pts[i]);
  }
  r.push(pts[pts.length - 1]);
  return r;
}

// 道の検査（tools）: 部品の上を通るマスの数・板の外に出る点・代わりの線
export function routeReport(L, routes) {
  let fallback = 0, outside = 0, overPart = 0;
  for (const [, pts] of routes) {
    if (pts.fallback) fallback++;
    for (const [x, y] of pts) if (x < 10 || y < 10 || x > L.W - 10 || y > L.H - 10) outside++;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
      for (let k = 1; k < n; k++) {
        const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
        if (L.parts.some(p => p.w && p.type !== 'video' && Math.abs(x - p.x) < p.w / 2 && Math.abs(y - p.y) < p.h / 2)) { overPart++; break; }
      }
    }
  }
  return { fallback, outside, overPart };
}
