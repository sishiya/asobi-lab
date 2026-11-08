// 裏で計算する: 記録の測定（evaluate）と、おまかせの進化（evolve）。画面が固まらないように。
importScripts('https://cdn.jsdelivr.net/npm/planck@1.5.0/dist/planck.min.js', 'genome.js?v=16', 'sim.js?v=16', 'ga.js?v=16');

let job = 0, paused = false, held = null; // 画面を離れているあいだ（paused）は世代を進めず、続きを held に取っておく
onmessage = e => {
  const m = e.data;
  if ('pause' in m) { // 画面を離れた・もどった（RULES 12章）
    paused = m.pause;
    if (!paused && held) { const f = held; held = null; f(); }
  } else if (m.type === 'evaluate') {
    postMessage({type: 'evaluated', id: m.id, res: measureRobust(m.genomes)});
  } else if (m.type === 'check') { // みんなの記録の確かめ（v010）: いつもの走りを1回ずつ
    postMessage({type: 'evaluated', id: m.id, res: evaluate(m.genomes)});
  } else if (m.type === 'evolve') {
    const my = ++job;
    const P = makePop(m.seeds, m.opts);
    const run = () => {
      if (my !== job) return; // とめた、または新しい進化が始まった
      if (paused) { held = run; return; }
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
