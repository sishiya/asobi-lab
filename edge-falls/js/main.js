'use strict';
// 入力・ループ・章の進み。デバッグ用に window.__ef
const cv = $('view'), ctx = cv.getContext('2d'), field = $('field');
const G = { speed: 1, lastSpeed: 1, tool: 'look', hand: null, sub: { soil: 'dig', life: 'seed' }, ch: 0, chT: 0, streak: 0, helped: 0,
  done: [], found: {}, did: {}, tipped: {}, unlock: {}, started: false, sel: null };
const THUMB = new URLSearchParams(location.search).has('thumb');
let hover = null, ptr = null;
let accPlant = 0, accHist = 0, accSide = 0, prevCounts = null;

// story=true: 章で遊ぶ（岩と土だけの大地から）。false: 自由な箱庭（いまある大地・全部そろう）
function newGame(seed = (Math.random() * 1e9) | 0, story = true) {
  newWorld(seed, story); resetLife(); HIST.length = 0;
  V.yaw = Math.PI / 2 - W.bigFall + 0.35;   // いちばん大きな滝（はじめの章は湖のくぼみ）が手前に
  V.panX = V.panY = 0;
  G.sel = null; G.done = []; G.found = {}; G.did = {}; G.tipped = {};
  prevCounts = { deer: 0, wolf: 0, fish: 0, bird: 0 };
  if (story) { for (const k in W.stock) W.stock[k] = 0; enterChapter(0, true); }
  else { G.ch = CHAPTERS.length; G.unlock = unlockedAt(G.ch); W.knob = { winter: 1, tide: 1 }; for (const k in W.stock) W.stock[k] = STOCK_MAX[k]; }
  setHand(null);
}

function resize() {
  const r = field.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout(r.width, r.height);
  if (G.hand) syncHands();
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
    if (accPlant >= 0.25) {
      stepMoist(accPlant); stepPlants(accPlant); updateLight(); stepClimate(accPlant); accPlant = 0;
      const se = seasonOf();
      if (G.season !== undefined && se !== G.season) { G.seasonMsg = se; if (se === 0) springGift(); }   // 季節が変わった（知らせはループで）
      G.season = se;
    }
    accHist += h;
    if (accHist >= DAY / 2) { accHist = 0; recordHist(waterStats()); }
    if (Math.floor(W.t / DAY) !== dayBefore) {
      W.day = Math.floor(W.t / DAY) + 1;
      returnSouls();
      G.needSave = true;                    // 1日ごとに自動セーブ（ループの中で）
    }
    if (!(G.ch % 1)) tickChapter(h, lastStats);
  }
}
let lastStats = null;

// 去った命が深淵からつぼへ戻る（1日ごと。v011）。いなくなった種類は、少なくとも1つ戻る（取り返しがつかないことは起きない）
function returnSouls() {
  let back = 0;
  for (const k of ['deer', 'wolf', 'fish', 'bird']) {
    if (!G.unlock[k]) { W.souls[k] = 0; continue; }
    let n = Math.floor(W.souls[k]); W.souls[k] -= n;
    if (L.counts[k] === 0 && W.stock[k] === 0 && n === 0) n = 1;
    const room = STOCK_MAX[k] - W.stock[k], add = Math.min(room, n);
    if (add > 0) { W.stock[k] += add; back += add; }
  }
  if (back) { W.flags.ret = 1; glowHand('deer'); }
}
function springGift() {
  for (const k of ['deer', 'wolf', 'fish', 'bird']) if (G.unlock[k]) W.stock[k] = Math.min(STOCK_MAX[k], W.stock[k] + 1);
}

