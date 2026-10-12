'use strict';
// 画面の切りかえ（面えらび・あそぶ）、入力、ループ、面の始まりと終わりの札、記録（★）

const $ = id => document.getElementById(id);
const SAVE_KEY = 'asobi-lab/parasite-pilot/best-v1';
let best = {};
try { best = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { best = {}; }
function saveBest() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(best)); } catch (e) { /* 保存できなくても遊べる */ } }

const canvas = $('view'), ctx = canvas.getContext('2d');
const G = { pointer: { on: false, x: 0, y: 0 }, keys: {}, running: false };
let view = { s: 1, ox: 0, oy: 0 }, thumbMode = false;

/* ───── 面えらび ───── */
function starsOf(id) { return best[id] ? best[id].stars : 0; }
function renderMenu() {
  $('stageList').innerHTML = STAGES.map((S, i) => {
    const st = starsOf(S.id);
    return `<button type="button" class="stage-card" data-i="${i}">
      <span class="no">${i + 1}面 ・ 寄生者: ${S.parasite}</span>
      <b>${S.title}</b>
      <span class="route">${S.host} <i>→</i> ${S.next}</span>
      <span class="stars ${st ? '' : 'none'}">${st ? '★'.repeat(st) + '☆'.repeat(3 - st) + `　${best[S.id].time.toFixed(1)}秒` : 'まだ'}</span>
    </button>`;
  }).join('');
}
$('stageList').addEventListener('click', e => {
  const b = e.target.closest('.stage-card'); if (b) openStage(+b.dataset.i);
});

/* ───── 面を始める ───── */
function openStage(i) {
  G.si = i; G.S = STAGES[i];
  $('menu').hidden = true; $('play').hidden = false;
  resetStage();
  showIntro();
  fit();
  window.scrollTo(0, 0);
}
function resetStage() {
  const S = G.S;
  clearTimeout(endTimer);
  Object.assign(G, { t: 0, gauge: 100, tired: false, ability: false, will: null, pulled: false, pull: null, thought: '', meter: null, over: null, running: false });
  S.init(G);
  $('who').textContent = `${G.si + 1}面 ${S.title}（きみは${S.parasite}）`;
  $('mindWho').textContent = `${S.host}の気持ち`;
  $('btnAbility').textContent = S.abilityName;
  hideToast();
  updateHud();
  draw();
}
function showIntro() {
  const S = G.S;
  overlay(`<div class="panel">
    <h2>${G.si + 1}面 ${S.title}</h2>
    ${S.story.map(p => `<p>${p}</p>`).join('')}
    <h3>あそびかた</h3>
    <ul>${S.howto.map(p => `<li>${p}</li>`).join('')}</ul>
    <div class="row"><button type="button" class="go" data-act="start">はじめる</button><button type="button" class="quiet" data-act="menu">面えらびへ</button></div>
  </div>`);
}
function overlay(html) { const o = $('overlay'); o.innerHTML = html; o.hidden = !html; const b = o.querySelector('.go'); if (b) b.focus({ preventScroll: true }); }
$('overlay').addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'start') { overlay(''); G.running = true; last = performance.now(); }
  else if (act === 'retry') { resetStage(); overlay(''); G.running = true; last = performance.now(); }
  else if (act === 'menu') toMenu();
  else if (act === 'next') openStage(G.si + 1);
  else if (act === 'facts') showFacts();
});
function toMenu() { clearTimeout(endTimer); G.running = false; overlay(''); $('play').hidden = true; $('menu').hidden = false; renderMenu(); }
$('btnQuit').addEventListener('click', toMenu);

/* ───── 面の終わり ───── */
let endTimer = 0; // 終わりの札を少し遅れて出す（やり直したら取り消す）
G.end = function (result, why) {
  if (G.over) return;
  G.over = { result, why };
  G.running = false; G.ability = false; G.pointer.on = false;
  draw(); updateHud();
  const S = G.S;
  if (result === 'win') {
    const used = G.t / S.limit, stars = used < 0.4 ? 3 : used < 0.7 ? 2 : 1;
    const prev = best[S.id];
    const isBest = !prev || G.t < prev.time;
    best[S.id] = { stars: Math.max(stars, prev ? prev.stars : 0), time: isBest ? G.t : prev.time };
    saveBest();
    endTimer = setTimeout(() => overlay(`<div class="panel">
      <h2>成功！</h2>
      <p class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
      <p>${S.win}</p>
      <p class="small">${G.t.toFixed(1)}秒${isBest && prev ? '（いちばん速い記録！）' : ''}</p>
      <div class="row"><button type="button" class="go" data-act="facts">本物の話を読む</button><button type="button" class="quiet" data-act="retry">もう一度</button></div>
    </div>`), 900);
  } else {
    endTimer = setTimeout(() => overlay(`<div class="panel lose">
      <h2>失敗…</h2>
      <p>${S.lose[why]}</p>
      <div class="row"><button type="button" class="go" data-act="retry">もう一度</button><button type="button" class="quiet" data-act="facts">本物の話を読む</button><button type="button" class="quiet" data-act="menu">面えらびへ</button></div>
    </div>`), 700);
  }
};
function showFacts() {
  const S = G.S, hasNext = G.si + 1 < STAGES.length;
  overlay(`<div class="panel">
    <h2>本物の話: ${S.parasite}</h2>
    ${S.facts.body.map(p => `<p>${p}</p>`).join('')}
    <h3>出どころ</h3>
    <ul class="src">${S.facts.src.map(s => `<li>${s}</li>`).join('')}</ul>
    <div class="row">${hasNext ? '<button type="button" class="go" data-act="next">次の面へ</button>' : ''}<button type="button" class="${hasNext ? 'quiet' : 'go'}" data-act="menu">面えらびへ</button><button type="button" class="quiet" data-act="retry">もう一度</button></div>
  </div>`);
}

