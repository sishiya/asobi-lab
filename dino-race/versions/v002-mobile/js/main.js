// 画面: 牧場・大会・記録帳のタブ、選んだ恐竜の操作バー、シート（詳しく・結果・大会に出る恐竜・おまかせ・説明）。
// 牧場とメダル・記録はブラウザに保存する（消えることがある。説明のシートに書いている）。

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE_KEY = 'asobi-lab/dino-race/ranch-v1';    // 牧場・生まれた子（v001 の形に足していく）
const PROG_KEY = 'asobi-lab/dino-race/progress-v1'; // メダル・記録帳・あそびかたを見たか
const BASE_SLOTS = 8, MAX_RACE = 4; // 牧場の広さ（メダル1つで +1）。かけっこの長さ FINISH と打ち切り LIMIT は sim.js
const LINE = {trex: 'ティラノ', raptor: 'ラプトル', compy: 'コンピー'};

// ---------- 保存 ----------
let ranch = [], kids = [], serial = 1; // kids: 生まれた子（残すか決める前）
let prog = {medals: {}, best: null, classes: {}, born: 0, practiced: 0, evolved: 0, races: 0, maxGen: 0, tipDone: false};
let selected = []; // 選んだ順の id

function starter(sp) {
  return {id: 's-' + sp.id, name: sp.name, line: LINE[sp.id], g: {...sp.body, ...(sp.gait || baseGait()), from: sp.id}, rec: null, gen: 0, parents: []};
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && Array.isArray(s.ranch) && s.ranch.length) {
      ranch = s.ranch; kids = Array.isArray(s.kids) ? s.kids : []; serial = s.serial || ranch.length + 1;
    }
    const p = JSON.parse(localStorage.getItem(PROG_KEY) || 'null');
    if (p) prog = {...prog, ...p};
  } catch (e) { /* 保存が読めないときは、はじめから */ }
  if (!ranch.length) ranch = SPECIES.map(starter);
  for (const x of [...ranch, ...kids]) { x.practice = null; delete x.isNew; } // 練習の途中は保存しない
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ranch, kids, serial})); } catch (e) { /* 保存できなくても遊べる */ }
}
function saveProg() {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (e) { /* 同上 */ }
}
const slots = () => BASE_SLOTS + Object.keys(prog.medals).length;

// ---------- 文字 ----------
const fmtMass = M => M >= 1000 ? (M / 1000).toFixed(M >= 10000 ? 0 : 1) + 't' : M >= 10 ? Math.round(M) + 'kg' : M.toFixed(1) + 'kg';
const kmh = ms => (ms * 3.6).toFixed(1);
const fmtT = t => t.toFixed(2) + '秒';
function recText(rec, short = false) {
  if (!rec) return '記録をはかっています…';
  if (rec.finishT != null) return `100m <b>${fmtT(rec.finishT)}</b>${short ? '' : `（時速 ${kmh(FINISH / rec.finishT)}km）`}`;
  if (rec.fell) return `<b>${Math.max(0, rec.dist).toFixed(1)}m</b> で転んだ`;
  return `${LIMIT}秒で <b>${Math.max(0, rec.dist).toFixed(1)}m</b>`;
}
const recShort = rec => !rec ? '…' : rec.finishT != null ? fmtT(rec.finishT) : rec.fell ? `${Math.max(0, rec.dist).toFixed(0)}mで転倒` : `${Math.max(0, rec.dist).toFixed(0)}m`;

let toastT = 0;
function toast(msg, ms = 2800) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------- 記録帳 ----------
function noteRecord(x) {
  if (!x.rec) return;
  prog.maxGen = Math.max(prog.maxGen, x.gen || 0);
  const t = x.rec.finishT; if (t == null) { saveProg(); return; }
  const M = bodyPlan(x.g).M, entry = {name: x.name, t, M, gen: x.gen || 0};
  if (!prog.best || t < prog.best.t) prog.best = entry;
  const c = classOf(M).id;
  if (!prog.classes[c] || t < prog.classes[c].t) prog.classes[c] = entry;
  saveProg();
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
function measure(list, done) { // 記録のないものの記録をはかる
  if (!list.length) return;
  const id = reqId++;
  waiting.set(id, res => { list.forEach((x, i) => { x.rec = res[i]; noteRecord(x); }); done && done(); });
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
  x.practice = {gen: 0, best: null, before: x.rec};
  practiceQueue.push(x);
  nextPractice();
  refreshDino(x);
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
    const b = x.practice.best, before = x.practice.before;
    const better = !x.rec || b.score > scoreOf(x.rec);
    if (better) { x.g = b.g; x.rec = b.res; noteRecord(x); }
    x.practiced = (x.practiced || 0) + 1;
    x.practice = null; practicing = null;
    prog.practiced++; saveProg(); save();
    toast(better ? `${x.name} の練習: ${recShort(before)} → ${recShort(x.rec)}` : `${x.name} の練習: 記録は変わらず（${recShort(x.rec)}）`);
    nextPractice();
  }
  refreshDino(x, m.done);
};
const practiceLabel = x => x.practice ? (x.practice.gen ? `練習中 ${x.practice.gen}/${PRACTICE.gens}` : '練習の順番待ち') : '';

