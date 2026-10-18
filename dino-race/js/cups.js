// 大会（お題とメダル）・本物の動物との比べっこ・研究の推定・体重クラス。
// お題は「はじめての100m」以外、牧場で生まれた恐竜（1代目から）で挑む（育てる理由を作るため）。
// メダル1つで牧場が1匹分広がる（store.js の slots()）。
// v004: お題を3段（初級・中級・上級）に。段のお題をぜんぶ取ると次の段が開く。

// ゴースト: 決まった速さで 100m を走る目安（t = 100m の秒数）。かけっこの線と結果の比べっこに使う
const REFS = {
  human:    {name: TX('人の100m世界記録', "Men's 100m world record"), short: TX('人の世界記録', 'Human record'), t: 9.58, M: 94, note: TX('2009年の世界記録', 'World record set in 2009')},
  elephant: {name: TX('アジアゾウ（全力）', 'Asian elephant (full speed)'), short: TX('ゾウ', 'Elephant'), t: 100 / 6.8, M: 3000, note: TX('測れたいちばん速いゾウで秒速 6.8m（Hutchinson ら 2003。タイのアジアゾウ）', 'Fastest elephant measured: 6.8 m/s (Hutchinson et al. 2003, Asian elephants in Thailand)')},
  ostrich:  {name: TX('ダチョウ（全力）', 'Ostrich (full speed)'), short: TX('ダチョウ', 'Ostrich'), t: 100 / (70 / 3.6), M: 110, note: TX('時速 50〜70km と言われる（測り方で幅がある。目安）', 'Said to reach 50–70 km/h (estimates vary; a rough guide)')},
};

// 研究の推定: Sellers & Manning (2007) Proc. R. Soc. B 274: 2711–2716 の Table 1（骨格の模型を物理の中で進化させて走らせた最高速度）。
// 2026-10-16 に原典の表で確かめた。体重 M（kg）と速さ v（m/秒）
// id は記録帳のかぎ（prog.research。v007 までは日本語の名前 ja がかぎだった → store.js で移す）
const RESEARCH = [
  {id: 'compy', ja: 'コンプソグナトゥス', en: 'Compsognathus', M: 3, v: 17.8},
  {id: 'raptor', ja: 'ヴェロキラプトル', en: 'Velociraptor', M: 20, v: 10.8},
  {id: 'dilo', ja: 'ディロフォサウルス', en: 'Dilophosaurus', M: 430, v: 10.5},
  {id: 'allo', ja: 'アロサウルス', en: 'Allosaurus', M: 1400, v: 9.4},
  {id: 'trex', ja: 'ティラノサウルス', en: 'Tyrannosaurus', M: 6000, v: 8.0},
].map(r => ({...r, name: TX(r.ja, r.en)}));

// 体重クラス（記録帳）
const CLASSES = [
  {id: 'xs', name: TX('5kg まで', 'Up to 5kg'), max: 5},
  {id: 's', name: TX('5〜50kg', '5–50kg'), max: 50},
  {id: 'm', name: TX('50〜500kg', '50–500kg'), max: 500},
  {id: 'l', name: TX('500kg〜5t', '500kg–5t'), max: 5000},
  {id: 'xl', name: TX('5t より重い', 'Over 5t'), max: Infinity},
];
const classOf = M => CLASSES.find(c => M <= c.max);

const TIERS = [
  {id: 1, name: TX('初級', 'Beginner')},
  {id: 2, name: TX('中級', 'Intermediate'), gift: TX('中級が開くと、俊足のストルティオミムスが牧場に仲間入りします。', 'When Intermediate opens, the swift Struthiomimus joins your ranch.')},
  {id: 3, name: TX('上級', 'Advanced'), gift: TX('上級が開くと、おまかせの進化で「体の形も変える」が使えます。', 'When Advanced opens, Auto-evolve gains "Also change body shape".')},
];

