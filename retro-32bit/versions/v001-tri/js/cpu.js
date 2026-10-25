// CPU: MIPS R3000A（32ビット）。1命令ずつ進める。
//   遅延スロット（とぶ命令のつぎの1つは、とぶ前に動く）と、ロードの遅れ（読んだ値はつぎのつぎの命令から見える）をまねる。
//   COP0 は例外と割りこみに要る所だけ。COP2（GTE）は段階B で gte に渡す
// 32ビット×32ビット（符号なし）の上の 32 ビット。16 ビットずつに分けてかける
export function umulHi(a, b) {
  const al = a & 0xffff, ah = a >>> 16, bl = b & 0xffff, bh = b >>> 16;
  const p1 = ah * bl, p2 = al * bh;
  const mid = ((al * bl) >>> 16) + (p1 & 0xffff) + (p2 & 0xffff);
  return (ah * bh + (p1 >>> 16) + (p2 >>> 16) + (mid >>> 16)) | 0;
}

export class CPU {
  constructor(bus) {
    this.bus = bus;
    this.r = new Int32Array(32);
    this.hi = 0; this.lo = 0;
    this.cop0 = new Int32Array(32);
    this.gte = null;
    this.reset(0xbfc00000);
  }
  reset(pc) {
    this.r.fill(0); this.hi = 0; this.lo = 0;
    this.pc = pc >>> 0; this.next = (pc + 4) >>> 0;
    this.cur = this.pc;          // いま動いている命令の番地（例外の戻り先）
    this.branched = false;       // いまの命令がとぶ命令だった
    this.inDelay = false;        // いまの命令が遅延スロットの中
    this.ldR = 0; this.ldV = 0;  // 遅れて書くロード
    this.pendR = 0;
    this.cop0.fill(0);
    this.cop0[12] = 0x00400000;  // SR: BEV（例外の行き先を BIOS 側に）
    this.cop0[15] = 0x00000002;  // PRId
    this.irqLine = false;        // 割りこみの線（I_STAT & I_MASK が 0 でない）
  }

  set(i, v) { this.r[i] = v; if (i === this.pendR) this.pendR = 0; this.r[0] = 0; }

  exception(code) {
    const c0 = this.cop0, sr = c0[12];
    c0[12] = (sr & ~0x3f) | ((sr << 2) & 0x3f); // 割りこみ・モードの3段の積みを1段ずらす
    c0[13] = (c0[13] & ~0x8000007c) | (code << 2) | (this.inDelay ? 0x80000000 : 0);
    c0[14] = this.inDelay ? this.cur - 4 : this.cur;
    this.pc = (sr & 0x00400000) ? 0xbfc00180 : 0x80000080;
    this.next = (this.pc + 4) >>> 0;
    this.branched = false;
  }

  step() {
    const c0 = this.cop0;
    // 割りこみ（命令の切れ目で受ける）
    if (this.irqLine) c0[13] |= 0x400; else c0[13] &= ~0x400;
    this.cur = this.pc;
    this.inDelay = this.branched; this.branched = false;
    if ((c0[12] & 1) && (c0[12] & c0[13] & 0xff00)) {
      // 遅れて書くロードは、とぶ前に書き終える
      if (this.ldR) { this.r[this.ldR] = this.ldV; this.ldR = 0; }
      this.exception(0);
      return;
    }
    if (this.pc & 3) { c0[8] = this.pc; this.exception(4); return; }
    const op = this.bus.fetch(this.pc);
    this.pc = this.next; this.next = (this.next + 4) >>> 0;
    this.pendR = this.ldR; const pv = this.ldV; this.ldR = 0;
    this.exec(op, pv);
    if (this.pendR) this.r[this.pendR] = pv;
    this.r[0] = 0;
  }

  jump(t) { this.next = t >>> 0; this.branched = true; }
  branch(op, cond) { this.branched = true; if (cond) this.next = (this.pc + ((op << 16) >> 14)) >>> 0; }
  load(rt, v) { if (rt) { this.ldR = rt; this.ldV = v | 0; } if (rt === this.pendR) this.pendR = 0; }

