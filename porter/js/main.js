// 画面のつなぎ: 場面（したく→分かれ道→道中→戦い→答え合わせ→野営）を回す
import * as M from './model.js?v=1';
import * as Art from './art.js?v=1';
import { sfx, setSound, soundOn, fireLoop } from './sound.js?v=1';

const VER = 'ver. 0.1（試作 v001）';
const $ = s => document.querySelector(s);
const cv = $('#view'), ctx = cv.getContext('2d');
const panel = $('#panel');
const Q = new URLSearchParams(location.search);

let st = null, phase = 'title';
let DPR = 1, Wpx = 0, Hpx = 0, S = 1, W = 0, H = 0, gy = 0;
const an = { t: 0, phase: 0, scroll: 0, says: [], words: [], fx: [], pose: {}, timer: 0, fxSeen: 0, panelKey: '' };
const guided = {};

// ---------- 大きさ ----------
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  Wpx = innerWidth; Hpx = innerHeight;
  cv.width = Math.round(Wpx * DPR); cv.height = Math.round(Hpx * DPR);
  S = Math.max(0.05, Math.min(Hpx / 560, Wpx / 500));
  W = Wpx / S; H = Hpx / S;
}
addEventListener('resize', resize);
resize();

function layoutGround() {
  const top = panel.hidden ? Hpx : panel.getBoundingClientRect().top;
  gy = Math.max(H * 0.42, Math.min(H * 0.8, top / S - 26));
}

// ---------- 勇者の見た目（数でなく体で見せる） ----------
const look = h => ({ sick: h.sick, thirst: h.thirst, sleepy: h.sleep < 6, burn: h.burn, shaky: h.sugar < 0.25, limp: h.blister > 0.3, tired: h.fatigue > 0.6 });

function say(who, text, dur = 2.6) { an.says = an.says.filter(s => s.who !== who); an.says.push({ who, text, t0: an.t, dur }); sfx.say(); }
function word(x, y, text, color = '#2b2118') { an.words.push({ x, y, text, color, t0: an.t }); }
function puff(kind, x, y, dur = 0.6) { an.fx.push({ kind, x, y, t0: an.t, dur }); }

function guide(key, text) {
  const g = $('#guide');
  if (!text || (st && st.day > 0) || guided[key]) { g.hidden = true; return; }
  g.textContent = text; g.hidden = false;
}

function dayTag() {
  const d = M.DAYS[st.day];
  $('#dayTag').hidden = false;
  $('#dayNo').textContent = `${st.day + 1}日目`;
  $('#dayPlace').textContent = `${d.from} → ${d.to}`;
}

// 小さな絵のボタン用
function miniCanvas(draw, w = 48, h = 40) {
  const c = document.createElement('canvas');
  c.width = w * DPR; c.height = h * DPR;
  const g = c.getContext('2d'); g.scale(DPR, DPR);
  const keep = Art.A.S; Art.A.S = DPR;
  draw(g, w, h);
  Art.A.S = keep;
  return c;
}
const itemIcon = (id, w = 48, h = 40) => miniCanvas((g) => Art.item(g, id, w / 2, h / 2 + 2, Math.min(w, h) / 46), w, h);

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function setPanel(...nodes) { panel.innerHTML = ''; nodes.forEach(n => panel.appendChild(n)); panel.hidden = !nodes.length; }

// ---------- タイトル ----------
function goTitle() {
  phase = 'title';
  setPanel(); $('#dayTag').hidden = true; $('#guide').hidden = true;
  $('#titleOv').hidden = false;
  $('#verTxt').textContent = VER;
  $('#btnCont').hidden = !loadSave();
}
$('#btnNew').onclick = () => { sfx.page(); st = M.newGame(); st.memo = {}; $('#titleOv').hidden = true; goPack(); };
$('#btnCont').onclick = () => { const s = loadSave(); if (!s) return; sfx.page(); st = s; $('#titleOv').hidden = true; goPack(); };

function save() { try { localStorage.setItem('porter.save', JSON.stringify(st.morning)); } catch {} }
function loadSave() { try { const s = JSON.parse(localStorage.getItem('porter.save')); return s && s.hero ? s : null; } catch { return null; } }
function clearSave() { try { localStorage.removeItem('porter.save'); } catch {} }

