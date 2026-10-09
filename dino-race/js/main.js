// 画面: 牧場（カード）・かけっこ・かけ合わせ・おまかせの進化。牧場はブラウザに保存する。

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE_KEY = 'asobi-lab/dino-race/ranch-v1';
const MAX_RANCH = 8, MAX_RACE = 4; // かけっこの長さ FINISH と打ち切り LIMIT は sim.js
const LINE = {trex: 'ティラノ', raptor: 'ラプトル', compy: 'コンピー'};

// ---------- 牧場の記録 ----------
let ranch = [], nursery = [], serial = 1;
const selected = new Set();

function starter(sp) {
  return {id: 's-' + sp.id, name: sp.name, line: LINE[sp.id], g: {...sp.body, ...(sp.gait || baseGait()), from: sp.id}, rec: null, gen: 0, parents: []};
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && Array.isArray(s.ranch) && s.ranch.length) { ranch = s.ranch; ranch.forEach(x => { x.practice = null; }); serial = s.serial || ranch.length + 1; return; }
  } catch (e) { /* 保存が読めないときは、はじめから */ }
  ranch = SPECIES.map(starter);
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ranch, serial})); } catch (e) { /* 保存できなくても遊べる */ }
}

const fmtMass = M => M >= 1000 ? (M / 1000).toFixed(M >= 10000 ? 0 : 1) + ' t' : M >= 10 ? Math.round(M) + ' kg' : M.toFixed(1) + ' kg';
const kmh = ms => (ms * 3.6).toFixed(1);
function recText(rec) {
  if (rec.finishT != null) return `${FINISH}m <b>${rec.finishT.toFixed(2)}秒</b>（時速 ${kmh(FINISH / rec.finishT)}km）`;
  if (rec.fell) return `<b>${Math.max(0, rec.dist).toFixed(1)}m</b> で転んだ（${rec.fellT.toFixed(1)}秒）`;
  return `${LIMIT}秒で <b>${Math.max(0, rec.dist).toFixed(1)}m</b>`;
}
function recHtml(rec) {
  return `<span class="rec">${rec ? recText(rec) : '記録をはかっています…'}</span>`;
}

// ---------- 裏の計算（Worker） ----------
const worker = new Worker('js/worker.js');
const waiting = new Map();
let reqId = 1;
worker.onmessage = e => {
  const m = e.data;
  if (m.type === 'evaluated') { const cb = waiting.get(m.id); waiting.delete(m.id); cb && cb(m.res); }
  if (m.type === 'progress') onEvolveProgress(m);
};
function measure(list, done) { // list: 牧場・子の記録のないもの
  if (!list.length) return;
  const id = reqId++;
  waiting.set(id, res => { list.forEach((x, i) => { x.rec = res[i]; }); done && done(); });
  worker.postMessage({type: 'evaluate', id, genomes: list.map(x => x.g)});
}

// 走る練習: 体はそのままで、走り方だけを小さな群れで PRACTICE.gens 世代育て、よくなったら入れかえる。
// おまかせの進化とぶつからないように別の Worker で、1匹ずつ順番に
const PRACTICE = {gens: 6, size: 10};
const practiceWorker = new Worker('js/worker.js');
const practiceQueue = [];
let practicing = null;
function practice(x) {
  if (x.practice) return;
  x.practice = {gen: 0, best: null};
  practiceQueue.push(x);
  nextPractice();
}
function nextPractice() {
  if (practicing || !practiceQueue.length) return;
  practicing = practiceQueue.shift();
  practiceWorker.postMessage({type: 'evolve', id: reqId++, gens: PRACTICE.gens, seeds: [practicing.g], opts: {size: PRACTICE.size, seed: (Date.now() % 1e9) | 0, bodyLock: true}});
}
practiceWorker.onmessage = e => {
  const m = e.data, x = practicing; if (m.type !== 'progress' || !x) return;
  x.practice.gen = m.gen;
  if (!x.practice.best || m.best > x.practice.best.score) x.practice.best = {score: m.best, g: m.bestG, res: m.bestRes};
  if (m.done) {
    const b = x.practice.best;
    if (!x.rec || b.score > scoreOf(x.rec)) { x.g = b.g; x.rec = b.res; }
    x.practiced = (x.practiced || 0) + 1;
    x.practice = null; practicing = null;
    if (ranch.includes(x)) { save(); renderRanch(); }
    nextPractice();
  }
  renderNursery();
};

