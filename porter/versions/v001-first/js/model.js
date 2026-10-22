// 決まり（純粋。画面にさわらない。node からも読める）
// 体のようすは 0〜1 の数で持つが、画面には数で出さない（PLAN.md 柱2）

export const ITEMS = [
  { id: 'water',   name: '水袋',       w: 2,   uses: 3, tip: 'のどがかわいたら渡す。やけども冷やせる' },
  { id: 'honey',   name: 'はちみつ',   w: 0.5, uses: 2, tip: 'ふらついたら。魔法を使うと減る' },
  { id: 'food',    name: '干し肉と塩', w: 1,   uses: 1, tip: '夜ごはん。鍋があれば料理できる' },
  { id: 'socks',   name: '替えの靴下', w: 0.2, uses: 1, tip: '足がぬれたら、はきかえる' },
  { id: 'wood',    name: '薪',         w: 3,   uses: 3, tip: 'たき火の燃料。ないと夜に拾う' },
  { id: 'pot',     name: '鍋',         w: 2,   uses: 0, tip: '湯を沸かす・料理する' },
  { id: 'bandage', name: '包帯',       w: 0.3, uses: 2, tip: '靴ずれ・やけどの手当て' },
  { id: 'stone',   name: '砥石',       w: 1,   uses: 0, tip: '剣を研ぐ' },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const BAG_MAX = 7;      // これ以上は背負えない
export const BAG_EASY = 5;     // これをこえると歩くのが遅くなる
export const NIGHT_HOURS = 11; // 着くのがおそくなければ、夜はこれだけある

export const FOES = {
  wolf:   { name: '森オオカミ', hp: 85,  every: 2.0, tell: 0.55, dmg: 20, armor: 1.0,  armorSharp: 1.15, fire: 1.2 },
  lizard: { name: '岩トカゲ',   hp: 115, every: 2.6, tell: 0.75, dmg: 22, armor: 0.45, armorSharp: 0.95, fire: 1.5 },
  boss:   { name: '峠の主',     hp: 150, every: 2.3, tell: 0.62, dmg: 24, armor: 0.7,  armorSharp: 1.05, fire: 1.3 },
};

export const DAYS = [
  { from: '村', to: '森のはずれ', foe: 'wolf', sky: 'morning',
    routes: [
      { id: 'creek', name: '沢ぞいの近道', len: 1.0, creek: true, sun: 0.45, late: 0 },
      { id: 'ridge', name: '日なたの尾根道', len: 1.35, creek: false, sun: 1.1, late: 1.5 },
    ] },
  { from: '森のはずれ', to: '岩場', foe: 'lizard', sky: 'noon',
    routes: [
      { id: 'creek', name: '沢をこえる近道', len: 1.0, creek: true, sun: 0.5, late: 0 },
      { id: 'ridge', name: '岩の多い遠回り', len: 1.35, creek: false, sun: 1.1, late: 1.5 },
    ] },
  { from: '岩場', to: '峠', foe: 'boss', sky: 'evening',
    routes: [
      { id: 'creek', name: '雪どけの沢の近道', len: 1.0, creek: true, sun: 0.4, late: 0 },
      { id: 'ridge', name: '風の強い尾根道', len: 1.35, creek: false, sun: 1.0, late: 1.5 },
    ] },
];

export const HERO_NAME = 'アルノ';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function freshHero() {
  return {
    fatigue: 0, sleep: 7, blister: 0, wet: false, thirst: 0.1,
    gutPending: false, sick: false, burn: 0, sugar: 0.85, sharp: false,
    // それぞれの症状の「なぜ」。答え合わせの原因の鎖に使う
    why: { wet: [], blister: [], sleep: [], gut: [], thirst: [], burn: [], sugar: [] },
  };
}

export function newGame() {
  return {
    day: 0, hero: freshHero(),
    waterSafe: true,        // 水袋の中身（ゆうべ沸かしたか。1日目は村の井戸）
    dinner: 'cooked',
    bag: {}, uses: {},
    late: 0, rests: 0,
    walk: null, battle: null, camp: null,
    morning: null,          // その日の朝の写し（負けたらここからやり直す）
    tries: 0,
  };
}

export const clone = o => JSON.parse(JSON.stringify(o));

// ---------- 朝・したく ----------
export function bagWeight(st) {
  let w = 0;
  for (const id in st.bag) if (st.bag[id]) w += ITEM[id].w;
  return Math.round(w * 10) / 10;
}
export function canAdd(st, id) { return st.bag[id] || bagWeight(st) + ITEM[id].w <= BAG_MAX + 1e-6; }
export function toggleItem(st, id) {
  if (st.bag[id]) { st.bag[id] = false; return true; }
  if (!canAdd(st, id)) return false;
  st.bag[id] = true; return true;
}

export function startMorning(st) {
  st.morning = clone({ ...st, morning: null });
  const h = st.hero;
  h.fatigue = clamp((7 - h.sleep) * 0.07) + (h.sick ? 0.15 : 0);
  h.thirst = 0.1;
  h.sugar = st.dinner === 'cooked' ? 0.85 : st.dinner === 'raw' ? 0.6 : 0.35;
  h.why.sugar = st.dinner === 'cooked' ? [] : st.dinner === 'raw' ? ['夜ごはんが干し肉をかじっただけ'] : ['夜ごはんを食べていない'];
  h.why.thirst = [];
}

export function restoreMorning(st) {
  const m = st.morning;
  const tries = st.tries + 1;
  for (const k of Object.keys(st)) delete st[k];
  Object.assign(st, clone(m));
  st.morning = m;
  st.tries = tries;
}

// ---------- 道中 ----------
export function startWalk(st, routeId) {
  const day = DAYS[st.day];
  const route = day.routes.find(r => r.id === routeId);
  st.uses = {};
  for (const id in st.bag) if (st.bag[id]) st.uses[id] = ITEM[id].uses;
  const w = bagWeight(st);
  const loadLate = Math.round(Math.max(0, w - BAG_EASY) * 0.9 * 2) / 2; // 30分きざみ
  st.late = route.late + loadLate;
  st.lateWhy = [];
  if (route.late) st.lateWhy.push('遠回りした');
  if (loadLate > 0.05) st.lateWhy.push('荷物が重かった');
  st.walk = { route: route.id, len: route.len, pos: 0, creekDone: false, drankAt: false, socksAsk: false, said: {}, flags: {} };
  if (st.hero.wet) st.hero.why.wet = st.hero.why.wet.length ? st.hero.why.wet : ['ぬれた靴のまま朝になった'];
}

export function walkSpeed(st) {
  // 1 で 約22秒。重いと遅い（見た目の速さも同じ）
  const w = bagWeight(st);
  const slow = 1 + Math.max(0, w - BAG_EASY) * 0.12 + st.hero.blister * 0.25;
  return 1 / (22 * slow);
}

// dt 秒ぶん歩く。起きたこと（絵と音に使う）を返す
export function walkStep(st, dt) {
  const wk = st.walk, h = st.hero, day = DAYS[st.day];
  const route = day.routes.find(r => r.id === wk.route);
  const ev = [];
  const d = walkSpeed(st) * dt;        // 進んだ割合
  const dl = d * wk.len;               // 歩いた量（1 で ふつうの1日）
  wk.pos = Math.min(1, wk.pos + d);

  h.fatigue = clamp(h.fatigue + dl * 0.3);
  h.thirst = clamp(h.thirst + dl * 0.75 * route.sun * (h.sick ? 1.4 : 1));
  if (route.sun > 0.9 && h.thirst > 0.55 && !h.why.thirst.length)
    h.why.thirst.push(!st.bag.water ? '日なたの道で、水袋を持っていなかった' : st.uses.water ? '日なたの道で水を渡さなかった' : '日なたの道で、水が足りなくなった');
  if (h.sick && h.thirst > 0.55 && !h.why.thirst.includes('おなかをこわしていた')) h.why.thirst.push('おなかをこわしていた');
  h.sugar = clamp(h.sugar - dl * 0.22);
  if (h.wet) {
    h.blister = clamp(h.blister + dl * 0.85);
    if (h.blister > 0.2 && !h.why.blister.length) h.why.blister.push(...h.why.wet, 'ぬれた靴で歩きつづけた');
  }

  if (route.creek && !wk.creekDone && wk.pos >= 0.42) {
    wk.creekDone = true;
    ev.push('creek');
    if (!h.wet) { h.wet = true; h.why.wet = ['沢を渡って靴がぬれた']; }
    // 勇者のくせ: のどがかわいていると、沢の生水を飲む
    if (h.thirst > 0.2) {
      ev.push('drinkRaw');
      wk.drankAt = true;
      h.thirst = clamp(h.thirst - 0.5);
      h.gutPending = true;
      h.why.gut = ['のどがかわいた勇者が、沢の生水を飲んだ'];
    }
    if (st.uses.socks) wk.socksAsk = true;
  }
  if (h.thirst > 0.5 && !wk.said.thirst) { wk.said.thirst = true; ev.push('sayThirst'); }
  if (h.sugar < 0.25 && !wk.said.sugar) { wk.said.sugar = true; ev.push('saySugar'); }
  if (h.blister > 0.35 && !wk.said.blister) { wk.said.blister = true; ev.push('sayBlister'); }
  if (wk.pos >= 1) ev.push('arrive');
  return ev;
}

// 道中でお供ができること
export function walkAct(st, act) {
  const h = st.hero;
  if (act === 'water') {
    if (!st.uses.water) return null;
    st.uses.water--;
    h.thirst = clamp(h.thirst - 0.55);
    h.why.thirst = [];
    if (!st.waterSafe) { h.gutPending = true; h.why.gut = ['沸かしていない沢の水を水袋から飲ませた']; }
    return 'water';
  }
  if (act === 'honey') {
    if (!st.uses.honey) return null;
    st.uses.honey--;
    h.sugar = clamp(h.sugar + 0.5);
    h.why.sugar = [];
    return 'honey';
  }
  if (act === 'rest') {
    st.rests++;
    st.late += 1;
    if (!st.lateWhy.includes('道で休んだ')) st.lateWhy.push('道で休んだ');
    h.fatigue = clamp(h.fatigue - 0.25);
    h.thirst = clamp(h.thirst - 0.08);
    return 'rest';
  }
  if (act === 'socks') {
    if (!st.uses.socks || !h.wet) return null;
    st.uses.socks--;
    h.wet = false;
    st.walk.socksAsk = false;
    st.walk.flags.socks = true;
    return 'socks';
  }
  return null;
}

// ---------- 戦い ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function heroReaction(h) {
  return 0.27 + Math.max(0, 7 - h.sleep) * 0.12 + h.fatigue * 0.2 + (h.sugar < 0.2 ? 0.08 : 0);
}

