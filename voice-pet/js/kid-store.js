// 声の子を、この端末に残す（育てる⇄走るを行き来するため）。残すのは遺伝子の数・歩き方の数・練習の続きの数だけ。声は残さない（こえのこと同じ約束）
// 何匹か同時に育てる（ユーザー「何匹か同時に育てたい」「練習できるのは同時に1匹でもいい。他の子は休むか、練習なしでただ歩くだけ」）:
//   { kids: [子...], at: いま見ている（練習する）子の番号 }。多くても MAX_KIDS 匹。走るは、いま見ている子で走る
const OLD = 'satoyama.kid2', KEY = 'koenoko.kids';
export const MAX_KIDS = 3;
// 足 3対の子は 2対になったので、歩き方を覚えなおす
function fourLegs(k) { const g = k.genes; if ((g.type ?? 'walk') === 'walk' && (g.seg ?? 0.5) >= 0.25 && (g.legs ?? 0) > 0.6) { g.legs = 0.6; delete k.v; delete k.trying; delete k.state; delete k.getup; } }
// よつあしは骨の配置を変えて学習し直したので、前の体で覚えた歩き方は捨てて覚えなおす（端末ごとに1度だけ）
function relearnWalk(j) { try { if (localStorage.getItem('koenoko.walk2')) return; for (const k of j.kids) if ((k.genes.type ?? 'walk') === 'walk') { k.genes.type = 'walk'; delete k.v; delete k.trying; delete k.state; delete k.getup; } saveKids(j); localStorage.setItem('koenoko.walk2', '1'); } catch (e) { /* 保存できないときは、そのまま */ } }
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
export function loadKids() {
  const j = read(KEY); if (j && Array.isArray(j.kids)) { const seen = new Set(), kids = j.kids.filter(k => k && k.genes && !(k.id && seen.has(k.id)) && (seen.add(k.id), true)); kids.forEach(fourLegs); const out = { kids, at: Math.max(0, Math.min(j.at | 0, kids.length - 1)) }; relearnWalk(out); return out; } // 同じ子が2つ残っていたら1つに
  const k = read(OLD); return { kids: k && k.genes ? [k] : [], at: 0 }; // 1匹だけのころの子を引きつぐ
}
export function saveKids(j) { try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) { /* 保存できない（プライベートのウィンドウなど）: このページの中だけで続ける */ } }
export function loadKid() { const j = loadKids(); return j.kids[j.at] || null; }
export function saveKid(k) { const j = loadKids(); if (j.kids.length) j.kids[j.at] = k; else j.kids = [k]; saveKids(j); }
// セーブの書き出しと読みこみ（遺伝子と歩き方の数・名前・庭だけ。声は入らない）
const GARDEN = 'koenoko.garden', VOL = 'koenoko.vol', WALK = 'koenoko.walk2';
export function exportSave() { return { app: 'koenoko', ver: 1, kids: read(KEY), garden: read(GARDEN), vol: read(VOL), walk2: (() => { try { return localStorage.getItem(WALK); } catch (e) { return null; } })() }; }
export function checkSave(j) { return j?.app === 'koenoko' && Array.isArray(j.kids?.kids) && j.kids.kids.length <= MAX_KIDS && j.kids.kids.every(k => k && typeof k.genes === 'object' && k.genes); }
export function importSave(j) { const okPhoto = s => typeof s === 'string' && s.length < 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s), kids = j.kids.kids.map(k => ({ ...k, name: String(k.name ?? '').slice(0, 10), photo: okPhoto(k.photo) ? k.photo : undefined, photoBy: k.photoBy === 'user' ? 'user' : 'auto' })), /* 写真はページにそのまま出すので、読みこむファイルの中身を確かめる */ plants = (j.garden?.plants ?? []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z) && Number.isInteger(p?.kind) && p.kind >= 0 && p.kind < 5 && Number.isInteger(p?.stage)).slice(0, 80); localStorage.setItem(KEY, JSON.stringify({ kids, at: j.kids.at | 0 })); localStorage.setItem(GARDEN, JSON.stringify({ ...j.garden, plants })); if (j.vol) localStorage.setItem(VOL, JSON.stringify(j.vol)); if (j.walk2) localStorage.setItem(WALK, j.walk2); else localStorage.removeItem(WALK); }
export function clearKid() { try { localStorage.removeItem(KEY); localStorage.removeItem(OLD); } catch (e) { /* なし */ } }
