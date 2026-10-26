// 絵の選び方（js/pick.js）の確かめ: 点をでたらめにつけて何千回も遊び、決まりが守られているかを数える。
// node face-in-frame/tools/pick-check.mjs
import { PAINTINGS } from '../js/paintings.js';
import { pickRound, RETRY } from '../js/pick.js';

const strength = p => Object.values(p.goal || {}).reduce((s, v) => s + v, 0);
for (const n of [3, 5]) {
  let state = {}, prev = [];
  const bad = { 前回と重なる: 0, リベンジ以外で重なる: 0, リベンジ2回続け: 0, 同じ画家: 0, 最後がいちばん大きくない: 0, 数が足りない: 0 }, count = {};
  let retries = 0, lowRounds = 0;
  const R = 6000;
  for (let r = 0; r < R; r++) {
    const { list, state: next } = pickRound(PAINTINGS, n, state);
    if (r === 0 && list[0].p.id !== 'scream') console.log('はじめの1枚目が叫びでない');
    const ids = list.map(c => c.p.id);
    if (ids.length !== n || new Set(ids).size !== n) bad.数が足りない++;
    const again = list.filter(c => prev.includes(c.p.id));
    if (again.length) bad.前回と重なる++;
    if (again.some(c => !c.retry)) bad.リベンジ以外で重なる++;
    if (list.some(c => c.retry) && (state.scores || []).some(s => s.retry)) bad.リベンジ2回続け++;
    if (new Set(list.map(c => c.p.artist)).size !== n) bad.同じ画家++;
    const plain = list.filter(c => !c.retry && !(r === 0 && c.p.id === 'scream'));
    if (plain.length >= 2 && strength(list[n - 1].p) < Math.max(...plain.map(c => strength(c.p)))) bad.最後がいちばん大きくない++;
    if ((state.scores || []).some(s => s.score < RETRY)) lowRounds++;
    retries += list.some(c => c.retry);
    for (const id of ids) count[id] = (count[id] || 0) + 1;
    state = { ...next, scores: list.map(c => ({ id: c.p.id, score: Math.random() * 100 | 0, retry: c.retry })) };
    prev = ids;
  }
  const v = Object.values(count);
  console.log(`1回${n}枚・${R}回`, JSON.stringify(bad), `リベンジ ${retries}回（前回に${RETRY}点より下があった回 ${lowRounds}）`, `絵ごとに出た回数 ${Math.min(...v)}〜${Math.max(...v)}`);
}
