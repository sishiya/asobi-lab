// テレビの信号の計算（1コマ約 11ms）を、画面の係とは別のスレッドで。
// うけとる: { data: 256×240 の RGBA, link: 'composite' | 'rf' | 'svideo' } → かえす: 横 1024 点 × 240 行の RGBA
import { decodeFrame, setSquare } from './ntsc.js';

setSquare(true); // 当時の機械と同じく、色を四角い波で作る

onmessage = (e) => {
  const { data, link } = e.data;
  const out = decodeFrame({ w: 256, h: 240, data }, link, 0, 1); // ドットクロールは止める（30 回／秒の点滅をさける）
  postMessage(out, [out.buffer]);
};
