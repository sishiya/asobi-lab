// 本体: メモリの地図・割りこみ・DMA・タイマー・1こまの進め方・実行ファイルの読みこみ。
//   メモリ: RAM 2MB（00000000〜、8MB までくり返し）・スクラッチパッド 1KB（1F800000）・I/O（1F801000〜）・BIOS の場所（1FC00000。空のまま）
//   KUSEG・KSEG0（80000000〜）・KSEG1（A0000000〜）は同じ物を指す。FFFE0130 などのキャッシュの設定は受け流す
import { CPU } from './cpu.js';
import { GPU } from './gpu.js';
import { GTE } from './gte.js';
import { SIO } from './pad.js';
import { SPU } from './spu.js';
import './raster.js';

export const CLOCK = 33868800;               // 1秒のサイクル
const LINES = 263, VBLANK_LINE = 240;        // NTSC
const CYC_LINE = Math.round(CLOCK / 60 / LINES);
const CPI = 2;                               // 1命令を 2 サイクルとみなす（PLAN.md 3章）
export const IRQ = { VBLANK: 0, GPU: 1, CDROM: 2, DMA: 3, TMR0: 4, TMR1: 5, TMR2: 6, PAD: 7, SPU: 9 };

export class Console32 {
  constructor(sampleRate = 48000) {
    this.spu = new SPU(sampleRate);
    this.spuFrac = 0;
    this.ram = new Uint8Array(2 * 1024 * 1024);
    this.ram32 = new Int32Array(this.ram.buffer);
    this.ram16 = new Uint16Array(this.ram.buffer);
    this.scratch = new Uint8Array(1024);
    this.sdv = new DataView(this.scratch.buffer);
    this.gpu = new GPU();
    this.cpu = new CPU(this);
    this.cpu.gte = new GTE();
    this.sio = new SIO(() => this.raise(IRQ.PAD));
    this.istat = 0; this.imask = 0;
    this.dma = Array.from({ length: 7 }, () => ({ madr: 0, bcr: 0, chcr: 0 }));
    this.dpcr = 0x07654321; this.dicr = 0;
    this.tmr = Array.from({ length: 3 }, () => ({ count: 0, mode: 0, target: 0, frac: 0 }));
    this.frame = 0; this.line = 0;
    this.lastError = null;
    this.tty = '';               // ソフトが BIOS の文字出し（A0/B0 の putchar）を呼んだとき、ここにためる
  }

  // ---- 実行ファイルを置いて、そこから動かす（BIOS を通らない。PLAN.md 0章） ----
  loadExe(buf) {
    const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const magic = String.fromCharCode(...b.subarray(0, 8));
    if (magic !== 'PS-X EXE') throw new Error('実行ファイルの形ではありません');
    const pc = dv.getUint32(0x10, true), gp = dv.getUint32(0x14, true);
    const dst = dv.getUint32(0x18, true), size = dv.getUint32(0x1c, true);
    const sp = dv.getUint32(0x30, true) + dv.getUint32(0x34, true);
    if ((dst & 0x1fffffff) + size > this.ram.length) throw new Error('大きすぎます');
    this.ram.fill(0); this.scratch.fill(0);
    this.ram.set(b.subarray(2048, 2048 + size), dst & 0x1fffff);
    this.gpu.vram.fill(0); this.gpu.reset();
    this.spu = new SPU(this.spu.rate);
    this.istat = 0; this.imask = 0; this.dicr = 0;
    const c = this.cpu;
    c.reset(pc);
    c.gte = new GTE();
    c.cop0[12] = 0;                 // BEV を下ろす（例外は RAM の 80000080 へ）
    c.r[28] = gp; c.r[29] = c.r[30] = sp || 0x801ffff0;
    this.installStub();
    this.frame = 0; this.line = 0; this.tty = '';
  }

