'use strict';
// あそぶ画面: 面の始まりと終わりの札、入力、一時停止、ループ、てびき、演出（成功の輪・失敗のゆれ）。
// 記録と、ほかの画面の切りかえ show() は screens.js。

const canvas = $('view'), ctx = canvas.getContext('2d');
const G = { pointer: { on: false, x: 0, y: 0 }, keys: {}, running: false, paused: false, fx: [] };
let view = { s: 1, ox: 0, oy: 0 }, thumbMode = false;

/* ───── 面を始める ───── */
function openStage(i) {
  G.si = i; G.S = STAGES[i];
  show('play');
  resetStage();
  showIntro();
  fit();
  Sound.setAmbient(G.S.id);
}
function resetStage() {
  const S = G.S;
  clearTimeout(endTimer);
  Object.assign(G, { t: 0, gauge: 100, tired: false, ability: false, will: null, pulled: false, pull: null, thought: '', meter: null, over: null, running: false, paused: false, fx: [], tipsShown: {}, tipT: 0, lastTick: 0 });
  S.init(G);
  $('who').textContent = `${G.si + 1}面 ${S.title}（きみは${S.parasite}）`;
  $('mindWho').textContent = `${S.host}の気持ち`;
  $('btnAbility').textContent = S.abilityName;
  $('field').classList.remove('shake', 'hurt');
  hideToast(); hideTip(); $('banner').hidden = true;
  updateHud();
  draw();
}
function showIntro() {
  const S = G.S;
  overlay(`<div class="panel">
    <p class="kicker">${G.si + 1}面 ・ 寄生者: ${S.parasite}</p>
    <h2>${S.title}</h2>
    ${S.story.map(p => `<p>${p}</p>`).join('')}
    <h3>あそびかた</h3>
    <ul>${S.howto.map(p => `<li>${p}</li>`).join('')}</ul>
    <p class="small">★★★ は ${starTime(3)} 秒以内、★★ は ${starTime(2)} 秒以内にクリア。制限時間 ${S.limit} 秒。</p>
    <div class="row"><button type="button" class="go" data-act="start">はじめる</button><button type="button" class="quiet" data-act="menu">面えらびへ</button></div>
  </div>`);
}
const STAR_AT = { 3: 0.4, 2: 0.7 }; // 制限時間のうち、どれだけ使ったか
const starTime = n => Math.round(G.S.limit * STAR_AT[n]);
function begin() {
  overlay(''); G.running = true; G.paused = false; last = performance.now();
  Sound.play('start');
  banner('スタート！');
}
function overlay(html) { const o = $('overlay'); o.innerHTML = html; o.hidden = !html; o.scrollTop = 0; const b = o.querySelector('.go'); if (b) b.focus({ preventScroll: true }); }
$('overlay').addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  Sound.play('click');
  if (act === 'start') begin();
  else if (act === 'retry') { resetStage(); begin(); }
  else if (act === 'resume') resume();
  else if (act === 'menu') toMenu();
  else if (act === 'next') openStage(G.si + 1);
  else if (act === 'facts') showFacts();
  else if (act === 'ending') { prog.ending = true; saveProg(); Sound.play('ending'); show('ending'); }
});
function toMenu() { clearTimeout(endTimer); G.running = false; G.paused = false; overlay(''); show('menu'); }

