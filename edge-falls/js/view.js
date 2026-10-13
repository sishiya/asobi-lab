'use strict';
// 見る手助け（v030。PLAYTEST.md 段階2。2026-10-13 ユーザー「回転させたりズームできることに気づかなかった」「回転や拡大のショートカットボタンはいるかも」）
//   1) 見る用のボタン（v033 で PC でも）: 回す・寄る・引く・まんなかへ。押しているあいだ続けて動く。道具を持っていても使える
//   2) 見かたの練習（指で遊ぶとき）: 2本指のしぐさを、ヒントの光と同じ光の点2つで見せる（手の絵は使わない。ユーザー「図形の組み合わせの手はチープになりやすい」）。
//      ひろげる（寄る）とひねる（回す）を実際にやったら消える。やらなければ、少したってもう一度だけ

// 指で遊んでいるか（スマホ・タブレット）。はじめから指の端末か、一度でも指でさわったら
const touchy = () => document.body.classList.contains('touchy');
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touchy');
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') document.body.classList.add('touchy'); }, true);

// ---- 見る用のボタン ----
const VIEWPAD = [
  ['rl', TX('左へ回す', 'Turn left'), ['...###..', '..#...#.', '.#.....#', '###....#', '.#.....#', '.......#', '..#...#.', '...###..']],
  ['rr', TX('右へ回す', 'Turn right'), ['..###...', '.#...#..', '#.....#.', '#....###', '#.....#.', '#.......', '.#...#..', '..###...']],
  ['zi', TX('寄る', 'Zoom in'), ['........', '...##...', '...##...', '.######.', '.######.', '...##...', '...##...', '........']],
  ['zo', TX('引く', 'Zoom out'), ['........', '........', '........', '.######.', '.######.', '........', '........', '........']],
  ['home', TX('まんなかへもどす', 'Back to the middle'), ['........', '..####..', '.#....#.', '.#.##.#.', '.#.##.#.', '.#....#.', '..####..', '........']],
];
function drawViewIcon(ctx, glyph) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 3, 3, 10, 10, '#5a4030'); px(ctx, 2, 4, 12, 8, '#5a4030'); px(ctx, 4, 2, 8, 12, '#5a4030');   // 時の速さのボタンと同じ淡い真鍮
  px(ctx, 3, 4, 10, 8, '#a08a6c'); px(ctx, 4, 3, 8, 10, '#a08a6c'); px(ctx, 4, 4, 8, 1, '#c8b494');
  glyph.forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] === '#') px(ctx, 4 + x, 4 + y, 1, 1, '#3a2a1c'); });
}
const pad = document.createElement('div');
pad.className = 'viewpad'; pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', TX('見る向き', 'View'));
for (const [id, label, glyph] of VIEWPAD) {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.view = id; b.title = label; b.setAttribute('aria-label', label);
  const c = document.createElement('canvas'); c.width = c.height = 32; drawViewIcon(c.getContext('2d'), glyph);
  b.appendChild(c); pad.appendChild(b);
}
$('hands').before(pad);

let viewHeld = null, viewT = 0, viewLast = 0, homeTw = null;
function viewStep(now) {
  const dt = Math.min(0.05, (now - viewLast) / 1000); viewLast = now;
  if (viewHeld) {
    viewT += dt;
    if (viewHeld === 'rl') V.yaw += 1.3 * dt;                      // ← キーと同じ向き
    else if (viewHeld === 'rr') V.yaw -= 1.3 * dt;
    else if (viewHeld === 'zi') V.zoom = Math.min(3, V.zoom * Math.exp(0.9 * dt));
    else if (viewHeld === 'zo') V.zoom = Math.max(0.6, V.zoom * Math.exp(-0.9 * dt));
    layout(V.cw, V.ch); lastInput = now;
  }
  if (homeTw) {                                                     // まんなかへ: なめらかにもどす
    const k = Math.min(1, dt * 7);
    V.zoom += (1 - V.zoom) * k; V.panX = (V.panX || 0) * (1 - k); V.panY = (V.panY || 0) * (1 - k); V.tilt += (homeTw.tilt - V.tilt) * k;
    layout(V.cw, V.ch); lastInput = now;
    if (Math.abs(V.zoom - 1) < 0.003 && Math.abs(V.panX) + Math.abs(V.panY) < 0.5) { V.zoom = 1; V.panX = V.panY = 0; layout(V.cw, V.ch); homeTw = null; }
  }
  if (viewHeld || homeTw) requestAnimationFrame(viewStep);
}
function viewDown(e) {
  const b = e.target.closest('[data-view]'); if (!b) return;
  e.preventDefault(); Sound.unlock();
  try { b.setPointerCapture(e.pointerId); } catch (err) { /* 捕まえられなくても動かす */ }
  G.did.rotate = 1; noteGesture('pad');
  if (b.dataset.view === 'home') { homeTw = { tilt: 0.56 }; Sound.play('click'); }
  else { viewHeld = b.dataset.view; viewT = 0; b.classList.add('on'); }
  viewLast = performance.now(); requestAnimationFrame(viewStep);
}
function viewUp(e) {
  const b = e.target.closest('[data-view]');
  if (b) b.classList.remove('on');
  if (!viewHeld) return;
  const id = viewHeld;
  if (viewT < 0.2) setTimeout(() => { if (viewHeld === id) viewHeld = null; }, (0.2 - viewT) * 1000);   // ちょんと押しても少しは動く
  else viewHeld = null;
}
pad.addEventListener('pointerdown', viewDown);
pad.addEventListener('pointerup', viewUp);
pad.addEventListener('pointercancel', viewUp);
pad.addEventListener('contextmenu', e => e.preventDefault());

// ---- 見かたの練習（2本指のしぐさ） ----
const gest = document.createElement('div');
gest.className = 'gesture'; gest.hidden = true; gest.setAttribute('aria-hidden', 'true');
gest.innerHTML = `<div class="pair"><i class="f1"></i><i class="f2"></i></div><p>${TX('2本指で　ひろげると寄る・ひねると回る', 'Two fingers: spread to zoom in, twist to turn')}</p>`;
$('hands').before(gest);
const GEST = { zoom: 0, twist: 0, shown: 0, t: 0, play: 0, next: 4 };
function noteGesture(kind, v = 1) {
  if (kind === 'pad') { GEST.zoom = GEST.twist = 9; }
  else GEST[kind] += v;
  if (GEST.zoom > 0.35) G.did.zoom = 1;
  if (GEST.twist > 0.4) G.did.twist = 1;
}
const gestDone = () => G.did.zoom && G.did.twist;
setInterval(() => {
  const playing = G.started && !ENDING && !COL && $('overlay').hidden && !G.menuOpen && $('book').hidden && !isFree();
  if (!gest.hidden) {
    GEST.t += 0.5;
    if (gestDone() || GEST.t > 12 || !playing) { gest.classList.remove('on'); setTimeout(() => { gest.hidden = true; }, 600); if (gestDone()) Sound.play('pin'); }
    return;
  }
  if (!touchy() || !playing || gestDone() || GEST.shown >= 2) return;
  if ($('line').classList.contains('on') || $('toast').classList.contains('on')) { GEST.next = Math.max(GEST.next, GEST.play + 1.5); return; }   // 章のことば・知らせと重ねない
  GEST.play += 0.5;
  if (GEST.play < GEST.next) return;
  GEST.shown++; GEST.t = 0; GEST.next = GEST.play + 90;            // 2回目は、遊んで 90 秒ほどあと
  gest.hidden = false; requestAnimationFrame(() => gest.classList.add('on'));
}, 500);