// ---------- 朝・したく ----------
function goPack() {
  phase = 'pack';
  M.startMorning(st);
  if (!st.memo) st.memo = {};
  save();
  dayTag();
  an.says = []; an.words = []; an.fx = [];
  const h = st.hero;
  if (st.day > 0) {
    if (h.sick) say('hero', 'おなかが、ぐるぐるする…', 4);
    else if (h.wet) say('hero', '靴がまだ、しめってる', 4);
    else if (h.sleep < 5) say('hero', 'ふぁ…ねむい', 4);
    else if (h.burn > 0.45) say('hero', '手がひりひりする', 4);
  } else say('hero', '荷物持ちがほしかったんだ。たのむよ', 4);
  guide('pack', '勇者の荷物を詰めよう。重いほど、歩くのがおそくなる');
  buildPack();
}

function buildPack() {
  const wrap = el('div', 'packwrap');
  const w = M.bagWeight(st);
  const weigh = el('div', 'weigh');
  weigh.innerHTML = `<b style="font-size:14px;white-space:nowrap">背負い袋</b><div class="meter"><i class="${w > M.BAG_EASY ? 'heavy' : ''}" style="width:${w / M.BAG_MAX * 100}%"></i><b class="mark" style="left:${M.BAG_EASY / M.BAG_MAX * 100}%"><span>ここから重い</span></b></div><span class="kg">${w} / ${M.BAG_MAX} kg</span>`;
  const items = el('div', 'items');
  const tip = el('p', 'tipline');
  const waterNote = st.day === 0 ? '水袋は村の井戸の水' : st.waterSafe ? '水袋は、ゆうべ沸かした水' : '水袋は、沢でくんだ水（沸かしていない）';
  tip.textContent = waterNote;
  for (const it of M.ITEMS) {
    const b = el('button', 'it' + (st.bag[it.id] ? ' in' : ''));
    b.appendChild(itemIcon(it.id));
    b.appendChild(el('b', null, it.name));
    b.appendChild(el('small', null, it.w + 'kg'));
    b.setAttribute('aria-pressed', st.bag[it.id] ? 'true' : 'false');
    b.title = it.tip;
    b.onmouseenter = b.onfocus = () => { tip.textContent = it.tip; };
    b.onmouseleave = b.onblur = () => { tip.textContent = waterNote; };
    b.onclick = () => {
      const was = st.bag[it.id];
      if (!M.toggleItem(st, it.id)) { sfx.no(); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); tip.textContent = 'これ以上は背負えない'; return; }
      was ? sfx.unpack() : sfx.pack();
      buildPack();
      panel.querySelector('.tipline').textContent = it.tip;
    };
    items.appendChild(b);
  }
  wrap.append(weigh, items, tip);
  const go = el('button', 'btn go', '出発する');
  go.onclick = () => { sfx.tap(); guided.pack = true; goFork(); };
  setPanel(wrap, go);
}

// ---------- 分かれ道 ----------
function goFork() {
  phase = 'fork';
  guide('fork', 'どちらの道を行く？');
  const d = M.DAYS[st.day];
  const box = el('div', 'fork');
  d.routes.forEach((r, i) => {
    const b = el('button', 'sign' + (i === 0 ? ' l' : ''));
    b.innerHTML = `${r.name}<small>${r.creek ? '近い・沢を渡る' : '遠い・日なた'}</small>`;
    b.onclick = () => { sfx.tap(); guided.fork = true; goWalk(r.id); };
    box.appendChild(b);
  });
  setPanel(box);
}

// ---------- 道中 ----------
function goWalk(routeId) {
  phase = 'walk';
  M.startWalk(st, routeId);
  dayTag();
  an.scroll = 0; an.says = [];
  guide('walk', '勇者の顔と足どりを見て、渡すものを選ぼう');
  an.panelKey = '';
  buildWalkPanel();
}

