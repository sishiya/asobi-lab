// カートリッジ: iNES の形のファイルを読み、マッパー（バンクの切りかえ）をまねる。
// どのマッパーも同じ窓で見る: CPU の $8000〜$FFFF は 8KB ×4（p8）、PPU の $0000〜$1FFF は 1KB ×8（c1）、画面の表 $2000〜$2FFF は 1KB ×4（nt）。
// マッパーごとのちがいは下の M（書きこみ・読み出し・CPU のサイクル・描く行・音）だけ
export const MAPPERS = [0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 16, 18, 19, 21, 22, 23, 24, 25, 26, 32, 33, 34, 48, 65, 66, 67, 68, 69, 71, 75, 87, 88, 89, 93, 118, 140, 154, 159, 180, 184, 206];

export class Cart {
  constructor(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b[0] !== 0x4e || b[1] !== 0x45 || b[2] !== 0x53 || b[3] !== 0x1a) throw new Error('iNES の形ではありません');
    const f6 = b[6], f7 = b[7], nes2 = (f7 & 0x0c) === 0x08;
    // 古いツールがヘッダーのうしろに字を書いたファイル（12〜15 バイトめが 0 でない）は、マッパーの上の4ビットを使わない
    const dirty = !nes2 && (b[12] | b[13] | b[14] | b[15]) !== 0;
    this.mapper = (f6 >> 4) | (dirty ? 0 : f7 & 0xf0) | (nes2 ? (b[8] & 0x0f) << 8 : 0);
    this.sub = nes2 ? b[8] >> 4 : 0;   // NES 2.0 のサブマッパー（VRC の配線などの見分け）
    if (!MAPPERS.includes(this.mapper)) throw new Error('このマッパーには対応していません: ' + this.mapper);
    const prgN = b[4] | (nes2 ? (b[9] & 0x0f) << 8 : 0), chrN = b[5] | (nes2 ? (b[9] & 0xf0) << 4 : 0);
    let p = 16 + ((f6 & 4) ? 512 : 0);
    this.prg = b.slice(p, p + prgN * 16384); p += prgN * 16384;
    if (this.prg.length < 8192) throw new Error('PRG が足りません');
    this.chrRam = chrN === 0;
    this.chr = this.chrRam ? new Uint8Array(8192) : b.slice(p, p + chrN * 8192);
    this.prgRam = new Uint8Array(this.mapper === 5 ? 65536 : 8192);
    this.battery = !!(f6 & 2); // $6000 の RAM が電池で残る（セーブ）
    this.four = !!(f6 & 8);
    this.ciram = new Uint8Array(this.four ? 4096 : 2048);   // 本体の画面の表の RAM（4画面のカセットは 2KB を足す）
    this.irqLine = false;   // マッパーが CPU に IRQ を出しているか
    this.fetch = 0;         // PPU がいま読んでいるもの（0 = CPU から、1 = 背景、2 = 絵）。MMC5 が見る
    this.ppu = null;        // PPU（MMC5 が 8×16 の絵かを見る）
    this.pMem = [this.prg, this.prg, this.prg, this.prg]; this.p8 = [0, 0, 0, 0];
    this.p6 = -1;           // 0 以上なら $6000〜$7FFF に PRG ROM のその位置（FME-7）
    this.ramOff = 0;        // $6000〜$7FFF の RAM の位置（MMC5 は 64KB の中で切りかえ）
    this.cMem = new Array(8).fill(this.chr); this.c1 = [0, 0, 0, 0, 0, 0, 0, 0];
    this.ntMem = [this.ciram, this.ciram, this.ciram, this.ciram]; this.ntOff = [0, 0, 0, 0]; this.ntRo = [false, false, false, false];
    this.setMirror(this.four ? 'four' : (f6 & 1) ? 'vert' : 'horz');
    this.setPrg16(0, 0); this.setPrg16(1, -1); this.setChr8(0);
    this.m = M[this.mapper] || {};
    this.m.init?.(this);
    // 毎サイクル・描く行・音の手は、そのマッパーにあるときだけ（nes.js・ppu.js・apu.js が見る）
    if (this.m.clock) this.clock = (n) => this.m.clock(this, n);
    if (this.m.line) this.scanline = (l) => this.m.line(this, l);
    if (this.m.audio) this.audio = () => this.m.audio(this);
    if (this.m.exBg) this.exBg = (a, p) => this.m.exBg(this, a, p);
  }

  // --- 窓の切りかえ（番号が負なら、うしろから数える。大きすぎる番号は折り返す） ---
  bank(n, size, total) { const k = Math.max(1, (total / size) | 0); return (((n % k) + k) % k) * size; }
  setPrg8(i, n) { this.pMem[i] = this.prg; this.p8[i] = this.bank(n, 8192, this.prg.length); }
  setPrg16(i, n) { this.setPrg8(i * 2, n * 2); this.setPrg8(i * 2 + 1, n * 2 + 1); }
  setPrg32(n) { for (let i = 0; i < 4; i++) this.setPrg8(i, n * 4 + i); }
  setChr1(i, n) { this.cMem[i] = this.chr; this.c1[i] = this.bank(n, 1024, this.chr.length); }
  setChr2(i, n) { this.setChr1(i * 2, n * 2); this.setChr1(i * 2 + 1, n * 2 + 1); }
  setChr4(i, n) { for (let j = 0; j < 4; j++) this.setChr1(i * 4 + j, n * 4 + j); }
  setChr8(n) { for (let j = 0; j < 8; j++) this.setChr1(j, n * 8 + j); }
  // 画面の表の折り返し: 'vert'（左右がちがう）・'horz'（上下がちがう）・'one0'・'one1'（1枚だけ）・'four'（4枚）
  setMirror(m) {
    const pages = { vert: [0, 1, 0, 1], horz: [0, 0, 1, 1], one0: [0, 0, 0, 0], one1: [1, 1, 1, 1], four: [0, 1, 2, 3] }[m];
    if (this.four) { this.mirror = 'four'; for (let i = 0; i < 4; i++) this.setNt(i, this.ciram, i * 1024); return; }
    this.mirror = m;
    for (let i = 0; i < 4; i++) this.setNt(i, this.ciram, (pages[i] & 1) * 1024);
  }
  setNt(i, mem, off, ro = false) { this.ntMem[i] = mem; this.ntOff[i] = off; this.ntRo[i] = ro; }

  // --- CPU から ---
  cpuRead(a) {
    if (a >= 0x8000) { const i = (a >> 13) & 3; return this.pMem[i][this.p8[i] + (a & 0x1fff)]; }
    if (this.m.read) { const r = this.m.read(this, a); if (r !== undefined) return r; }
    if (a >= 0x6000) return this.p6 >= 0 ? this.prg[this.p6 + (a & 0x1fff)] : this.prgRam[this.ramOff + (a & 0x1fff)];
    return 0;
  }
  cpuWrite(a, v) {
    if (a >= 0x6000 && a < 0x8000 && this.p6 < 0) this.prgRam[this.ramOff + (a & 0x1fff)] = v;
    this.m.write?.(this, a, v);
  }
  // --- PPU から ---
  chrRead(a) {
    if (this.m.chrRead) return this.m.chrRead(this, a);
    const i = a >> 10, v = this.cMem[i][this.c1[i] + (a & 0x3ff)];
    if (this.m.latch) this.m.latch(this, a);
    return v;
  }
  chrWrite(a, v) {
    const i = a >> 10, mem = this.cMem[i];
    if (this.chrRam || mem === this.ciram) mem[this.c1[i] + (a & 0x3ff)] = v;
  }
  ntRead(a) { const i = (a >> 10) & 3; return this.ntMem[i][this.ntOff[i] + (a & 0x3ff)]; }
  ntWrite(a, v) { const i = (a >> 10) & 3; if (!this.ntRo[i]) this.ntMem[i][this.ntOff[i] + (a & 0x3ff)] = v; }
}