export function startBattle(st) {
  const foe = FOES[DAYS[st.day].foe];
  const h = st.hero;
  if (h.gutPending && !h.sick) { /* 飲んだその日は、まだ平気 */ }
  st.battle = {
    t: 0, foeHp: foe.hp, heroHp: 100, next: 1.2, foeNext: 1.6, swing: 0, tell: -1,
    crouchAt: h.sick ? 5.5 : -1, crouch: 0, done: null, log: [], fx: [], rnd: rng(1000 + st.day * 77),
  };
}

function bLog(b, kind, extra = {}) { b.log.push({ t: b.t, kind, ...extra }); b.fx.push({ t: b.t, kind, ...extra }); }

export function battleStep(st, dt) {
  const b = st.battle, h = st.hero, foe = FOES[DAYS[st.day].foe];
  if (b.done) return;
  b.t += dt;

  // おなか: うずくまる
  if (b.crouchAt > 0 && b.t >= b.crouchAt) { b.crouchAt = -1; b.crouch = 2.6; bLog(b, 'crouch'); }
  if (b.crouch > 0) b.crouch -= dt;

  // 相手の攻め: ためて（tell）から当てる
  if (b.tell < 0 && b.t >= b.foeNext - foe.tell) { b.tell = b.foeNext; bLog(b, 'foeTell'); }
  if (b.tell > 0 && b.t >= b.tell) {
    b.tell = -1;
    b.foeNext = b.t + foe.every * (0.9 + b.rnd() * 0.2);
    const react = heroReaction(h) + (b.rnd() - 0.5) * 0.08;
    if (b.crouch <= 0 && react < foe.tell) bLog(b, 'dodge');
    else {
      b.heroHp -= foe.dmg * (b.crouch > 0 ? 1.2 : 1);
      bLog(b, b.crouch > 0 ? 'hitCrouch' : 'hitLate');
    }
  }

  // 勇者の攻め
  if (b.crouch <= 0 && b.t >= b.next) {
    b.swing++;
    b.next = b.t + 1.35 + h.fatigue * 0.4;
    if (b.swing % 3 === 0) {
      // 火の魔法（勇者のくせ: 手が赤くても使う）
      if (h.sugar >= 0.25) {
        const dmg = 20 * foe.fire;
        b.foeHp -= dmg;
        h.sugar = clamp(h.sugar - 0.3);
        h.burn = clamp(h.burn + 0.22);
        if (!h.why.burn.includes('火の魔法を使った')) h.why.burn.push('火の魔法を使った');
        bLog(b, 'fire', { dmg });
      } else {
        bLog(b, 'fizzle');
      }
    } else {
      const shortP = h.blister > 0.55 ? 1 : h.blister > 0.25 ? 0.5 : 0;
      if (b.rnd() < shortP) bLog(b, 'short');
      else {
        let dmg = 12 * (h.sharp ? foe.armorSharp : foe.armor);
        const weakThirst = h.thirst > 0.6, weakGrip = h.burn > 0.55;
        if (weakThirst) dmg *= 0.6;
        if (weakGrip) dmg *= 0.6;
        b.foeHp -= dmg;
        bLog(b, weakGrip ? 'grip' : weakThirst ? 'weak' : (h.sharp && foe.armor < 0.9 ? 'sharpHit' : 'hit'), { dmg });
      }
    }
  }

  if (b.foeHp <= 0) { b.done = 'win'; bLog(b, 'win'); }
  else if (b.heroHp <= 0) { b.done = 'lose'; bLog(b, 'lose'); }
  else if (b.t > 45) { b.done = 'lose'; bLog(b, 'timeout'); }
}

