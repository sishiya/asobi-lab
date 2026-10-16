// 面のデータと、置ける3Dの形。どの面も 横36マス・高さ14マス・0〜60秒（ページ61枚）

// 3Dの形。w=横（マス）、h=高さ（マス）、d=奥行き（秒）、slope=手前へ1秒進むごとに上がるマス
// desc は3Dの形だけを言う（2D世界でどうなるかは、遊ぶ人が自分で見つける）
export const KINDS = {
  beam: { w: 7, h: 1, d: 12, slope: 0, desc: '奥行き12秒ぶんの、長い板' },
  plank: { w: 5, h: 1, d: 10, slope: 0, desc: '奥行き10秒ぶんの板' },
  short: { w: 5, h: 1, d: 4, slope: 0, desc: '奥行きが4秒ぶんしかない、うすい板' },
  lift: { w: 5, h: 1, d: 10, slope: 0.75, desc: '手前（未来）ほど高くなる、ななめの板' },
  wall: { w: 1, h: 3, d: 6, slope: 0, desc: '高さ3マス・奥行き6秒ぶんの柱' },
};

// 地形の列の高さを、[はじめの列, 終わりの列, 高さ] の並びから作る（書いていない列は 4。null は底なし）
function tops(spans) {
  const a = new Array(36).fill(4);
  for (const [c0, c1, h] of spans) for (let c = c0; c <= c1; c++) a[c] = h === null ? -Infinity : h;
  return a;
}

const base = { W: 36, H: 14, T: 60 };

// hints: 面の中で順に出すひとことの導き。when(ctx) が true になったら次へ。fail は結末がだめなときのひとこと
export const LEVELS = [
  {
    ...base, id: 't1', plate: 'I', name: '時をめくる', tutorial: true,
    tops: tops([[10, 12, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { plank: 1 },
    hints: [
      { text: 'W で前へ。前へ歩くと、未来のページへ進む', when: (c) => c.walked > 4 },
      { text: 'キーウィは、このあとどうなる？　見に行こう', when: (c) => c.seenEnd },
      { text: '標本台の板を E でつかみ、運んで、E で置いてみよう', when: (c) => c.placed },
    ],
    fail: 'まだ落ちてしまう。板のある時間と、キーウィが通る時間は重なっている？',
  },
  {
    ...base, id: 't2', plate: 'II', name: 'つかのまの橋', tutorial: true,
    tops: tops([[14, 16, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { short: 1 },
    hints: [
      { text: 'こんどの板は、奥行きがうすい', when: (c) => c.placed },
    ],
    fail: '置く時間を、少しずつずらしてみよう（E で持ち上げて、置きなおせる）',
  },
  {
    ...base, id: 't3', plate: 'III', name: 'のぼる板', tutorial: true,
    tops: tops([[14, 18, 3], [19, 35, 7]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { lift: 1 },
    hints: [
      { text: 'この段は、キーウィには高すぎる（あなたは跳んで、よじ登れる）', when: (c) => c.placed },
    ],
    fail: '板の上で、キーウィはどうなった？',
  },
  {
    ...base, id: 't4', plate: 'IV', name: 'ひきかえせ', tutorial: true,
    tops: tops([[20, 23, null]]), start: { x: 12, dir: 1 }, goal: { x: 2.6 },
    stock: { wall: 1 },
    hints: [
      { text: '巣は左にある。でも、キーウィは右へ歩いていく', when: (c) => c.placed },
    ],
    fail: '柱にぶつかったら、キーウィはどうする？',
  },
  {
    ...base, id: 's1', plate: 'V', name: '崖と段',
    tops: tops([[12, 16, null], [19, 23, 3], [24, 35, 7]]), start: { x: 1.6, dir: 1 }, goal: { x: 32.4 },
    stock: { beam: 1, lift: 1, wall: 1 },
    hints: [], fail: '',
  },
  {
    ...base, id: 's2', plate: 'VI', name: '高い巣',
    tops: tops([[0, 6, 7], [7, 11, 3], [25, 29, null]]), start: { x: 16, dir: 1 }, goal: { x: 3 },
    stock: { wall: 1, lift: 1 },
    hints: [], fail: '',
  },
];

export const LEVEL = LEVELS[0];
