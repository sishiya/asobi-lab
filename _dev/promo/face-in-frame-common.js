// 名画の顔ハメの紹介動画の共通部分（ショート face-in-frame.html?short・説明動画 face-in-frame-guide.html）
// 素材は face-in-frame-clips.mjs が撮った out/fif-clips/<名前>.mp4（スマホのたて画面 1080×1920、本物の速さ）と .json（場面の時刻）・<名前>-result/*.png。
// カメラは使わず、ゲームの確かめ用 ?test=<絵>&path=align で、別の名画の顔をカメラのかわりにして遊んだもの（本物の人の顔はうつさない）。
// 動画の時刻 t → クリップの時刻 ct は、場面ごとに ct = c0 + (t − a) × rate。コマごとに video をその時刻へ動かして描く。
'use strict';
const FIF = { v: {}, meta: {}, img: {}, ready: false };
const FIF_CLIPS = ['title', 'play', 'mona', 'plain'];
async function fifLoad() {
  // 丸ごと読んで blob にする（開発用サーバー .claude/serve.ps1 は1本ずつしか返さないので、video の読みかけの接続が残ると次が止まる）
  const loadVid = async n => {
    const r = await fetch('out/fif-clips/' + n + '.mp4');
    if (!r.ok) throw new Error('素材がない: out/fif-clips/' + n + '.mp4（node _dev/promo/face-in-frame-clips.mjs で撮る）');
    const url = URL.createObjectURL(await r.blob());
    return new Promise((ok, ng) => {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.playsInline = true;
      v.oncanplaythrough = () => { v.oncanplaythrough = null; ok(v); };
      v.onerror = () => ng(new Error('読めない: ' + n + '.mp4'));
      v.src = url;
    });
  };
  const loadImg = p => new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ng(new Error('素材がない: ' + p)); im.src = p; });
  for (const n of FIF_CLIPS) {
    FIF.v[n] = await loadVid(n);
    FIF.meta[n] = await (await fetch('out/fif-clips/' + n + '.json')).json();
  }
  for (const k of ['top', 'bottom']) FIF.img[k] = await loadImg('out/fif-clips/play-result/' + k + '.png');
  FIF.ready = true;
}
// 場面 { a, b, clip, c0, rate }（rate は省くと 1）での、時刻 t のクリップの時刻
const fifCt = (s, t) => clamp(s.c0 + (Math.min(t, s.b) - s.a) * (s.rate ?? 1), 0, FIF.v[s.clip].duration - 0.05);
// t の場面（scenes の中で t < b の最初のもの）のクリップを、その時刻に動かす。
// 同じクリップを続く場面で使うので、重なりは見ない（場面の替わり目は黒をはさむ）。
// 場面の時刻は、クリップの中の絵が出た・シャッターの白い光のコマで合わせる（.json の begins は絵の準備の前なので、出るのは 3 秒ほどあと）
async function fifSeek(scenes, t) {
  const want = {}, s = scenes.find(q => t < q.b) || scenes[scenes.length - 1];
  if (s.clip) want[s.clip] = fifCt(s, t);
  for (const [n, ct] of s.stills || []) want[n] = ct;   // 止めたコマを並べる場面（stills: [[クリップ, 時刻], …]）
  for (const [n, ct] of Object.entries(want)) {
    const v = FIF.v[n];
    if (Math.abs(v.currentTime - ct) < 0.001) continue;
    await new Promise(r => { const done = () => { v.removeEventListener('seeked', done); r(); }; v.addEventListener('seeked', done); v.currentTime = ct; setTimeout(done, 3000); });
  }
}
// クリップの一部を四角に描く。focus: 寄る点（クリップの中の 0〜1）、zoom: 1 で横いっぱい
function fifView(g, src, x, y, w, h, focus = [0.5, 0.5], zoom = 1) {
  const SW = src.videoWidth || src.width, SH = src.videoHeight || src.height;
  const cw = SW / zoom, ch = cw * h / w;
  const sx = clamp(focus[0] * SW - cw / 2, 0, Math.max(0, SW - cw)), sy = clamp(focus[1] * SH - ch / 2, 0, Math.max(0, SH - ch));
  g.drawImage(src, sx, sy, cw, ch, x, y, w, h);
}
// 金のふちの額（寄った絵を入れる）。f: 0→1 で出る
function fifFrame(g, x, y, w, h, f, draw, label) {
  if (f <= 0) return;
  g.save(); g.shadowBlur = 0; g.globalAlpha = clamp(f * 2, 0, 1);
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 30;
  g.fillStyle = '#b8862f'; g.beginPath(); g.roundRect(x - 14, y - 14, w + 28, h + 28, 6); g.fill();
  g.shadowBlur = 0; g.strokeStyle = '#e6c06a'; g.lineWidth = 3; g.strokeRect(x - 6, y - 6, w + 12, h + 12);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); draw(); g.restore();
  if (label) {
    setFont(g, 28, true); const lw = g.measureText(label).width + 40;
    g.fillStyle = 'rgba(16,12,9,0.85)'; g.beginPath(); g.roundRect(x + 18, y + 18, lw, 50, 25); g.fill();
    g.fillStyle = '#f2d59a'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 38, y + 44);
  }
  g.restore();
}
// スマホの枠（dino の drPhone と同じ形で、画面は 9:16 のクリップ）。draw(sw, sh) で画面の中身を（-sw/2, -sh/2）から描く
function fifPhone(g, cx, cy, h, f, draw, o = {}) {
  if (f <= 0) return;
  const sw = h * 9 / 16, sh = h, wd = sw + h * 0.05, ht = h * 1.04, k = backOut(clamp(f, 0, 1));
  g.save(); g.shadowBlur = 0; g.globalAlpha = clamp(f * 3, 0, 1);
  g.translate(cx, cy + (1 - k) * PH * 0.2); g.rotate(o.tilt || 0); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40;
  g.fillStyle = '#0c0b0a'; g.beginPath(); g.roundRect(-wd / 2, -ht / 2, wd, ht, wd * 0.12); g.fill();
  g.shadowBlur = 0; g.strokeStyle = '#4a4134'; g.lineWidth = 3; g.stroke();
  g.save(); g.beginPath(); g.roundRect(-sw / 2, -sh / 2, sw, sh, sw * 0.09); g.clip();
  draw(sw, sh);
  if (o.tap && o.tap.u > 0 && o.tap.u < 1) {
    const u = o.tap.u, tx = -sw / 2 + sw * o.tap.x, ty = -sh / 2 + sh * o.tap.y;
    g.strokeStyle = `rgba(255,214,120,${1 - u})`; g.lineWidth = 6; g.beginPath(); g.arc(tx, ty, h * 0.02 + h * 0.05 * u, 0, Math.PI * 2); g.stroke();
    g.fillStyle = `rgba(255,214,120,${0.55 * (1 - u)})`; g.beginPath(); g.arc(tx, ty, h * 0.02, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.restore();
}
// スマホの画面に、場面のクリップ（または静止画 img、slide で横にすべって替わる）
function fifPhoneScene(g, cx, cy, h, f, s, t, o = {}) {
  fifPhone(g, cx, cy, h, f, (sw, sh) => {
    if (s.img) {
      const sl = s.from ? ease((t - s.slideAt) / 0.45) : 1;
      if (s.from && sl < 1) g.drawImage(FIF.img[s.from], -sw / 2, -sh / 2 - sh * sl, sw, sh);
      g.drawImage(FIF.img[s.img], -sw / 2, -sh / 2 + (s.from ? sh * (1 - sl) : 0), sw, sh);
    } else g.drawImage(FIF.v[s.clip], -sw / 2, -sh / 2, sw, sh);
  }, o);
}
// 「この動画では、カメラのかわりに名画の顔で遊んでいます」の小さな札
const FIF_STANDIN = '※ 動画では本物の顔のかわりに、名画の顔で遊んでいます';
function fifStandIn(g, f, x, y, align = 'center', s = FIF_STANDIN) {
  if (f <= 0) return;
  g.save(); g.shadowBlur = 0; g.globalAlpha = f;
  setFont(g, 26, true);
  const w = g.measureText(s).width + 40, x0 = align === 'center' ? x - w / 2 : x;
  g.fillStyle = 'rgba(16,12,9,0.78)'; g.beginPath(); g.roundRect(x0, y - 24, w, 48, 24); g.fill();
  g.fillStyle = '#e8dcc6'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(s, x0 + 20, y + 1);
  g.restore();
}