/* ───── トースト ───── */
let toastTimer = 0;
G.toast = function (msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; toastTimer = 2.2; };
function hideToast() { $('toast').hidden = true; toastTimer = 0; }

/* ───── 入力 ───── */
function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) * devicePixelRatio - view.ox) / view.s, y: ((e.clientY - r.top) * devicePixelRatio - view.oy) / view.s }; }
canvas.addEventListener('pointerdown', e => { if (!G.running) return; canvas.setPointerCapture(e.pointerId); Object.assign(G.pointer, toWorld(e), { on: true }); e.preventDefault(); });
canvas.addEventListener('pointermove', e => { if (G.pointer.on) Object.assign(G.pointer, toWorld(e)); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => canvas.addEventListener(n, () => { G.pointer.on = false; }));
const KEYMAP = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', w: 'w', a: 'a', s: 's', d: 'd', W: 'w', A: 'a', S: 's', D: 'd' };
addEventListener('keydown', e => {
  if ($('play').hidden || $('about').open) return;
  if (KEYMAP[e.key] && G.running) { G.keys[KEYMAP[e.key]] = true; e.preventDefault(); }
  if (e.key === ' ' && G.running) { toggleAbility(); e.preventDefault(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.key]) G.keys[KEYMAP[e.key]] = false; });
addEventListener('blur', () => { G.keys = {}; G.pointer.on = false; });
function toggleAbility() {
  if (!G.running) return;
  if (!G.ability && (G.gauge < 8 || G.tired)) { G.toast('あやつり力が足りない'); return; }
  G.ability = !G.ability;
}
$('btnAbility').addEventListener('click', toggleAbility);

/* ───── 画面の大きさ ───── */
function fit() {
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  const s = thumbMode ? Math.max(canvas.width / W, canvas.height / H) : Math.min(canvas.width / W, canvas.height / H);
  view = { s, ox: (canvas.width - W * s) / 2, oy: (canvas.height - H * s) / 2 };
  if (G.S) draw();
}
addEventListener('resize', fit);

/* ───── ループ ───── */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.running) step(dt);
  if (G.S && !$('play').hidden) { draw(); updateHud(); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hideToast(); }
  requestAnimationFrame(frame);
}
function step(dt) {
  G.t += dt;
  G.S.update(G, dt);
  if (!G.running) return;
  // あやつり力: いつも少しずつ回復（引っぱっていないと早く）。0 になると 30 までは使えない
  G.gauge = Math.min(100, G.gauge + (G.pulled ? 3 : 10) * dt);
  if (G.ability) { G.gauge = Math.max(0, G.gauge - G.S.abilityCost * dt); if (G.gauge <= 0) { G.ability = false; G.tired = true; G.toast('あやつり力が切れた。少し待とう'); } }
  if (G.tired && G.gauge >= 30) G.tired = false;
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
  G.S.draw(ctx, G);
  // 面のメーター（しめりけ・こわさ・月あかり）を左下に
  if (G.meter && !thumbMode) {
    const m = G.meter, x = 14, y = H - 26;
    ctx.fillStyle = 'rgba(15,18,12,.6)'; ctx.fillRect(x - 6, y - 20, 170, 34);
    ctx.fillStyle = '#f2eedd'; ctx.font = '14px sans-serif'; ctx.fillText(m.label, x, y - 4);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 70, y - 14, 84, 10);
    ctx.fillStyle = m.warn ? (m.v > 0.35 ? '#f08a5a' : '#9cc861') : (m.v < 0.35 ? '#f08a5a' : '#9cc861');
    ctx.fillRect(x + 70, y - 14, 84 * clamp(m.v, 0, 1), 10);
  }
}
function updateHud() {
  const S = G.S; if (!S) return;
  const left = Math.max(0, S.limit - G.t);
  $('time').textContent = `のこり ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const gb = $('gaugeBar'); gb.style.width = G.gauge + '%'; gb.classList.toggle('low', G.gauge < 25 || G.tired);
  const ab = $('btnAbility'); ab.classList.toggle('on', G.ability); ab.disabled = !G.running;
  ab.setAttribute('aria-pressed', G.ability ? 'true' : 'false');
  const mt = $('mind'); mt.textContent = G.thought || '…'; mt.classList.toggle('pulled', G.pulled || G.ability);
}

/* ───── このゲームについて ───── */
$('btnAbout').addEventListener('click', () => $('about').showModal());
$('btnReset').addEventListener('click', () => { if (confirm('★の記録を消しますか？')) { best = {}; saveBest(); renderMenu(); } });

/* ───── 始める ───── */
renderMenu();
requestAnimationFrame(frame);

// サムネイル撮影（tools/make-thumbs.ps1）: 1面の、触角をふくらませたカタツムリに鳥が降りてくる場面で止める
if (/[?&]thumb\b/.test(location.search)) {
  thumbMode = true; document.body.classList.add('thumb');
  G.si = 0; G.S = STAGES[0]; $('menu').hidden = true; $('play').hidden = false;
  resetStage();
  Object.assign(G.host, { x: 600, y: 440, a: -0.6 });
  Object.assign(G.bird, { x: 640, y: 405, st: 'swoop', dir: 2.4 });
  Object.assign(G.beetle, { x: 900, y: 610, a: 2.6 });
  G.ability = true; G.t = 3.3;
  G.will = norm(1, 0.6);
  fit();
}

// デバッグ用（Browser ペインが裏だと rAF が止まるので、stepSim で進める）
window.__pp = { G, STAGES, openStage, step: s => { for (let i = 0; i < s * 60 && G.running; i++) step(1 / 60); draw(); updateHud(); } };
