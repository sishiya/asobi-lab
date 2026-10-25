// 名画の顔ハメ: 画面の流れ・看板の合成・シャッター・けっか。
// カメラの映像はこの端末の中だけで使う。写真はけっかで「保存」を押したときだけファイルにする。
import { PAINTINGS } from './paintings.js?v=7';
import { createLandmarker, readFace, areaBox } from './face.js?v=7';
import { createBlender, labStats } from './blend.js?v=7';
import { scoreFace, averageFaces, mark } from './score.js?v=7';
import { TX, initLang } from './i18n.js?v=7';
import { loadStyler, stylize, LIVE, PHOTO } from './style.js?v=7';

const $ = s => document.querySelector(s);

// ---- 設定（覚えておけなくても動く） ----
const DEF = { assist: 1, blend: 2, touch: 2, secs: 5, shots: 3, sound: 1 };
const cfg = { ...DEF };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('face-in-frame') || '{}')); } catch (e) {}
const saveCfg = () => { try { localStorage.setItem('face-in-frame', JSON.stringify(cfg)); } catch (e) {} };
const ASSIST = [0, 0.3, 0.55, 0.8];   // 顔を穴へ寄せる割合（なし・弱・中・強）
const BLEND = [0, 0.45, 0.75, 1];     // 絵の色へ寄せる割合
const TOUCH = [0, 0.45, 0.75, 1];     // 筆のタッチ（スタイル変換）を重ねる割合
const INTRO = 1.8;                    // 絵が出てから時間が動き出すまで（秒）

function syncSeg() {
  for (const seg of document.querySelectorAll('.seg')) for (const b of seg.children) b.classList.toggle('on', String(cfg[seg.dataset.key]) === b.dataset.v);
}
for (const seg of document.querySelectorAll('.seg')) seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  cfg[seg.dataset.key] = Number(b.dataset.v); saveCfg(); syncSeg();
});
syncSeg();
initLang();
$('#openSettings').onclick = () => { $('#settings').hidden = false; };
$('#closeSettings').onclick = () => { $('#settings').hidden = true; };

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
function message(text) { $('#msgText').textContent = text; $('#msg').hidden = false; }
$('#msgOk').onclick = () => { $('#msg').hidden = true; stopCamera(); show('title'); };

// ---- 音（小さく短く） ----
let ac = null;
function beep(freq, len, vol = 0.12, type = 'sine') {
  if (!cfg.sound) return;
  try {
    ac = ac || new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len);
  } catch (e) {}
}
function shutterSound() {
  if (!cfg.sound) return;
  try {
    ac = ac || new AudioContext();
    const t = ac.currentTime, n = ac.sampleRate * 0.12, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * (i < n * 0.4 || i > n * 0.55 ? 1 : 0.2);
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2400; g.gain.value = 0.5;
    s.buffer = buf; s.connect(f).connect(g).connect(ac.destination); s.start(t);
  } catch (e) {}
}

