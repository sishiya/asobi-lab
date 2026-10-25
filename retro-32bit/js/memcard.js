// メモリーカード（口 1）をページの中にとっておく。どのディスクも同じ 1 枚を使う（本物と同じ）
//   中身（128KB）は、この端末の localStorage の retro32.card1 に base64 で。送らない・ほかへ出さない
//   ソフトが書いたら 0.5 秒まとめてから保存する
import { MemCard, CARD_SIZE } from './pad.js';

const KEY = 'retro32.card1';
let card = null, timer = 0;

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const bin = atob(s), d = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
    return d.length === CARD_SIZE ? d : null;
  } catch { return null; }
}
function store() {
  timer = 0;
  try {
    let bin = '';
    for (let i = 0; i < card.data.length; i += 0x8000) bin += String.fromCharCode(...card.data.subarray(i, i + 0x8000));
    localStorage.setItem(KEY, btoa(bin));
  } catch { /* 入りきらない・使えないときは、この回だけ */ }
}

// 本体にカードを差す
export function attachCard(console32) {
  if (!card) card = new MemCard(load(), () => { if (!timer) timer = setTimeout(store, 500); });
  console32.sio.cards[0] = card;
}