const MIRROR4 = ['vert', 'horz', 'one0', 'one1'];

// ---------- MMC1（1）: 1ビットずつ5回書いて1つの値 ----------
function mmc1Apply(c) {
  const m = c.mmc1;
  c.setMirror(MIRROR4[[2, 3, 0, 1][m.ctrl & 3]]);
  const pm = (m.ctrl >> 2) & 3, outer = c.prg.length > 262144 ? m.chr0 & 0x10 : 0;   // 512KB のカセットは CHR の 4 ビット目で前後の 256KB
  if (pm < 2) { c.setPrg16(0, outer | (m.prg & 0x0e)); c.setPrg16(1, outer | (m.prg & 0x0e) | 1); }
  else if (pm === 2) { c.setPrg16(0, outer); c.setPrg16(1, outer | m.prg); }
  else { c.setPrg16(0, outer | m.prg); c.setPrg16(1, outer | 0x0f); }
  if (m.ctrl & 0x10) { c.setChr4(0, m.chr0); c.setChr4(1, m.chr1); } else c.setChr8(m.chr0 >> 1);
}

// ---------- MMC3 のなかま（4・118・206・88・154）: 8KB ずつの PRG・1KB ずつの CHR・行を数えて IRQ ----------
function mmc3Apply(c) {
  const m = c.mmc3, r = m.r, kind = c.mapper;
  if (m.sel & 0x40) { c.setPrg8(0, -2); c.setPrg8(2, r[6]); } else { c.setPrg8(0, r[6]); c.setPrg8(2, -2); }
  c.setPrg8(1, r[7]); c.setPrg8(3, -1);
  const hi = kind === 88 || kind === 154 ? 0x40 : 0;   // 88・154 は 2KB の2つが前の 64KB、1KB の4つがうしろの 64KB
  const two = [r[0] & 0xfe, (r[0] & 0xfe) + 1, r[1] & 0xfe, (r[1] & 0xfe) + 1], four = [r[2] | hi, r[3] | hi, r[4] | hi, r[5] | hi];
  const all = (m.sel & 0x80) ? [...four, ...two] : [...two, ...four];
  all.forEach((n, i) => c.setChr1(i, kind === 118 ? n & 0x7f : n));
  if (kind === 118) all.slice(0, 4).forEach((n, i) => c.setNt(i, c.ciram, (n >> 7) * 1024));   // TxSROM: 画面の表も CHR の番号の 7 ビット目で選ぶ
}
const MMC3 = {
  init(c) { c.mmc3 = { sel: 0, r: [0, 2, 4, 5, 6, 7, 0, 1], latch: 0, count: 0, reload: false, on: false }; mmc3Apply(c); },
  write(c, a, v) {
    if (a < 0x8000) return;
    const m = c.mmc3, odd = a & 1, kind = c.mapper;
    if (kind === 206 || kind === 88 || kind === 154) {   // ネームコ 108 の形: $8000・$8001 だけ。モードの切りかえも IRQ もない
      if (kind === 154) c.setMirror(v & 0x40 ? 'one1' : 'one0');
      if (a >= 0xa000) return;
      if (odd) m.r[m.sel] = v & (m.sel < 6 ? 0x3f : 0x0f); else m.sel = v & 7;
      mmc3Apply(c); return;
    }
    switch (a & 0xe000) {
      case 0x8000: if (odd) m.r[m.sel & 7] = v; else m.sel = v; mmc3Apply(c); break;
      case 0xa000: if (!odd && kind !== 118) c.setMirror(v & 1 ? 'horz' : 'vert'); break;   // 奇数は PRG RAM の守り（いつも読み書きできることにする）
      case 0xc000: if (odd) { m.count = 0; m.reload = true; } else m.latch = v; break;
      case 0xe000: if (odd) m.on = true; else { m.on = false; c.irqLine = false; } break;
    }
  },
  // PPU が描く行ごとに1回（本物は PPU の番地の A12 が上がるとき。背景 $0000・絵 $1000 のふつうの使い方なら、行の 260 ドットめ）
  line(c) {
    const m = c.mmc3;
    if (c.mapper === 206 || c.mapper === 88 || c.mapper === 154) return;
    if (m.count === 0 || m.reload) { m.count = m.latch; m.reload = false; } else m.count--;
    if (m.count === 0 && m.on) c.irqLine = true;
  },
};