/* ───── 一時停止 ───── */
function pause() {
  if (!G.running || G.paused) return;
  G.paused = true; G.pointer.on = false; G.keys = {}; Sound.setPull(0);
  overlay(`<div class="panel small-panel">
    <h2>一時停止</h2>
    <p class="small">${G.S.title} ・ のこり ${Math.max(0, Math.ceil(G.S.limit - G.t))} 秒</p>
    <div class="row"><button type="button" class="go" data-act="resume">つづける</button><button type="button" class="quiet" data-act="retry">はじめから</button><button type="button" class="quiet" data-act="menu">面えらびへ</button></div>
  </div>`);
}
function resume() { overlay(''); G.paused = false; last = performance.now(); }
$('btnPause').addEventListener('click', () => { Sound.play('click'); G.paused ? resume() : pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('blur', () => { G.keys = {}; G.pointer.on = false; pause(); });

/* ───── 面の終わり ───── */
let endTimer = 0; // 終わりの札を少し遅れて出す（やり直したら取り消す）
G.end = function (result, why) {
  if (G.over) return;
  G.over = { result, why };
  G.running = false; G.ability = false; G.pointer.on = false;
  Sound.setPull(0); hideTip();
  const S = G.S, firstPlay = !prog.seen[S.id];
  prog.seen[S.id] = true; saveProg();
  draw(); updateHud();
  if (result === 'win') {
    const used = G.t / S.limit, stars = used < STAR_AT[3] ? 3 : used < STAR_AT[2] ? 2 : 1;
    const prev = best[S.id], wasAll = allCleared();
    const isBest = !prev || G.t < prev.time;
    best[S.id] = { stars: Math.max(stars, prev ? prev.stars : 0), time: isBest ? G.t : prev.time };
    saveBest();
    const toEnding = !wasAll && allCleared() && !prog.ending; // 3面をはじめて全部クリアした
    const hasNext = G.si + 1 < STAGES.length, newOpen = hasNext && !prev;
    for (let k = 0; k < 3; k++) G.fx.push({ x: G.host.x, y: G.host.y, t: -k * 0.18 });
    Sound.play('win'); banner('成功！');
    const nextStar = stars < 3 ? `<p class="small">${starText(stars + 1).replace(/☆+$/, '')} は ${starTime(stars + 1)} 秒以内</p>` : '';
    endTimer = setTimeout(() => {
      overlay(`<div class="panel win">
        <h2>成功！</h2>
        <p class="stars" aria-label="★${stars}">${[1, 2, 3].map(n => `<span class="${n <= stars ? 'got' : ''}" style="animation-delay:${0.15 + n * 0.25}s">${n <= stars ? '★' : '☆'}</span>`).join('')}</p>
        <p>${S.win}</p>
        <p class="small">${G.t.toFixed(1)}秒${isBest && prev ? '（いちばん速い記録！）' : ''}</p>
        ${nextStar}
        ${newOpen ? `<p class="new">${G.si + 2}面「${STAGES[G.si + 1].title}」が遊べるようになった！</p>` : ''}
        <div class="row"><button type="button" class="go" data-act="facts">本物の話を読む</button>${hasNext && !toEnding ? '<button type="button" class="quiet" data-act="next">次の面へ</button>' : ''}<button type="button" class="quiet" data-act="retry">もう一度</button></div>
      </div>`);
      for (let n = 1; n <= stars; n++) setTimeout(() => Sound.play('star'), (0.15 + n * 0.25) * 1000);
    }, 1100);
  } else {
    Sound.play('lose'); banner('失敗…');
    const f = $('field'); f.classList.remove('shake', 'hurt'); void f.offsetWidth; f.classList.add('hurt');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) f.classList.add('shake');
    endTimer = setTimeout(() => overlay(`<div class="panel lose">
      <h2>失敗…</h2>
      <p>${S.lose[why]}</p>
      ${firstPlay ? '<p class="small">図鑑に「本物の話」がのった。タイトルの「寄生者の図鑑」からも読めます。</p>' : ''}
      <div class="row"><button type="button" class="go" data-act="retry">もう一度</button><button type="button" class="quiet" data-act="facts">本物の話を読む</button><button type="button" class="quiet" data-act="menu">面えらびへ</button></div>
    </div>`), 900);
  }
};
function showFacts() {
  const S = G.S, hasNext = G.si + 1 < STAGES.length && unlocked(G.si + 1);
  const toEnding = allCleared() && !prog.ending;
  Sound.play('page');
  const main = toEnding ? '<button type="button" class="go" data-act="ending">エンディングへ</button>'
    : hasNext ? '<button type="button" class="go" data-act="next">次の面へ</button>' : '';
  overlay(`<div class="panel">
    <p class="kicker">本物の話</p>
    <h2>${S.parasite}</h2>
    ${S.facts.body.map(p => `<p>${p}</p>`).join('')}
    <h3>ひとめぐり（生活環）</h3>${cycleHtml(S)}
    <h3>出どころ</h3>
    <ul class="src">${S.facts.src.map(s => `<li>${s}</li>`).join('')}</ul>
    <div class="row">${main}<button type="button" class="${main ? 'quiet' : 'go'}" data-act="menu">面えらびへ</button><button type="button" class="quiet" data-act="retry">もう一度</button></div>
  </div>`);
}

/* ───── 知らせ（トースト・てびき・大きな文字） ───── */
let toastTimer = 0;
G.toast = function (msg, kind) {
  const t = $('toast'); t.textContent = msg; t.hidden = false; toastTimer = 2.2;
  t.className = 'toast' + (kind ? ' ' + kind : '');
  Sound.play(kind === 'alert' ? 'alert' : kind === 'tired' ? 'tired' : 'toast');
};
G.sfx = name => Sound.play(name);
function hideToast() { $('toast').hidden = true; toastTimer = 0; }
function showTip(text) { const t = $('tip'); t.textContent = text; t.hidden = false; G.tipT = 6; }
function hideTip() { $('tip').hidden = true; G.tipT = 0; }
function banner(text) {
  const b = $('banner'); b.textContent = text; b.hidden = false;
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  clearTimeout(banner.timer); banner.timer = setTimeout(() => { b.hidden = true; }, 1300);
}
// てびき: この面をまだクリアしていない間だけ。ほかのてびきが出ている間は待つ
function checkTips(dt) {
  if (G.tipT > 0) { G.tipT -= dt; if (G.tipT <= 0) hideTip(); return; }
  if (cleared(G.si) || !G.S.tips || thumbMode) return;
  G.S.tips.forEach((tip, i) => {
    if (G.tipT > 0 || G.tipsShown[i]) return;
    if (tip.when(G)) { G.tipsShown[i] = true; showTip(tip.text); }
  });
}

/* ───── 入力 ───── */
function toWorld(e) { const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width; return { x: ((e.clientX - r.left) * dpr - view.ox) / view.s, y: ((e.clientY - r.top) * dpr - view.oy) / view.s }; }
canvas.addEventListener('pointerdown', e => { if (!G.running || G.paused) return; canvas.setPointerCapture(e.pointerId); Object.assign(G.pointer, toWorld(e), { on: true }); e.preventDefault(); });
canvas.addEventListener('pointermove', e => { if (G.pointer.on) Object.assign(G.pointer, toWorld(e)); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => canvas.addEventListener(n, () => { G.pointer.on = false; }));
const KEYMAP = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', w: 'w', a: 'a', s: 's', d: 'd', W: 'w', A: 'a', S: 's', D: 'd' };
addEventListener('keydown', e => {
  if ($('play').hidden || $('about').open) return;
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && G.running) { G.paused ? resume() : pause(); e.preventDefault(); return; }
  if (G.paused) return;
  if (KEYMAP[e.key] && G.running) { G.keys[KEYMAP[e.key]] = true; e.preventDefault(); }
  if (e.key === ' ' && G.running) { toggleAbility(); e.preventDefault(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.key]) G.keys[KEYMAP[e.key]] = false; });
function toggleAbility() {
  if (!G.running || G.paused) return;
  if (!G.ability && (G.gauge < 8 || G.tired)) { G.toast('あやつり力が足りない'); return; }
  G.ability = !G.ability;
  Sound.play(G.ability ? 'abilityOn' : 'abilityOff');
}
$('btnAbility').addEventListener('click', toggleAbility);

/* ───── 画面の大きさ ───── */
function fit() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  const s = thumbMode ? Math.max(canvas.width / W, canvas.height / H) : Math.min(canvas.width / W, canvas.height / H);
  view = { s, ox: (canvas.width - W * s) / 2, oy: (canvas.height - H * s) / 2 };
  if (G.S) draw();
}
addEventListener('resize', fit);
if (window.ResizeObserver) new ResizeObserver(() => { if (!$('play').hidden) fit(); }).observe($('field'));

