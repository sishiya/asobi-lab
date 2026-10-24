// 入力: キー・指・ゲームパッドを、1P と 2P のコントローラーにまとめる。
// 当時の機械と同じく、1P は 十字キー・A・B・SELECT・START、2P は 十字キー・A・B と マイク（SELECT・START はない）。
// キーの割り当ては変えられる（localStorage の retro8.keys。設定の画面から）。ゲームパッドは 1 台目が 1P、2 台目が 2P
import { BTN } from './nes.js';

export const P1_BUTTONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'B', 'A', 'SELECT', 'START'];
export const P2_BUTTONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'B', 'A', 'MIC'];
export const BUTTON_NAME = { UP: '上', DOWN: '下', LEFT: '左', RIGHT: '右', A: 'A', B: 'B', SELECT: 'SELECT', START: 'START', MIC: 'マイク' };
// 画面の字（A・B・START）と同じ名前のキーで押せるように。X・Z はコントローラーの並び（B が左・A が右）が好きな人むけ
export const DEFAULT_KEYS = {
  p1: { UP: ['ArrowUp'], DOWN: ['ArrowDown'], LEFT: ['ArrowLeft'], RIGHT: ['ArrowRight'], B: ['KeyB', 'KeyZ'], A: ['KeyA', 'KeyX', 'Space'], SELECT: ['ShiftLeft', 'ShiftRight'], START: ['Enter'] },
  p2: { UP: ['KeyI'], DOWN: ['KeyK'], LEFT: ['KeyJ'], RIGHT: ['KeyL'], B: ['Comma'], A: ['Period'], MIC: ['KeyM'] },
};

const SPECIAL = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', NumpadEnter: 'テンキー Enter',
  ShiftLeft: '左 Shift', ShiftRight: '右 Shift', ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl', AltLeft: '左 Alt', AltRight: '右 Alt',
  Tab: 'Tab', Backspace: 'BS', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '^', Backslash: '\\', IntlRo: 'ろ', IntlYen: '¥', Backquote: '半/全',
};
export function keyLabel(code) {
  if (SPECIAL[code]) return SPECIAL[code];
  let m;
  if ((m = code.match(/^Key([A-Z])$/))) return m[1];
  if ((m = code.match(/^Digit(\d)$/))) return m[1];
  if ((m = code.match(/^Numpad(.+)$/))) return 'テンキー ' + m[1];
  return code;
}
// 押してはいけないキー（ブラウザの操作）
const RESERVED = new Set(['Escape', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight']);

function read(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } }
const clone = (o) => JSON.parse(JSON.stringify(o));

export function createInput() {
  let keys = clone(DEFAULT_KEYS);
  try {
    const s = JSON.parse(read('retro8.keys', 'null'));
    if (s && s.p1 && s.p2) for (const p of ['p1', 'p2']) for (const b of Object.keys(keys[p])) if (Array.isArray(s[p][b])) keys[p][b] = s[p][b].filter((c) => typeof c === 'string');
  } catch { /* こわれた設定は使わない */ }
  let index = new Map();
  const rebuild = () => {
    index = new Map();
    for (const p of ['p1', 'p2']) for (const [b, codes] of Object.entries(keys[p])) for (const c of codes) index.set(c, [p === 'p1' ? 0 : 1, b]);
  };
  rebuild();

  const held = [new Set(), new Set()];   // キー
  const tapped = [new Set(), new Set()]; // 押してすぐはなしても、1フレームは押したことにする
  const touch = new Set();               // 指（1P だけ）
  const api = {
    enabled: true,
    capture: null,     // 設定でキーを待っているときの関数（code を受けとる）
    onPress: null,     // なにか押したとき（電源を入れる など）。(player, button) を受けとる
    get keys() { return keys; },
    // 割り当て: そのキーをほかで使っていたら外して、ここに足す
    bind(p, b, code) {
      for (const pp of ['p1', 'p2']) for (const bb of Object.keys(keys[pp])) keys[pp][bb] = keys[pp][bb].filter((c) => c !== code);
      keys[p][b].push(code);
      rebuild(); save('retro8.keys', JSON.stringify(keys));
    },
    unbind(p, b, code) { keys[p][b] = keys[p][b].filter((c) => c !== code); rebuild(); save('retro8.keys', JSON.stringify(keys)); },
    resetKeys() { keys = clone(DEFAULT_KEYS); rebuild(); save('retro8.keys', JSON.stringify(keys)); },
    whoUses(code) { return index.get(code) || null; },
    reserved: (code) => RESERVED.has(code),
    // 指のボタン（data-btn。"A B" のように2つ同時も）
    touchDown(names) { for (const n of names) { touch.add(n); tapped[0].add(n); } },
    touchUp(names) { for (const n of names) touch.delete(n); },
    clear() { for (const s of [...held, ...tapped, touch]) s.clear(); },
    // 1フレームぶんをコントローラーへ
    apply(nes) {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      for (let p = 0; p < 2; p++) {
        const set = new Set([...held[p], ...tapped[p], ...(p === 0 ? touch : [])]);
        const gp = pads[p];
        if (gp) {
          const on = (i) => gp.buttons[i]?.pressed;
          if (on(0)) set.add('A');
          if (on(1) || on(2)) set.add('B');
          if (p === 0 && on(8)) set.add('SELECT');
          if (p === 0 && on(9)) set.add('START');
          if (on(12) || gp.axes[1] < -0.5) set.add('UP');
          if (on(13) || gp.axes[1] > 0.5) set.add('DOWN');
          if (on(14) || gp.axes[0] < -0.5) set.add('LEFT');
          if (on(15) || gp.axes[0] > 0.5) set.add('RIGHT');
          if (p === 1 && on(3)) set.add('MIC');
        }
        let bits = 0;
        for (const b of set) if (BTN[b] !== undefined) bits |= 1 << BTN[b];
        // 左右・上下を同時に押したことにしない（本物の十字キーではできない）
        if ((bits & 0xc0) === 0xc0) bits &= ~0xc0;
        if ((bits & 0x30) === 0x30) bits &= ~0x30;
        nes.pad[p] = bits;
        if (p === 1) nes.mic = set.has('MIC');
        tapped[p].clear();
      }
    },
  };

  addEventListener('keydown', (e) => {
    if (api.capture) { e.preventDefault(); api.capture(e.code); return; }
    if (!api.enabled) return;
    const hit = index.get(e.code);
    if (!hit) return;
    e.preventDefault();
    const [p, b] = hit;
    if (!e.repeat) api.onPress?.(p, b);
    held[p].add(b); tapped[p].add(b);
  });
  addEventListener('keyup', (e) => { const hit = index.get(e.code); if (hit) held[hit[0]].delete(hit[1]); });
  addEventListener('blur', () => api.clear());
  return api;
}
