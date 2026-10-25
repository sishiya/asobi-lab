// 棚（トップ。8ビット互換機の shelf.js と同じ形で、カセットのかわりに CD のケースとディスク）。
// ケースを押す → 表紙が本のように開いて中のディスクが見える → ディスクが本体の口の前へ飛ぶ → 口へすべりこむ → 電源が入って遊ぶ画面へ。
// 棚にもどると、電源が切れて、ディスクは口から出て自分のケースへもどる。じぶんのディスクを足しても、すぐには入れない（並べるだけ）。
// 色・なまえ・ダウンロード・すてるは「…」のメニュー。色はブラウザに残す（retro32.discColor.<id>）
import { Console32 } from './psx.js';
import { listDiscs, addDisc, renameDisc, deleteDisc } from './mydiscs.js';
import { TX } from './i18n.js';

const $ = (id) => document.getElementById(id);
// ケースの帯とラベルの色: 本体（灰白とだいだい）とかぶらない 8 色。ねずみは じぶんのディスクのはじめの色
export const DISC_COLORS = [
  ['#1f4f7a', TX('深い青', 'Deep blue')], ['#d4a03a', TX('からし', 'Mustard')], ['#7d4f78', TX('すみれ', 'Violet')], ['#56636f', TX('鉄', 'Iron')],
  ['#8c3a3f', TX('えんじ', 'Crimson')], ['#6f7a3a', TX('オリーブ', 'Olive')], ['#3f8a8c', TX('あさぎ', 'Teal')], ['#8e8a84', TX('ねずみ', 'Gray')],
];
const MINE_COLOR = '#8e8a84';
const MINE_COUNT = 'retro32.mineCount';
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 残せなくても遊べる */ } };
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// o: { library, loadExe(entry), open(entry), boot(entry), powerOff(), sfx: { clack(kind) } }
export function initShelf(o) {
  const row = $('discs'), con = $('console'), slot = $('slot'), add = $('drop'), led = $('led');
  let seated = null;   // { id, entry } 本体に入っているディスク
  let room = null;     // 部屋（3D）
  let busy = false;

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

  function colorOf(id, def) { return read('retro32.discColor.' + id, def ?? DISC_COLORS[0][0]); }
  // ケースの表紙とディスクのラベルの絵: ソフトを画面なしで少し動かした絵（タイトル画面）
  function paint(item, bytes, frames) {
    try {
      const m = new Console32(8000);
      m.loadExe(bytes);
      for (let i = 0; i < frames; i++) m.runFrame();
      const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf);
      const src = document.createElement('canvas'); src.width = w; src.height = h;
      src.getContext('2d').putImageData(new ImageData(buf.slice(0, w * h * 4), w, h), 0, 0);
      for (const c of item.querySelectorAll('canvas.art')) {
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(src, 0, 0, w, h, 0, 0, c.width, c.height);
      }
      item._art = src;
    } catch { /* 描けないディスクは黒いまま */ }
  }

  // ---------- ケース1つ ----------
  function makeItem(entry, mine) {
    const it = document.createElement('div');
    it.className = 'item';
    it.dataset.id = entry.id;
    it.style.setProperty('--c', colorOf(entry.id, entry.color));
    it.innerHTML = `<button class="cd"><span class="tray"><span class="disc"><canvas class="art" width="160" height="120"></canvas><i></i></span></span>
        <span class="cover"><canvas class="art" width="320" height="240"></canvas><b></b></span></button>
      <span class="case" aria-hidden="true"></span>
      <button class="menuBtn" aria-haspopup="true" aria-expanded="false">…</button>`;
    it.querySelector('b').textContent = entry.title;
    const cd = it.querySelector('.cd');
    cd.setAttribute('aria-label', TX(`${entry.title} であそぶ`, `Play ${entry.title}`));
    it.querySelector('.menuBtn').setAttribute('aria-label', TX(`${entry.title} のメニュー（色・なまえ・ダウンロード）`, `${entry.title} menu (color, name, download)`));
    cd.addEventListener('click', () => insert(it, entry));
    it.querySelector('.menuBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(it, entry, mine); });
    return it;
  }

  // ---------- 「…」メニュー ----------
  function closeMenus() {
    for (const m of document.querySelectorAll('.cmenu')) { m.parentElement.classList.remove('menuOpen'); m.parentElement.querySelector('.menuBtn')?.setAttribute('aria-expanded', 'false'); m.remove(); }
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
    m.innerHTML = `<p>${TX('ケースの色', 'Case color')}</p><div class="sw">${DISC_COLORS.map(([c, n]) => `<button role="menuitemradio" aria-checked="${c === now}" style="--s:${c}" data-c="${c}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      ${mine ? `<button class="row2" data-act="rename">${TX('なまえをかえる', 'Rename')}</button>` : ''}
      <a class="row2" data-act="dl">${TX('ソフトをダウンロード（.exe）', 'Download the software (.exe)')}</a>
      ${mine ? `<button class="row2 del" data-act="del">${TX('すてる', 'Remove')}</button>` : ''}`;
    for (const b of m.querySelectorAll('[data-c]')) b.addEventListener('click', () => {
      save('retro32.discColor.' + entry.id, b.dataset.c);
      it.style.setProperty('--c', b.dataset.c);
      for (const x of m.querySelectorAll('[data-c]')) x.setAttribute('aria-checked', String(x === b));
    });
    const dl = m.querySelector('[data-act=dl]');
    if (mine) {
      const url = URL.createObjectURL(new Blob([entry.bytes], { type: 'application/octet-stream' }));
      dl.href = url; dl.download = entry.title + '.exe';
      dl.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 4000));
    } else { dl.href = entry.file; dl.download = entry.id + '.exe'; }
    m.querySelector('[data-act=rename]')?.addEventListener('click', async () => {
      const n = prompt(TX('ディスクの なまえ（32字まで）', 'Disc name (up to 32 characters)'), entry.title);
      if (n === null) return;
      await renameDisc(entry.id, n); closeMenus(); await render();
    });
    m.querySelector('[data-act=del]')?.addEventListener('click', async () => {
      if (!confirm(TX(`「${entry.title}」をすてます（このブラウザから消えます）。よいですか？`, `Remove "${entry.title}" from this browser?`))) return;
      if (seated?.id === entry.id) { room?.removeDisc(); seated = null; setPower(false); }
      await deleteDisc(entry.id); closeMenus(); await render();
    });
    it.append(m); it.classList.add('menuOpen');
    it.querySelector('.menuBtn').setAttribute('aria-expanded', 'true');
    m.querySelector('[aria-checked="true"]')?.focus();
  }

  // ---------- 本体 ----------
  function setPower(on) { con.classList.toggle('on', on); led.classList.toggle('on', on); room?.setPower(on); if (!on) o.powerOff?.(); }

  // ---------- 入れる・出す（飛ぶディスクはページの上に固定した写し） ----------
  const anim = (el, frames, ms, ease = 'linear') => new Promise((ok) => {
    if (still()) { Object.assign(el.style, { transform: frames[frames.length - 1].transform, opacity: frames[frames.length - 1].opacity ?? '' }); ok(); return; }
    const a = el.animate(frames, { duration: ms, fill: 'forwards', easing: ease });
    a.onfinish = () => { el.style.transform = frames[frames.length - 1].transform; if (frames[frames.length - 1].opacity != null) el.style.opacity = frames[frames.length - 1].opacity; a.cancel(); ok(); };
  });
  const wait = (ms) => new Promise((ok) => setTimeout(ok, still() ? 0 : ms));
  const D = 120;   // 飛ぶディスクの大きさ（px。scale で変える）
  const TF = (cx, cy, r, sy = 1) => `translate(${cx - D / 2}px, ${cy - D / 2}px) scale(${(2 * r) / D}, ${(2 * r) / D * sy})`;
  function flyFrom(it) {
    const src = it.querySelector('.disc'), fly = src.cloneNode(true);
    fly.classList.add('flydisc');
    fly.style.setProperty('--c', getComputedStyle(it).getPropertyValue('--c'));
    const c = fly.querySelector('canvas'); c.getContext('2d').drawImage(src.querySelector('canvas'), 0, 0);
    document.body.append(fly);
    const r = src.getBoundingClientRect();
    return { fly, home: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 } };
  }
  // 口の前（3D は部屋の口・2D は本体の口）
  function slotAt() {
    if (room) { const s = room.slotRect(); return { ...s, sy: 0.38 }; }
    const r = slot.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: Math.min(70, r.width * 0.42) * kc, sy: 0.32 };
  }
  async function insert(it, entry) {
    if (busy) return;
    busy = true; closeMenus();
    try {
      await eject();
      it.classList.add('open'); o.sfx.clack('caseOpen'); await wait(380);
      const { fly, home } = flyFrom(it);
      it.classList.add('gone');
      const a = slotAt();
      fly.style.transform = TF(home.cx, home.cy, home.r);
      await anim(fly, [{ transform: TF(home.cx, home.cy, home.r) }, { transform: TF(a.cx, a.cy - 30, a.r, a.sy) }], 560, 'cubic-bezier(.3,.7,.4,1)');
      setTimeout(() => o.sfx.clack('slide'), still() ? 0 : 120);
      if (room) {
        fly.remove();
        await room.insertDisc({ color: getComputedStyle(it).getPropertyValue('--c').trim(), label: it._art, title: entry.title });
      } else {
        // 2D: 口へ吸いこまれる（横から見て細くなりながら）
        await anim(fly, [{ transform: TF(a.cx, a.cy - 30, a.r, a.sy), opacity: 1 }, { transform: TF(a.cx, a.cy, a.r, 0.06), opacity: 1, offset: 0.6 }, { transform: TF(a.cx, a.cy, a.r * 0.7, 0.04), opacity: 0 }], 520, 'ease-in');
        fly.remove();
        con.classList.add('bump'); setTimeout(() => con.classList.remove('bump'), 240);
      }
      setTimeout(() => o.sfx.clack('click'), 0);
      seated = { id: entry.id, entry };
      await wait(160);
      it.classList.remove('open'); o.sfx.clack('caseClose');
      await wait(260);
      await startUp(entry);
    } finally { busy = false; }
  }
  // 電源を入れる: 部屋では本体が動き出してテレビに映り、テレビに寄ってから遊ぶ画面へ。2D ではそのまま遊ぶ画面へ
  async function startUp(entry) {
    setPower(true); o.sfx.clack('sw');
    if (room) {
      await o.boot(entry);
      await wait(380);
      await room.focusTV(true, still() ? 0 : 750);
    } else await wait(420);
    o.open(entry);
  }
  async function eject() {
    if (!seated) return;
    const s = seated; seated = null;
    if (con.classList.contains('on')) { setPower(false); o.sfx.clack('sw'); await wait(200); }
    if (room) await room.focusTV(false, 0);
    const it = row.querySelector(`.item[data-id="${CSS.escape(s.id)}"]`);
    o.sfx.clack('out');
    if (room) await room.ejectDisc();
    if (!it) return;
    const { fly, home } = flyFrom(it), a = slotAt();
    it.classList.add('open'); o.sfx.clack('caseOpen');
    await anim(fly, [{ transform: TF(a.cx, a.cy, a.r, room ? a.sy : 0.05), opacity: room ? 1 : 0 }, { transform: TF(a.cx, a.cy - 30, a.r, a.sy), opacity: 1, offset: 0.3 }, { transform: TF(home.cx, home.cy, home.r), opacity: 1 }], 640, 'cubic-bezier(.4,0,.2,1)');
    fly.remove(); it.classList.remove('gone');
    await wait(260); it.classList.remove('open'); o.sfx.clack('caseClose'); await wait(300);
  }

  // ---------- じぶんのディスクを足す ----------
  function addFile(file) {
    const err = $('openErr');
    err.hidden = true;
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 + 2048) { err.textContent = TX('大きすぎるファイルです（2MB まで）', 'That file is too big (2 MB max).'); err.hidden = false; return; }
    file.arrayBuffer().then(async (buf) => {
      const bytes = new Uint8Array(buf);
      try { new Console32(8000).loadExe(bytes); } catch (e) { err.textContent = TX('開けませんでした: ', 'Could not open it: ') + e.message; err.hidden = false; return; }
      let d;
      try { d = await addDisc(file.name, bytes); } catch (e) { err.textContent = e.message; err.hidden = false; return; }
      await render();
      const it = row.querySelector(`.item[data-id="${CSS.escape(d.id)}"]`);
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
    o.library.forEach((e, i) => {
      const it = makeItem(e, false);
      row.insertBefore(it, add);
      // 絵は少しずつ（1枚ずつ間をあけて。読みこみを止めない）
      o.loadExe(e).then((bytes) => setTimeout(() => paint(it, bytes, e.frames), 60 * i)).catch(() => {});
    });
    const n = +read(MINE_COUNT, 0) || 0, ghosts = [];
    for (let i = 0; i < n; i++) {
      const g = document.createElement('div');
      g.className = 'item loading'; g.setAttribute('aria-hidden', 'true');
      g.innerHTML = `<span class="ghost">${TX('よみこみ中…', 'Loading…')}</span><span class="case"></span>`;
      row.insertBefore(g, add); ghosts.push(g);
    }
    const mine = await listDiscs();
    for (const g of ghosts) g.remove();
    for (const old of row.querySelectorAll('.item.mine')) old.remove();
    save(MINE_COUNT, mine.length);
    for (const d of mine) {
      const entry = { id: d.id, title: d.name, color: MINE_COLOR, keys: [], bytes: d.bytes, frames: 60 };
      const it = makeItem(entry, true); it.classList.add('mine');
      row.insertBefore(it, add);
      setTimeout(() => paint(it, d.bytes, 60), 0);
    }
    if (seated) { const it = row.querySelector(`.item[data-id="${CSS.escape(seated.id)}"]`); if (it) it.classList.add('gone'); }
  }

  return {
    render,
    back() {
      if (con.classList.contains('on')) { setPower(false); o.sfx.clack('sw'); }
      if (!seated || busy) return;
      busy = true;
      setTimeout(() => eject().finally(() => { busy = false; }), still() ? 0 : 250);
    },
    useRoom(r) {
      room = r;
      if (seated) { const it = row.querySelector(`.item[data-id="${CSS.escape(seated.id)}"]`); if (it) room.seatDisc({ color: getComputedStyle(it).getPropertyValue('--c').trim(), label: it._art, title: seated.entry.title }); }
    },
    get powered() { return con.classList.contains('on'); },
    get busy() { return busy; },
    async power(on) {
      if (busy || !seated) return;
      if (!on) { setPower(false); o.sfx.clack('sw'); return; }
      busy = true;
      try { await startUp(seated.entry); } finally { busy = false; }
    },
    get seated() { return seated?.id || null; },
  };
}