/* ───── ループ ───── */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.running && !G.paused) step(dt);
  if (G.S && !$('play').hidden) { draw(); updateHud(); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hideToast(); }
  Sound.setPull(G.running && !G.paused && G.pulled ? 1 : 0);
  Sound.tick(dt);
  requestAnimationFrame(frame);
}
function step(dt) {
  G.t += dt;
  G.S.update(G, dt);
  for (const f of G.fx) f.t += dt;
  if (!G.running) return;
  // あやつり力: いつも少しずつ回復（引っぱっていないと早く）。0 になると 30 までは使えない
  G.gauge = Math.min(100, G.gauge + (G.pulled ? 3 : 10) * dt);
  if (G.ability) { G.gauge = Math.max(0, G.gauge - G.S.abilityCost * dt); if (G.gauge <= 0) { G.ability = false; G.tired = true; G.toast('あやつり力が切れた。少し待とう', 'tired'); } }
  if (G.tired && G.gauge >= 30) G.tired = false;
  // のこり 10 秒から、1 秒ごとに知らせる
  const left = Math.ceil(G.S.limit - G.t);
  if (left <= 10 && left !== G.lastTick) { G.lastTick = left; Sound.play('tick'); }
  checkTips(dt);
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
  G.S.draw(ctx, G);
  // 成功の輪
  for (const f of G.fx) {
    if (f.t < 0 || f.t > 1.2) continue;
    ctx.beginPath(); ctx.arc(f.x, f.y, 20 + f.t * 160, 0, TAU);
    ctx.strokeStyle = `rgba(255,236,150,${1 - f.t / 1.2})`; ctx.lineWidth = 6 * (1 - f.t / 1.2) + 1; ctx.stroke();
  }
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
  const tm = $('time');
  tm.textContent = `のこり ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  tm.classList.toggle('warn', left <= 15 && !G.over);
  const gb = $('gaugeBar'); gb.style.width = G.gauge + '%'; gb.classList.toggle('low', G.gauge < 25 || G.tired);
  const ab = $('btnAbility'); ab.classList.toggle('on', G.ability); ab.disabled = !G.running || G.paused;
  ab.setAttribute('aria-pressed', G.ability ? 'true' : 'false');
  $('btnPause').disabled = !G.running;
  const mt = $('mind'); mt.textContent = G.thought || '…'; mt.classList.toggle('pulled', G.pulled || G.ability);
}

/* ───── このゲームについて・音 ───── */
function syncSound() {
  $('btnSound').setAttribute('aria-pressed', Sound.on ? 'true' : 'false');
  $('btnSound').setAttribute('aria-label', Sound.on ? '音を消す' : '音を出す');
  $('optSound').checked = Sound.on;
}
$('btnSound').addEventListener('click', () => { Sound.unlock(); Sound.setOn(!Sound.on); syncSound(); Sound.play('click'); });
$('optSound').addEventListener('change', e => { Sound.setOn(e.target.checked); syncSound(); });
$('btnAbout').addEventListener('click', () => { pause(); $('about').showModal(); });
$('btnReset').addEventListener('click', () => {
  if (!confirm('★の記録と、図鑑・面の進み具合を消しますか？')) return;
  resetRecords(); $('about').close(); show('title');
});
syncSound();

/* ───── 始める ───── */
show('title');
requestAnimationFrame(frame);

// サムネイル撮影（tools/make-thumbs.ps1）: 1面の、触角をふくらませたカタツムリに鳥が降りてくる場面で止める
if (/[?&]thumb\b/.test(location.search)) {
  thumbMode = true; document.body.classList.add('thumb');
  G.si = 0; G.S = STAGES[0]; show('play');
  resetStage();
  Object.assign(G.host, { x: 600, y: 440, a: -0.6 });
  Object.assign(G.bird, { x: 640, y: 405, st: 'swoop', dir: 2.4 });
  Object.assign(G.beetle, { x: 900, y: 610, a: 2.6 });
  G.ability = true; G.t = 3.3;
  G.will = norm(1, 0.6);
  fit();
}

// デバッグ用（Browser ペインが裏だと rAF が止まるので、step で進める）
window.__pp = { G, STAGES, Demo, Sound, openStage, show, pause, resume, best: () => best, prog: () => prog,
  step: s => { for (let i = 0; i < s * 60 && G.running; i++) step(1 / 60); draw(); updateHud(); } };
