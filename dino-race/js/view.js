// 走るようす: かけっこ・1匹の走り・練習場の場面、カメラ、速さの切りかえ、結果へ。

// ---------- 走るようす ----------
const VIEW = {R: null, labels: [], speed: 1, acc: 0, mode: 'idle', cams: [], ghosts: [], onEnd: null, count: 0, heard: [],
  fx: [], clock: 0, hold: 0}; // fx: レーンごとの演出（足あと・土ぼこり・判子・揺れ）、clock: 演出の時計（本当の時間）、hold: ヒットストップの残り秒
const HITSTOP = 0.15, MAX_TRACKS = 28;
const LINGER = 0.9; // 最後の1匹が決着してから結果を出すまで（本当の時間の秒）
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
  VIEW.fx = genomes.map(() => ({tracks: [], touch: [false, false], last: [null, null], dust: [], stamp: null, shake: null}));
  VIEW.hold = 0; VIEW.linger = 0;
  VIEW.count = 0; showCount(null);
  if (mode === 'race') { VIEW.count = COUNT_T; showCount('位置について'); SFX.play('ready'); }
  updateCamera(true);
  const live = mode !== 'idle-run';
  document.body.classList.toggle('racing', live); // かけっこ・走りを見る間は、走るようすを画面いっぱいに（ほかは隠す）
  $('stage').style.setProperty('--lanes', genomes.length); // 縦長の画面では、レーンの数に合わせた高さにして、下に実況の板
  VIEW.boardT = 0; if (live) renderBoard(VIEW.R);
  $('btnSkip').hidden = !live;
  if (live && $('sheet').open) closeSheet();
}

function dinoHeight(d) { return Math.max(d.r.neckEnd[1], d.r.headEnd[1]) + d.p.thick.head; }

