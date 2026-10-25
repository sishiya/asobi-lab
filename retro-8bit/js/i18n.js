// ことば（ja／en）。決め方は index.html の頭の1行（まなびラボ・あそびラボ共通: ?lang= → 前に選んだもの（localStorage の manabi-lang）→ ブラウザの言語）。
// HTML は <span lang="ja">…</span><span lang="en">…</span> の対（いまのことばでないほうを CSS で隠す）、属性は data-en-label・data-en-title、js の文は TX(日本語, 英語)。
// ソフト（ROM）へは、電源を入れる前に電池の RAM の $7FFF に入れる（0 かな・1 英語）。あそびラボのソフトはタイトルのたびにここを読む
export const LANG = document.documentElement.lang === 'en' ? 'en' : 'ja';
export const TX = (ja, en) => (LANG === 'en' ? en : ja);
export const ROM_LANG_ADDR = 0x1fff; // prgRam の中の番地（$7FFF）
export function setRomLang(nes) { nes.cart.prgRam[ROM_LANG_ADDR] = LANG === 'en' ? 1 : 0; }

export function setLang(l) {
  try { localStorage.setItem('manabi-lang', l); } catch { /* 残せなくても、この URL で切りかわる */ }
  const u = new URL(location.href);
  u.searchParams.set('lang', l);
  location.href = u.href;
}

// 英語のときだけ、data-en-label・data-en-title を aria-label・title に。JP / EN のボタン（data-lang）を押せるように
export function initLang(root = document) {
  if (LANG === 'en') {
    for (const el of root.querySelectorAll('[data-en-label]')) el.setAttribute('aria-label', el.dataset.enLabel);
    for (const el of root.querySelectorAll('[data-en-title]')) el.setAttribute('title', el.dataset.enTitle);
  }
  for (const b of root.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === LANG));
    b.addEventListener('click', () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); });
  }
}