function checkWorld(dt) {
  const s = waterStats(); lastStats = s;
  // いなくなった知らせ（責めない）
  for (const k of ['deer', 'wolf', 'fish', 'bird']) {
    if (prevCounts[k] > 0 && L.counts[k] === 0) { toast(KINDS[k].name + 'が いなくなった。命は深淵を通って、いつかつぼへ戻ってくる', 5); Sound.play('extinct'); }
    prevCounts[k] = L.counts[k];
  }
  const falls = W.events.filter(e => e.type === 'die' && e.how === 'fall').length;
  if (falls && Math.random() < 0.5) Sound.play('splash');
  for (const e of W.events) if (e.type === 'die' && e.a === G.sel) G.sel.how = e.how;
  W.events.length = 0;
  stepChapter(s, dt); stepFinds(s, dt); stepTips(dt);
  return s;
}

const SEASON_MSG = ['春になった。雪がとけ、草がまた伸びはじめる。つぼにも命が一つずつ', '夏になった。太陽の道が内がわへ', '秋になった。草の伸びがおそくなる', '冬になった。太陽の道が外がわへ'];

// ---- 入力 ----
const RAD = { raise: 3.2, dig: 3.2, grass: 3, spring: 1.2, deer: 1, wolf: 1, fish: 1, bird: 1 };
const TOOLCOL = { raise: '#ffe9b0', dig: '#e8b48a', grass: '#b8e890', spring: '#bfe6ff', deer: '#e8c49a', wolf: '#c8ccd8', fish: '#ffc890', bird: '#e0e8f0' };

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

const RESULT = { empty: 'つぼの中に、もういない。去った命は、いつか戻ってくる', needwater: 'サカナは水の中へ放す', needland: '陸に放す', cap: 'これ以上は住めない', no: '' };
function useTool(p, first) {
  const t = G.tool;
  if (t === 'raise' || t === 'dig') {
    const m = sculpt(p.x, p.y, (t === 'raise' ? 1 : -1) * 0.9 * (first ? 1 : 0.5));
    if (t === 'raise' && W.soil < 1 && (first || !G.soilWarn)) { toast('土ぶくろがからっぽ。どこかを「削る」と、土がたまる', 4); Sound.play('no'); G.soilWarn = 1; }
    if (W.soil >= 1) G.soilWarn = 0;
    drawMeters();
    if (Math.abs(m) > 0.05 && Math.random() < 0.4) Sound.play('soil');
    G.did.soil = 1;
  } else if (t === 'grass') {
    if (sow(p.x, p.y) > 0 && first) Sound.play('sow');
  } else if (t === 'spring' && first) {
    const r = addSpring(p.x, p.y);
    if (r === 'max') { toast('これ以上、泉はわかせられない。泉を押すと止められる'); Sound.play('no'); }
    else if (r === 'dry') { toast('深淵がからっぽで、泉がわかない。滝から水が帰ってくるのを待つ'); Sound.play('no'); }
    else if (r === 'off') { toast('泉を止めた'); Sound.play('pin'); }
    else if (r === 'on') { toast('泉がまたわき出した'); Sound.play('spring'); }
    else if (r === 'new') { if (!G.did.spring) toast('深淵の水がわき出した。泉を押すと止まる'); Sound.play('spring'); G.did.spring = 1; }
  } else if (KINDS[t]) {
    const r = release(t, p.x + (first ? 0 : (Math.random() - 0.5) * 2), p.y + (first ? 0 : (Math.random() - 0.5) * 2));
    if (r === 'ok') { Sound.play('put'); syncHands(); }
    else if (first && RESULT[r]) { toast(RESULT[r]); Sound.play('no'); }
  }
}

// 指が2本: 平行移動とピンチで寄る
const touches = new Map();
let pinch = null;
function pinchState() { const [a, b] = [...touches.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) }; }
function panBy(dx, dy) { V.panX = (V.panX || 0) + dx; V.panY = (V.panY || 0) + dy; layout(V.cw, V.ch); }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('dblclick', e => { const p = local(e); if (!pick(p.x, p.y) && !hitBody(p)) { V.panX = V.panY = 0; layout(V.cw, V.ch); } });   // 空をダブルクリックで真ん中へ