// ---------- 絵 ----------
function paintPortraits(root, list) {
  const dpr = window.devicePixelRatio || 1;
  root.querySelectorAll('canvas[data-portrait]').forEach(cv => {
    const x = list.find(y => y.id === cv.dataset.portrait); if (!x) return;
    const r = cv.getBoundingClientRect(); if (!r.width) return; // 隠れたタブ（あとで描く）
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    drawPortrait(cv, x.g);
  });
}

// ---------- 牧場 ----------
function statusOf(x) {
  if (x.practice) return practiceLabel(x);
  if (evolving && evolving.src === x) return 'おまかせで進化中';
  return '';
}
function ranchCard(x) {
  const p = bodyPlan(x.g), i = selected.indexOf(x.id);
  return `<div class="card${x.rec ? '' : ' wait'}${x.isNew ? ' born' : ''}" role="button" tabindex="0" data-id="${esc(x.id)}" aria-pressed="${i >= 0}">
    <span class="selno"${i >= 0 ? '' : ' hidden'}>${i + 1}</span>
    <button type="button" class="more" data-act="detail" aria-label="${esc(x.name)} をくわしく">…</button>
    <canvas data-portrait="${esc(x.id)}"></canvas>
    <span class="name">${esc(x.name)}</span>
    <span class="meta">${fmtMass(p.M)} ・ ${x.gen ? x.gen + '代目' : 'はじめの恐竜'}</span>
    <span class="rec">${recText(x.rec, true)}</span>
    <span class="status" data-status>${statusOf(x)}</span>
  </div>`;
}
function renderRanch() {
  $('ranchCount').textContent = `${ranch.length}/${slots()}`;
  $('ranch').innerHTML = ranch.map(ranchCard).join('');
  paintPortraits($('ranch'), ranch);
  for (const x of ranch) delete x.isNew;
  updateSelection();
}
function updateSelection() {
  selected = selected.filter(id => ranch.some(x => x.id === id));
  $('ranch').querySelectorAll('.card').forEach(c => {
    const i = selected.indexOf(c.dataset.id), no = c.querySelector('.selno');
    c.setAttribute('aria-pressed', i >= 0); no.hidden = i < 0; no.textContent = i + 1;
  });
  const n = selected.length, show = n > 0 && tab === 'ranch' && !$('sheet').open;
  $('actbar').hidden = !show; document.body.classList.toggle('has-actbar', show);
  $('actN').textContent = n === 1 ? '1匹（もう1匹でかけ合わせ）' : `${n}匹を選んでいます`;
  $('btnBreed').disabled = n !== 2;
  $('btnRace').disabled = n < 1 || n > MAX_RACE;
  $('btnRace').textContent = n > MAX_RACE ? `かけっこは${MAX_RACE}匹まで` : 'かけっこ';
}
function toggleSelect(id) {
  const i = selected.indexOf(id);
  if (i >= 0) selected.splice(i, 1); else selected.push(id);
  updateSelection();
}
$('ranch').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const x = ranch.find(y => y.id === c.dataset.id);
  if (e.target.closest('[data-act=detail]')) { openDetail(x); return; }
  toggleSelect(c.dataset.id);
});
$('ranch').addEventListener('keydown', e => { const c = e.target.closest('.card'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSelect(c.dataset.id); } });
$('btnClearSel').addEventListener('click', () => { selected = []; updateSelection(); });

// 1匹の表示を更新（練習の進みぐあいなど）。カード・生まれた子・詳しくのシート
function refreshDino(x, full = false) {
  const card = $('ranch').querySelector(`.card[data-id="${CSS.escape(x.id)}"]`);
  if (card) {
    if (full) { card.querySelector('.rec').innerHTML = recText(x.rec, true); }
    card.querySelector('[data-status]').textContent = statusOf(x);
  }
  if (kids.includes(x)) renderKids();
  if (sheetKind === 'detail' && sheetDino === x) renderDetail(x);
}

