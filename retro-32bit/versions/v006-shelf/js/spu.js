// SPU: 音の係。512KB の音の RAM に置いた ADPCM（16 バイトで 28 こ）を、24 の声で鳴らす。
//   声ごとに 高さ（0x1000 で 44100Hz）・音量（左右）・ADSR（立ち上がり・減り・保つ・消える）・くり返しの場所。
//   ノイズ・前の声で高さをゆらす（PMON）・残響（音の RAM の終わりのほうを作業場所にして、半分の速さで回す）。
//   1 サンプル = 44100 分の 1 秒。take(rate) で、ページの音の速さに合わせた左右の波を渡す（8ビット互換機の APU と同じ形）
const FILT = [[0, 0], [60, 0], [115, -52], [98, -55], [122, -60]];
const clamp16 = (v) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

class Voice {
  constructor() {
    this.volL = 0; this.volR = 0; this.pitch = 0; this.start = 0; this.adsr1 = 0; this.adsr2 = 0; this.repeat = 0;
    this.addr = 0; this.counter = 0; this.buf = new Int16Array(28); this.old = 0; this.older = 0;
    this.prev = 0;               // ひとつ前のサンプル（なめらかにつなぐ）
    this.phase = 0; this.level = 0; this.wait = 0; // ADSR: 0 止まり・1 立ち上がり・2 減り・3 保つ・4 消える
    this.out = 0;                // この声のいまの出力（PMON 用）
    this.flags = 0;
  }
}

export class SPU {
  constructor(sampleRate = 48000) {
    this.ram = new Uint8Array(512 * 1024);
    this.ram16 = new Int16Array(this.ram.buffer);
    this.v = Array.from({ length: 24 }, () => new Voice());
    this.regs = new Uint16Array(0x200);  // 読み返し用（1F801C00〜1F801DFF）
    this.mainL = 0; this.mainR = 0; this.revL = 0; this.revR = 0;
    this.pmon = 0; this.non = 0; this.eon = 0; this.endx = 0;
    this.cnt = 0; this.xferAddr = 0; this.revBase = 0; this.revPos = 0; this.revOdd = 0;
    this.noise = 1; this.noiseCnt = 0;
    this.revInL = 0; this.revInR = 0; this.revOutL = 0; this.revOutR = 0;
    this.buf = new Float32Array(44100); this.bufLen = 0; // 44100Hz の左右（交互）
    this.setRate(sampleRate);
    this.frac = 0;
  }
  setRate(r) { this.rate = r; this.pos = 0; }