cv.addEventListener('pointerdown', e => {
  if (!G.started) return;
  Sound.unlock();
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 捕まえられなくても動かす */ }
  const p = local(e);
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, p);
    if (touches.size === 2) {                      // 2本目の指: いまの操作をやめて、平行移動・ピンチへ
      if (ptr && ptr.mode === 'body') W[ptr.body].drag = false;
      ptr = null; pinch = pinchState(); return;
    }
    if (touches.size > 2) return;
  }
  const b = COL ? null : hitBody(p);
  ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: 0, t: 0 };
  // まん中のボタン・Shift を押しながら: 平行移動。右ボタン: 回す（土や命を持ったままでも。2026-10-13 ユーザー）
  if (e.button === 1 || e.shiftKey) { ptr.mode = 'pan'; cv.classList.add('grabbing'); return; }
  if (e.button === 2) { ptr.mode = 'view'; ptr.right = true; cv.classList.add('grabbing'); return; }
  if (b) { ptr.mode = 'body'; ptr.body = b; W[b].drag = true; Sound.play('grab'); G.did[b] = 1; return; }
  const w = G.tool === 'look' || COL ? null : pick(p.x, p.y);
  if (w) { ptr.mode = 'tool'; ptr.w = w; useTool(w, true); }
  else { ptr.mode = 'view'; cv.classList.add('grabbing'); }
});
cv.addEventListener('pointermove', e => {
  const p = local(e);
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, p);
    if (pinch && touches.size === 2) {
      const n = pinchState();
      panBy(n.x - pinch.x, n.y - pinch.y);
      V.zoom = Math.max(0.6, Math.min(3, V.zoom * n.d / pinch.d));
      let da = n.a - pinch.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      V.yaw -= da;                                   // 2本指でひねると回る（スマホ。手に持っていても回せる）
      layout(V.cw, V.ch); G.did.rotate = 1;
      pinch = n; return;
    }
  }
  if (ptr && e.pointerId === ptr.id) {
    const dx = p.x - ptr.x, dy = p.y - ptr.y;
    ptr.moved += Math.abs(dx) + Math.abs(dy); ptr.x = p.x; ptr.y = p.y;
    if (ptr.mode === 'view') {
      V.yaw -= dx * 0.008;                                            // 手前の地面が手の動きについてくる向き（2026-10-12 ユーザー「逆かも」）
      V.tilt = Math.max(0.32, Math.min(0.92, V.tilt + dy * 0.002));   // 下へ引くと真上から見る向きへ（2026-10-12 ユーザー「上下も逆かも」）
      layout(V.cw, V.ch);
      if (ptr.moved > 30) G.did.rotate = 1;
    }
    else if (ptr.mode === 'pan') panBy(dx, dy);
    else if (ptr.mode === 'body') { W[ptr.body].a = bodyAngle(p); updateLight(); }
    else if (ptr.mode === 'tool') { const w = pick(p.x, p.y); if (w) ptr.w = w; }
  }
  if (G.tool !== 'look' && !COL && (!ptr || ptr.mode === 'tool')) {
    const w = pick(p.x, p.y);
    hover = w ? { x: w.x, y: w.y, z: w.z, r: RAD[G.tool], color: TOOLCOL[G.tool] } : null;
  } else hover = null;
});
function endPtr(e) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (!ptr || e.pointerId !== ptr.id) return;
  if (ptr.mode === 'body') {
    const b = W[ptr.body]; b.drag = false;
    if (ptr.moved < 6) { b.stop = !b.stop; Sound.play('pin'); toast((ptr.body === 'sun' ? '太陽' : '月') + (b.stop ? 'を止めた' : 'がまた動き出した')); }
    else Sound.play('release');
  }
  else if (ptr.mode === 'view' && ptr.moved < 6 && !COL && !ptr.right) {          // 手があいているとき押した: 近くの生き物の札を出す
    const w = pick(ptr.x, ptr.y);
    let best = null, bd = 2.2 * 2.2;
    if (w) for (const a of L.list) { const d = (a.x - w.x) ** 2 + (a.y - w.y) ** 2; if (d < bd) { bd = d; best = a; } }
    G.sel = best; if (best) Sound.play('click'); updateCard();
    if (G.hand && !w) { setHand(null); Sound.play('release'); }   // 何もない空を押すと手放す（2026-10-13 ユーザー）
  }
  cv.classList.remove('grabbing');
  ptr = null;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => { if (!ptr) hover = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); G.did.rotate = 1; }, { passive: false });
