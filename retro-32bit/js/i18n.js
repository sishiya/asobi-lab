// ことば（ja／en）。決め方は index.html の頭の1行（まなびラボ・あそびラボ共通: ?lang= → 前に選んだもの（localStorage の manabi-lang）→ ブラウザの言語）。
// HTML は <span lang="ja">…</span><span lang="en">…</span> の対（いまのことばでないほうを CSS で隠す）、属性は data-en-label、js の文は TX(日本語, 英語)
export const LANG = document.documentElement.lang === 'en' ? 'en' : 'ja';
export const TX = (ja, en) => (LANG === 'en' ? en : ja);

export function initLang(root = document) {
  if (LANG === 'en') for (const el of root.querySelectorAll('[data-en-label]')) el.setAttribute('aria-label', el.dataset.enLabel);
  for (const b of root.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === LANG));
    b.addEventListener('click', () => {
      if (b.dataset.lang === LANG) return;
      try { localStorage.setItem('manabi-lang', b.dataset.lang); } catch { /* 残せなくても、この URL で切りかわる */ }
      const u = new URL(location.href); u.searchParams.set('lang', b.dataset.lang); location.href = u.href;
    });
  }
}
