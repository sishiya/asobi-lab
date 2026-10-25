// 棚（トップ）: 机の上のケースに入ったカセットと、本体。
// カセットを押す → ケースのふたが開く → 本体の手前を通って溝の真上 → 溝の中をまっすぐ下へ（穴から見える）→
// 底で すとん（3px 沈んでもどる）・カチッ・本体も受けとめる → 電源が入って遊ぶ画面へ。ケースのふたはしめる。
// 棚にもどると、カセットは本体に入ったまま（電源は切れる）。ほかのカセットを押すと、入っているものを ぴょんと抜いて
// 自分のケースへもどしてから、新しいものを入れる。POWER は入っているカセットでもう一度あそぶ。
// 色・なまえ・ダウンロード・すてるは「…」のメニュー。色はブラウザに残す（retro8.cartColor.<id>）
import { Console8 } from './nes.js';
import { listCarts, addCart, renameCart, deleteCart } from './mycarts.js';

const $ = (id) => document.getElementById(id);
// カセットの色: 本体（クリーム・ミント・サンゴ）とかぶらない8色（濃さでも本体とはなす）
export const CART_COLORS = [
  ['#3f4f86', '藍'], ['#d4a03a', 'からし'], ['#7d4f78', 'すみれ'], ['#56636f', '鉄'],
  ['#8c3a3f', 'えんじ'], ['#6f7a3a', 'オリーブ'], ['#3a3836', 'すみ'], ['#e0a26a', 'あんず'],
];
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 残せなくても遊べる */ } };
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// o: { library, loadRom(entry), open(entry), sfx: { clack(kind) } }
export function initShelf(o) {
  const row = $('carts'), con = $('console'), well = $('slot'), add = $('drop'), led = $('led');
  let seated = null;   // { id, entry, fly } 本体に入っているカセット
  let busy = false;    // 動いているあいだは次を受けつけない

  function colorOf(id, def) { return read('retro8.cartColor.' + id, def ?? CART_COLORS[0][0]); }
  function paint(canvas, bytes, frames) {
    try {
      const m = new Console8(bytes, 8000);
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
    cart.setAttribute('aria-label', `${entry.title} であそぶ`);
    it.querySelector('.menuBtn').setAttribute('aria-label', `${entry.title} のメニュー（色・なまえ・ダウンロード）`);
    cart.addEventListener('click', () => insert(it, entry));
    it.querySelector('.menuBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(it, entry, mine); });
    return it;
  }

  // ---------- 「…」メニュー ----------
  function closeMenus(except) {
    for (const m of document.querySelectorAll('.cmenu')) if (m !== except) { m.parentElement.querySelector('.menuBtn')?.setAttribute('aria-expanded', 'false'); m.remove(); }
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
    m.innerHTML = `<p>カセットの色</p><div class="sw">${CART_COLORS.map(([c, n]) => `<button role="menuitemradio" aria-checked="${c === now}" style="--s:${c}" data-c="${c}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      ${mine ? '<button class="row2" data-act="rename">なまえをかえる</button>' : ''}
      <a class="row2" data-act="dl">ROM をダウンロード</a>
      ${mine ? '<button class="row2 del" data-act="del">すてる</button>' : ''}`;
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
      const n = prompt('カセットの なまえ（32字まで）', entry.title);
      if (n === null) return;
      await renameCart(entry.id, n); closeMenus(); await render();
    });
    m.querySelector('[data-act=del]')?.addEventListener('click', async () => {
      if (!confirm(`「${entry.title}」をすてます（このブラウザから消え、セーブも消えます）。よいですか？`)) return;
      if (seated?.id === entry.id) { seated.fly.remove(); seated = null; setPower(false); }
      await deleteCart(entry.id); closeMenus(); await render();
    });
    it.append(m);
    it.querySelector('.menuBtn').setAttribute('aria-expanded', 'true');
    m.querySelector('[aria-checked="true"]')?.focus();
  }

  // ---------- 本体 ----------
  function setPower(on) { con.classList.toggle('on', on); led.classList.toggle('on', on); }
  let bubbleTimer = 0;
  function bubble(text) {
    const b = $('bubble'); b.textContent = text; b.classList.add('show');
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove('show'), 3500);
  }
  function playSeated() { if (seated && !busy) { setPower(true); o.sfx.clack('sw'); setTimeout(() => o.open(seated.entry), 260); } }
  $('powerSw').addEventListener('click', () => {
    if (seated) { playSeated(); return; }
    o.sfx.clack('sw');
    led.classList.remove('blink'); void led.offsetWidth; led.classList.add('blink');
    bubble('カセットが入っていません。\n下のカセットを押してね');
  });
  $('resetSw').addEventListener('click', () => { if (seated) playSeated(); else bubble('カセットが入っていません'); });

  // ---------- さしこむ・抜く ----------
  const T = (x, y) => `translate(${x}px, ${y}px)`;
  function geo(cart) {
    const cr = con.getBoundingClientRect(), wr = well.getBoundingClientRect(), kr = cart.getBoundingClientRect();
    return { sx: kr.left - cr.left, sy: kr.top - cr.top, x: wr.left - cr.left + (wr.width - kr.width) / 2, above: -kr.height - 30, rest: wr.top - cr.top + 4 };
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
    setPower(false);
    const it = row.querySelector(`.item[data-id="${CSS.escape(s.id)}"]`);
    if (!it) { s.fly.remove(); return; }
    const g = geo(it.querySelector('.cart'));
    o.sfx.clack('out');
    await anim(s.fly, [{ transform: T(g.x, g.rest) }, { transform: T(g.x, g.rest + 2), offset: 0.15 }, { transform: T(g.x, g.above + 40) }], 420, 'cubic-bezier(.2,1.3,.5,1)');
    s.fly.classList.add('front');
    it.classList.add('open'); await wait(200);
    await anim(s.fly, [{ transform: T(g.x, g.above + 40) }, { transform: T(g.sx, g.sy) }], 560, 'cubic-bezier(.4,0,.2,1)');
    s.fly.remove(); it.querySelector('.cart').classList.remove('gone'); it.classList.remove('gone');
    await wait(150); it.classList.remove('open'); await wait(300);
  }
  async function insert(it, entry) {
    if (busy) return;
    if (seated?.id === entry.id) { playSeated(); return; }
    busy = true; closeMenus(); $('bubble').classList.remove('show');
    try {
      await eject();
      const cart = it.querySelector('.cart');
      it.classList.add('open'); await wait(330);
      const g = geo(cart);
      const fly = cart.cloneNode(true); fly.classList.add('fly', 'front'); fly.removeAttribute('aria-label'); fly.tabIndex = -1;
      fly.style.setProperty('--c', getComputedStyle(it).getPropertyValue('--c'));
      fly.querySelector('canvas').getContext('2d').drawImage(cart.querySelector('canvas'), 0, 0);
      con.append(fly); cart.classList.add('gone'); it.classList.add('gone');
      await anim(fly, [{ transform: T(g.sx, g.sy) }, { transform: T(g.x, g.above) }], 560, 'cubic-bezier(.3,.7,.4,1)');
      fly.classList.remove('front');           // ここから本体の前の面のうしろ（穴から見える）
      it.classList.remove('open');             // 出したあとはふたをしめる
      await anim(fly, [{ transform: T(g.x, g.above) }, { transform: T(g.x, g.rest + 3), offset: 0.82, easing: 'cubic-bezier(.55,0,.85,.5)' }, { transform: T(g.x, g.rest), easing: 'ease-out' }], 520);
      o.sfx.clack('in');
      con.classList.add('bump'); setTimeout(() => con.classList.remove('bump'), 240);
      seated = { id: entry.id, entry, fly };
      setPower(true); o.sfx.clack('sw');
      await wait(380);
      o.open(entry);
    } finally { busy = false; }
  }

  // ---------- じぶんのカセットを足す ----------
  function addFile(file) {
    const err = $('openErr');
    err.hidden = true;
    if (!file) return;
    if (file.size > 1024 * 1024) { err.textContent = '大きすぎるファイルです（1MB まで）'; err.hidden = false; return; }
    file.arrayBuffer().then(async (buf) => {
      const bytes = new Uint8Array(buf);
      try { new Console8(bytes, 8000); } catch (e) { err.textContent = '開けませんでした: ' + e.message; err.hidden = false; return; }
      let c;
      try { c = await addCart(file.name, bytes); } catch (e) { err.textContent = e.message; err.hidden = false; return; }
      save('retro8.cartColor.' + c.id, CART_COLORS[(row.querySelectorAll('.item.mine').length + 6) % 8][0]);
      await render();
      const it = row.querySelector(`.item[data-id="${CSS.escape(c.id)}"]`);
      if (it) insert(it, { id: c.id, title: c.name, keys: [], bytes, frames: 60 });
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
    for (const c of await listCarts()) {
      const entry = { id: c.id, title: c.name, keys: [], bytes: c.bytes, frames: 60 };
      const it = makeItem(entry, true); it.classList.add('mine');
      row.insertBefore(it, add);
      paint(it.querySelector('canvas'), c.bytes, 60);
    }
    // スマホの横の列: カセットを前に足すと、はじめにあった「じぶんのカセット」に吸いついたままになるので、頭にもどす
    row.scrollLeft = 0;
    if (seated) {   // 本体に入っているカセットは、棚では空のケース
      const it = row.querySelector(`.item[data-id="${CSS.escape(seated.id)}"]`);
      if (it) { it.classList.add('gone'); it.querySelector('.cart').classList.add('gone'); }
    }
  }

  return {
    render,
    // 遊ぶ画面から棚へ: カセットは入ったまま、電源だけ切る
    back() { setPower(false); },
    // 確かめ用
    get seated() { return seated?.id || null; },
  };
}