function walkKey() { const u = st.uses; return [u.water, u.honey, u.socks, st.hero.wet, st.rests].join(','); }
function buildWalkPanel() {
  an.panelKey = walkKey();
  const u = st.uses, row = el('div', 'row');
  const mk = (id, label, icon, n, act) => {
    const b = el('button', 'btn act');
    if (icon) b.appendChild(itemIcon(icon, 40, 40));
    b.appendChild(el('span', null, label));
    if (n != null) b.appendChild(el('span', 'dots', '●'.repeat(n) + '○'.repeat(Math.max(0, (M.ITEM[icon]?.uses || 0) - n))));
    b.disabled = n === 0;
    b.onclick = act;
    row.appendChild(b);
  };
  mk('rest', '休む', 'rest', null, () => { M.walkAct(st, 'rest'); sfx.tap(); an.rest = an.t; say('hero', 'ふう、ひと息', 2); buildWalkPanel(); });
  if (st.bag.water) mk('water', '水を渡す', 'water', u.water, () => { if (M.walkAct(st, 'water')) { sfx.gulp(); say('hero', st.waterSafe ? 'たすかる！' : 'ん、ちょっと泥くさい', 2); st.memo.water = true; } buildWalkPanel(); });
  if (st.bag.honey) mk('honey', 'はちみつ', 'honey', u.honey, () => { if (M.walkAct(st, 'honey')) { sfx.honey(); say('hero', 'あまい！', 2); st.memo.honey = true; } buildWalkPanel(); });
  if (st.hero.wet && st.bag.socks && u.socks) mk('socks', '靴下をかえる', 'socks', u.socks, () => { if (M.walkAct(st, 'socks')) { sfx.pack(); say('hero', 'かわいた靴下だ', 2); st.memo.socks = true; } buildWalkPanel(); });
  setPanel(row);
}

const WALK_LEN = 2600;
function stepWalk(dt) {
  if (an.rest && an.t - an.rest < 1.2) return; // 休んでいるあいだは止まる
  const ev = M.walkStep(st, dt);
  const prevPhase = an.phase;
  an.phase += dt * 6.5 * (M.walkSpeed(st) * 22);
  if (Math.floor(prevPhase / Math.PI) !== Math.floor(an.phase / Math.PI)) sfx.step();
  an.scroll = st.walk.pos * WALK_LEN * st.walk.len;
  const hx = W * 0.56;
  for (const e of ev) {
    if (e === 'creek') { sfx.splash(); puff('splash', hx, gy, 0.7); }
    if (e === 'drinkRaw') { an.drink = an.t; setTimeout(() => sfx.gulp(), 300); say('hero', 'ぷはー、うまい水だ！', 2.6); setTimeout(() => say('porter', 'あっ、生水…', 2.4), 900); }
    if (e === 'sayThirst') say('hero', 'のど、かわいたな…');
    if (e === 'saySugar') say('hero', 'なんだか、ふらふらする');
    if (e === 'sayBlister') say('hero', 'いてて、足が…');
    if (e === 'arrive') { goMeet(); return; }
  }
  if (walkKey() !== an.panelKey) buildWalkPanel();
}

// ---------- 戦い ----------
function goMeet() {
  phase = 'meet'; an.timer = 0;
  setPanel();
  $('#guide').hidden = true;
  const f = M.FOES[M.DAYS[st.day].foe];
  say('hero', `${f.name}だ！ さがってて`, 2.2);
  sfx.tell();
}

function goBattle() {
  phase = 'battle';
  M.startBattle(st);
  an.fxSeen = 0; an.pose = {}; an.timer = 0;
  guide('battle', '戦うのは勇者。あなたは見守るだけ');
  buildBattlePanel();
}
function battleKey() { return [st.uses.water, st.uses.honey].join(','); }
function buildBattlePanel() {
  an.panelKey = battleKey();
  const row = el('div', 'row');
  const mk = (label, icon, n, act, go) => {
    const b = el('button', 'btn act' + (go ? ' go' : ''));
    if (icon) b.appendChild(itemIcon(icon, 40, 40));
    b.appendChild(el('span', null, label));
    if (n != null) b.appendChild(el('span', 'dots', '●'.repeat(n)));
    b.disabled = n === 0;
    b.onclick = act; row.appendChild(b);
  };
  if (st.bag.honey) mk('はちみつを投げる', 'honey', st.uses.honey, () => { if (M.battleAct(st, 'honey')) { sfx.honey(); st.memo.honey = true; } buildBattlePanel(); });
  if (st.bag.water) mk('水をかける', 'water', st.uses.water, () => { if (M.battleAct(st, 'water')) { sfx.splash(); st.memo.cool = true; } buildBattlePanel(); });
  mk('退けー！', null, null, () => { M.battleAct(st, 'retreat'); sfx.no(); });
  setPanel(row);
}

