// ぺらぺら世界の歴史係の紹介動画の共通部分（ショート flat-history.html?short・説明動画 flat-history-guide.html）（2026-11-07）
// 素材は flat-history-clips.mjs が撮った out/fh-clips/<名前>.mp4（PC の横の画面 1920×1080、本物の速さ）と .json（場面の時刻 marks）。
// 描き方は名画の顔ハメと同じ（face-in-frame-common.js の fifSeek・fifView・fifFrame を使う。クリップは FIF.v に入れる）。
'use strict';
const FH_CLIPS = ['play1', 'pl-t3', 'pl-t6', 'pl-m2', 'pl-m3', 'pl-g1', 'pl-g3', 'pl-x1', 'pl-x2'];
// クリップの中の場所（0〜1。ゲームの 1280×720 の画面で測った）: [寄る点 x, y, 見せる幅]
const FH_AT = {
  full: [0.5, 0.5, 1],
  preview: [0.5, 0.484, 0.6],      // 開始の画面の2D（このままだと、こうなる）
  bindNow: [0.5, 0.6235, 0.32],     // 正史にする: いまの歴史（下の段）
  bindBoth: [0.5, 0.495, 0.42],     // はじめの歴史といまの歴史の2段
  resNow: [0.5, 0.3235, 0.32],      // 判定のあと: いまの歴史（上へ動く）
  stamp: [0.5, 0.5, 0.56],          // 判の「正史」とまわり
  play: [0.47, 0.5, 0.72],          // 3D の遊び場（まん中寄り）
};
async function fhLoad() {
  // 丸ごと読んで blob にする（開発用サーバーは1本ずつしか返さないので、video の読みかけの接続が残ると次が止まる）
  const loadVid = async (n) => {
    const r = await fetch('out/fh-clips/' + n + '.mp4');
    if (!r.ok) throw new Error('素材がない: out/fh-clips/' + n + '.mp4（node _dev/promo/flat-history-clips.mjs で撮る）');
    const url = URL.createObjectURL(await r.blob());
    return new Promise((ok, ng) => {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.playsInline = true;
      v.oncanplaythrough = () => { v.oncanplaythrough = null; ok(v); };
      v.onerror = () => ng(new Error('読めない: ' + n + '.mp4'));
      v.src = url;
    });
  };
  for (const n of FH_CLIPS) {
    FIF.v[n] = await loadVid(n);
    FIF.meta[n] = await (await fetch('out/fh-clips/' + n + '.json')).json();
  }
  FIF.ready = true;
}
// クリップの印（marks）の時刻 + ずらし
const fhM = (clip, k, d = 0) => FIF.meta[clip].marks[k] + d;
// 場面のクリップを、FH_AT の場所に寄せて四角に描く
function fhView(g, s, x, y, w, h) {
  const [fx, fy, fw] = FH_AT[s.at || 'full'];
  fifView(g, FIF.v[s.clip], x, y, w, h, [fx, fy], 1 / fw);
}
// 舞台裏の札（2Dでは… → 3Dでは…）。ゲームの判定の画面の「舞台裏」と同じ言葉
function fhReveal(g, f, cx, y, w, two, three, size = 44) {
  if (f <= 0) return;
  const k = backOut(clamp(f * 1.3, 0, 1));
  g.save(); g.shadowBlur = 0; g.globalAlpha = clamp(f * 2, 0, 1);
  g.translate(cx, y); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  const h = size * 3.6;
  g.fillStyle = 'rgba(12,40,35,0.92)'; g.strokeStyle = '#e0b14c'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(-w / 2, 0, w, h, 18); g.fill(); g.stroke();
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const lx = -w / 2 + size * 0.7;
  setFont(g, size * 0.62, true); g.fillStyle = '#d9c38a'; g.fillText('2Dでは', lx, size * 1.0);
  g.fillText('3Dでは', lx, size * 2.55);
  const vx = lx + size * 2.6;
  setFont(g, size, true); g.fillStyle = '#fff3d8'; g.fillText(two, vx, size * 1.0);
  g.fillStyle = '#ffd27a'; g.fillText(three, vx, size * 2.55);
  g.restore();
}
