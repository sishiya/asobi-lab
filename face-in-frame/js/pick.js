// 1回分の絵の選び方（v014・v016）。画面にはふれない（tools/pick-check.mjs で回して確かめる）。
// 前回の絵とは重ならないようにして、あとは完全にランダム（ユーザー「前回３つが被らないようにさえしてくれればあとは完全ランダムでいい」。
// v014 のリベンジ枠・ならべ方・山・はじめての叫びはやめた）。絵が少なすぎて足りないときだけ、前回の絵からも選ぶ。
const shuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// state: { last: [id] }（前回の絵）。返り値: { list: [絵], state: 次の state }
export function pickRound(paintings, n, state = {}, rnd = Math.random) {
  const last = new Set(state.last || []);
  const fresh = shuffle(paintings.filter(p => !last.has(p.id)), rnd);
  const list = fresh.concat(shuffle(paintings.filter(p => last.has(p.id)), rnd)).slice(0, n);
  return { list, state: { last: list.map(p => p.id) } };
}
