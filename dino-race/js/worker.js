// 裏で計算する: 記録の測定（evaluate）と、おまかせの進化（evolve）。画面が固まらないように。
importScripts('https://cdn.jsdelivr.net/npm/planck@1.5.0/dist/planck.min.js', 'genome.js?v=12', 'sim.js?v=12', 'ga.js?v=12');

let job = 0;
onmessage = e => {
  const m = e.data;
  if (m.type === 'evaluate') {
    postMessage({type: 'evaluated', id: m.id, res: measureRobust(m.genomes)});
  } else if (m.type === 'check') { // みんなの記録の確かめ（v010）: いつもの走りを1回ずつ
    postMessage({type: 'evaluated', id: m.id, res: evaluate(m.genomes)});
  } else if (m.type === 'evolve') {
    const my = ++job;
    const P = makePop(m.seeds, m.opts);
    const run = () => {
      if (my !== job) return; // とめた、または新しい進化が始まった
      const h = stepGeneration(P);
      const done = P.gen >= m.gens;
      postMessage({type: 'progress', id: m.id, gen: P.gen, gens: m.gens, best: h.best, median: h.median, bestG: h.bestG, bestRes: h.bestRes, done});
      if (!done) setTimeout(run, 0);
    };
    run();
  } else if (m.type === 'stop') {
    job++;
  }
};
