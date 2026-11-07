// 練習を画面のうしろで回す（Web Worker）。受けとるのは遺伝子の数だけ（声は受けとらない）。世代ごとに、いちばんよい歩きと、いま試している歩き（群れの真ん中）を返す
// pace＝1世代にかける最短の秒（育つ様子を早送りしないで見せる）
import R from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
import { kidBody } from './kid.js';
import { makePractice } from './practice.js';
let stop = false;
onmessage = async e => {
  if (e.data.stop) { stop = true; return; }
  const { genes, over, gens = 90, seed = 1, pace = 0 } = e.data;
  await R.init();
  const P = makePractice(R, kidBody(genes, over), { seed });
  postMessage({ gen: 0, tries: 0, trying: P.trying, stage: 1 });
  for (let g = 0; g < gens && !stop; g++) {
    const t0 = performance.now(), b = P.step();
    postMessage({ gen: P.gen, tries: P.tries, firstWalk: P.firstWalk, v: b.v, dist: b.dist, fell: b.fell, stage: P.stage, trying: P.trying });
    await new Promise(r => setTimeout(r, Math.max(0, pace * 1000 - (performance.now() - t0))));
  }
  postMessage({ done: true, tries: P.tries });
};
