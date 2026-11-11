// 画面の指とマウス（育てるのフリーカメラ・でかけるで共通）: さわって離す＝tap、1本で動かす＝drag、2本指かホイール＝zoom（1 より大きいと引く）。8px より動いたらタップにしない
export function gesture(el, { on, tap, drag, zoom }) {
  const pts = new Map(); let moved = false, from = null, span = 0;
  const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  el.addEventListener('pointerdown', e => { if (!on() || (e.pointerType === 'mouse' && e.button !== 0)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { moved = false; from = { x: e.clientX, y: e.clientY }; } else { moved = true; if (pts.size === 2) span = gap(); } });
  addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { if (!moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 8) moved = true; if (moved) drag(dx, dy); }
    else if (pts.size === 2) { const g = gap(); zoom(span / g); span = g; }
  });
  const up = e => { if (!pts.delete(e.pointerId)) return; if (!pts.size && !moved && e.type === 'pointerup') tap?.(e); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  const clear = () => pts.clear(); addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
  el.addEventListener('wheel', e => { if (!on()) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
}