// ---------- 生まれた子 ----------
const rng = makeRng(Date.now() % 1e9);
function childName(a, b) {
  const line = a.line === b.line ? a.line : a.line.slice(0, 2) + b.line.slice(0, 2);
  return {line, name: `${line} ${serial++}号`};
}
function renderKids() {
  const box = $('nurseryBox');
  if (!kids.length) { box.hidden = true; box.innerHTML = ''; return; }
  const full = ranch.length >= slots();
  box.hidden = false;
  box.innerHTML = `<h2>生まれた子（${kids.length}匹）</h2>
    <p class="parents">記録を見て、残す子を選ぶ。転んだ子も練習すると走れるようになることがあります。${full ? `<br><b>牧場がいっぱい</b>（${slots()}匹）。残すには先に牧場から逃がすか、大会でメダルを取って広げる。` : ''}</p>
    <div class="kids">${kids.map(x => {
      const p = bodyPlan(x.g);
      return `<div class="kid" data-id="${esc(x.id)}">
        <canvas data-portrait="${esc(x.id)}"></canvas>
        <span class="kid-main"><span class="name">${esc(x.name)} <span class="meta">${x.gen}代目</span></span>
          <span class="rec">${recText(x.rec, true)}</span><span class="status">${practiceLabel(x)}</span></span>
        <span class="meta wide">${fmtMass(p.M)} ・ 脚 ${p.L.toFixed(2)}m ・ ${esc(x.origin || '')}</span>
        <span class="row">
          <button type="button" data-act="watch"${x.rec ? '' : ' disabled'}>走りを見る</button>
          <button type="button" data-act="practice"${x.rec && !x.practice ? '' : ' disabled'}>${x.practiced ? 'もっと練習' : '練習'}</button>
          <button type="button" data-act="keep" class="primary"${full ? ' disabled' : ''}>残す</button>
        </span></div>`;
    }).join('')}</div>
    <div class="foot"><button type="button" class="quiet" data-act="releaseAll">のこりは逃がす</button></div>`;
  paintPortraits(box, kids);
}
$('nurseryBox').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'releaseAll') {
    if (kids.some(x => x.practiced) && !confirm('練習した子もいます。のこりを逃がしますか？')) return;
    kids = []; save(); renderKids(); toast('のこりの子を逃がしました'); return;
  }
  const x = kids.find(y => y.id === b.closest('.kid').dataset.id); if (!x) return;
  if (b.dataset.act === 'watch') watchRun(x);
  if (b.dataset.act === 'practice') practice(x);
  if (b.dataset.act === 'keep' && ranch.length < slots()) {
    kids = kids.filter(y => y !== x); x.isNew = true; ranch.push(x);
    save(); renderRanch(); renderKids(); toast(`${x.name} を牧場に残しました`);
  }
});

function addKids(list) {
  kids.push(...list);
  save(); renderKids();
  measure(list.filter(x => !x.rec), () => { save(); renderKids(); });
  setTab('ranch');
  $('nurseryBox').scrollIntoView({behavior: 'smooth', block: 'start'});
}

$('btnBreed').addEventListener('click', () => {
  const [a, b] = selected.map(id => ranch.find(x => x.id === id));
  if (!a || !b) return;
  const list = [];
  for (let i = 0; i < 3; i++) {
    const g = mutate(crossover(a.g, b.g, rng), rng, {rate: 0.3}); // 強いと子の多くが転ぶ
    list.push({id: 'c-' + Date.now() + '-' + i, ...childName(a, b), g, rec: null, gen: Math.max(a.gen, b.gen) + 1,
      parents: [a.name, b.name], origin: `${a.line === b.line ? a.line + 'どうし' : a.line + '×' + b.line}の子（親 ${recShort(a.rec)}・${recShort(b.rec)}）`});
  }
  prog.born += 3; saveProg();
  selected = []; updateSelection();
  addKids(list);
  toast('たまごがかえった！ 3匹生まれました');
});

// ---------- 走るようす ----------
const VIEW = {R: null, labels: [], speed: 1, acc: 0, mode: 'idle', cams: [], ghosts: [], onEnd: null};
const PROGRESS_H = 30; // 上の帯（コース全体の進みぐあい）の高さ
const SPEEDS = [1, 3, 0.5];
let lastT = 0;

function viewSize() {
  const cv = $('view'), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  return {W: r.width, H: r.height};
}

// mode: race（かけっこ。終わると onEnd(結果)）/ watch（1匹の走りを見る）/ idle-run（練習場。終わるとまた始める）
function startView(genomes, labels, {mode = 'race', onEnd = null, ghosts = []} = {}) {
  VIEW.R = makeRace(genomes);
  VIEW.labels = labels; VIEW.mode = mode; VIEW.acc = 0; VIEW.onEnd = onEnd; VIEW.cams = []; VIEW.ghosts = ghosts;
  updateCamera(true);
  const live = mode !== 'idle-run';
  $('stage').classList.toggle('live', live);
  $('btnSkip').hidden = !live;
  if (live) { if ($('sheet').open) closeSheet(); window.scrollTo({top: 0, behavior: 'smooth'}); }
}

function dinoHeight(d) { return Math.max(d.r.neckEnd[1], d.r.headEnd[1]) + d.p.thick.head; }

// レーンごとに、その恐竜が収まる縮尺で追いかける（大きさのちがいは物差しとカードの体重で見せる）
function updateCamera(snap = false) {
  const {W, H} = viewSize(), ds = VIEW.R ? VIEW.R.dinos : [];
  if (!ds.length || !W) return;
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
    if (raceOver(R)) { finishView(); return; }
  }
  if (VIEW.mode === 'idle-run') return;
  $('hudText').textContent = `${R.t.toFixed(1)}秒` + R.dinos.map((d, i) => ` ・ ${i + 1} ${d.finishT != null ? 'ゴール' : Math.max(0, d.dist).toFixed(0) + 'm' + (d.fell ? '（転んだ）' : '')}`).join('');
}

