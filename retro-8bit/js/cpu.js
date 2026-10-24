// CPU: 6502（2A03。10進モードの計算はない）。1命令ずつ進め、使ったサイクルを返す
import { OPS } from './ops.js';

export class CPU {
  constructor(bus) {
    this.bus = bus;
    this.a = 0; this.x = 0; this.y = 0; this.s = 0xfd; this.pc = 0;
    this.c = 0; this.z = 0; this.i = 1; this.d = 0; this.v = 0; this.n = 0;
    this.cycles = 0;
    this.nmi = false;      // PPU が立てる。命令の切れ目で受ける
    this.irq = () => false; // 線の状態を返す関数（APU・マッパー）
    this.stall = 0;        // OAM の DMA などで止まるサイクル
    this.crossed = 0;
  }
  reset() {
    this.s = (this.s - 3) & 0xff; this.i = 1;
    this.pc = this.r16(0xfffc); this.cycles += 7;
  }
  rd(a) { return this.bus.cpuRead(a); }
  wr(a, v) { this.bus.cpuWrite(a, v); }
  r16(a) { return this.rd(a) | (this.rd((a + 1) & 0xffff) << 8); }
  fetch() { const v = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return v; }
  fetch16() { const v = this.r16(this.pc); this.pc = (this.pc + 2) & 0xffff; return v; }
  push(v) { this.wr(0x100 | this.s, v); this.s = (this.s - 1) & 0xff; }
  pull() { this.s = (this.s + 1) & 0xff; return this.rd(0x100 | this.s); }
  getP(b) { return this.c | (this.z << 1) | (this.i << 2) | (this.d << 3) | (b << 4) | 0x20 | (this.v << 6) | (this.n << 7); }
  setP(p) { this.c = p & 1; this.z = (p >> 1) & 1; this.i = (p >> 2) & 1; this.d = (p >> 3) & 1; this.v = (p >> 6) & 1; this.n = (p >> 7) & 1; }
  nz(v) { this.z = v === 0 ? 1 : 0; this.n = v >> 7; return v; }
  interrupt(vec, b) {
    this.push(this.pc >> 8); this.push(this.pc & 0xff); this.push(this.getP(b));
    this.i = 1; this.pc = this.r16(vec); this.cycles += 7;
  }

  // アドレスの形からアドレスを求める（imm はオペランドの場所）
  addr(mode) {
    let a, b;
    switch (mode) {
      case 'imm': a = this.pc; this.pc = (this.pc + 1) & 0xffff; return a;
      case 'zp': return this.fetch();
      case 'zpx': return (this.fetch() + this.x) & 0xff;
      case 'zpy': return (this.fetch() + this.y) & 0xff;
      case 'abs': return this.fetch16();
      case 'abx': b = this.fetch16(); a = (b + this.x) & 0xffff; this.crossed = (a ^ b) & 0x100; return a;
      case 'aby': b = this.fetch16(); a = (b + this.y) & 0xffff; this.crossed = (a ^ b) & 0x100; return a;
      case 'ind': // ページの境目でまたがない、本物のくせ
        b = this.fetch16();
        return this.rd(b) | (this.rd((b & 0xff00) | ((b + 1) & 0xff)) << 8);
      case 'izx': b = (this.fetch() + this.x) & 0xff; return this.rd(b) | (this.rd((b + 1) & 0xff) << 8);
      case 'izy':
        b = this.fetch(); b = this.rd(b) | (this.rd((b + 1) & 0xff) << 8);
        a = (b + this.y) & 0xffff; this.crossed = (a ^ b) & 0x100; return a;
      case 'rel': { let o = this.fetch(); if (o & 0x80) o -= 256; return (this.pc + o) & 0xffff; }
    }
    return 0;
  }

  branch(cond, target) {
    if (!cond) return;
    this.cycles += ((target ^ this.pc) & 0xff00) ? 2 : 1;
    this.pc = target;
  }
  adc(m) {
    const s = this.a + m + this.c;
    this.v = (~(this.a ^ m) & (this.a ^ s) & 0x80) ? 1 : 0;
    this.c = s > 0xff ? 1 : 0;
    this.a = this.nz(s & 0xff);
  }
  cmp(r, m) { this.c = r >= m ? 1 : 0; this.nz((r - m) & 0xff); }