  // ---- レジスタ（16 ビット） ----
  read16(off) {
    if (off < 0x180) {
      const v = this.v[off >> 4];
      if ((off & 15) === 0xc) return v.level;
    }
    if (off === 0x19c) return this.endx & 0xffff;
    if (off === 0x19e) return this.endx >>> 16;
    if (off === 0x1ae) return (this.cnt & 0x3f);
    return this.regs[off >> 1];
  }
  write16(off, d) {
    d &= 0xffff;
    this.regs[off >> 1] = d;
    if (off < 0x180) {
      const v = this.v[off >> 4];
      switch (off & 15) {
        case 0: v.volL = (d & 0x8000) ? 0 : (d << 17) >> 16; break; // 固定の音量（2 倍して 15 ビット）。だんだん変える形は使わない
        case 2: v.volR = (d & 0x8000) ? 0 : (d << 17) >> 16; break;
        case 4: v.pitch = d; break;
        case 6: v.start = d * 8; break;
        case 8: v.adsr1 = d; break;
        case 0xa: v.adsr2 = d; break;
        case 0xc: v.level = d & 0x7fff; break;
        case 0xe: v.repeat = d * 8; break;
      }
      return;
    }
    switch (off) {
      case 0x180: this.mainL = (d & 0x8000) ? 0x3fff : (d << 17) >> 16; break;
      case 0x182: this.mainR = (d & 0x8000) ? 0x3fff : (d << 17) >> 16; break;
      case 0x184: this.revL = (d << 16) >> 16; break;
      case 0x186: this.revR = (d << 16) >> 16; break;
      case 0x188: this.keyOn(d); break;
      case 0x18a: this.keyOn(d << 16); break;
      case 0x18c: this.keyOff(d); break;
      case 0x18e: this.keyOff(d << 16); break;
      case 0x190: this.pmon = (this.pmon & 0xffff0000) | d; break;
      case 0x192: this.pmon = (this.pmon & 0xffff) | (d << 16); break;
      case 0x194: this.non = (this.non & 0xffff0000) | d; break;
      case 0x196: this.non = (this.non & 0xffff) | (d << 16); break;
      case 0x198: this.eon = (this.eon & 0xffff0000) | d; break;
      case 0x19a: this.eon = (this.eon & 0xffff) | (d << 16); break;
      case 0x1a2: this.revBase = d * 8; this.revPos = this.revBase; break;
      case 0x1a6: this.xferAddr = d * 8; break;
      case 0x1a8: this.ram16[(this.xferAddr & 0x7fffe) >> 1] = d; this.xferAddr = (this.xferAddr + 2) & 0x7ffff; break;
      case 0x1aa: this.cnt = d; break;
    }
  }
  // DMA（口 4）: RAM の語を音の RAM へ
  dmaWrite(word) {
    this.ram16[(this.xferAddr & 0x7fffe) >> 1] = word & 0xffff; this.xferAddr = (this.xferAddr + 2) & 0x7ffff;
    this.ram16[(this.xferAddr & 0x7fffe) >> 1] = word >>> 16; this.xferAddr = (this.xferAddr + 2) & 0x7ffff;
  }
  keyOn(bits) {
    for (let i = 0; i < 24; i++) if (bits & (1 << i)) {
      const v = this.v[i];
      v.addr = v.start; v.counter = 0; v.old = v.older = v.prev = 0;
      v.phase = 1; v.level = 0; v.wait = 0;
      this.decode(v);
      this.endx &= ~(1 << i);
    }
  }
  keyOff(bits) { for (let i = 0; i < 24; i++) if (bits & (1 << i)) { const v = this.v[i]; if (v.phase) { v.phase = 4; v.wait = 0; } } }

  // 16 バイトの1かたまりをほどく
  decode(v) {
    const a = v.addr & 0x7fff0, r = this.ram;
    const shift = r[a] & 15, f = Math.min(4, (r[a] >> 4) & 7), flags = r[a + 1];
    const f0 = FILT[f][0], f1 = FILT[f][1];
    const sh = shift > 12 ? 9 : shift;
    let old = v.old, older = v.older;
    for (let k = 0; k < 28; k++) {
      const byte = r[a + 2 + (k >> 1)];
      const nib = (k & 1) ? byte >> 4 : byte & 15;
      let s = ((nib << 28) >> 16) >> sh;           // 4 ビットを上へ寄せてから右へ
      s += (old * f0 + older * f1 + 32) >> 6;
      s = clamp16(s);
      v.buf[k] = s; older = old; old = s;
    }
    v.old = old; v.older = older; v.flags = flags;
    if (flags & 4) v.repeat = a;                   // くり返しのはじめ
  }
  // かたまりの終わり: くり返すか、止まるか
  nextBlock(v, i) {
    const flags = v.flags;
    if (flags & 1) {
      this.endx |= 1 << i;
      if (flags & 2) v.addr = v.repeat;
      else { v.addr = v.repeat; v.phase = 0; v.level = 0; }
    } else v.addr = (v.addr + 16) & 0x7ffff;
    this.decode(v);
  }

  // ADSR を 1 サンプル進める
  envelope(v) {
    if (v.phase === 0) return;
    let exp, dec, shift, step;
    const a1 = v.adsr1, a2 = v.adsr2;
    if (v.phase === 1) { exp = a1 >> 15; dec = 0; shift = (a1 >> 10) & 31; step = 7 - ((a1 >> 8) & 3); }
    else if (v.phase === 2) { exp = 1; dec = 1; shift = (a1 >> 4) & 15; step = -8; }
    else if (v.phase === 3) { exp = a2 >> 15; dec = (a2 >> 14) & 1; shift = (a2 >> 8) & 31; step = dec ? -8 + ((a2 >> 6) & 3) : 7 - ((a2 >> 6) & 3); }
    else { exp = (a2 >> 5) & 1; dec = 1; shift = a2 & 31; step = -8; }
    if (v.wait > 0) { v.wait--; return; }
    let cycles = 1 << Math.max(0, shift - 11);
    let st = step << Math.max(0, 11 - shift);
    if (exp && !dec && v.level > 0x6000) cycles *= 4;
    if (exp && dec) st = (st * v.level) >> 15;
    v.wait = cycles - 1;
    v.level += st;
    if (v.level > 0x7fff) v.level = 0x7fff;
    if (v.level < 0) v.level = 0;
    if (v.phase === 1 && v.level >= 0x7fff) { v.phase = 2; v.wait = 0; }
    else if (v.phase === 2 && v.level <= (((a1 & 15) + 1) << 11)) { v.phase = 3; v.wait = 0; }
    else if (v.phase === 4 && v.level === 0) v.phase = 0;
  }