// 足あとから推定した速さ（Alexander 1976）: v = 0.25 g^0.5 λ^1.67 h^-1.17。λ は1歩の周期（左右1回ずつ）で進んだ長さ
function alexander(d, t, dist) {
  if (t <= 0 || dist <= 0) return null;
  const strides = t / d.T, lambda = dist / strides, h = d.hipY0;
  return {v: 0.25 * Math.sqrt(GRAV) * Math.pow(lambda, 1.67) * Math.pow(h, -1.17), lambda};
}

function finishView() {
  const R = VIEW.R, mode = VIEW.mode, cb = VIEW.onEnd;
  const results = R.dinos.map((d, i) => {
    const ok = d.finishT != null, t = ok ? d.finishT : d.fell ? d.fellT : R.t, dist = ok ? FINISH : Math.max(0, d.dist);
    return {i, label: VIEW.labels[i], ok, t, dist, fell: d.fell, finishT: d.finishT, v: dist / Math.max(t, 0.01), a: alexander(d, t, dist)};
  });
  VIEW.mode = 'idle'; VIEW.onEnd = null;
  $('stage').classList.remove('live');
  $('btnSkip').hidden = true;
  if (mode === 'idle-run') { setTimeout(idleRun, 1200); return; }
  $('hudText').textContent = results.map(r => `${r.label} ${r.ok ? fmtT(r.t) : (r.fell ? `${r.dist.toFixed(0)}mで転倒` : `${r.dist.toFixed(0)}m`)}`).join(' ・ ');
  if (cb) cb(results);
}

// 練習場: 何もしていないときは、牧場の速い恐竜（3匹まで）が走っている
function idleRun() {
  if (VIEW.mode !== 'idle') return;
  const n = innerWidth < 640 ? 2 : 3; // スマホでは2匹（1匹ずつ大きく）
  const list = [...ranch].filter(x => x.rec && x.rec.finishT != null).sort((a, b) => a.rec.finishT - b.rec.finishT).slice(0, n);
  const use = list.length ? list : ranch.slice(0, n);
  startView(use.map(x => x.g), use.map(x => x.name), {mode: 'idle-run'});
  $('hudText').textContent = '牧場の恐竜が、練習場を走っています';
}

function loop(now) {
  const dt = lastT ? (now - lastT) / 1000 : 0; lastT = now;
  stepView(dt);
  if (VIEW.R) { updateCamera(); drawScene($('view'), VIEW.R, VIEW.cams, {labels: VIEW.labels, progressH: PROGRESS_H, ghosts: VIEW.ghosts}); }
  requestAnimationFrame(loop);
}

$('btnSpeed').addEventListener('click', () => {
  VIEW.speed = SPEEDS[(SPEEDS.indexOf(VIEW.speed) + 1) % SPEEDS.length];
  $('btnSpeed').textContent = '×' + VIEW.speed;
});
// 結果へ: 残りを一気に計算して終える（見せずに）
$('btnSkip').addEventListener('click', () => {
  const R = VIEW.R; if (!R || VIEW.mode === 'idle' || VIEW.mode === 'idle-run') return;
  while (!raceOver(R)) stepRace(R);
  finishView();
});

function watchRun(x) {
  const back = sheetKind === 'detail' ? sheetDino : null;
  startView([x.g], [x.name], {mode: 'watch', onEnd: res => {
    toast(`${x.name}: ${res[0].ok ? '100m ' + fmtT(res[0].t) : res[0].fell ? res[0].dist.toFixed(1) + 'm で転んだ' : res[0].dist.toFixed(1) + 'm'}`);
    if (back && ranch.includes(back)) setTimeout(() => openDetail(back), 700);
  }});
}

// ---------- かけっこ ----------
// entries: [{name, g, me}]。cup があれば大会（勝ち負けとメダル）
function runRace(entries, {cup = null} = {}) {
  const ghosts = cup && cup.ghosts ? cup.ghosts.map(k => REFS[k]) : [];
  prog.races++; saveProg();
  startView(entries.map(e => e.g), entries.map(e => e.name), {mode: 'race', ghosts, onEnd: res => showResult(entries, res, cup, ghosts)});
}

$('btnRace').addEventListener('click', () => {
  const list = selected.map(id => ranch.find(x => x.id === id)).filter(Boolean).slice(0, MAX_RACE);
  if (!list.length) return;
  runRace(list.map(x => ({name: x.name, g: x.g, me: true, x})));
});

