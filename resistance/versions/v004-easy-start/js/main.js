// main.js — 状態・夜の進行（10夜）・操作・ループ
'use strict';

const S = {
  phase: 'start',          // start | night | result | end
  gen: 1, pop: null, first: null, world: null, pending: null,
  hist: [], tool: 'swat', colorBy: 'none', style: 'cute', pointer: null,
  taken: {}, dealt: [], chosen: null, used: {swat: 0, spray: 0, bait: 0},
  bannerT: 0,              // 夜の始まりの札を出しているあいだ（秒）。そのあいだ夜は進まない
};
const cv = $('view'), ctx = cv.getContext('2d');
let fit = {s: 1, ox: 0, oy: 0};

function loadPrefs() {
  try { const v = localStorage.getItem('resistance.style'); if (['dot', 'cute', 'real'].includes(v)) S.style = v; } catch (e) {}
}
function savePrefs() { try { localStorage.setItem('resistance.style', S.style); } catch (e) {} }

function reset() {
  resetStage(); kitchenCache = null;
  S.gen = 1; S.pop = firstPopulation(); S.first = S.pop.slice();
  S.hist = [histRow(1, S.pop, null)]; S.taken = {}; S.used = {swat: 0, spray: 0, bait: 0}; S.arrived = 0; S.tool = 'swat';
  S.world = newWorld(S.pop); S.phase = 'start'; S.pending = null; S.bannerT = 0;
  $('resultOv').hidden = true; $('endOv').hidden = true; $('banner').hidden = true;
  const b = loadBest();
  $('bestLine').innerHTML = b ? `いちばんの記録: <span class="stars">${starText(b.stars)}</span> 第${b.nights}夜で全滅` : '';
  syncOwned();
  refreshPanel();
}

function startNight() {
  const prevBaits = S.world ? S.world.baits.slice(0, TOOL.baitMax) : [];
  S.world = newWorld(S.pop, prevBaits);
  S.phase = 'night';
  $('startOv').hidden = true; $('resultOv').hidden = true;
  // 夜の始まりの札: 敵のようすの警告
  const warn = S.gen > 1 ? warnings(S.pop) : [];
  const fresh = Object.keys(UNLOCK).filter(k => UNLOCK[k] === S.gen && S.gen > 1);
  if (fresh.length) S.tool = fresh[0];
  $('banTitle').textContent = S.gen === NIGHTS ? `第${S.gen}夜（さいご）` : `第${S.gen}夜`;
  $('banBody').innerHTML = (S.gen === 1 ? `台所に <b>${S.pop.length} 匹</b>。まずはスリッパで叩こう。` :
    `虫は <b>${S.pop.length} 匹</b>${S.arrived ? `（となりの家から <b>${S.arrived} 匹</b>入ってきた）` : ''}。`) +
    fresh.map(k => `<p class="new">${TOOL_NAME[k]}が使えるようになった！</p>`).join('') +
    (S.gen > 1 ? (warn.length ? warn.map(w => `<p class="warn">${w}</p>`).join('') : '<p>目立った変化はまだない。</p>') : '');
  $('banner').hidden = false; S.bannerT = warn.length || fresh.length ? 2.8 : 1.6;
  syncButtons();
}

// 夜を終えて子の世代を作る
function finishNight() {
  const w = S.world, before = w.pop.slice(), rec = w.rec;
  const survivors = endNight(w);
  for (const k of ['swat', 'spray', 'bait']) S.used[k] += rec[k];
  const kids = breed(survivors, S.gen + 1);
  S.hist[S.hist.length - 1].rec = {...rec};
  const arrive = ARRIVE[S.gen + 1] || 0;
  S.pending = {gen: S.gen, before, survivors, kids, rec, arrive};
  $('banner').hidden = true;
  if (!kids.length && S.gen >= lastArrival) return endGame(true);
  if (S.gen >= NIGHTS) { S.hist.push(histRow(S.gen + 1, kids, null)); return endGame(false); }
  S.phase = 'result';
  showResult(S, S.pending);
  S.dealt = dealCards(S.taken, S.gen + 1); S.chosen = null;
  $('cards').innerHTML = cardsHTML(S.dealt);
  syncButtons();
  refreshPanel();
}

function nextGeneration() {
  const p = S.pending;
  if (!p || !S.chosen) return;
  S.chosen.apply(); S.taken[S.chosen.id] = (S.taken[S.chosen.id] || 0) + 1;
  syncOwned();
  S.gen++; S.arrived = p.arrive; S.pop = p.kids.concat(newcomers(p.arrive, S.gen)); S.hist.push(histRow(S.gen, S.pop, null));
  S.pending = null;
  startNight();
  refreshPanel();
}

