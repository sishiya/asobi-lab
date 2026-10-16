// 見た目の切りかえ。しくみ（level・sim）は同じで、絵と3Dの舞台だけがかわる
import lab from './lab.js';
import ant from './ant.js';
import museum from './museum.js';
import paper from './paper.js';

// 2026-10-16 ユーザーが案2（図鑑の銅版画）に決めた。ほかは見くらべ用に残す
export const LOOKS = [museum, ant, paper, lab];
let cur = museum;
try {
  const saved = localStorage.getItem('flat-history.look2');
  const f = LOOKS.find((l) => l.id === saved);
  if (f) cur = f;
} catch (e) { /* 保存できない環境 */ }

export const look = () => cur;
export function setLook(id) {
  cur = LOOKS.find((l) => l.id === id) || cur;
  try { localStorage.setItem('flat-history.look2', cur.id); } catch (e) { /* なし */ }
  return cur;
}
export const kindName = (kind) => cur.kindNames[kind];
export const kindColor = (kind) => cur.kindColors[kind];