// ---- 絵の用意: 穴をあけた絵と、穴の中の色 ----
const loadImg = src => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = src; });
const cache = new Map();
// くり抜く所は「鼻から下」（目・眉・髪・耳は絵のまま）。v002 で3案を設定で切りかえ、ユーザーが決めた（2026-10-25）
const area = () => 'nose';
const keyOf = p => p.id + ':' + area();
async function prepare(p) {
  if (cache.has(keyOf(p))) return cache.get(keyOf(p));
  const img = await loadImg(p.src), W = img.width, H = img.height;
  // 顔の線を絵の画素にして、くり抜く所の箱 → だ円の穴（ふちのぼかしのまん中が箱のふちに来る大きさ）
  const L = Object.fromEntries(Object.entries(p.face).map(([k, v]) => [k, k === 'rot' ? v : v * W]));
  const box = areaBox(L, area());
  const hx = box.x, hy = box.y, rx = box.w / 2 / 0.92, ry = box.h / 2 / 0.92, rot = box.rot * Math.PI / 180;
  // 穴の中の絵の色（はしの髪や背景をさけて、だ円の内がわ 8 割）
  const g0 = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  g0.canvas.width = W; g0.canvas.height = H; g0.drawImage(img, 0, 0);
  const bx = Math.max(0, Math.floor(hx - rx)), by = Math.max(0, Math.floor(hy - ry)), bw = Math.ceil(rx * 2), bh = Math.ceil(ry * 2);
  const data = g0.getImageData(bx, by, bw, bh).data;
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  const inside = (x, y, s) => { const dx = x + bx - hx, dy = y + by - hy, u = dx * cos - dy * sin, v = dx * sin + dy * cos; return (u / rx) ** 2 + (v / ry) ** 2 < s * s; };
  const dst = labStats(data, bw, bh, (x, y) => inside(x, y, 0.8));
  // 穴をあける。ふちはぼかす
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  g.save(); g.globalCompositeOperation = 'destination-out';
  g.translate(hx, hy); g.rotate(rot); g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, '#000'); grad.addColorStop(0.84, '#000'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
  // 陰影: 穴の中の絵の明るさを 12×12 にならした地図（灰色 128 が明るさそのまま）。顔の光の当たり方だけが残る
  const shade = shadeMap(data, bw, bh, (x, y) => inside(x, y, 0.85), 12, false);
  const out = { p, img, W, H, hx, hy, rx, ry, box, faceW: L.right - L.left, holed: c, dst, shade, sbox: [bx, by, bw, bh] };
  cache.set(keyOf(p), out);
  return out;
}

// 明るさの地図: n×n のますごとの明るさを、まん中（mask の中）の平均とくらべて灰色にする。
// soft-light で重ねると、明るいますは明るく・暗いますは暗くなる。invert で逆（その陰影を打ち消す）
function shadeMap(data, w, h, mask, n, invert) {
  const sum = new Float32Array(n * n), cnt = new Float32Array(n * n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask(x, y)) continue;
    const i = (y * w + x) * 4, k = Math.min(n - 1, y * n / h | 0) * n + Math.min(n - 1, x * n / w | 0);
    sum[k] += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114; cnt[k]++;
  }
  let all = 0, m = 0;
  for (let k = 0; k < n * n; k++) if (cnt[k]) { all += sum[k] / cnt[k]; m++; }
  const mean = m ? all / m : 128;
  // まわりに1ますずつ灰色（そのまま）のふちをつけ、広げて描いたときに境目が出ないようにする
  const c = Object.assign(document.createElement('canvas'), { width: n + 2, height: n + 2 }), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, n + 2, n + 2);
  const im = g.createImageData(n, n);
  for (let k = 0; k < n * n; k++) {
    let d = cnt[k] ? (sum[k] / cnt[k] / mean - 1) : 0;
    if (invert) d = -d;
    const v = Math.max(30, Math.min(225, 128 + d * 150));
    im.data[k * 4] = im.data[k * 4 + 1] = im.data[k * 4 + 2] = v; im.data[k * 4 + 3] = 255;
  }
  g.putImageData(im, 1, 1);
  c.n = n;
  return c;
}

// 明るさの地図を、ふちのますの分だけ広げて x・y・w・h の箱に描く
function drawShade(g, map, x, y, w, h) {
  const dx = w / map.n, dy = h / map.n;
  g.imageSmoothingEnabled = true; g.drawImage(map, x - dx, y - dy, w + dx * 2, h + dy * 2);
}

// ---- カメラと顔 ----
let video = null, stream = null, lmk = null, blender = null;
// 確かめ用: ?test=<絵の id> でカメラのかわりに、その絵の顔をゆらして映す（カメラのない所で動きを見る）。
// &path=align で、ゆらすかわりに「がんばって穴に合わせる」動き（動くサムネイル用。tools/motion-thumb.mjs）
const QS = new URLSearchParams(location.search), TEST = QS.get('test'), PATH = QS.get('path');
// 絵が出てからの秒 → カメラの中の顔のずれ（dx・dy は画素、k は大きさ、r は度）。行きすぎて、もどって、合う
const ALIGN = [
  [0, -26, 14, 0.86, -11], [4.0, -26, 14, 0.86, -11], [4.6, 72, -32, 1.18, 9], [5.2, -34, 24, 0.9, -6],
  [5.75, 15, -10, 1.05, 3], [6.2, -4, 3, 0.99, -1], [6.55, 0, 0, 1, 0], [99, 0, 0, 1, 0]];