function zoomBy(k) { V.zoom = Math.max(0.6, Math.min(3, V.zoom * k)); layout(V.cw, V.ch); }

// 押しているあいだ、なめらかに動く（2026-10-13 ユーザー「カカカではなく、スーっと」）。キーのくりかえしは使わない
const held = new Set();
const MOVE_KEYS = ['w', 'a', 's', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
addEventListener('keyup', e => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener('blur', () => held.clear());
function moveByKeys(dt) {
  if (!held.size) return;
  const has = k => held.has(k);
  const pan = 480 * dt * Math.max(0.6, V.zoom), rot = 1.6 * dt, tl = 0.5 * dt;   // 寄っているほど速く（2026-10-13 ユーザー）
  if (has('a') || has('d') || has('w') || has('s')) { V.panX = (V.panX || 0) + (has('a') ? pan : 0) - (has('d') ? pan : 0); V.panY = (V.panY || 0) + (has('w') ? pan : 0) - (has('s') ? pan : 0); }
  if (has('ArrowLeft')) V.yaw += rot;
  if (has('ArrowRight')) V.yaw -= rot;
  if (has('ArrowUp')) V.tilt = Math.max(0.32, V.tilt - tl);
  if (has('ArrowDown')) V.tilt = Math.min(0.92, V.tilt + tl);
  G.did.rotate = 1;
  layout(V.cw, V.ch);
}
addEventListener('keydown', e => {
  if (e.target.closest && (e.target.closest('dialog') || e.target.closest('select'))) return;
  if (!$('overlay').hidden && e.key !== 'Escape') return;     // 札が出ているあいだは、Esc のほかは世界を動かさない
  const mk = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (MOVE_KEYS.includes(mk)) { held.add(mk); e.preventDefault(); return; }
  if (e.key === ' ') {           // 連打・押しっぱなしでは切りかわらない（0.35 秒あける）
    const now = performance.now();
    if (!e.repeat && G.started && !COL && !G.menuOpen && $('overlay').hidden && now - (G.spaceT || 0) > 350) { G.spaceT = now; setSpeed(G.speed ? 0 : G.lastSpeed); Sound.play('pin'); G.did.speed = 1; }
  }
  else if (e.key === 'Escape') {
    if (!$('book').hidden) closeBook();
    else if (G.menuOpen) { $('overlay').hidden = true; G.menuOpen = false; if (menuSpeed !== null) { setSpeed(menuSpeed); menuSpeed = null; } }
    else if ($('overlay').hidden) openMenu();
  }
  else if (e.key === '1' || e.key === '2' || e.key === '3') {
    const h = ['soil', 'water', 'life'][+e.key - 1], ok = { soil: G.unlock.soil, water: G.unlock.water, life: G.unlock.seed }[h];
    if (ok) setHand(G.hand === h ? null : h);
  }
  else if (e.key === '+' || e.key === '=') zoomBy(1.2);
  else if (e.key === '-') zoomBy(1 / 1.2);
  else if (mk === 'b' && G.started) $('book').hidden ? openBook() : closeBook();
  else return;
  e.preventDefault();
});

// ボタンを押したあとに残る「選ばれた状態」でスペースがボタンを押さないように（スペースはいつも時を止める・動かす）
addEventListener('keyup', e => { if (e.key === ' ' && !(e.target.closest && e.target.closest('dialog, select, input'))) e.preventDefault(); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.hand, .speeds button, .dialbtn, .fan button, .bookbtn, .menubtn'); if (b) b.blur(); });
function setSpeed(v) {
  G.speed = v; if (v) G.lastSpeed = v;
  document.body.classList.toggle('paused', v === 0 && G.started);
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === G.speed));
  drawDial();
}
document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { Sound.unlock(); setSpeed(+b.dataset.speed); Sound.play(+b.dataset.speed ? 'click' : 'pin'); G.did.speed = 1; }));

