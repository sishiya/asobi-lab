// 顔を見つける（MediaPipe Face Landmarker）と、表情の数を取り出す。
// 映像はこの端末の中だけで読み、どこへも送らない。モデルもリポジトリの vendor/ から読む。
import { FaceLandmarker, FilesetResolver } from '../vendor/mediapipe/vision_bundle.js';

const BASE = new URL('../vendor/mediapipe/', import.meta.url).href.replace(/\/$/, '');

export async function createLandmarker(mode) {
  const files = await FilesetResolver.forVisionTasks(BASE);
  // wasm は自分で1回だけ読み、application/wasm の種類をつけて渡す。サーバーが種類をつけないと、
  // 読みこみが2回走り、1本ずつしか返せない手元のサーバー（.claude/serve.ps1 の古い版）が止まるため
  // 公開のサイト（GitHub Pages）は種類が正しく、読みながら組み立てられる（streaming）ので、手元のサーバーのときだけ（v012）
  if (['localhost', '127.0.0.1'].includes(location.hostname)) try {
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
  return { box: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }, lines: faceLines(P, roll), roll, yaw, ex: expression(bs) };
}

// 顔の線: 鼻先 (nx, ny) を中心に、首のかたむき rot だけ回した向きで、鼻先からの
// 眉の下（brow）・上まぶた（lidTop）・下まぶた（lidBot）・あご（chin）の高さと、ほお（left・right）の横の位置
function faceLines(P, roll) {
  const t = -roll * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), o = P(1);
  const R = i => { const p = P(i), dx = p.x - o.x, dy = p.y - o.y; return { x: dx * c - dy * s, y: dx * s + dy * c }; };
  const xs = [234, 454, 33, 263, 61, 291].map(i => R(i).x); // ほお・目じり・口の角（横を向いた顔は向こうのほおが隠れるので）
  return { nx: o.x, ny: o.y, rot: roll,
    brow: Math.min(R(65).y, R(295).y), lidTop: Math.min(R(159).y, R(386).y), lidBot: Math.max(R(145).y, R(374).y),
    chin: R(152).y, left: Math.min(...xs), right: Math.max(...xs) };
}

// くり抜く所ごとの箱（顔の線と同じ単位）。絵の穴と、映像の顔の両方をこれで決めて、箱どうしを重ねる。
//   nose: 鼻から下（目は絵のまま） / eyes: 目から下（眉・髪・耳は絵のまま） / face: 顔ぜんぶ
export const AREAS = ['nose', 'eyes', 'face'];
export function areaBox(L, area) {
  const span = L.chin - L.brow;
  const top = area === 'nose' ? L.lidBot + (0 - L.lidBot) * 0.3
    : area === 'eyes' ? L.lidTop - (L.lidTop - L.brow) * 0.45
    : L.brow - span * 0.45;
  const bottom = L.chin + span * (area === 'face' ? 0.04 : 0.02);
  const wide = area === 'nose' ? 0.78 : area === 'eyes' ? 0.9 : 1.02;
  const cx = (L.left + L.right) / 2, half = (L.right - L.left) / 2 * wide, left = cx - half, right = cx + half;
  const mx = (left + right) / 2, my = (top + bottom) / 2, t = L.rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: L.nx + mx * c - my * s, y: L.ny + mx * s + my * c, w: right - left, h: bottom - top, rot: L.rot };
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