  step() {
    if (this.stall > 0) { const s = this.stall; this.stall = 0; this.cycles += s; return s; }
    const start = this.cycles;
    if (this.nmi) { this.nmi = false; this.interrupt(0xfffa, 0); return this.cycles - start; }
    if (!this.i && this.irq()) { this.interrupt(0xfffe, 0); return this.cycles - start; }

    const code = this.fetch();
    const op = OPS[code];
    if (!op) { this.cycles += 2; return 2; } // 知らない命令は何もしない
    this.crossed = 0;
    const mode = op.mode;
    const a = (mode === 'imp' || mode === 'acc') ? 0 : this.addr(mode);
    this.cycles += op.cyc;
    if (op.extra && this.crossed) this.cycles++;
    let m, r;
    switch (op.mn) {
      case 'LDA': this.a = this.nz(this.rd(a)); break;
      case 'LDX': this.x = this.nz(this.rd(a)); break;
      case 'LDY': this.y = this.nz(this.rd(a)); break;
      case 'STA': this.wr(a, this.a); break;
      case 'STX': this.wr(a, this.x); break;
      case 'STY': this.wr(a, this.y); break;
      case 'TAX': this.x = this.nz(this.a); break;
      case 'TAY': this.y = this.nz(this.a); break;
      case 'TXA': this.a = this.nz(this.x); break;
      case 'TYA': this.a = this.nz(this.y); break;
      case 'TSX': this.x = this.nz(this.s); break;
      case 'TXS': this.s = this.x; break;
      case 'PHA': this.push(this.a); break;
      case 'PHP': this.push(this.getP(1)); break;
      case 'PLA': this.a = this.nz(this.pull()); break;
      case 'PLP': this.setP(this.pull()); break;
      case 'ADC': this.adc(this.rd(a)); break;
      case 'SBC': this.adc(this.rd(a) ^ 0xff); break;
      case 'AND': this.a = this.nz(this.a & this.rd(a)); break;
      case 'ORA': this.a = this.nz(this.a | this.rd(a)); break;
      case 'EOR': this.a = this.nz(this.a ^ this.rd(a)); break;
      case 'CMP': this.cmp(this.a, this.rd(a)); break;
      case 'CPX': this.cmp(this.x, this.rd(a)); break;
      case 'CPY': this.cmp(this.y, this.rd(a)); break;
      case 'BIT': m = this.rd(a); this.z = (this.a & m) ? 0 : 1; this.v = (m >> 6) & 1; this.n = m >> 7; break;
      case 'INC': this.wr(a, this.nz((this.rd(a) + 1) & 0xff)); break;
      case 'DEC': this.wr(a, this.nz((this.rd(a) - 1) & 0xff)); break;
      case 'INX': this.x = this.nz((this.x + 1) & 0xff); break;
      case 'INY': this.y = this.nz((this.y + 1) & 0xff); break;
      case 'DEX': this.x = this.nz((this.x - 1) & 0xff); break;
      case 'DEY': this.y = this.nz((this.y - 1) & 0xff); break;
      case 'ASL': case 'LSR': case 'ROL': case 'ROR':
        m = mode === 'acc' ? this.a : this.rd(a);
        if (op.mn === 'ASL') { this.c = m >> 7; r = (m << 1) & 0xff; }
        else if (op.mn === 'LSR') { this.c = m & 1; r = m >> 1; }
        else if (op.mn === 'ROL') { r = ((m << 1) | this.c) & 0xff; this.c = m >> 7; }
        else { r = (m >> 1) | (this.c << 7); this.c = m & 1; }
        this.nz(r);
        if (mode === 'acc') this.a = r; else this.wr(a, r);
        break;
      case 'JMP': this.pc = a; break;
      case 'JSR': r = (this.pc - 1) & 0xffff; this.push(r >> 8); this.push(r & 0xff); this.pc = a; break;
      case 'RTS': this.pc = (this.pull() | (this.pull() << 8)) + 1 & 0xffff; break;
      case 'RTI': this.setP(this.pull()); this.pc = this.pull() | (this.pull() << 8); break;
      case 'BRK':
        this.pc = (this.pc + 1) & 0xffff;
        this.push(this.pc >> 8); this.push(this.pc & 0xff); this.push(this.getP(1));
        this.i = 1; this.pc = this.r16(0xfffe); break;
      case 'BPL': this.branch(!this.n, a); break;
      case 'BMI': this.branch(this.n, a); break;
      case 'BVC': this.branch(!this.v, a); break;
      case 'BVS': this.branch(this.v, a); break;
      case 'BCC': this.branch(!this.c, a); break;
      case 'BCS': this.branch(this.c, a); break;
      case 'BNE': this.branch(!this.z, a); break;
      case 'BEQ': this.branch(this.z, a); break;
      case 'CLC': this.c = 0; break;
      case 'SEC': this.c = 1; break;
      case 'CLI': this.i = 0; break;
      case 'SEI': this.i = 1; break;
      case 'CLD': this.d = 0; break;
      case 'SED': this.d = 1; break;
      case 'CLV': this.v = 0; break;
      case 'NOP': break;
    }
    return this.cycles - start;
  }
}