const WORDS = {
  short: ['とどかない', '#8a5a32'], hitLate: ['おそい！', '#c8443a'], hitCrouch: ['うっ', '#c8443a'], dodge: ['ひょい', '#3f6f8f'],
  fire: ['ゴォッ', '#e5532f'], fizzle: ['ぷすっ…', '#6f5f4c'], crouch: ['おなかが…', '#7d8f3a'], weak: ['かるい', '#6f5f4c'],
  grip: ['いたっ', '#c8443a'], sharpHit: ['スパッ', '#3f6f8f'], hit: ['えいっ', '#2b2118'], gotHoney: ['あまい！', '#c98a1e'], gotWater: ['ひんやり', '#3f8fb8'],
};
function stepBattle(dt) {
  const b = st.battle;
  if (!b.done) M.battleStep(st, dt);
  const [hx, fxp] = battleX();
  while (an.fxSeen < b.fx.length) {
    const e = b.fx[an.fxSeen++];
    const w = WORDS[e.kind];
    if (w) word(['dodge', 'hitLate', 'hitCrouch', 'crouch', 'fizzle', 'gotHoney', 'gotWater', 'grip'].includes(e.kind) ? hx : fxp - 30, gy - 190, w[0], w[1]);
    switch (e.kind) {
      case 'foeTell': sfx.tell(); break;
      case 'hit': case 'weak': case 'grip': case 'sharpHit': an.pose.lunge = an.t; an.pose.short = false; an.pose.foeHurt = an.t; sfx.hit(); puff('star', fxp - 40, gy - 70, 0.5); break;
      case 'short': an.pose.lunge = an.t; an.pose.short = true; sfx.whiff(); puff('dust', hx + 70, gy, 0.6); break;
      case 'fire': an.pose.cast = an.t; an.pose.foeHurt = an.t; sfx.fire(); puff('fire', fxp - 20, gy - 60, 0.7); break;
      case 'fizzle': an.pose.cast = an.t; sfx.fizzle(); puff('smoke', hx + 40, gy - 110, 0.8); break;
      case 'dodge': an.pose.dodge = an.t; an.pose.foeAtk = an.t; sfx.dodge(); break;
      case 'hitLate': case 'hitCrouch': an.pose.hurt = an.t; an.pose.foeAtk = an.t; sfx.thud(); puff('star', hx + 10, gy - 110, 0.5); break;
      case 'crouch': puff('swirl', hx + 20, gy - 60, 2.4); break;
      case 'gotHoney': puff('star', hx, gy - 150, 0.5); break;
      case 'gotWater': puff('splash', hx + 10, gy - 70, 0.6); break;
      case 'win': setTimeout(() => sfx.win(), 300); break;
      case 'lose': case 'timeout': case 'retreat': setTimeout(() => sfx.lose(), 300); break;
    }
  }
  if (!b.done && battleKey() !== an.panelKey) buildBattlePanel();
  if (b.done) { an.timer += dt; if (b.done && panel.childElementCount) setPanel(); if (an.timer > 1.6) goReview(); }
}

// ---------- 答え合わせ ----------
function goReview() {
  phase = 'review';
  $('#guide').hidden = true;
  const r = M.review(st);
  const box = $('#reviewBox');
  box.innerHTML = '';
  const last = st.day === M.DAYS.length - 1;
  box.appendChild(el('h2', null, r.win ? (last ? '峠の主をたおした！' : '勝った！') : st.battle.log.some(e => e.kind === 'retreat') ? '退いた…' : st.battle.log.some(e => e.kind === 'timeout') ? 'たおしきれず、日が暮れた…' : '勇者がたおれた…'));
  box.appendChild(el('p', 'note', r.win ? 'なぜ、そうなったか' : '負けても大丈夫。この日の朝にもどって、準備を変えて確かめよう'));
  const ul = el('ul', 'rv');
  if (!r.items.length) ul.appendChild(el('li', 'good', '<span></span><b>とくに問題なし</b><span class="chain">準備がよかった</span>'));
  for (const it of r.items) {
    const li = el('li', it.bad ? 'bad' : 'good');
    li.appendChild(miniCanvas(g => Art.icon(g, it.icon, 20, 20, 1), 40, 40));
    li.appendChild(el('b', null, `<span class="mk">${it.bad ? '×' : '○'}</span>${it.head}`));
    li.appendChild(el('div', 'chain', it.chain.map(c => `<span>${c}</span>`).join('<br>')));
    ul.appendChild(li);
  }
  box.appendChild(ul);
  const b = el('button', 'btn go');
  if (r.win) {
    b.textContent = last ? '峠の向こうへ' : '野営へ';
    b.onclick = () => { sfx.page(); $('#reviewOv').hidden = true; last ? goEnd() : goCamp(); };
  } else {
    b.textContent = 'この日の朝からやりなおす';
    b.onclick = () => { sfx.page(); $('#reviewOv').hidden = true; M.restoreMorning(st); goPack(); };
  }
  box.appendChild(b);
  $('#reviewOv').hidden = false;
}

