// 顔を見つける（MediaPipe Face Landmarker）と、表情の数を取り出す。
// 映像はこの端末の中だけで読み、どこへも送らない。モデルもリポジトリの vendor/ から読む。
import { FaceLandmarker, FilesetResolver } from '../../../vendor/mediapipe/vision_bundle.js';

const BASE = new URL('../../../vendor/mediapipe/', import.meta.url).href.replace(/\/$/, '');

export async function createLandmarker(mode) {
  const files = await FilesetResolver.forVisionTasks(BASE);
  // wasm は自分で1回だけ読み、application/wasm の種類をつけて渡す。サーバーが種類をつけないと、
  // 読みこみが2回走り、1本ずつしか返せない手元のサーバー（.claude/serve.ps1 の古い版）が止まるため
  try {
    const buf = await (await fetch(files.wasmBinaryPath)).arrayBuffer();
    files.wasmBinaryPath = URL.createObjectURL(new Blob([buf], { type: 'application/wasm' }));
  } catch (e) {}
  const opts = delegate => ({
    baseOptions: { modelAssetPath: BASE + '/face_landmarker.task', delegate },
    runningMode: mode, numFaces: 1, outputFaceBlendshapes: true,
  });
  try { return await FaceLandmarker.createFromOptions(files, opts('GPU')); }
  catch (e) { return FaceLandmarker.createFromOptions(files, opts('CPU')); }
}

// 顔のりんかくの点（FACE_OVAL）。外わくの大きさと中心を出すのに使う
const OVAL = [...new Set(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.flatMap(c => [c.start, c.end]))];

// 結果 → 顔の位置・大きさ・向きと、部位ごとの表情の数。
// w・h は画像の大きさ（たてよこの比で角度がずれないように）。mirror は鏡にして見せるとき
export function readFace(result, w, h, mirror) {
  const lm = result && result.faceLandmarks && result.faceLandmarks[0];
  if (!lm) return null;
  const P = i => ({ x: (mirror ? 1 - lm[i].x : lm[i].x) * w, y: lm[i].y * h });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const i of OVAL) { const p = P(i); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  // 画面で左の目じり → 右の目じり の向きで首のかたむき（右に倒すと＋）
  let a = P(33), b = P(263);
  if (a.x > b.x) [a, b] = [b, a];
  const roll = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  // 鼻先がほおの間のどこにあるか（画面の右向きが＋）
  let l = P(234), r = P(454);
  if (l.x > r.x) [l, r] = [r, l];
  const nose = P(1);
  const yaw = ((nose.x - (l.x + r.x) / 2) / Math.max(1, r.x - l.x)) * 2;
  const bs = {};
  const cats = result.faceBlendshapes && result.faceBlendshapes[0];
  if (cats) for (const c of cats.categories) bs[c.categoryName] = c.score;
  return { box: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }, roll, yaw, ex: expression(bs) };
}

const avg = (bs, a, b) => ((bs[a] || 0) + (bs[b] || 0)) / 2;

// 採点に使う表情の数（0〜1）。左右はならす（鏡にしても同じになるように）
export function expression(bs) {
  return {
    jaw: bs.jawOpen || 0,
    smile: avg(bs, 'mouthSmileLeft', 'mouthSmileRight'),
    frown: Math.min(1, avg(bs, 'mouthFrownLeft', 'mouthFrownRight') + avg(bs, 'mouthPressLeft', 'mouthPressRight') * 0.6),
    round: Math.min(1, (bs.mouthFunnel || 0) + (bs.mouthPucker || 0) * 0.5),
    browUp: Math.min(1, (bs.browInnerUp || 0) * 0.7 + avg(bs, 'browOuterUpLeft', 'browOuterUpRight') * 0.5),
    browDown: avg(bs, 'browDownLeft', 'browDownRight'),
    eyeWide: avg(bs, 'eyeWideLeft', 'eyeWideRight'),
    eyeNarrow: Math.min(1, avg(bs, 'eyeSquintLeft', 'eyeSquintRight') + avg(bs, 'eyeBlinkLeft', 'eyeBlinkRight') * 0.5),
  };
}
