// 絵ごとの専用モデル（速いスタイル変換）。tools/train_style.py で学習した重み（vendor/style-models/<絵>.bin・.json、float16）を読み、
// 同じ形のネットワークを TensorFlow.js で組む（train_style.py の Transformer と同じ。変えたら両方を直す）。
const BASE = new URL('../vendor/style-models/', import.meta.url).href;

// float16 → float32
function half(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    out[i] = e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
  }
  return out;
}

// id の重みを読んで、x（[1, h, w, 3]、0〜1）→ y（同じ大きさ、0〜1）の関数を返す。ないときは null
export async function loadFast(id) {
  try {
    const [meta, bin] = await Promise.all([
      fetch(BASE + id + '.json').then(r => (r.ok ? r.json() : null)),
      fetch(BASE + id + '.bin').then(r => (r.ok ? r.arrayBuffer() : null))]);
    if (!meta || !bin) return null;
    const u16 = new Uint16Array(bin), W = {};
    let o = 0;
    for (const t of meta.tensors) {
      const n = t.shape.reduce((a, b) => a * b, 1);
      W[t.name] = tf.tensor(half(u16.subarray(o, o + n)), t.shape);
      o += n;
    }
    const conv = (x, p, k, stride = 1, up = false, norm = true, relu = true) => {
      if (up) x = tf.image.resizeNearestNeighbor(x, [x.shape[1] * 2, x.shape[2] * 2]);
      const pad = k >> 1;
      x = tf.mirrorPad(x, [[0, 0], [pad, pad], [pad, pad], [0, 0]], 'reflect');
      x = tf.conv2d(x, W[p + '.conv.weight'], stride, 'valid').add(W[p + '.conv.bias']);
      if (norm) {
        const { mean, variance } = tf.moments(x, [1, 2], true);
        x = x.sub(mean).div(variance.add(1e-5).sqrt()).mul(W[p + '.norm.weight']).add(W[p + '.norm.bias']);
      }
      return relu ? tf.relu(x) : x;
    };
    return x => {
      let y = conv(x, 'layers.0', 9);
      y = conv(y, 'layers.1', 3, 2);
      y = conv(y, 'layers.2', 3, 2);
      for (let i = 3; i <= 7; i++) y = y.add(conv(conv(y, `layers.${i}.a`, 3), `layers.${i}.b`, 3, 1, false, true, false));
      y = conv(y, 'layers.8', 3, 1, true);
      y = conv(y, 'layers.9', 3, 1, true);
      y = conv(y, 'layers.10', 9, 1, false, false, false);
      return tf.sigmoid(y);
    };
  } catch (e) { console.warn('fast style model unavailable', id, e); return null; }
}