// ---------- カード ----------
function cardHtml(x, {buttons = ''} = {}) {
  const p = bodyPlan(x.g);
  return `<canvas width="400" height="192" data-portrait="${esc(x.id)}"></canvas>
    <span class="name">${esc(x.name)}</span>
    <span class="meta">体重 ${fmtMass(p.M)} ・ 脚 ${p.L.toFixed(2)}m${x.gen ? ` ・ ${x.gen}代目` : ''}</span>
    ${recHtml(x.rec)}${buttons}`;
}
function paintPortraits(root, list) {
  const dpr = window.devicePixelRatio || 1;
  root.querySelectorAll('canvas[data-portrait]').forEach(cv => {
    const x = list.find(y => y.id === cv.dataset.portrait); if (!x) return;
    const r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    drawPortrait(cv, x.g);
  });
}

function renderRanch() {
  $('ranchCount').textContent = `${ranch.length} / ${MAX_RANCH}匹`;
  $('ranch').innerHTML = ranch.map(x => `<div class="card${x.rec ? '' : ' wait'}" role="button" tabindex="0" data-id="${esc(x.id)}" aria-pressed="${selected.has(x.id)}">${cardHtml(x)}</div>`).join('');
  paintPortraits($('ranch'), ranch);
  updateActions();
}

function updateActions() {
  const n = selected.size, busy = !!evolving;
  $('btnRace').disabled = n < 1 || n > MAX_RACE;
  $('btnBreed').disabled = n !== 2 || busy;
  $('btnEvolve').disabled = n !== 1 || busy;
  $('btnRelease').disabled = n < 1 || ranch.length - n < 1;
  $('selHint').textContent = n ? `${n}匹を選んでいます` : 'カードを押して選ぶ（かけっこは4匹まで、かけ合わせは2匹、おまかせは1匹）';
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  $('ranch').querySelectorAll('.card').forEach(c => c.setAttribute('aria-pressed', selected.has(c.dataset.id)));
  updateActions();
}
$('ranch').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) toggleSelect(c.dataset.id); });
$('ranch').addEventListener('keydown', e => { const c = e.target.closest('.card'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSelect(c.dataset.id); } });

// ---------- 走るようす ----------
const VIEW = {R: null, labels: [], speed: 1, acc: 0, mode: 'idle', cams: [], onEnd: null};
const PROGRESS_H = 30; // 上の帯（コース全体の進みぐあい）の高さ
let lastT = 0;

function viewSize() {
  const cv = $('view'), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  return {W: r.width, H: r.height};
}

// mode: race（かけっこ、終わったら結果の表）/ trial（1匹の走りを見る）。どちらも 100m のコース
function startView(genomes, labels, {mode = 'race', onEnd = null} = {}) {
  VIEW.R = makeRace(genomes);
  VIEW.labels = labels; VIEW.mode = mode; VIEW.acc = 0; VIEW.onEnd = onEnd; VIEW.cams = [];
  updateCamera(true);
  $('result').hidden = true;
  $('btnStopView').hidden = false;
}

function stopView() {
  if (VIEW.mode === 'idle') return;
  VIEW.mode = 'idle';
  $('btnStopView').hidden = true;
  if (VIEW.onEnd) VIEW.onEnd();
}

function dinoHeight(d) { return Math.max(d.r.neckEnd[1], d.r.headEnd[1]) + d.p.thick.head; }

// レーンごとに、その恐竜が収まる縮尺で追いかける（大きさのちがいは物差しとカードの体重で見せる）
function updateCamera(snap = false) {
  const {W, H} = viewSize(), ds = VIEW.R ? VIEW.R.dinos : [];
  if (!ds.length) return;
  const laneH = (H - PROGRESS_H) / ds.length;
  VIEW.cams = ds.map((d, i) => {
    const long = d.r.headEnd[0] - d.r.tailEnd[0];
    const scale = Math.min((laneH - 52) / (dinoHeight(d) * 1.15), W / (long * 2.4));
    const want = d.dist + d.x0 - (W / scale) * 0.55;
    const c = VIEW.cams[i] && !snap ? VIEW.cams[i] : {x: want};
    return {scale, x: c.x + (want - c.x) * (snap ? 1 : 0.2)};
  });
}

