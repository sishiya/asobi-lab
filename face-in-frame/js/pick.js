// 1回分の絵の選び方とならべ方（v014）。画面にはふれない（tools/pick-check.mjs で回して確かめる）。
// ユーザー「前回の３つを覚えておいて、つぎは同じのを選ばない」「心理学とか認知科学の観点から」「前回うまくいかなかったからまたチャレンジしたい欲もある」
//   1. 目新しさ: トランプの山のように、まだ出ていない絵から選ぶ。ぜんぶ出たら山を作りなおす（前回の絵は入れない）。
//      同じ回に同じ画家は入れない（似た絵が並ぶと、2枚目は目新しさが落ちる）。
//   2. リベンジ: 前回いちばん点の低かった絵が RETRY 点より下なら、1枠だけもう一度出す（やりかけ・惜しかったことは心に残り、
//      もう一度やりたくなる）。続けて2回はリベンジにしない（できないままくり返すと嫌になる）。
//      画面には何も出さない（ユーザー「内部的にさりげなくやればいい」「余計な要素たさないで」）。
//   3. ならべ方: 表情の大きさ（お手本の数の合計）で、1枚目は2番目に大きい絵（つかみ＝やることがすぐわかる）、
//      まん中に控えめな絵、最後にいちばん大きい絵（ピーク・エンド: 終わりの印象が全体の印象になる）。リベンジはまん中に置く。
//   4. はじめて遊ぶ人: 1枚目は「叫び」（だれでも知っていて、まねする顔がひと目でわかる）。
export const RETRY = 60;

const shuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const strength = p => Object.values(p.goal || {}).reduce((s, v) => s + v, 0);

// state: { seen: [id], last: [id], played: 回数, scores: [{ id, score, retry }]（前回のけっか） }
// 返り値: { list: [{ p, retry }], state: 次の state（けっかの scores は finish で入れる） }
export function pickRound(paintings, n, state = {}, rnd = Math.random) {
  const byId = new Map(paintings.map(p => [p.id, p]));
  const seen = (state.seen || []).filter(id => byId.has(id)), last = new Set(state.last || []);
  const chosen = [], artists = new Set();
  const take = (p, retry = false) => { chosen.push({ p, retry }); artists.add(p.artist); };
  const free = p => !chosen.some(c => c.p === p) && !artists.has(p.artist);

  // 4. はじめて
  const first = !state.played && byId.get('scream');
  if (first) take(first);
  // 2. リベンジ（前回がリベンジでなかった低い絵）
  const prev = (state.scores || []).filter(s => byId.has(s.id) && !s.retry).sort((a, b) => a.score - b.score)[0];
  const retryOk = n >= 3 && prev && prev.score < RETRY && !(state.scores || []).some(s => s.retry);
  if (retryOk && free(byId.get(prev.id))) take(byId.get(prev.id), true);
  // 1. 山から
  let deck = seen.concat(chosen.map(c => c.p.id));
  const fill = pool => { for (const p of pool) if (chosen.length < n && free(p)) take(p); };
  fill(shuffle(paintings.filter(p => !deck.includes(p.id)), rnd));
  if (chosen.length < n) { // 山が尽きた: 作りなおす（前回の絵はのぞく）
    fill(shuffle(paintings.filter(p => !last.has(p.id)), rnd));
    deck = [];
  }
  if (chosen.length < n) fill(shuffle(paintings, rnd)); // 絵が少なすぎるとき（同じ画家も入れる）
  for (const p of shuffle(paintings, rnd)) if (chosen.length < n && !chosen.some(c => c.p === p)) take(p);

  // 3. ならべ方
  const head = first ? [chosen[0]] : [];
  const rest = chosen.slice(head.length), retry = rest.filter(c => c.retry), plain = rest.filter(c => !c.retry).sort((a, b) => strength(a.p) - strength(b.p));
  let order;
  if (plain.length >= 2) {
    const peak = plain.pop(), opener = head.length ? null : plain.pop();
    const mid = plain.concat(retry); // 控えめな絵とリベンジがまん中
    order = [...head, ...(opener ? [opener] : []), ...mid, peak];
  } else order = [...head, ...plain, ...retry];

  const ids = order.map(c => c.p.id);
  return { list: order, state: { ...state, seen: deck.length ? [...new Set(deck.concat(ids))] : ids, last: ids, played: (state.played || 0) + 1 } };
}
