// 筆のタッチ: 穴のまわりだけを、その絵のスタイルに変換する（Magenta の任意スタイル変換。TensorFlow.js、端末の中だけで動く）。
// スタイルの特徴（js/styles.js）は事前に計算しておき、ここで使うのは変換のほう（vendor/style-transfer/、2.4MB）だけ。
// 「筆のタッチ」をなしにしたままなら、TensorFlow.js もモデルも読みこまない。
// 入力はいつも正方形の LIVE（遊んでいるあいだ）か PHOTO（写真）。大きさが変わるたびに GPU の下ごしらえ（1〜2秒）が走るのをさけるため
import { STYLES } from './styles.js?v=8';

export const LIVE = 224, PHOTO = 448;
const BASE = new URL('../vendor/', import.meta.url).href;
let ready = null, net = null;

function loadScript(src) {
  return new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ng; document.head.append(s); });
}

// 使えるようにする（2回目からは同じ約束を返す）。結果は { live } か null。
// GPU がない（WebGL が使えない）と1コマ数秒かかるので使わない。GPU が遅ければ写真だけにかける（live: false）
export function loadStyler() {
  ready = ready || (async () => {
    try {
      if (!window.tf) await loadScript(BASE + 'tfjs/tf.min.js');
      if (!(await tf.setBackend('webgl'))) return null;
      await tf.ready();
      net = await tf.loadGraphModel(BASE + 'style-transfer/model.json');
      const c = Object.assign(document.createElement('canvas'), { width: 8, height: 8 }), out = document.createElement('canvas');
      await run(c, [0, 0, 8, 8], 'gogh', PHOTO, out); // 下ごしらえ（写真の大きさ）
      await run(c, [0, 0, 8, 8], 'gogh', LIVE, out);
      let t = performance.now(); await run(c, [0, 0, 8, 8], 'gogh', PHOTO, out);
      if (performance.now() - t > 800) return null; // 写真1枚に時間がかかりすぎる端末では使わない（けっかが待たされる）
      t = performance.now(); await run(c, [0, 0, 8, 8], 'gogh', LIVE, out);
      return { live: performance.now() - t < 120 };
    } catch (e) { console.warn('style transfer unavailable', e); return null; }
  })();
  return ready;
}

// src の (x, y, w, h) をふくむ正方形を size×size に縮めて変換し、out（canvas、正方形）に描く。絵 id のスタイルで。
// 返すのは out が src のどこに当たるか [x, y, 辺]（描くときに使う）
async function run(src, [x, y, w, h], id, size, out) {
  const side = Math.max(w, h), sx = x + w / 2 - side / 2, sy = y + h / 2 - side / 2;
  const tmp = run.tmp || (run.tmp = document.createElement('canvas'));
  tmp.width = tmp.height = size;
  const tg = tmp.getContext('2d'); tg.clearRect(0, 0, size, size);
  tg.drawImage(src, sx, sy, side, side, 0, 0, size, size);
  const img = tf.tidy(() => {
    const content = tf.browser.fromPixels(tmp).toFloat().div(255).expandDims();
    const style = tf.tensor(STYLES[id], [1, 1, 1, 100]);
    const y = net.execute({ Placeholder: content, Placeholder_1: style }).squeeze(); // 入力は 画像・スタイルの特徴
    // 明るさと色の散らばりを、もとの顔にもどす（筆づかいの模様だけをもらう。暗い絵で顔が黒ずまないように）
    // 測るのは正方形のまん中（顔のあたり）だけ。まわりの暗い所で平均がずれないように
    const q = Math.round(size / 4), mid = t => t.slice([q, q, 0], [size - 2 * q, size - 2 * q, 3]);
    const x = content.squeeze(), cx = mid(x), cy = mid(y), mx = cx.mean([0, 1]), my = cy.mean([0, 1]);
    const sx = cx.sub(mx).square().mean([0, 1]).sqrt(), sy = cy.sub(my).square().mean([0, 1]).sqrt().add(1e-3);
    return y.sub(my).div(sy).mul(sx).add(mx).clipByValue(0, 1);
  });
  out.width = img.shape[1]; out.height = img.shape[0];
  await tf.browser.toPixels(img, out);
  img.dispose();
  return [sx, sy, side];
}

export async function stylize(src, rect, id, size, out) {
  if (!net || !STYLES[id]) return null;
  return run(src, rect, id, size, out);
}
