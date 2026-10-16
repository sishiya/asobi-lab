// 見た目: 図鑑の銅版画と標本室（museum）に、設定で選ぶ主人公（3D）と住人（2D）をのせる
import museum from './museum.js?v=28';
import { RESIDENTS } from './residents.js?v=28';
import { HEROES, HERO_LIST } from './heroes.js?v=28';

export { HERO_LIST };
export const RES_LIST = [{ id: 'kiwi', name: 'キーウィ' }, { id: 'flat', name: 'サンカク（図形の住人）' }];
let heroId = 'poly', resId = 'kiwi';
export function setHero(id) { if (HEROES[id]) heroId = id; }
export function setRes(id) { if (RESIDENTS[id]) resId = id; }

const composed = {};
export function look() {
  const res = RESIDENTS[resId];
  Object.assign(composed, museum, {
    id: 'museum-' + res.id,
    who: res.who,
    goalName: res.goalName,
    goalThing: res.goalThing,
    windowHint: res.windowHint, earlyMsg: res.earlyMsg, lateMsg: res.lateMsg,
    drawTerrain: (g, L, S) => museum.drawTerrain(g, L, S, res),
    drawBackdrop: (g, L, S) => museum.drawBackdrop(g, L, S, res),
    drawWalker: res.drawWalker,
    drawGoalJoy: res.drawGoalJoy,
    drawGoalReady: res.drawGoalReady,
    makeHero: HEROES[heroId],
  });
  return composed;
}
export const kindName = (kind) => museum.kindNames[kind];
export const kindColor = (kind) => museum.kindColors[kind];
