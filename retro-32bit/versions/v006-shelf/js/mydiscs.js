// じぶんのディスク: 遊ぶ人が開いた実行ファイル（.exe）を、このブラウザの中（IndexedDB）にだけ残す（8ビット互換機の mycarts.js と同じ形）。
// 送らない・ほかの人と分けない・サイトには上げない（PLAN.md 0章）。名前の変更と削除は自由。1枚 2MB まで・30枚まで
import { TX } from './i18n.js';
const DB = 'retro32', STORE = 'discs', MAX = 30;

function open() {
  return new Promise((ok, ng) => {
    if (!('indexedDB' in window)) { ng(new Error(TX('この ブラウザでは残せません', 'This browser cannot keep discs'))); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ng(r.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  return new Promise((ok, ng) => {
    const tx = db.transaction(STORE, mode), st = tx.objectStore(STORE);
    const req = fn(st);
    tx.oncomplete = () => { db.close(); ok(req?.result); };
    tx.onerror = () => { db.close(); ng(tx.error); };
  });
}

// { id, name, bytes(Uint8Array), added } の一覧（古い順）
export async function listDiscs() {
  try {
    const all = await run('readonly', (st) => st.getAll());
    return (all || []).sort((a, b) => a.added - b.added);
  } catch { return []; }
}
export async function addDisc(name, bytes) {
  const all = await listDiscs();
  if (all.length >= MAX) throw new Error(TX(`じぶんのディスクは ${MAX} 枚までです（いらないものを消してください）`, `Up to ${MAX} of your own discs (please remove some)`));
  const d = { id: 'my-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: cleanName(name), bytes, added: Date.now() };
  await run('readwrite', (st) => st.put(d));
  return d;
}
export async function renameDisc(id, name) {
  const all = await listDiscs(), d = all.find((x) => x.id === id);
  if (!d) return;
  d.name = cleanName(name);
  await run('readwrite', (st) => st.put(d));
}
export async function deleteDisc(id) { await run('readwrite', (st) => st.delete(id)); }
// 名前: 拡張子を外し、32 字まで（画面には textContent で出す）
export function cleanName(s) {
  return String(s || '').replace(/\.exe$/i, '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32) || TX('なまえのないディスク', 'Untitled disc');
}