function showResult(entries, res, cup, ghosts) {
  const rows = res.map(r => ({...r, me: entries[r.i].me, ghost: false}));
  for (const gh of ghosts) rows.push({label: gh.name, ok: true, t: gh.t, v: FINISH / gh.t, ghost: true});
  rows.sort((x, y) => (y.ok - x.ok) || (x.ok ? x.t - y.t : y.dist - x.dist));
  let banner = '';
  if (cup) {
    const mine = res[0], rivals = res.slice(1).map(r => ({finishT: r.finishT}));
    const won = cup.win({finishT: mine.finishT, fell: mine.fell, dist: mine.dist}, {rivals});
    const x = entries[0].x;
    if (won) {
      const first = !prog.medals[cup.id];
      if (first || mine.t < prog.medals[cup.id].t) prog.medals[cup.id] = {t: mine.t, name: x.name, date: new Date().toISOString().slice(0, 10)};
      saveProg();
      banner = `<div class="result-banner win"><b>${first ? 'メダル獲得！' : 'クリア！'}</b> 「${esc(cup.title)}」${first ? `<br>牧場が1匹分広がりました（${slots()}匹まで）` : ''}</div>`;
      if (first) { renderRanch(); renderKids(); }
      renderCups();
    } else {
      const gap = cupGap(cup, mine, rivals);
      banner = `<div class="result-banner"><b>${mine.fell ? '転んでしまった…' : 'おしい！'}</b> 「${esc(cup.title)}」${gap ? '<br>' + gap : ''}<br><span class="hint">練習させたり、かけ合わせたりして、もう一度。</span></div>`;
    }
  }
  let place = 0; // ゴーストは順位に数えない
  const items = rows.map(r => `<li class="${r.me && cup && rows.length > 1 ? 'me' : ''}">
    <span class="no">${r.ghost ? '–' : ++place}</span><span class="nm">${esc(r.label)}${r.ghost ? '（目安）' : ''}</span>
    <span class="tm">${r.ok ? fmtT(r.t) : (r.fell ? '転倒' : '—')}</span>
    <span class="sub">${r.ghost ? `時速 ${kmh(r.v)}km` : `${r.ok ? '' : r.dist.toFixed(1) + 'm ・ '}平均 時速 ${kmh(r.v)}km${r.a ? ` ・ 足あとから推定 時速 ${kmh(r.a.v)}km（歩幅 ${r.a.lambda.toFixed(2)}m）` : ''}`}</span></li>`).join('');
  openSheet(cup ? '大会の結果' : 'かけっこの結果', `${banner}<ol class="rank">${items}</ol>
    <p class="hint">「足あとから推定」は、歩幅と腰の高さから速さを出す Alexander（1976）の式。化石の足あとから恐竜の速さを見積もるのに使われています。</p>
    <div class="btn-row"><button type="button" id="btnAgain">もう一度</button><button type="button" class="primary" id="btnResClose">閉じる</button></div>`, 'result');
  $('btnAgain').onclick = () => runRace(entries, {cup});
  $('btnResClose').onclick = closeSheet;
}
function cupGap(cup, mine, rivals) {
  if (mine.finishT == null) return `${mine.dist.toFixed(1)}m で${mine.fell ? '転んだ' : '時間切れ'}`;
  const rivalT = rivals.map(r => r.finishT).filter(t => t != null);
  const target = cup.target ?? (rivalT.length ? Math.min(...rivalT) : null);
  return target ? `あと ${(mine.finishT - target).toFixed(2)}秒` : '';
}

// ---------- 大会 ----------
function renderCups() {
  const won = Object.keys(prog.medals).length;
  $('medalCount').textContent = `${won}/${CUPS.length}`;
  // 牧場のタブの上に「次のお題」（まだのお題のうち、いちばん上）
  const next = CUPS.find(c => !prog.medals[c.id]), nb = $('nextCup');
  nb.hidden = !next;
  if (next) {
    nb.innerHTML = `<span><b>次のお題</b> ${esc(next.title)} — ${esc(next.text)}</span><button type="button" class="chip-btn" id="btnNextCup">出場する</button>`;
    $('btnNextCup').onclick = () => openPick(next);
  }
  $('cupList').innerHTML = CUPS.map(c => {
    const m = prog.medals[c.id];
    const who = [...(c.rivals || []).map(id => SPECIES.find(s => s.id === id).name), ...(c.ghosts || []).map(k => REFS[k].short + '（目安）')];
    return `<div class="cup${m ? ' won' : ''}">
      <span class="medal">${m ? '★' : 'まだ'}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.text)}${who.length ? `<br>いっしょに走る: ${esc(who.join('、'))}` : ''}</p>
      <span class="best">${m ? `クリア: ${esc(m.name)} ${fmtT(m.t)}` : ''}</span>
      <button type="button" data-cup="${c.id}"${m ? '' : ' class="primary"'}>${m ? 'もう一度出る' : '出場する'}</button>
    </div>`;
  }).join('');
}
$('cupList').addEventListener('click', e => { const b = e.target.closest('[data-cup]'); if (b) openPick(CUPS.find(c => c.id === b.dataset.cup)); });

