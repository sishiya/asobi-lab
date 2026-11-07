// 本物の跳び方の手本（模倣の点数）。ぴったりの数でなく「順番と、そろい・ずれの形」で合わせる（生き物監修）
// 手本: ウサギ科のハーフバウンド。前足は左右交互、後ろ足は左右同時（アナウサギ Carneiro ら 2021）。前足のつく時間は後ろ足より短い（Hildebrand 1977）。
// 後ろ足の左右のずれ 6.7〜20 ms（ナキウサギ Schilling & Hackert 2006）→ 周の約5%以内。背中は後ろ足が着く前に丸め、はなれたあとに伸ばす（同）。
// 歩数は約4回/秒（仮置き。種がはっきりしない）。ノウサギ属の足ごとの数は確かめられていない（DEVNOTES）
export const HOP = { freq: 4, hindSync: 0.05, foreStagger: [0.03, 0.25] };

// events: [{ t, key: 'fL'|'fR'|'hL'|'hR', down: true/false, spine }]。いちばん長くついていた足ほど…などを 0..1 にして平均
export function shape(events, dur, ref = HOP) {
  const td = k => events.filter(e => e.key === k && e.down), hl = td('hL'), hr = td('hR'), fl = td('fL'), fr = td('fR');
  if (hl.length < 3 || hr.length < 3 || fl.length < 2 || fr.length < 2) return { score: 0, parts: {} };
  const near = (e, list) => list.reduce((m, x) => Math.abs(x.t - e.t) < Math.abs(m.t - e.t) ? x : m, list[0]);
  // 周: 後ろ足が着く間かく
  const per = hl.slice(1).map((e, i) => e.t - hl[i].t), T = per.sort((a, b) => a - b)[per.length >> 1];
  // ① 後ろ足は左右同時
  const hs = hl.map(e => Math.abs(near(e, hr).t - e.t) / T), s1 = Math.exp(-(((hs.reduce((a, b) => a + b, 0) / hs.length) / ref.hindSync) ** 2));
  // ② 前足は左右をずらす
  const fs = fl.map(e => Math.abs(near(e, fr).t - e.t) / T), fm = fs.reduce((a, b) => a + b, 0) / fs.length, [a, b] = ref.foreStagger;
  const s2 = fm < a ? fm / a : fm > b ? Math.exp(-(((fm - b) / 0.1) ** 2)) : 1;
  // ③ 順番: 後ろ足が着くまでのあいだに、前足が左右とも着いている
  let ok = 0; for (let i = 1; i < hl.length; i++) { const t0 = hl[i - 1].t, t1 = hl[i].t, has = l => l.some(e => e.t > t0 && e.t < t1); if (has(fl) && has(fr)) ok++; }
  const s3 = ok / (hl.length - 1);
  // ④ 後ろ足のほうが長くつく
  const duty = k => { let on = 0, last = null; for (const e of events.filter(x => x.key === k)) { if (e.down) last = e.t; else if (last != null) { on += e.t - last; last = null; } } return on / dur; };
  const s4 = duty('hL') + duty('hR') > duty('fL') + duty('fR') ? 1 : 0.3;
  // ⑤ 背中: 後ろ足が着くときは丸く、はなれたあとは伸びている
  const up = events.filter(e => (e.key === 'hL' || e.key === 'hR') && !e.down), downS = hl.map(e => e.spine), upS = up.map(e => e.spine), avg = l => l.reduce((x, y) => x + y, 0) / Math.max(1, l.length);
  const s5 = avg(downS) < avg(upS) ? 1 : 0.3; // 丸める＝胸が下がる向き（負）
  // ⑥ 歩数
  const s6 = Math.exp(-(((1 / T - ref.freq) / 1.5) ** 2));
  const parts = { 後ろそろう: s1, 前ずれる: s2, 順番: s3, 後ろ長く: s4, 背中: s5, 歩数: s6 };
  return { score: (s1 + s2 + s3 + s4 + s5 + s6) / 6, parts, freq: 1 / T };
}
