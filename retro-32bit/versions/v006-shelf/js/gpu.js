// GPU: 1024×512 の VRAM（1点 16 ビット: 赤緑青 5 ビットずつ＋マスクの 1 ビット）に、三角形・四角形・線をソフトで塗る。
//   GP0 = 描く命令とデータ（1F801810 に書く）、GP1 = 表示の設定（1F801814 に書く）。GPUSTAT は 1F801814 を読む
//   本物の癖をまねる所: Z バッファなし（描いた順）、テクスチャは画面の上でまっすぐ補間（ゆがむ）、グーローとまぜた色はディザ
const DITHER = [-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2];

export class GPU {
  constructor() {
    this.vram = new Uint16Array(1024 * 512);
    this.reset();
  }
  reset() {
    this.cmd = []; this.need = 0;
    this.load = null;      // CPU → VRAM の転送中 { x, y, w, h, i }
    this.store = null;     // VRAM → CPU の転送中
    this.texpage = 0; this.texWin = 0; this.dither = false; this.drawOk = false;
    this.ax0 = 0; this.ay0 = 0; this.ax1 = 0; this.ay1 = 0; // 描ける範囲
    this.ox = 0; this.oy = 0;                              // 描くときにずらす量
    this.maskSet = 0; this.maskCheck = false;
    this.flipX = false; this.flipY = false;
    this.dispX = 0; this.dispY = 0; this.dispOff = true;
    this.hres = 320; this.vres = 240; this.rgb24 = false; this.interlace = false; this.pal = false;
    this.hr1 = 0x200; this.hr2 = 0xc00; this.vr1 = 0x10; this.vr2 = 0x100;
    this.dmaDir = 0; this.odd = 0; this.irq = false;
    this.gpuread = 0;
  }

  stat() {
    const hr = { 256: 0, 320: 1, 512: 2, 640: 3, 368: 0x40 }[this.hres] ?? 1;
    let s = (this.texpage & 0x7ff) | (this.maskSet << 11) | (this.maskCheck ? 1 << 12 : 0)
      | (this.interlace ? 1 << 13 : 0) | ((hr & 3) << 17) | ((hr >> 6) << 16) | (this.vres === 480 ? 1 << 19 : 0)
      | (this.pal ? 1 << 20 : 0) | (this.rgb24 ? 1 << 21 : 0) | (this.interlace ? 1 << 22 : 0)
      | (this.dispOff ? 1 << 23 : 0) | (this.irq ? 1 << 24 : 0)
      | (1 << 26) | (1 << 28) | (this.store ? 1 << 27 : 0) | (this.dmaDir << 29) | (this.odd << 31);
    // 25 番: DMA の合図（向きによって中身がかわる）
    if (this.dmaDir === 1 || this.dmaDir === 2) s |= 1 << 25;
    else if (this.dmaDir === 3 && this.store) s |= 1 << 25;
    return s >>> 0;
  }

  read() {
    if (!this.store) return this.gpuread;
    const t = this.store; let v = 0;
    for (let k = 0; k < 2; k++) {
      const px = this.vram[((t.y + Math.floor(t.i / t.w)) & 511) * 1024 + ((t.x + t.i % t.w) & 1023)];
      v |= px << (16 * k);
      if (++t.i >= t.w * t.h) { this.store = null; break; }
    }
    return v >>> 0;
  }

  gp1(v) {
    const c = v >>> 24;
    switch (c) {
      case 0x00: { const vr = this.vram; this.reset(); this.vram = vr; break; }
      case 0x01: this.cmd = []; this.need = 0; this.load = null; break;
      case 0x02: this.irq = false; break;
      case 0x03: this.dispOff = (v & 1) !== 0; break;
      case 0x04: this.dmaDir = v & 3; break;
      case 0x05: this.dispX = v & 0x3fe; this.dispY = (v >> 10) & 0x1ff; break;
      case 0x06: this.hr1 = v & 0xfff; this.hr2 = (v >> 12) & 0xfff; break;
      case 0x07: this.vr1 = v & 0x3ff; this.vr2 = (v >> 10) & 0x3ff; break;
      case 0x08:
        this.hres = (v & 0x40) ? 368 : [256, 320, 512, 640][v & 3];
        this.pal = (v & 8) !== 0; this.rgb24 = (v & 0x10) !== 0; this.interlace = (v & 0x20) !== 0;
        this.vres = (v & 4) && this.interlace ? 480 : 240;
        break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17:
      case 0x18: case 0x19: case 0x1a: case 0x1b: case 0x1c: case 0x1d: case 0x1e: case 0x1f:
        switch (v & 7) {
          case 2: this.gpuread = this.texWin; break;
          case 3: this.gpuread = this.ax0 | (this.ay0 << 10); break;
          case 4: this.gpuread = this.ax1 | (this.ay1 << 10); break;
          case 5: this.gpuread = (this.ox & 0x7ff) | ((this.oy & 0x7ff) << 11); break;
          case 7: this.gpuread = 2; break;
        }
        break;
    }
  }

