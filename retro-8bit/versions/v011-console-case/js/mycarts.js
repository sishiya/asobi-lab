// じぶんのカセット: 遊ぶ人が開いた .nes を、このブラウザの中（IndexedDB）にだけ残す。
// 送らない・ほかの人と分けない・サイトには上げない（PLAN.md 0章）。名前の変更と削除は自由。1本 1MB まで・30本まで
const DB = 'retro8', STORE = 'carts', MAX = 30;

function open() {
  return new Promise((ok, ng) => {
    if (!('indexedDB' in window)) { ng(new Error('この ブラウザでは残せません')); return; }
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
export async function listCarts() {
  try {
    const all = await run('readonly', (st) => st.getAll());
    return (all || []).sort((a, b) => a.added - b.added);
  } catch { return []; }
}
export async function addCart(name, bytes) {
  const all = await listCarts();
  if (all.length >= MAX) throw new Error(`じぶんのカセットは ${MAX} 本までです（いらないものを消してください）`);
  const cart = { id: 'my-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: cleanName(name), bytes, added: Date.now() };
  await run('readwrite', (st) => st.put(cart));
  return cart;
}
export async function renameCart(id, name) {
  const all = await listCarts(), c = all.find((x) => x.id === id);
  if (!c) return;
  c.name = cleanName(name);
  await run('readwrite', (st) => st.put(c));
}
export async function deleteCart(id) {
  await run('readwrite', (st) => st.delete(id));
  try { localStorage.removeItem('retro8.save.' + id); } catch { /* セーブがなければそのまま */ }
}
// 名前: 拡張子を外し、32 字まで（画面には textContent で出す）
export function cleanName(s) {
  return String(s || '').replace(/\.nes$/i, '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32) || 'なまえのないカセット';
}
