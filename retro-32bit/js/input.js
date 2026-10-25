// 入力: キー・指・ゲームパッドを、口 1 のパッドにまとめる（8ビット互換機の input.js を小さくしたもの。キーの割り当ての変更は段階E）。
//   ボタンの名前は pad.js の BTN（A＝右・B＝下・X＝左・Y＝上、L・R、START・SELECT）
import { BTN } from './pad.js';

export const DEFAULT_KEYS = {
  UP: ['ArrowUp'], DOWN: ['ArrowDown'], LEFT: ['ArrowLeft'], RIGHT: ['ArrowRight'],
  A: ['KeyX', 'Space'], B: ['KeyZ', 'Backspace'], X: ['KeyA'], Y: ['KeyS'],
  L: ['KeyQ'], R: ['KeyW'], START: ['Enter'], SELECT: ['ShiftLeft', 'ShiftRight'],
};
// 標準のゲームパッドの番号 → ボタン（下・右・左・上の順は、ひし形の B・A・X・Y と同じ場所）
const GAMEPAD = { 0: 'B', 1: 'A', 2: 'X', 3: 'Y', 4: 'L', 5: 'R', 6: 'L2', 7: 'R2', 8: 'SELECT', 9: 'START', 12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT' };

export function createInput() {
  const index = new Map();
  for (const [b, codes] of Object.entries(DEFAULT_KEYS)) for (const c of codes) index.set(c, b);
  const held = new Set(), tapped = new Set(), touch = new Set();
  const api = {
    enabled: true,
    touchDown(names) { for (const n of names) { touch.add(n); tapped.add(n); } },
    touchUp(names) { for (const n of names) touch.delete(n); },
    clear() { held.clear(); tapped.clear(); touch.clear(); },
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
      tapped.clear();
    },
  };
  addEventListener('keydown', (e) => {
    if (!api.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const b = index.get(e.code);
    if (!b) return;
    e.preventDefault();
    held.add(b); tapped.add(b);
  });
  addEventListener('keyup', (e) => { const b = index.get(e.code); if (b) held.delete(b); });
  addEventListener('blur', () => api.clear());
  return api;
}

// 指のボタン（data-btn。"UP RIGHT" のように2つ同時も）。指をすべらせたら押すボタンも替える
export function bindTouch(root, input) {
  const active = new Map(); // pointerId → 押している名前
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
  };
  const up = (e) => { if (!active.has(e.pointerId)) return; input.touchUp(active.get(e.pointerId)); active.delete(e.pointerId); mark(); };
  root.addEventListener('pointerdown', (e) => {
    const n = namesAt(e.clientX, e.clientY);
    if (!n.length) return;
    e.preventDefault();
    active.set(e.pointerId, n); input.touchDown(n); mark();
  });
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}
