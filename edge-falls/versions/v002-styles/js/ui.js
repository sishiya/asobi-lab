'use strict';
// 横のようす・知らせ・札・グラフ
const $ = id => document.getElementById(id);
const DAYNAME = ['第一', '第二', '第三', '第四', '第五'];
const BEST_KEY = 'asobi-lab/edge-falls/best';

let toastT = 0;
function toast(msg, sec = 3) {
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), sec * 1000);
}

function showPanel(html, btns) {
  $('panel').innerHTML = html;
  const box = document.createElement('div'); box.className = 'btns';
  for (const b of btns) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'tbtn' + (b.main ? ' main' : ''); el.textContent = b.label;
    el.onclick = () => { Sound.unlock(); Sound.play('click'); $('overlay').hidden = true; b.fn && b.fn(); };
    box.appendChild(el);
  }
  $('panel').appendChild(box);
  $('overlay').hidden = false;
  box.querySelector('.main')?.focus();
}

function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '[]'); } catch (e) { return []; } }
function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) { /* なし */ } }

function updateQuestBox(s) {
  if (G.qi >= QUESTS.length) {
    $('questLabel').textContent = 'お題はすべておわり';
    $('questText').textContent = '自由に世界をそだてよう。'; $('questBar').style.width = '100%';
    $('questNum').textContent = '―'; $('questUnit').textContent = ''; $('questGoal').textContent = '';
    $('questStars').textContent = G.best.map(b => '★'.repeat(b || 0)).join(' ');
    return;
  }
  const q = QUESTS[G.qi], v = q.prog(s);
  $('questLabel').textContent = DAYNAME[G.qi] + 'の日のお題「' + q.title + '」';
  $('questText').textContent = q.text;
  $('questBar').style.width = Math.min(100, v / q.goal * 100) + '%';
  $('questNum').textContent = v; $('questUnit').textContent = q.unit; $('questGoal').textContent = q.goal + q.unit;
  $('questHint').textContent = q.hint;
  const days = (W.t - G.qStart) / DAY;
  const st = questStars(G.qi, days);
  $('questStars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
}

const HIST = [];
function updateSide(s) {
  $('day').textContent = '第 ' + W.day + ' 日';
  $('nGrass').textContent = Math.round(s.grass * 100);
  $('nDeer').textContent = L.counts.deer; $('nWolf').textContent = L.counts.wolf; $('nFish').textContent = L.counts.fish;
  $('fallRate').textContent = s.out.toFixed(1);
  const tot = s.land + s.clouds + s.abyss || 1;
  $('wLand').style.width = (s.land / tot * 100) + '%';
  $('wCloud').style.width = (s.clouds / tot * 100) + '%';
  $('wAbyss').style.width = (s.abyss / tot * 100) + '%';
  $('soilBar').style.width = Math.min(100, W.soil / 300 * 100) + '%';
  $('nSpring').textContent = W.springs.length;
  for (const [k, id] of [['deer', 'stDeer'], ['wolf', 'stWolf'], ['fish', 'stFish']]) {
    const el = $(id); el.textContent = W.stock[k]; el.classList.toggle('zero', W.stock[k] <= 0);
  }
  updateQuestBox(s);
}

// 半日ごとに記録して、移り変わりのグラフ
function recordHist(s) {
  HIST.push({ g: s.grass, d: L.counts.deer, w: L.counts.wolf, f: L.counts.fish });
  if (HIST.length > 240) HIST.shift();
  drawChart();
}
function drawChart() {
  const cv = $('chart'), dpr = devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  if (HIST.length < 2) return;
  const maxA = Math.max(20, ...HIST.map(p => Math.max(p.d, p.f, p.w * 4)));
  const line = (col, f, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(dash || []);
    ctx.beginPath();
    HIST.forEach((p, k) => { const x = k / (HIST.length - 1) * w, y = h - 2 - f(p) * (h - 6); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
  };
  line('#6aa84f', p => p.g, [4, 3]);
  line('#ef9a4a', p => p.f / maxA);
  line('#c08040', p => p.d / maxA);
  line('#7d8597', p => p.w * 4 / maxA);
}
