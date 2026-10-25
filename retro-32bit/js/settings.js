// 設定の画面（⚙ 設定）: 「画面と音」と「キー」の2つのタブ。開いているあいだはゲームを止める（8ビット互換機の settings.js と同じ形。キーは 1P だけ）
import { P1_BUTTONS, BUTTON_NAME, keyLabel } from './input.js?v=2';
import { TX } from './i18n.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// o: { input, screen: { get, set, can }, sound: { get, set }, volume: { get, set }, vibrate: { get, set, can }, pause, resume }
export function initSettings(o) {
  const dlg = $('settings'), note = $('keyNote');
  let waiting = null; // { p, b, btn }

  const ARROW = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→' };
  function face(b) {
    if (ARROW[b]) return `<b class="face word" aria-label="${BUTTON_NAME[b]}">${ARROW[b]}</b>`;
    return 'ABXY'.includes(b) && b.length === 1 ? `<b class="face f${b}">${b}</b>` : `<b class="face word">${BUTTON_NAME[b]}</b>`;
  }
  function renderKeys() {
    for (const [p, list, box] of [['p1', P1_BUTTONS, $('keys1')]]) {
      box.innerHTML = list.map((b) => {
        const chips = o.input.keys[p][b].map((c) => `<span class="chip">${esc(keyLabel(c))}<button type="button" data-del="${p}|${b}|${esc(c)}" aria-label="${TX(`${esc(keyLabel(c))} を外す`, `Remove ${esc(keyLabel(c))}`)}">×</button></span>`).join('');
        const isWait = waiting && waiting.p === p && waiting.b === b;
        // ＋ は、その行のキーの札のすぐうしろに（どの行に足すかが目で分かるように）
        return `<div class="krow">${face(b)}<span class="chips">${chips}<button type="button" class="addkey${isWait ? ' wait' : ''}" data-add="${p}|${b}" aria-label="${TX(`${p === 'p1' ? '1P' : '2P'} の ${BUTTON_NAME[b]} にキーを足す`, `Add a key for ${p === 'p1' ? '1P' : '2P'} ${BUTTON_NAME[b]}`)}">${isWait ? TX('キーかマウスを押して…', 'Press a key or mouse button…') : '＋'}</button></span></div>`;
      }).join('');
    }
  }
  function stopWaiting() { waiting = null; o.input.capture = null; renderKeys(); }
  function say(t) { note.textContent = t; }

  dlg.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]'), add = e.target.closest('[data-add]');
    if (del) { const [p, b, c] = del.dataset.del.split('|'); o.input.unbind(p, b, c); say(TX(`${keyLabel(c)} を外しました`, `Removed ${keyLabel(c)}`)); renderKeys(); }
    if (add) {
      const [p, b] = add.dataset.add.split('|');
      waiting = { p, b };
      say(TX(`${p === 'p1' ? '1P' : '2P'} の ${BUTTON_NAME[b]} に使うキーを押してください（Esc でやめる）`, `Press the key for ${p === 'p1' ? '1P' : '2P'} ${BUTTON_NAME[b]} (Esc to cancel)`));
      o.input.capture = (code) => {
        if (code === 'Escape') { say(TX('やめました', 'Canceled')); stopWaiting(); return; }
        if (o.input.reserved(code)) { say(TX(`${keyLabel(code)} はブラウザで使うので、えらべません`, `${keyLabel(code)} is used by the browser and can't be chosen`)); return; }
        const was = o.input.whoUses(code);
        o.input.bind(p, b, code);
        say(was && (was[0] !== (p === 'p1' ? 0 : 1) || was[1] !== b)
          ? TX(`${keyLabel(code)} を ${was[0] ? '2P' : '1P'} の ${BUTTON_NAME[was[1]]} から移しました`, `Moved ${keyLabel(code)} from ${was[0] ? '2P' : '1P'} ${BUTTON_NAME[was[1]]}`)
          : TX(`${keyLabel(code)} を ${p === 'p1' ? '1P' : '2P'} の ${BUTTON_NAME[b]} にしました`, `Set ${keyLabel(code)} for ${p === 'p1' ? '1P' : '2P'} ${BUTTON_NAME[b]}`));
        stopWaiting();
      };
      renderKeys();
    }
  });
  $('keysReset').addEventListener('click', () => { o.input.resetKeys(); stopWaiting(); say(TX('はじめのキーにもどしました', 'Keys reset to default')); });

  // タブ
  const tabs = [...dlg.querySelectorAll('[role=tab]')];
  const show = (t) => {
    for (const x of tabs) { const on = x === t; x.setAttribute('aria-selected', String(on)); $(x.getAttribute('aria-controls')).hidden = !on; }
    stopWaiting(); say('');
  };
  for (const t of tabs) t.addEventListener('click', () => show(t));

  // 画面と音
  function renderView() {
    for (const b of dlg.querySelectorAll('[data-screen]')) {
      b.setAttribute('aria-checked', String(b.dataset.screen === o.screen.get()));
      b.disabled = !o.screen.can && b.dataset.screen !== 'lcd';
    }
    $('optSound').checked = o.sound.get();
    $('optVolume').value = String(Math.round(o.volume.get() * 100));
    $('optVibrate').checked = o.vibrate.get();
    $('rowVibrate').hidden = !o.vibrate.can;
  }
  for (const b of dlg.querySelectorAll('[data-screen]')) b.addEventListener('click', () => { o.screen.set(b.dataset.screen); renderView(); });
  $('optSound').addEventListener('change', (e) => o.sound.set(e.target.checked));
  $('optVolume').addEventListener('input', (e) => o.volume.set(+e.target.value / 100));
  $('optVibrate').addEventListener('change', (e) => o.vibrate.set(e.target.checked));
  // マウス（口 2）: 速さと上下の逆
  const renderMouse = () => { $('optMouseSens').value = String(Math.round(o.input.mouseSens * 100)); $('optMouseInv').checked = o.input.mouseInvert; };
  $('optMouseSens').addEventListener('input', (e) => { o.input.mouseSens = +e.target.value / 100; });
  $('optMouseInv').addEventListener('change', (e) => { o.input.mouseInvert = e.target.checked; });

  dlg.addEventListener('close', () => { stopWaiting(); o.input.enabled = true; o.resume(); });
  // Esc はキーを待っているあいだは「やめる」にだけ使う
  dlg.addEventListener('cancel', (e) => { if (waiting) e.preventDefault(); });

  return {
    open(tab) {
      o.pause(); o.input.enabled = false; o.input.clear();
      renderView(); renderKeys(); renderMouse(); say('');
      show(tabs.find((t) => t.dataset.tab === tab) || tabs[0]);
      dlg.showModal();
    },
  };
}
