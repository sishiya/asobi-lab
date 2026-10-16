// 面のデータと、置ける3Dの形。どの面も 横36マス・高さ14マス・0〜60秒（ページ61枚）

// 3Dの形。w=横（マス）、h=高さ（マス）、d=奥行き（秒）、slope=手前へ1秒進むごとに上がるマス
// desc は3Dの形だけを言う（2D世界でどうなるかは、遊ぶ人が自分で見つける）
// 言語（index.html の TX(日本語, 英語)。ノードでの試験のときは日本語）
const TX = globalThis.TX || ((ja) => ja);
export const KINDS = {
  beam: { w: 7, h: 1, d: 12, slope: 0, desc: '奥行き12秒ぶんの、長い板' },
  plank: { w: 5, h: 1, d: 10, slope: 0, desc: '奥行き10秒ぶんの板' },
  short: { w: 5, h: 1, d: 4, slope: 0, desc: '奥行きが4秒ぶんしかない、うすい板' },
  lift: { w: 5, h: 1, d: 10, slope: 0.75, desc: '手前（未来）ほど高くなる、ななめの板' },
  wall: { w: 1, h: 3, d: 6, slope: 0, desc: '高さ3マス・奥行き6秒ぶんの柱' },
  // 平行四辺形の板: 奥へ1秒進むごとに横へ shear マスずれた板。2D世界では横にすべる足場（ずれ＝速さ）。Q で向きが反対に
  slide: { w: 4, h: 1, d: 6, slope: 0, shear: 1.5, desc: '横にずれた、平行四辺形の板' },
  // ひし形の板: 上から見るとひし形。2D世界では、まん中から広がって、また縮む足場（いちばん広いのは、まん中の秒だけ）
  diamond: { w: 8, h: 1, d: 8, slope: 0, dia: true, desc: '上から見ると、ひし形の板' },
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
    ...base, id: 't1', plate: 'I', name: TX('時をめくる', 'Turning Time'), tutorial: true,
    tops: tops([[10, 12, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { plank: 1 },
    hints: [
      { text: TX('W で前へ。前へ歩くと、未来のページへ進む', 'Press W to go forward. Walking forward takes you to future pages'), when: (c) => c.walked > 4 },
      { text: TX('キーウィは、このあとどうなる？　見に行こう', 'What happens to the kiwi after this? Go and see'), when: (c) => c.seenEnd },
      { text: TX('左のパレットで板をえらび、置きたい所をクリックしよう', 'Pick the board from the palette on the left, then click where you want it'), when: (c) => c.placed },
    ],
    fail: TX('まだ落ちてしまう。板のある時間と、キーウィが通る時間は重なっている？', 'It still falls. Does the time of the board overlap the time the kiwi passes?'),
  },
  {
    ...base, id: 't2', plate: 'II', name: TX('つかのまの橋', 'A Fleeting Bridge'), tutorial: true,
    tops: tops([[14, 16, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { short: 1 },
    hints: [
      { text: TX('こんどの板は、奥行きがうすい', 'This board is thin in depth'), when: (c) => c.placed },
    ],
    fail: TX('置く時間を、少しずつずらしてみよう（置いた板をクリックすると、持ち上げて置きなおせる）', 'Try shifting the time a little (click the placed board to pick it up and place it again)'),
  },
  {
    ...base, id: 't3', plate: 'III', name: TX('のぼる板', 'The Rising Board'), tutorial: true,
    tops: tops([[14, 18, 3], [19, 35, 7]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { lift: 1 },
    hints: [
      { text: TX('この段は、キーウィには高すぎる（あなたは浮かんでこえられる）', 'This step is too high for the kiwi (you can float over it)'), when: (c) => c.placed },
    ],
    fail: TX('板の上で、キーウィはどうなった？', 'What happened to the kiwi on the board?'),
  },
  {
    ...base, id: 't4', plate: 'IV', name: TX('ひきかえせ', 'Turn Back'), tutorial: true,
    tops: tops([[20, 23, null]]), start: { x: 12, dir: 1 }, goal: { x: 2.6 },
    stock: { wall: 1 },
    hints: [
      { text: TX('巣は左にある。でも、キーウィは右へ歩いていく', 'The nest is on the left. But the kiwi walks to the right'), when: (c) => c.placed },
    ],
    fail: TX('柱にぶつかったら、キーウィはどうする？', 'What does the kiwi do when it bumps into a pillar?'),
  },
  {
    // 回すと意味がかわる: 長い板は、そのままでは崖に届かない。Q で回すと横に長く（そのかわり短い時間だけ）
    ...base, id: 't5', plate: 'V', name: TX('まわす板', 'The Turned Board'), tutorial: true,
    tops: tops([[10, 16, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { beam: 1 },
    hints: [
      { text: TX('この崖は、板の長さでは届かない', 'This chasm is wider than the board is long'), when: (c) => c.rotated },
    ],
    fail: TX('回した板は、横に長いぶん、ある時間は短い', 'A turned board is longer sideways, so it lasts a shorter time'),
  },
  {
    // 平行四辺形の板（すべる足場）: 9マスの崖は、どの板でも届かない。のせて運べば、わたれる
    ...base, id: 't6', plate: 'VI', name: TX('はこぶ板', 'The Carrying Board'), tutorial: true,
    tops: tops([[10, 18, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { slide: 1 },
    hints: [
      { text: TX('こんどの板は、横にずれている', 'This board is shifted sideways'), when: (c) => c.placed },
    ],
    fail: TX('すべる板にのったキーウィは、どう動く？', 'How does the kiwi move on a sliding board?'),
  },
  {
    ...base, id: 's1', plate: 'VII', name: TX('崖と段', 'Cliff and Step'),
    tops: tops([[12, 16, null], [19, 23, 3], [24, 35, 7]]), start: { x: 1.6, dir: 1 }, goal: { x: 32.4 },
    // 時刻の窓: 卵が光っているあいだ（28〜34秒）に着いたときだけ巣に入る。ななめ板だけでは早すぎて、柱で時刻をずらすしかない
    window: [28, 34],
    stock: { beam: 1, lift: 1, wall: 1 },
    hints: [{ text: '__windowHint__', when: (c) => c.placed }], fail: '',
  },
  {
    ...base, id: 's2', plate: 'VIII', name: TX('高い巣', 'The High Nest'),
    tops: tops([[0, 6, 7], [7, 11, 3], [25, 29, null]]), start: { x: 16, dir: 1 }, goal: { x: 3 },
    window: [16, 20], // 柱でひきかえさせる「時刻」と、ななめ板の時刻を、両方合わせる
    stock: { wall: 1, lift: 1 },
    hints: [], fail: '',
  },
  {
    // 崖が2つ: 広い崖はすべる板で運び、せまい崖は長い板。運ばれて早く着くキーウィに、長い板の時刻を合わせる
    ...base, id: 's3', plate: 'IX', name: TX('まにあう巣', 'Just in Time'),
    tops: tops([[8, 16, null], [22, 26, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 32 },
    window: [17, 18],
    stock: { beam: 1, slide: 1 },
    hints: [], fail: '',
  },
  {
    // ころがる石: 14秒に右の石がころがりだし、幅1マスの割れ目にはさまって「ふた」になる。それまで住人を待たせる
    ...base, id: 's4', plate: 'X', name: TX('石のふた', 'The Stone Lid'),
    tops: tops([[14, 14, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stones: [{ x: 32.5, t: 14, dir: -1 }],
    stock: { wall: 1 },
    hints: [{ text: TX('石は、どこへころがっていく？', 'Where will the stone roll?'), when: (c) => c.placed }], fail: '',
  },
  {
    // ひし形の板: 断面は、まん中の秒にいちばん広くなり、また縮む。崖をわたる3秒あまりに、広いところを合わせる
    ...base, id: 's5', plate: 'XI', name: TX('ひし形の橋', 'The Diamond Bridge'),
    tops: tops([[12, 16, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stock: { diamond: 1 },
    hints: [{ text: TX('ひし形の板は、どの秒で切っても同じ幅？', 'Is a diamond board the same width at every second?'), when: (c) => c.placed }], fail: '',
  },
];

export const LEVEL = LEVELS[0];
