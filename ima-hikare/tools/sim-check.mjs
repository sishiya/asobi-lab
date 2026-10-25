// いま光れ: 回路の決まり（js/sim.js）を node で確かめる。使い方: node ima-hikare/tools/sim-check.mjs
// 1) 組み立て（compile）と基準（interpret）が、どんな刻み方でも同じ状態になるか（でたらめな回路で）
// 2) ぐるぐる（時計を通らない戻り線）を見つけるか
// 3) 玉が「1周の長さの差」で1画面に差のこまだけ動くか
// 4) 段0〜2の答えが合格するか
// 5) 重さ（本物の 455×262 を1こまずつ）
import { T, PARTS, compile, interpret, makeState, hashState, analyze } from '../js/sim.js';
import { STAGES } from '../js/stages.js';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'NG  '} ${msg}`); if (!cond) fails++; };

// 小さなでたらめ（毎回同じ）
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];

function randomBoard() {
  const blocks = [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' }];
  const kinds = ['cmp', 'cmp', 'and', 'or', 'not', 'ball', 'ff', 'timer'];
  const n = 2 + Math.floor(rnd() * 6);
  for (let i = 0; i < n; i++) {
    const type = pick(kinds), id = type + i;
    const params = type === 'cmp' ? { n: Math.floor(rnd() * 57), w: 1 + Math.floor(rnd() * 4) }
      : type === 'ball' ? { dh: Math.floor(rnd() * 7) - 3, dv: Math.floor(rnd() * 7) - 3 }
      : type === 'timer' ? { wait: 1 + Math.floor(rnd() * 250), len: 4 + Math.floor(rnd() * 20) }
      : type === 'ff' ? { q: rnd() < .5 ? 1 : 0 } : undefined;
    blocks.push({ id, type, params });
  }
  const outs = [], ins = [];
  for (const b of blocks) {
    for (const p of PARTS[b.type].out) outs.push({ key: b.id + '.' + p, bus: (PARTS[b.type].bus || []).includes(p) });
    for (const p of PARTS[b.type].in) ins.push({ key: b.id + '.' + p, bus: (PARTS[b.type].busIn || []).includes(p) });
  }
  const wires = [];
  for (const i of ins) if (rnd() < 0.6) { const c = outs.filter(o => o.bus === i.bus); if (c.length) wires.push({ from: pick(c).key, to: i.key }); }
  return { blocks, wires };
}

// 1) 同じになるか
let same = 0, tried = 0, loops = 0;
for (let k = 0; k < 120; k++) {
  const b = randomBoard();
  if (analyze(b).errors.length) { loops++; continue; }
  const init = Object.fromEntries(b.blocks.filter(x => x.type === 'ball').map(x => [x.id, { hc: Math.floor(rnd() * 375), vc: Math.floor(rnd() * 262) }]));
  const total = T.PER_FRAME * 3 + Math.floor(rnd() * 5000);
  const A = makeState(b, init), B = makeState(b, init), C = makeState(b, init);
  interpret(b).step(A, total);
  compile(b).step(B, total);
  const cs = compile(b).step;
  for (let left = total; left > 0;) { const m = Math.min(left, rnd() < .3 ? 1 + Math.floor(rnd() * 3) : Math.floor(rnd() * 40000) + 1); cs(C, m); left -= m; }
  tried++;
  if (hashState(A) === hashState(B) && hashState(B) === hashState(C)) same++;
  else console.log('  ちがう回路:', JSON.stringify(b));
}
ok(same === tried, `組み立てと基準とばらばらの刻みが同じ: ${same}/${tried}（ぐるぐるで外した回路 ${loops}）`);

// 2) ぐるぐる
{
  const b = { blocks: [{ id: 'H', type: 'H' }, { id: 'scr', type: 'video' }, { id: 'n1', type: 'not' }, { id: 'a1', type: 'and' }],
    wires: [{ from: 'n1.out', to: 'a1.a' }, { from: 'a1.out', to: 'n1.a' }] };
  const e = analyze(b).errors;
  ok(e.some(x => x.type === 'loop'), 'NOT と AND の輪をぐるぐるとして見つける');
  const b2 = { blocks: [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' }, { id: 'f', type: 'ff' }, { id: 'n', type: 'not' }],
    wires: [{ from: 'f.q', to: 'n.a' }, { from: 'n.out', to: 'f.t' }, { from: 'V.VBLANK', to: 'f.clk' }] };
  ok(analyze(b2).errors.length === 0, 'フリップフロップを通る戻り線はつなげる');
}

// 3) 玉の動き
function ballX(s) { // 光った玉の左はし（見える所のこま）
  for (let y = 0; y < T.VIS_H; y++) for (let x = 0; x < T.VIS_W; x++) if (s.cur[y * T.VIS_W + x]) return { x, y };
  return null;
}
for (const dh of [0, 1, -1, 2, 3]) {
  const b = { blocks: [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' }, { id: 'ball', type: 'ball', params: { dh, dv: 0 } }],
    wires: [{ from: 'ball.out', to: 'scr.in0' }] };
  const s = makeState(b, { ball: { hc: 200, vc: 120 } }); const st = compile(b).step;
  st(s, T.PER_FRAME); const p0 = ballX(s);
  st(s, T.PER_FRAME * 10); const p1 = ballX(s);
  const moved = p0 && p1 ? p1.x - p0.x : NaN;
  ok(moved === -dh * 10, `横の差 ${dh}: 10画面で ${moved} こま（ねらい ${-dh * 10}。差が正なら1周が短く、左へ）`);
}
for (const dv of [0, 1, 3]) {
  const b = { blocks: [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' }, { id: 'ball', type: 'ball', params: { dh: 0, dv } }],
    wires: [{ from: 'ball.out', to: 'scr.in0' }] };
  const s = makeState(b, { ball: { hc: 200, vc: 120 } }); const st = compile(b).step;
  st(s, T.PER_FRAME * 2); const p0 = ballX(s);
  st(s, T.PER_FRAME * 10); const p1 = ballX(s);
  const moved = p0 && p1 ? p1.y - p0.y : NaN;
  ok(moved === -dv * 10, `縦の差 ${dv}: 10画面で ${moved} 行（ねらい ${-dv * 10}）`);
}

// 4) 段の答え
for (const st of STAGES) {
  const b = st.answer(); const s = makeState(b); compile(b).step(s, T.PER_FRAME + 1);
  const r = st.judge(s);
  ok(r.pass, `段${st.id}「${st.name}」の答えが合格（光ったこま ${r.all}、型紙の中 ${r.ok}）`);
  const b0 = st.board(); const s0 = makeState(b0); compile(b0).step(s0, T.PER_FRAME + 1);
  ok(!st.judge(s0).pass, `段${st.id} のはじめの台は合格しない`);
}

// 5) 重さ
{
  const blocks = [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' },
    { id: 'k1', type: 'cmp', params: { n: 32, w: 1 } }, { id: 'a1', type: 'and' }, { id: 'ball', type: 'ball', params: { dh: 1, dv: 2 } },
    { id: 'fv', type: 'ff' }, { id: 'pad', type: 'timer', params: { wait: 60, len: 15 } }, { id: 'k2', type: 'cmp', params: { n: 16, w: 1 } },
    { id: 'a2', type: 'and' }, { id: 'a3', type: 'and' }, { id: 'fh', type: 'ff' }, { id: 'o1', type: 'or' }];
  const wires = [{ from: 'H.count', to: 'k1.in' }, { from: 'k1.out', to: 'a1.a' }, { from: 'V.V4', to: 'a1.b' }, { from: 'a1.out', to: 'scr.in0' },
    { from: 'ball.out', to: 'scr.in1' }, { from: 'ball.v', to: 'fv.t' }, { from: 'V.VBLANK', to: 'fv.clk' }, { from: 'fv.q', to: 'ball.dirV' },
    { from: 'V.V256', to: 'pad.trig' }, { from: 'H.count', to: 'k2.in' }, { from: 'k2.out', to: 'a2.a' }, { from: 'pad.out', to: 'a2.b' },
    { from: 'a2.out', to: 'scr.in2' }, { from: 'a2.out', to: 'a3.a' }, { from: 'ball.out', to: 'a3.b' }, { from: 'a3.out', to: 'fh.set' },
    { from: 'H.HBLANK', to: 'o1.a' }, { from: 'o1.out', to: 'fh.reset' }, { from: 'fh.q', to: 'ball.dirH' }];
  const b = { blocks, wires };
  const s = makeState(b, { ball: { hc: 100, vc: 100 } }); const st = compile(b).step;
  st(s, T.PER_FRAME);
  const t0 = performance.now(); st(s, T.PER_FRAME * 60); const ms = (performance.now() - t0) / 60;
  ok(ms < 8, `壁打ちくらいの台（部品${blocks.length - 3}）で1画面 ${ms.toFixed(2)}ms（持ち時間16.7ms、計算は8ms以内がねらい）`);
}

console.log(fails ? `\nNG が ${fails} 個` : '\nぜんぶ ok');
process.exitCode = fails ? 1 : 0;
