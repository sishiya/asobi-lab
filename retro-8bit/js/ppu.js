// PPU: 絵の係（2C02 互換）。1行ずつ描く（行の途中のスクロールの変化は行の単位でだけ効く）。行はドット 1 でまとめて描き、
// 0番の当たりの印は、本物と同じく当たったドットで立てる（テスト ROM の sprite hit timing に合わせた）。
// 1フレーム = 262行 × 341ドット。0〜239 が見える行、241 で垂直帰線（NMI）、261 が描く前の準備の行
import { PALETTE } from './palette.js';

export class PPU {
  constructor(cart) {
    this.cart = cart;
    this.vram = cart.ciram;   // 画面の表の RAM はカセットの側に置く（マッパーが表の割りあてを変える）
    cart.ppu = this;
    this.pal = new Uint8Array(32);
    this.oam = new Uint8Array(256);
    this.frame = new Uint32Array(256 * 240); // RGBA（リトルエンディアンで ABGR）
    this.reset();
  }
  reset() {
    this.ctrl = 0; this.mask = 0; this.status = 0; this.oamAddr = 0;
    this.v = 0; this.t = 0; this.fx = 0; this.w = 0; this.buf = 0;
    this.line = 0; this.dot = 0; this.frameDone = false; this.frames = 0;
    this.nmiOut = null; // NMI を CPU に知らせる関数
  }
  get rendering() { return (this.mask & 0x18) !== 0; }

  // --- PPU の番地（$0000〜$3FFF） ---
  read(a) {
    a &= 0x3fff;
    if (a < 0x2000) return this.cart.chrRead(a);
    if (a < 0x3f00) return this.cart.ntRead(a);
    return this.pal[palIndex(a)];
  }
  write(a, v) {
    a &= 0x3fff;
    if (a < 0x2000) this.cart.chrWrite(a, v);
    else if (a < 0x3f00) this.cart.ntWrite(a, v);
    else this.pal[palIndex(a)] = v & 0x3f;
  }

  // --- CPU から見えるレジスタ $2000〜$2007 ---
  readReg(r) {
    switch (r) {
      case 2: {
        const s = this.status;
        this.status &= 0x7f; this.w = 0;
        return s;
      }
      case 4: return this.oam[this.oamAddr];
      case 7: {
        let d;
        if ((this.v & 0x3fff) >= 0x3f00) { d = this.read(this.v); this.buf = this.read(this.v - 0x1000); }
        else { d = this.buf; this.buf = this.read(this.v); }
        this.v = (this.v + ((this.ctrl & 4) ? 32 : 1)) & 0x7fff;
        return d;
      }
    }
    return 0;
  }
  writeReg(r, d) {
    switch (r) {
      case 0: {
        const was = this.ctrl & 0x80;
        this.ctrl = d; this.t = (this.t & 0x73ff) | ((d & 3) << 10);
        // 帰線のあいだに NMI を許すと、すぐ NMI
        if (!was && (d & 0x80) && (this.status & 0x80) && this.nmiOut) this.nmiOut();
        break;
      }
      case 1: this.mask = d; break;
      case 3: this.oamAddr = d; break;
      case 4: this.oam[this.oamAddr] = d; this.oamAddr = (this.oamAddr + 1) & 0xff; break;
      case 5:
        if (!this.w) { this.t = (this.t & 0x7fe0) | (d >> 3); this.fx = d & 7; this.w = 1; }
        else { this.t = (this.t & 0x0c1f) | ((d & 7) << 12) | ((d & 0xf8) << 2); this.w = 0; }
        break;
      case 6:
        if (!this.w) { this.t = (this.t & 0x00ff) | ((d & 0x3f) << 8); this.w = 1; }
        else { this.t = (this.t & 0x7f00) | d; this.v = this.t; this.w = 0; }
        break;
      case 7:
        this.write(this.v, d);
        this.v = (this.v + ((this.ctrl & 4) ? 32 : 1)) & 0x7fff;
        break;
    }
  }

  // n ドット進める
  step(n) {
    while (n-- > 0) {
      this.dot++;
      if (this.dot > 340) {
        this.dot = 0; this.line++;
        if (this.line > 261) { this.line = 0; this.frameDone = true; this.frames++; }
      }
      const L = this.line, D = this.dot;
      if (L < 240) {
        if (D === 1) this.renderLine(L);
        else if (D === this.hitDot) this.status |= 0x40;
        if (D === 256 && this.rendering) this.incY();
        if (D === 257 && this.rendering) this.copyX();
        else if (D === 260 && this.rendering) this.cart.scanline?.(L);
      } else if (L === 241) {
        if (D === 1) { this.status |= 0x80; if ((this.ctrl & 0x80) && this.nmiOut) this.nmiOut(); }
      } else if (L === 261) {
        if (D === 1) this.status &= 0x1f;
        else if (D === 256 && this.rendering) this.incY();
        else if (D === 257 && this.rendering) this.copyX();
        else if (D === 260 && this.rendering) this.cart.scanline?.(L);   // 準備の行も数える（MMC3・MMC5）
        else if (D === 280 && this.rendering) this.v = (this.v & 0x041f) | (this.t & 0x7be0);
      }
    }
  }
  copyX() { this.v = (this.v & 0x7be0) | (this.t & 0x041f); }
  incY() {
    let v = this.v;
    if ((v & 0x7000) !== 0x7000) v += 0x1000;
    else {
      v &= 0x0fff;
      let y = (v >> 5) & 31;
      if (y === 29) { y = 0; v ^= 0x0800; } else if (y === 31) y = 0; else y++;
      v = (v & 0x7c1f) | (y << 5);
    }
    this.v = v;
  }