function alignAt(t) {
  let i = 0; while (i < ALIGN.length - 2 && t > ALIGN[i + 1][0]) i++;
  const a = ALIGN[i], b = ALIGN[i + 1], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))), e = (1 - Math.cos(u * Math.PI)) / 2;
  return a.slice(1).map((v, n) => v + (b[n + 1] - v) * e);
}
async function testStream() {
  const p = PAINTINGS.find(q => q.id === TEST) || PAINTINGS[1], img = await loadImg(p.src);
  const c = Object.assign(document.createElement('canvas'), { width: 640, height: 480 }), g = c.getContext('2d');
  const W = img.width, L = Object.fromEntries(Object.entries(p.face).map(([k, v]) => [k, k === 'rot' ? v : v * W]));
  const box = areaBox(L, area()), s = 0.4 * 480 / (L.right - L.left); // 顔の「くり抜く所」の箱のまん中をカメラのまん中に
  const draw = () => {
    const now = performance.now(), t = now / 1000;
    let dx = Math.sin(t * 0.7) * 40, dy = Math.cos(t * 0.5) * 20, k = 1, r = 0;
    if (PATH === 'align') {
      const since = run && run.introAt ? (now - run.introAt) / 1000 : 0;
      [dx, dy, k, r] = alignAt(since);
      r += (run && run.cur ? run.cur.p.face.rot : 0) - p.face.rot; // 合ったとき、絵の顔と同じかたむきに
      dx += Math.sin(t * 9) * 1.5; dy += Math.cos(t * 7) * 1.2;      // 手持ちの小さなゆれ
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#3a3230'; g.fillRect(0, 0, 640, 480);
    g.translate(320 + dx, 240 + dy); g.rotate(r * Math.PI / 180); g.scale(s * k, s * k); g.translate(-box.x, -box.y);
    g.drawImage(img, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
  };
  draw(); setInterval(draw, 33);
  return c.captureStream(30);
}
async function startCamera() {
  if (TEST) stream = await testStream();
  else {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  }
  if (!video) { // iPhone の Safari はページに置いていない video のコマを出さないことがあるので、見えない形で置く
    video = Object.assign(document.createElement('video'), { muted: true, playsInline: true });
    video.setAttribute('playsinline', '');
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.append(video);
  }
  video.srcObject = stream;
  await video.play();
}
function stopCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  if (video) video.srcObject = null;
}

// ---- 1回のあそび ----
const stage = $('#stage'), ctx = stage.getContext('2d');
let run = null;   // { list, i, phase, t0, cur, shots: [] }
let face = null, smooth = null, recent = [], srcStats = null, srcShade = null, lastStat = 0, lastVT = -1;

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

$('#start').onclick = async () => {
  show('play'); $('#wait').hidden = false; $('#wait').textContent = TX('カメラを準備しています…', 'Getting the camera ready…');
  $('#hint').classList.remove('on'); $('#num').classList.remove('on'); $('#timer').style.width = '0';
  const pick = new URLSearchParams(location.search).get('pick'); // 確かめ用: ?pick=pearl,monalisa で絵を決める
  const list = pick ? pick.split(',').map(id => PAINTINGS.find(p => p.id === id)).filter(Boolean) : shuffle(PAINTINGS).slice(0, cfg.shots);
  run = { list, i: 0, phase: 'load', t0: 0, cur: null, shots: [] };
  try {
    blender = blender || createBlender();
    const [ , l, st] = await Promise.all([startCamera(), lmk ? lmk : createLandmarker('VIDEO'), TOUCH[cfg.touch] ? loadStyler() : null]);
    styler = st;
    lmk = l;
    $('#wait').textContent = TX('絵を用意しています…', 'Hanging the paintings…');
    await Promise.all(list.map(prepare));
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    message(denied ? TX('カメラが使えませんでした。ブラウザの設定でカメラを許可すると遊べます。', 'The camera could not be used. Allow the camera in your browser settings to play.')
      : e && e.message === 'nocam' ? TX('このブラウザではカメラが使えません。', 'This browser cannot use a camera.') : TX('カメラか顔の読み取りの準備ができませんでした。ページを読みこみなおしてみてください。', 'The camera or face tracking could not start. Please reload the page.'));
    run = null; return;
  }
  if (!run) return;
  $('#wait').hidden = true;
  begin(0);
};
$('#quit').onclick = () => { run = null; stopCamera(); show('title'); };

function begin(i) {
  run.i = i; run.cur = cache.get(keyOf(run.list[i])); run.phase = 'intro'; run.t0 = run.introAt = performance.now();
  if (TEST) { // 確かめ用: 絵が出た時刻と、穴のまん中（絵の中の割合）。動くサムネイルの切り出しに使う
    (window.__begins = window.__begins || []).push(Date.now());
    window.__hole = { x: run.cur.hx / run.cur.W, y: run.cur.hy / run.cur.H };
  }
  run.lastNum = 0; srcStats = null; recent = [];
  const p = run.cur.p;
  $('#count').textContent = `${i + 1} / ${run.list.length}`;
  $('#name').textContent = TX(`${p.title}　${p.artist}`, `${p.title_en} · ${p.artist_en}`);
  const hint = TX(p.hint, p.hint_en);
  $('#hint').innerHTML = i === 0 ? TX(`<small>顔を穴に合わせて</small>「${hint}」`, `<small>Fit your face in the hole: </small>${hint}`) : hint;
  $('#hint').classList.add('on');
  fitStage();
}

function fitStage() {
  if (!run || !run.cur) return;
  const box = $('#stagebox'), pad = parseFloat(getComputedStyle($('#frame')).paddingLeft) * 2;
  const aw = box.clientWidth - pad, ah = box.clientHeight - pad, a = run.cur.W / run.cur.H;
  let w = aw, h = aw / a; if (h > ah) { h = ah; w = ah * a; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  stage.style.width = Math.round(w) + 'px'; stage.style.height = Math.round(h) + 'px';
  stage.width = Math.round(w * dpr); stage.height = Math.round(h * dpr);
}
addEventListener('resize', fitStage);

// 顔の位置 → 看板の中での映像の置き方（絵の画素で）
function placement(cur, gw, gh) {
  const s = ASSIST[cfg.assist] || 0;
  const k0 = cur.faceW / (0.4 * Math.min(gw, gh));       // 寄せないとき: カメラのまん中・ふつうの近さで、顔のはばが絵の顔のはばに合う
  // 寄せきったとき: 自分の顔の「くり抜く所」の箱が、絵の穴の箱をおおう大きさ（髪・眉・耳は穴の外へ。ユーザー）
  const kf = smooth ? Math.max(cur.box.w / smooth.w, cur.box.h / smooth.h) : k0;
  const k = k0 + (kf - k0) * s;
  const cx = gw / 2 + ((smooth ? smooth.x : gw / 2) - gw / 2) * s;
  const cy = gh / 2 + ((smooth ? smooth.y : gh / 2) - gh / 2) * s;
  return { k, ox: cur.hx - k * cx, oy: cur.hy - k * cy };
}

// 筆のタッチ: 遊んでいるあいだは LIVE の大きさで、変換が終わるたびに次をはじめる（1〜2コマおくれる）。写真は PHOTO で撮りなおす。
// styler は loadStyler の結果（null なら使わない。live が false なら写真だけ）
let styler = null, styleBusy = false, styleId = null, styleBox = null;
const liveStyle = document.createElement('canvas');
const holeRect = (cur, scale) => cur.sbox.map(v => v * scale);
function compose(g, cur, scale, live) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#121010'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  const gw = blender.canvas.width, gh = blender.canvas.height;
  if (gw) {
    const pl = placement(cur, gw, gh);
    g.setTransform(scale * pl.k, 0, 0, scale * pl.k, scale * pl.ox, scale * pl.oy);
    g.drawImage(blender.canvas, 0, 0);
    // 陰影をなじませる: 自分の顔の光の当たり方をうすめてから、絵の顔の陰影をのせる
    const amt = BLEND[cfg.blend] || 0;
    if (amt > 0) {
      g.save(); g.globalCompositeOperation = 'soft-light';
      if (srcShade) { // 映像の中の顔のまん中（鏡にしてあるので左右を返す）
        const [sx, sy, sw, sh] = srcShade.box;
        g.globalAlpha = amt * 0.7;
        g.translate(sx + sw / 2, 0); g.scale(-1, 1); drawShade(g, srcShade.map, -sw / 2, sy, sw, sh);
      }
      g.restore(); g.save(); g.globalCompositeOperation = 'soft-light';
      g.setTransform(scale, 0, 0, scale, 0, 0); g.globalAlpha = amt;
      const [bx, by, bw, bh] = cur.sbox; drawShade(g, cur.shade, bx, by, bw, bh);
      g.restore();
    }
  }
  const touch = TOUCH[cfg.touch] || 0;
  if (live && styler && styler.live && touch > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const r = holeRect(cur, scale);
    if (!styleBusy) { // いまの絵を渡してから、前の結果を描く
      styleBusy = true; const id = cur.p.id;
      stylize(g.canvas, r, id, LIVE, liveStyle).then(b => { styleId = b ? id : null; styleBox = b; }).catch(() => { styleId = null; }).finally(() => { styleBusy = false; });
    }
    if (styleId === cur.p.id && styleBox) { const [x, y, d] = styleBox; g.globalAlpha = touch; g.drawImage(liveStyle, x, y, d, d); g.globalAlpha = 1; }
  }
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.drawImage(cur.holed, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// 映像の顔の色を測る（小さく縮めて、顔のまん中だけ）
const statG = Object.assign(document.createElement('canvas'), { width: 40, height: 40 }).getContext('2d', { willReadFrequently: true });
function measureFace(gw, gh) {
  if (!face) return;
  const vw = video.videoWidth, f = vw / gw, b = face.box;
  const w = b.w * 0.6 * f, h = b.h * 0.6 * f, x = (gw - b.x) * f - w / 2, y = b.y * f - h / 2;
  statG.drawImage(video, x, y, w, h, 0, 0, 40, 40);
  const px = statG.getImageData(0, 0, 40, 40).data, round = (i, j) => (i - 19.5) ** 2 + (j - 19.5) ** 2 < 400;
  srcShade = { map: shadeMap(px, 40, 40, round, 6, true), box: [b.x - b.w * 0.3, b.y - b.h * 0.3, b.w * 0.6, b.h * 0.6] };
  const st = labStats(px, 40, 40, round);
  if (!st) return;
  if (!srcStats) srcStats = st;
  else for (const k of ['mean', 'std']) srcStats[k] = srcStats[k].map((v, n) => v + (st[k][n] - v) * 0.3);
}

function shoot() {
  if (TEST) (window.__shots = window.__shots || []).push(Date.now()); // 確かめ用: シャッターの時刻
  const cur = run.cur, c = document.createElement('canvas');
  c.width = cur.W; c.height = cur.H;
  const cg = c.getContext('2d');
  compose(cg, cur, 1);
  const touch = TOUCH[cfg.touch] || 0;
  if (styler && touch > 0) { // 写真は細かく変換して重ね、穴のあいた絵をのせなおす
    const r = holeRect(cur, 1), out = document.createElement('canvas');
    run.pending = (run.pending || 0) + 1;
    stylize(c, r, cur.p.id, PHOTO, out).then(b => {
      if (b) { cg.globalAlpha = touch; cg.drawImage(out, b[0], b[1], b[2], b[2]); cg.globalAlpha = 1; cg.drawImage(cur.holed, 0, 0); }
    }).catch(() => {}).finally(() => { if (run) run.pending--; });
  }
  const now = performance.now();
  const f = averageFaces(recent.filter(r => now - r.t < 450).map(r => r.f));
  const score = scoreFace(f, cur.p);
  run.shots.push({ p: cur.p, canvas: c, score });
  shutterSound();
  const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  run.phase = 'freeze'; run.t0 = now; run.frozen = c;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!run || run.phase === 'load' || !run.cur || !video || video.readyState < 2) return;
  const cur = run.cur;
  const vw = video.videoWidth, vh = video.videoHeight, sc = Math.min(1, 640 / Math.max(vw, vh));
  const gw = Math.round(vw * sc), gh = Math.round(vh * sc);
  // 顔を読む（新しいコマのときだけ）
  if (video.currentTime !== lastVT) {
    lastVT = video.currentTime;
    try { face = readFace(lmk.detectForVideo(video, now), gw, gh, true); } catch (e) { face = null; }
    if (face) {
      const b = areaBox(face.lines, area());
      smooth = smooth ? { x: smooth.x + (b.x - smooth.x) * 0.35, y: smooth.y + (b.y - smooth.y) * 0.35, w: smooth.w + (b.w - smooth.w) * 0.25, h: smooth.h + (b.h - smooth.h) * 0.25 } : { ...b };
      recent.push({ t: now, f: face }); while (recent.length && now - recent[0].t > 1000) recent.shift();
      if (now - lastStat > 300 || !srcStats) { lastStat = now; measureFace(gw, gh); }
    }
  }
  const t = (now - run.t0) / 1000;
  if (run.phase === 'freeze') {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(run.frozen, 0, 0, stage.width, stage.height);
    if (t > 1.1) {
      if (run.i + 1 < run.list.length) begin(run.i + 1);
      else if (!run.pending) finish(); // 写真の筆のタッチが終わってから
    }
    return;
  }
  blender.draw(video, gw, gh, srcStats, cur.dst, BLEND[cfg.blend] || 0);
  compose(ctx, cur, stage.width / cur.W, true);
  if (run.phase === 'intro') {
    $('#timer').style.width = '0';
    if (t > INTRO) { run.phase = 'pose'; run.t0 = now; }
  } else if (run.phase === 'pose') {
    const left = cfg.secs - t;
    $('#timer').style.width = Math.min(100, t / cfg.secs * 100) + '%';
    const n = Math.ceil(left);
    if (left <= 3 && n > 0) {
      $('#num').textContent = n; $('#num').classList.add('on');
      if (run.lastNum !== n) { run.lastNum = n; beep(660, 0.12); }
    }
    if (left <= 0) { $('#num').classList.remove('on'); shoot(); }
  }
}
requestAnimationFrame(frame);

// ---- けっか ----
const RANKS = [[90, TX('名画そのもの', 'A true masterpiece')], [75, TX('美術館にかざれる', 'Museum-worthy')], [55, TX('なかなかの名優', 'Quite the actor')], [35, TX('あと少し、大げさに', 'A little bigger!')], [0, TX('もっと大げさに！', 'Go bigger!')]];
function finish() {
  const shots = run.shots; run = null; stopCamera();
  const total = Math.round(shots.reduce((a, s) => a + s.score.total, 0) / shots.length);
  $('#total').textContent = total;
  $('#rank').textContent = RANKS.find(r => total >= r[0])[1];
  const box = $('#shots'); box.textContent = '';
  shots.forEach((s, i) => {
    const el = document.createElement('div'); el.className = 'shot';
    const img = new Image(); img.alt = TX(s.p.title, s.p.title_en); img.src = s.canvas.toDataURL('image/jpeg', 0.9);
    const parts = s.score.missing ? TX('顔が見つかりませんでした', 'No face was found') : s.score.parts.map(q => `${TX(q.name, q.name_en)} ${mark(q.v)}`).join(TX('　', '   '));
    el.innerHTML = `<div class="t"></div><div class="parts"></div><div class="row"><span class="sc">${s.score.total}${TX('点', ' pts')}</span><button class="sv">${TX('保存', 'Save')}</button></div>`;
    el.querySelector('.t').textContent = TX(`${s.p.title}（${s.p.artist}）`, `${s.p.title_en} (${s.p.artist_en})`);
    el.querySelector('.parts').textContent = parts;
    el.prepend(img);
    el.querySelector('.sv').onclick = () => download(s.canvas, `kaohame-${i + 1}-${s.p.id}.jpg`);
    box.append(el);
  });
  $('#saveAll').onclick = () => download(sheet(shots, total), 'kaohame-all.jpg');
  show('result');
  beep(523, 0.18, 0.1); setTimeout(() => beep(784, 0.3, 0.1), 160);
}
$('#again').onclick = () => $('#start').onclick();

function download(canvas, name) {
  canvas.toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/jpeg', 0.92);
}

// まとめて1枚: 額に入れた写真をならべ、題と点をそえる
function sheet(shots, total) {
  const cols = Math.min(shots.length, 3), rows = Math.ceil(shots.length / cols), th = 520, gap = 40, cap = 70, head = 130;
  const tiles = shots.map(s => ({ s, w: Math.round(th * s.canvas.width / s.canvas.height) }));
  const tw = Math.max(...tiles.map(t => t.w));
  const foot = 64;   // 右下のしるし（しし屋 あそびラボ）の段
  const W = cols * tw + (cols + 1) * gap, H = head + rows * (th + cap) + (rows + 1) * gap + foot;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(W / 2, H * 0.3, 50, W / 2, H * 0.3, Math.max(W, H)); bg.addColorStop(0, '#2a241e'); bg.addColorStop(1, '#141210');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f1e9dc'; g.textAlign = 'center'; g.font = '800 54px "Shippori Mincho", serif';
  g.fillText(TX(`名画の顔ハメ　${total}点`, `Masterpiece Face-in-Hole   ${total} pts`), W / 2, 92);
  tiles.forEach((t, i) => {
    const col = i % cols, row = i / cols | 0;
    const inRow = Math.min(cols, tiles.length - row * cols), shift = (cols - inRow) * (tw + gap) / 2; // 残りの段はまん中へ
    const x = gap + shift + col * (tw + gap) + (tw - t.w) / 2, y = head + gap + row * (th + cap + gap);
    g.fillStyle = '#b8903f'; g.fillRect(x - 12, y - 12, t.w + 24, th + 24);
    g.fillStyle = '#5a3f14'; g.fillRect(x - 3, y - 3, t.w + 6, th + 6);
    g.drawImage(t.s.canvas, x, y, t.w, th);
    const capText = TX(`${t.s.p.title}　${t.s.score.total}点`, `${t.s.p.title_en}   ${t.s.score.total} pts`);
    g.fillStyle = '#a99d8c'; g.font = '700 24px "Zen Kaku Gothic New", sans-serif';
    const cw = g.measureText(capText).width, room = t.w + 24; // 長い題は額のはばに収まるよう字を小さく
    if (cw > room) g.font = `700 ${Math.floor(24 * room / cw)}px "Zen Kaku Gothic New", sans-serif`;
    g.fillText(capText, x + t.w / 2, y + th + 52);
  });
  // しるし: 右はしは額のふちにそろえ、下の段のまん中に。ライオン → しし屋（太く）→ あそびラボ
  const right = W - gap + 12, cy = H - foot / 2 - gap / 2, icon = 40, sp = 12;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  const f1 = '700 24px "Zen Kaku Gothic New", sans-serif', f2 = '500 22px "Zen Kaku Gothic New", sans-serif';
  g.font = f2; const w2 = g.measureText(LAB).width;
  g.font = f1; const w1 = g.measureText(SHOP).width;
  let x = right - w2 - 10 - w1 - sp - icon;
  if (lion.complete && lion.naturalWidth) g.drawImage(lion, x, cy - icon / 2, icon, icon);
  x += icon + sp;
  g.fillStyle = '#d8cdbd'; g.fillText(SHOP, x, cy + 1);
  g.font = f2; g.fillStyle = '#a99d8c'; g.fillText(LAB, x + w1 + 10, cy + 1);
  g.textBaseline = 'alphabetic';
  return c;
}
const SHOP = TX('しし屋', 'Shishiya'), LAB = TX('あそびラボ', 'Asobi Lab');
// しるしのライオン（しし屋のアイコン。先に読んでおく）
const lion = new Image(); lion.src = 'img/lion.svg';
