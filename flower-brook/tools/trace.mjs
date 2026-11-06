// 花の小川: 1つのコースを遊び手で下り、ようすを数秒ごとに出す（しらべ用）。
// node flower-brook/tools/trace.mjs [--seed=1] [--bot=smart] [--every=2]
import { newState, step, patchAt, shapeOf } from '../js/sim.js';
import * as bots from './bots.mjs';
const arg = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const S = newState(+(arg.seed || 1)), bot = bots[arg.bot || 'smart'], every = +(arg.every || 2);
let next = 0;
while (!S.done && S.t < 600) {
  const inp = bot(S); step(S, inp);
  if (S.t >= next) {
    next += every;
    const B = S.beads, mw = B.reduce((a, b) => a + b.w, 0) / B.length, mid = B[B.length >> 1];
    const pr = [-1, 1].map(sd => { const p = patchAt(S.course, sd, mid.s); return p ? (p.rare ? 'R' + p.drunk.toFixed(2) : '.') : '-'; }).join(' ');
    console.log(`${S.t.toFixed(0).padStart(4)}s  s ${B[0].s.toFixed(0).padStart(5)}  水 ${mw.toFixed(3)}  ${inp.hold ? '押す u' + inp.u : 'はなす'} x${inp.x}  先頭x ${S.lead.x.toFixed(2)} まん中x ${mid.x.toFixed(2)}  岸 ${pr}  切れ ${shapeOf(S).pieces}${S.thunder ? ' 雷' + S.thunder.kind : ''}`);
  }
}
console.log('段', S.grade, JSON.stringify(shapeOf(S)));
console.log('めずらしい花', S.course.patches.filter(p => p.rare).map(p => `${p.side > 0 ? '右' : '左'}${p.s0}:${p.drunk.toFixed(2)}`).join(' '));
