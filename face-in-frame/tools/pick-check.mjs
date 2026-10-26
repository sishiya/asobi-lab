// 絵の選び方（js/pick.js）の確かめ: 何千回も選んで、前回と重ならないか・どの絵も同じくらい出るかを数える。
// node face-in-frame/tools/pick-check.mjs
import { PAINTINGS } from '../js/paintings.js';
import { pickRound } from '../js/pick.js';

for (const n of [3, 5]) {
  let state = {}, prev = [], overlap = 0, short = 0;
  const count = {}, R = 6000;
  for (let r = 0; r < R; r++) {
    const { list, state: next } = pickRound(PAINTINGS, n, state);
    const ids = list.map(p => p.id);
    if (ids.length !== n || new Set(ids).size !== n) short++;
    if (ids.some(id => prev.includes(id))) overlap++;
    for (const id of ids) count[id] = (count[id] || 0) + 1;
    state = next; prev = ids;
  }
  const v = Object.values(count);
  console.log(`1回${n}枚・${R}回: 前回と重なる ${overlap}・数が足りない ${short}・絵ごとに出た回数 ${Math.min(...v)}〜${Math.max(...v)}`);
}