// レーンごとに、その恐竜が収まる縮尺で追いかける（大きさのちがいは物差しとカードの体重で見せる）
function updateCamera(snap = false) {
  const {W, H} = viewSize(), ds = VIEW.R ? VIEW.R.dinos : [];
  if (!ds.length || !W) return;
  const title = document.body.classList.contains('titled');
  const laneH = (H - (title ? 0 : PROGRESS_H)) / ds.length;
  VIEW.cams = ds.map((d, i) => {
    const long = d.r.headEnd[0] - d.r.tailEnd[0];
    // タイトルの背景: 体の長さが画面の幅の 3/4 ほど（高さは画面の 17% まで。パネルにかからないように）で、体のまん中を画面のまん中に
    const scale = title ? Math.min(W / (long * 1.35), H * 0.17 / dinoHeight(d)) : Math.min((laneH - 52) / (dinoHeight(d) * 1.15), W / (long * 2.4));
    const want = title ? d.dist + d.x0 + (d.r.headEnd[0] + d.r.tailEnd[0]) / 2 - (W / scale) * 0.5 : d.dist + d.x0 - (W / scale) * 0.55;
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
  VIEW.clock += Math.min(dt, 0.1); // 演出の時計は、止まっていても・再生の速さによらず本当の時間で進む
  const R = VIEW.R; if (!R || VIEW.mode === 'idle') return;
  if (VIEW.count > 0) { stepCount(dt); $('hudText').textContent = 'スタートの合図を待っています'; if (VIEW.count > 0) return; }
  if (VIEW.linger > 0) { VIEW.linger -= Math.min(dt, 0.1); if (VIEW.linger <= 0) finishView(); return; } // 決着のあと、判子を見せてから結果へ
  if (VIEW.hold > 0) { VIEW.hold -= Math.min(dt, 0.1); return; } // ヒットストップ（ゴールの瞬間に少し止める）
  VIEW.acc += Math.min(dt, 0.1) * VIEW.speed;
  let n = 0;
  while (VIEW.acc >= DT && n < 40) {
    stepRace(R); VIEW.acc -= DT; n++;
    trackFeet(R);
    if (raceOver(R)) { listen(R); if (VIEW.mode === 'idle-run') finishView(); else { VIEW.linger = LINGER; renderBoard(R); } return; }
  }
  listen(R);
  if (VIEW.mode === 'idle-run') return;
  if ((VIEW.boardT -= Math.min(dt, 0.1)) <= 0) { VIEW.boardT = 0.1; renderBoard(R); }
  $('hudText').textContent = `${R.t.toFixed(1)}秒` + R.dinos.map((d, i) => ` ・ ${i + 1} ${d.finishT != null ? 'ゴール' : Math.max(0, d.dist).toFixed(0) + 'm' + (d.fell ? '（転んだ）' : '')}`).join('');
}

// 足あと: 指（foot の体）が地面につきはじめた瞬間に、その位置と大きさをレーンごとにためる
function trackFeet(R) {
  R.dinos.forEach((d, i) => {
    const L = VIEW.fx[i]; if (!L || d.fell || d.removed) return;
    d.legs.forEach((leg, j) => {
      let touch = false;
      for (let ce = leg.foot.getContactList(); ce; ce = ce.next) if (ce.contact.isTouching()) { touch = true; break; }
      if (touch && !L.touch[j]) {
        const x = leg.foot.getPosition().x;
        if (L.last[j] == null || Math.abs(x - L.last[j]) > leg.foot.len * 0.5) {
          L.tracks.push({x, len: leg.foot.len, leg: j}); L.last[j] = x;
          if (L.tracks.length > MAX_TRACKS) L.tracks.shift();
        }
      }
      L.touch[j] = touch;
    });
  });
}

// 土ぼこりの粒（点描）。big: 練習場では控えめに
function makeDust(d, big) {
  const n = big ? 42 : 18, spread = big ? 46 : 26, parts = [];
  for (let k = 0; k < n; k++) {
    const side = Math.random() * 2 - 1;
    parts.push({vx: side * spread * (0.4 + Math.random() * 0.6), vy: Math.random() * spread * 0.45, r: 0.6 + Math.random() * 1.1, o: 0.5 + Math.random() * 0.5, up: Math.random()});
  }
  return {x: d.torso.getPosition().x, t0: VIEW.clock, parts};
}

// ゴールした・転んだ瞬間: 音・判子・ヒットストップ・揺れ・土ぼこり（音は同じ時に何匹でも1回）。練習場では土ぼこりだけ
function listen(R) {
  const live = VIEW.mode !== 'idle-run';
  let goal = false, fell = false;
  R.dinos.forEach((d, i) => {
    const h = VIEW.heard[i], L = VIEW.fx[i]; if (!h) return;
    const rot = (i % 2 ? 1 : -1) * (0.08 + Math.random() * 0.1), seed = Math.floor(Math.random() * 1e9);
    if (d.finishT != null && !h.goal) {
      h.goal = goal = true;
      if (live && L) L.stamp = {t0: VIEW.clock + 0.04, small: 'ゴール', big: d.finishT.toFixed(2), foot: '秒', rot, seed};
    }
    if (d.fell && !h.fell) {
      h.fell = true;
      const after = d.finishT != null; // ゴールしたあとの走り抜けで転んだときは、土ぼこりだけ（判子はゴールのまま）
      if (!after) fell = true;
      if (L) {
        L.dust.push(makeDust(d, live));
        if (live && !after) { L.shake = VIEW.clock; L.stamp = {t0: VIEW.clock + 0.12, small: Math.max(0, d.dist).toFixed(1) + 'm', big: '転倒', foot: '', rot, seed}; }
      }
    }
  });
  if (!live) return;
  if (goal) { SFX.play('goal'); SFX.play('stamp'); if (VIEW.mode !== 'idle') VIEW.hold = HITSTOP; }
  if (fell) SFX.play('fall');
}

// 足あとから推定した速さ（Alexander 1976）: v = 0.25 g^0.5 λ^1.67 h^-1.17。λ は1歩の周期（左右1回ずつ）で進んだ長さ
function alexander(d, t, dist) {
  if (t <= 0 || dist <= 0) return null;
  const strides = t / d.T, lambda = dist / strides, h = d.hipY0;
  return {v: 0.25 * Math.sqrt(GRAV) * Math.pow(lambda, 1.67) * Math.pow(h, -1.17), lambda};
}

// 実況の板（縦長の画面のかけっこの間だけ。CSS）: 名前・進んだ距離の帯・ゴールのタイムか転倒
function renderBoard(R) {
  const order = R.dinos.map((d, i) => ({d, i})).sort((a, b) => (b.d.finishT != null) - (a.d.finishT != null) || (a.d.finishT ?? 0) - (b.d.finishT ?? 0) || b.d.dist - a.d.dist);
  $('board').innerHTML = order.map(({d, i}) => {
    const dist = Math.max(0, Math.min(FINISH, d.dist));
    const st = d.finishT != null ? `ゴール ${fmtT(d.finishT)}` : d.fell ? `転倒 ${dist.toFixed(1)}m` : `${dist.toFixed(0)}m`;
    return `<li class="${d.finishT != null ? 'goal' : d.fell ? 'fell' : ''}"><span class="no">${i + 1}</span><span class="nm">${esc(VIEW.labels[i])}</span><span class="st">${st}</span><span class="bar"><i style="width:${dist}%"></i></span></li>`;
  }).join('') + VIEW.ghosts.map(g => { const x = Math.min(FINISH, FINISH * R.t / g.t); return `<li class="ghost"><span class="no">–</span><span class="nm">${esc(g.short)}（目安）</span><span class="st">${x >= FINISH ? fmtT(g.t) : x.toFixed(0) + 'm'}</span><span class="bar"><i style="width:${x}%"></i></span></li>`; }).join('');
}

function finishView() {
  const R = VIEW.R, mode = VIEW.mode, cb = VIEW.onEnd;
  const results = R.dinos.map((d, i) => {
    const ok = d.finishT != null, t = ok ? d.finishT : d.fell ? d.fellT : R.t, dist = ok ? FINISH : Math.max(0, d.dist);
    return {i, label: VIEW.labels[i], ok, t, dist, fell: d.fell, finishT: d.finishT, v: dist / Math.max(t, 0.01), a: alexander(d, t, dist)};
  });
  VIEW.mode = 'idle'; VIEW.onEnd = null; VIEW.count = 0;
  showCount(null);
  document.body.classList.remove('racing');
  $('btnSkip').hidden = true;
  if (mode === 'idle-run') { setTimeout(idleRun, 1200); return; }
  $('hudText').textContent = results.map(r => `${r.label} ${r.ok ? fmtT(r.t) : (r.fell ? `${r.dist.toFixed(0)}mで転倒` : `${r.dist.toFixed(0)}m`)}`).join(' ・ ');
  if (cb) cb(results);
}

// 練習場: 何もしていないときは、牧場の速い恐竜（3匹まで）が走っている
function idleRun() {
  if (VIEW.mode !== 'idle') return;
  const n = document.body.classList.contains('titled') || innerWidth < 640 ? 1 : 2; // 練習場は牧場の画面の上に小さく出すので、タイトルとスマホでは1匹、広い画面では2匹
  const list = [...ranch].filter(x => x.rec && x.rec.finishT != null).sort((a, b) => a.rec.finishT - b.rec.finishT).slice(0, n);
  const use = list.length ? list : ranch.slice(0, n);
  startView(use.map(x => x.g), use.map(x => x.name), {mode: 'idle-run'});
  $('hudText').textContent = '牧場の恐竜が、練習場を走っています';
}

function loop(now) {
  const dt = lastT ? (now - lastT) / 1000 : 0; lastT = now;
  // 走るようすが出ていない画面（大会・記録帳など）の練習場は、計算も描くのも休む
  const shown = $('stage').getClientRects().length > 0;
  if (shown || VIEW.mode !== 'idle-run') stepView(dt);
  const title = document.body.classList.contains('titled');
  if (VIEW.R && shown) { updateCamera(); drawScene($('view'), VIEW.R, VIEW.cams, {title, labels: VIEW.labels, progressH: title ? 0 : PROGRESS_H, ghosts: VIEW.ghosts, fx: VIEW.fx, clock: VIEW.clock}); }
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
  listen(R); // 判子は残す（一気に終えたので止めはしない）
  finishView();
});

function watchRun(x) {
  const back = sheetKind === 'detail' ? sheetDino : null;
  // 走っている間は画面いっぱいの走るようすが上にかぶさるだけなので、終わるともとの画面・スクロールの位置のまま
  startView([x.g], [x.name], {mode: 'watch', onEnd: res => {
    toast(`${x.name}: ${res[0].ok ? '100m ' + fmtT(res[0].t) : res[0].fell ? res[0].dist.toFixed(1) + 'm で転んだ' : res[0].dist.toFixed(1) + 'm'}`);
    if (back && ranch.includes(back)) setTimeout(() => openDetail(back), 700);
  }});
}
