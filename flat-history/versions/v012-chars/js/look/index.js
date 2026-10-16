// 見た目: 図鑑の銅版画と標本室（museum）に、設定で選ぶ「主人公 × 住人」の組み合わせをのせる
import museum from './museum.js?v=13';
import { RESIDENTS } from './residents.js?v=13';
import { HEROES } from './heroes.js?v=13';

// 組み合わせ（設定画面の「登場する者」）
export const CHAR_SETS = [
  { id: 'poly-kiwi', name: '多面体の旅人 × キーウィ', hero: 'poly', res: 'kiwi' },
  { id: 'curator-flat', name: '学芸員 × サンカク（図形の住人）', hero: 'curator', res: 'flat' },
  { id: 'poly-flat', name: '多面体の旅人 × サンカク', hero: 'poly', res: 'flat' },
  { id: 'curator-kiwi', name: '学芸員 × キーウィ', hero: 'curator', res: 'kiwi' },
];
let set = CHAR_SETS[0];
export function setCharSet(id) { set = CHAR_SETS.find((c) => c.id === id) || CHAR_SETS[0]; }
export const charSet = () => set;

const composed = {};
export function look() {
  const res = RESIDENTS[set.res];
  Object.assign(composed, museum, {
    id: 'museum-' + res.id,
    who: res.who,
    goalName: res.goalName,
    drawTerrain: (g, L, S) => museum.drawTerrain(g, L, S, res),
    drawBackdrop: (g, L, S) => museum.drawBackdrop(g, L, S, res),
    drawWalker: res.drawWalker,
    drawGoalJoy: res.drawGoalJoy,
    makeHero: HEROES[set.hero],
  });
  return composed;
}
export const kindName = (kind) => museum.kindNames[kind];
export const kindColor = (kind) => museum.kindColors[kind];