// ---------- MMC2・MMC4（9・10）: 絵の $FD・$FE の番号を読むと CHR が切りかわる ----------
function latchApply(c) { const m = c.mmc2; c.setChr4(0, m.l0 === 0xfd ? m.r[0] : m.r[1]); c.setChr4(1, m.l1 === 0xfd ? m.r[2] : m.r[3]); }
const MMC2 = {
  init(c) { c.mmc2 = { r: [0, 0, 0, 0], l0: 0xfe, l1: 0xfe }; if (c.mapper === 9) { c.setPrg8(1, -3); c.setPrg8(2, -2); c.setPrg8(3, -1); } latchApply(c); },
  write(c, a, v) {
    if (a < 0xa000) return;
    const m = c.mmc2;
    switch (a & 0xf000) {
      case 0xa000: if (c.mapper === 9) c.setPrg8(0, v & 0x0f); else c.setPrg16(0, v & 0x0f); return;
      case 0xf000: c.setMirror(v & 1 ? 'horz' : 'vert'); return;
      default: m.r[((a >> 12) & 0xf) - 0xb] = v & 0x1f; latchApply(c);
    }
  },
  latch(c, a) {
    const m = c.mmc2, l0 = m.l0, l1 = m.l1;
    if (c.mapper === 9 ? a === 0x0fd8 : (a & 0xfff8) === 0x0fd8) m.l0 = 0xfd;
    else if (c.mapper === 9 ? a === 0x0fe8 : (a & 0xfff8) === 0x0fe8) m.l0 = 0xfe;
    else if ((a & 0xfff8) === 0x1fd8) m.l1 = 0xfd;
    else if ((a & 0xfff8) === 0x1fe8) m.l1 = 0xfe;
    else return;
    if (l0 !== m.l0 || l1 !== m.l1) latchApply(c);
  },
};

// ---------- コナミ VRC2・VRC4（21・22・23・25）・VRC6（24・26）・VRC1（75） ----------
// VRC2/4 は、ボードによって番地のどの線がレジスタの 0・1 につながるかがちがう。ありうる線をまとめて見る
function vrcReg(c, a) {
  const b = (n) => (a >> n) & 1;
  switch (c.mapper) {
    case 21: return (b(1) | b(6)) | ((b(2) | b(7)) << 1);
    case 22: return b(1) | (b(0) << 1);
    case 23: return (b(0) | b(2)) | ((b(1) | b(3)) << 1);
    case 25: return (b(1) | b(3)) | ((b(0) | b(2)) << 1);
    case 26: return b(1) | (b(0) << 1);
    default: return a & 3;
  }
}
// VRC4・VRC6 の IRQ: 行のモード（CPU 3 サイクルで 1 引き、341 で 1 行）か、サイクルのモード。8ビットを数え上げ、あふれたら latch から
function vrcIrqWrite(c, r, v) {
  const q = c.vrcIrq;
  if (r === 0) q.latch = (q.latch & 0xf0) | (v & 0x0f);       // VRC4 は 4 ビットずつ
  else if (r === 1) q.latch = (q.latch & 0x0f) | ((v & 0x0f) << 4);
  else if (r === 2) { q.a = !!(v & 1); q.e = !!(v & 2); q.cyc = !!(v & 4); if (q.e) { q.count = q.latch; q.pre = 341; } c.irqLine = false; }
  else { q.e = q.a; c.irqLine = false; }
}
function vrcIrqClock(c, n) {
  const q = c.vrcIrq;
  if (!q.e) return;
  while (n-- > 0) {
    if (!q.cyc) { q.pre -= 3; if (q.pre > 0) continue; q.pre += 341; }
    if (q.count === 0xff) { q.count = q.latch; c.irqLine = true; } else q.count++;
  }
}
const VRC24 = {
  init(c) { c.vrc = { prg: [0, 0], swap: false, chr: [0, 0, 0, 0, 0, 0, 0, 0] }; c.vrcIrq = { latch: 0, count: 0, pre: 341, a: false, e: false, cyc: false }; VRC24.apply(c); },
  apply(c) {
    const s = c.vrc;
    if (s.swap) { c.setPrg8(0, -2); c.setPrg8(2, s.prg[0]); } else { c.setPrg8(0, s.prg[0]); c.setPrg8(2, -2); }
    c.setPrg8(1, s.prg[1]); c.setPrg8(3, -1);
    s.chr.forEach((n, i) => c.setChr1(i, c.mapper === 22 ? n >> 1 : n));   // VRC2a は CHR の番号の 0 ビット目がつながっていない
  },
  write(c, a, v) {
    if (a < 0x8000) return;
    const s = c.vrc, r = vrcReg(c, a), hi = a & 0xf000;
    if (hi === 0x8000) s.prg[0] = v & 0x1f;
    else if (hi === 0xa000) s.prg[1] = v & 0x1f;
    else if (hi === 0x9000) {
      if (c.mapper === 22 || r < 2) c.setMirror(c.mapper === 22 ? (v & 1 ? 'horz' : 'vert') : MIRROR4[v & 3]);
      else if (r === 2) s.swap = !!(v & 2);
    } else if (hi >= 0xb000 && hi <= 0xe000) {
      const i = ((hi - 0xb000) >> 11) | (r >> 1);
      s.chr[i] = r & 1 ? (s.chr[i] & 0x0f) | ((v & 0x1f) << 4) : (s.chr[i] & 0x1f0) | (v & 0x0f);
    } else if (hi === 0xf000 && c.mapper !== 22) { vrcIrqWrite(c, r, v); return; }
    VRC24.apply(c);
  },
  clock: vrcIrqClock,
};
// VRC6 の音: 矩形波2つ（16 段のデューティ）とのこぎり波
const VRC6 = {
  init(c) {
    c.vrcIrq = { latch: 0, count: 0, pre: 341, a: false, e: false, cyc: false };
    c.vrc6 = { sq: [0, 1].map(() => ({ vol: 0, duty: 0, mode: false, period: 0, on: false, t: 0, step: 0 })), saw: { rate: 0, period: 0, on: false, t: 0, step: 0, acc: 0 } };
    c.setPrg16(0, 0); c.setPrg8(2, -2); c.setPrg8(3, -1);
  },
  write(c, a, v) {
    if (a < 0x8000) return;
    const r = vrcReg(c, a), hi = a & 0xf000, s = c.vrc6;
    switch (hi) {
      case 0x8000: c.setPrg16(0, v & 0x0f); break;
      case 0xc000: c.setPrg8(2, v & 0x1f); break;
      case 0xd000: c.setChr1(r, v); break;
      case 0xe000: c.setChr1(4 + r, v); break;
      case 0xf000: if (r === 0) c.vrcIrq.latch = v; else if (r < 3) vrcIrqWrite(c, r + 1, v); break;   // $F000 は 8 ビットの latch・$F001 は IRQ の設定・$F002 は受けとり
      case 0xb000: if (r === 3) { c.setMirror(MIRROR4[(v >> 2) & 3]); break; } // fallthrough（のこぎり波）
      case 0x9000: case 0xa000: {
        const ch = hi === 0xb000 ? s.saw : s.sq[(hi >> 12) - 9];
        if (r === 0) { if (hi === 0xb000) ch.rate = v & 0x3f; else { ch.vol = v & 0x0f; ch.duty = (v >> 4) & 7; ch.mode = !!(v & 0x80); } }
        else if (r === 1) ch.period = (ch.period & 0xf00) | v;
        else if (r === 2) { ch.period = (ch.period & 0xff) | ((v & 0x0f) << 8); ch.on = !!(v & 0x80); if (!ch.on) { ch.step = hi === 0xb000 ? 0 : 15; ch.acc = 0; } }
        break;
      }
    }
  },
  clock(c, n) {
    vrcIrqClock(c, n);
    const s = c.vrc6;
    for (const q of s.sq) if (q.on) { q.t -= n; while (q.t < 0) { q.t += q.period + 1; q.step = (q.step + 15) & 15; } }
    const w = s.saw;
    if (w.on) {
      w.t -= n;
      while (w.t < 0) {
        w.t += w.period + 1;
        if (++w.step === 14) { w.step = 0; w.acc = 0; } else if (!(w.step & 1)) w.acc = (w.acc + w.rate) & 0xff;
      }
    }
  },
  audio(c) {
    const s = c.vrc6;
    let o = 0;
    for (const q of s.sq) if (q.on && (q.mode || q.step <= q.duty)) o += q.vol;
    if (s.saw.on) o += s.saw.acc >> 3;
    return o * 0.0075;
  },
};
const VRC1 = {
  init(c) { c.vrc1 = { c0: 0, c1: 0 }; },
  write(c, a, v) {
    if (a < 0x8000) return;
    const s = c.vrc1;
    switch (a & 0xf000) {
      case 0x8000: c.setPrg8(0, v & 0x0f); break;
      case 0xa000: c.setPrg8(1, v & 0x0f); break;
      case 0xc000: c.setPrg8(2, v & 0x0f); break;
      case 0x9000: if (!c.four) c.setMirror(v & 1 ? 'horz' : 'vert'); s.c0 = (s.c0 & 0x0f) | ((v & 2) << 3); s.c1 = (s.c1 & 0x0f) | ((v & 4) << 2); break;
      case 0xe000: s.c0 = (s.c0 & 0x10) | (v & 0x0f); break;
      case 0xf000: s.c1 = (s.c1 & 0x10) | (v & 0x0f); break;
    }
    c.setChr4(0, s.c0); c.setChr4(1, s.c1);
  },
};

