// 声の特徴 → 遺伝子（2本ずつ）→ 形（純粋）
// 遺伝子は 0..1 の数を2本（2倍体）。形は2本の平均（足し算の遺伝）。かけ合わせは段階B
export const GENES = [
  // key, 名前, 声のどこから, 手本か見立てか
  { key: 'size',   name: '体の大きさ', from: '声の筒の長さ（育つと鼻と首に出る）', src: 'size', real: true },
  { key: 'light',  name: '毛色の淡さ', from: '声の高さ',         src: 'pitch',  real: true },
  { key: 'warm',   name: '色あい',     from: '声の明るさ',       src: 'bright', real: true, hidden: true }, // 鉛筆では見えない（色をつけるときのために持つ）
  { key: 'spiky',  name: 'とがり',     from: '立ち上がりと子音', src: 'sharp',  real: true },
  { key: 'wide',   name: '横はば',     from: '母音の口のあけ方', src: 'open' },
  { key: 'fluff',  name: '毛',         from: '息まじり',         src: 'breath' },
  { key: 'spots',  name: 'もよう',     from: '声のゆらぎ',       src: 'rough' },
  { key: 'crest',  name: '耳とかざり', from: '抑揚',             src: 'melody' },
  { key: 'legs',   name: '足と速さ',   from: '話す速さ',         src: 'tempo' },
];

// 体の型: その声で鳴く本物の動物の型（声の特徴の重みの和がいちばん大きい型）
export const FORMS = [
  { name: 'すわる小獣', why: '高く速い声', real: 'ネズミのなかまは小さなのどで、高く速くキーキー鳴く', w: n => n.pitch * 0.3 + n.tempo * 0.55 + n.sharp * 0.2 },
  { name: 'シカ型', why: '息まじりの低い声', real: 'シカは長い声の筒で、息のまじった低い声をのばす', w: n => n.breath * 0.5 + (1 - n.pitch) * 0.3 + (1 - n.tempo) * 0.2 },
  { name: 'カエル型', why: '節のない低めの声', real: 'カエルは同じ高さの声をくり返す（節まわしがない）', w: n => (1 - n.melody) * 0.45 + n.rough * 0.25 + (1 - n.pitch) * 0.3 },
  { name: 'ツル型', why: '抑揚の大きな声', real: '鳥は節まわしのある声でうたう', w: n => n.melody * 0.6 + n.pitch * 0.2 + (1 - n.breath) * 0.2 },
];

function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const clamp01 = v => Math.max(0, Math.min(1, v));

// a: features.analyze の結果。seed で突然変異（同じ声でも少しずつちがう子に）
export function makeGenome(a, seed = Date.now()) {
  const R = rng(seed);
  const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += R(); return (s - 2) * 0.866; };
  const genes = {};
  for (const g of GENES) {
    const v = a.n[g.src];
    genes[g.key] = [clamp01(v + gauss() * 0.035), clamp01(v + gauss() * 0.035)];
  }
  // 体の型の重み（2本。かけ合わせでまざる）
  const fw = FORMS.map(f => f.w(a.n));
  genes.form = [fw.map(v => clamp01(v + gauss() * 0.02)), fw.map(v => clamp01(v + gauss() * 0.02))];
  // 体の形のもとの数（毛先・もようの配置）
  genes.seed = Math.floor(R() * 1e9);
  return {
    v: 1, genes,
    // 鳴き声のもと（数だけ。声そのものは残さない）
    voice: { f0: a.raw.f0, vtl: a.raw.vtl, breath: a.n.breath, rough: a.n.rough, front: a.n.front, rate: a.raw.rate, contour: a.contour },
    born: Date.now(),
  };
}

const mean = p => (p[0] + p[1]) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// 色: 声の明るさで色あい（暗い声＝藍・すみれ → 明るい声＝珊瑚・杏・菜の花）、高さで明るさ
const HUES = [[232, 0.42], [268, 0.38], [318, 0.42], [8, 0.55], [28, 0.62], [46, 0.66]];
function hueAt(t) {
  const u = clamp01(t) * (HUES.length - 1), i = Math.min(HUES.length - 2, Math.floor(u)), f = u - i;
  let h0 = HUES[i][0], h1 = HUES[i + 1][0];
  if (h1 - h0 > 180) h0 += 360; if (h0 - h1 > 180) h1 += 360;
  return [(lerp(h0, h1, f) + 360) % 360, lerp(HUES[i][1], HUES[i + 1][1], f)];
}

export function express(gm) {
  const g = gm.genes;
  const size = mean(g.size), light = mean(g.light), warm = mean(g.warm);
  const [hue, sat] = hueAt(warm);
  let form = 0;
  if (g.form) { const m = g.form[0].map((v, i) => (v + g.form[1][i]) / 2); form = m.indexOf(Math.max(...m)); }
  return {
    form,
    size,
    radius: lerp(50, 108, size),           // 体の半径（画面の px、基準の大きさで）
    eye: lerp(0.34, 0.2, size),            // 目の大きさ／体（ハラーの法則: 小さいほど目が大きい）
    hue, sat,
    lum: lerp(0.36, 0.74, light),
    spiky: mean(g.spiky),
    aspect: lerp(0.86, 1.3, mean(g.wide)), // 横はば／高さ
    fluff: mean(g.fluff),
    spots: mean(g.spots),
    crest: mean(g.crest),
    legs: mean(g.legs),
    seed: g.seed,
  };
}

// 遺伝子の表に出す、声のもとの値の文字
export function sourceText(gm, key) {
  const v = gm.voice;
  if (key === 'size') return `筒 ${v.vtl.toFixed(1)} cm`;
  if (key === 'light') return `${Math.round(v.f0)} Hz`;
  return '';
}
