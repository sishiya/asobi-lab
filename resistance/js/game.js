// game.js — ゲームのきまり: 10夜で全滅させる・★・記録・夜のあとの強化カード・敵のようすの警告・終わりの画面
'use strict';

const NIGHTS = 10;
const STAR_AT = [4, 6, 10];          // この夜までに全滅させたら ★3・★2・★1
const SAVE_KEY = 'resistance.best';  // {nights, stars}
function starsFor(night) { return night <= STAR_AT[0] ? 3 : night <= STAR_AT[1] ? 2 : night <= STAR_AT[2] ? 1 : 0; }
function loadBest() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
function saveBest(b) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(b)); } catch (e) { /* 保存できなくても遊べる */ } }
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---- 夜のあとの強化 ----
// kind: 'tool'（道具を強くする。虫は進化でかわせる）／'env'（薬を使わない対策。進化ではかわせない）
const CARDS = [
  {id: 'bigswat', kind: 'tool', name: '大きいスリッパ', desc: '叩ける広さが 1.15 倍。', max: 2, apply() { TOOL.swatR *= 1.15; }},
  {id: 'quick', kind: 'tool', name: 'すばやく振る', desc: '次に振れるまでの時間が 0.08 秒短くなる。', max: 2, apply() { TOOL.swatCool -= 0.08; }},
  {id: 'morespray', kind: 'tool', name: 'スプレーを買い足す', desc: '1晩に使える量が 6 秒ふえる。', max: 3, apply() { TOOL.sprayBudget += 6; }},
  {id: 'strong', kind: 'tool', name: '濃いスプレー', desc: 'あびる薬の量が 1.5 倍。ただし、殺虫剤に強い遺伝子を2本持つ虫には、それでも足りない。', max: 2, apply() { TOOL.doseK *= 1.5; }},
  {id: 'bait', kind: 'tool', name: '毒エサを増やす', desc: '置ける数が 1 つふえる。', max: 2, apply() { TOOL.baitMax += 1; }},
  ...FOODS.map(f => ({id: 'clean-' + f.id, kind: 'env', name: `${f.name}を片づける`, desc: '食べるものが減ると、おなかをすかせた虫は子が少なくなる。', max: 1,
    ok: () => OPEN_FOODS.includes(f) && OPEN_FOODS.length > 1, apply() { OPEN_FOODS = OPEN_FOODS.filter(x => x !== f); kitchenCache = null; }})),
  ...HIDES.map(h => ({id: 'seal-' + h.id, kind: 'env', name: `${h.name}をふさぐ`, desc: '隠れ場所が減ると、虫が出てくるところが決まってくる。', max: 1,
    ok: () => OPEN_HIDES.includes(h) && OPEN_HIDES.length > 2, apply() { OPEN_HIDES = OPEN_HIDES.filter(x => x !== h); kitchenCache = null; }})),
];
function cardOk(c, taken) { return (taken[c.id] || 0) < c.max && (!c.ok || c.ok()); }
// 3枚: 道具から2枚・薬を使わない対策から1枚（どちらかが足りなければ残りから）
function dealCards(taken) {
  const pick = (arr, n) => { const a = arr.slice(), out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out; };
  const tool = CARDS.filter(c => c.kind === 'tool' && cardOk(c, taken)), env = CARDS.filter(c => c.kind === 'env' && cardOk(c, taken));
  // 同じ場所の「片づける」「ふさぐ」が2枚並ばないよう、種類ごとに1枚まで
  const envOne = [...pick(env.filter(c => c.id.startsWith('clean')), 1), ...pick(env.filter(c => c.id.startsWith('seal')), 1)];
  const out = [...pick(tool, 2), ...pick(envOne, 1)];
  return out.concat(pick([...tool, ...envOne].filter(c => !out.includes(c)), 3 - out.length));
}
function cardsHTML(cards) {
  return cards.map(c => `<button class="gcard ${c.kind}" data-id="${c.id}"><span class="gk">${c.kind === 'env' ? '薬を使わない' : '道具'}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`).join('');
}

// ---- 敵のようす ----
// 1世代目からの変化が大きい性質を、強い順に（警告の札・パネルで使う）
function enemyReport(bugs, first) {
  return TRAITS.map(t => {
    const now = traitSummary(bugs, t.id).v, base = traitSummary(first, t.id).v;
    return {t, now, base, rise: now - base};
  });
}
const WARN = {
  wary: '出てこない虫がふえた（警戒心）',
  sense: 'すばやく逃げる虫がふえた（危険の察知）',
  kdr: 'スプレーが効きにくい虫がふえた',
  gav: '毒エサを食べない虫がふえた（糖ぎらい）',
};
function warnings(bugs, first) {
  return enemyReport(bugs, first).filter(r => r.t.kind === 'poly' ? r.rise > 0.06 : r.now > 0.2 && r.rise > 0.08)
    .sort((a, b) => b.rise - a.rise).map(r => `${WARN[r.t.id]}: <b>${r.t.kind === 'poly' ? r.now.toFixed(2) : pct(r.now)}</b>`);
}

// 「敵のようす」のメーター（パネル）
function buildEnemy() {
  $('enemy').innerHTML = TRAITS.map(t => `
    <div class="en" data-id="${t.id}"><span class="en-n" style="color:${t.color}">${t.name}</span>
      <i class="en-bar"><b id="enb-${t.id}" style="background:${t.color}"></b><u id="enf-${t.id}"></u></i><span class="en-v mono" id="env-${t.id}"></span></div>`).join('');
}
function updateEnemy(bugs, first) {
  for (const r of enemyReport(bugs, first)) {
    // 量的な性質は 0〜1 の平均、1つの遺伝子のものは持っている割合。どちらも 0〜1 の棒に
    $('enb-' + r.t.id).style.width = pct(Math.min(1, r.now));
    $('enf-' + r.t.id).style.left = pct(Math.min(1, r.base));
    const up = r.t.kind === 'poly' ? r.rise > 0.04 : r.rise > 0.05;
    $('env-' + r.t.id).innerHTML = (r.t.kind === 'poly' ? r.now.toFixed(2) : pct(r.now)) + (up ? ' <em>↑</em>' : '');
  }
}

// ---- 終わりの画面 ----
function lessonText(hist, used) {
  const first = hist[0], last = hist[hist.length - 1];
  const rises = TRAITS.map(t => ({t, d: last[t.id] - first[t.id]})).sort((a, b) => b.d - a.d);
  const top = rises[0];
  const most = Object.entries(used).sort((a, b) => b[1] - a[1])[0];
  const toolName = {swat: 'スリッパ', spray: 'スプレー', bait: '毒エサ'}[most[0]];
  const share = most[1] / Math.max(1, used.swat + used.spray + used.bait);
  let s = `いちばん多く退治したのは<b>${toolName}</b>（${pct(share)}）。`;
  if (top.d > 0.05) {
    const v = x => top.t.kind === 'poly' ? x.toFixed(2) : pct(x);
    s += `そのあいだに<b style="color:${top.t.color}">${top.t.name}</b>${top.t.kind === 'poly' ? 'の平均' : top.t.id === 'kdr' ? '虫の割合' : 'の虫の割合'}が ${v(first[top.t.id])} → <b>${v(last[top.t.id])}</b> になりました。`;
    s += share > 0.7 ? 'ひとつの道具にたよると、その道具に強い虫が選ばれて残ります。' : '';
  } else s += '虫の性質は、あまり変わりませんでした。進化が追いつく前に退治できたということです。';
  return s;
}