// ---------- サンソフト FME-7（69）: 番号を書いてから値。$6000 にも ROM を出せる。CPU のサイクルで IRQ。5B の音（矩形波3つ） ----------
const FME7 = {
  init(c) { c.fme = { cmd: 0, cnt: 0, irqOn: false, cntOn: false, ay: new Uint8Array(16), addr: 0, t: [0, 0, 0], o: [0, 0, 0], div: 0 }; c.setPrg8(3, -1); },
  write(c, a, v) {
    const f = c.fme;
    if (a < 0x8000) return;
    if (a < 0xa000) { f.cmd = v & 0x0f; return; }
    if (a >= 0xc000) { if (a < 0xe000) f.addr = v & 0x0f; else f.ay[f.addr] = v; return; }
    const k = f.cmd;
    if (k < 8) c.setChr1(k, v);
    else if (k === 8) { if (v & 0x40) c.p6 = -1; else c.p6 = c.bank(v & 0x3f, 8192, c.prg.length); }
    else if (k < 0x0c) c.setPrg8(k - 9, v & 0x3f);
    else if (k === 0x0c) c.setMirror(MIRROR4[v & 3]);
    else if (k === 0x0d) { f.irqOn = !!(v & 1); f.cntOn = !!(v & 0x80); c.irqLine = false; }
    else if (k === 0x0e) f.cnt = (f.cnt & 0xff00) | v;
    else f.cnt = (f.cnt & 0xff) | (v << 8);
  },
  clock(c, n) {
    const f = c.fme;
    if (f.cntOn) { f.cnt -= n; if (f.cnt < 0) { f.cnt += 0x10000; if (f.irqOn) c.irqLine = true; } }
    // 5B の矩形波: CPU 16 サイクルで1つ進む分周器
    f.div += n;
    while (f.div >= 16) {
      f.div -= 16;
      for (let i = 0; i < 3; i++) { if (++f.t[i] >= ((f.ay[i * 2] | ((f.ay[i * 2 + 1] & 0x0f) << 8)) || 1)) { f.t[i] = 0; f.o[i] ^= 1; } }
    }
  },
  audio(c) {
    const f = c.fme, ay = f.ay;
    let o = 0;
    for (let i = 0; i < 3; i++) {
      const vol = ay[8 + i] & 0x0f;
      if (!vol || (!(ay[7] & (1 << i)) && !f.o[i])) continue;   // 7 番の0ビット目が 0 なら矩形波が鳴る
      o += Math.pow(2, (vol - 15) / 2);
    }
    return o * 0.12;
  },
};