export function battleAct(st, act) {
  const b = st.battle, h = st.hero;
  if (!b || b.done) return null;
  if (act === 'honey' && st.uses.honey) { st.uses.honey--; h.sugar = clamp(h.sugar + 0.5); h.why.sugar = []; bLog(b, 'gotHoney'); return act; }
  if (act === 'water' && st.uses.water) { st.uses.water--; h.burn = clamp(h.burn - 0.4); bLog(b, 'gotWater'); return act; }
  if (act === 'retreat') { b.done = 'lose'; bLog(b, 'retreat'); return act; }
  return null;
}

// ---------- 答え合わせ ----------
// 戦いの記録から、目立ったことを原因の鎖にして返す（よかったこと・悪かったこと）
export function review(st) {
  const b = st.battle, h = st.hero;
  const n = k => b.log.filter(e => e.kind === k).length;
  const out = [];
  const lateChain = () => {
    const c = [`眠れたのは ${fmtH(h.sleep)}`];
    if (st.campWhy && st.campWhy.length) c.push(...st.campWhy);
    if (st.prevLateWhy && st.prevLateWhy.length) c.push('着くのがおそかった（' + st.prevLateWhy.join('・') + '）');
    return c;
  };
  if (n('short')) out.push({ bad: true, w: n('short') * 3, icon: 'foot', head: `剣がとどかなかった（${n('short')}回）`, chain: ['足の靴ずれで、ふみこみが浅い', ...uniq(h.why.blister)] });
  if (n('hitLate')) out.push({ bad: true, w: n('hitLate') * 3, icon: 'sleep', head: `よけるのがおそかった（${n('hitLate')}回）`, chain: h.sleep < 6 ? ['寝不足で反応がおそい', ...lateChain()] : ['つかれていた', '相手の動きが速い'] });
  if (n('crouch')) out.push({ bad: true, w: 6, icon: 'gut', head: 'おなかが痛くて、うずくまった', chain: ['おなかをこわしていた', ...uniq(h.why.gut)] });
  if (n('weak')) out.push({ bad: true, w: n('weak') * 2, icon: 'thirst', head: `一撃が軽かった（${n('weak')}回）`, chain: ['のどがかわいて力が出ない', ...uniq(h.why.thirst)] });
  if (n('fizzle')) out.push({ bad: true, w: n('fizzle') * 3, icon: 'sugar', head: `火の魔法が出なかった（${n('fizzle')}回）`, chain: ['魔力切れ（甘い物が足りない）', ...(h.why.sugar.length ? h.why.sugar : [!st.bag.honey ? 'はちみつを持っていなかった' : st.uses.honey ? 'はちみつを渡さなかった' : 'はちみつが足りなくなった'])] });
  if (n('grip')) out.push({ bad: true, w: n('grip') * 2, icon: 'burn', head: `剣をにぎる手が痛んだ（${n('grip')}回）`, chain: ['手のやけど', ...uniq(h.why.burn), st.bag.water && st.uses.water ? '水をかけなかった' : '冷やす水がなかった'] });
  if (n('dodge') >= 2 && h.sleep >= 6) out.push({ bad: false, w: n('dodge'), icon: 'sleep', head: `よけられた（${n('dodge')}回）`, chain: [`よく眠れていた（${fmtH(h.sleep)}）`] });
  if (n('fire')) out.push({ bad: false, w: n('fire') * 1.5, icon: 'fire', head: `火の魔法がきいた（${n('fire')}回）`, chain: ['甘い物が足りていた'] });
  if (n('sharpHit')) out.push({ bad: false, w: n('sharpHit') * 2, icon: 'sword', head: '刃がかたい皮を通った', chain: ['ゆうべ剣を研いだ'] });
  if (n('gotHoney')) out.push({ bad: false, w: 3, icon: 'sugar', head: 'はちみつで立ち直った', chain: ['お供が投げた'] });
  if (n('gotWater')) out.push({ bad: false, w: 2, icon: 'burn', head: '手を冷やせた', chain: ['お供が水をかけた'] });
  out.sort((a, b2) => (b2.bad - a.bad) || (b2.w - a.w));
  const bad = out.filter(o => o.bad).slice(0, 3), good = out.filter(o => !o.bad).slice(0, 2);
  return { win: b.done === 'win', items: [...bad, ...good] };
}
const uniq = a => [...new Set(a)];
export const fmtH = x => (Math.round(x * 2) / 2) + '時間';

