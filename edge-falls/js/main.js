'use strict';
// 入力・ループ・お題の進み。デバッグ用に window.__ef
const cv = $('view'), ctx = cv.getContext('2d'), field = $('field');
const G = { speed: 1, tool: 'look', qi: 0, qStart: 0, streak: 0, best: loadBest(), started: false, paused: false };
const THUMB = new URLSearchParams(location.search).has('thumb');
let hover = null, ptr = null;
let accPlant = 0, accHist = 0, accSide = 0, prevCounts = null;

function newGame(seed = (Math.random() * 1e9) | 0) {
  newWorld(seed); resetLife(); HIST.length = 0;
  V.yaw = Math.PI / 2 - W.bigFall + 0.35;   // いちばん大きな滝が手前に
  G.qi = 0; G.qStart = 0; G.streak = 0;
  prevCounts = { deer: 0, wolf: 0, fish: 0 };
}

function resize() {
  const r = field.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout(r.width, r.height);
}
addEventListener('resize', resize);

// ---- 時を進める ----
function simulate(sec) {
  while (sec > 1e-6) {
    const h = Math.min(0.05, sec); sec -= h;
    const dayBefore = Math.floor(W.t / DAY);
    W.t += h;
    stepHeavens(h); stepWater(h, false); stepEvap(h); stepSky(h); stepLife(h);
    accPlant += h;
    if (accPlant >= 0.25) { stepMoist(accPlant); stepPlants(accPlant); updateLight(); accPlant = 0; }
    accHist += h;
    if (accHist >= DAY / 2) { accHist = 0; recordHist(waterStats()); }
    if (Math.floor(W.t / DAY) !== dayBefore) {
      W.day = Math.floor(W.t / DAY) + 1;
      for (const k in W.stock) W.stock[k] = Math.min(STOCK_MAX[k], W.stock[k] + 1);
    }
    if (G.qi === 3 || G.qi === 4) {
      if (questCond(G.qi, lastStats)) G.streak += h / DAY; else G.streak = 0;
    }
  }
}
let lastStats = null;

function checkWorld() {
  const s = waterStats(); lastStats = s;
  // いなくなった知らせ
  for (const k of ['deer', 'wolf', 'fish']) {
    if (prevCounts[k] > 0 && L.counts[k] === 0) { toast(KINDS[k].name + 'が いなくなった'); Sound.play('extinct'); }
    prevCounts[k] = L.counts[k];
  }
  const falls = W.events.filter(e => e.type === 'die' && e.how === 'fall').length;
  if (falls && Math.random() < 0.5) Sound.play('splash');
  W.events.length = 0;
  // お題
  if (G.started && G.qi < QUESTS.length) {
    const q = QUESTS[G.qi];
    if (q.prog(s) >= q.goal) {
      const days = Math.max(1, Math.ceil((W.t - G.qStart) / DAY));
      const st = questStars(G.qi, days);
      G.best[G.qi] = Math.max(G.best[G.qi] || 0, st); saveBest(G.best);
      Sound.play('win');
      const qi = G.qi;
      G.qi++; G.qStart = W.t; G.streak = 0;
      const last = G.qi >= QUESTS.length;
      showPanel(`<h2>${DAYNAME[qi]}の日「${q.title}」</h2><p class="stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</p><p>${days} 日でできた。</p><p class="truth"><b>本当は</b>　${q.truth}</p>` +
        (last ? '<p>5つのお題がすべておわった。あとは自由に、きみの世界をそだてよう。</p>' : `<p>次は${DAYNAME[G.qi]}の日「${QUESTS[G.qi].title}」: ${QUESTS[G.qi].text}。</p>`),
        [{ label: last ? 'つづける' : '次の日へ', main: true }]);
    }
  }
  return s;
}

// ---- 入力 ----
const RAD = { raise: 3.2, dig: 3.2, grass: 3, spring: 1.2, deer: 1, wolf: 1, fish: 1 };
const TOOLCOL = { raise: '#ffe9b0', dig: '#e8b48a', grass: '#b8e890', spring: '#bfe6ff', deer: '#e8c49a', wolf: '#c8ccd8', fish: '#ffc890' };

function setTool(t) {
  G.tool = t;
  document.querySelectorAll('#tools button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  cv.classList.toggle('tool', t !== 'look');
}
document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => { setTool(b.dataset.tool); Sound.play('click'); }));