  renderLine(y) {
    const out = this.frame, row = y * 256;
    const bgOn = this.mask & 0x08, spOn = this.mask & 0x10;
    const bgLeft = this.mask & 0x02, spLeft = this.mask & 0x04;
    const gray = (this.mask & 1) ? 0x30 : 0x3f;
    const bgPix = this.lineBg || (this.lineBg = new Uint8Array(256)); // 0 = すきとおり、ほかは パレットの番号(1〜15)
    this.hitDot = -1;
    bgPix.fill(0);

    const cart = this.cart, exBg = cart.exBg;   // exBg: MMC5 の拡張の色（1マスごとの CHR とパレット）
    if (bgOn) {
      cart.fetch = 1;
      const v = this.v;
      let cx = v & 31, nt = (v >> 10) & 3;
      const cy = (v >> 5) & 31, fy = (v >> 12) & 7;
      const base = (this.ctrl & 0x10) ? 0x1000 : 0;
      let x = -this.fx;
      for (let t = 0; t < 33; t++) {
        const ntAddr = 0x2000 | (nt << 10) | (cy << 5) | cx;
        const tile = this.read(ntAddr);
        const at = this.read(0x23c0 | (nt << 10) | ((cy >> 2) << 3) | (cx >> 2));
        const shift = ((cy & 2) << 1) | (cx & 2);
        let hi2 = ((at >> shift) & 3) << 2;
        const p = base + tile * 16 + fy;
        let lo, hi;
        const e = exBg ? exBg(ntAddr, p) : -1;
        if (e >= 0) { hi2 = (e >> 16) << 2; lo = (e >> 8) & 0xff; hi = e & 0xff; }
        else { lo = this.read(p); hi = this.read(p + 8); }
        for (let b = 0; b < 8; b++, x++) {
          if (x < 0 || x > 255) continue;
          const c = ((lo >> (7 - b)) & 1) | (((hi >> (7 - b)) & 1) << 1);
          if (c && (bgLeft || x >= 8)) bgPix[x] = hi2 | c;
        }
        if (++cx === 32) { cx = 0; nt ^= 1; }
      }
    }

    // まず背景の色で塗る
    for (let x = 0; x < 256; x++) out[row + x] = PALETTE[this.pal[bgPix[x] ? bgPix[x] : 0] & gray];

    if (spOn) {
      cart.fetch = 2;
      const h = (this.ctrl & 0x20) ? 16 : 8;
      // その行に乗る絵（スプライト）を前から8つまで
      const list = [];
      for (let i = 0; i < 64; i++) {
        const r = y - (this.oam[i * 4] + 1);
        if (r >= 0 && r < h) {
          if (list.length === 8) { this.status |= 0x20; break; }
          list.push(i);
        }
      }
      // 番号の大きい方から描き、小さい番号が上に来る
      const drawn = this.lineSp || (this.lineSp = new Uint8Array(256));
      drawn.fill(0);
      for (const i of list) {
        const o = i * 4, attr = this.oam[o + 2], sx = this.oam[o + 3];
        let r = y - (this.oam[o] + 1);
        if (attr & 0x80) r = h - 1 - r;
        let tile = this.oam[o + 1], base;
        if (h === 16) { base = (tile & 1) ? 0x1000 : 0; tile &= 0xfe; if (r > 7) { tile++; r -= 8; } }
        else base = (this.ctrl & 0x08) ? 0x1000 : 0;
        const p = base + tile * 16 + r;
        const lo = this.read(p), hi = this.read(p + 8);
        for (let b = 0; b < 8; b++) {
          const x = sx + b;
          if (x > 255) break;
          const bit = (attr & 0x40) ? b : 7 - b;
          const c = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
          if (!c || drawn[x] || (!spLeft && x < 8)) continue;
          drawn[x] = 1;
          if (i === 0 && bgPix[x] && x !== 255 && this.hitDot < 0 && !(this.status & 0x40)) this.hitDot = x + 2; // 0番の当たり（そのドットで印を立てる）
          if ((attr & 0x20) && bgPix[x]) continue; // 背景のうしろ
          out[row + x] = PALETTE[this.pal[0x10 | ((attr & 3) << 2) | c] & gray];
        }
      }
    }
    cart.fetch = 0;
  }
}

function palIndex(a) {
  let i = a & 0x1f;
  if (i >= 0x10 && (i & 3) === 0) i -= 0x10;
  return i;
}