function openPick(cup) {
  // 出られる恐竜を先に、その中は速い順
  const list = [...ranch].sort((a, b) => (!!cupBlock(cup, a) - !!cupBlock(cup, b)) || ((a.rec?.finishT ?? 999) - (b.rec?.finishT ?? 999)));
  openSheet(`「${cup.title}」に出る恐竜`, `<p class="hint">${esc(cup.text)}</p><ul class="pick">${list.map(x => {
    const why = cupBlock(cup, x);
    return `<li><button type="button" data-id="${esc(x.id)}"${why ? ' disabled' : ''}><canvas data-portrait="${esc(x.id)}"></canvas>
      <b>${esc(x.name)}</b><span class="why">${fmtMass(bodyPlan(x.g).M)} ・ ${x.rec ? recShort(x.rec) : '記録なし'}${why ? '<br>' + esc(why) : ''}</span></button></li>`;
  }).join('')}</ul>`, 'pick');
  paintPortraits($('sheetBody'), list);
  $('sheetBody').querySelector('.pick').onclick = e => {
    const b = e.target.closest('button[data-id]'); if (!b || b.disabled) return;
    const x = ranch.find(y => y.id === b.dataset.id);
    const rivals = (cup.rivals || []).map(id => starter(SPECIES.find(s => s.id === id)));
    runRace([{name: x.name, g: x.g, me: true, x}, ...rivals.map(r => ({name: 'ライバル ' + r.name, g: r.g, me: false}))], {cup});
  };
}

// ---------- 記録帳 ----------
function renderBook() {
  const b = prog.best;
  const cls = CLASSES.map(c => { const e = prog.classes[c.id]; return `<tr><td>${c.name}</td><td>${e ? `${fmtT(e.t)}（時速 ${kmh(FINISH / e.t)}km）` : '—'}</td><td>${e ? esc(e.name) + `（${fmtMass(e.M)}）` : ''}</td></tr>`; }).join('');
  const refs = Object.values(REFS).map(r => ({name: r.name, t: r.t, note: r.note}));
  if (b) refs.push({name: `あなたの最速（${b.name}）`, t: b.t, note: `${fmtMass(b.M)}・${b.gen ? b.gen + '代目' : 'はじめの恐竜'}`, me: true});
  refs.sort((x, y) => x.t - y.t);
  $('book').innerHTML = `<div class="book">
    <div class="stat">
      <div><span>最速の 100m</span><b>${b ? fmtT(b.t) : '—'}</b><span>${b ? esc(b.name) : ''}</span></div>
      <div><span>メダル</span><b>${Object.keys(prog.medals).length} / ${CUPS.length}</b></div>
      <div><span>生まれた子</span><b>${prog.born}匹</b></div>
      <div><span>いちばん新しい世代</span><b>${prog.maxGen}代目</b></div>
      <div><span>練習</span><b>${prog.practiced}回</b></div>
      <div><span>かけっこ</span><b>${prog.races}回</b></div>
    </div>
    <h3>体重クラスごとの最速</h3>
    <p class="note">体が大きいほど、重さの割に筋肉の力が足りなくなります（体を2倍にすると、重さは8倍・力は4倍）。</p>
    <table><thead><tr><th>体重</th><th>100m</th><th>恐竜</th></tr></thead><tbody>${cls}</tbody></table>
    <h3>本物とくらべる（100m）</h3>
    <table><thead><tr><th></th><th>100m</th><th>時速</th></tr></thead><tbody>${refs.map(r => `<tr${r.me ? ' style="font-weight:700"' : ''}><td>${esc(r.name)}<br><span class="note">${esc(r.note)}</span></td><td>${fmtT(r.t)}</td><td>${kmh(FINISH / r.t)}km</td></tr>`).join('')}</tbody></table>
    <p class="note">ゾウとダチョウは全力の速さから計算した目安です（100m を同じ速さで走るとして）。</p>
  </div>`;
}

// ---------- シート ----------
let sheetKind = null, sheetDino = null;
function openSheet(title, html, kind, dino = null) {
  sheetKind = kind; sheetDino = dino;
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheetBody').scrollTop = 0;
  if (!$('sheet').open) $('sheet').showModal();
  updateSelection();
}
function closeSheet() { if ($('sheet').open) $('sheet').close(); }
$('sheet').addEventListener('close', () => { sheetKind = null; sheetDino = null; updateSelection(); });
$('btnSheetClose').addEventListener('click', closeSheet);
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); }); // 外側（暗いところ）を押すと閉じる