// ---------- 野営 ----------
const JOB_ICON = { boil: 'pot', cook: 'food', chew: 'food', dry: 'socks', treat: 'bandage', cool: 'water', sharpen: 'stone', gather: 'wood' };
const NEED_TXT = { pot: '鍋がない', food: '干し肉がない', bandage: '包帯がない', water: '水がない', stone: '砥石がない' };
function goCamp() {
  phase = 'camp';
  M.startCamp(st);
  an.says = []; an.fx = [];
  guide('camp', 'たき火の仕事をするほど、勇者の眠る時間がへる');
  fireLoop(true);
  buildCampPanel();
}
function buildCampPanel() {
  const c = st.camp;
  const wrap = el('div', 'campwrap');
  const info = el('div', 'night');
  info.innerHTML = `夜明けまで <b>${c.left}時間</b> ・ 薪 <b>${c.wood}</b>`;
  const jobs = el('div', 'jobs');
  for (const a of M.CAMP_ACTS) {
    const can = M.campCan(st, a);
    if (can === 'hide') continue;
    const b = el('button', 'job' + (can === 'done' ? ' done' : ''));
    b.appendChild(itemIcon(JOB_ICON[a.id], 36, 32));
    b.appendChild(el('b', null, a.name));
    let sub = (a.wood > 0 ? `薪${a.wood}・` : '') + (a.h ? `${a.h}時間` : 'すぐ');
    if (can === 'done') sub = 'すんだ';
    else if (can === 'need') sub = NEED_TXT[a.need.find(n => n === 'water' ? !st.uses.water : !st.bag[n] || (M.ITEM[n].uses && !st.uses[n]))] || 'できない';
    else if (can === 'wood') sub = '薪が足りない';
    else if (can === 'time') sub = '時間が足りない';
    b.appendChild(el('small', null, sub));
    b.title = a.tip;
    b.disabled = can !== 'ok';
    b.onclick = () => {
      if (!M.campAct(st, a.id)) { sfx.no(); return; }
      st.memo[a.id] = true;
      ({ boil: sfx.splash, cook: sfx.pack, chew: sfx.tap, dry: sfx.pack, treat: sfx.pack, cool: sfx.splash, sharpen: sfx.hit, gather: sfx.unpack }[a.id] || sfx.tap)();
      const line = { boil: '湯が沸いた', cook: 'うまい！', chew: 'かたい…', dry: '靴があったかい', treat: 'しみる…', cool: 'ひんやり', sharpen: 'いい刃だ', gather: '' }[a.id];
      if (line) say('hero', line, 2);
      buildCampPanel();
    };
    jobs.appendChild(b);
  }
  wrap.append(jobs);
  const right = el('div', 'row');
  right.style.flexDirection = 'column'; right.style.alignItems = 'center'; right.style.gap = '6px';
  right.appendChild(info);
  const go = el('button', 'btn go', `寝かせる<br><small style="font-weight:500;font-size:13px">${Math.max(1, c.left - 0.5)}時間 眠れる</small>`);
  go.onclick = () => { sfx.page(); guided.camp = true; fireLoop(false); M.endCamp(st); goPack(); };
  right.appendChild(go);
  setPanel(wrap, right);
}

