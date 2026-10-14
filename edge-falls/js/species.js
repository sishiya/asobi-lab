'use strict';
// 種に分かれる（v2。EXPANSION 2章の次の段。heaven-spheres のしくみを下じきに）:
//   同じ種の群れが、水や陸で隔てられて長くまじわらないと、遺伝子が別々に動き、やがて別の種になる。
//   1日ごとに、シカとサカナの群れを「近いものどうし」でまとめ（シカは深い水をこえない・サカナは水の中だけでつながる）、
//   6 匹以上のかたまりが 2 つ以上あり、遺伝子の平均がちがってきた日がつづくと（W.sepDays）、小さいほうを新しい種にする。
//   別の種どうしは子を残さない。新しい種は色が少し変わり、プレイヤーが名前をつける（おすすめの名前つき）。
//   本当の種分化（地理的隔離）はふつう何千〜何万年もかかる。この箱庭ではずっと速い（図鑑で書く）。

const SP_KINDS = ['deer', 'fish'];
const SP_TINT = [null, [150, 70, 40], [70, 100, 150], [120, 130, 60], [140, 90, 140], [60, 130, 120]];   // 種ごとの色の寄せ先（0 はもとの種）
function resetSpecies() { W.species = []; W.sepDays = {}; }
const spOf = a => a.sp || 0;
function speciesName(kind, sp) {
  if (!sp) return KINDS[kind].name;
  const r = (W.species || []).find(s => s.kind === kind && s.id === sp);
  return r ? r.name : KINDS[kind].name;
}

// 近いものどうしのかたまり（つなぐ距離 7）。シカは間が深い水ならつながない、サカナは間が陸ならつながない
function clusters(list, kind) {
  const n = list.length, par = list.map((_, k) => k);
  const find = k => { while (par[k] !== k) { par[k] = par[par[k]]; k = par[k]; } return k; };
  const blocked = (a, b) => {
    for (let t = 0.25; t < 1; t += 0.25) {
      const j = cellOf(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      if (kind === 'fish' ? W.w[j] < 0.1 : deepAt(j) > 0.6) return true;
    }
    return false;
  };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = list[i], b = list[j];
    if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > 49 || blocked(a, b)) continue;
    par[find(i)] = find(j);
  }
  const groups = new Map();
  list.forEach((a, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); });
  return [...groups.values()].sort((p, q) => q.length - p.length);
}
const meanGenes = (g, kind) => { const m = {}; for (const [k] of GENES[kind]) m[k] = g.reduce((s, a) => s + a.g[k], 0) / g.length; return m; };
const geneGap = (p, q, kind) => GENES[kind].reduce((s, [k]) => s + Math.abs(p[k] - q[k]), 0);

// 1日ごと（main.js）
function dailySpecies() {
  if (!W.species) resetSpecies();
  for (const kind of SP_KINDS) {
    if (!G.unlock || !G.unlock[kind] || (W.species.filter(s => s.kind === kind).length >= SP_TINT.length - 1)) continue;
    const bySp = new Map();
    for (const a of L.list) if (a.kind === kind && !a.dead) { const s = spOf(a); if (!bySp.has(s)) bySp.set(s, []); bySp.get(s).push(a); }
    for (const [sp, list] of bySp) {
      if (list.length < 12) continue;
      const key = kind + ':' + sp, gs = clusters(list, kind);
      const big = gs[0], second = gs[1];
      if (!second || second.length < 6) { W.sepDays[key] = Math.max(0, (W.sepDays[key] || 0) - 1); continue; }
      const gap = geneGap(meanGenes(big, kind), meanGenes(second, kind), kind);
      W.sepDays[key] = (W.sepDays[key] || 0) + 1;
      if (W.sepDays[key] >= 1) W.flags.isolated = 1;
      if (W.sepDays[key] >= 16 && gap >= 0.08) { newSpecies(kind, second); W.sepDays[key] = 0; }
    }
  }
}