  // BIOS のかわりの小さな受け口（段階D で自前の BIOS に）。いまは A0/B0/C0 の呼び出しを JS で受け、
  //   putchar（文字出し）と、例外の入り口（80000080）を「割りこみを受けて戻るだけ」にしておく
  installStub() {
    const w = (a, v) => { this.ram32[(a & 0x1fffff) >> 2] = v; };
    // 80000080: 割りこみはソフトが自分の受け口を置くまで、EPC へ戻るだけ（mfc0 k0,EPC / nop / jr k0 / rfe）
    w(0x80, 0x401a7000); w(0x84, 0); w(0x88, 0x03400008); w(0x8c, 0x42000010);
    // A0・B0・C0 へとぶと、JS の bios() が受けて ra へ戻す（下の fetch の中）
  }
  bios(addr) {
    const c = this.cpu, fn = c.r[9] & 0xff;
    if ((addr === 0xa0 && fn === 0x3c) || (addr === 0xb0 && fn === 0x3d)) { // putchar
      const ch = c.r[4] & 0xff;
      this.tty += String.fromCharCode(ch);
      if (this.tty.length > 4000) this.tty = this.tty.slice(-2000);
    }
    c.r[2] = 0;
    return c.r[31] >>> 0;
  }

  // ---- メモリ ----
  fetch(a) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) {
      if (p === 0xa0 || p === 0xb0 || p === 0xc0) { // BIOS の呼び出しの入り口
        this.cpu.next = this.bios(p); // この nop のあと ra へ
        return 0;
      }
      return this.ram32[(p & 0x1fffff) >> 2];
    }
    return this.read32(a);
  }
  read32(a) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) return this.ram32[(p & 0x1fffff) >> 2];
    if (p >= 0x1f800000 && p < 0x1f800400) return this.sdv.getInt32(p & 0x3ff, true);
    if (p >= 0x1f801000 && p < 0x1f803000) return this.io32(p);
    return 0;
  }
  read16(a) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) return this.ram16[(p & 0x1fffff) >> 1];
    if (p >= 0x1f801c00 && p < 0x1f801e00) return this.spu.read16(p & 0x1fe);
    if (p >= 0x1f800000 && p < 0x1f800400) return this.sdv.getUint16(p & 0x3ff, true);
    if (p >= 0x1f801000 && p < 0x1f803000) return (this.io32(p & ~3) >>> ((p & 2) * 8)) & 0xffff;
    return 0;
  }
  read8(a) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) return this.ram[p & 0x1fffff];
    if (p >= 0x1f800000 && p < 0x1f800400) return this.scratch[p & 0x3ff];
    if (p >= 0x1f801000 && p < 0x1f803000) return (this.io32(p & ~3) >>> ((p & 3) * 8)) & 0xff;
    return 0;
  }
  write32(a, v) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) { this.ram32[(p & 0x1fffff) >> 2] = v; return; }
    if (p >= 0x1f800000 && p < 0x1f800400) { this.sdv.setInt32(p & 0x3ff, v, true); return; }
    if (p >= 0x1f801000 && p < 0x1f803000) this.io32w(p, v | 0);
  }
  write16(a, v) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) { this.ram16[(p & 0x1fffff) >> 1] = v; return; }
    if (p >= 0x1f800000 && p < 0x1f800400) { this.sdv.setUint16(p & 0x3ff, v, true); return; }
    if (p >= 0x1f801000 && p < 0x1f803000) this.io16w(p, v & 0xffff);
  }
  write8(a, v) {
    const p = a & 0x1fffffff;
    if (p < 0x800000) { this.ram[p & 0x1fffff] = v; return; }
    if (p >= 0x1f800000 && p < 0x1f800400) { this.scratch[p & 0x3ff] = v; return; }
    if (p >= 0x1f801000 && p < 0x1f803000) this.io16w(p & ~1, (v & 0xff) << ((p & 1) * 8)); // 8ビットで書く口は少ないので、16 にのせる
  }

  // ---- I/O ----
  io32(p) {
    if (p >= 0x1f801c00 && p < 0x1f801e00) return (this.spu.read16(p & 0x1fc) | (this.spu.read16((p & 0x1fc) + 2) << 16)) | 0;
    if (p === 0x1f801070) return this.istat;
    if (p === 0x1f801074) return this.imask;
    if (p >= 0x1f801080 && p < 0x1f801100) {
      if (p === 0x1f8010f0) return this.dpcr;
      if (p === 0x1f8010f4) return this.dicr;
      const ch = this.dma[(p >> 4) & 7], r = p & 0xf;
      return r === 0 ? ch.madr : r === 4 ? ch.bcr : ch.chcr;
    }
    if (p >= 0x1f801100 && p < 0x1f801130) {
      const t = this.tmr[(p >> 4) & 3], r = p & 0xf;
      if (r === 0) return t.count & 0xffff;
      if (r === 4) { const m = t.mode; t.mode &= ~0x1800; return m; } // 読むと「とどいた」の印が消える
      return t.target;
    }
    if (p >= 0x1f801040 && p < 0x1f801050) return this.sio.read32(p & 0xf);
    if (p === 0x1f801810) return this.gpu.read();
    if (p === 0x1f801814) return this.gpu.stat();
    return 0;
  }
  io32w(p, v) {
    if (p >= 0x1f801c00 && p < 0x1f801e00) { this.spu.write16(p & 0x1fc, v & 0xffff); this.spu.write16((p & 0x1fc) + 2, v >>> 16); return; }
    if (p === 0x1f801070) { this.istat &= v; this.updIrq(); return; }
    if (p === 0x1f801074) { this.imask = v & 0x7ff; this.updIrq(); return; }
    if (p >= 0x1f801080 && p < 0x1f801100) {
      if (p === 0x1f8010f0) { this.dpcr = v; return; }
      if (p === 0x1f8010f4) { // 下の 6 ビットと 15〜23 は書ける、24〜30 の印は 1 を書くと消える
        this.dicr = (this.dicr & 0x7f000000 & ~v) | (v & 0x00ff803f);
        this.dicrUpd(); return;
      }
      const n = (p >> 4) & 7, ch = this.dma[n], r = p & 0xf;
      if (r === 0) ch.madr = v & 0xffffff;
      else if (r === 4) ch.bcr = v >>> 0;
      else if (r === 8) { ch.chcr = v; if (v & 0x01000000) this.runDma(n); }
      return;
    }
    if (p >= 0x1f801100 && p < 0x1f801130) {
      const t = this.tmr[(p >> 4) & 3], r = p & 0xf;
      if (r === 0) t.count = v & 0xffff;
      else if (r === 4) { t.mode = (v & 0x3ff) | 0x400; t.count = 0; }
      else if (r === 8) t.target = v & 0xffff;
      return;
    }
    if (p >= 0x1f801040 && p < 0x1f801050) { this.sio.write16(p & 0xf, v & 0xffff); return; }
    if (p === 0x1f801810) { this.gpu.gp0(v); return; }
    if (p === 0x1f801814) { this.gpu.gp1(v); return; }
    // 音・CD・パッドなどは段階B 以降。いまは受け流す
  }
  io16w(p, v) {
    if (p >= 0x1f801040 && p < 0x1f801050) { this.sio.write16(p & 0xf, v); return; }
    if (p >= 0x1f801c00 && p < 0x1f801e00) { this.spu.write16(p & 0x1fe, v); return; }
    if (p >= 0x1f801100 && p < 0x1f801130) { this.io32w(p & ~3, v); return; }
    if (p === 0x1f801070 || p === 0x1f801074) { this.io32w(p, v | (p === 0x1f801070 ? 0xffff0000 : 0)); return; }
    // SPU・パッドは段階B・C
  }

  // ---- 割りこみ ----
  raise(n) { this.istat |= 1 << n; this.updIrq(); }
  updIrq() { this.cpu.irqLine = (this.istat & this.imask) !== 0; }
  dicrUpd() {
    const d = this.dicr, flag = ((d >> 24) & (d >> 16) & 0x7f) !== 0 && (d & 0x800000);
    const was = (d & 0x80000000) !== 0, now = !!(flag || (d & 0x8000));
    this.dicr = now ? (d | 0x80000000) : (d & 0x7fffffff);
    if (now && !was) this.raise(IRQ.DMA);
  }

  // ---- DMA（すぐに終わる） ----
  runDma(n) {
    const ch = this.dma[n], sync = (ch.chcr >> 9) & 3, fromRam = ch.chcr & 1, step = (ch.chcr & 2) ? -4 : 4;
    if (n === 2 && sync === 2) { // GPU の並べ表（つながったリスト）
      let a = ch.madr & 0x1ffffc, guard = 0;
      for (;;) {
        const head = this.ram32[a >> 2], cnt = head >>> 24;
        for (let k = 1; k <= cnt; k++) this.gpu.gp0(this.ram32[((a + k * 4) & 0x1ffffc) >> 2]);
        a = head & 0xffffff;
        if ((a & 0x800000) || ++guard > 0x100000) break;
        a &= 0x1ffffc;
      }
      ch.madr = 0xffffff;
    } else if (n === 6) { // 並べ表をつくる（うしろから、ひとつ前を指す）
      let a = ch.madr & 0x1ffffc, cnt = ch.bcr & 0xffff || 0x10000;
      while (cnt--) { this.ram32[a >> 2] = cnt ? (a - 4) & 0x1fffff : 0xffffff; a = (a - 4) & 0x1ffffc; }
    } else {
      const words = sync === 0 ? (ch.bcr & 0xffff || 0x10000) : (ch.bcr & 0xffff) * (ch.bcr >>> 16);
      let a = ch.madr & 0x1ffffc;
      for (let k = 0; k < words; k++, a = (a + step) & 0x1ffffc) {
        if (n === 2) {
          if (fromRam) this.gpu.gp0(this.ram32[a >> 2]); else this.ram32[a >> 2] = this.gpu.read();
        } else if (n === 4 && fromRam) this.spu.dmaWrite(this.ram32[a >> 2]);
        // ほかの口（MDEC・CD）は段階D
      }
      if (sync === 1) ch.madr = a;
    }
    ch.chcr &= ~0x11000000;
    if (this.dicr & (1 << (16 + n))) { this.dicr |= 1 << (24 + n); this.dicrUpd(); }
  }

  // ---- タイマー（ざっくり。0 と 1 は CPU の時計、2 は 1/8 も） ----
  tick(cyc) {
    for (let i = 0; i < 3; i++) {
      const t = this.tmr[i];
      let add = cyc;
      if (i === 2 && (t.mode & 0x200)) { t.frac += cyc; add = t.frac >> 3; t.frac &= 7; }
      else if (i === 1 && (t.mode & 0x100)) { continue; } // 横の帰線で数える形は line() で
      this.tmrAdd(i, add);
    }
  }
  tmrAdd(i, add) {
    const t = this.tmr[i], tgt = t.target || 0x10000;
    let c = t.count + add;
    if ((t.mode & 8) && c >= tgt) { // 目標で 0 にもどす
      t.mode |= 0x800; if (t.mode & 0x10) this.raise(IRQ.TMR0 + i);
      c %= tgt;
    } else if (c > 0xffff) { t.mode |= 0x1000; if (t.mode & 0x20) this.raise(IRQ.TMR0 + i); c &= 0xffff; }
    t.count = c;
  }

  // ---- 1こま ----
  runFrame() {
    const cpu = this.cpu, n = Math.round(CYC_LINE / CPI);
    for (let l = 0; l < LINES; l++) {
      this.line = l;
      for (let k = 0; k < n; k++) cpu.step();
      this.tick(CYC_LINE);
      this.spuFrac += 44100 / 60 / LINES;          // 1 行で 2.79 サンプル
      const ns = Math.floor(this.spuFrac); this.spuFrac -= ns;
      this.spu.run(ns);
      if (this.tmr[1].mode & 0x100) this.tmrAdd(1, 1);
      if (l === VBLANK_LINE) { this.raise(IRQ.VBLANK); this.gpu.odd ^= 1; }
    }
    this.frame++;
  }

  // 見えている画面を RGBA にする（out は Uint8ClampedArray、大きさは width×height×4）
  display(out) {
    const g = this.gpu, w = g.hres, h = g.vres, v = g.vram;
    if (g.dispOff) { out.fill(0); for (let i = 3; i < out.length; i += 4) out[i] = 255; return { w, h }; }
    let o = 0;
    for (let y = 0; y < h; y++) {
      const row = ((g.dispY + y) & 511) * 1024;
      if (g.rgb24) {
        const base = row * 2 + g.dispX * 2; // バイトで数える
        for (let x = 0; x < w; x++) {
          const b = base + x * 3, i = b >> 1;
          const w0 = v[(i & ~0x3ff) | (i & 1023)], w1 = v[((i + 1) & ~0x3ff) | ((i + 1) & 1023)];
          const bytes = (b & 1) ? [w0 >> 8, w1 & 255, w1 >> 8] : [w0 & 255, w0 >> 8, w1 & 255];
          out[o++] = bytes[0]; out[o++] = bytes[1]; out[o++] = bytes[2]; out[o++] = 255;
        }
      } else {
        for (let x = 0; x < w; x++) {
          const c = v[row + ((g.dispX + x) & 1023)];
          out[o++] = (c & 31) * 255 / 31; out[o++] = ((c >> 5) & 31) * 255 / 31; out[o++] = ((c >> 10) & 31) * 255 / 31; out[o++] = 255;
        }
      }
    }
    return { w, h };
  }
}
