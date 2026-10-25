// いま光れ: 段がピーキーでないかを測る。使い方: node ima-hikare/tools/stage-measure.mjs [--quick]
// A) 段0〜2: つまみの全目盛りで合格する割合・つながった幅（目安 15%以上かつ幅3目盛り以上。PLAN 2章）
// B) 段0〜2: つなぎ方の総当たり（線の上限まで）で、合格する配線と、ねらいとちがう配線（意図しない解）
// C) 壁のはね返り: 反転型（本物）の2つのつなぎ方で、玉が閉じこめられる率・抜ける率（PLAN 3章の1）
import { T, PARTS, compile, makeState, analyze } from '../js/sim.js';
import { STAGES, VIS } from '../js/stages.js';

const quick = process.argv.includes('--quick');
const frame = b => { const c = compile(b); if (c.errors.length) return null; const s = makeState(b); c.step(s, T.PER_FRAME + 1); return s; };
const pct = (a, b) => (100 * a / b).toFixed(1) + '%';

function runs(arr) { let best = 0, cur = 0; for (const x of arr) { cur = x ? cur + 1 : 0; best = Math.max(best, cur); } return best; }

// ---- A) つまみ ----
console.log('== A) つまみの全目盛り（ねらいの配線で） ==');
{
  const st = STAGES[1];
  const res = [];
  for (let n = 0; n <= VIS.c1; n++) { const b = st.answer(); b.blocks.find(x => x.id === 'k1').params.n = n; res.push(st.judge(frame(b)).pass); }
  const vis = res.slice(VIS.c0);
  console.log(`段1 縦の線: 見えるマス ${vis.length} 目盛りのうち合格 ${vis.filter(Boolean).length}（${pct(vis.filter(Boolean).length, vis.length)}）、つながった幅 ${runs(vis)}`);
}
{
  const st = STAGES[2];
  let pass = 0, all = 0; const rowsOk = [], colsOk = [];
  for (let c = VIS.c0; c <= VIS.c1; c++) {
    for (let r = VIS.r0; r <= VIS.r1; r++) {
      const b = st.answer(); b.blocks.find(x => x.id === 'k1').params.n = c; b.blocks.find(x => x.id === 'k2').params.n = r;
      const p = st.judge(frame(b)).pass; all++; if (p) pass++;
      if (r === st.target.r) colsOk.push(p);
      if (c === st.target.c) rowsOk.push(p);
    }
  }
  console.log(`段2 点: 横×縦 ${all} 通りのうち合格 ${pass}（${pct(pass, all)}）。横のつまみだけ見ると幅 ${runs(colsOk)}/${colsOk.length}（${pct(colsOk.filter(Boolean).length, colsOk.length)}）、縦だけ ${runs(rowsOk)}/${rowsOk.length}（${pct(rowsOk.filter(Boolean).length, rowsOk.length)}）`);
  console.log('  → 横と縦を別々に合わせるので、それぞれのつまみの割合で見る（2つの積は「でたらめに置いて当たる」割合）');
}