// 世界をくずす（v010。見せるだけで、もとにもどせる）
$('btnBreak').onclick = () => { if (COL) return; closeBook(); showPanel('<h2>世界をくずす</h2><p>この大地をくずしてみる。見せるだけなので、いつでも「もとにもどす」で、いまの世界にもどれる。</p>',
  [{ label: '崩れ落ちる', main: true, fn: () => startCollapse('fall') }, { label: '殻がはがれる', main: true, fn: () => startCollapse('shell') }, { label: 'やめる' }]); };
$('btnRestore').onclick = () => { if (COL) { $('overlay').hidden = true; if (COL.ending) endingPanel(); else endCollapse(); } };

// ルックと背景（実験。2026-10-13 ユーザー）。v011 から観察帳の「てびき」の頁に
const lookSel = document.getElementById('lookSel'), backSel = document.getElementById('backSel');
lookSel.value = STYLES[styleName] ? styleName : 'voxel'; backSel.value = backName === 'auto' || BACKS[backName] ? backName : 'dark';
lookSel.addEventListener('change', () => { setStyle(lookSel.value); lookSel.blur(); });
backSel.addEventListener('change', () => { setBack(backSel.value); backSel.blur(); });

function syncSoundBtns() {
  document.querySelectorAll('.btnBgm').forEach(b => b.setAttribute('aria-pressed', Sound.get('bgm')));
  $('btnSfx').setAttribute('aria-pressed', Sound.get('sfx'));
}
document.querySelectorAll('.btnBgm').forEach(b => b.addEventListener('click', () => { Sound.unlock(); Sound.set('bgm', !Sound.get('bgm')); syncSoundBtns(); }));
$('btnSfx').onclick = () => { Sound.unlock(); Sound.set('sfx', !Sound.get('sfx')); syncSoundBtns(); Sound.play('click'); };
$('btnAbout').onclick = () => $('about').showModal();
$('btnSave').onclick = () => { Sound.unlock(); closeBook(); openSavePanel(null, 'save'); };
$('btnLoad').onclick = () => { Sound.unlock(); closeBook(); openSavePanel(null, 'load'); };
$('btnReset').onclick = () => { closeBook(); showPanel('<h2>最初から</h2><p>新しい大地で、第一の年からやり直す。いまの世界は、セーブのスロットに残していなければ消える（自動セーブも次の日に上書きされる）。</p>',
  [{ label: '第一の年から', main: true, fn: () => { newGame(); G.started = true; enterChapter(0); } }, { label: '自由な箱庭で', fn: () => { newGame(undefined, false); G.started = true; } }, { label: 'やめる' }]); };