// ---------- ネームコ 163（19）: CHR と画面の表を ROM／本体の RAM から 1KB ずつ。15 ビットの IRQ。波形メモリの音 ----------
const N163 = {
  init(c) {
    c.n163 = { chr: [0, 0, 0, 0, 0, 0, 0, 0], nt: [0xe0, 0xe1, 0xe0, 0xe1], noRam: 0, irq: 0, ram: new Uint8Array(128), addr: 0, inc: false, mute: false, div: 0, ch: 0, out: new Float32Array(8) };
    c.setPrg8(3, -1); N163.apply(c);
  },
  apply(c) {
    const s = c.n163;
    for (let i = 0; i < 8; i++) {
      const v = s.chr[i], ram = v >= 0xe0 && !(s.noRam & (i < 4 ? 0x40 : 0x80));
      if (ram) { c.cMem[i] = c.ciram; c.c1[i] = (v & 1) * 1024; } else c.setChr1(i, v);
    }
    for (let i = 0; i < 4; i++) { const v = s.nt[i]; if (v >= 0xe0) c.setNt(i, c.ciram, (v & 1) * 1024); else c.setNt(i, c.chr, c.bank(v, 1024, c.chr.length), true); }
  },
  read(c, a) {
    const s = c.n163;
    if (a >= 0x4800 && a < 0x5000) { const v = s.ram[s.addr]; if (s.inc) s.addr = (s.addr + 1) & 0x7f; return v; }
    if (a >= 0x5000 && a < 0x5800) return s.irq & 0xff;
    if (a >= 0x5800 && a < 0x6000) return s.irq >> 8;
  },
  write(c, a, v) {
    const s = c.n163;
    if (a >= 0x4800 && a < 0x5000) { s.ram[s.addr] = v; if (s.inc) s.addr = (s.addr + 1) & 0x7f; return; }
    if (a >= 0x5000 && a < 0x5800) { s.irq = (s.irq & 0xff00) | v; c.irqLine = false; return; }
    if (a >= 0x5800 && a < 0x6000) { s.irq = (s.irq & 0xff) | (v << 8); c.irqLine = false; return; }
    if (a < 0x8000) return;
    const k = (a >> 11) & 0x0f;   // $8000 から $800 ごとに番号
    if (k < 8) s.chr[k] = v;
    else if (k < 12) s.nt[k - 8] = v;
    else if (k === 12) { c.setPrg8(0, v & 0x3f); s.mute = !!(v & 0x40); }
    else if (k === 13) { c.setPrg8(1, v & 0x3f); s.noRam = v & 0xc0; }
    else if (k === 14) c.setPrg8(2, v & 0x3f);
    else { s.addr = v & 0x7f; s.inc = !!(v & 0x80); }
    N163.apply(c);
  },
  clock(c, n) {
    const s = c.n163;
    if ((s.irq & 0x8000) && (s.irq & 0x7fff) !== 0x7fff) {
      const x = Math.min(0x7fff, (s.irq & 0x7fff) + n);
      s.irq = 0x8000 | x;
      if (x === 0x7fff) c.irqLine = true;
    }
    // 音: 15 サイクルごとに1つのチャンネルを進める（うしろのチャンネルから、鳴らす数だけ）
    s.div += n;
    while (s.div >= 15) {
      s.div -= 15;
      const r = s.ram, count = ((r[0x7f] >> 4) & 7) + 1;
      if (++s.ch > 7 || s.ch < 8 - count) s.ch = 8 - count;
      const b = 0x40 + s.ch * 8;
      const freq = r[b] | (r[b + 2] << 8) | ((r[b + 4] & 3) << 16), len = (256 - (r[b + 4] & 0xfc)) << 16;
      let ph = (r[b + 1] | (r[b + 3] << 8) | (r[b + 5] << 16)) + freq;
      if (ph >= len) ph -= len;
      r[b + 1] = ph & 0xff; r[b + 3] = (ph >> 8) & 0xff; r[b + 5] = (ph >> 16) & 0xff;
      const at = (r[b + 6] + (ph >> 16)) & 0xff, smp = (r[at >> 1] >> ((at & 1) * 4)) & 0x0f;
      s.out[s.ch] = (smp - 8) * (r[b + 7] & 0x0f);
      s.count = count;
    }
  },
  audio(c) {
    const s = c.n163;
    if (s.mute || !s.count) return 0;
    let o = 0;
    for (let i = 8 - s.count; i < 8; i++) o += s.out[i];
    return (o / s.count) * 0.002;   // 本物は1つずつ順に鳴らすので、チャンネルが多いほど1つは小さく聞こえる
  },
};

// ---------- バンダイ FCG（16・159）: $6000 か $8000 から。16 ビットの IRQ（CPU のサイクルで減る）。EEPROM のセーブはまねない ----------
const BANDAI = {
  init(c) { c.bd = { cnt: 0, latch: 0, on: false }; },
  write(c, a, v) {
    if (a < 0x6000) return;
    const s = c.bd, r = a & 0x0f;
    if (r < 8) c.setChr1(r, v);
    else if (r === 8) c.setPrg16(0, v & 0x0f);
    else if (r === 9) c.setMirror(MIRROR4[v & 3]);
    else if (r === 0x0a) { s.on = !!(v & 1); s.cnt = s.latch; c.irqLine = false; }
    else if (r === 0x0b) { s.latch = (s.latch & 0xff00) | v; s.cnt = (s.cnt & 0xff00) | v; }
    else if (r === 0x0c) { s.latch = (s.latch & 0xff) | (v << 8); s.cnt = (s.cnt & 0xff) | (v << 8); }
  },
  clock(c, n) {
    const s = c.bd;
    if (!s.on) return;
    if (s.cnt <= n && s.cnt > 0) c.irqLine = true;
    s.cnt = (s.cnt - n) & 0xffff;
  },
};