  // 1 サンプル（44100Hz）
  sample() {
    let L = 0, R = 0, rl = 0, rr = 0;
    // ノイズ（SPUCNT の 8〜13 ビットで速さ）
    const nshift = (this.cnt >> 10) & 15, nstep = ((this.cnt >> 8) & 3) + 4;
    this.noiseCnt -= nstep;
    if (this.noiseCnt < 0) {
      this.noiseCnt += 0x20000 >> nshift;
      const p = this.noise;
      const fb = ((p >> 15) ^ (p >> 12) ^ (p >> 11) ^ (p >> 10) ^ 1) & 1;
      this.noise = ((p << 1) | fb) & 0xffff;
    }
    const noiseOut = (this.noise << 16) >> 16;
    for (let i = 0; i < 24; i++) {
      const v = this.v[i];
      if (v.phase === 0) { v.out = 0; continue; }
      let pitch = v.pitch;
      if (i > 0 && (this.pmon & (1 << i))) pitch = (pitch * (this.v[i - 1].out + 0x8000)) >> 15;
      if (pitch > 0x3fff) pitch = 0x3fff;
      let s;
      if (this.non & (1 << i)) s = noiseOut;
      else {
        const k = v.counter >> 12, fr = (v.counter & 0xfff) / 4096;
        const a = k === 0 ? v.prev : v.buf[k - 1], b = v.buf[k];
        s = a + (b - a) * fr;                       // 2 点でなめらかに（本物の 4 点のガウス補間のかわり）
      }
      v.counter += pitch;
      while ((v.counter >> 12) >= 28) {
        v.counter -= 28 << 12;
        v.prev = v.buf[27];
        this.nextBlock(v, i);
        if (v.phase === 0) break;
      }
      this.envelope(v);
      s = (s * v.level) / 32768;
      v.out = s | 0;
      const l = (s * v.volL) / 32768, r = (s * v.volR) / 32768;
      L += l; R += r;
      if (this.eon & (1 << i)) { rl += l; rr += r; }
    }
    // 残響（半分の速さ）
    if (this.cnt & 0x80) {
      this.revOdd ^= 1;
      if (this.revOdd) this.reverb(rl, rr);
      L += this.revOutL; R += this.revOutR;
    }
    L = (L * this.mainL) / 16384; R = (R * this.mainR) / 16384;
    if ((this.cnt & 0xc000) !== 0xc000) { L = 0; R = 0; } // 15 番 = 動かす・14 番 = 音を出す（0 だと消音）
    return [clamp16(L), clamp16(R)];
  }

