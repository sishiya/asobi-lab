// 大会（お題とメダル）・本物の動物との比べっこ・研究の推定・体重クラス。
// お題は「はじめての100m」以外、牧場で生まれた恐竜（1代目から）で挑む（育てる理由を作るため）。
// メダル1つで牧場が1匹分広がる（store.js の slots()）。
// v004: お題を3段（初級・中級・上級）に。段のお題をぜんぶ取ると次の段が開く。

// ゴースト: 決まった速さで 100m を走る目安（t = 100m の秒数）。かけっこの線と結果の比べっこに使う
const REFS = {
  human:    {name: '人の100m世界記録', short: '人の世界記録', t: 9.58, M: 94, note: '2009年の世界記録'},
  elephant: {name: 'アジアゾウ（全力）', short: 'ゾウ', t: 100 / 6.8, M: 3000, note: '測れたいちばん速いゾウで秒速 6.8m（Hutchinson ら 2003。タイのアジアゾウ）'},
  ostrich:  {name: 'ダチョウ（全力）', short: 'ダチョウ', t: 100 / (70 / 3.6), M: 110, note: '時速 50〜70km と言われる（測り方で幅がある。目安）'},
};

// 研究の推定: Sellers & Manning (2007) Proc. R. Soc. B 274: 2711–2716 の Table 1（骨格の模型を物理の中で進化させて走らせた最高速度）。
// 2026-10-16 に原典の表で確かめた。体重 M（kg）と速さ v（m/秒）
const RESEARCH = [
  {name: 'コンプソグナトゥス', M: 3, v: 17.8},
  {name: 'ヴェロキラプトル', M: 20, v: 10.8},
  {name: 'ディロフォサウルス', M: 430, v: 10.5},
  {name: 'アロサウルス', M: 1400, v: 9.4},
  {name: 'ティラノサウルス', M: 6000, v: 8.0},
];

// 体重クラス（記録帳）
const CLASSES = [
  {id: 'xs', name: '5kg まで', max: 5},
  {id: 's', name: '5〜50kg', max: 50},
  {id: 'm', name: '50〜500kg', max: 500},
  {id: 'l', name: '500kg〜5t', max: 5000},
  {id: 'xl', name: '5t より重い', max: Infinity},
];
const classOf = M => CLASSES.find(c => M <= c.max);

const TIERS = [
  {id: 1, name: '初級'},
  {id: 2, name: '中級', gift: '中級が開くと、俊足のストルティオミムスが牧場に仲間入りします。'},
  {id: 3, name: '上級', gift: '上級が開くと、おまかせの進化で「体の形も変える」が使えます。'},
];

