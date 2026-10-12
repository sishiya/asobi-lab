// 走るようす: かけっこ・1匹の走り・練習場の場面、カメラ、速さの切りかえ、結果へ。

// ---------- 走るようす ----------
const VIEW = {R: null, labels: [], speed: 1, acc: 0, mode: 'idle', cams: [], ghosts: [], onEnd: null, count: 0, heard: []};
const COUNT_T = 1.8; // かけっこの前の「位置について（0.9秒）・よーい（0.9秒）」。そのあと「ドン」で走りだす
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
  VIEW.heard = genomes.map(() => ({goal: false, fell: false})); // ゴール・転んだ音を1回ずつ
  VIEW.count = 0; showCount(null);
  if (mode === 'race') { VIEW.count = COUNT_T; showCount('位置について'); SFX.play('ready'); }
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

// スタートの合図（走るようすの上に大きく）
let countHideT = 0;
function showCount(text) {
  clearTimeout(countHideT);
  const el = $('count'); el.hidden = !text; if (!text) return;
  el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function stepCount(dt) {
  const before = VIEW.count; VIEW.count -= Math.min(dt, 0.1); // 合図は再生の速さに関係なく本当の時間で
  if (before > COUNT_T / 2 && VIEW.count <= COUNT_T / 2) { showCount('よーい'); SFX.play('ready'); }
  if (VIEW.count <= 0) {
    VIEW.count = 0; showCount('ドン！'); SFX.play('go');
    countHideT = setTimeout(() => showCount(null), 700);
  }
}

function stepView(dt) {
  const R = VIEW.R; if (!R || VIEW.mode === 'idle') return;
  if (VIEW.count > 0) { stepCount(dt); $('hudText').textContent = 'スタートの合図を待っています'; if (VIEW.count > 0) return; }
  VIEW.acc += Math.min(dt, 0.1) * VIEW.speed;
  let n = 0;
  while (VIEW.acc >= DT && n < 40) {
    stepRace(R); VIEW.acc -= DT; n++;
    if (raceOver(R)) { finishView(); return; }
  }
  if (VIEW.mode === 'idle-run') return;
  listen(R);
  $('hudText').textContent = `${R.t.toFixed(1)}秒` + R.dinos.map((d, i) => ` ・ ${i + 1} ${d.finishT != null ? 'ゴール' : Math.max(0, d.dist).toFixed(0) + 'm' + (d.fell ? '（転んだ）' : '')}`).join('');
}

// ゴールした・転んだ瞬間の音（同じ時に何匹でも1回）
function listen(R) {
  let goal = false, fell = false;
  R.dinos.forEach((d, i) => {
    const h = VIEW.heard[i]; if (!h) return;
    if (d.finishT != null && !h.goal) { h.goal = goal = true; }
    if (d.fell && !h.fell) { h.fell = fell = true; }
  });
  if (goal) SFX.play('goal');
  if (fell) SFX.play('fall');
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
  VIEW.mode = 'idle'; VIEW.onEnd = null; VIEW.count = 0;
  showCount(null);
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