// お題。rivals: 一緒に走る本物の恐竜（はじめの種の id。いつもの走り＝調子のずれなし）、ghosts: REFS のキー
// need(x): 出られるか（出られないときは理由の文）。win(r, ctx): r は自分の記録、ctx.rivals はライバルの記録
// target: 切るタイム（秒）。ライバルのお題は、ライバルより先にゴール。steady: 調子のずれなしで走る（はじめの成功は確実に）
// hint: 落ちたときの次の一手
const beatRivals = (r, c) => r.finishT != null && c.rivals.every(x => x.finishT == null || r.finishT < x.finishT);
const under = t => r => r.finishT != null && r.finishT < t;
const massIn = (lo, hi, text) => x => { const M = bodyPlan(x.g).M; return M >= lo && M <= hi ? null : text; };
const CUPS = [
  {id: 'first', tier: 1, title: TX('はじめての100m', 'Your first 100m'), text: TX('どの恐竜でもいいので、100m を走りきる。', 'Finish 100m with any dinosaur.'), starterOk: true, steady: true,
   win: r => r.finishT != null, hint: TX('記録が「100m ◯秒」の恐竜を選ぶと確実です。', 'Pick a dinosaur whose record shows a 100m time — a sure finish.')},
  {id: 'debut', tier: 1, title: TX('わが子のデビュー', 'First hatchling debut'), text: TX('牧場で生まれた恐竜で、100m を走りきる。', 'Finish 100m with a dinosaur born on your ranch.'), steady: true,
   win: r => r.finishT != null, hint: TX('体の近い親どうし（ラプトル×コンピーなど）の子は転びにくい。転んだ子は練習を。', 'Young of similar-bodied parents (e.g. Raptor × Compy) fall less. Train the ones that fall.')},
  {id: 'trex', tier: 1, title: TX('ティラノに勝て', 'Beat the T. rex'), text: TX('ティラノサウルスより先にゴールする。', 'Finish ahead of Tyrannosaurus.'), rivals: ['trex'], win: beatRivals,
   hint: TX('小さい恐竜の子なら、ゴールさえすればまず勝てます。転ばない子（10回中のゴールが多い子）を。', 'A small dinosaur almost always wins if it just finishes. Choose a steady one (finishes most of its 10 tries).')},
  {id: 'elephant', tier: 1, title: TX('ゾウより速く', 'Faster than an elephant'), text: TX('アジアゾウの全力（100m およそ 14.7秒）より速く走る。', 'Run faster than an Asian elephant at full speed (about 14.7s for 100m).'), ghosts: ['elephant'],
   target: REFS.elephant.t, win: under(REFS.elephant.t), hint: TX('ラプトルやコンピーの血を引く子なら届きます。遅い子は練習を。', 'Young with Raptor or Compy blood can make it. Train the slow ones.')},

  {id: 'human', tier: 2, title: TX('人の世界記録をやぶれ', 'Break the human record'), text: TX('100m 9.58秒（人の世界記録）より速く走る。', 'Run 100m faster than 9.58s (the human world record).'), ghosts: ['human'],
   target: REFS.human.t, win: under(REFS.human.t), hint: TX('ラプトル系どうしをかけ合わせて、速い子を練習。しっかり度が低いと本番で転びます。', 'Breed Raptor lines together and train the fast ones. Low steadiness means falls on race day.')},
  // 自動プレイ（2026-10-19）: コンピーどうしの子を練習・かけ合わせ直しで 9.0〜9.4秒（ふだん）に届き、4〜25分で取れる
  {id: 'tiny', tier: 2, title: TX('小さな俊足', 'Small and swift'), text: TX('体重 3kg 以下で、9.5秒を切る。', 'Weighing 3kg or less, run under 9.5s.'),
   need: massIn(0, 3, TX('体重 3kg 以下が出られます', 'Only 3kg or less may enter')), target: 9.5, win: under(9.5),
   hint: TX('コンピーどうしの子を練習で仕上げる。いちばん速い子どうしをかけ合わせ直すと、もう一歩伸びる。', 'Train Compy × Compy young. Breeding the fastest ones together again adds a little more.')},
  {id: 'medium', tier: 2, title: TX('中型級の韋駄天', 'Middleweight sprinter'), text: TX('体重 50〜500kg で、12秒を切る。', 'Weighing 50–500kg, run under 12s.'),
   need: massIn(50, 500, TX('体重 50〜500kg が出られます', 'Only 50–500kg may enter')), target: 12, win: under(12),
   hint: TX('はじめの3種にはこの重さがいません。ストルティオミムスの子か、大きさのちがう親どうしの子で。', 'None of the first three species fits this weight. Use Struthiomimus young, or young of parents of different sizes.')},
  {id: 'heavy', tier: 2, title: TX('重量級スプリンター', 'Heavyweight sprinter'), text: TX('体重 500kg 以上で、20秒を切る。', 'Weighing 500kg or more, run under 20s.'),
   need: massIn(500, Infinity, TX('体重 500kg 以上が出られます', 'Only 500kg or more may enter')), target: 20, win: under(20),
   hint: TX('大きいほど力が足りません（相似則）。ティラノとストルティオミムスやラプトルの子を、練習で仕上げる。', 'The bigger the body, the less strength to spare (scaling). Train young of T. rex with Struthiomimus or Raptor.')},

  {id: 'raptor', tier: 3, title: TX('ラプトルに勝て', 'Beat the Raptor'), text: TX('ヴェロキラプトルより先にゴールする。', 'Finish ahead of Velociraptor.'), rivals: ['raptor'], win: beatRivals,
   // ヒントは「ストルティオミムスの長い脚」だったが、ラプトル×ストルティオの子はほとんど転ぶ。体ごとのおまかせ 30世代なら 1〜2回で勝ち目が出る（2026-10-18）
   hint: TX('ラプトル（8.6秒）より速い子が要ります。いちばん速い子を、おまかせの「体の形も変える」で 30世代。', 'You need one faster than the Raptor (8.6s). Auto-evolve your fastest for 30 generations with "Also change body shape".')},
  {id: 'giant', tier: 3, title: TX('巨人の全力', 'Giant at full speed'), text: TX('体重 5t 以上で、22秒を切る（はじめのティラノは 23.6秒）。', 'Weighing 5t or more, run under 22s (the founder T. rex runs 23.6s).'),
   need: massIn(5000, Infinity, TX('体重 5t 以上が出られます', 'Only 5t or more may enter')), target: 22, win: under(22),
   hint: TX('ティラノどうしの子を練習・おまかせで。しっかり度の低い巨体は本番で転びやすい。', 'Use T. rex × T. rex young with training and Auto-evolve. Giants with low steadiness fall easily on race day.')},
  // はじめは「時速 50km（7.2秒）」にしたが、ラプトル系を体ごと進化させても 8.7秒あたりで頭打ちだったので 8.0秒に（2026-10-11）。
  // 2026-10-19 の自動プレイ: 体ごとのおまかせ 30世代を重ねると 7.5〜8.0秒（ふだん）に届き、ラプトル戦で育てた子から 0.5〜9分
  {id: 'ostrich', tier: 3, title: TX('ダチョウに近づけ', 'Chase the ostrich'), text: TX('時速 45km（100m 8.0秒）を超える。ダチョウは時速 50〜70km と言われ、まだずっと先。', 'Top 45 km/h (100m in 8.0s). Ostriches are said to reach 50–70 km/h — still far ahead.'), ghosts: ['ostrich'],
   target: 8.0, win: under(8.0), hint: TX('おまかせで「体の形も変える」を 30世代。何度か重ねて、体ごと速い形をさがす。', 'Auto-evolve with "Also change body shape" for 30 generations. Repeat a few times to find a faster body.')},
];

// その段が開いているか（前の段のお題をぜんぶ取った）
const tierDone = t => CUPS.filter(c => c.tier === t).every(c => prog.medals[c.id]);
const tierOpen = t => t <= 1 || tierDone(t - 1);

// 出られるか（理由の文 or null）
function cupBlock(cup, x) {
  if (!cup.starterOk && !x.gen) return TX('はじめの恐竜は出られません（牧場で生まれた子で）', 'Founders may not enter (use one born on your ranch)');
  return cup.need ? cup.need(x) : null;
}
