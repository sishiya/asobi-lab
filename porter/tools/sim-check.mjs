// 決まりの確かめ: いくつかの「お供のやり方」で3日の旅を回し、勝ち負けと答え合わせを出す
// node porter/tools/sim-check.mjs
import * as M from '../js/model.js';

const PLANS = {
  // ていねい: 鍋・はちみつ・靴下・包帯・干し肉・砥石（薪は拾う）、近道、水とはちみつを渡す、野営は沸かす・料理・乾かす・手当て・研ぐ
  careful: { bag: ['water', 'honey', 'food', 'socks', 'pot', 'bandage'], route: 'creek', give: true, camp: ['gather', 'boil', 'cook', 'dry', 'treat'] },
  careful2: { bag: ['water', 'honey', 'food', 'socks', 'pot', 'bandage'], route: 'creek', give: true, camp: ['gather', 'boil', 'cook', 'dry', 'treat', 'sharpen'], stoneDay: 1 },
  // なにもしない: 荷物は水袋だけ、近道、渡さない、すぐ寝る
  lazy: { bag: ['water'], route: 'creek', give: false, camp: [] },
  // 全部やる: 重い荷物で遠回り、野営で全部
  greedy: { bag: ['water', 'wood', 'pot'], route: 'ridge', give: true, camp: ['boil', 'cook', 'dry', 'sharpen', 'treat'] },
  // 尾根で水を渡さない
  dry: { bag: ['honey', 'food', 'pot', 'wood'], route: 'ridge', give: false, camp: ['boil', 'cook'] },
};

function run(name, p, verbose) {
  const st = M.newGame();
  const out = [];
  for (let d = 0; d < 3; d++) {
    M.startMorning(st);
    for (const id of p.bag) M.toggleItem(st, id);
    if (p.stoneDay === d) M.toggleItem(st, 'stone');
    M.startWalk(st, p.route);
    let t = 0;
    while (st.walk.pos < 1) {
      const ev = M.walkStep(st, 0.1); t += 0.1;
      if (p.give) {
        if (st.hero.thirst > 0.18 && st.uses.water) M.walkAct(st, 'water');
        if (st.hero.sugar < 0.45 && st.uses.honey) M.walkAct(st, 'honey');
        if (st.walk.socksAsk) M.walkAct(st, 'socks');
      }
    }
    M.startBattle(st);
    while (!st.battle.done) {
      M.battleStep(st, 0.05);
      if (p.give && st.hero.sugar < 0.25 && st.uses.honey) M.battleAct(st, 'honey');
    }
    const r = M.review(st);
    out.push(`${d + 1}日目 ${r.win ? '勝ち' : '負け'} ${st.battle.t.toFixed(1)}s 勇者${Math.round(st.battle.heroHp)} 歩き${t.toFixed(0)}s 遅れ${st.late.toFixed(1)}h` +
      (verbose ? '\n   ' + r.items.map(i => (i.bad ? '×' : '○') + i.head + ' ← ' + i.chain.join(' ← ')).join('\n   ') : ''));
    if (!r.win) break;
    M.startCamp(st);
    for (const a of p.camp) M.campAct(st, a);
    M.endCamp(st);
    out[out.length - 1] += ` 眠り${st.hero.sleep}h`;
  }
  console.log(`== ${name}\n` + out.join('\n'));
}

const v = process.argv.includes('-v');
for (const [k, p] of Object.entries(PLANS)) run(k, p, v);