// ---------- 野営 ----------
export const CAMP_ACTS = [
  { id: 'boil',    name: '湯を沸かす',     h: 1,   wood: 1, need: ['pot'],          tip: 'あしたの水袋が安全になる' },
  { id: 'cook',    name: '料理する',       h: 1.5, wood: 1, need: ['pot', 'food'],  tip: 'あしたの魔力が満ちる' },
  { id: 'chew',    name: '干し肉をかじらせる', h: 0, wood: 0, need: ['food'], noNeed: ['pot'], tip: '料理よりは足りない' },
  { id: 'dry',     name: '靴を乾かす',     h: 1,   wood: 1, need: [],               tip: 'ぬれた靴のままだと、あしたも靴ずれ' },
  { id: 'treat',   name: '手当てする',     h: 0.5, wood: 0, need: ['bandage'],      tip: '靴ずれ・やけどがよくなる' },
  { id: 'cool',    name: '手を水で冷やす', h: 0.5, wood: 0, need: ['water'],        tip: 'やけどが少しよくなる' },
  { id: 'sharpen', name: '剣を研ぐ',       h: 1,   wood: 0, need: ['stone'],        tip: 'かたい相手に刃が通る' },
  { id: 'gather',  name: '薪を拾う',       h: 1,   wood: -1, need: [],              tip: '暗い森で探す' },
];