// ---------- ジャレコ SS88006（18）: 4 ビットずつ書く。IRQ は 4・8・12・16 ビットの幅 ----------
const JALECO = {
  init(c) { c.jl = { prg: [0, 0, 0], chr: [0, 0, 0, 0, 0, 0, 0, 0], reload: 0, cnt: 0, mask: 0xffff, on: false }; c.setPrg8(3, -1); },
  write(c, a, v) {
    if (a < 0x8000) return;
    const s = c.jl, r = a & 3, hiN = r & 1, n = v & 0x0f, hi = a & 0xf000;
    const nib = (x, sh) => (x & ~(0x0f << sh)) | (n << sh);
    if (hi === 0x8000 || (hi === 0x9000 && r < 2)) {
      const i = hi === 0x9000 ? 2 : r >> 1;
      s.prg[i] = nib(s.prg[i], hiN * 4); c.setPrg8(i, s.prg[i]);
    } else if (hi >= 0xa000 && hi <= 0xd000) {
      const i = ((hi - 0xa000) >> 11) | (r >> 1);
      s.chr[i] = nib(s.chr[i], hiN * 4); c.setChr1(i, s.chr[i]);
    } else if (hi === 0xe000) s.reload = nib(s.reload, r * 4);
    else if (hi === 0xf000) {
      if (r === 0) { s.cnt = s.reload; c.irqLine = false; }
      else if (r === 1) { s.on = !!(v & 1); s.mask = v & 8 ? 0xf : v & 4 ? 0xff : v & 2 ? 0xfff : 0xffff; c.irqLine = false; }
      else if (r === 2) c.setMirror(['horz', 'vert', 'one0', 'one1'][v & 3]);
    }
  },
  clock(c, n) {
    const s = c.jl;
    if (!s.on) return;
    let low = s.cnt & s.mask;
    if (low > 0 && low <= n) c.irqLine = true;
    low = (low - n) & s.mask;
    s.cnt = (s.cnt & ~s.mask) | low;
  },
};

// ---------- アイレム H3001（65）・G-101（32）・タイトー TC0190（33）・TC0690（48）・サンソフト3（67）・4（68） ----------
const IREM_H = {
  init(c) { c.ih = { cnt: 0, reload: 0, on: false }; c.setPrg8(0, 0); c.setPrg8(1, 1); c.setPrg8(2, -2); c.setPrg8(3, -1); },
  write(c, a, v) {
    const s = c.ih;
    if (a < 0x8000) return;
    if (a >= 0xb000 && a < 0xb008) { c.setChr1(a & 7, v); return; }
    switch (a) {
      case 0x8000: c.setPrg8(0, v); break;
      case 0xa000: c.setPrg8(1, v); break;
      case 0xc000: c.setPrg8(2, v); break;
      case 0x9001: c.setMirror(v & 0x80 ? 'horz' : 'vert'); break;
      case 0x9003: s.on = !!(v & 0x80); c.irqLine = false; break;
      case 0x9004: s.cnt = s.reload; c.irqLine = false; break;
      case 0x9005: s.reload = (s.reload & 0xff) | (v << 8); break;
      case 0x9006: s.reload = (s.reload & 0xff00) | v; break;
    }
  },
  clock(c, n) { const s = c.ih; if (!s.on || !s.cnt) return; s.cnt = Math.max(0, s.cnt - n); if (!s.cnt) c.irqLine = true; },
};
const IREM_G = {
  init(c) { c.ig = { p0: 0, mode: 0 }; IREM_G.apply(c); c.setPrg8(1, 1); },
  apply(c) { const s = c.ig; if (s.mode) { c.setPrg8(0, -2); c.setPrg8(2, s.p0); } else { c.setPrg8(0, s.p0); c.setPrg8(2, -2); } c.setPrg8(3, -1); },
  write(c, a, v) {
    if (a < 0x8000 || a >= 0xc000) return;
    const s = c.ig;
    switch (a & 0xf000) {
      case 0x8000: s.p0 = v & 0x1f; break;
      case 0x9000: s.mode = (v >> 1) & 1; if (c.sub !== 1) c.setMirror(v & 1 ? 'horz' : 'vert'); break;
      case 0xa000: c.setPrg8(1, v & 0x1f); return;
      case 0xb000: c.setChr1(a & 7, v); return;
    }
    IREM_G.apply(c);
  },
};
const TAITO = {
  init(c) { c.setPrg8(2, -2); c.setPrg8(3, -1); c.mmc3 = { latch: 0, count: 0, reload: false, on: false }; },
  write(c, a, v) {
    if (a < 0x8000) return;
    const r = a & 3, hi = a & 0xe000;
    if (hi === 0x8000) {
      if (r === 0) { c.setPrg8(0, v & 0x3f); if (c.mapper === 33) c.setMirror(v & 0x40 ? 'horz' : 'vert'); }
      else if (r === 1) c.setPrg8(1, v & 0x3f);
      else c.setChr2(r - 2, v);
    } else if (hi === 0xa000) c.setChr1(4 + r, v);
    else if (c.mapper === 48 && hi === 0xc000) {   // MMC3 に似た行の IRQ（書いた値は反転して使う）
      const m = c.mmc3;
      if (r === 0) m.latch = (v ^ 0xff) & 0xff; else if (r === 1) { m.count = 0; m.reload = true; } else if (r === 2) m.on = true; else { m.on = false; c.irqLine = false; }
    } else if (c.mapper === 48 && hi === 0xe000 && r === 0) c.setMirror(v & 0x40 ? 'horz' : 'vert');
  },
};
TAITO.line = (c, l) => { if (c.mapper === 48) MMC3.line(c, l); };
const SUN3 = {
  init(c) { c.s3 = { cnt: 0, hi: true, on: false }; },
  write(c, a, v) {
    if (a < 0x8000) return;
    const s = c.s3;
    switch (a & 0xf800) {
      case 0x8800: c.setChr2(0, v); break;
      case 0x9800: c.setChr2(1, v); break;
      case 0xa800: c.setChr2(2, v); break;
      case 0xb800: c.setChr2(3, v); break;
      case 0xc800: if (s.hi) s.cnt = (s.cnt & 0xff) | (v << 8); else s.cnt = (s.cnt & 0xff00) | v; s.hi = !s.hi; break;
      case 0xd800: s.on = !!(v & 0x10); s.hi = true; c.irqLine = false; break;
      case 0xe800: c.setMirror(MIRROR4[v & 3]); break;
      case 0xf800: c.setPrg16(0, v); break;
    }
  },
  clock(c, n) {
    const s = c.s3;
    if (!s.on) return;
    s.cnt -= n;
    if (s.cnt < 0) { s.cnt += 0x10000; s.on = false; c.irqLine = true; }
  },
};
const SUN4 = {
  init(c) { c.s4 = { nt: [0x80, 0x80], mir: 0, rom: false }; },
  apply(c) {
    const s = c.s4;
    if (!s.rom) { c.setMirror(MIRROR4[s.mir]); return; }
    const pick = [[0, 1, 0, 1], [0, 0, 1, 1], [0, 0, 0, 0], [1, 1, 1, 1]][s.mir];
    for (let i = 0; i < 4; i++) c.setNt(i, c.chr, c.bank(s.nt[pick[i]] | 0x80, 1024, c.chr.length), true);
  },
  write(c, a, v) {
    if (a < 0x8000) return;
    const s = c.s4, k = (a >> 12) & 7;
    if (k < 4) { c.setChr2(k, v); return; }
    if (k < 6) s.nt[k - 4] = v & 0x7f;
    else if (k === 6) { s.mir = v & 3; s.rom = !!(v & 0x10); }
    else { c.setPrg16(0, v & 0x0f); return; }
    SUN4.apply(c);
  },
};

