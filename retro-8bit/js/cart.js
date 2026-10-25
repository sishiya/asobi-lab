// カートリッジ: iNES の形のファイルを読み、マッパー（バンクの切りかえ）0・1・2・3・4・7 をまねる
export class Cart {
  constructor(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b[0] !== 0x4e || b[1] !== 0x45 || b[2] !== 0x53 || b[3] !== 0x1a) throw new Error('iNES の形ではありません');
    const prgN = b[4], chrN = b[5], f6 = b[6], f7 = b[7];
    this.mapper = (f6 >> 4) | (f7 & 0xf0);
    if (![0, 1, 2, 3, 4, 7].includes(this.mapper)) throw new Error('このマッパーには対応していません: ' + this.mapper);
    let p = 16 + ((f6 & 4) ? 512 : 0);
    this.prg = b.slice(p, p + prgN * 16384); p += prgN * 16384;
    this.chrRam = chrN === 0;
    this.chr = this.chrRam ? new Uint8Array(8192) : b.slice(p, p + chrN * 8192);
    this.prgRam = new Uint8Array(8192);
    this.battery = !!(f6 & 2); // $6000 の RAM が電池で残る（セーブ）
    this.mirror = (f6 & 8) ? 'four' : (f6 & 1) ? 'vert' : 'horz';
    this.prgBanks = [0, Math.max(0, this.prg.length - 16384)]; // $8000・$C000 の 16KB の始まり
    this.chrBanks = [0, 4096];                                  // $0000・$1000 の 4KB の始まり
    if (this.prg.length === 16384) this.prgBanks = [0, 0];
    this.mmc1 = { sr: 0x10, ctrl: 0x0c, chr0: 0, chr1: 0, prg: 0 };
    this.irqLine = false;   // マッパーが CPU に IRQ を出しているか（MMC3）
    if (this.mapper === 4) {
      this.four = this.mirror === 'four';
      this.mmc3 = { sel: 0, r: [0, 2, 4, 5, 6, 7, 0, 1], latch: 0, count: 0, reload: false, on: false };
      this.p8 = [0, 0, 0, 0];               // $8000・$A000・$C000・$E000 の 8KB の始まり
      this.c1 = [0, 0, 0, 0, 0, 0, 0, 0];   // $0000〜$1FFF の 1KB ずつの始まり
      this.mmc3Apply();
    }
  }
  cpuRead(a) {
    if (a >= 0x8000 && this.p8) return this.prg[this.p8[(a >> 13) & 3] + (a & 0x1fff)];
    if (a >= 0x8000) { const i = (a >> 14) & 1; return this.prg[this.prgBanks[i] + (a & 0x3fff)]; }
    if (a >= 0x6000) return this.prgRam[a - 0x6000];
    return 0;
  }
  cpuWrite(a, v) {
    if (a >= 0x6000 && a < 0x8000) { this.prgRam[a - 0x6000] = v; return; }
    if (a < 0x8000) return;
    const P = this.prg.length;
    switch (this.mapper) {
      case 1: this.mmc1Write(a, v); break;
      case 4: this.mmc3Write(a, v); break;
      case 2: this.prgBanks[0] = ((v & 0x0f) * 16384) % P; break;
      case 3: { const o = ((v & 3) * 8192) % this.chr.length; this.chrBanks = [o, o + 4096]; break; }
      case 7: {
        const o = ((v & 7) * 32768) % P; this.prgBanks = [o, o + 16384];
        this.mirror = (v & 0x10) ? 'one1' : 'one0'; break;
      }
    }
  }
  mmc1Write(a, v) {
    const m = this.mmc1;
    if (v & 0x80) { m.sr = 0x10; m.ctrl |= 0x0c; this.mmc1Apply(); return; }
    const full = m.sr & 1;
    m.sr = (m.sr >> 1) | ((v & 1) << 4);
    if (!full) return;
    const d = m.sr; m.sr = 0x10;
    if (a < 0xa000) m.ctrl = d; else if (a < 0xc000) m.chr0 = d; else if (a < 0xe000) m.chr1 = d; else m.prg = d & 0x0f;
    this.mmc1Apply();
  }
  mmc1Apply() {
    const m = this.mmc1, P = this.prg.length, C = this.chr.length;
    this.mirror = ['one0', 'one1', 'vert', 'horz'][m.ctrl & 3];
    const pm = (m.ctrl >> 2) & 3;
    if (pm < 2) { const o = ((m.prg & 0x0e) * 16384) % P; this.prgBanks = [o, o + 16384]; }
    else if (pm === 2) this.prgBanks = [0, (m.prg * 16384) % P];
    else this.prgBanks = [(m.prg * 16384) % P, P - 16384];
    if (m.ctrl & 0x10) this.chrBanks = [(m.chr0 * 4096) % C, (m.chr1 * 4096) % C];
    else { const o = ((m.chr0 & 0x1e) * 4096) % C; this.chrBanks = [o, o + 4096]; }
  }
  // MMC3（マッパー 4）: 8KB ずつの PRG・1KB ずつの CHR・行を数えて IRQ（画面の途中で絵やスクロールを変える）
  mmc3Write(a, v) {
    const m = this.mmc3, odd = a & 1;
    switch (a & 0xe000) {
      case 0x8000: if (odd) m.r[m.sel & 7] = v; else m.sel = v; this.mmc3Apply(); break;
      case 0xa000: if (!odd && !this.four) this.mirror = (v & 1) ? 'horz' : 'vert'; break;   // 奇数は PRG RAM の守り（いつも読み書きできることにする）
      case 0xc000: if (odd) { m.count = 0; m.reload = true; } else m.latch = v; break;
      case 0xe000: if (odd) m.on = true; else { m.on = false; this.irqLine = false; } break;
    }
  }
  mmc3Apply() {
    const m = this.mmc3, r = m.r, P = this.prg.length, C = this.chr.length;
    const b8 = (n) => (n * 8192) % P, last = P - 8192, last2 = P - 16384;
    this.p8 = (m.sel & 0x40) ? [last2, b8(r[7]), b8(r[6]), last] : [b8(r[6]), b8(r[7]), last2, last];
    const k = (n) => (n * 1024) % C;
    const two = [k(r[0] & 0xfe), k((r[0] & 0xfe) + 1), k(r[1] & 0xfe), k((r[1] & 0xfe) + 1)], four = [k(r[2]), k(r[3]), k(r[4]), k(r[5])];
    this.c1 = (m.sel & 0x80) ? [...four, ...two] : [...two, ...four];
  }
  // PPU が描く行ごとに1回（本物は PPU の番地の A12 が上がるとき。背景 $0000・絵 $1000 のふつうの使い方なら、行の 260 ドットめ）
  scanline() {
    const m = this.mmc3;
    if (!m) return;
    if (m.count === 0 || m.reload) { m.count = m.latch; m.reload = false; } else m.count--;
    if (m.count === 0 && m.on) this.irqLine = true;
  }
  chrRead(a) { return this.c1 ? this.chr[this.c1[a >> 10] + (a & 0x3ff)] : this.chr[this.chrBanks[a >> 12] + (a & 0xfff)]; }
  chrWrite(a, v) { if (!this.chrRam) return; if (this.c1) this.chr[this.c1[a >> 10] + (a & 0x3ff)] = v; else this.chr[this.chrBanks[a >> 12] + (a & 0xfff)] = v; }
  // 画面の表（$2000〜$2FFF）が 2KB のどこにあるか
  ntIndex(a) {
    const t = (a >> 10) & 3, o = a & 0x3ff;
    switch (this.mirror) {
      case 'vert': return ((t & 1) << 10) | o;
      case 'horz': return ((t >> 1) << 10) | o;
      case 'one0': return o;
      case 'one1': return 0x400 | o;
      default: return ((t & 1) << 10) | o; // 4画面は 2KB しかないので縦の折り返しで代える
    }
  }
}
