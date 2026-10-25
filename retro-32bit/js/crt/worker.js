// テレビの信号と光のにじみの計算を、画面の係とは別のスレッドで（8ビット互換機の crt/worker.js を、横のドット数が変わる 32ビット用にしたもの）。
// うけとる: { data: w×h の RGBA, w, h, link: 'rgb' | 'composite' | 'rf' | 'svideo', glow: にじみも作るか }
// かえす: { sig: 横 sigW 点 × h 行の RGBA, sigW, glow: { f, gw, gh } か null }
//   ドットの速さは 横のドット数/256（ntsc.js の dotW。当時の機械も、横のドット数をふやすときはドットを速くした）。RGB は 1ドット 4 点にのばす
import { decodeFrame, setSquare } from './ntsc.js';
import { makeGlow } from './crt-gl.js';

setSquare(true); // 当時の機械と同じく、色を四角い波で作る

onmessage = (e) => {
  const { data, w, h, link, glow } = e.data;
  let sig, sigW;
  if (link === 'rgb') {
    sigW = w * 4;
    sig = new Uint8ClampedArray(sigW * h * 4);
    const s32 = new Uint32Array(sig.buffer), d32 = new Uint32Array(data.buffer, data.byteOffset, w * h);
    for (let i = 0, j = 0; i < d32.length; i++, j += 4) { const c = d32[i]; s32[j] = c; s32[j + 1] = c; s32[j + 2] = c; s32[j + 3] = c; }
  } else {
    sig = decodeFrame({ w, h, data }, link, 0, w / 256); // ドットクロールは止める（30 回／秒の点滅をさける）
    sigW = sig.w;
  }
  const g = glow ? makeGlow(sig, sigW, h, w, h) : null; // 画面の上の大きさ w×h（たて横同じ画素）
  postMessage({ sig, sigW, glow: g }, g ? [sig.buffer, g.f.buffer] : [sig.buffer]);
};