  gp0(v) {
    v >>>= 0;
    if (this.load) { this.loadWord(v); return; }
    if (this.need === 0) {
      const c = v >>> 24;
      this.cmd = [v];
      this.need = cmdLen(c, v);
      this.poly = (c >= 0x48 && c < 0x60 && (c & 8)); // 線の続き（終わりの印まで）
    } else this.cmd.push(v);
    if (this.poly && this.cmd.length > 1 && (v & 0xf000f000) === 0x50005000 && this.cmd.length >= this.need) { this.lines(); this.need = 0; return; }
    if (!this.poly && this.cmd.length >= this.need) { this.run(); this.need = 0; }
  }

  run() {
    const w = this.cmd, c = w[0] >>> 24;
    if (c >= 0x20 && c < 0x40) this.polygon(c, w);
    else if (c >= 0x40 && c < 0x60) this.lines();
    else if (c >= 0x60 && c < 0x80) this.rect(c, w);
    else if (c >= 0x80 && c < 0xa0) this.copy(w);
    else if (c >= 0xa0 && c < 0xc0) {
      const x = w[1] & 0x3ff, y = (w[1] >> 16) & 0x1ff;
      const ww = ((w[2] & 0xffff) - 1 & 0x3ff) + 1, hh = (((w[2] >>> 16) - 1) & 0x1ff) + 1;
      this.load = { x, y, w: ww, h: hh, i: 0, n: ww * hh };
    } else if (c >= 0xc0 && c < 0xe0) {
      const x = w[1] & 0x3ff, y = (w[1] >> 16) & 0x1ff;
      const ww = ((w[2] & 0xffff) - 1 & 0x3ff) + 1, hh = (((w[2] >>> 16) - 1) & 0x1ff) + 1;
      this.store = { x, y, w: ww, h: hh, i: 0 };
    } else switch (c) {
      case 0x02: this.fill(w); break;
      case 0x1f: this.irq = true; break;
      case 0xe1:
        this.texpage = w[0] & 0x7ff; this.dither = (w[0] & 0x200) !== 0; this.drawOk = (w[0] & 0x400) !== 0;
        this.flipX = (w[0] & 0x1000) !== 0; this.flipY = (w[0] & 0x2000) !== 0; break;
      case 0xe2: this.texWin = w[0] & 0xfffff; break;
      case 0xe3: this.ax0 = w[0] & 0x3ff; this.ay0 = (w[0] >> 10) & 0x1ff; break;
      case 0xe4: this.ax1 = w[0] & 0x3ff; this.ay1 = (w[0] >> 10) & 0x1ff; break;
      case 0xe5: this.ox = (w[0] << 21) >> 21; this.oy = (w[0] << 10) >> 21; break;
      case 0xe6: this.maskSet = w[0] & 1; this.maskCheck = (w[0] & 2) !== 0; break;
    }
  }

  loadWord(v) {
    const t = this.load;
    for (let k = 0; k < 2 && t.i < t.n; k++, t.i++) {
      const x = (t.x + t.i % t.w) & 1023, y = (t.y + Math.floor(t.i / t.w)) & 511, a = y * 1024 + x;
      if (this.maskCheck && (this.vram[a] & 0x8000)) continue;
      this.vram[a] = ((v >>> (16 * k)) & 0xffff) | (this.maskSet << 15);
    }
    if (t.i >= t.n) this.load = null;
  }

