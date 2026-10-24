// 設定の画面（⚙ 設定）: 「画面と音」と「キー」の2つのタブ。開いているあいだはゲームを止める
import { P1_BUTTONS, P2_BUTTONS, BUTTON_NAME, keyLabel } from './input.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// o: { input, screen: { get, set, can }, sound: { get, set }, volume: { get, set }, vibrate: { get, set, can }, pause, resume }
export function initSettings(o) {
  const dlg = $('settings'), note = $('keyNote');
  let waiting = null; // { p, b, btn }

  const ARROW = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→' };
  function face(b) {
    if (ARROW[b]) return `<b class="face word" aria-label="${BUTTON_NAME[b]}">${ARROW[b]}</b>`;
    return b === 'A' || b === 'B' ? `<b class="face">${b}</b>` : `<b class="face word">${BUTTON_NAME[b]}</b>`;
  }
  function renderKeys() {
    for (const [p, list, box] of [['p1', P1_BUTTONS, $('keys1')], ['p2', P2_BUTTONS, $('keys2')]]) {
      box.innerHTML = list.map((b) => {
        const chips = o.input.keys[p][b].map((c) => `<span class="chip">${esc(keyLabel(c))}<button type="button" data-del="${p}|${b}|${esc(c)}" aria-label="${esc(keyLabel(c))} を外す">×</button></span>`).join('');
        const isWait = waiting && waiting.p === p && waiting.b === b;
        // ＋ は、その行のキーの札のすぐうしろに（どの行に足すかが目で分かるように）
        return `<div class="krow">${face(b)}<span class="chips">${chips}<button type="button" class="addkey${isWait ? ' wait' : ''}" data-add="${p}|${b}" aria-label="${p === 'p1' ? '1P' : '2P'} の ${BUTTON_NAME[b]} にキーを足す">${isWait ? 'キーを押して…' : '＋'}</button></span></div>`;
      }).join('');
    }
  }
  function stopWaiting() { waiting = null; o.input.capture = null; renderKeys(); }
  function say(t) { note.textContent = t; }

  dlg.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]'), add = e.target.closest('[data-add]');
    if (del) { const [p, b, c] = del.dataset.del.split('|'); o.input.unbind(p, b, c); say(`${keyLabel(c)} を外しました`); renderKeys(); }
    if (add) {
      const [p, b] = add.dataset.add.split('|');
      waiting = { p, b };
      say(`${p === 'p1' ? '1P' : '2P'} の ${BUTTON_NAME[b]} に使うキーを押してください（Esc でやめる）`);
      o.input.capture = (code) => {
        if (code === 'Escape') { say('やめました'); stopWaiting(); return; }
        if (o.input.reserved(code)) { say(`${keyLabel(code)} はブラウザで使うので、えらべません`); return; }
        const was = o.input.whoUses(code);
        o.input.bind(p, b, code);
        say(was && (was[0] !== (p === 'p1' ? 0 : 1) || was[1] !== b)
          ? `${keyLabel(code)} を ${was[0] ? '2P' : '1P'} の ${BUTTON_NAME[was[1]]} から移しました`
          : `${keyLabel(code)} を ${p === 'p1' ? '1P' : '2P'} の ${BUTTON_NAME[b]} にしました`);
        stopWaiting();
      };
      renderKeys();
    }
  });
  $('keysReset').addEventListener('click', () => { o.input.resetKeys(); stopWaiting(); say('はじめのキーにもどしました'); });

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

  dlg.addEventListener('close', () => { stopWaiting(); o.input.enabled = true; o.resume(); });
  // Esc はキーを待っているあいだは「やめる」にだけ使う
  dlg.addEventListener('cancel', (e) => { if (waiting) e.preventDefault(); });

  return {
    open(tab) {
      o.pause(); o.input.enabled = false; o.input.clear();
      renderView(); renderKeys(); say('');
      show(tabs.find((t) => t.dataset.tab === tab) || tabs[0]);
      dlg.showModal();
    },
  };
}