// 詳しく: 大きな絵・体のようす・記録・操作
const SHOW_GENES = ['legLen', 'tibRatio', 'metaRatio', 'muscle', 'tailLen', 'neckLen', 'bodyLen'];
function geneRatio(d, v) { return d.log ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min); }
function openDetail(x) { openSheet(x.name, '', 'detail', x); renderDetail(x); }
function renderDetail(x) {
  const p = bodyPlan(x.g), r = restPose(p);
  const bars = SHOW_GENES.map(k => {
    const d = GENE_BY_KEY[k], v = x.g[k];
    const shown = k === 'legLen' ? v.toFixed(2) + 'm' : k === 'muscle' ? Math.round(v * 100) + '%' : v.toFixed(2);
    return `<span>${esc(d.label)} <b>${shown}</b></span><span class="bar"><i style="left:${(geneRatio(d, v) * 100).toFixed(1)}%"></i></span>`;
  }).join('');
  const busy = !!x.practice, evo = evolving && evolving.src === x;
  $('sheetTitle').textContent = x.name;
  $('sheetBody').innerHTML = `<canvas class="big" data-portrait="${esc(x.id)}"></canvas>
    <div class="facts">
      <div><span>体重</span>${fmtMass(p.M)}</div>
      <div><span>全長</span>${(r.headEnd[0] - r.tailEnd[0]).toFixed(2)}m</div>
      <div><span>腰の高さ</span>${r.hip[1].toFixed(2)}m</div>
      <div><span>世代</span>${x.gen ? x.gen + '代目' : 'はじめの恐竜'}${x.practiced ? `・練習 ${x.practiced}回` : ''}</div>
    </div>
    <p>${recText(x.rec)} <span class="status">${statusOf(x)}</span></p>
    ${x.parents && x.parents.length ? `<p class="hint">親: ${esc(x.parents.join(' × '))}</p>` : ''}
    <h3>体のようす（遺伝子の範囲のどこにいるか）</h3>
    <div class="bars">${bars}</div>
    <div class="btn-row">
      <button type="button" data-d="watch"${x.rec ? '' : ' disabled'}>走りを見る</button>
      <button type="button" data-d="practice"${busy ? ' disabled' : ''}>${busy ? practiceLabel(x) : '練習させる'}</button>
      <button type="button" data-d="evolve"${evolving ? ' disabled' : ''}>${evo ? 'おまかせで進化中' : 'おまかせで進化'}</button>
      <button type="button" data-d="rename">名前を変える</button>
      <button type="button" data-d="release" class="quiet"${ranch.length <= 1 ? ' disabled' : ''}>逃がす</button>
    </div>
    <p class="hint">練習: 体はそのままで走り方を数十秒かけて練習（よくなったら覚える）。おまかせ: この恐竜をもとに群れを育て、いちばん速い子を連れて帰る（数分）。</p>`;
  paintPortraits($('sheetBody'), [x]);
  $('sheetBody').querySelector('.btn-row').onclick = e => {
    const b = e.target.closest('[data-d]'); if (!b || b.disabled) return;
    const act = b.dataset.d;
    if (act === 'watch') watchRun(x);
    if (act === 'practice') practice(x);
    if (act === 'evolve') openEvolve(x);
    if (act === 'rename') {
      const nm = prompt('新しい名前（12文字まで）', x.name);
      if (nm && nm.trim()) { x.name = nm.trim().slice(0, 12); save(); renderRanch(); renderDetail(x); }
    }
    if (act === 'release' && confirm(`${x.name} を逃がしますか？（もどせません）`)) {
      ranch = ranch.filter(y => y !== x); save(); closeSheet(); renderRanch(); renderKids(); toast(`${x.name} を逃がしました`);
    }
  };
}

