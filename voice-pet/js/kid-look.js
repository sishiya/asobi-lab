// 声の子の見た目（毛の色・もよう・耳）。声の数（こえのこ features.js の n）→ 見た目の遺伝子 → フェルトの毛の色と顔
// 対応はこえのこ（js/genes.js）と同じ: 声の高さ→毛の明るさ、声の明るさ→色あい、声のゆらぎ→もよう、抑揚→耳の長さ、子音のとがり→耳の先、息まじり→毛の長さ（体の遺伝子 fluff）
// よその生き物なので色は里山の動物にない色あいもとる。フェルトになじむよう、あざやかさはひかえめ
// もようは左右対称（体の中の左右の位置の絶対値で決める＝GAME.md 9.7）
const cl = v => Math.max(0, Math.min(1, v)), lerp = (a, b, t) => a + (b - a) * t;
export function lookGenes(n, R = Math.random) {
  const j = () => (R() - 0.5) * 0.08;
  return { hue: cl(n.bright + j()), light: cl(n.pitch + j()), spots: cl(n.rough * 1.2 + j()), ear: cl(n.melody + j()), sharp: cl(n.sharp + j()), seed: Math.floor(R() * 1e6), ...(n.pitch < 0.22 && n.bright < 0.25 ? { tone: 'ink' } : n.pitch > 0.8 && n.rough < 0.3 ? { tone: 'white' } : {}) }; // tone＝低く暗い声は淡い墨色の毛、高く澄んだ声は白い毛
}
// 色あい: 暗い声＝藍・すみれ → 明るい声＝珊瑚・杏・菜の花（こえのこの HUES）
const HUES = [[232, 0.42], [268, 0.38], [318, 0.42], [8, 0.55], [28, 0.62], [46, 0.66]];
function hsl(h, s, l) { const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
export function lookColor(L) {
  if (L.tone === 'ink') return { base: [0.22, 0.24, 0.32], dark: [0.12, 0.13, 0.19], pale: [0.4, 0.42, 0.5] };
  if (L.tone === 'white') return { base: [0.93, 0.91, 0.86], dark: [0.72, 0.69, 0.63], pale: [0.98, 0.97, 0.94] };
  const u = cl(L.hue) * (HUES.length - 1), i = Math.min(HUES.length - 2, Math.floor(u)), f = u - i;
  let h0 = HUES[i][0], h1 = HUES[i + 1][0]; if (h1 - h0 > 180) h0 += 360; if (h0 - h1 > 180) h1 += 360;
  const h = (lerp(h0, h1, f) + 360) % 360, s = lerp(HUES[i][1], HUES[i + 1][1], f) * 0.55, l = lerp(0.38, 0.66, L.light);
  return { base: hsl(h, s, l), dark: hsl(h, s * 0.8, l * 0.55), pale: hsl(h, s * 0.5, Math.min(0.88, l + 0.22)) };
}
// かけた声ごとの色から、主役の色と差し色（ユーザー「差し色案」）: いちばん長くかけた声が主役、はっきりちがう色の声を2つまで差し色に。ls は長い順の lookGenes
export function voiceTints(ls) {
  const key = l => ({ hue: l.hue, light: l.light, ...(l.tone ? { tone: l.tone } : {}) }), far = (a, b) => Math.hypot(...lookColor(a).base.map((v, i) => v - lookColor(b).base[i])) > 0.2, acc = [];
  for (const l of ls.slice(1)) if (acc.length < 2 && far(l, ls[0]) && acc.every(a => far(l, a))) acc.push(key(l));
  return { tone: undefined, ...key(ls[0]), acc };
}
// 毛の色（皮の点ごと）: 背は地の色、腹は淡く、もようは濃い丸（左右対称）。差し色は おしりの側と胸の帯に、うねった境で
export function lookFur(L, H) {
  const C0 = lookColor(L), A = (L.acc ?? []).map(lookColor), mid = H.parts.pelvis.c[2], X = Object.values(H.parts).map(p => p.c[0]), x0 = Math.min(...X), xL = Math.max(...X) - x0 || 1;
  const noise = (x, y, z) => Math.sin(x * 37 + L.seed) * Math.sin(y * 41 + L.seed * 0.7) * Math.sin(z * 43 + 1.3) + 0.5 * Math.sin(x * 71 - y * 53 + L.seed * 0.3);
  const tint = p => { if (!A.length) return C0; const u = (p[0] - x0) / xL + 0.05 * Math.sin(Math.abs(p[2] - mid) * 60 + L.seed) + 0.04 * Math.sin(p[1] * 50 + L.seed * 0.4); return u < 0.2 ? A[0] : A[1] && u > 0.56 && u < 0.72 ? A[1] : C0; };
  return (part, p, n) => {
    const C = tint(p);
    let c = C.base.slice();
    const belly = cl((-n[1] - 0.15) * 1.6); c = c.map((v, i) => v + (C.pale[i] - v) * belly);
    const sp = noise(p[0], p[1], Math.abs(p[2] - mid)); // 左右の絶対値で＝左右対称
    if (L.spots > 0.25 && n[1] > -0.2 && sp > 1.1 - L.spots * 0.9) c = c.map((v, i) => v + (C.dark[i] - v) * 0.75);
    if (H.plan.type === 'bird' && Math.abs(p[2] - mid) > H.parts.chest.r * 0.98 + (H.plan.fur ?? 0.006 + 0.008 * H.plan.fluff) * 0.5) c = c.map((v, i) => v + (C.dark[i] - v) * 0.45); // 翼は濃く
    if (/ft[LR]$/.test(part)) c = c.map((v, i) => v + (C.dark[i] - v) * 0.5); // 足先は濃く
    return c;
  };
}
// 顔: 目は毛の表に、耳は抑揚で長く（0.8〜3cm×2）、とがりで先が細く濃い
export function lookFace(L, K, base) {
  const hs = (K.headR + (K.fur ?? 0.006 + 0.008 * K.fluff)) * 0.95, C = lookColor(L), hop = K.type === 'hop', bear = K.type === 'donkey', /* 型の名前 donkey は学習の記録に合わせて残す。見た目と呼び名はクマ */ len = hop ? hs * lerp(0.72, 1, L.ear) * (2 / 3) : lerp(0.012, 0.032, L.ear), wid = lerp(0.016, 0.011, L.sharp) * lerp(1, 0.8, L.ear) * (hop ? 1.65 : 1); // ウサギの耳は頭より少し短いくらい（len は半分の長さ）
  return { ...base, eye: [hs * 0.47, hs * 0.3, hs * 0.83], eyeR: K.headR * 0.17, iris: 0x2a1a10, ring: null, button: true, beak: K.type === 'bird' ? { at: [hs * 1.13, -hs * 0.12], size: [hs * 0.23, hs * 0.2, hs * 0.48], duck: true, col: [0.88, 0.68, 0.4] } : null,
    ear: { at: bear ? [-hs * 0.12, hs * 0.62, hs * 0.6] : [-hs * 0.2, hs * 0.8, hs * 0.5], size: bear ? [hs * 0.26, hs * 0.36, hs * 0.36] /* クマの耳はまんまるで前向き（頭に少しうずめる） */ : K.type === 'snake' || K.type === 'bird' ? [0.001, 0.001, 0.001] : K.type === 'seal' ? [0.006, 0.004, 0.004] /* アザラシの耳は小さな穴だけ */ : [wid, len, hop ? 0.009 : 0.005], out: bear ? 0.5 : 0.35, back: bear ? 0.1 : K.type === 'hop' ? lerp(0.5, 0.75, L.ear) /* ウサギの耳はぴんと立てず、少し後ろへ倒す（テストプレイ） */ : lerp(0.15, 0.45, L.ear), tipAt: !bear && L.sharp > 0.5 ? 0.55 : 9, tip: C.dark, inner: bear ? C.base : C.pale, outer: C.base, long: hop } };
}
// 仮の名前（生まれたときに自動で。遊ぶ人が書きかえられる）: やわらかい音の2音（＋ん）。声の明るさで前の音、もようの置き方で後ろの音
// 音は選んだ字だけからつくる（よくない言葉にならないよう、字の組み合わせをしぼる）
const SY = ['モ', 'ポ', 'ム', 'ノ', 'コ', 'ピ', 'ル', 'フ', 'ミ', 'ヌ', 'ペ', 'ト', 'ク', 'ナ'];
export function kidName(L) {
  const a = SY[Math.floor(cl(L.hue) * 0.999 * SY.length)], s = L.seed >>> 0, b = SY[s % SY.length], k = (s >> 4) % 3;
  return k === 0 ? a + a : k === 1 ? a + b : a + b + 'ン';
}