// ---------- 終わり ----------
function goEnd() {
  phase = 'end';
  clearSave();
  setPanel(); $('#guide').hidden = true;
  const box = $('#endBox');
  box.innerHTML = `<h2>勇者${M.HERO_NAME}の歌</h2>
    <p class="song">森のオオカミ　ひと太刀で<br>岩のトカゲも　火にまかれ<br>峠の主を　たおしたは<br>ただひとり　勇者${M.HERO_NAME}</p>`;
  const b = el('button', 'btn go', 'つぎのページ');
  b.onclick = () => { sfx.page(); diary(); };
  box.appendChild(b);
  $('#endOv').hidden = false;
}
function diary() {
  const m = st.memo || {};
  const lines = ['峠をこえた。歌になるらしい。', 'でも、ほんとうのことを書いておく。'];
  if (m.boil) lines.push('水は、いつもゆうべ沸かしたものだった。');
  if (m.dry || m.socks) lines.push('靴は、毎晩たき火のそばに並んでいた。');
  if (m.honey) lines.push('ふらふらになると、はちみつが飛んできた。');
  if (m.cook) lines.push('夜は、あたたかいものを食べた。');
  if (m.treat || m.cool) lines.push('手のやけどには、いつのまにか包帯が巻いてあった。');
  if (m.sharpen) lines.push('剣は、朝になると研がれていた。');
  if (lines.length === 2) lines.push('荷物は、いつも背中のうしろにあった。');
  lines.push('あの荷物持ちの名前を、とうとう聞きそびれた。');
  const box = $('#endBox');
  box.innerHTML = `<p style="text-align:center;font-family:var(--f);font-size:13px;color:var(--muted);margin:0">勇者${M.HERO_NAME}の日記・最後のページ</p><p>${lines.join('<br>')}</p>`;
  const b = el('button', 'btn go', 'もう一度、旅に出る');
  b.onclick = () => { sfx.page(); $('#endOv').hidden = true; goTitle(); };
  box.appendChild(b);
}

// ---------- 描く ----------
function drawScene() {
  ctx.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
  Art.A.S = DPR * S;
  const day = st ? st.day : 0;
  const d = M.DAYS[Math.min(day, 2)];
  const h = st ? st.hero : M.freshHero();
  if (phase === 'camp') return drawCamp(h);
  const skyKind = phase === 'title' ? 'morning' : phase === 'pack' ? 'morning' : phase === 'end' ? 'evening' : d.sky;
  let creekX = null;
  if (phase === 'walk' && st.walk.route === 'creek') {
    const cw = 0.42 * WALK_LEN * st.walk.len;
    creekX = W * 0.56 + 10 + (cw - an.scroll);
    if (creekX < -150 || creekX > W + 150) creekX = null;
  }
  const scroll = phase === 'title' ? an.t * 40 : an.scroll;
  Art.landscape(ctx, W, H, gy, scroll, day, skyKind, { creekX });

  const lk = look(h);
  if (phase === 'title' || phase === 'walk') {
    const walking = phase === 'title' || !(an.rest && an.t - an.rest < 1.2);
    const ph = phase === 'title' ? an.t * 6.5 : an.phase;
    const drinking = an.drink && an.t - an.drink < 1.4;
    Art.porter(ctx, W * 0.56 - 84, gy, { phase: ph + 1.2, act: walking ? 'walk' : 'idle', load: st ? M.bagWeight(st) : 4, bag: st ? st.bag : { pot: 1, wood: 1, water: 1 } });
    Art.hero(ctx, W * 0.56, gy, { phase: ph, act: walking && !drinking ? 'walk' : 'idle', look: phase === 'title' ? {} : lk, crouch: drinking ? 0.7 : 0 });
  } else if (phase === 'pack' || phase === 'fork') {
    Art.porter(ctx, W * 0.5 - 60, gy, { act: 'idle', load: M.bagWeight(st), bag: st.bag });
    Art.hero(ctx, W * 0.5 + 40, gy, { act: 'idle', look: lk, face: -1 });
  } else if (phase === 'meet' || phase === 'battle' || phase === 'review') {
    drawBattle(h, lk);
  } else if (phase === 'end') {
    Art.porter(ctx, W * 0.42, gy, { act: 'idle', load: 3, bag: { pot: 1 } });
    Art.hero(ctx, W * 0.55, gy, { act: 'idle', look: {}, face: -1 });
  }
  drawSays(lk);
  drawWords();
  drawFx();
}

