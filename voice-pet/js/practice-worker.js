// 練習を画面のうしろで回す（Web Worker）。受けとるのは遺伝子の数だけ（声は受けとらない）。世代ごとに、いちばんよい歩きと、いま試している歩き（群れの真ん中）と、続きから練習するための数を返す
// pace＝1世代にかける最短の秒（育つ様子を早送りしないで見せる）。練習は「歩けるようになって曲がれる」まで続け、多くても maxGens で止める
// 歩けるようになったら、起き上がる練習（js/getup-practice.js）。会得するまで、多くても 100 世代
import R from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
import { kidBody } from './kid.js';
import { makePractice } from './practice.js';
import { makeGetupPractice } from './getup-practice.js';
let stop = false, P = null;
const wait = (t0, pace) => new Promise(r => setTimeout(r, Math.max(0, pace * 1000 - (performance.now() - t0))));
onmessage = async e => {
  if (e.data.stop) { stop = true; return; }
  if (e.data.places && !e.data.genes) { P?.setPlaces(e.data.places); return; } // 走った地面が帰ってきた
  if (e.data.answer) { if (P?.asking) e.data.answer === 'restart' ? P.restart() : P.keep(); return; } // 歩き方を始め直すか、遊ぶ人の答え
  const { genes, over, maxGens = 400, seed = 1, pace = 0, resume = null, getupResume = null, places = [] } = e.data;
  await R.init();
  const B = kidBody(genes, over); P = makePractice(R, B, { seed, resume, ask: true, places });
  const msg = b => ({ gen: P.gen, tries: P.tries, firstWalk: P.firstWalk, v: b?.v, stage: P.stage, steady: P.steady, restarts: P.restarts, trying: P.trying, done: P.done, asking: P.asking, state: P.state() });
  postMessage(msg(P.best));
  while (!P.done && P.gen < maxGens && !stop) {
    const t0 = performance.now(), b = P.step();
    postMessage(msg(b));
    await wait(t0, pace);
  }
  // 起き上がる練習（1世代は重いので、pace より長くかかる）
  const G = makeGetupPractice(R, B, { seed: seed + 7, resume: getupResume });
  const gmsg = () => ({ getup: { gen: G.gen, tries: G.tries, learned: G.learned, v: G.best?.ok ? G.best.v : null, state: G.state() } });
  postMessage(gmsg());
  while (!G.learned && G.gen < 100 && !stop) {
    const t0 = performance.now(); G.step();
    postMessage(gmsg());
    await wait(t0, pace);
  }
  postMessage({ end: true });
};