export function startCamp(st) {
  st.prevLateWhy = st.lateWhy.slice();
  const hours = Math.max(4, NIGHT_HOURS - st.late - 0.5);
  st.camp = { hours, left: hours, wood: st.uses.wood || 0, done: {}, why: [] };
  st.dinner = 'none';
  st.waterBoiled = false;
  st.hero.sharp = false;
}

export function campCan(st, a) {
  const c = st.camp;
  if (a.id !== 'gather' && c.done[a.id]) return 'done';
  for (const n of a.need) if (n === 'water' ? !st.uses.water : !st.bag[n] || (ITEM[n].uses && !st.uses[n])) return 'need';
  for (const n of a.noNeed || []) if (st.bag[n]) return 'hide';
  if (a.id === 'dry' && !st.hero.wet) return 'hide';
  if ((a.id === 'treat' || a.id === 'cool') && st.hero.blister < 0.1 && st.hero.burn < 0.1) return 'hide';
  if (a.id === 'cool' && st.hero.burn < 0.1) return 'hide';
  if (a.id === 'chew' && c.done.cook) return 'hide';
  if (a.wood > 0 && c.wood < a.wood) return 'wood';
  if (c.left - a.h < 2) return 'time';
  return 'ok';
}

export function campAct(st, id) {
  const a = CAMP_ACTS.find(x => x.id === id), c = st.camp, h = st.hero;
  if (campCan(st, a) !== 'ok') return false;
  c.left -= a.h; c.wood -= a.wood;
  if (id !== 'gather') c.done[id] = true;
  if (a.h >= 1) c.why.push(a.name);
  if (id === 'boil') st.waterBoiled = true;
  if (id === 'cook') st.dinner = 'cooked';
  if (id === 'chew') st.dinner = 'raw';
  if (id === 'dry') { h.wet = false; h.why.wet = []; }
  if (id === 'treat') { st.uses.bandage--; h.blister = clamp(h.blister - 0.4); h.burn = clamp(h.burn - 0.45); if (h.burn < 0.3) h.why.burn = []; }
  if (id === 'cool') { st.uses.water--; h.burn = clamp(h.burn - 0.3); if (h.burn < 0.3) h.why.burn = []; }
  if (id === 'sharpen') h.sharp = true;
  return true;
}

// 寝かせる → 夜明け。次の日の朝の体を作る
export function endCamp(st) {
  const c = st.camp, h = st.hero;
  h.sleep = Math.max(1, c.left - 0.5);
  st.campWhy = c.why.length >= 3 || h.sleep < 6 ? ['野営で ' + c.why.join('・') + ' をした'] : [];
  if (h.sleep >= 6) h.why.sleep = [];
  if (h.wet && !h.why.wet.includes('靴を乾かさなかった')) h.why.wet.push('靴を乾かさなかった');
  h.blister = clamp(h.blister - 0.12);
  if (h.blister < 0.1) h.why.blister = [];
  h.burn = clamp(h.burn - 0.1);
  if (h.burn < 0.3) h.why.burn = [];
  h.sick = h.gutPending; h.gutPending = false;
  if (!h.sick) h.why.gut = [];
  st.waterSafe = st.waterBoiled;
  st.day++;
  st.bag = {}; st.uses = {}; st.rests = 0; st.tries = 0;
  st.walk = null; st.battle = null; st.camp = null;
}