function newSpecies(kind, group) {
  const id = 1 + Math.max(0, ...W.species.filter(s => s.kind === kind).map(s => s.id));
  const m = meanGenes(group, kind), name = suggestName(kind, m, group);
  W.species.push({ kind, id, name, day: W.day, from: spOf(group[0]) });
  for (const a of group) a.sp = id;
  W.flags.species = 1;
  if (typeof THUMB !== 'undefined' && THUMB) return;
  Sound.play('win');
  // 名前の札で遊びを止めない（v017。気になること 5）: 知らせだけ。名前は観察帳の「いのち」の頁でいつでも変えられる
  toast(TX(`新しい種「${name}」が生まれた。${KINDS[kind].name}の群れが長く隔てられて分かれた。名前は観察帳の「いのち」の頁で変えられる`, `A new species, “${name}”, was born: a group of ${KPL[kind]} split off after being cut off for a long time. You can rename it on the “Life” page of the Field Notes`), 8);
  if (typeof markNew === 'function') markNew('life', 'sp' + kind + id);
}
// おすすめの名前: いちばん強く出た遺伝子と、住んでいる所から
function suggestName(kind, m, group) {
  const top = GENES[kind].map(([k]) => [k, m[k] - 0.5]).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1]))[0];
  const hi = group.reduce((s, a) => s + W.g[cellOf(a.x, a.y)], 0) / group.length;
  const used = new Set((W.species || []).map(s => s.name));
  const cand = kind === 'deer'
    ? { speed: [TX('ハヤアシジカ', 'Swift Deer'), TX('ノロジカ', 'Slow Deer')], size: [TX('オオジカ', 'Great Deer'), TX('コジカ', 'Little Deer')], swim: [TX('オヨギジカ', 'Swimming Deer'), TX('オカジカ', 'Upland Deer')] }
    : { strength: [TX('ナガレウオ', 'Stream Fish'), TX('ヨドミウオ', 'Pool Fish')], size: [TX('オオウオ', 'Great Fish'), TX('コウオ', 'Little Fish')], hardy: [TX('アサセウオ', 'Shallows Fish'), TX('フチウオ', 'Deep Fish')] };
  let name = cand[top[0]][top[1] >= 0 ? 0 : 1];
  if (used.has(name)) name = (kind === 'deer' ? (hi > 8 ? TX('ヤマ', 'Mountain ') : TX('ハマ', 'Shore ')) : TX('ミズウミ', 'Lake ')) + name;
  return name;
}
function nameSpecies(kind, id, back) {
  const r = W.species.find(s => s.kind === kind && s.id === id); if (!r) return;
  const was = G.speed; setSpeed(0);
  showPanel(back ? TX(`<p class="mtitle">種の名前</p><p class="small center">${r.name}（${KINDS[kind].name}から分かれた種・第 ${r.day} 日）</p>`, `<p class="mtitle">Species name</p><p class="small center">${r.name} (split from ${KPL[kind]}, day ${r.day})</p>`) + `<p class="center"><input id="spName" class="spname" maxlength="14" value="${r.name.replace(/"/g, '')}" aria-label="${TX('種の名前', 'Species name')}"></p>` : TX(`<p class="mtitle">新しい種</p><p class="small center">${KINDS[kind].name}の群れが、長く隔てられて、別の種に分かれた。もう、もとの${KINDS[kind].name}とは子を残さない。名前をつける。</p>`,
    `<p class="mtitle">A new species</p><p class="small center">A group of ${KPL[kind]} was cut off for a long time and split into a separate species. It no longer has young with the original ${KPL[kind]}. Give it a name.</p>`) +
    `<p class="center"><input id="spName" class="spname" maxlength="14" value="${r.name.replace(/"/g, '')}" aria-label="${TX('種の名前', 'Species name')}"></p>`,
    [{ label: TX('この名前にする', 'Use this name'), main: true, fn: () => { const v = ($('spName') && $('spName').value || '').trim(); if (v) r.name = v.slice(0, 14); setSpeed(was || 1); toast(TX(`種の名前を「${r.name}」にした`, `Named the species “${r.name}”`), 4); back && back(); } }]);
  $('panel').classList.add('menu', 'world'); G.panelBack = () => { $('overlay').hidden = true; setSpeed(was || 1); back && back(); };
  const inp = $('spName'); if (inp) { inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('panel').querySelector('.tbtn.main').click(); }); }
}
// 観察帳の「いのち」の頁: 分かれた種と、名前を変えるボタン
function renderSpecies() {
  const el = $('spList'); if (!el) return;
  const list = W.species || [];
  el.hidden = !list.length; if (!list.length) return;
  const sig = list.map(s => s.kind + s.id + s.name).join('|'); if (el.dataset.sig === sig) return; el.dataset.sig = sig;
  el.innerHTML = TX('分かれた種', 'New species') + '<br>' + list.map(s => `<span class="sprow">${s.name.replace(/</g, '')}<small>${TX(`（${KINDS[s.kind].name}から・第 ${s.day} 日）`, ` (from ${KPL[s.kind]}, day ${s.day})`)}</small><button type="button" class="tbtn" data-spk="${s.kind}" data-spi="${s.id}">${TX('名前を変える', 'Rename')}</button></span>`).join('');
  el.querySelectorAll('[data-spk]').forEach(b => b.onclick = () => { Sound.play('click'); closeBook(); nameSpecies(b.dataset.spk, +b.dataset.spi, () => openBook('life')); });
}
const speciesList = () => (W.species || []).map(s => TX(`${s.name}（${KINDS[s.kind].name}から・第 ${s.day} 日）`, `${s.name} (from ${KPL[s.kind]}, day ${s.day})`)).join(TX('・', ' · '));
