// 総当たりで部屋を調べる道具（検証のため）。js/rules.js をそのまま使う。
// 使い方: node tools/solve.mjs levels/t1.json [levels/t2.json ...]
// 出す表は PLAN.md 2章の「合格の目安」。上限: 深さ 40、状態 300万。
import { readFileSync } from 'node:fs';
import { loadLevel, legalActions, step, stateKey } from '../js/rules.js';

const MAX_DEPTH = 40, MAX_STATES = Number(process.env.MAXSTATES) || 3_000_000; // 上限は MAXSTATES で変えられる
const EXTRA = Number(process.env.EXTRA_DEPTH ?? 6); // ずらし・近道を調べる深さ（最短＋EXTRA）。r4 のような大きい部屋は 2 にする
const NOPRUNE = !!process.env.NOPRUNE; // 省く工夫を切って、答えが同じかくらべる
// ※地面をどこでも切れるので、状態は1手ごとに約2.5倍にふえる（t1 で深さ11まで約30万、12で約68万）。
//   そのため、最短を見つけたあとは「最短＋2手」までだけを調べる。

// 幅優先。状態は広げたら手放し、のこすのは親と手だけ（メモリを節約）。
// graph=true なら、調べた状態のつながりも残す（詰みを数えるため。状態が多いときは残さない）。
// つながりは、つぎ足していく Int32Array に「親の番号, 子の番号」で持つ（状態300万でもメモリに入るように。2026-10-19 検証）。
class EdgeList {
  constructor() { this.a = new Int32Array(1 << 20); this.n = 0; }
  push(from, to) {
    if (this.n + 2 > this.a.length) { const b = new Int32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    this.a[this.n++] = from; this.a[this.n++] = to;
  }
}
// 重複を省くキーは、stateKey の文字列を 64 ビットのハッシュ（16 文字）にちぢめて持つ（メモリ節約。300万状態で衝突の見こみは 100万分の1 ほど）
function hk(t) {
  const k = stateKey(t);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ k.length;
  for (let i = 0; i < k.length; i++) { const c = k.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
function bfs(start, opts = {}) {
  const seen = new Map([[hk(start), 0]]);
  const nodes = [{ s: start, won: start.won, depth: 0, parent: -1, act: null }];
  let won = [], capped = false;
  const edges = opts.graph ? new EdgeList() : null;
  const wonStates = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const st = n.s;
    n.s = null;
    if (n.won) { won.push(i); if (opts.keepWon) wonStates.set(i, st); if (opts.firstWin) break; continue; }
    if (n.depth >= (opts.maxDepth ?? MAX_DEPTH)) continue;
    const remain = (opts.maxDepth ?? MAX_DEPTH) - n.depth;
    for (const a of legalActions(st, opts)) {
      if (!NOPRUNE && a[0] === 'c' && !groundCutMatters(st, a, remain)) continue;
      const t = step(st, a);
      if (t.lost) continue; // かまれる手は外す
      const k = hk(t);
      let id = seen.get(k);
      if (id === undefined) {
        if (nodes.length >= MAX_STATES) { capped = true; continue; }
        id = nodes.length;
        seen.set(k, id);
        // いちばん深い段の状態は広げないので、勝ち以外は持たない（いちばん大きい段のメモリを省く）
        const last = n.depth + 1 >= (opts.maxDepth ?? MAX_DEPTH);
        nodes.push({ s: last && !t.won ? null : t, won: t.won, depth: n.depth + 1, parent: i, act: a });
      }
      if (edges) edges.push(i, id);
    }
  }
  if (!opts.keepSeen) seen.clear();
  return { nodes, won, capped, graph: !!edges, edges, seen, wonStates };
}

// 調べたつながりを逆にたどり、各状態から勝ちまでの最少の手数を出す（着けないものは -1）。
// 「最短＋2手」までの幅優先で調べたつながりなので、深さ d の状態から「最短＋2−d」手以内の勝ちは、かならずこの中にある。
function distToWin(res) {
  const N = res.nodes.length, E = res.edges, m = E.n / 2;
  const deg = new Int32Array(N + 1);
  for (let e = 0; e < m; e++) deg[E.a[2 * e + 1] + 1]++;
  for (let i = 0; i < N; i++) deg[i + 1] += deg[i];
  const rev = new Int32Array(m), fill = deg.slice(0, N);
  for (let e = 0; e < m; e++) rev[fill[E.a[2 * e + 1]]++] = E.a[2 * e];
  const dist = new Int32Array(N).fill(-1), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (const i of res.won) { dist[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const v = q[qh++];
    for (let j = deg[v]; j < deg[v + 1]; j++) { const u = rev[j]; if (dist[u] < 0) { dist[u] = dist[v] + 1; q[qt++] = u; } }
  }
  return dist;
}

// 省く工夫（答えは変わらない）: 地面を切っても、小人には得がない（道が減るだけ）。得があるのはムカデの道を変えるときだけ。
// ムカデの頭は1手に1マスしか進まないので、残りの手数より遠い地面は、着くまでにムカデに関係しない → その切りは省く。
// ムカデがいなければ、地面を切る手はぜんぶ省ける。
// ※2026-10-19 検証: NOPRUNE=1（省かない）とくらべた。r3・r3v で最短とずれの幅は同じ。解の数は省かないと 3→23・5→35 にふえたが、
//   ふえた分は「渡ったあとに橋を切る」だけのちがいだった（数え方の shape は床を見ないように直した）。
const DV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
function groundCutMatters(s, a, remain) {
  const d = DV[a[1]];
  const p = [s.player[0] + d[0], s.player[1] + d[1]];
  const onTop = s.rows.some(r => r.some(q => q[0] === p[0] && q[1] === p[1])) || s.cents.some(c => c.alive && c.body.some(q => q[0] === p[0] && q[1] === p[1]));
  if (onTop) return true; // 列・体を切る手は省かない
  return s.cents.some(c => c.alive && Math.abs(c.body[0][0] - p[0]) + Math.abs(c.body[0][1] - p[1]) <= remain + 1);
}

// 最短を、深さを少しずつ広げて探す（深さの上限があるほど、省く工夫がよく効く）
function findShortest(start) {
  let last;
  for (let lim = 8; lim <= MAX_DEPTH; lim += 4) {
    last = bfs(start, { firstWin: true, maxDepth: lim });
    if (last.won.length || last.capped) return last;
  }
  return last;
}

const pathTo = (nodes, i) => { const p = []; for (; nodes[i].parent >= 0; i = nodes[i].parent) p.push(nodes[i].act); return p.reverse(); };
const solvable3 = (s, opts = {}) => { const r = bfs(s, { maxDepth: MAX_DEPTH, ...opts, firstWin: true }); return r.won.length ? "ok" : r.capped ? "上限" : "NG"; };
const solvable = (s, opts = {}) => solvable3(s, opts) === "ok";

// 決まりを上書きして測る: node tools/solve.mjs levels/r4.json --rule deadEnd=turn
const ruleOverrides = {};
function check(file) {
  const level = JSON.parse(readFileSync(file, 'utf8'));
  level.rules = { ...(level.rules || {}), ...ruleOverrides };
  const start = loadLevel(level);
  const t0 = Date.now();
  // まず最短を見つけ、そのあとは「最短＋2手」までだけを調べる（地面をどこでも切れるので、深く調べると状態が爆発する）
  const first = findShortest(start);
  const out = { file };
  if (!first.won.length) { out.solvable = first.capped ? '（状態の上限に当たったので不明）' : false; out.states = first.nodes.length; out.capped = first.capped; return { out, ms: Date.now() - t0 }; }
  const shortest = first.nodes[first.won[0]].depth;
  const all = bfs(start, { graph: true, keepSeen: true, maxDepth: shortest + 2 });
  const d2w = distToWin(all);
  out.timeMain = Math.round((Date.now() - t0) / 1000) + 's';
  out.statesWithin2 = all.nodes.length;
  out.capped = all.capped;
  out.solvable = true;
  out.shortest = shortest;
  out.example = pathTo(all.nodes, all.won.find(i => all.nodes[i].depth === shortest)).join(' ');
  // 最短＋2手以内の解の数（待つ手を除き、着いたときの状態が同じものは1つ → 勝った状態の数）
  const noWait = bfs(start, { noWait: true, maxDepth: shortest + 2, keepWon: true });
  // 解の数: 解の手順を、切る・置くの「どこで何をしたか」の並びにして数える（歩く道のちがい・渡ったあとに橋を切るだけのちがいは同じ解。2026-10-19 検証）
  const signature = path => {
    let s = start; const ev = [];
    for (const a of path) {
      if (a[0] === 'c' || a[0] === 'p') {
        const d = DV[a[1]], p = [s.player[0] + d[0], s.player[1] + d[1]];
        const isBridgeCut = a[0] === 'c' && s.floor[p[1] * s.w + p[0]] === 2 && !s.rows.some(r => r.some(q => q[0] === p[0] && q[1] === p[1]));
        if (!isBridgeCut) ev.push(a[0] + p.join(',') + (a[0] === 'p' ? a.slice(1) : ''));
      }
      s = step(s, a);
    }
    return ev.join(' ');
  };
  out.solutionsWithin2 = new Set(noWait.won.filter(i => noWait.nodes[i].depth <= shortest + 2).map(i => signature(pathTo(noWait.nodes, i)))).size;
  out.solvableWithoutWait = noWait.won.length > 0;
  // 待つ手が要る解の割合: 待つ手ありで見つかる解の手順（切る・置くの並び）のうち、待つ手なしでは作れないもの
  {
    const nw = new Set(noWait.won.filter(i => noWait.nodes[i].depth <= shortest + 2).map(i => signature(pathTo(noWait.nodes, i))));
    const aw = new Set(all.won.map(i => signature(pathTo(all.nodes, i))));
    const need = [...aw].filter(x => !nw.has(x)).length;
    out.solutionsWithWait = aw.size;
    out.needWaitShare = aw.size ? Math.round(100 * need / aw.size) + '%' : '-';
  }
  // 詰み: 「最短＋2手」までに調べた状態のうち、その深さまでに勝ちに着けないもの（逆向きにたどる。目安）
  // 深さの上限で打ち切った状態は数えない（上限の手前の深さの状態だけ）。※「最短＋2手以内に着けない」状態の数で、ほんとうの詰みより多めに出る
  {
    const limit = shortest + 2;
    out.deadStates = all.nodes.reduce((n, nd, i) => n + (d2w[i] < 0 && nd.depth < limit ? 1 : 0), 0);
  }
  // 意図した解
  if (level.intended) {
    let s = start, pairs = 0, okPairs = 0, valid = true;
    for (const [k, a] of level.intended.entries()) {
      const acts = legalActions(s);
      if (!acts.includes(a)) { valid = false; break; }
      for (const b of acts) {
        if (b === a) continue;
        const t = step(s, b);
        pairs++;
        // 残りの手数で見る: k手目でずれたあと、最短−k−1＋2 手以内に着けるか
        // 調べたつながりにある状態なら、逆にたどった手数で見る（幅優先をやり直さない）。ない状態（省いた切り）だけ探し直す
        const budget = Math.max(0, shortest - k - 1 + 2);
        if (t.lost) continue;
        const id = all.seen.get(hk(t));
        const ok = t.won || (id !== undefined ? d2w[id] >= 0 && d2w[id] <= budget : solvable(t, { maxDepth: budget }));
        if (ok) okPairs++;
      }
      s = step(s, a);
      if (s.lost) { valid = false; break; }
    }
    out.intendedValid = valid && s.won;
    out.intendedLength = level.intended.length;
    out.slack = pairs ? Math.round(100 * okPairs / pairs) + '%' : '-';
    out.shortcut70 = shortest < 0.7 * level.intended.length;
  }
  // ずらした位置から
  if (level.shiftStarts) {
    out.shiftStarts = level.shiftStarts.map(p => {
      const s = loadLevel({ ...level, player: p });
      return `${p}:${solvable3(s, { maxDepth: shortest + EXTRA })}`;
    }).join(' ');
  }
  // 近道: ムカデを消しても解ける／橋を使わずに解ける
  if ((level.centipedes || []).length) out.solvableWithoutCentipedes = solvable3(loadLevel({ ...level, centipedes: [] }), { maxDepth: shortest + EXTRA });
  out.solvableWithoutBridge = solvable3(start, { noBridge: true, maxDepth: shortest + EXTRA });
  if (level.target) out.target = level.target;
  return { out, ms: Date.now() - t0 };
}

const args = process.argv.slice(2), files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rule') { const [k, v] = args[++i].split('='); ruleOverrides[k] = v === 'true' ? true : v === 'false' ? false : v; }
  else files.push(args[i]);
}
if (!files.length) { console.log('使い方: node tools/solve.mjs levels/<部屋>.json ...'); process.exit(1); }
for (const f of files) {
  const { out, ms } = check(f);
  console.log(`\n== ${f}  (${ms} ms)`);
  for (const k in out) if (k !== 'file') console.log(`  ${k.padEnd(26)} ${typeof out[k] === 'object' ? JSON.stringify(out[k]) : out[k]}`);
}
