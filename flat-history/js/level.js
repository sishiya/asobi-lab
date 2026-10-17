// 面のデータと、置ける3Dの形。どの面も 横36マス・高さ14マス・0〜60秒（ページ61枚）

// 3Dの形。w=横（マス）、h=高さ（マス）、d=奥行き（秒）、slope=手前へ1秒進むごとに上がるマス
// desc は3Dの形だけを言う（2D世界でどうなるかは、遊ぶ人が自分で見つける）
// 言語（index.html の TX(日本語, 英語)。ノードでの試験のときは日本語）
const TX = globalThis.TX || ((ja) => ja);
export const KINDS = {
  beam: { w: 8, h: 1, d: 12, slope: 0, desc: '奥行き12秒ぶんの、長い板' },
  plank: { w: 5, h: 1, d: 10, slope: 0, desc: '奥行き10秒ぶんの板' },
  short: { w: 5, h: 1, d: 4, slope: 0, desc: '奥行きが4秒ぶんしかない、うすい板' },
  lift: { w: 5, h: 1, d: 14, slope: 0.5, desc: '手前（未来）ほど高くなる、ななめの板' },
  wall: { w: 1, h: 3, d: 6, slope: 0, desc: '高さ3マス・奥行き6秒ぶんの柱' },
  // 平行四辺形の板: 奥へ1秒進むごとに横へ shear マスずれた板。2D世界では横にすべる足場（ずれ＝速さ）。Q で向きが反対に
  slide: { w: 6, h: 1, d: 8, slope: 0, shear: 1.5, desc: '横にずれた、平行四辺形の板' },
  // ひし形の板: 上から見るとひし形。2D世界では、まん中から広がって、また縮む足場（いちばん広いのは、まん中の秒だけ）
  diamond: { w: 10, h: 1, d: 10, slope: 0, dia: true, desc: '上から見ると、ひし形の板' },
  // v073: 2Dアクションのしかけの「舞台裏」。どれも回せない（noRot）
  // 「へ」の字の板: 奥行きのまん中でいちばん高く、またもとの高さへ。2D世界では、上がって下がる往復リフト
  hump: { w: 5, h: 1, d: 12, slope: 0, hump: 4, desc: 'まん中が山になった、「へ」の字の板' },
  // くし形の板: すき間をあけて並んだ板。2D世界では、出たり消えたりするブロック
  comb: { w: 5, h: 1, d: 14, slope: 0, comb: [[0, 4], [5, 9], [10, 14]], desc: 'すき間をあけて並んだ、くし形の板' },
  // らせん: まん中の軸と、まわりを巻く3すじの玉。2D世界では、ぐるぐる回る棒（v076: 火の棒はキーウィがかわいそうなので、ただの棒に）
  spiral: { w: 6, h: 6, d: 8, slope: 0, spiral: { r: [0.9, 1.75, 2.6], ball: 0.7, turns: 2 }, desc: '軸のまわりを玉が巻く、らせん' },
};

// 種明かし（v073）: 正史ができたら、置いた形ごとに「2Dではこう見えた → 3Dではこんな形だった」を出す
export const REVEALS = {
  plank: [TX('何秒かだけかかる橋', 'a bridge that lasts a few seconds'), TX('奥行きのある、一枚の板', 'a single board with depth')],
  short: [TX('ほんの一瞬だけかかる橋', 'a bridge that lasts a moment'), TX('うすい一枚の板', 'a thin board')],
  beam: [TX('何秒かだけかかる橋', 'a bridge that lasts a few seconds'), TX('奥行きのある、長い板', 'a long board with depth')],
  lift: [TX('せり上がるエレベーター', 'a rising elevator'), TX('ななめに置いた、一枚の板', 'a single slanted board')],
  wall: [TX('何秒かだけ立つ壁', 'a wall that stands for a few seconds'), TX('奥行きのある、一本の柱', 'a single pillar with depth')],
  slide: [TX('横に動く足場', 'a platform that moves sideways'), TX('横にずれた、平行四辺形の板', 'a board skewed into a parallelogram')],
  diamond: [TX('広がって縮む足場', 'a platform that grows and shrinks'), TX('上から見ると、ひし形の板', 'a board shaped like a diamond')],
  hump: [TX('上がって下がる、往復リフト', 'a lift that goes up and comes back down'), TX('「へ」の字に曲がった、一枚の板', 'a single board bent into a hump')],
  comb: [TX('出たり消えたりするブロック', 'blocks that appear and vanish'), TX('すき間をあけて並んだ、くし形の板', 'a comb of boards with gaps between them')],
  spiral: [TX('ぐるぐる回る棒', 'a spinning bar'), TX('軸のまわりを玉が巻く、一本のらせん', 'a single spiral of balls around an axis')],
};

