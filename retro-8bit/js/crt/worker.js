// テレビの信号と光のにじみの計算を、画面の係とは別のスレッドで（信号 1コマ約 11ms、にじみ 10〜20ms）。
// うけとる: { data: 256×240 の RGBA, link: 'rgb' | 'composite' | 'rf' | 'svideo', glow: にじみも作るか }
// かえす: { sig: 横 1024 点 × 240 行の RGBA, glow: { f, gw, gh } か null }
import { decodeFrame, setSquare } from './ntsc.js';
import { makeGlow } from './crt-gl.js';

setSquare(true); // 当時の機械と同じく、色を四角い波で作る

onmessage = (e) => {
  const { data, link, glow } = e.data;
  let sig;
  if (link === 'rgb') {
    // RGB: 信号はドットのまま（1ドット 4 点にのばす）
    sig = new Uint8ClampedArray(1024 * 240 * 4);
    const s32 = new Uint32Array(sig.buffer), d32 = new Uint32Array(data.buffer, data.byteOffset, 256 * 240);
    for (let i = 0, j = 0; i < d32.length; i++, j += 4) { const c = d32[i]; s32[j] = c; s32[j + 1] = c; s32[j + 2] = c; s32[j + 3] = c; }
  } else {
    sig = decodeFrame({ w: 256, h: 240, data }, link, 0, 1); // ドットクロールは止める（30 回／秒の点滅をさける）
  }
  const g = glow ? makeGlow(sig, 1024, 240, 256, 240) : null; // 画面の上の大きさ 256×240（たて横同じ画素）
  postMessage({ sig, glow: g }, g ? [sig.buffer, g.f.buffer] : [sig.buffer]);
};