// ---------- MMC5（5）: PRG・CHR の 4 つのモード、画面の表の割りあて、拡張 RAM、行の IRQ、かけ算 ----------
// まねないもの: 画面の分割（$5200）・MMC5 の音。描くのが行の単位なので、行の途中の切りかえは次の行から
function mmc5Prg(c) {
  const s = c.m5, r = s.prg, mode = s.prgMode;
  const put = (slot, v, rom) => {
    if (rom || (v & 0x80)) c.setPrg8(slot, v & 0x7f);
    else { c.pMem[slot] = c.prgRam; c.p8[slot] = (v & 7) * 8192; }
  };
  if (mode === 0) for (let i = 0; i < 4; i++) put(i, (r[3] & 0x7c) | i, true);
  else if (mode === 1) { put(0, r[1] & 0xfe, false); put(1, (r[1] & 0xfe) | 1, false); put(2, (r[3] & 0x7e), true); put(3, (r[3] & 0x7e) | 1, true); }
  else if (mode === 2) { put(0, r[1] & 0xfe, false); put(1, (r[1] & 0xfe) | 1, false); put(2, r[2], false); put(3, r[3], true); }
  else { put(0, r[0], false); put(1, r[1], false); put(2, r[2], false); put(3, r[3], true); }
}
function mmc5Chr(c) {
  const s = c.m5, A = s.chrA, B = s.chrB, up = s.chrHi << 8, C = c.chr.length;
  const k = (n, size, j) => c.bank((n | up) * (size / 1024) + j, 1024, C);
  const a = new Array(8), b = new Array(8);
  for (let i = 0; i < 8; i++) {
    switch (s.chrMode) {
      case 0: a[i] = k(A[7], 8192, i); b[i] = k(B[3], 8192, i); break;
      case 1: a[i] = k(A[i < 4 ? 3 : 7], 4096, i & 3); b[i] = k(B[3], 4096, i & 3); break;
      case 2: a[i] = k(A[(i >> 1) * 2 + 1], 2048, i & 1); b[i] = k(B[((i >> 1) & 1) * 2 + 1], 2048, i & 1); break;
      default: a[i] = k(A[i], 1024, 0); b[i] = k(B[i & 3], 1024, 0);
    }
  }
  s.cA = a; s.cB = b;
}
function mmc5Nt(c) {
  const s = c.m5;
  for (let i = 0; i < 4; i++) {
    const m = (s.ntMap >> (i * 2)) & 3;
    if (m < 2) c.setNt(i, c.ciram, m * 1024);
    else if (m === 2) { if (s.exMode < 2) c.setNt(i, s.ex, 0); else c.setNt(i, s.zero, 0, true); }
    else c.setNt(i, s.fill, 0, true);
  }
}
const MMC5 = {
  init(c) {
    c.m5 = {
      prgMode: 3, prg: [0xff, 0xff, 0xff, 0xff], chrMode: 0, chrA: new Array(8).fill(0), chrB: [0, 0, 0, 0], chrHi: 0, lastB: false,
      exMode: 0, ex: new Uint8Array(1024), zero: new Uint8Array(1024), fill: new Uint8Array(1024), ntMap: 0,
      target: 0, irqOn: false, pend: false, inFrame: false, line: 0, m1: 0xff, m2: 0xff,
    };
    mmc5Prg(c); mmc5Chr(c);
  },
  read(c, a) {
    const s = c.m5;
    if (a === 0x5204) { const v = (s.pend ? 0x80 : 0) | (s.inFrame ? 0x40 : 0); s.pend = false; c.irqLine = false; return v; }
    if (a === 0x5205) return (s.m1 * s.m2) & 0xff;
    if (a === 0x5206) return (s.m1 * s.m2) >> 8;
    if (a >= 0x5c00 && a < 0x6000) return s.exMode >= 2 ? s.ex[a - 0x5c00] : 0;
    if (a < 0x6000) return 0;
  },
  write(c, a, v) {
    const s = c.m5;
    if (a >= 0x8000) { const i = (a >> 13) & 3; if (c.pMem[i] === c.prgRam) c.prgRam[c.p8[i] + (a & 0x1fff)] = v; return; }
    if (a >= 0x6000) return;
    if (a >= 0x5c00) { if (s.exMode !== 3) s.ex[a - 0x5c00] = v; return; }
    if (a >= 0x5120 && a <= 0x5127) { s.chrA[a - 0x5120] = v; s.lastB = false; mmc5Chr(c); return; }
    if (a >= 0x5128 && a <= 0x512b) { s.chrB[a - 0x5128] = v; s.lastB = true; mmc5Chr(c); return; }
    if (a >= 0x5114 && a <= 0x5117) { s.prg[a - 0x5114] = v; mmc5Prg(c); return; }
    switch (a) {
      case 0x5100: s.prgMode = v & 3; mmc5Prg(c); break;
      case 0x5101: s.chrMode = v & 3; mmc5Chr(c); break;
      case 0x5104: s.exMode = v & 3; mmc5Nt(c); break;
      case 0x5105: s.ntMap = v; mmc5Nt(c); break;
      case 0x5106: s.fill.fill(v, 0, 960); break;
      case 0x5107: s.fill.fill((v & 3) * 0x55, 960); break;
      case 0x5113: c.ramOff = (v & 7) * 8192; break;
      case 0x5130: s.chrHi = v & 3; mmc5Chr(c); break;
      case 0x5203: s.target = v; break;
      case 0x5204: s.irqOn = !!(v & 0x80); c.irqLine = s.irqOn && s.pend; break;
      case 0x5205: s.m1 = v; break;
      case 0x5206: s.m2 = v; break;
    }
  },
  chrRead(c, a) {
    const s = c.m5, big = c.ppu && (c.ppu.ctrl & 0x20);
    const useB = big ? c.fetch === 1 || (c.fetch === 0 && s.lastB) : s.lastB;
    return c.chr[(useB ? s.cB : s.cA)[a >> 10] + (a & 0x3ff)];
  },
  // 拡張の色（拡張 RAM のモード 1）: 背景の1マスごとに、4KB の CHR とパレットを拡張 RAM から
  exBg(c, ntAddr, p) {
    const s = c.m5;
    if (s.exMode !== 1) return -1;
    const e = s.ex[ntAddr & 0x3ff], base = c.bank((e & 0x3f) | (s.chrHi << 6), 4096, c.chr.length) + (p & 0xfff);
    return ((e >> 6) << 16) | (c.chr[base] << 8) | c.chr[base + 8];
  },
  // 行のはじめ（の手前）に1回: 準備の行のあとで画面の中に入り、行を数えて、決めた行で IRQ
  line(c, l) {
    const s = c.m5;
    if (l === 261) { s.inFrame = true; s.line = 0; return; }
    s.line = l + 1;
    if (s.line >= 240) { s.inFrame = false; return; }
    if (s.line === s.target && s.target) { s.pend = true; if (s.irqOn) c.irqLine = true; }
  },
};

