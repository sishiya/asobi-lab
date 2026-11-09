// 声の子を、この端末に残す（育てる⇄走るを行き来するため）。残すのは遺伝子の数・歩き方の数・練習の続きの数だけ。声は残さない（こえのこと同じ約束）
// 何匹か同時に育てる（ユーザー「何匹か同時に育てたい」「練習できるのは同時に1匹でもいい。他の子は休むか、練習なしでただ歩くだけ」）:
//   { kids: [子...], at: いま見ている（練習する）子の番号 }。多くても MAX_KIDS 匹。走るは、いま見ている子で走る
const OLD = 'satoyama.kid2', KEY = 'koenoko.kids';
export const MAX_KIDS = 3;
// 足 3対の子は 2対になったので、歩き方を覚えなおす
function fourLegs(k) { const g = k.genes; if ((g.type ?? 'walk') === 'walk' && (g.seg ?? 0.5) >= 0.25 && (g.legs ?? 0) > 0.6) { g.legs = 0.6; delete k.v; delete k.trying; delete k.state; delete k.getup; } }
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
export function loadKids() {
  const j = read(KEY); if (j && Array.isArray(j.kids)) { const seen = new Set(), kids = j.kids.filter(k => k && k.genes && !(k.id && seen.has(k.id)) && (seen.add(k.id), true)); kids.forEach(fourLegs); return { kids, at: Math.max(0, Math.min(j.at | 0, kids.length - 1)) }; } // 同じ子が2つ残っていたら1つに
  const k = read(OLD); return { kids: k && k.genes ? [k] : [], at: 0 }; // 1匹だけのころの子を引きつぐ
}
export function saveKids(j) { try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) { /* 保存できない（プライベートのウィンドウなど）: このページの中だけで続ける */ } }
export function loadKid() { const j = loadKids(); return j.kids[j.at] || null; }
export function saveKid(k) { const j = loadKids(); if (j.kids.length) j.kids[j.at] = k; else j.kids = [k]; saveKids(j); }
export function clearKid() { try { localStorage.removeItem(KEY); localStorage.removeItem(OLD); } catch (e) { /* なし */ } }