function endGame(win) {
  S.phase = 'end';
  const p = S.pending;
  const stars = win ? starsFor(S.gen) : 0;
  if (win) {
    const b = loadBest();
    if (!b || stars > b.stars || (stars === b.stars && S.gen < b.nights)) saveBest({stars, nights: S.gen});
  }
  $('endTitle').textContent = win ? `第${S.gen}夜で全滅させた！` : '台所は虫のものになった';
  $('endStars').innerHTML = win ? starText(stars) : '';
  $('endStars').hidden = !win;
  $('endMsg').innerHTML = win
    ? `${S.gen < NIGHTS ? `のこり ${NIGHTS - S.gen} 夜を残して、` : 'ぎりぎりで、'}虫がいなくなりました。${stars < 3 ? `★3 は第${STAR_AT[0]}夜まで。` : ''}`
    : `${NIGHTS}夜が終わっても、まだ <b>${p.kids.length} 匹</b>。生き残った虫の子が、あなたのやり方に強くなっていきました。`;
  drawChart(S.hist, 'endChart');
  $('endLesson').innerHTML = lessonText(S.hist, S.used);
  $('endOv').hidden = false; $('resultOv').hidden = true;
  syncButtons();
  refreshPanel();
}

function syncOwned() {
  const ids = Object.keys(S.taken);
  $('owned').innerHTML = ids.length ? ids.map(id => {
    const c = CARDS.find(c => c.id === id), n = S.taken[id];
    return `<li class="${c.kind}">${esc(c.name)}${n > 1 ? ` ×${n}` : ''}</li>`;
  }).join('') : '<li class="none">まだない（夜が明けるたびにひとつ）</li>';
}

// ---- パネル ----
function refreshPanel() {
  updateGenCard(S);
  const w = S.world || {pop: S.pop, killed: []};
  updateEnemy(S.phase === 'night' ? w.pop.filter(b => b.alive) : S.pending && S.pending.kids.length ? S.pending.kids : S.pop);
  updateHists(w, S.first);
  drawChart(S.hist);
  syncButtons();
}
function syncButtons() {
  const night = S.phase === 'night';
  $('btnEnd').disabled = !night;
  $('btnNext').disabled = !S.chosen;
  $('btnNext').textContent = S.chosen ? `「${S.chosen.name}」で第${S.gen + 1}夜へ` : '強化をえらんでください';
  for (const b of $('cards').children) b.setAttribute('aria-pressed', !!S.chosen && b.dataset.id === S.chosen.id);
  for (const b of $('segTool').children) {
    const open = toolOpen(b.dataset.v, S.gen);
    b.setAttribute('aria-pressed', b.dataset.v === S.tool); b.disabled = !open;
    b.title = open ? '' : `第${UNLOCK[b.dataset.v]}夜から使える`;
  }
  for (const b of $('segColor').children) b.setAttribute('aria-pressed', b.dataset.v === S.colorBy);
  for (const b of $('segStyle').children) b.setAttribute('aria-pressed', b.dataset.v === S.style);
  for (const b of $('styleChoice').children) b.setAttribute('aria-pressed', b.dataset.v === S.style);
  const t = TRAIT[S.colorBy];
  $('colorCap').innerHTML = t ? `<b style="color:${t.color}">${t.name}</b>が強い虫ほど、この色になります（${t.kind === 'poly' ? '弱い虫は灰色' : '遺伝子が2本で濃く、1本で半分、持っていない虫は灰色'}）。` : '色分けすると、どの虫が手ごわいかが見えます。';
}

// ---- 描画 ----
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.max(1, Math.round(r.width * dpr)), ph = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const s = Math.min(pw / W, ph / H);
  fit = {s, ox: (pw - W * s) / 2, oy: (ph - H * s) / 2, dpr};
}
function render() {
  resize();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#120d09'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(fit.s, 0, 0, fit.s, fit.ox, fit.oy);
  drawWorld(ctx, S.world, {style: S.style, colorBy: S.colorBy, tool: S.phase === 'night' ? S.tool : null, pointer: S.pointer});
}

function updateMeters() {
  const w = S.world;
  $('sprayBar').style.width = pct(Math.max(0, w.sprayLeft) / TOOL.sprayBudget);
  const left = S.phase === 'night' ? Math.max(0, NIGHT - w.t) : 0;
  $('nightBar').style.width = pct(left / NIGHT);
  $('nightLbl').textContent = S.phase === 'night' ? `のこり${Math.ceil(left)}秒` : '夜';
}

let lastT = performance.now(), panelT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  try {
    if (S.phase === 'night') {
      if (S.bannerT > 0) { S.bannerT -= dt; if (S.bannerT <= 0) $('banner').hidden = true; }
      else {
        stepWorld(S.world, dt);
        if (S.world.t >= NIGHT) finishNight();
        panelT += dt;
        if (panelT > 0.25 && S.phase === 'night') { panelT = 0; updateGenCard(S); updateHists(S.world, S.first); }
      }
    }
    updateMeters();
    render();
  } catch (e) { window.__rzErr = e; console.error(e); }
  requestAnimationFrame(frame);
}

