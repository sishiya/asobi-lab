// 練習を画面のうしろで回す（Web Worker）。受けとるのは遺伝子の数だけ（声は受けとらない）。世代ごとに、いちばんよい歩きと、いま試している歩き（群れの真ん中）と、続きから練習するための数を返す
// pace＝1世代にかける最短の秒（育つ様子を早送りしないで見せる）。練習は「歩けるようになって曲がれる」まで続け、多くても maxGens で止める
import R from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
import { kidBody } from './kid.js';
import { makePractice } from './practice.js';
let stop = false;
onmessage = async e => {
  if (e.data.stop) { stop = true; return; }
  const { genes, over, maxGens = 400, seed = 1, pace = 0, resume = null } = e.data;
  await R.init();
  const P = makePractice(R, kidBody(genes, over), { seed, resume });
  const msg = b => ({ gen: P.gen, tries: P.tries, firstWalk: P.firstWalk, v: b?.v, stage: P.stage, steady: P.steady, restarts: P.restarts, trying: P.trying, done: P.done, state: P.state() });
  postMessage(msg(P.best));
  while (!P.done && P.gen < maxGens && !stop) {
    const t0 = performance.now(), b = P.step();
    postMessage(msg(b));
    await new Promise(r => setTimeout(r, Math.max(0, pace * 1000 - (performance.now() - t0))));
  }
  postMessage({ end: true });
};
