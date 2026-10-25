// GPU の塗り: 三角形（四角は三角形2つ）・四角形（スプライト）・線。gpu.js の GPU に足す
import { GPU, DITHER } from './gpu.js';

const sx11 = (v) => (v << 21) >> 21;

Object.assign(GPU.prototype, {
  polygon(c, w) {
    const quad = c & 8, tex = c & 4, gour = c & 0x10, semi = c & 2, raw = c & 1;
    const n = quad ? 4 : 3, vs = [];
    let i = 1, clut = 0, tp = this.texpage;
    for (let k = 0; k < n; k++) {
      const col = k === 0 || !gour ? w[0] : w[i++];
      const xy = w[i++];
      const v = { x: sx11(xy) + this.ox, y: sx11(xy >> 16) + this.oy, r: col & 255, g: (col >> 8) & 255, b: (col >> 16) & 255, u: 0, v: 0 };
      if (tex) {
        const uv = w[i++];
        v.u = uv & 255; v.v = (uv >> 8) & 255;
        if (k === 0) clut = uv >>> 16;
        if (k === 1) { tp = (uv >>> 16) & 0x9ff; this.texpage = (this.texpage & ~0x9ff) | tp; }
      }
      vs.push(v);
    }
    const o = { tex, gour, semi, raw, clut, tp, mode: (tp >> 5) & 3, dith: this.dither && (gour || (tex && !raw)) };
    this.tri(vs[0], vs[1], vs[2], o);
    if (quad) this.tri(vs[1], vs[2], vs[3], o);
  },

  tri(a, b, c, o) {
    // 大きすぎる三角形は描かない（本物と同じ）
    const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x);
    const minY = Math.min(a.y, b.y, c.y), maxY = Math.max(a.y, b.y, c.y);
    if (maxX - minX > 1023 || maxY - minY > 511) return;
    let area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (area === 0) return;
    if (area < 0) { const t = b; b = c; c = t; area = -area; }
    const x0 = Math.max(minX, this.ax0), x1 = Math.min(maxX, this.ax1);
    const y0 = Math.max(minY, this.ay0), y1 = Math.min(maxY, this.ay1);
    if (x0 > x1 || y0 > y1) return;
    // 辺の式 E(p) = (q.x - p0.x)(p.y - p0.y) - (q.y - p0.y)(p.x - p0.x)。上と左の辺の上の点だけ入れる
    const edges = [[b, c], [c, a], [a, b]].map(([p, q]) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      const topLeft = dy < 0 || (dy === 0 && dx > 0);
      return { p, dx, dy, bias: topLeft ? 0 : -1 };
    });
    const [e0, e1, e2] = edges;
    const inv = 1 / area;
    const { tex, gour, semi, raw, clut, tp, mode, dith } = o;
    for (let y = y0; y <= y1; y++) {
      let w0 = e0.dx * (y - e0.p.y) - e0.dy * (x0 - e0.p.x);
      let w1 = e1.dx * (y - e1.p.y) - e1.dy * (x0 - e1.p.x);
      let w2 = e2.dx * (y - e2.p.y) - e2.dy * (x0 - e2.p.x);
      for (let x = x0; x <= x1; x++, w0 -= e0.dy, w1 -= e1.dy, w2 -= e2.dy) {
        if (w0 + e0.bias < 0 || w1 + e1.bias < 0 || w2 + e2.bias < 0) continue;
        // w0 は a の重み（辺 b-c の向かい）
        const l0 = w0 * inv, l1 = w1 * inv, l2 = w2 * inv;
        let r = a.r, g = a.g, bl = a.b;
        if (gour) { r = l0 * a.r + l1 * b.r + l2 * c.r; g = l0 * a.g + l1 * b.g + l2 * c.g; bl = l0 * a.b + l1 * b.b + l2 * c.b; }
        let col, isSemi = semi;
        if (tex) {
          const t = this.texel(Math.floor(l0 * a.u + l1 * b.u + l2 * c.u + 0.5), Math.floor(l0 * a.v + l1 * b.v + l2 * c.v + 0.5), tp, clut);
          if (t < 0) continue;
          isSemi = semi && (t & 0x8000);
          col = raw ? t : this.modulate(t, r, g, bl, dith, x, y);
        } else col = this.shade(r, g, bl, dith, x, y);
        this.plot(x, y, col, isSemi, mode);
      }
    }
  },

  shade(r, g, b, dith, x, y) {
    if (dith) { const d = DITHER[(y & 3) * 4 + (x & 3)]; r += d; g += d; b += d; }
    const q = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0) >> 3;
    return q(r) | (q(g) << 5) | (q(b) << 10);
  },

  // テクスチャの色 × 頂点の色 / 128（128 でそのまま）
  modulate(t, r, g, b, dith, x, y) {
    return (t & 0x8000) | this.shade((t & 31) * r / 16, ((t >> 5) & 31) * g / 16, ((t >> 10) & 31) * b / 16, dith, x, y);
  },

  rect(c, w) {
    const tex = c & 4, semi = c & 2, raw = c & 1, size = (c >> 3) & 3;
    const col = w[0];
    let x = sx11(w[1]) + this.ox, y = sx11(w[1] >> 16) + this.oy;
    let i = 2, u0 = 0, v0 = 0, clut = 0;
    if (tex) { u0 = w[2] & 255; v0 = (w[2] >> 8) & 255; clut = w[2] >>> 16; i++; }
    let ww, hh;
    if (size === 0) { ww = w[i] & 0x3ff; hh = (w[i] >>> 16) & 0x1ff; }
    else ww = hh = [0, 1, 8, 16][size];
    const r = col & 255, g = (col >> 8) & 255, b = (col >> 16) & 255, tp = this.texpage, mode = (tp >> 5) & 3;
    for (let dy = 0; dy < hh; dy++) {
      const py = y + dy; if (py < this.ay0 || py > this.ay1) continue;
      for (let dx = 0; dx < ww; dx++) {
        const px = x + dx; if (px < this.ax0 || px > this.ax1) continue;
        let out, isSemi = semi;
        if (tex) {
          const t = this.texel(this.flipX ? u0 - dx : u0 + dx, this.flipY ? v0 - dy : v0 + dy, tp, clut);
          if (t < 0) continue;
          isSemi = semi && (t & 0x8000);
          out = raw ? t : this.modulate(t, r, g, b, false, px, py);
        } else out = this.shade(r, g, b, false, px, py);
        this.plot(px, py, out, isSemi, mode);
      }
    }
  },

  lines() {
    const w = this.cmd, c = w[0] >>> 24, gour = c & 0x10, semi = c & 2, poly = c & 8;
    const end = poly ? w.length - 1 : w.length;
    const pts = [];
    let i = 1;
    while (i < end) {
      const col = pts.length === 0 || !gour ? w[0] : w[i++];
      if (i >= end) break;
      const xy = w[i++];
      pts.push({ x: sx11(xy) + this.ox, y: sx11(xy >> 16) + this.oy, r: col & 255, g: (col >> 8) & 255, b: (col >> 16) & 255 });
    }
    const mode = (this.texpage >> 5) & 3;
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 1023 || Math.abs(dy) > 511) continue;
      const n = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 0; s <= n; s++) {
        const t = n ? s / n : 0;
        const x = Math.round(a.x + dx * t), y = Math.round(a.y + dy * t);
        if (x < this.ax0 || x > this.ax1 || y < this.ay0 || y > this.ay1) continue;
        const r = gour ? a.r + (b.r - a.r) * t : a.r, g = gour ? a.g + (b.g - a.g) * t : a.g, bl = gour ? a.b + (b.b - a.b) * t : a.b;
        this.plot(x, y, this.shade(r, g, bl, this.dither && gour, x, y), semi, mode);
      }
    }
  },
});