  // 残響の作業場所の 16 ビット（場所は 8 バイト単位のレジスタ値をバイトに。base〜終わりで折り返す）
  ra(off) {
    const size = 0x80000 - this.revBase;
    let a = this.revPos + off - this.revBase;
    a = ((a % size) + size) % size;
    return (this.revBase + a) & 0x7fffe;
  }
  rr(off) { return this.ram16[this.ra(off) >> 1]; }
  rw(off, v) { this.ram16[this.ra(off) >> 1] = clamp16(v | 0); }
  reverb(inL, inR) {
    const g = (i) => (this.regs[(0x1c0 >> 1) + i] << 16) >> 16; // 符号つきの数
    const u = (i) => this.regs[(0x1c0 >> 1) + i] * 8;           // 場所（バイト）
    const m = (a, b) => (a * b) / 32768;
    const dAPF1 = u(0), dAPF2 = u(1), vIIR = g(2), vC1 = g(3), vC2 = g(4), vC3 = g(5), vC4 = g(6), vWALL = g(7), vAPF1 = g(8), vAPF2 = g(9);
    const mLSAME = u(10), mRSAME = u(11), mLC1 = u(12), mRC1 = u(13), mLC2 = u(14), mRC2 = u(15), dLSAME = u(16), dRSAME = u(17);
    const mLDIFF = u(18), mRDIFF = u(19), mLC3 = u(20), mRC3 = u(21), mLC4 = u(22), mRC4 = u(23), dLDIFF = u(24), dRDIFF = u(25);
    const mLAPF1 = u(26), mRAPF1 = u(27), mLAPF2 = u(28), mRAPF2 = u(29), vLIN = g(30), vRIN = g(31);
    const Lin = m(vLIN, inL), Rin = m(vRIN, inR);
    if (this.cnt & 0x80) {
      this.rw(mLSAME, m(Lin + m(this.rr(dLSAME), vWALL) - this.rr(mLSAME - 2), vIIR) + this.rr(mLSAME - 2));
      this.rw(mRSAME, m(Rin + m(this.rr(dRSAME), vWALL) - this.rr(mRSAME - 2), vIIR) + this.rr(mRSAME - 2));
      this.rw(mLDIFF, m(Lin + m(this.rr(dRDIFF), vWALL) - this.rr(mLDIFF - 2), vIIR) + this.rr(mLDIFF - 2));
      this.rw(mRDIFF, m(Rin + m(this.rr(dLDIFF), vWALL) - this.rr(mRDIFF - 2), vIIR) + this.rr(mRDIFF - 2));
    }
    let Lout = m(vC1, this.rr(mLC1)) + m(vC2, this.rr(mLC2)) + m(vC3, this.rr(mLC3)) + m(vC4, this.rr(mLC4));
    let Rout = m(vC1, this.rr(mRC1)) + m(vC2, this.rr(mRC2)) + m(vC3, this.rr(mRC3)) + m(vC4, this.rr(mRC4));
    Lout -= m(vAPF1, this.rr(mLAPF1 - dAPF1)); this.rw(mLAPF1, Lout); Lout = m(Lout, vAPF1) + this.rr(mLAPF1 - dAPF1);
    Rout -= m(vAPF1, this.rr(mRAPF1 - dAPF1)); this.rw(mRAPF1, Rout); Rout = m(Rout, vAPF1) + this.rr(mRAPF1 - dAPF1);
    Lout -= m(vAPF2, this.rr(mLAPF2 - dAPF2)); this.rw(mLAPF2, Lout); Lout = m(Lout, vAPF2) + this.rr(mLAPF2 - dAPF2);
    Rout -= m(vAPF2, this.rr(mRAPF2 - dAPF2)); this.rw(mRAPF2, Rout); Rout = m(Rout, vAPF2) + this.rr(mRAPF2 - dAPF2);
    this.revOutL = m(Lout, this.revL); this.revOutR = m(Rout, this.revR);
    this.revPos = this.ra(2);
  }

  // n サンプル進めて、44100Hz の左右をためる
  run(n) {
    for (let k = 0; k < n; k++) {
      const [l, r] = this.sample();
      if (this.bufLen < this.buf.length - 1) { this.buf[this.bufLen++] = l / 32768; this.buf[this.bufLen++] = r / 32768; }
    }
  }
  // ページの音の速さに直して渡す（左・右の Float32Array）
  take() {
    const n = this.bufLen >> 1, step = 44100 / this.rate;
    const out = Math.max(0, Math.floor((n - this.pos) / step));
    const L = new Float32Array(out), R = new Float32Array(out);
    let p = this.pos;
    for (let i = 0; i < out; i++, p += step) {
      const k = Math.floor(p), f = p - k, k2 = Math.min(n - 1, k + 1);
      L[i] = this.buf[k * 2] + (this.buf[k2 * 2] - this.buf[k * 2]) * f;
      R[i] = this.buf[k * 2 + 1] + (this.buf[k2 * 2 + 1] - this.buf[k * 2 + 1]) * f;
    }
    // 使った分を捨てて、残りを前へ
    const used = Math.min(n, Math.floor(p));
    this.pos = p - used;
    this.buf.copyWithin(0, used * 2, this.bufLen);
    this.bufLen -= used * 2;
    return { L, R };
  }
}
