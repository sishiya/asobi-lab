// いま光れ: 段（面）の中身と合格の型。合格はいつもブラウン管の光で見る（柱①）。
// 型はゆるく: 光った所の8割が型紙の中にあればよい（PLAN 2章・レベルデザイン）。
import { T, litCells } from './sim.js';

const BASE = [{ id: 'H', type: 'H' }, { id: 'V', type: 'V' }, { id: 'scr', type: 'video' }];

// 見える所のマス: 横 10〜56、縦 2〜32
export const VIS = { c0: T.HB >> 3, c1: (T.W - 1) >> 3, r0: T.VB >> 3, r1: (T.H - 1) >> 3 };

function inside(s, test) {
  const m = litCells(s);
  let all = 0, ok = 0;
  for (let r = 0; r < T.ROWS; r++) for (let c = 0; c < T.COLS; c++) { const n = m[r * T.COLS + c]; if (!n) continue; all += n; if (test(c, r)) ok += n; }
  return { all, ok, pass: all > 0 && ok >= all * 0.8 };
}

export const STAGES = [
  {
    id: 0, name: '縞', line: 'わっかの口から「画面」へ線を引こう', speed: 1, stripe: 64,
    show: ['H.H8', 'H.H16', 'H.H32', 'H.H64', 'H.H128', 'H.H256'],   // 細いビットは縞が見えない・「消」は光らないので出さない（UX・検証）
    hints: [{ from: 'H.H64', to: 'scr.in0' }], other: 'H.H128',      // 64 は1行0.6秒で点滅に見える（32 はちらつくだけ）
    // 横のカウンタのビットを1本、画面へ。どのビットでも正解（縞の太さが最初の「おれの」）
    board: () => ({ blocks: [...BASE], wires: [] }),
    answer: () => ({ blocks: [...BASE], wires: [{ from: 'H.H64', to: 'scr.in0' }] }),
    judge: s => inside(s, () => true),
  },
  {
    id: 1, name: '縦の線', target: { c: 33 }, line: 'たての光を ⌜⌟ の中へ', speed: 2,
    show: ['H.count', 'V.count'], hints: [{ from: 'H.count', to: 'k1.in' }, { from: 'k1.out', to: 'scr.in0' }], knobs: ['k1'],
    board: () => ({ blocks: [...BASE, { id: 'k1', type: 'cmp', params: { n: 20, w: 2 } }], wires: [] }),
    answer: () => ({ blocks: [...BASE, { id: 'k1', type: 'cmp', params: { n: 33, w: 2 } }], wires: [{ from: 'H.count', to: 'k1.in' }, { from: 'k1.out', to: 'scr.in0' }] }),
    judge(s) { const t = this.target.c; return inside(s, c => c >= t - 4 && c <= t + 5); },
  },
  {
    id: 2, name: '点', target: { c: 44, r: 10 }, line: '光を1点だけ ⌜⌟ の中へ', speed: 2,
    show: ['H.count', 'V.count'], hints: [{ from: 'k1.out', to: 'a1.a' }, { from: 'k2.out', to: 'a1.b' }, { from: 'a1.out', to: 'scr.in0' }], knobs: ['k1', 'k2'],
    board: () => ({ blocks: [...BASE, { id: 'k1', type: 'cmp', params: { n: 33, w: 2 } }, { id: 'k2', type: 'cmp', params: { n: 16, w: 2 } }, { id: 'a1', type: 'and' }],
      wires: [{ from: 'H.count', to: 'k1.in' }, { from: 'V.count', to: 'k2.in' }, { from: 'k1.out', to: 'scr.in0' }] }),  // 2個目のくらべるは、たてにつないで置いてある（新しい線は3本）
    answer: () => ({ blocks: [...BASE, { id: 'k1', type: 'cmp', params: { n: 44, w: 2 } }, { id: 'k2', type: 'cmp', params: { n: 10, w: 2 } }, { id: 'a1', type: 'and' }],
      wires: [{ from: 'H.count', to: 'k1.in' }, { from: 'V.count', to: 'k2.in' }, { from: 'k1.out', to: 'a1.a' }, { from: 'k2.out', to: 'a1.b' }, { from: 'a1.out', to: 'scr.in0' }] }),
    judge(s) { const { c: tc, r: tr } = this.target; return inside(s, (c, r) => c >= tc - 4 && c <= tc + 5 && r >= tr - 4 && r <= tr + 5); },
  },
];
