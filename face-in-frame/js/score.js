// 似ているかの点。部位ごとに 0〜1、合計は 0〜100。
// きびしくしすぎない: 表情の数で 0.35、首で 25 度・向き 0.6 ずれると 0 になる（それより近ければ点が入る）。
export const PARTS = [
  { id: 'mouth', name: '口', name_en: 'Mouth', keys: ['jaw', 'smile', 'frown', 'round'] },
  { id: 'brow', name: '眉', name_en: 'Brows', keys: ['browUp', 'browDown'] },
  { id: 'eye', name: '目', name_en: 'Eyes', keys: ['eyeWide', 'eyeNarrow'] },
  { id: 'head', name: '首', name_en: 'Head' },
];

const clamp01 = v => Math.max(0, Math.min(1, v));

export function scoreFace(face, p) {
  if (!face) return { total: 0, parts: [], missing: true };
  const parts = [];
  for (const part of PARTS) {
    if (part.keys) {
      if (!part.keys.some(k => k in p.goal)) continue;
      let sum = 0, wsum = 0;
      for (const k of part.keys) {
        const w = k in p.goal ? 1 : 0.5;
        const d = face.ex[k] - (p.goal[k] || 0);
        sum += w * d * d; wsum += w;
      }
      parts.push({ id: part.id, name: part.name, name_en: part.name_en, v: clamp01(1 - Math.sqrt(sum / wsum) / 0.35) });
    } else {
      const vs = [];
      if (p.roll != null) vs.push(clamp01(1 - Math.abs(face.roll - p.roll) / 25));
      if (p.yaw != null) vs.push(clamp01(1 - Math.abs(face.yaw - p.yaw) / 0.6));
      if (vs.length) parts.push({ id: part.id, name: part.name, name_en: part.name_en, v: vs.reduce((a, b) => a + b) / vs.length });
    }
  }
  // 表情の部位は首より重く見る
  let s = 0, ws = 0;
  for (const q of parts) { const w = q.id === 'head' ? 0.6 : 1; s += q.v * w; ws += w; }
  return { total: Math.round(ws ? s / ws * 100 : 0), parts };
}

export const mark = v => v >= 0.75 ? '◎' : v >= 0.45 ? '○' : '△';

// 何まいかの表情の数をならす（シャッターの直前の少しの間）
export function averageFaces(list) {
  const fs = list.filter(Boolean);
  if (!fs.length) return null;
  const ex = {};
  for (const k of Object.keys(fs[0].ex)) ex[k] = fs.reduce((a, f) => a + f.ex[k], 0) / fs.length;
  return { ex, roll: fs.reduce((a, f) => a + f.roll, 0) / fs.length, yaw: fs.reduce((a, f) => a + f.yaw, 0) / fs.length };
}