// ---------- おまかせで進化 ----------
let evolving = null;
function openEvolve(x) {
  if (evolving) return showEvolve();
  openSheet(`おまかせで進化: ${x.name}`, `<p>${esc(x.name)} をもとに、24匹の群れを牧場の外で育てます。走り方は毎回変わり、「体の形も変える」と体も変わります。終わると、いちばん速い子を1匹連れて帰ります（生まれた子に入る）。</p>
    <div class="evo-set">
      <label>世代 <select id="selGens"><option>5</option><option selected>10</option><option>30</option></select></label>
      <label><input type="checkbox" id="chkBody"> 体の形も変える</label>
    </div>
    <p class="hint">1世代に数秒〜十数秒かかります。シートを閉じても、裏で進みます。</p>
    <div class="btn-row"><button type="button" class="primary" id="btnEvolveGo">はじめる</button></div>`, 'evolve-set', x);
  $('btnEvolveGo').onclick = () => {
    const gens = +$('selGens').value;
    evolving = {src: x, gens, hist: [], best: null, id: reqId++};
    worker.postMessage({type: 'evolve', id: evolving.id, gens, seeds: [x.g], opts: {size: 24, seed: (Date.now() % 1e9) | 0, bodyLock: !$('chkBody').checked}});
    renderBanner(); refreshDino(x); showEvolve();
  };
}
function showEvolve() {
  const E = evolving; if (!E) return;
  openSheet(`おまかせで進化: ${E.src.name}`, `<canvas id="evoChart" aria-label="世代ごとの記録のグラフ"></canvas>
    <p class="evo-stat" id="evoStat"></p>
    <div class="btn-row"><button type="button" id="btnEvolveStop">ここでやめて、いちばん速い子を連れて帰る</button></div>`, 'evolve', E.src);
  $('btnEvolveStop').onclick = () => { worker.postMessage({type: 'stop'}); bringBack(); };
  updateEvolveView();
}
function onEvolveProgress(m) {
  const E = evolving; if (!E || m.id !== E.id) return;
  E.hist.push({gen: m.gen, best: m.best, median: m.median});
  if (!E.best || m.best > E.best.score) E.best = {score: m.best, g: m.bestG, res: m.bestRes};
  updateEvolveView(); renderBanner();
  if (m.done) bringBack();
}
function updateEvolveView() {
  const E = evolving; if (!E || sheetKind !== 'evolve') return;
  $('evoStat').innerHTML = E.best ? `第${E.hist.length}世代 / ${E.gens} ・ いちばん速い子: ${recText(E.best.res)}` : '第0世代を走らせています…';
  $('btnEvolveStop').disabled = !E.best;
  drawEvoChart();
}
function renderBanner() {
  const E = evolving, el = $('evolveBanner');
  if (!E) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>おまかせで進化中: ${esc(E.src.name)} ${E.hist.length}/${E.gens}世代${E.best ? ' ・ いちばん ' + recShort(E.best.res) : ''}</span><button type="button" class="chip-btn" id="btnEvoShow">見る</button>`;
  $('btnEvoShow').onclick = showEvolve;
}
function bringBack() {
  const E = evolving; if (!E) return;
  evolving = null;
  renderBanner(); refreshDino(E.src);
  if (sheetKind === 'evolve') closeSheet();
  if (!E.best) return;
  const x = E.src, n = E.hist.length;
  prog.evolved++; prog.born++; saveProg();
  addKids([{id: 'e-' + Date.now(), line: x.line, name: `${x.line} ${serial++}号`, g: E.best.g, rec: E.best.res, gen: (x.gen || 0) + n,
    parents: [x.name], origin: `${x.name}から ${n}世代 進化（もと ${recShort(x.rec)}）`}]);
  noteRecord(kids[kids.length - 1]);
  toast(`おまかせの進化が終わりました（${recShort(E.best.res)}）`);
}
function drawEvoChart() {
  const cv = $('evoChart'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(); if (!r.width) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, E = evolving, h = E ? E.hist : [];
  ctx.clearRect(0, 0, W, H);
  const pad = {l: 34, r: 12, t: 22, b: 22};
  const maxY = Math.max(5, ...h.map(p => p.best)) * 1.1, maxX = Math.max(E ? E.gens : 10, 1);
  const X = g => pad.l + (W - pad.l - pad.r) * g / maxX, Y = v => H - pad.b - (H - pad.t - pad.b) * Math.max(0, v) / maxY;
  ctx.strokeStyle = INK['paper-line']; ctx.fillStyle = INK.muted; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const v = maxY * i / 4, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(v.toFixed(0), pad.l - 6, y + 4); }
  ctx.textAlign = 'center'; ctx.fillText('世代', W / 2, H - 6);
  ctx.textAlign = 'left'; ctx.fillText('点数（ゴールすると 100点 ＋ 速さ）', pad.l + 4, 14);
  if (maxY > FINISH) { const y = Y(FINISH); ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = INK.accent; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.restore(); }
  const line = (key, color, w) => { if (!h.length) return; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); h.forEach((p, i) => { const x = X(p.gen), y = Y(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
  line('median', INK['ink-soft'], 1.5);
  line('best', INK.accent, 2.5);
}

// ---------- タブ ----------
let tab = 'ranch';
function setTab(t) {
  tab = t;
  for (const k of ['ranch', 'cups', 'book']) {
    $('tab-' + k).setAttribute('aria-selected', k === t);
    $('panel-' + k).hidden = k !== t;
  }
  if (t === 'ranch') { paintPortraits($('ranch'), ranch); paintPortraits($('nurseryBox'), kids); }
  if (t === 'cups') renderCups();
  if (t === 'book') renderBook();
  updateSelection();
}
for (const k of ['ranch', 'cups', 'book']) $('tab-' + k).addEventListener('click', () => setTab(k));

// ---------- あそびかた・説明 ----------
$('btnTipOk').addEventListener('click', () => { prog.tipDone = true; saveProg(); $('tip').hidden = true; });
$('btnAbout').addEventListener('click', () => {
  openSheet('このゲームについて', $('aboutTpl').innerHTML, 'about');
  $('btnReset').onclick = () => {
    if (!confirm('はじめからやり直しますか？（牧場・メダル・記録が消えます）')) return;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(PROG_KEY); } catch (e) { /* 消せなくても */ }
    location.reload();
  };
});

// ---------- はじめ ----------
readInk();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readInk(); renderRanch(); renderKids(); });
load();
$('tip').hidden = !!prog.tipDone;
renderRanch(); renderKids(); renderCups(); renderBanner();
measure([...ranch, ...kids].filter(x => !x.rec), () => { save(); renderRanch(); renderKids(); });
for (const x of ranch) noteRecord(x);
let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { paintPortraits($('ranch'), ranch); paintPortraits($('nurseryBox'), kids); }, 150); });
if (new URLSearchParams(location.search).has('thumb')) {
  // サムネイルを撮るとき（?thumb）: ティラノサウルスを数秒走らせたところで止め、title を ready に
  document.body.classList.add('thumb');
  const st = [starter(SPECIES[0])];
  startView(st.map(x => x.g), st.map(x => x.name), {mode: 'idle-run'});
  for (let i = 0; i < 2.6 / DT; i++) stepRace(VIEW.R);
  updateCamera(true);
  drawScene($('view'), VIEW.R, VIEW.cams, {labels: VIEW.labels, progressH: 0});
  document.title = 'ready';
} else {
  idleRun();
  requestAnimationFrame(loop);
}

window.__dino = {VIEW, get ranch() { return ranch; }, get kids() { return kids; }, get prog() { return prog; }, stepView, finishView, startView, setTab, openDetail, openPick};