// ---- 操作 ----
function toWorld(e) {
  const r = cv.getBoundingClientRect(), dpr = fit.dpr || 1;
  return {x: ((e.clientX - r.left) * dpr - fit.ox) / fit.s, y: ((e.clientY - r.top) * dpr - fit.oy) / fit.s};
}
function wirePointer() {
  cv.addEventListener('pointerdown', e => {
    const p = toWorld(e); S.pointer = p;
    if (S.phase !== 'night') return;
    if (S.bannerT > 0) { S.bannerT = 0; $('banner').hidden = true; }   // 札はタップで閉じる
    cv.setPointerCapture(e.pointerId);
    const w = S.world;
    if (S.tool === 'swat') swat(w, p.x, p.y);
    else if (S.tool === 'spray') { if (w.sprayLeft > 0) w.spraying = {x: p.x, y: p.y}; else toast('この夜のスプレーは使い切りました'); }
    else if (S.tool === 'bait') {
      const r = placeBait(w, p.x, p.y);
      if (r === 'full') toast(`毒エサは${TOOL.baitMax}つまで。置いたものを押すと片づけられます`);
      if (r === 'placed') toast('毒エサを置きました。次の夜にも残ります', 2200);
    }
  });
  cv.addEventListener('pointermove', e => {
    const p = toWorld(e); S.pointer = p;
    if (S.world && S.world.spraying) { S.world.spraying.x = p.x; S.world.spraying.y = p.y; }
  });
  const up = () => { if (S.world && S.world.spraying) S.world.spraying = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') S.pointer = null; up(); });
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    const k = {'1': 'swat', '2': 'spray', '3': 'bait'}[e.key];
    if (k && toolOpen(k, S.gen)) { S.tool = k; syncButtons(); }
  });
}

function wireUI() {
  const seg = (id, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (b) { fn(b.dataset.v); syncButtons(); } });
  seg('segTool', v => { if (toolOpen(v, S.gen)) S.tool = v; });
  seg('segColor', v => { S.colorBy = v; });
  seg('segStyle', v => { S.style = v; savePrefs(); });
  seg('styleChoice', v => { S.style = v; savePrefs(); });
  $('btnStart').addEventListener('click', () => startNight());
  $('btnNext').addEventListener('click', nextGeneration);
  $('cards').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.chosen = S.dealt.find(c => c.id === b.dataset.id); syncButtons(); });
  $('btnEnd').addEventListener('click', () => { if (S.phase === 'night' && confirm('この夜を終えますか？（生き残った虫が子を残します）')) finishNight(); });
  $('btnAgain').addEventListener('click', () => { reset(); $('startOv').hidden = false; });
  $('btnReset').addEventListener('click', () => { if (confirm('第1夜からやり直しますか？')) { reset(); $('startOv').hidden = false; } });
  $('hint').addEventListener('click', () => $('hint').classList.toggle('open'));
  for (const b of $('styleChoice').children) drawSample(b.querySelector('canvas'), b.dataset.v);
}

function init() {
  loadPrefs();
  buildHists(); buildLegend(); buildLegend('endLegend'); buildEnemy();
  reset();
  wireUI(); wirePointer();
  // フォントが来たら台所の絵を描き直す
  if (document.fonts) document.fonts.ready.then(() => { kitchenCache = null; for (const b of $('styleChoice').children) drawSample(b.querySelector('canvas'), b.dataset.v); });
  // サムネイル用（tools/make-thumbs.ps1）: デフォルメで第1夜を少し進めて止める
  if (/[?&]thumb\b/.test(location.search)) {
    document.body.classList.add('thumb');
    S.style = 'cute'; startNight(); S.bannerT = 0; $('banner').hidden = true;
    for (let t = 0; t < 10; t += 1 / 30) stepWorld(S.world, 1 / 30);
    S.phase = 'thumb';
  }
  requestAnimationFrame(frame);
}

// デバッグ用の窓口
window.__rz = {
  S, get world() { return S.world; },
  step(sec = 1, dt = 1 / 30) { S.bannerT = 0; $('banner').hidden = true; for (let t = 0; t < sec; t += dt) stepWorld(S.world, dt); render(); },
  finish: () => finishNight(), start: () => startNight(),
  pick(i = 0) { S.chosen = S.dealt[i]; syncButtons(); nextGeneration(); },
  render, swat: (x, y) => swat(S.world, x, y),
};
try { init(); } catch (e) { window.__rzErr = e; console.error(e); }
