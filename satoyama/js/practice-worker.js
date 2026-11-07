// 練習を画面のうしろで回す（Web Worker）。受けとるのは遺伝子の数だけ（声は受けとらない）。世代ごとに、いちばんよい歩きを返す
import R from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
import { kidBody } from './kid.js';
import { makePractice } from './practice.js';
let stop = false;
onmessage = async e => {
  const { genes, over, gens = 50, seed = 1 } = e.data;
  if (e.data.stop) { stop = true; return; }
  await R.init();
  const P = makePractice(R, kidBody(genes, over), { seed });
  for (let g = 0; g < gens && !stop; g++) {
    const b = P.step();
    postMessage({ gen: P.gen, tries: P.tries, firstWalk: P.firstWalk, v: b.v, dist: b.dist, fell: b.fell, stage: b.stage });
    await new Promise(r => setTimeout(r, 0));
  }
  postMessage({ done: true, tries: P.tries });
};
