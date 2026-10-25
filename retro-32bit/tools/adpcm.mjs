// 16 ビットの波 → SPU の ADPCM（16 バイトで 28 こ）。かたまりごとに 5 つの予測 × 13 のずらしを全部ためして、いちばんずれの小さいものを選ぶ。
//   encode(pcm, { loop, loopStart }) → Uint8Array
//     loop: くり返すなら true（最後のかたまりに「終わり＋くり返す」、loopStart のかたまりに「くり返しのはじめ」）
//     くり返さないときは、最後に「終わり」だけの無音のかたまりを足す（そこで声が止まる）
const FILT = [[0, 0], [60, 0], [115, -52], [98, -55], [122, -60]];
const clamp16 = (v) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

function tryBlock(src, f, shift, old, older) {
  const [f0, f1] = FILT[f];
  const nib = new Uint8Array(28);
  let err = 0;
  for (let k = 0; k < 28; k++) {
    const pred = (old * f0 + older * f1 + 32) >> 6;
    let n = Math.round(((src[k] - pred) << shift) / 4096);
    if (n > 7) n = 7; else if (n < -8) n = -8;
    const s = clamp16((((n & 15) << 28) >> 16 >> shift) + pred);
    const d = s - src[k]; err += d * d;
    nib[k] = n & 15; older = old; old = s;
  }
  return { err, nib, old, older };
}

export function encode(pcm, { loop = false, loopStart = 0 } = {}) {
  const nblk = Math.ceil(pcm.length / 28);
  const out = new Uint8Array((nblk + (loop ? 0 : 1)) * 16);
  let old = 0, older = 0;
  for (let b = 0; b < nblk; b++) {
    const src = new Int16Array(28);
    for (let k = 0; k < 28; k++) src[k] = pcm[b * 28 + k] ?? (loop ? pcm[(b * 28 + k) % pcm.length] : 0);
    let best = null;
    for (let f = 0; f < 5; f++) for (let sh = 0; sh <= 12; sh++) {
      const r = tryBlock(src, f, sh, old, older);
      if (!best || r.err < best.err) best = { ...r, f, sh };
    }
    const o = b * 16;
    out[o] = best.sh | (best.f << 4);
    let flags = 0;
    if (loop && b === Math.floor(loopStart / 28)) flags |= 4;
    if (loop && b === nblk - 1) flags |= 3;
    out[o + 1] = flags;
    for (let k = 0; k < 14; k++) out[o + 2 + k] = best.nib[k * 2] | (best.nib[k * 2 + 1] << 4);
    old = best.old; older = best.older;
  }
  if (!loop) { const o = nblk * 16; out[o + 1] = 1; } // 終わり（くり返さない＝止まる）
  return out;
}