function stepView(dt) {
  const R = VIEW.R; if (!R || VIEW.mode === 'idle') return;
  VIEW.acc += Math.min(dt, 0.1) * VIEW.speed;
  let n = 0;
  while (VIEW.acc >= DT && n < 40) {
    stepRace(R); VIEW.acc -= DT; n++;
    if (raceOver(R)) { finishView(); break; }
  }
  $('hudText').textContent = `${R.t.toFixed(1)}秒` + R.dinos.map((d, i) => ` ・ ${VIEW.labels[i]} ${d.finishT != null ? 'ゴール' : Math.max(0, d.dist).toFixed(0) + 'm' + (d.fell ? '（転んだ）' : '')}`).join('');
}

// 足あとから推定した速さ（Alexander 1976）: v = 0.25 g^0.5 λ^1.67 h^-1.17。λ は1歩の周期（左右1回ずつ）で進んだ長さ
function alexander(d, t, dist) {
  if (t <= 0 || dist <= 0) return null;
  const strides = t / d.T, lambda = dist / strides, h = d.hipY0;
  return {v: 0.25 * Math.sqrt(GRAV) * Math.pow(lambda, 1.67) * Math.pow(h, -1.17), lambda};
}

function finishView() {
  const R = VIEW.R;
  const rows = R.dinos.map((d, i) => {
    const ok = d.finishT != null, t = ok ? d.finishT : d.fell ? d.fellT : R.t, dist = ok ? FINISH : Math.max(0, d.dist);
    return {d, i, t, dist, ok, v: dist / Math.max(t, 0.01), a: alexander(d, t, dist)};
  }).sort((x, y) => (y.ok - x.ok) || (x.ok ? x.t - y.t : y.dist - x.dist));
  $('result').innerHTML = `<div class="wrap"><table><thead><tr><th>順位</th><th>名前</th><th>記録</th><th>平均の時速</th><th>足あとから推定</th></tr></thead><tbody>${rows.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(VIEW.labels[r.i])}</td><td>${r.ok ? r.t.toFixed(2) + '秒' : (r.d.fell ? '転倒 ' : '打ち切り ') + r.dist.toFixed(1) + 'm'}</td><td>${kmh(r.v)}km</td><td>${r.a ? '時速 ' + kmh(r.a.v) + 'km（歩幅 ' + r.a.lambda.toFixed(2) + 'm）' : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p>「足あとから推定」は、歩幅と腰の高さから速さを出す Alexander（1976）の式です。化石の足あとから恐竜の速さを見積もるのに使われています。シミュレーションの速さとくらべてみてください。</p>`;
  $('result').hidden = false;
  stopView();
}

function loop(now) {
  const dt = lastT ? (now - lastT) / 1000 : 0; lastT = now;
  stepView(dt);
  if (VIEW.R) { updateCamera(); drawScene($('view'), VIEW.R, VIEW.cams, {labels: VIEW.labels, progressH: PROGRESS_H}); }
  requestAnimationFrame(loop);
}

$('speedSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  VIEW.speed = +b.dataset.speed;
  $('speedSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
});
$('btnStopView').addEventListener('click', finishView);

// ---------- かけっこ ----------
$('btnRace').addEventListener('click', () => {
  const list = ranch.filter(x => selected.has(x.id)).slice(0, MAX_RACE);
  startView(list.map(x => x.g), list.map(x => x.name));
  $('view').scrollIntoView({behavior: 'smooth', block: 'nearest'});
});