// ---- B) つなぎ方の総当たり ----
console.log('\n== B) つなぎ方の総当たり（つまみはねらいの値） ==');
function enumerate(st, maxWires) {
  const base = st.answer();
  const blocks = base.blocks;
  const outs = [], ins = [];
  for (const b of blocks) {
    for (const p of PARTS[b.type].out) outs.push({ key: b.id + '.' + p, bus: (PARTS[b.type].bus || []).includes(p) });
    for (const p of PARTS[b.type].in) if (!(b.type === 'video' && p !== 'in0')) ins.push({ key: b.id + '.' + p, bus: (PARTS[b.type].busIn || []).includes(p) });
  }
  // 前の段から持ち越した線（はじめの台にあって答えにもある線）は動かさない（台が育つ。柱②）
  const kept = new Map(st.board().wires.filter(w => base.wires.some(a => a.from === w.from && a.to === w.to)).map(w => [w.to, w.from]));
  const choices = ins.map(i => kept.has(i.key) ? [kept.get(i.key)] : [null, ...outs.filter(o => o.bus === i.bus && o.key.split('.')[0] !== i.key.split('.')[0]).map(o => o.key)]);
  const isKept = ins.map(i => kept.has(i.key));
  const answerKey = new Set(base.wires.map(w => w.from + '>' + w.to));
  let total = 0, pass = 0, loops = 0; const odd = new Map();
  const pickIdx = new Array(ins.length).fill(0);
  const walk = (k, used) => {
    if (k === ins.length) {
      const wires = []; for (let i = 0; i < ins.length; i++) if (choices[i][pickIdx[i]]) wires.push({ from: choices[i][pickIdx[i]], to: ins[i].key });
      if (!wires.some(w => w.to === 'scr.in0')) return;
      const b = { blocks, wires };
      if (analyze(b).errors.length) { loops++; return; }
      total++;
      if (st.judge(frame(b)).pass) {
        pass++;
        const same = wires.length === answerKey.size && wires.every(w => answerKey.has(w.from + '>' + w.to));
        if (!same) { const sig = wires.map(w => `${w.from}→${w.to}`).join(', '); odd.set(sig, (odd.get(sig) || 0) + 1); }
      }
      return;
    }
    for (let j = 0; j < choices[k].length; j++) {
      const u = used + (j && !isKept[k] ? 1 : 0); if (u > maxWires) continue;
      pickIdx[k] = j; walk(k + 1, u);
    }
    pickIdx[k] = 0;
  };
  walk(0, 0);
  return { total, pass, loops, odd };
}
for (const [i, maxW] of [[0, 1], [1, 2], [2, quick ? 3 : 4]]) {
  const t0 = Date.now();
  const r = enumerate(STAGES[i], maxW);
  console.log(`段${i}「${STAGES[i].name}」: 線${maxW}本までの配線 ${r.total} 通り（ぐるぐる ${r.loops}）、合格 ${r.pass}、ねらいとちがう合格 ${r.odd.size} 種（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
  const list = [...r.odd.keys()];
  const show = i === 0 ? list : list.slice(0, 12);
  for (const sig of show) console.log('   ・' + sig);
  if (list.length > show.length) console.log(`   …ほか ${list.length - show.length} 種`);
}

// ---- C) 壁のはね返り ----
// 反転型（本物）を1画面に1回だけ調べると、玉の高さ4行＞縦の速さ3行なので、反転のあともさわったままで続けて反転し、ぶるぶる止まる（2026-10-24 に測った）。
// そこで「向きを覚える」は、さわりはじめの1回だけ反転する（edge=1。図鑑に書く小さなうそ）。つなぎ方は B（玉の窓が始まる瞬間に、消す時間の中なら）が見えない間がいちばん短い。
console.log('\n== C) 壁のはね返り（反転型）: ぶるぶる・見えない間 ==');
const variants = {
  'A 消す時間が始まる瞬間・玉が重なっていたら': [['V.VBLANK', 'fv.clk'], ['ball.v', 'fv.t']],
  'B 玉の窓が始まる瞬間・消す時間の中なら': [['ball.v', 'fv.clk'], ['V.VBLANK', 'fv.t']],
};
const FR = quick ? 600 : 1800;
for (const edge of [0, 1]) for (const [name, ws] of Object.entries(variants)) for (const dv of [1, 2, 3]) {
  const b = { blocks: [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' }, { id: 'ball', type: 'ball', params: { dh: 1, dv } }, { id: 'fv', type: 'ff', params: { edge } }],
    wires: [{ from: 'ball.out', to: 'scr.in0' }, { from: 'fv.q', to: 'ball.dirV' }, ...ws.map(([from, to]) => ({ from, to }))] };
  const st = compile(b).step;
  let good = 0, jitter = 0, both = 0, n = 0, hidMax = 0, hidSum = 0, hidN = 0;
  for (let vc0 = 0; vc0 < T.H; vc0 += quick ? 13 : 5) {
    const s = makeState(b, { ball: { hc: 150, vc: vc0 } }); n++;
    let last = -99, top = false, bot = false, prev = s.blk.fv.q, hid = 0;
    for (let f = 0; f < FR; f++) {
      st(s, T.PER_FRAME);
      let y = -1; for (let i = 0; i < s.cur.length; i++) if (s.cur[i]) { y = Math.floor(i / T.VIS_W); break; }
      if (y < 0) hid++; else { if (hid) { hidSum += hid; hidN++; hidMax = Math.max(hidMax, hid); } hid = 0; if (y < 12) top = true; if (y > T.VIS_H - 16) bot = true; }
      if (s.blk.fv.q !== prev) { if (f - last <= 3) jitter++; else good++; last = f; prev = s.blk.fv.q; }
    }
    if (hid) hidMax = Math.max(hidMax, hid);
    if (top && bot) both++;
  }
  console.log(`${edge ? 'さわりはじめ' : '本物どおり'} ${name} 速さ${dv}: 上下の両方へ ${both}/${n}、よいはね返り ${(good / n).toFixed(1)}・ぶるぶる ${(jitter / n).toFixed(1)}（${FR}画面）、見えない間 平均${(hidSum / Math.max(1, hidN)).toFixed(1)}・最長${hidMax}画面`);
}