// 戦いの立ち位置（せまい画面では相手を右へ）
const battleX = () => W < 640 ? [W * 0.34, W * 0.8] : [W * 0.4, W * 0.7];
function drawBattle(h, lk) {
  const b = st.battle;
  const foeKind = M.DAYS[st.day].foe, foe = M.FOES[foeKind];
  const [hx, fx0] = battleX();
  let fx = fx0;
  if (phase === 'meet') fx = fx0 + Math.max(0, 1 - an.timer / 1.2) * W * 0.4;
  Art.porter(ctx, W * 0.16, gy, { act: 'hide', load: M.bagWeight(st), bag: st.bag });
  ctx.save(); Art.shadow(ctx, 1); Art.rock(ctx, W * 0.16 + 26, gy + 6, 34, '#8f8574'); ctx.restore();
  const P = an.pose, t = an.t;
  const k = (t0, d) => t0 != null && t - t0 < d ? (t - t0) / d : -1;
  const lungeK = k(P.lunge, 0.45), castK = k(P.cast, 0.6), hurtK = k(P.hurt, 0.4), dodgeK = k(P.dodge, 0.4);
  const lunge = lungeK >= 0 ? Math.sin(lungeK * Math.PI) * (P.short ? 0.6 : 1.4) : 0;
  const crouch = b && b.crouch > 0 ? 1 : 0;
  Art.hero(ctx, hx - (dodgeK >= 0 ? Math.sin(dodgeK * Math.PI) * 40 : 0), gy, {
    act: 'idle', stance: true, look: lk, lunge, cast: castK >= 0 ? Math.sin(castK * Math.PI) : 0,
    hurt: hurtK >= 0 ? Math.sin(hurtK * Math.PI) : 0, crouch: crouch ? 0.8 : 0, sharp: h.sharp,
  });
  let tell = 0;
  if (b && b.tell > 0) tell = Math.min(1, 1 - (b.tell - b.t) / foe.tell);
  const atkK = k(P.foeAtk, 0.4), fh = k(P.foeHurt, 0.35);
  const down = b && b.done === 'win' ? Math.min(1, an.timer / 1.2) : 0;
  Art.foe(ctx, foeKind, fx, gy, { tell, atk: atkK >= 0 ? Math.sin(atkK * Math.PI) : 0, hurt: fh >= 0 ? Math.sin(fh * Math.PI) : 0, down });
  // 体力（戦いの中だけ。体のようすではない）
  if (b) {
    ctx.save(); Art.noShadow(ctx);
    const bar = (x, v, c) => { ctx.fillStyle = 'rgba(43,33,24,0.25)'; ctx.fillRect(x - 40, gy + 22, 80, 7); ctx.fillStyle = c; ctx.fillRect(x - 40, gy + 22, 80 * Math.max(0, v), 7); };
    bar(hx, b.heroHp / 100, '#3f6f8f'); bar(fx, b.foeHp / foe.hp, '#c8443a');
    ctx.restore();
  }
}

function drawCamp(h) {
  const c = st.camp;
  const prog = c ? 1 - c.left / c.hours : 0;
  const mx = W * (0.15 + prog * 0.7), my = gy - 240 - Math.sin(prog * Math.PI) * 60;
  Art.landscape(ctx, W, H, gy, 0, st.day, 'night', { onSky: () => { Art.stars(ctx, W, H); Art.moon(ctx, mx, Math.max(40, my), 22); } });
  const fx = W * 0.5;
  const strength = c && c.wood > 0 ? 1 : 0.55;
  Art.campfire(ctx, fx, gy + 10, strength, an.t);
  if (st.bag.pot) { ctx.save(); Art.shadow(ctx, 0.6); Art.item(ctx, 'pot', fx, gy - 52, 1.1); ctx.restore(); }
  if (c && c.done.dry) { ctx.save(); Art.shadow(ctx, 0.5); ctx.fillStyle = '#6b4428'; ctx.beginPath(); ctx.roundRect(fx + 50, gy + 4, 22, 12, 4); ctx.roundRect(fx + 76, gy + 6, 22, 12, 4); ctx.fill(); ctx.restore(); }
  const lk = look(h);
  Art.hero(ctx, fx - 120, gy, { act: 'sit', look: lk });
  Art.porter(ctx, fx + 120, gy, { act: 'hide', load: 0, bag: {}, face: -1 });
  drawSays(lk);
  drawFx();
}