function watchTrial(x) {
  startView([x.g], [x.name], {mode: 'trial'});
  $('view').scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

// ---------- かけ合わせ ----------
const rng = makeRng(Date.now() % 1e9);
function childName(a, b) {
  const line = a.line === b.line ? a.line : a.line.slice(0, 2) + b.line.slice(0, 2);
  return {line, name: `${line} ${serial++}号`};
}

$('btnBreed').addEventListener('click', () => {
  const [a, b] = ranch.filter(x => selected.has(x.id));
  nursery = [];
  for (let i = 0; i < 3; i++) {
    const g = mutate(crossover(a.g, b.g, rng), rng, {rate: 0.3}); // 強いと子の多くが転ぶ
    const nm = childName(a, b);
    nursery.push({id: 'c-' + Date.now() + '-' + i, ...nm, g, rec: null, gen: Math.max(a.gen, b.gen) + 1, parents: [a.name, b.name]});
  }
  $('nurseryTitle').textContent = `${a.name} × ${b.name} の子`;
  showNursery();
  measure(nursery, renderNursery);
});

function showNursery() { $('nurserySec').hidden = false; renderNursery(); $('nurserySec').scrollIntoView({behavior: 'smooth', block: 'nearest'}); }
function renderNursery() {
  const full = ranch.length >= MAX_RANCH;
  const practiceBtn = x => x.practice
    ? `<button type="button" disabled>${x.practice.gen ? `練習中 ${x.practice.gen}/${PRACTICE.gens}` : '練習の順番待ち'}</button>`
    : `<button type="button" data-act="practice"${x.rec ? '' : ' disabled'} title="体はそのままで、走り方を練習します（数十秒）">${x.practiced ? 'もっと練習' : '練習させる'}</button>`;
  $('nursery').innerHTML = nursery.map(x => `<div class="card${x.rec ? '' : ' wait'}" data-id="${esc(x.id)}">${cardHtml(x, {buttons: `<span class="row"><button type="button" data-act="watch"${x.rec ? '' : ' disabled'}>走りを見る</button>${practiceBtn(x)}<button type="button" data-act="keep"${full ? ' disabled title="牧場がいっぱいです。先に逃がしてください"' : ''}>残す</button></span>`})}</div>`).join('');
  paintPortraits($('nursery'), nursery);
  if (!nursery.length) $('nurserySec').hidden = true;
}
$('nursery').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const x = nursery.find(y => y.id === b.closest('.card').dataset.id); if (!x) return;
  if (b.dataset.act === 'watch') watchTrial(x);
  if (b.dataset.act === 'practice') { practice(x); renderNursery(); }
  if (b.dataset.act === 'keep' && ranch.length < MAX_RANCH) {
    ranch.push(x); nursery = nursery.filter(y => y !== x); save(); renderRanch(); renderNursery();
  }
});
$('btnNurseryDone').addEventListener('click', () => { nursery = []; renderNursery(); });

// ---------- 逃がす ----------
$('btnRelease').addEventListener('click', () => {
  const names = ranch.filter(x => selected.has(x.id)).map(x => x.name);
  if (!confirm(`${names.join('、')} を逃がしますか？（もどせません）`)) return;
  ranch = ranch.filter(x => !selected.has(x.id)); selected.clear(); save(); renderRanch(); renderNursery();
});

