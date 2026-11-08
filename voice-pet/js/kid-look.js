// 声の子の見た目（毛の色・もよう・耳）。声の数（こえのこ features.js の n）→ 見た目の遺伝子 → フェルトの毛の色と顔
// 対応はこえのこ（js/genes.js）と同じ: 声の高さ→毛の明るさ、声の明るさ→色あい、声のゆらぎ→もよう、抑揚→耳の長さ、子音のとがり→耳の先、息まじり→毛の長さ（体の遺伝子 fluff）
// よその生き物なので色は里山の動物にない色あいもとる。フェルトになじむよう、あざやかさはひかえめ
// もようは左右対称（体の中の左右の位置の絶対値で決める＝GAME.md 9.7）
const cl = v => Math.max(0, Math.min(1, v)), lerp = (a, b, t) => a + (b - a) * t;
export function lookGenes(n, R = Math.random) {
  const j = () => (R() - 0.5) * 0.08;
  return { hue: cl(n.bright + j()), light: cl(n.pitch + j()), spots: cl(n.rough * 1.2 + j()), ear: cl(n.melody + j()), sharp: cl(n.sharp + j()), seed: Math.floor(R() * 1e6) };
}
// 色あい: 暗い声＝藍・すみれ → 明るい声＝珊瑚・杏・菜の花（こえのこの HUES）
const HUES = [[232, 0.42], [268, 0.38], [318, 0.42], [8, 0.55], [28, 0.62], [46, 0.66]];
function hsl(h, s, l) { const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
export function lookColor(L) {
  const u = cl(L.hue) * (HUES.length - 1), i = Math.min(HUES.length - 2, Math.floor(u)), f = u - i;
  let h0 = HUES[i][0], h1 = HUES[i + 1][0]; if (h1 - h0 > 180) h0 += 360; if (h0 - h1 > 180) h1 += 360;
  const h = (lerp(h0, h1, f) + 360) % 360, s = lerp(HUES[i][1], HUES[i + 1][1], f) * 0.55, l = lerp(0.38, 0.66, L.light);
  return { base: hsl(h, s, l), dark: hsl(h, s * 0.8, l * 0.55), pale: hsl(h, s * 0.5, Math.min(0.88, l + 0.22)) };
}
// 毛の色（皮の点ごと）: 背は地の色、腹は淡く、もようは濃い丸（左右対称）
export function lookFur(L, H) {
  const C = lookColor(L), mid = H.parts.pelvis.c[2];
  const noise = (x, y, z) => Math.sin(x * 37 + L.seed) * Math.sin(y * 41 + L.seed * 0.7) * Math.sin(z * 43 + 1.3) + 0.5 * Math.sin(x * 71 - y * 53 + L.seed * 0.3);
  return (part, p, n) => {
    let c = C.base.slice();
    const belly = cl((-n[1] - 0.15) * 1.6); c = c.map((v, i) => v + (C.pale[i] - v) * belly);
    const sp = noise(p[0], p[1], Math.abs(p[2] - mid)); // 左右の絶対値で＝左右対称
    if (L.spots > 0.25 && n[1] > -0.2 && sp > 1.1 - L.spots * 0.9) c = c.map((v, i) => v + (C.dark[i] - v) * 0.75);
    if (/ft[LR]$/.test(part)) c = c.map((v, i) => v + (C.dark[i] - v) * 0.5); // 足先は濃く
    return c;
  };
}
// 顔: 目は毛の表に、耳は抑揚で長く（0.8〜3cm×2）、とがりで先が細く濃い
export function lookFace(L, K, base) {
  const hs = (K.headR + (K.fur ?? 0.006 + 0.008 * K.fluff)) * 0.95, C = lookColor(L), len = lerp(0.012, 0.032, L.ear), wid = lerp(0.016, 0.011, L.sharp) * lerp(1, 0.8, L.ear);
  return { ...base, eye: [hs * 0.47, hs * 0.3, hs * 0.83], eyeR: K.headR * 0.17, iris: 0x2a1a10, ring: null,
    ear: { at: [-hs * 0.2, hs * 0.8, hs * 0.5], size: [wid, len, 0.005], out: 0.35, back: lerp(0.15, 0.45, L.ear), tipAt: L.sharp > 0.5 ? 0.55 : 9, tip: C.dark, inner: C.pale, outer: C.base } };
}
// 仮の名前（生まれたときに自動で。遊ぶ人が書きかえられる）: やわらかい音の2音（＋ん）。声の明るさで前の音、もようの置き方で後ろの音
// 音は選んだ字だけからつくる（よくない言葉にならないよう、字の組み合わせをしぼる）
const SY = ['モ', 'ポ', 'ム', 'ノ', 'コ', 'ピ', 'ル', 'フ', 'ミ', 'ヌ', 'ペ', 'ト', 'ク', 'ナ'];
export function kidName(L) {
  const a = SY[Math.floor(cl(L.hue) * 0.999 * SY.length)], s = L.seed >>> 0, b = SY[s % SY.length], k = (s >> 4) % 3;
  return k === 0 ? a + a : k === 1 ? a + b : a + b + 'ン';
}