function local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function hitBody(p) {
  for (const k of ['sun', 'moon']) { const b = bodyHit[k]; if (b && Math.hypot(p.x - b.x, p.y - b.y) < b.r + 10) return k; }
  return null;
}
function bodyAngle(p) {
  const o = proj(C, C, HS), c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const u = (p.x - o.x) / V.s, v = (p.y - o.y) / (V.s * V.tilt);
  return Math.atan2(-u * s + v * c, u * c + v * s);
}

const RESULT = { empty: '命のつぼがからっぽ（1日に1つずつふえる）', needwater: 'サカナは水の中へ放す', needland: '陸に放す', cap: 'これ以上は住めない', no: '' };
function useTool(p, first) {
  const t = G.tool;
  if (t === 'raise' || t === 'dig') {
    const m = sculpt(p.x, p.y, (t === 'raise' ? 1 : -1) * 0.9 * (first ? 1 : 0.5));
    if (t === 'raise' && W.soil <= 0 && first) toast('土ぶくろがからっぽ。どこかを「削る」と土がたまる');
    if (Math.abs(m) > 0.05 && Math.random() < 0.4) Sound.play('soil');
  } else if (t === 'grass') {
    if (sow(p.x, p.y) > 0 && first) Sound.play('sow');
  } else if (t === 'spring' && first) {
    const r = addSpring(p.x, p.y);
    if (r === 'max') { toast('泉は6つまで。泉を押すと止められる'); Sound.play('no'); }
    else if (r === 'off') { toast('泉を止めた'); Sound.play('pin'); }
    else if (r === 'on') { toast('泉がまたわき出した'); Sound.play('spring'); }
    else if (r === 'new') { toast('深淵の水がわき出した'); Sound.play('spring'); }
  } else if (KINDS[t]) {
    const r = release(t, p.x + (first ? 0 : (Math.random() - 0.5) * 2), p.y + (first ? 0 : (Math.random() - 0.5) * 2));
    if (r === 'ok') Sound.play('put');
    else if (first && RESULT[r]) { toast(RESULT[r]); Sound.play('no'); }
  }
}

cv.addEventListener('pointerdown', e => {
  if (!G.started) return;
  Sound.unlock();
  cv.setPointerCapture(e.pointerId);
  const p = local(e);
  const b = hitBody(p);
  ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: 0, t: 0 };
  if (b) { ptr.mode = 'body'; ptr.body = b; W[b].drag = true; Sound.play('grab'); return; }
  const w = G.tool === 'look' ? null : pick(p.x, p.y);
  if (w) { ptr.mode = 'tool'; ptr.w = w; useTool(w, true); }
  else { ptr.mode = 'view'; cv.classList.add('grabbing'); }
});
cv.addEventListener('pointermove', e => {
  const p = local(e);
  if (ptr && e.pointerId === ptr.id) {
    const dx = p.x - ptr.x, dy = p.y - ptr.y;
    ptr.moved += Math.abs(dx) + Math.abs(dy); ptr.x = p.x; ptr.y = p.y;
    if (ptr.mode === 'view') { V.yaw += dx * 0.008; V.tilt = Math.max(0.32, Math.min(0.92, V.tilt - dy * 0.002)); layout(V.cw, V.ch); }
    else if (ptr.mode === 'body') { W[ptr.body].a = bodyAngle(p); updateLight(); }
    else if (ptr.mode === 'tool') { const w = pick(p.x, p.y); if (w) ptr.w = w; }
  }
  if (G.tool !== 'look' && (!ptr || ptr.mode === 'tool')) {
    const w = pick(p.x, p.y);
    hover = w ? { x: w.x, y: w.y, z: w.z, r: RAD[G.tool], color: TOOLCOL[G.tool] } : null;
  } else hover = null;
});
function endPtr(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  if (ptr.mode === 'body') {
    const b = W[ptr.body]; b.drag = false;
    if (ptr.moved < 6) { b.stop = !b.stop; Sound.play('pin'); toast((ptr.body === 'sun' ? '太陽' : '月') + (b.stop ? 'を止めた' : 'がまた動き出した')); }
    else Sound.play('release');
  }
  cv.classList.remove('grabbing');
  ptr = null;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => { if (!ptr) hover = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
function zoomBy(k) { V.zoom = Math.max(0.6, Math.min(3, V.zoom * k)); layout(V.cw, V.ch); }
$('zoomIn').onclick = () => zoomBy(1.2);
$('zoomOut').onclick = () => zoomBy(1 / 1.2);

addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('dialog')) return;
  if (e.key === 'ArrowLeft') V.yaw -= 0.08;
  else if (e.key === 'ArrowRight') V.yaw += 0.08;
  else if (e.key === 'ArrowUp') V.tilt = Math.min(0.92, V.tilt + 0.03);
  else if (e.key === 'ArrowDown') V.tilt = Math.max(0.32, V.tilt - 0.03);
  else if (e.key === ' ') { setSpeed(G.speed ? 0 : 1); }
  else if (e.key >= '1' && e.key <= '8') setTool(['look', 'raise', 'dig', 'spring', 'grass', 'deer', 'wolf', 'fish'][+e.key - 1]);
  else return;
  e.preventDefault(); layout(V.cw, V.ch);
});