  fill(w) { // 描ける範囲・マスクに関係なく塗る（x は 16 の倍数にそろう）
    const col = c15(w[0]), x0 = w[1] & 0x3f0, y0 = (w[1] >> 16) & 0x1ff;
    const ww = ((w[2] & 0x3ff) + 15) & ~15, hh = (w[2] >>> 16) & 0x1ff;
    for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) this.vram[((y0 + y) & 511) * 1024 + ((x0 + x) & 1023)] = col;
  }

  copy(w) {
    const sx = w[1] & 0x3ff, sy = (w[1] >> 16) & 0x1ff, dx = w[2] & 0x3ff, dy = (w[2] >> 16) & 0x1ff;
    const ww = ((w[3] & 0xffff) - 1 & 0x3ff) + 1, hh = (((w[3] >>> 16) - 1) & 0x1ff) + 1;
    for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) {
      const a = ((dy + y) & 511) * 1024 + ((dx + x) & 1023);
      if (this.maskCheck && (this.vram[a] & 0x8000)) continue;
      this.vram[a] = this.vram[((sy + y) & 511) * 1024 + ((sx + x) & 1023)] | (this.maskSet << 15);
    }
  }

  // ---- 点を置く（マスク・半透明） ----
  plot(x, y, col, semi, mode) {
    const a = y * 1024 + x, d = this.vram[a];
    if (this.maskCheck && (d & 0x8000)) return;
    if (semi) {
      const br = d & 31, bg = (d >> 5) & 31, bb = (d >> 10) & 31;
      let fr = col & 31, fg = (col >> 5) & 31, fb = (col >> 10) & 31;
      if (mode === 0) { fr = (br + fr) >> 1; fg = (bg + fg) >> 1; fb = (bb + fb) >> 1; }
      else if (mode === 1) { fr = Math.min(31, br + fr); fg = Math.min(31, bg + fg); fb = Math.min(31, bb + fb); }
      else if (mode === 2) { fr = Math.max(0, br - fr); fg = Math.max(0, bg - fg); fb = Math.max(0, bb - fb); }
      else { fr = Math.min(31, br + (fr >> 2)); fg = Math.min(31, bg + (fg >> 2)); fb = Math.min(31, bb + (fb >> 2)); }
      col = (col & 0x8000) | fr | (fg << 5) | (fb << 10);
    }
    this.vram[a] = col | (this.maskSet << 15);
  }

  // テクスチャの1点（0 なら透明＝-1）。texpage と CLUT から
  texel(u, v, tp, clut) {
    const tw = this.texWin;
    const mx = (tw & 31) * 8, my = ((tw >> 5) & 31) * 8, wx = ((tw >> 10) & 31) * 8, wy = ((tw >> 15) & 31) * 8;
    u = (u & ~mx) | (wx & mx); v = (v & ~my) | (wy & my);
    u &= 255; v &= 255;
    const bx = (tp & 15) * 64, by = ((tp >> 4) & 1) * 256, depth = (tp >> 7) & 3;
    let px;
    if (depth === 0) {
      const w = this.vram[(by + v) * 1024 + ((bx + (u >> 2)) & 1023)], i = (w >> ((u & 3) * 4)) & 15;
      px = this.vram[((clut >> 6) & 511) * 1024 + (((clut & 63) * 16 + i) & 1023)];
    } else if (depth === 1) {
      const w = this.vram[(by + v) * 1024 + ((bx + (u >> 1)) & 1023)], i = (w >> ((u & 1) * 8)) & 255;
      px = this.vram[((clut >> 6) & 511) * 1024 + (((clut & 63) * 16 + i) & 1023)];
    } else px = this.vram[((by + v) & 511) * 1024 + ((bx + u) & 1023)];
    return px === 0 ? -1 : px;
  }
}

// GP0 の命令の語の数（線の続きは最低の数）
function cmdLen(c, v) {
  if (c >= 0x20 && c < 0x40) {
    const n = c & 8 ? 4 : 3, per = 1 + (c & 4 ? 1 : 0) + (c & 0x10 ? 1 : 0);
    return 1 + n * per - (c & 0x10 ? 1 : 0);
  }
  if (c >= 0x40 && c < 0x60) return c & 0x10 ? 4 : 3;
  if (c >= 0x60 && c < 0x80) return 2 + (c & 4 ? 1 : 0) + ((c & 0x18) === 0 ? 1 : 0);
  if (c >= 0x80 && c < 0xa0) return 4;
  if (c >= 0xa0 && c < 0xe0) return 3;
  if (c === 0x02) return 3;
  return 1;
}

// 24 ビットの色 → 15 ビット
export function c15(v) { return ((v >> 3) & 31) | (((v >> 11) & 31) << 5) | (((v >> 19) & 31) << 10); }
export { DITHER };
