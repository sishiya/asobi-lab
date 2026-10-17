// 見た目: 図鑑の銅版画と標本室（museum）に、設定で選ぶ主人公（3D）と住人（2D）をのせる
// 言語（index.html の TX(日本語, 英語)。ノードでの試験のときは日本語）
const TX = globalThis.TX || ((ja) => ja);
import museum from './museum.js?v=69';
import { RESIDENTS } from './residents.js?v=69';
import { HEROES, HERO_LIST } from './heroes.js?v=69';

export { HERO_LIST };
export const RES_LIST = [{ id: 'kiwi', name: TX('キーウィ', 'Kiwi') }, { id: 'penguin', name: TX('ペンギン', 'Penguin') }, { id: 'snail', name: TX('カタツムリ', 'Snail') }];
let heroId = 'poly', resId = 'kiwi';
export function setHero(id) { if (HEROES[id]) heroId = id; }
export function setRes(id) { if (RESIDENTS[id]) resId = id; }

const composed = {};
export function look() {
  const res = RESIDENTS[resId];
  Object.assign(composed, museum, {
    id: 'museum-' + res.id,
    who: TX(res.who, res.en.who),
    goalName: TX(res.goalName, res.en.goalName),
    goalThing: res.goalThing,
    windowHint: TX(res.windowHint, res.en.windowHint), earlyMsg: TX(res.earlyMsg, res.en.earlyMsg), lateMsg: TX(res.lateMsg, res.en.lateMsg),
    drawTerrain: (g, L, S) => museum.drawTerrain(g, L, S, res),
    drawBackdrop: (g, L, S) => museum.drawBackdrop(g, L, S, res),
    drawWalker: res.drawWalker,
    drawFaint: res.drawFaint, // 気絶の絵（ない住人は sheet.js の faintFallback）
    drawStone: museum.drawStone,
    drawGoalJoy: res.drawGoalJoy,
    drawGoalReady: res.drawGoalReady,
    makeHero: HEROES[heroId],
  });
  return composed;
}
export const kindName = (kind) => TX(museum.kindNames[kind], museum.kindNamesEn[kind]);
export const kindColor = (kind) => museum.kindColors[kind];