function setSpeed(v) {
  G.speed = v;
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === v));
}
document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { setSpeed(+b.dataset.speed); Sound.play('click'); }));

function syncSoundBtns() {
  document.querySelectorAll('.btnBgm').forEach(b => b.setAttribute('aria-pressed', Sound.get('bgm')));
  $('btnSfx').setAttribute('aria-pressed', Sound.get('sfx'));
}
document.querySelectorAll('.btnBgm').forEach(b => b.addEventListener('click', () => { Sound.unlock(); Sound.set('bgm', !Sound.get('bgm')); syncSoundBtns(); }));
$('btnSfx').onclick = () => { Sound.unlock(); Sound.set('sfx', !Sound.get('sfx')); syncSoundBtns(); Sound.play('click'); };
$('btnAbout').onclick = () => $('about').showModal();
$('btnReset').onclick = () => showPanel('<h2>最初から</h2><p>新しい大地で、第一の日からやり直す。</p>',
  [{ label: 'やり直す', main: true, fn: () => { newGame(); G.started = true; } }, { label: 'やめる' }]);

// ---- ループ ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000;
  if (G.started && G.speed > 0) simulate(dt * G.speed);
  if (ptr && ptr.mode === 'tool' && G.tool !== 'spring') {
    ptr.t += dt;
    const every = KINDS[G.tool] ? 0.3 : 0.05;
    if (ptr.t >= every) { ptr.t = 0; useTool(ptr.w, false); }
  }
  const s = checkWorld();
  accSide += dt;
  if (accSide > 0.25) { accSide = 0; updateSide(s); }
  drawWorld(ctx, t, hover);
  Sound.update(s.out, !G.started || G.speed === 0);
  requestAnimationFrame(frame);
}

function start() {
  showPanel(`<h2>果ての滝の箱庭</h2>
    <p>深淵に浮かぶ、平らな大地。川は世界の果てから滝になって落ちていく。</p>
    <ul>
      <li>下の道具で、地を<b>盛る・削る</b>、<b>泉</b>をわかせる、<b>草</b>のたねをまく、<b>シカ・オオカミ・サカナ</b>を放す。</li>
      <li>大地の外をドラッグすると回せる。太陽と月はつかんで動かせる。</li>
      <li>水・草・食べる・食べられるがつり合う世界をつくろう。お題は5つ。</li>
    </ul>`, [{ label: 'はじめる', main: true, fn: () => { G.started = true; G.qStart = W.t; } }]);
}

// ---- はじめ ----
newGame();
syncSoundBtns();
resize();
if (THUMB) {
  document.body.classList.add('thumb');
  newGame(7); resize(); G.started = true;
  V.tilt = 0.5; layout(V.cw, V.ch);
  simulate(20);
  const sx = W.lake ? C + W.lake.x * RD : C, sy = W.lake ? C + W.lake.y * RD : C;
  for (let k = 0; k < 6; k++) release('fish', sx + (k % 3 - 1), sy + (k / 3 | 0));
  W.stock = { deer: 20, wolf: 4, fish: 0 };
  for (let k = 0; k < 14; k++) { const a = k * 0.7, r = 10 + k; release('deer', C + Math.cos(a) * r, C + Math.sin(a) * r); }
  release('wolf', C + 5, C - 8); release('wolf', C - 8, C + 6);
  simulate(25);
  setSpeed(0);              // 止めた絵を描きつづける（大きさが変わっても消えないように）
  requestAnimationFrame(frame);
} else {
  start();
  requestAnimationFrame(frame);
}

window.__ef = { W, L, G, V, step: s => { simulate(s); checkWorld(); updateSide(lastStats); }, setSpeed, newGame, stats: () => waterStats(), setTool };