// お題。rivals: 一緒に走る本物の恐竜（はじめの種の id。いつもの走り＝調子のずれなし）、ghosts: REFS のキー
// need(x): 出られるか（出られないときは理由の文）。win(r, ctx): r は自分の記録、ctx.rivals はライバルの記録
// target: 切るタイム（秒）。ライバルのお題は、ライバルより先にゴール。steady: 調子のずれなしで走る（はじめの成功は確実に）
// hint: 落ちたときの次の一手
const beatRivals = (r, c) => r.finishT != null && c.rivals.every(x => x.finishT == null || r.finishT < x.finishT);
const under = t => r => r.finishT != null && r.finishT < t;
const massIn = (lo, hi, text) => x => { const M = bodyPlan(x.g).M; return M >= lo && M <= hi ? null : text; };
const CUPS = [
  {id: 'first', tier: 1, title: 'はじめての100m', text: 'どの恐竜でもいいので、100m を走りきる。', starterOk: true, steady: true,
   win: r => r.finishT != null, hint: '記録が「100m ◯秒」の恐竜を選ぶと確実です。'},
  {id: 'debut', tier: 1, title: 'わが子のデビュー', text: '牧場で生まれた恐竜で、100m を走りきる。', steady: true,
   win: r => r.finishT != null, hint: '体の近い親どうし（ラプトル×コンピーなど）の子は転びにくい。転んだ子は練習を。'},
  {id: 'trex', tier: 1, title: 'ティラノに勝て', text: 'ティラノサウルスより先にゴールする。', rivals: ['trex'], win: beatRivals,
   hint: '小さい恐竜の子なら、ゴールさえすればまず勝てます。転ばない子（6回中のゴールが多い子）を。'},
  {id: 'elephant', tier: 1, title: 'ゾウより速く', text: 'アジアゾウの全力（100m およそ 14.7秒）より速く走る。', ghosts: ['elephant'],
   target: REFS.elephant.t, win: under(REFS.elephant.t), hint: 'ラプトルやコンピーの血を引く子なら届きます。遅い子は練習を。'},

  {id: 'human', tier: 2, title: '人の世界記録をやぶれ', text: '100m 9.58秒（人の世界記録）より速く走る。', ghosts: ['human'],
   target: REFS.human.t, win: under(REFS.human.t), hint: 'ラプトル系どうしをかけ合わせて、速い子を練習。しっかり度が低いと本番で転びます。'},
  {id: 'tiny', tier: 2, title: '小さな俊足', text: '体重 3kg 以下で、9.5秒を切る。',
   need: massIn(0, 3, '体重 3kg 以下が出られます'), target: 9.5, win: under(9.5),
   hint: 'コンピーどうしの子は練習だけでは 9.7秒ほどで止まりがち。脚の長い子を選んでかけ合わせを重ねる。'},
  {id: 'medium', tier: 2, title: '中型級の韋駄天', text: '体重 50〜500kg で、12秒を切る。',
   need: massIn(50, 500, '体重 50〜500kg が出られます'), target: 12, win: under(12),
   hint: 'はじめの3種にはこの重さがいません。ストルティオミムスの子か、大きさのちがう親どうしの子で。'},
  {id: 'heavy', tier: 2, title: '重量級スプリンター', text: '体重 500kg 以上で、20秒を切る。',
   need: massIn(500, Infinity, '体重 500kg 以上が出られます'), target: 20, win: under(20),
   hint: '大きいほど力が足りません（相似則）。ティラノとストルティオミムスやラプトルの子を、練習で仕上げる。'},

  {id: 'raptor', tier: 3, title: 'ラプトルに勝て', text: 'ヴェロキラプトルより先にゴールする。', rivals: ['raptor'], win: beatRivals,
   hint: 'ラプトル（8.7秒）より速い子が要ります。ストルティオミムスの長い脚が助けになるかも。'},
  {id: 'giant', tier: 3, title: '巨人の全力', text: '体重 5t 以上で、22秒を切る（はじめのティラノは 23.7秒）。',
   need: massIn(5000, Infinity, '体重 5t 以上が出られます'), target: 22, win: under(22),
   hint: 'ティラノどうしの子を練習・おまかせで。しっかり度の低い巨体は本番で転びやすい。'},
  // はじめは「時速 50km（7.2秒）」にしたが、ラプトル系を体ごと進化させても 8.7秒あたりで頭打ちだったので 8.0秒に（2026-10-11）
  {id: 'ostrich', tier: 3, title: 'ダチョウに近づけ', text: '時速 45km（100m 8.0秒）を超える。ダチョウは時速 50〜70km と言われ、まだずっと先。', ghosts: ['ostrich'],
   target: 8.0, win: under(8.0), hint: 'おまかせで「体の形も変える」を使って、体ごと速い形をさがす。'},
];

// その段が開いているか（前の段のお題をぜんぶ取った）
const tierDone = t => CUPS.filter(c => c.tier === t).every(c => prog.medals[c.id]);
const tierOpen = t => t <= 1 || tierDone(t - 1);

// 出られるか（理由の文 or null）
function cupBlock(cup, x) {
  if (!cup.starterOk && !x.gen) return 'はじめの恐竜は出られません（牧場で生まれた子で）';
  return cup.need ? cup.need(x) : null;
}