// ---------- 小さなマッパー（1 回書くだけ） ----------
const M = {
  1: {
    init(c) { c.mmc1 = { sr: 0x10, ctrl: 0x0c, chr0: 0, chr1: 0, prg: 0 }; },
    write(c, a, v) {
      if (a < 0x8000) return;
      const m = c.mmc1;
      if (v & 0x80) { m.sr = 0x10; m.ctrl |= 0x0c; mmc1Apply(c); return; }
      const full = m.sr & 1;
      m.sr = (m.sr >> 1) | ((v & 1) << 4);
      if (!full) return;
      const d = m.sr; m.sr = 0x10;
      if (a < 0xa000) m.ctrl = d; else if (a < 0xc000) m.chr0 = d; else if (a < 0xe000) m.chr1 = d; else m.prg = d & 0x0f;
      mmc1Apply(c);
    },
  },
  2: { write(c, a, v) { if (a >= 0x8000) c.setPrg16(0, v); } },                                   // UxROM
  3: { write(c, a, v) { if (a >= 0x8000) c.setChr8(v); } },                                       // CNROM
  4: MMC3, 118: MMC3, 206: MMC3, 88: MMC3, 154: MMC3,
  5: MMC5,
  7: { init(c) { c.setPrg32(0); c.setMirror('one0'); }, write(c, a, v) { if (a >= 0x8000) { c.setPrg32(v & 0x0f); c.setMirror(v & 0x10 ? 'one1' : 'one0'); } } },   // AxROM
  9: MMC2, 10: MMC2,
  11: { init(c) { c.setPrg32(0); }, write(c, a, v) { if (a >= 0x8000) { c.setPrg32(v & 3); c.setChr8(v >> 4); } } },              // カラードリームズ
  16: BANDAI, 159: BANDAI,
  18: JALECO,
  19: N163,
  21: VRC24, 22: VRC24, 23: VRC24, 25: VRC24,
  24: VRC6, 26: VRC6,
  32: IREM_G,
  33: TAITO, 48: TAITO,
  34: {   // BNROM（CHR RAM）と NINA-001（CHR ROM。$7FFD〜$7FFF）
    init(c) { c.setPrg32(0); },
    write(c, a, v) {
      if (a >= 0x8000) { if (c.chrRam || c.chr.length <= 8192) c.setPrg32(v); }
      else if (a === 0x7ffd) c.setPrg32(v & 1);
      else if (a === 0x7ffe) c.setChr4(0, v & 0x0f);
      else if (a === 0x7fff) c.setChr4(1, v & 0x0f);
    },
  },
  65: IREM_H,
  66: { init(c) { c.setPrg32(0); }, write(c, a, v) { if (a >= 0x8000) { c.setPrg32((v >> 4) & 3); c.setChr8(v & 3); } } },       // GxROM
  67: SUN3,
  68: SUN4,
  69: FME7,
  71: { write(c, a, v) { if (a >= 0xc000) c.setPrg16(0, v); else if (a >= 0x9000 && a < 0xa000 && c.sub === 1) c.setMirror(v & 0x10 ? 'one1' : 'one0'); } },   // カメリカ
  75: VRC1,
  87: { write(c, a, v) { if (a >= 0x6000 && a < 0x8000) c.setChr8(((v & 1) << 1) | ((v >> 1) & 1)); } },
  89: { write(c, a, v) { if (a >= 0x8000) { c.setPrg16(0, (v >> 4) & 7); c.setChr8((v & 7) | ((v >> 4) & 8)); c.setMirror(v & 8 ? 'one1' : 'one0'); } } },
  93: { write(c, a, v) { if (a >= 0x8000) c.setPrg16(0, (v >> 4) & 7); } },
  140: { init(c) { c.setPrg32(0); }, write(c, a, v) { if (a >= 0x6000 && a < 0x8000) { c.setPrg32((v >> 4) & 3); c.setChr8(v & 0x0f); } } },
  180: { init(c) { c.setPrg16(0, 0); }, write(c, a, v) { if (a >= 0x8000) c.setPrg16(1, v & 7); } },
  184: { write(c, a, v) { if (a >= 0x6000 && a < 0x8000) { c.setChr4(0, v & 7); c.setChr4(1, ((v >> 4) & 7) | 4); } } },
};