  exec(op, pv) {
    const r = this.r, rs = (op >>> 21) & 31, rt = (op >>> 16) & 31, rd = (op >>> 11) & 31;
    const imm = (op << 16) >> 16, uimm = op & 0xffff;
    const bus = this.bus;
    switch (op >>> 26) {
      case 0: switch (op & 63) {
        case 0: this.set(rd, r[rt] << ((op >>> 6) & 31)); break;
        case 2: this.set(rd, r[rt] >>> ((op >>> 6) & 31)); break;
        case 3: this.set(rd, r[rt] >> ((op >>> 6) & 31)); break;
        case 4: this.set(rd, r[rt] << (r[rs] & 31)); break;
        case 6: this.set(rd, r[rt] >>> (r[rs] & 31)); break;
        case 7: this.set(rd, r[rt] >> (r[rs] & 31)); break;
        case 8: this.jump(r[rs]); break;
        case 9: { const t = r[rs]; this.set(rd, this.next); this.jump(t); break; }
        case 12: this.exception(8); break;
        case 13: this.exception(9); break;
        case 16: this.set(rd, this.hi); break;
        case 17: this.hi = r[rs]; break;
        case 18: this.set(rd, this.lo); break;
        case 19: this.lo = r[rs]; break;
        case 24: { const a = r[rs], b = r[rt]; this.lo = Math.imul(a, b); this.hi = (umulHi(a, b) - (a < 0 ? b : 0) - (b < 0 ? a : 0)) | 0; break; }
        case 25: this.lo = Math.imul(r[rs], r[rt]); this.hi = umulHi(r[rs], r[rt]); break;
        case 26: { // 0 で割ったとき・いちばん小さい数を -1 で割ったときも、本物と同じ答え
          const n = r[rs], d = r[rt];
          if (d === 0) { this.hi = n; this.lo = n >= 0 ? -1 : 1; }
          else if (n === -0x80000000 && d === -1) { this.hi = 0; this.lo = n; }
          else { this.lo = (n / d) | 0; this.hi = n % d; }
          break;
        }
        case 27: {
          const n = r[rs] >>> 0, d = r[rt] >>> 0;
          if (d === 0) { this.hi = n | 0; this.lo = -1; } else { this.lo = Math.floor(n / d) | 0; this.hi = (n % d) | 0; }
          break;
        }
        case 32: { const v = r[rs] + r[rt]; if (v > 0x7fffffff || v < -0x80000000) this.exception(12); else this.set(rd, v); break; }
        case 33: this.set(rd, r[rs] + r[rt]); break;
        case 34: { const v = r[rs] - r[rt]; if (v > 0x7fffffff || v < -0x80000000) this.exception(12); else this.set(rd, v); break; }
        case 35: this.set(rd, r[rs] - r[rt]); break;
        case 36: this.set(rd, r[rs] & r[rt]); break;
        case 37: this.set(rd, r[rs] | r[rt]); break;
        case 38: this.set(rd, r[rs] ^ r[rt]); break;
        case 39: this.set(rd, ~(r[rs] | r[rt])); break;
        case 42: this.set(rd, r[rs] < r[rt] ? 1 : 0); break;
        case 43: this.set(rd, (r[rs] >>> 0) < (r[rt] >>> 0) ? 1 : 0); break;
        default: this.exception(10);
      } break;
      case 1: { // bltz bgez bltzal bgezal（rt の 1 の位で向き、16 の位で ra に書く）
        const ge = rt & 1, cond = ge ? r[rs] >= 0 : r[rs] < 0;
        if ((rt & 0x1e) === 0x10) this.set(31, this.next);
        this.branch(op, cond); break;
      }
      case 2: this.jump((this.pc & 0xf0000000) | ((op & 0x3ffffff) << 2)); break;
      case 3: this.set(31, this.next); this.jump((this.pc & 0xf0000000) | ((op & 0x3ffffff) << 2)); break;
      case 4: this.branch(op, r[rs] === r[rt]); break;
      case 5: this.branch(op, r[rs] !== r[rt]); break;
      case 6: this.branch(op, r[rs] <= 0); break;
      case 7: this.branch(op, r[rs] > 0); break;
      case 8: { const v = r[rs] + imm; if (v > 0x7fffffff || v < -0x80000000) this.exception(12); else this.set(rt, v); break; }
      case 9: this.set(rt, r[rs] + imm); break;
      case 10: this.set(rt, r[rs] < imm ? 1 : 0); break;
      case 11: this.set(rt, (r[rs] >>> 0) < (imm >>> 0) ? 1 : 0); break;
      case 12: this.set(rt, r[rs] & uimm); break;
      case 13: this.set(rt, r[rs] | uimm); break;
      case 14: this.set(rt, r[rs] ^ uimm); break;
      case 15: this.set(rt, uimm << 16); break;
      case 16: this.cop0op(op, rs, rt, rd); break;
      case 18: this.cop2op(op, rs, rt, rd); break;
      case 17: case 19: this.exception(11); break;
      case 32: { const a = (r[rs] + imm) >>> 0; this.load(rt, (bus.read8(a) << 24) >> 24); break; }
      case 33: { const a = (r[rs] + imm) >>> 0; if (a & 1) { this.addrErr(a, 4); break; } this.load(rt, (bus.read16(a) << 16) >> 16); break; }
      case 35: { const a = (r[rs] + imm) >>> 0; if (a & 3) { this.addrErr(a, 4); break; } this.load(rt, bus.read32(a)); break; }
      case 36: { const a = (r[rs] + imm) >>> 0; this.load(rt, bus.read8(a)); break; }
      case 37: { const a = (r[rs] + imm) >>> 0; if (a & 1) { this.addrErr(a, 4); break; } this.load(rt, bus.read16(a)); break; }
      case 34: case 38: { // lwl lwr: そろっていない語を2回に分けて読む（読みかけのロードの値に重ねる）
        const a = (r[rs] + imm) >>> 0, w = bus.read32(a & ~3), sh = (a & 3) * 8;
        const cur = this.pendR === rt ? pv : r[rt];
        const v = (op >>> 26) === 34
          ? (sh === 24 ? w : (cur & (0x00ffffff >>> sh)) | (w << (24 - sh)))
          : (sh === 0 ? w : (cur & ~(0xffffffff >>> sh)) | (w >>> sh));
        this.load(rt, v); break;
      }
      case 40: { const a = (r[rs] + imm) >>> 0; if (!this.isolated()) bus.write8(a, r[rt]); break; }
      case 41: { const a = (r[rs] + imm) >>> 0; if (a & 1) { this.addrErr(a, 5); break; } if (!this.isolated()) bus.write16(a, r[rt]); break; }
      case 43: { const a = (r[rs] + imm) >>> 0; if (a & 3) { this.addrErr(a, 5); break; } if (!this.isolated()) bus.write32(a, r[rt]); break; }
      case 42: case 46: {
        const a = (r[rs] + imm) >>> 0, al = a & ~3, sh = (a & 3) * 8;
        if (this.isolated()) break;
        const m = bus.read32(al), v = r[rt];
        const w = (op >>> 26) === 42
          ? (sh === 24 ? v : (m & ~(0xffffffff >>> (24 - sh))) | (v >>> (24 - sh)))
          : (sh === 0 ? v : (m & ~(0xffffffff << sh)) | (v << sh));
        bus.write32(al, w); break;
      }
      case 50: { const a = (r[rs] + imm) >>> 0; if (a & 3) { this.addrErr(a, 4); break; } if (this.gte) this.gte.setData(rt, bus.read32(a)); break; }
      case 58: { const a = (r[rs] + imm) >>> 0; if (a & 3) { this.addrErr(a, 5); break; } if (this.gte) bus.write32(a, this.gte.getData(rt)); break; }
      default: this.exception(10);
    }
  }
  // SR の 16 番（キャッシュを切りはなす）が立っている間は、書いても RAM に届かない（BIOS がキャッシュを消すときに使う）
  isolated() { return (this.cop0[12] & 0x10000) !== 0; }
  addrErr(a, code) { this.cop0[8] = a; this.exception(code); }

  cop0op(op, rs, rt, rd) {
    if (rs === 0) this.load(rt, this.cop0[rd]);
    else if (rs === 4) { this.cop0[rd] = rd === 13 ? (this.cop0[13] & ~0x300) | (this.r[rt] & 0x300) : this.r[rt]; }
    else if ((op & 0x3f) === 0x10 && (op & 0x02000000)) { const sr = this.cop0[12]; this.cop0[12] = (sr & ~0xf) | ((sr >> 2) & 0xf); }
    else this.exception(10);
  }
  cop2op(op, rs, rt, rd) {
    const g = this.gte;
    if (!g) { this.exception(11); return; }
    if (op & 0x02000000) g.command(op & 0x1ffffff);
    else if (rs === 0) this.load(rt, g.getData(rd));
    else if (rs === 2) this.load(rt, g.getCtrl(rd));
    else if (rs === 4) g.setData(rd, this.r[rt]);
    else if (rs === 6) g.setCtrl(rd, this.r[rt]);
    else this.exception(10);
  }
}
