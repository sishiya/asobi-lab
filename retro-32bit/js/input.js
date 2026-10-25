// 入力: キー・マウスのボタン・指・ゲームパッドを口 1 のパッドに、マウスの動きを口 2 のマウスにまとめる（8ビット互換機の input.js と同じ形。1P だけ）。
//   ボタンの名前は pad.js の BTN（A＝右・B＝下・X＝左・Y＝上、L・R・L2・R2、START・SELECT）。
//   はじめの割り当ては、ブロックのゲームでよくある形（2026-10-26 ユーザー「デフォルトのマイクラの操作と合わせて」・ほかのディスクも同じ）:
//     WASD（と矢印）＝十字キー、スペース＝A、左クリック＝B、右クリック＝X、F＝Y、E＝SELECT、Enter＝START、ホイール＝L2（上）・R2（下）
//   割り当ては変えられる（localStorage の retro32.keys2。設定の画面から。マウスのボタンとホイールもキーと同じ表に）
//   マウス: 画面をクリックするとつかむ（Esc で放す）。つかんでいる間の動きを口 2 のマウスへ。速さと上下の逆は retro32.mouse
import { BTN } from './pad.js';
import { TX } from './i18n.js';

export const P1_BUTTONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B', 'X', 'Y', 'L', 'R', 'L2', 'R2', 'SELECT', 'START'];
export const BUTTON_NAME = { UP: TX('上', 'Up'), DOWN: TX('下', 'Down'), LEFT: TX('左', 'Left'), RIGHT: TX('右', 'Right'), A: 'A', B: 'B', X: 'X', Y: 'Y', L: 'L', R: 'R', L2: 'L2', R2: 'R2', SELECT: 'SELECT', START: 'START' };
export const DEFAULT_KEYS = {
  p1: { UP: ['KeyW', 'ArrowUp'], DOWN: ['KeyS', 'ArrowDown'], LEFT: ['KeyA', 'ArrowLeft'], RIGHT: ['KeyD', 'ArrowRight'], A: ['Space'], B: ['Mouse0', 'KeyJ'], X: ['Mouse2', 'KeyK'], Y: ['KeyF'],
    L: ['KeyZ'], R: ['KeyC'], L2: ['WheelUp'], R2: ['WheelDown'], SELECT: ['KeyE'], START: ['Enter'] },
};
const KEYS_STORE = 'retro32.keys2';   // v011 までの retro32.keys とは形がちがう（はじめの割り当てを変えたので、前の保存は使わない）
// 標準のゲームパッドの番号 → ボタン（下・右・左・上は、ひし形の B・A・X・Y と同じ場所）
const GAMEPAD = { 0: 'B', 1: 'A', 2: 'X', 3: 'Y', 4: 'L', 5: 'R', 6: 'L2', 7: 'R2', 8: 'SELECT', 9: 'START', 12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT' };

const SPECIAL = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', NumpadEnter: TX('テンキー Enter', 'Numpad Enter'),
  ShiftLeft: TX('左 Shift', 'L Shift'), ShiftRight: TX('右 Shift', 'R Shift'), ControlLeft: TX('左 Ctrl', 'L Ctrl'), ControlRight: TX('右 Ctrl', 'R Ctrl'), AltLeft: TX('左 Alt', 'L Alt'), AltRight: TX('右 Alt', 'R Alt'),
  Tab: 'Tab', Backspace: 'BS', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '^', Backslash: '\\', IntlRo: 'ろ', IntlYen: '¥', Backquote: '半/全',
  Mouse0: TX('左クリック', 'Left click'), Mouse1: TX('ホイールを押す', 'Middle click'), Mouse2: TX('右クリック', 'Right click'),
  Mouse3: TX('マウスの戻る', 'Mouse back'), Mouse4: TX('マウスの進む', 'Mouse forward'), WheelUp: TX('ホイール ↑', 'Wheel up'), WheelDown: TX('ホイール ↓', 'Wheel down'),
};
export function keyLabel(code) {
  if (SPECIAL[code]) return SPECIAL[code];
  let m;
  if ((m = code.match(/^Key([A-Z])$/))) return m[1];
  if ((m = code.match(/^Digit(\d)$/))) return m[1];
  if ((m = code.match(/^Numpad(.+)$/))) return TX('テンキー ', 'Numpad ') + m[1];
  return code;
}
const RESERVED = new Set(['Escape', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight']);
function read(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } }
const clone = (o) => JSON.parse(JSON.stringify(o));

export function createInput() {
  let keys = clone(DEFAULT_KEYS);
  try {
    const s = JSON.parse(read(KEYS_STORE, 'null'));
    if (s && s.p1) for (const b of Object.keys(keys.p1)) if (Array.isArray(s.p1[b])) keys.p1[b] = s.p1[b].filter((c) => typeof c === 'string');
  } catch { /* こわれた設定は使わない */ }
  let index = new Map();
  const rebuild = () => { index = new Map(); for (const [b, codes] of Object.entries(keys.p1)) for (const c of codes) index.set(c, [0, b]); };
  rebuild();
  const held = new Set(), tapped = new Set(), touch = new Set();
  // マウス: つかんでいる画面・動いた量・速さ（1 = ふつう）・上下の逆。ボタンの割り当ては keys の Mouse0 など
  const mouse = { el: null, locked: false, plugged: false, dx: 0, dy: 0, sens: 1, invert: false };
  try { const ms = JSON.parse(read('retro32.mouse', 'null')); if (ms) { mouse.sens = Math.min(3, Math.max(0.2, +ms.sens || 1)); mouse.invert = !!ms.invert; } } catch { /* 使わない */ }
  const saveMouse = () => save('retro32.mouse', JSON.stringify({ sens: mouse.sens, invert: mouse.invert }));
  const press = (code) => { const hit = index.get(code); if (!hit || !api.enabled) return; api.onPress?.(0, hit[1]); held.add(hit[1]); tapped.add(hit[1]); };
  const release = (code) => { const hit = index.get(code); if (hit) held.delete(hit[1]); };
  const api = {
    enabled: true,
    capture: null,     // 設定でキーを待っているときの関数（code を受けとる）
    onPress: null,     // なにか押したとき。(player, button)
    get keys() { return keys; },
    bind(p, b, code) {
      for (const bb of Object.keys(keys.p1)) keys.p1[bb] = keys.p1[bb].filter((c) => c !== code);
      keys.p1[b].push(code);
      rebuild(); save(KEYS_STORE, JSON.stringify(keys));
    },
    unbind(p, b, code) { keys.p1[b] = keys.p1[b].filter((c) => c !== code); rebuild(); save(KEYS_STORE, JSON.stringify(keys)); },
    resetKeys() { keys = clone(DEFAULT_KEYS); rebuild(); save(KEYS_STORE, JSON.stringify(keys)); },
    whoUses(code) { return index.get(code) || null; },
    reserved: (code) => RESERVED.has(code),
    touchDown(names) { for (const n of names) { touch.add(n); tapped.add(n); } },
    touchUp(names) { for (const n of names) touch.delete(n); },
    clear() { held.clear(); tapped.clear(); touch.clear(); mouse.dx = mouse.dy = 0; },
    get mouseSens() { return mouse.sens; }, set mouseSens(v) { mouse.sens = Math.min(3, Math.max(0.2, +v || 1)); saveMouse(); },
    get mouseInvert() { return mouse.invert; }, set mouseInvert(v) { mouse.invert = !!v; saveMouse(); },
    get mouseLocked() { return mouse.locked; },
    // 画面をクリックでつかむ（つかんだら口 2 にマウスを差す。Esc で放す）
    attachMouse(el) {
      mouse.el = el;
      el.addEventListener('mousedown', (e) => {
        if (mouse.locked || api.capture || !api.enabled || e.button !== 0 || e.target.closest?.('button')) return;
        e.preventDefault();
        el.requestPointerLock?.();
      });
      document.addEventListener('pointerlockchange', () => {
        mouse.locked = document.pointerLockElement === el;
        if (mouse.locked) mouse.plugged = true;
        else for (const c of ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4']) release(c);
      });
    },
    // 1こまぶんを口 1 へ
    apply(m) {
      const set = new Set([...held, ...tapped, ...touch]);
      const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
      if (gp) {
        for (const [i, b] of Object.entries(GAMEPAD)) if (gp.buttons[i]?.pressed) set.add(b);
        if (gp.axes[1] < -0.5) set.add('UP'); if (gp.axes[1] > 0.5) set.add('DOWN');
        if (gp.axes[0] < -0.5) set.add('LEFT'); if (gp.axes[0] > 0.5) set.add('RIGHT');
      }
      let bits = 0;
      for (const b of set) if (BTN[b] !== undefined) bits |= 1 << BTN[b];
      // 左右・上下を同時に押したことにしない（本物の十字キーではできない）
      if ((bits & 0xa0) === 0xa0) bits &= ~0xa0;
      if ((bits & 0x50) === 0x50) bits &= ~0x50;
      m.sio.buttons[0] = bits;
      // 口 2 のマウス（一度つかんだら差したまま。動きはつかんでいる間だけ）
      if (mouse.plugged) {
        const ms = m.sio.mouse || (m.sio.mouse = { dx: 0, dy: 0, left: false, right: false });
        ms.dx += mouse.dx; ms.dy += mouse.dy * (mouse.invert ? -1 : 1);
        ms.left = held.has('B') && mouse.locked; ms.right = held.has('X') && mouse.locked;
        mouse.dx = mouse.dy = 0;
      }
      tapped.clear();
    },
  };
  addEventListener('keydown', (e) => {
    if (api.capture) { e.preventDefault(); api.capture(e.code); return; }
    if (!api.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const hit = index.get(e.code);
    if (!hit) return;
    e.preventDefault();
    if (!e.repeat) api.onPress?.(0, hit[1]);
    held.add(hit[1]); tapped.add(hit[1]);
  });
  addEventListener('keyup', (e) => { const hit = index.get(e.code); if (hit) held.delete(hit[1]); });
  // マウスのボタンとホイール: 設定でキーを待っているときは、それを割り当てる。遊ぶときは、画面をつかんでいる間だけ
  addEventListener('mousedown', (e) => {
    const code = 'Mouse' + e.button;
    if (api.capture) { if (e.target.closest?.('[data-add]')) return; e.preventDefault(); api.capture(code); return; }
    if (mouse.locked) { e.preventDefault(); press(code); }
  });
  addEventListener('mouseup', (e) => release('Mouse' + e.button));
  addEventListener('wheel', (e) => {
    if (!e.deltaY) return;
    const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
    if (api.capture) { e.preventDefault(); api.capture(code); return; }
    if (mouse.locked) { e.preventDefault(); const hit = index.get(code); if (hit && api.enabled) tapped.add(hit[1]); }
  }, { passive: false });
  addEventListener('mousemove', (e) => { if (mouse.locked && api.enabled) { mouse.dx += e.movementX * mouse.sens; mouse.dy += e.movementY * mouse.sens; } });
  addEventListener('contextmenu', (e) => { if (mouse.locked || api.capture) e.preventDefault(); });
  addEventListener('blur', () => api.clear());
  return api;
}

// 指のボタン（data-btn。"UP RIGHT" のように2つ同時も）。指をすべらせたら押すボタンも替える。押したら onDown（ふるえる・電源を入れる）
export function bindTouch(root, input, onDown) {
  const active = new Map();
  const namesAt = (x, y) => { const el = document.elementFromPoint(x, y)?.closest('[data-btn]'); return el && root.contains(el) ? el.dataset.btn.split(' ') : []; };
  const mark = () => {
    const on = new Set([...active.values()].flat());
    for (const el of root.querySelectorAll('[data-btn]')) el.classList.toggle('on', el.dataset.btn.split(' ').some((n) => on.has(n)));
  };
  const move = (e) => {
    if (!active.has(e.pointerId)) return;
    const prev = active.get(e.pointerId), next = namesAt(e.clientX, e.clientY);
    if (prev.join() === next.join()) return;
    input.touchUp(prev); input.touchDown(next); active.set(e.pointerId, next); mark();
    if (next.length) onDown?.();
  };
  const up = (e) => { if (!active.has(e.pointerId)) return; input.touchUp(active.get(e.pointerId)); active.delete(e.pointerId); mark(); };
  root.addEventListener('pointerdown', (e) => {
    const n = namesAt(e.clientX, e.clientY);
    if (!n.length) return;
    e.preventDefault();
    active.set(e.pointerId, n); input.touchDown(n); mark(); onDown?.();
  });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}