// 地形の列の高さを、[はじめの列, 終わりの列, 高さ] の並びから作る（書いていない列は 4。null は底なし）
function tops(spans) {
  const a = new Array(36).fill(4);
  for (const [c0, c1, h] of spans) for (let c = c0; c <= c1; c++) a[c] = h === null ? -Infinity : h;
  return a;
}

// T: ページの数（秒）。v078 から図版ごとに、巣に着く秒＋10 くらいに（ユーザー「奥（未来）ってほぼ使われない」、v079 で「もうすこし余韻がほしい」で＋5）。tools/span.mjs で測った
const base = { W: 36, H: 14, T: 60 };

// hints: 面の中で順に出すひとことの導き。when(ctx) が true になったら次へ。fail は結末がだめなときのひとこと
// v073: ゆとりのある図版に（1マス・1秒ずれたら失敗、にしない。ユーザー）。tools/tune.mjs・tune2.mjs で、形ごとに何秒ずらしても正史のままかを測って決めた
//   障害は住人が 11〜13 秒ごろにたどり着く遠さに（0 秒より前には置けないので、早すぎると置ける秒がせまくなる）
//   「つかのまの橋」は「時をめくる」とやることが同じなのでやめた。2Dアクションのしかけの図版を3つ足した（PLAN 2-2）
export const LEVELS = [
  {
    ...base, T: 30, id: 't1', plate: 'I', name: TX('時をめくる', 'Turning Time'), tutorial: true,
    tops: tops([[18, 20, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { plank: 1 },
    hints: [
      { text: TX('W で前へ。前へ歩くと、未来のページへ進む', 'Press W to go forward. Walking forward takes you to future pages'), when: (c) => c.walked > 4 },
      { text: TX('キーウィは、このあとどうなる？　見に行こう', 'What happens to the kiwi after this? Go and see'), when: (c) => c.seenEnd },
      { text: TX('下のパレットで板をえらび、置きたい所をクリックしよう', 'Pick the board from the palette at the bottom, then click where you want it'), when: (c) => c.placed },
    ],
    fail: TX('まだ落ちてしまう。板のある時間と、キーウィが通る時間は重なっている？', 'It still falls. Does the time of the board overlap the time the kiwi passes?'),
  },
  {
    ...base, T: 30, id: 't3', plate: 'II', name: TX('のぼる板', 'The Rising Board'), tutorial: true,
    tops: tops([[14, 18, 3], [19, 35, 6]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { lift: 1 },
    hints: [
      { text: TX('この段は、キーウィには高すぎる（あなたは浮かんでこえられる）', 'This step is too high for the kiwi (you can float over it)'), when: (c) => c.placed },
    ],
    fail: TX('板の上で、キーウィはどうなった？', 'What happened to the kiwi on the board?'),
  },
  {
    ...base, T: 30, id: 't4', plate: 'III', name: TX('ひきかえせ', 'Turn Back'), tutorial: true,
    tops: tops([[28, 31, null]]), start: { x: 18, dir: 1 }, goal: { x: 2.6 },
    stock: { wall: 1 },
    hints: [
      { text: TX('巣は左にある。でも、キーウィは右へ歩いていく', 'The nest is on the left. But the kiwi walks to the right'), when: (c) => c.placed },
    ],
    fail: TX('柱にぶつかったら、キーウィはどうする？', 'What does the kiwi do when it bumps into a pillar?'),
  },
  {
    // 回すと意味がかわる: 長い板は、そのままでは崖に届かない。回すと横に長く（そのかわり短い時間だけ）
    ...base, T: 30, id: 't5', plate: 'IV', name: TX('まわす板', 'The Turned Board'), tutorial: true,
    tops: tops([[17, 24, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { beam: 1 },
    hints: [
      { text: TX('この崖は、板の長さでは届かない', 'This chasm is wider than the board is long'), when: (c) => c.rotated },
    ],
    fail: TX('回した板は、横に長いぶん、ある時間は短い', 'A turned board is longer sideways, so it lasts a shorter time'),
  },
  {
    // 平行四辺形の板（すべる足場）: 9マスの崖は、どの板でも届かない。のせて運べば、わたれる
    ...base, T: 30, id: 't6', plate: 'V', name: TX('はこぶ板', 'The Carrying Board'), tutorial: true,
    tops: tops([[17, 25, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { slide: 1 },
    hints: [
      { text: TX('こんどの板は、横にずれている', 'This board is shifted sideways'), when: (c) => c.placed },
    ],
    fail: TX('すべる板にのったキーウィは、どう動く？', 'How does the kiwi move on a sliding board?'),
  },
  {
    // 板で崖をわたり、ななめ板で段をのぼる（v073: 時刻の窓と柱はやめた）
    ...base, T: 35, id: 's1', plate: 'VI', name: TX('崖と段', 'Cliff and Step'),
    tops: tops([[12, 16, null], [19, 23, 3], [24, 35, 6]]), start: { x: 1.6, dir: 1 }, goal: { x: 32.4 },
    stock: { beam: 1, lift: 1 },
    hints: [], fail: TX('崖をわたったあと、キーウィは段をのぼれた？', 'After crossing the chasm, could the kiwi climb the step?'),
  },
  {
    ...base, T: 30, id: 's2', plate: 'VII', name: TX('高い巣', 'The High Nest'),
    tops: tops([[0, 6, 6], [7, 11, 3], [25, 29, null]]), start: { x: 16, dir: 1 }, goal: { x: 3 },
    window: [14, 26], // 柱でひきかえさせる「時刻」と、ななめ板の時刻を、両方合わせる（窓は広め）
    stock: { wall: 1, lift: 1 },
    hints: [{ text: '__windowHint__', when: (c) => c.placed }], fail: '',
  },
  {
    // 崖が2つ: 広い崖はすべる板で運び、せまい崖は長い板。卵が光っているあいだに着く
    ...base, T: 30, id: 's3', plate: 'VIII', name: TX('まにあう巣', 'Just in Time'),
    tops: tops([[8, 16, null], [22, 26, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 32 },
    window: [15, 22],
    stock: { beam: 1, slide: 1 },
    hints: [], fail: '',
  },
  {
    // ころがる石: 20秒に右の石がころがりだし、幅1マスの割れ目にはさまって「ふた」になる。それまで住人を待たせる
    ...base, T: 55, id: 's4', plate: 'IX', name: TX('石のふた', 'The Stone Lid'),
    tops: tops([[20, 20, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 30 },
    stones: [{ x: 32.5, t: 20, dir: -1 }],
    stock: { wall: 1 },
    hints: [{ text: TX('石は、どこへころがっていく？', 'Where will the stone roll?'), when: (c) => c.placed }], fail: '',
  },
  {
    // ひし形の板: 断面は、まん中の秒にいちばん広くなり、また縮む。崖をわたるあいだに、広いところを合わせる
    ...base, T: 30, id: 's5', plate: 'X', name: TX('ひし形の橋', 'The Diamond Bridge'),
    tops: tops([[19, 22, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { diamond: 1 },
    hints: [{ text: TX('ひし形の板は、どの秒で切っても同じ幅？', 'Is a diamond board the same width at every second?'), when: (c) => c.placed }], fail: '',
  },
  // ---- 2Dアクションのしかけの「舞台裏」（v073） ----
  {
    // 往復リフト: 高い台から低い地面へ、とびおりるとだめ（5マス）。「へ」の字の板に乗って、下ろしてもらう
    ...base, T: 30, id: 'g1', plate: 'XI', name: TX('往復するリフト', 'The Shuttle Lift'),
    tops: tops([[0, 19, 7], [20, 35, 2]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { hump: 1 },
    hints: [{ text: TX('この台から下へ落ちると、キーウィは助からない', 'If it drops off this ledge, the kiwi won’t survive'), when: (c) => c.placed }],
    fail: TX('リフトは、上がって、また下がる', 'The lift goes up, then comes back down'),
  },
  {
    // 消えるブロック: くし形の板は、出たり消えたりする。出ているあいだに、わたりきる
    ...base, T: 30, id: 'g2', plate: 'XII', name: TX('消えるブロック', 'The Vanishing Blocks'),
    tops: tops([[18, 18, null]]), start: { x: 1.6, dir: 1 }, goal: { x: 31 },
    stock: { comb: 1 },
    hints: [{ text: TX('このブロックは、ときどき消える', 'These blocks vanish now and then'), when: (c) => c.placed }],
    fail: TX('ブロックが出ているあいだに、わたりきれた？', 'Did the kiwi get across while the blocks were there?'),
  },
  {
    // 回る棒: 巣はうしろ。回る棒にぶつかると、キーウィは引き返す
    ...base, T: 35, id: 'g3', plate: 'XIII', name: TX('回る棒', 'The Spinning Bar'),
    tops: tops([[30, 33, null]]), start: { x: 14, dir: 1 }, goal: { x: 3 },
    stock: { spiral: 1 },
    hints: [{ text: TX('巣はうしろ。回る棒にぶつかると、キーウィは引き返す', 'The nest is behind. When the spinning bar bumps the kiwi, it turns back'), when: (c) => c.placed }],
    fail: TX('棒の先は、キーウィの通る高さを通った？', 'Did the end of the bar pass at the kiwi’s height?'),
  },
  {
    // ふたりの住人（v082 で本番の図版へ。むずかしくはないので）: 二羽とも、自分の巣と反対へ歩きだし、崖に落ちる。住人どうしはぶつかると引き返す。
    // 崖に橋をかけて、二羽を出会わせれば、ぶつかって、そろって巣へ帰る（橋は、帰り道にもいる）
    ...base, T: 30, id: 'x1', plate: 'XIV', name: TX('ふたりの住人', 'Two Residents'),
    tops: tops([[17, 19, null]]), start: { x: 6, dir: 1 }, goal: { x: 2 },
    more: [{ start: { x: 31, dir: -1 }, goal: { x: 34 } }],
    reveal: ['plank', TX('ふたりが出会う、つかのまの橋', 'a fleeting bridge where the two meet'), TX('二羽の行きと帰りをつつむ、一枚の板', 'one board that holds both the way out and the way back')],
    stock: { plank: 1 },
    hints: [
      { text: TX('キーウィが二羽。どちらも、自分の巣と反対へ歩いていく', 'Two kiwis. Both are walking away from their own nests'), when: (c) => c.seenEnd },
      { text: TX('キーウィどうしは、ぶつかると引き返す', 'When two kiwis bump into each other, they both turn back'), when: (c) => c.placed },
    ],
    fail: TX('二羽は出会えた？　帰り道にも、橋はある？', 'Did the two meet? Is the bridge still there on the way back?'),
  },
  // ---- 次の巻より（v081。むずかしい図版。次の作品で広がりそうな、新しいしくみ） ----
  {
    // 見えない手のスイッチ: 扉は、スイッチの板の上に何かがのっているあいだだけ開く。キーウィはスイッチに届かない。
    // 橋の板の断面が、スイッチを押しつづける（一枚で、橋とスイッチを押す手をかねる）
    ...base, T: 30, id: 'x2', plate: 'XV', name: TX('見えない手のスイッチ', 'The Invisible Hand'), extra: true,
    tops: tops([[0, 1, null], [18, 19, null]]), start: { x: 4, dir: 1 }, goal: { x: 31 },
    switches: [{ x: 21, w: 2, door: { x: 13, h: 3 } }],
    reveal: ['plank', TX('スイッチを押しつづける、見えない手', 'an invisible hand holding the switch'), TX('橋にかけた板の、はしのほう', 'the far end of the board bridging the chasm')],
    stock: { plank: 1 },
    hints: [
      { text: TX('扉は、スイッチの上に何かがのっているあいだだけ開く', 'The gate stays open only while something is on the switch'), when: (c) => c.seenEnd },
      { text: TX('板は一枚。橋にも、スイッチを押す手にもなれる？', 'Only one board. Can it be a bridge and the hand on the switch at once?'), when: (c) => c.placed },
    ],
    fail: TX('キーウィが扉を通るとき、スイッチは押されていた？', 'Was the switch held down when the kiwi reached the gate?'),
  },
  {
    // もう一羽が押すスイッチ（v082）: スイッチは、もう一羽のキーウィでも押せる。もう一羽は一度だけスイッチをふんで行ってしまう。
    // 壁で、もう一羽を引き返させてもう一度ふませる（または、こちらのキーウィを崖の手前で引き返させ、もう一羽の帰り道を待つ）
    ...base, T: 40, id: 'x3', plate: 'XVI', name: TX('もう一羽が押すスイッチ', 'The Friend on the Switch'), extra: true,
    tops: tops([[0, 1, null]]), start: { x: 4, dir: 1 }, goal: { x: 31 },
    more: [{ start: { x: 27, dir: -1 }, goal: { x: 34 } }],
    switches: [{ x: 22, w: 3, door: { x: 12, h: 3 } }],
    stock: { wall: 1 },
    reveal: ['wall', TX('もう一羽を、もう一度スイッチへ帰す壁', 'a wall that sends the friend back onto the switch'), TX('奥行きのある、一本の柱', 'a single pillar with depth')],
    hints: [
      { text: TX('もう一羽がスイッチをふむと、扉が開く。でも、早すぎる', 'When the other kiwi steps on the switch, the gate opens. But too early'), when: (c) => c.seenEnd },
      { text: TX('もう一羽に、もう一度ふんでもらえない？', 'Could the other kiwi step on it once more?'), when: (c) => c.placed },
    ],
    fail: TX('キーウィが扉に着いたとき、だれかがスイッチの上にいた？', 'When the kiwi reached the gate, was anyone on the switch?'),
  },
  {
    // 重いスイッチ（v082）: 石の重さでしか沈まないスイッチ。ころがる石は、スイッチの上を通りすぎてしまう。
    // 壁で、石をスイッチの上に止める（形の断面ではスイッチは沈まない）
    ...base, T: 20, id: 'x4', plate: 'XVII', name: TX('重いスイッチ', 'The Heavy Switch'), extra: true,
    tops: tops([[0, 1, null]]), start: { x: 4, dir: 1 }, goal: { x: 18.5 },
    switches: [{ x: 22.5, w: 3, heavy: true, door: { x: 15.5, h: 3 } }],
    stones: [{ x: 33.5, t: 0, dir: -1 }],
    stock: { wall: 1 },
    reveal: ['wall', TX('ころがる石を、スイッチの上で止める壁', 'a wall that stops the rolling stone on the switch'), TX('奥行きのある、一本の柱', 'a single pillar with depth')],
    hints: [
      { text: TX('このスイッチは重い。石がのったときだけ沈む', 'This switch is heavy. Only a stone can push it down'), when: (c) => c.seenEnd },
      { text: TX('石は、スイッチの上を通りすぎてしまう', 'The stone just rolls over the switch'), when: (c) => c.placed },
    ],
    fail: TX('石は、スイッチの上で止まった？', 'Did the stone stop on the switch?'),
  },
];

export const LEVEL = LEVELS[0];