function drawSays() {
  ctx.save();
  for (const s of an.says) {
    const age = an.t - s.t0; if (age > s.dur) continue;
    const a = Math.min(1, age * 6, (s.dur - age) * 3);
    let x, y;
    if (phase === 'camp') { x = s.who === 'hero' ? W * 0.5 - 110 : W * 0.5 + 120; y = gy - 130; }
    else if (phase === 'pack' || phase === 'fork') { x = s.who === 'hero' ? W * 0.5 + 40 : W * 0.5 - 60; y = gy - 175; }
    else if (phase === 'meet' || phase === 'battle') { x = s.who === 'hero' ? battleX()[0] : W * 0.16; y = gy - 180; }
    else { x = s.who === 'hero' ? W * 0.56 + 30 : W * 0.56 - 150; y = s.who === 'hero' ? gy - 178 : gy - 132; }
    x = Math.max(110, Math.min(W - 110, x));
    Art.bubble(ctx, x, y, s.text, a);
  }
  an.says = an.says.filter(s => an.t - s.t0 < s.dur);
  ctx.restore();
}
function drawWords() {
  ctx.save(); Art.noShadow(ctx);
  ctx.font = '900 22px "Zen Maru Gothic", sans-serif'; ctx.textAlign = 'center';
  for (const w of an.words) {
    const age = an.t - w.t0; if (age > 1) continue;
    ctx.globalAlpha = Math.min(1, (1 - age) * 2);
    ctx.lineWidth = 5; ctx.strokeStyle = '#fbf4e6'; ctx.strokeText(w.text, w.x, w.y - age * 26);
    ctx.fillStyle = w.color; ctx.fillText(w.text, w.x, w.y - age * 26);
  }
  an.words = an.words.filter(w => an.t - w.t0 < 1);
  ctx.restore();
}
function drawFx() {
  for (const f of an.fx) { const k = (an.t - f.t0) / f.dur; if (k >= 0 && k < 1) Art.fx(ctx, f.kind, f.x, f.y, k); }
  an.fx = an.fx.filter(f => an.t - f.t0 < f.dur);
}

function drawPortrait() {
  if (!st || phase === 'title' || phase === 'end') return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  Art.A.S = DPR;
  const r = Wpx < 700 ? 46 : 66;
  Art.portrait(ctx, 16 + r + 6, 14 + r + 6, r, st.hero, an.t);
}

// ---------- まわす ----------
let last = performance.now();
function update(dt) {
  an.t += dt; Art.A.t = an.t;
  if (phase === 'walk') stepWalk(dt);
  else if (phase === 'meet') { an.timer += dt; if (an.timer > 1.4) goBattle(); }
  else if (phase === 'battle') stepBattle(dt);
}
function render() {
  layoutGround();
  if (!(isFinite(W) && isFinite(H) && isFinite(gy)) || W <= 0 || H <= 0) return;
  drawScene();
  drawPortrait();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  Art.drawGrain(ctx, cv.width, cv.height);
}
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (innerWidth !== Wpx || innerHeight !== Hpx) resize();
  if (!document.hidden && Wpx > 0 && Hpx > 0) { update(dt); render(); }
  requestAnimationFrame(frame);
}

// 音のボタン
const sb = $('#btnSound');
const syncSound = () => { sb.setAttribute('aria-pressed', soundOn() ? 'true' : 'false'); sb.textContent = soundOn() ? '音 オン' : '音 オフ'; };
sb.onclick = () => { setSound(!soundOn()); syncSound(); if (soundOn()) sfx.tap(); if (phase === 'camp') fireLoop(soundOn()); };
syncSound();

// 確かめ用: ?go=pack|walk|battle|camp|end（その場面から始める）
function debugStart(go) {
  st = M.newGame(); st.memo = {};
  $('#titleOv').hidden = true;
  const day = +(Q.get('day') || 0);
  for (let d = 0; d < day; d++) { M.startMorning(st); M.startWalk(st, 'creek'); M.startCamp(st); M.endCamp(st); }
  if (go === 'pack') return goPack();
  M.startMorning(st);
  ['water', 'honey', 'pot', 'food'].forEach(id => M.toggleItem(st, id));
  if (go === 'walk') return goWalk(Q.get('route') || 'creek');
  M.startWalk(st, 'creek'); st.walk.pos = 1;
  if (go === 'battle') return goBattle();
  if (go === 'camp') return goCamp();
  if (go === 'end') return goEnd();
}

// 確かめ用（コンソールやテストから中をのぞく）
window.__porter = { get st() { return st; }, get phase() { return phase; }, an, M, Art, ctx,
  tick(sec, step = 1 / 30) { for (let k = 0; k < sec / step; k++) update(step); render(); } };

goTitle();
if (Q.get('go')) debugStart(Q.get('go'));
// サムネイル（tools/thumb.html）: 沢へ向かって歩いているところ
if (Q.has('thumb')) { debugStart('walk'); window.__porter.tick(4.2); ['#guide', '#dayTag', '#corner', '#panel'].forEach(s => { $(s).hidden = true; }); }
requestAnimationFrame(frame);