// ---- ループ ----
let last = performance.now(), animT = 0;
// 絵の時計（雨・滝・さざ波・生き物の足などの動き）。時を止めると止まる。速くすると少しだけ速く（×4 で 1.25 倍、×16 で 1.75 倍。2026-10-13 ユーザー）
const ANIM_RATE = { 0: 0, 1: 1, 4: 1.25, 16: 1.75 };   // 時そのものは倍率どおり（simulate に dt×速さ）
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!(G.started && G.speed === 0 && !COL)) animT += dt * (COL || !G.started ? 1 : ANIM_RATE[G.speed] ?? 1);
  const t = animT;
  if (!V.cw) resize();
  moveByKeys(dt); stepLater(dt);
  if (G.started && G.speed > 0 && !COL) simulate(dt * G.speed);
  if (ptr && ptr.mode === 'tool' && G.tool !== 'spring') {
    ptr.t += dt;
    const every = KINDS[G.tool] ? 0.3 : 0.05;
    if (ptr.t >= every) { ptr.t = 0; useTool(ptr.w, false); }
  }
  const s = checkWorld(G.started && !COL ? dt * G.speed : 0);
  if (G.needSave && !THUMB) { G.needSave = false; autoSave(); }
  if (G.seasonMsg !== undefined) {
    toast(SEASON_MSG[G.seasonMsg], 4); Sound.play('spring'); G.seasonMsg = undefined;
  }
  accSide += dt;
  if (accSide > 0.25) { accSide = 0; updateSide(s); }
  if (V.cw > 1 && V.ch > 1) { drawWorld(ctx, t, hover); takeSketch(); drawSpots(ctx, t); }   // 見えていないと大きさが 0
  Sound.update(COL ? 0 : s.out, !G.started || G.speed === 0 || !!COL, Math.max(0, Math.min(1, (V.zoom - 1.2) / 1.0)));   // 滝の音は寄ったときだけ
  requestAnimationFrame(frame);
}

// はじめの画面: 世界の上に題と、ことばだけ（四角い箱を出さない）
function start() {
  const cont = readSlot('auto');
  document.body.classList.add('titling');
  const go = fn => () => { document.body.classList.remove('titling'); fn(); };
  showPanel(`<h2 class="title">果ての滝の箱庭</h2>
    <p class="sub">深淵に浮かぶ、平らな大地。<br>川は、世界の果てから滝になって落ちていく。</p>
    <p class="sub">何も生まれず、何も消えない。ただ、めぐるだけ。</p>` + (cont ? `<p class="small">つづき: ${metaText(cont)}</p>` : ''),
    (cont ? [{ label: 'つづきから', main: true, fn: go(async () => {
      try { await loadRecord(cont); G.started = true; toast('第 ' + W.day + ' 日から'); }
      catch (e) { toast('つづきを読みこめなかった: ' + e.message); G.started = true; enterChapter(0); }
      syncHands();
    }) }, { label: 'はじめから', fn: go(() => { G.started = true; enterChapter(0); }) }]
      : [{ label: 'はじめる', main: true, fn: go(() => { G.started = true; enterChapter(0); }) }]).concat([{ label: '自由な箱庭', fn: go(() => { newGame(undefined, false); G.started = true; syncHands(); }) }]));
  $('panel').classList.add('titlecard');
}

// ---- はじめ ----
newGame();
syncSoundBtns();
resize();
if (THUMB) {
  document.body.classList.add('thumb'); document.body.classList.remove('titling');
  newGame(7, false); resize(); G.started = true;
  V.tilt = 0.5; layout(V.cw, V.ch);
  simulate(20);
  const sx = W.lake ? C + W.lake.x * RD : C, sy = W.lake ? C + W.lake.y * RD : C;
  for (let k = 0; k < 6; k++) release('fish', sx + (k % 3 - 1), sy + (k / 3 | 0));
  W.stock = { deer: 20, wolf: 4, fish: 0, bird: 2 };
  for (let k = 0; k < 14; k++) { const a = k * 0.7, r = 10 + k; release('deer', C + Math.cos(a) * r, C + Math.sin(a) * r); }
  release('wolf', C + 5, C - 8); release('wolf', C - 8, C + 6);
  release('bird', sx + 3, sy + 2); release('bird', sx - 2, sy + 3);
  simulate(25);
  setSpeed(0);              // 止めた絵を描きつづける（大きさが変わっても消えないように）
  requestAnimationFrame(frame);
} else {
  start();
  requestAnimationFrame(frame);
}

window.__ef = { W, L, G, V, setStyle, setBack, step: s => { simulate(s); checkWorld(s); updateSide(lastStats); }, setSpeed, newGame, stats: () => waterStats(), setHand, enterChapter, finishChapter, makePrint };
