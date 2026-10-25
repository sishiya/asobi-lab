// 棚（トップ）: 机の上のケースに入ったカセットと、本体。
// カセットを押す → ケースのふたが開く → 本体の手前を通って溝の真上 → 溝の中をまっすぐ下へ（穴から見える）→
// 底で すとん（3px 沈んでもどる）・カチッ・本体も受けとめる → 電源が入って遊ぶ画面へ。ケースのふたはしめる。
// 棚にもどると、電源が切れて、カセットは ぴょんと抜けて自分のケースへもどる（2026-10-25 ユーザー。入ったままだと
// POWER でまた遊べることに気づきにくい）。じぶんのカセットを足しても、すぐには入れない（並べるだけ）。
// 色・なまえ・ダウンロード・すてるは「…」のメニュー。色はブラウザに残す（retro8.cartColor.<id>）
import { Console8 } from './nes.js';
import { listCarts, addCart, renameCart, deleteCart } from './mycarts.js';
import { TX, setRomLang } from './i18n.js';

const $ = (id) => document.getElementById(id);
// カセットの色: 本体（クリーム・ミント・サンゴ）とかぶらない8色（濃さでも本体とはなす）。ねずみは じぶんのカセットのはじめの色
export const CART_COLORS = [
  ['#3f4f86', TX('藍', 'Indigo')], ['#d4a03a', TX('からし', 'Mustard')], ['#7d4f78', TX('すみれ', 'Violet')], ['#56636f', TX('鉄', 'Iron')],
  ['#8c3a3f', TX('えんじ', 'Crimson')], ['#6f7a3a', TX('オリーブ', 'Olive')], ['#e0a26a', TX('あんず', 'Apricot')], ['#8e8a84', TX('ねずみ', 'Gray')],
];   // 4×2（v013 で「すみ」を外した。前に選んだ人のカセットはその色のまま）
const MINE_COLOR = '#8e8a84';   // じぶんのカセットのはじめの色（目立たない灰色）
const MINE_COUNT = 'retro8.mineCount';   // 読みこむ前にケースの場所をとるための本数
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 残せなくても遊べる */ } };
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// o: { library, loadRom(entry), open(entry), sfx: { clack(kind) } }
export function initShelf(o) {
  const row = $('carts'), con = $('console'), well = $('slot'), add = $('drop'), led = $('led');
  let seated = null;   // { id, entry, fly } 本体に入っているカセット
  let busy = false;    // 動いているあいだは次を受けつけない

  // 本体は形のまま縮める（--kc）。スマホのカセットは2列に入る大きさ（--kd）
  let kc = 1, kd = 1;
  function fit() {
    const w = document.documentElement.clientWidth;
    kc = Math.min(1, (w - 32) / 600);
    kd = w <= 600 ? Math.min(1, w / 390) : 1;
    document.documentElement.style.setProperty('--kc', kc);
    document.documentElement.style.setProperty('--kd', kd);
  }
  fit(); addEventListener('resize', fit);
  $('btnHelp').addEventListener('click', () => $('help').showModal());

  function colorOf(id, def) { return read('retro8.cartColor.' + id, def ?? CART_COLORS[0][0]); }
  function paint(canvas, bytes, frames) {
    try {
      const m = new Console8(bytes, 8000);
      setRomLang(m); // ラベルのタイトル画面も、このページのことばで
      for (let i = 0; i < frames; i++) m.runFrame();
      const c = canvas.getContext('2d'), im = c.createImageData(256, 240);
      new Uint32Array(im.data.buffer).set(m.ppu.frame);
      c.putImageData(im, 0, 0);
    } catch { /* 描けないカセットは黒いまま */ }
  }

  // ---------- カセット1本 ----------
  function makeItem(entry, mine) {
    const it = document.createElement('div');
    it.className = 'item';
    it.dataset.id = entry.id;
    it.style.setProperty('--c', colorOf(entry.id, entry.color));
    it.innerHTML = `<button class="cart"><span class="body"><span class="label"><canvas width="256" height="240"></canvas><b></b></span><span class="pins"></span></span></button>
      <span class="case" aria-hidden="true"></span>
      <button class="menuBtn" aria-haspopup="true" aria-expanded="false">…</button>`;
    it.querySelector('b').textContent = entry.title;
    const cart = it.querySelector('.cart');
    cart.setAttribute('aria-label', TX(`${entry.title} であそぶ`, `Play ${entry.title}`));
    it.querySelector('.menuBtn').setAttribute('aria-label', TX(`${entry.title} のメニュー（色・なまえ・ダウンロード）`, `${entry.title} menu (color, name, download)`));
    cart.addEventListener('click', () => insert(it, entry));
    it.querySelector('.menuBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(it, entry, mine); });
    return it;
  }

  // ---------- 「…」メニュー ----------
  function closeMenus(except) {
    for (const m of document.querySelectorAll('.cmenu')) if (m !== except) { m.parentElement.classList.remove('menuOpen'); m.parentElement.querySelector('.menuBtn')?.setAttribute('aria-expanded', 'false'); m.remove(); }
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.cmenu')) closeMenus(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  function toggleMenu(it, entry, mine) {
    const had = it.querySelector('.cmenu');
    closeMenus();
    if (had) return;
    const m = document.createElement('div');
    m.className = 'cmenu'; m.setAttribute('role', 'menu');
    const now = colorOf(entry.id, entry.color);
    m.innerHTML = `<p>${TX('カセットの色', 'Cassette color')}</p><div class="sw">${CART_COLORS.map(([c, n]) => `<button role="menuitemradio" aria-checked="${c === now}" style="--s:${c}" data-c="${c}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      ${mine ? `<button class="row2" data-act="rename">${TX('なまえをかえる', 'Rename')}</button>` : ''}
      <a class="row2" data-act="dl">${TX('ROM をダウンロード', 'Download ROM')}</a>
      ${read('retro8.save.' + entry.id) ? `<button class="row2 del" data-act="erase">${TX('セーブを消す', 'Erase save')}</button>` : ''}
      ${mine ? `<button class="row2 del" data-act="del">${TX('すてる', 'Remove')}</button>` : ''}`;
    for (const b of m.querySelectorAll('[data-c]')) b.addEventListener('click', () => {
      save('retro8.cartColor.' + entry.id, b.dataset.c);
      it.style.setProperty('--c', b.dataset.c);
      if (seated?.id === entry.id) seated.fly.style.setProperty('--c', b.dataset.c);
      for (const x of m.querySelectorAll('[data-c]')) x.setAttribute('aria-checked', String(x === b));
    });
    const dl = m.querySelector('[data-act=dl]');
    if (mine) {
      const url = URL.createObjectURL(new Blob([entry.bytes], { type: 'application/octet-stream' }));
      dl.href = url; dl.download = entry.title + '.nes';
      dl.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 4000));
    } else { dl.href = entry.file; dl.download = entry.id + '.nes'; }
    m.querySelector('[data-act=rename]')?.addEventListener('click', async () => {
      const n = prompt(TX('カセットの なまえ（32字まで）', 'Cassette name (up to 32 characters)'), entry.title);
      if (n === null) return;
      await renameCart(entry.id, n); closeMenus(); await render();
    });
    // 電池のセーブ（セーブがあるカセットだけ出す）。2026-10-25 説明書の中から、そのカセットのメニューへ移した
    m.querySelector('[data-act=erase]')?.addEventListener('click', () => {
      if (!confirm(TX(`「${entry.title}」のセーブを消します（はじめからになります）。もとにはもどせません。消しますか？`, `Erase the save for "${entry.title}"? It will start over, and this can't be undone.`))) return;
      try { localStorage.removeItem('retro8.save.' + entry.id); } catch { /* 残せない設定なら、もともとない */ }
      closeMenus();
    });
    m.querySelector('[data-act=del]')?.addEventListener('click', async () => {
      if (!confirm(TX(`「${entry.title}」をすてます（このブラウザから消え、セーブも消えます）。よいですか？`, `Remove "${entry.title}" from this browser, along with its save?`))) return;
      if (seated?.id === entry.id) { seated.fly.remove(); seated = null; setPower(false); }
      await deleteCart(entry.id); closeMenus(); await render();
    });
    it.append(m); it.classList.add('menuOpen');   // 開いているあいだは傾けず、となりのケースより手前に
    it.querySelector('.menuBtn').setAttribute('aria-expanded', 'true');
    m.querySelector('[aria-checked="true"]')?.focus();
  }

  // ---------- 本体 ----------
  function setPower(on) { con.classList.toggle('on', on); led.classList.toggle('on', on); }

  // ---------- さしこむ・抜く ----------
  // 飛ぶカセットは本体の中の座標（本体を縮めていれば、その縮めた単位）。机のカセットの大きさから本体の中の大きさへ s で変える
  const T = (x, y, s = 1) => `translate(${x}px, ${y}px) scale(${s})`;
  function geo(cart) {
    const cr = con.getBoundingClientRect(), wr = well.getBoundingClientRect(), kr = cart.getBoundingClientRect();
    const s = kr.width / 160 / kc;   // 机のカセットの見た目 ÷ 本体の中の 160px の見た目
    return { s, sx: (kr.left - cr.left) / kc, sy: (kr.top - cr.top) / kc, x: (wr.left - cr.left) / kc + (wr.width / kc - 160) / 2, above: -208 - 30, rest: (wr.top - cr.top) / kc + 4 };
  }
  const anim = (el, frames, ms, ease = 'linear') => new Promise((ok) => {
    if (still()) { el.style.transform = frames[frames.length - 1].transform; ok(); return; }
    const a = el.animate(frames, { duration: ms, fill: 'forwards', easing: ease });
    a.onfinish = () => { el.style.transform = frames[frames.length - 1].transform; a.cancel(); ok(); };
  });
  const wait = (ms) => new Promise((ok) => setTimeout(ok, still() ? 0 : ms));

  async function eject() {
    if (!seated) return;
    const s = seated; seated = null;
    if (con.classList.contains('on')) { setPower(false); o.sfx.clack('sw'); }
    const it = row.querySelector(`.item[data-id="${CSS.escape(s.id)}"]`);
    if (!it) { s.fly.remove(); return; }
    const g = geo(it.querySelector('.cart'));
    o.sfx.clack('out');
    await anim(s.fly, [{ transform: T(g.x, g.rest) }, { transform: T(g.x, g.rest + 2), offset: 0.15 }, { transform: T(g.x, g.above + 40) }], 420, 'cubic-bezier(.2,1.3,.5,1)');
    s.fly.classList.add('front');
    it.classList.add('open'); o.sfx.clack('caseOpen'); await wait(200);
    await anim(s.fly, [{ transform: T(g.x, g.above + 40) }, { transform: T(g.sx, g.sy, g.s) }], 560, 'cubic-bezier(.4,0,.2,1)');
    s.fly.remove(); it.querySelector('.cart').classList.remove('gone'); it.classList.remove('gone');
    await wait(260); it.classList.remove('open'); o.sfx.clack('caseClose'); await wait(300);
  }
  async function insert(it, entry) {
    if (busy) return;
    busy = true; closeMenus();
    try {
      await eject();
      const cart = it.querySelector('.cart');
      it.classList.add('open'); o.sfx.clack('caseOpen'); await wait(330);
      const g = geo(cart);
      const fly = cart.cloneNode(true); fly.classList.add('fly', 'front'); fly.removeAttribute('aria-label'); fly.tabIndex = -1;
      fly.style.setProperty('--c', getComputedStyle(it).getPropertyValue('--c'));
      fly.querySelector('canvas').getContext('2d').drawImage(cart.querySelector('canvas'), 0, 0);
      con.append(fly); cart.classList.add('gone'); it.classList.add('gone');
      fly.style.transform = T(g.sx, g.sy, g.s);
      await anim(fly, [{ transform: T(g.sx, g.sy, g.s) }, { transform: T(g.x, g.above) }], 560, 'cubic-bezier(.3,.7,.4,1)');
      fly.classList.remove('front');           // ここから本体の前の面のうしろ（穴から見える）
      // 溝をすべって（シャッ）、底で カチャッ1回。底に着くのは 520ms の 82%
      const down = anim(fly, [{ transform: T(g.x, g.above) }, { transform: T(g.x, g.rest + 3), offset: 0.82, easing: 'cubic-bezier(.55,0,.85,.5)' }, { transform: T(g.x, g.rest), easing: 'ease-out' }], 520);
      setTimeout(() => o.sfx.clack('slide'), still() ? 0 : 150);
      setTimeout(() => o.sfx.clack('click'), still() ? 0 : 425);
      await down;
      con.classList.add('bump'); setTimeout(() => con.classList.remove('bump'), 240);
      seated = { id: entry.id, entry, fly };
      await wait(160);
      it.classList.remove('open'); o.sfx.clack('caseClose');   // 入れおわってから、からのケースのふたをしめる
      await wait(260);                          // それから電源
      setPower(true); o.sfx.clack('sw');
      await wait(420);
      o.open(entry);
    } finally { busy = false; }
  }

  // ---------- じぶんのカセットを足す ----------
  function addFile(file) {
    const err = $('openErr');
    err.hidden = true;
    if (!file) return;
    if (file.size > 1024 * 1024) { err.textContent = TX('大きすぎるファイルです（1MB まで）', 'That file is too big (1 MB max).'); err.hidden = false; return; }
    file.arrayBuffer().then(async (buf) => {
      const bytes = new Uint8Array(buf);
      try { new Console8(bytes, 8000); } catch (e) { err.textContent = TX('開けませんでした: ', 'Could not open it: ') + e.message; err.hidden = false; return; }
      let c;
      try { c = await addCart(file.name, bytes); } catch (e) { err.textContent = e.message; err.hidden = false; return; }
      await render();
      // すぐには入れない。棚に並んだことがわかるように、そこまで動かして ぽんと出す
      const it = row.querySelector(`.item[data-id="${CSS.escape(c.id)}"]`);
      if (it) { it.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' }); it.classList.add('fresh'); setTimeout(() => it.classList.remove('fresh'), 600); }
    });
  }
  $('file').addEventListener('change', (e) => { addFile(e.target.files[0]); e.target.value = ''; });
  add.addEventListener('dragover', (e) => { e.preventDefault(); add.classList.add('over'); });
  add.addEventListener('dragleave', () => add.classList.remove('over'));
  add.addEventListener('drop', (e) => { e.preventDefault(); add.classList.remove('over'); addFile(e.dataTransfer.files[0]); });

  // ---------- 棚をつくる ----------
  async function render() {
    for (const old of row.querySelectorAll('.item:not(.add)')) old.remove();
    for (const e of o.library) {
      const it = makeItem(e, false);
      row.insertBefore(it, add);
      o.loadRom(e).then((bytes) => paint(it.querySelector('canvas'), bytes, e.frames)).catch(() => {});
    }
    // じぶんのカセットはブラウザの中から読むので少しおくれる。前の本数だけ、からのケースで先に場所をとる
    const n = +read(MINE_COUNT, 0) || 0, ghosts = [];
    for (let i = 0; i < n; i++) {
      const g = document.createElement('div');
      g.className = 'item loading'; g.setAttribute('aria-hidden', 'true');
      g.innerHTML = `<span class="ghost">${TX('よみこみ中…', 'Loading…')}</span><span class="case"></span>`;
      row.insertBefore(g, add); ghosts.push(g);
    }
    const mine = await listCarts();
    if (!read('retro8.mineGray')) {   // v011 までは足したときに色を自動で残していた。いちどだけ消して灰色に
      for (const c of mine) { try { localStorage.removeItem('retro8.cartColor.' + c.id); } catch { /* */ } }
      save('retro8.mineGray', '1');
    }
    for (const g of ghosts) g.remove();
    for (const old of row.querySelectorAll('.item.mine')) old.remove();   // 続けて呼ばれたときの重なりを消す
    save(MINE_COUNT, mine.length);
    for (const c of mine) {
      const entry = { id: c.id, title: c.name, color: MINE_COLOR, keys: [], bytes: c.bytes, frames: 60 };
      const it = makeItem(entry, true); it.classList.add('mine');
      row.insertBefore(it, add);
      setTimeout(() => paint(it.querySelector('canvas'), c.bytes, 60), 0);   // ラベルの絵は並べたあとで
    }
    if (seated) {   // 本体に入っているカセットは、棚では空のケース
      const it = row.querySelector(`.item[data-id="${CSS.escape(seated.id)}"]`);
      if (it) { it.classList.add('gone'); it.querySelector('.cart').classList.add('gone'); }
    }
  }

  return {
    render,
    // 遊ぶ画面から棚へ: 電源を切って、カセットをケースへ
    back() {
      if (con.classList.contains('on')) { setPower(false); o.sfx.clack('sw'); }
      if (!seated || busy) return;
      busy = true;
      setTimeout(() => eject().finally(() => { busy = false; }), still() ? 0 : 250);
    },
    // 確かめ用
    get seated() { return seated?.id || null; },
  };
}
