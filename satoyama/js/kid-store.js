// いまいる声の子を、この端末に残す（育てる⇄走るを行き来するため）。残すのは遺伝子の数・歩き方の数・練習の続きの数だけ。声は残さない（こえのこと同じ約束）
const KEY = 'satoyama.kid2';
export function loadKid() { try { const j = JSON.parse(localStorage.getItem(KEY)); return j && j.genes ? j : null; } catch (e) { return null; } }
export function saveKid(k) { try { localStorage.setItem(KEY, JSON.stringify(k)); } catch (e) { /* 保存できない（プライベートのウィンドウなど）: このページの中だけで続ける */ } }
export function clearKid() { try { localStorage.removeItem(KEY); } catch (e) { /* なし */ } }
