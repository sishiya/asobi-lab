// 大会（お題とメダル）・本物の動物との比べっこ・体重クラス。
// お題は「はじめての100m」以外、牧場で生まれた恐竜（1代目から）で挑む（育てる理由を作るため）。
// メダル1つで牧場が1匹分広がる（main.js の slots()）。

// ゴースト: 決まった速さで 100m を走る目安（t = 100m の秒数）。かけっこの線と結果の比べっこに使う
const REFS = {
  human:    {name: '人の100m世界記録', short: '人の世界記録', t: 9.58, note: '2009年の世界記録'},
  elephant: {name: 'アフリカゾウ（全力）', short: 'ゾウ', t: 100 / 6.8, note: 'いちばん速く測れたゾウで秒速 6.8m（Hutchinson ら 2003）'},
  ostrich:  {name: 'ダチョウ（全力）', short: 'ダチョウ', t: 100 / (70 / 3.6), note: '時速 70km ほどと言われる（目安）'},
};

// 体重クラス（記録帳）
const CLASSES = [
  {id: 'xs', name: '5kg まで', max: 5},
  {id: 's', name: '5〜50kg', max: 50},
  {id: 'm', name: '50〜500kg', max: 500},
  {id: 'l', name: '500kg〜5t', max: 5000},
  {id: 'xl', name: '5t より重い', max: Infinity},
];
const classOf = M => CLASSES.find(c => M <= c.max);

// お題。rivals: 一緒に走る本物の恐竜（はじめの3種の id）、ghosts: REFS のキー
// need(x): 出られるか（出られないときは理由の文）。win(r, ctx): r は自分の記録、ctx.rivals はライバルの記録
// target: 切るタイム（秒）。ライバルのお題は、ライバルより先にゴール
const beatRivals = (r, c) => r.finishT != null && c.rivals.every(x => x.finishT == null || r.finishT < x.finishT);
const under = t => r => r.finishT != null && r.finishT < t;
const CUPS = [
  {id: 'first', title: 'はじめての100m', text: 'どの恐竜でもいいので、100m を走りきる。', starterOk: true,
   win: r => r.finishT != null},
  {id: 'debut', title: 'わが子のデビュー', text: '牧場で生まれた恐竜で、100m を走りきる。',
   win: r => r.finishT != null},
  {id: 'trex', title: 'ティラノに勝て', text: 'ティラノサウルスより先にゴールする。', rivals: ['trex'], win: beatRivals},
  {id: 'elephant', title: 'ゾウより速く', text: 'アフリカゾウの全力（100m およそ 14.7秒）より速く走る。', ghosts: ['elephant'],
   target: REFS.elephant.t, win: under(REFS.elephant.t)},
  {id: 'human', title: '人の世界記録をやぶれ', text: '100m 9.58秒（人の世界記録）より速く走る。', ghosts: ['human'],
   target: REFS.human.t, win: under(REFS.human.t)},
  {id: 'heavy', title: '重量級スプリンター', text: '体重 500kg 以上で、20秒を切る。',
   need: x => bodyPlan(x.g).M >= 500 ? null : '体重 500kg 以上が出られます', target: 20, win: under(20)},
  {id: 'tiny', title: '小さな俊足', text: '体重 3kg 以下で、9.5秒を切る。',
   need: x => bodyPlan(x.g).M <= 3 ? null : '体重 3kg 以下が出られます', target: 9.5, win: under(9.5)},
  {id: 'raptor', title: 'ラプトルに勝て', text: 'ヴェロキラプトルより先にゴールする。', rivals: ['raptor'], win: beatRivals},
  {id: 'giant', title: '巨人の全力', text: '体重 5t 以上で、22秒を切る（はじめのティラノは 23.7秒）。',
   need: x => bodyPlan(x.g).M >= 5000 ? null : '体重 5t 以上が出られます', target: 22, win: under(22)},
  // はじめは「時速 50km（7.2秒）」にしたが、ラプトル系を体ごと進化させても 8.7秒あたりで頭打ちだったので 8.0秒に（2026-10-11）
  {id: 'ostrich', title: 'ダチョウに近づけ', text: '時速 45km（100m 8.0秒）を超える。ダチョウは時速 70km ほどで、まだずっと先。', ghosts: ['ostrich'],
   target: 8.0, win: under(8.0)},
];

// 出られるか（理由の文 or null）
function cupBlock(cup, x) {
  if (!cup.starterOk && !x.gen) return 'はじめの3匹は出られません（牧場で生まれた子で）';
  return cup.need ? cup.need(x) : null;
}