// ---------- おまかせで進化 ----------
let evolving = null;
$('btnEvolve').addEventListener('click', () => {
  const x = ranch.find(y => selected.has(y.id));
  evolving = {src: x, hist: [], running: false};
  $('evolveHint').textContent = `${x.name} をもとに、24匹の群れを牧場の外で育てます。走り方は毎回変わり、「体の形も変える」と体も変わります。`;
  $('evolveSet').hidden = false; $('evolveRun').hidden = true; $('evolveSec').hidden = false;
  updateActions();
  $('evolveSec').scrollIntoView({behavior: 'smooth', block: 'nearest'});
});
$('btnEvolveCancel').addEventListener('click', endEvolve);
$('btnEvolveGo').addEventListener('click', () => {
  const E = evolving, gens = +$('selGens').value;
  E.running = true; E.gens = gens; E.id = reqId++;
  $('evolveSet').hidden = true; $('evolveRun').hidden = false;
  $('btnEvolveStop').disabled = true;
  $('evoStat').textContent = '第0世代を走らせています…';
  drawEvoChart();
  worker.postMessage({type: 'evolve', id: E.id, gens, seeds: [E.src.g], opts: {size: 24, seed: (Date.now() % 1e9) | 0, bodyLock: !$('chkBody').checked}});
});
function onEvolveProgress(m) {
  const E = evolving; if (!E || m.id !== E.id) return;
  E.hist.push({gen: m.gen, best: m.best, median: m.median});
  if (!E.best || m.best > E.best.score) E.best = {score: m.best, g: m.bestG, res: m.bestRes};
  $('btnEvolveStop').disabled = false;
  $('evoStat').innerHTML = `第${m.gen}世代 / ${m.gens} ・ いちばん速い子: ${recText(m.bestRes)}`;
  drawEvoChart();
  if (m.done) bringBack();
}
$('btnEvolveStop').addEventListener('click', () => { worker.postMessage({type: 'stop'}); bringBack(); });
function bringBack() {
  const E = evolving; if (!E || !E.best) return endEvolve();
  const x = E.src, gensRun = E.hist.length;
  nursery = [{id: 'e-' + Date.now(), line: x.line, name: `${x.line} ${serial++}号`, g: E.best.g, rec: E.best.res, gen: x.gen + gensRun, parents: [x.name]}];
  $('nurseryTitle').textContent = `${x.name} から ${gensRun}世代 進化した子`;
  endEvolve();
  showNursery();
}
function endEvolve() {
  if (evolving && evolving.running) worker.postMessage({type: 'stop'});
  evolving = null; $('evolveSec').hidden = true; updateActions();
}
function drawEvoChart() {
  const cv = $('evoChart'), dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, E = evolving, h = E ? E.hist : [];
  ctx.clearRect(0, 0, W, H);
  const pad = {l: 40, r: 12, t: 12, b: 24};
  const maxY = Math.max(5, ...h.map(p => p.best)) * 1.1, maxX = Math.max(E ? E.gens : 10, 1);
  const X = g => pad.l + (W - pad.l - pad.r) * g / maxX, Y = v => H - pad.b - (H - pad.t - pad.b) * Math.max(0, v) / maxY;
  ctx.strokeStyle = INK['paper-line']; ctx.fillStyle = INK.muted; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const v = maxY * i / 4, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(v.toFixed(0), pad.l - 6, y + 4); }
  ctx.textAlign = 'center'; ctx.fillText('世代', W / 2, H - 6);
  ctx.textAlign = 'left'; ctx.fillText('点数（ゴールすると 100点 ＋ 速さ）', pad.l + 4, pad.t + 10);
  if (maxY > FINISH) { const y = Y(FINISH); ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = INK.accent; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.restore(); }
  const line = (key, color, w) => { if (h.length < 1) return; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); h.forEach((p, i) => { const x = X(p.gen), y = Y(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
  line('median', INK['ink-soft'], 1.5);
  line('best', INK.accent, 2.5);
  if (h.length) { const p = h[h.length - 1]; ctx.fillStyle = INK.accent; ctx.textAlign = 'left'; ctx.fillText('いちばん', Math.min(X(p.gen) + 6, W - 50), Y(p.best) - 6); }
}

// ---------- はじめ ----------
$('btnReset').addEventListener('click', () => {
  if (!confirm('牧場をはじめの3匹に戻しますか？（いまの恐竜は消えます）')) return;
  ranch = SPECIES.map(starter); serial = 1; selected.clear(); save(); renderRanch(); measure(ranch, () => { save(); renderRanch(); });
});

readInk();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readInk(); renderRanch(); renderNursery(); });
load();
renderRanch();
measure(ranch.filter(x => !x.rec), () => { save(); renderRanch(); });
let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { paintPortraits($('ranch'), ranch); paintPortraits($('nursery'), nursery); }, 150); });
if (new URLSearchParams(location.search).has('thumb')) {
  // サムネイルを撮るとき（?thumb）: ティラノサウルスを数秒走らせたところで止め、title を ready に
  document.body.classList.add('thumb');
  const st = [starter(SPECIES[0])];
  startView(st.map(x => x.g), st.map(x => x.name));
  for (let i = 0; i < 2.6 / DT; i++) stepRace(VIEW.R);
  updateCamera(true);
  drawScene($('view'), VIEW.R, VIEW.cams, {labels: VIEW.labels, progressH: 0});
  document.title = 'ready';
} else {
  // はじめは、牧場の3匹がその場で走る
  startView(ranch.slice(0, 3).map(x => x.g), ranch.slice(0, 3).map(x => x.name));
  requestAnimationFrame(loop);
}

window.__dino = {VIEW, get ranch() { return ranch; }, get nursery() { return nursery; }, stepView, finishView, startView};
