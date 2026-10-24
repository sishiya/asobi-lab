// 本体: CPU・PPU・APU・カートリッジ・コントローラーを線でつなぐ（CPU から見た番地の地図）
import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { APU } from './apu.js';
import { Cart } from './cart.js';

// コントローラーのボタンの並び（読み出す順）
export const BTN = { A: 0, B: 1, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7 };

export class Console8 {
  constructor(romBytes, sampleRate) {
    this.cart = new Cart(romBytes);
    this.ram = new Uint8Array(2048);
    this.ppu = new PPU(this.cart);
    this.apu = new APU(sampleRate);
    this.cpu = new CPU(this);
    this.ppu.nmiOut = () => { this.cpu.nmi = true; };
    this.cpu.irq = () => this.apu.frameIrq;
    this.pad = [0, 0]; this.shift = [0, 0]; this.strobe = 0;
    this.cpu.reset();
  }
  reset() { this.ppu.reset(); this.ppu.nmiOut = () => { this.cpu.nmi = true; }; this.cpu.reset(); }

  cpuRead(a) {
    if (a < 0x2000) return this.ram[a & 0x7ff];
    if (a < 0x4000) return this.ppu.readReg(a & 7);
    if (a === 0x4015) return this.apu.read();
    if (a === 0x4016 || a === 0x4017) {
      const i = a & 1;
      if (this.strobe) return 0x40 | (this.pad[i] & 1);
      const v = this.shift[i] & 1; this.shift[i] = (this.shift[i] >> 1) | 0x80;
      return 0x40 | v;
    }
    if (a < 0x6000) return 0;
    return this.cart.cpuRead(a);
  }
  cpuWrite(a, v) {
    if (a < 0x2000) { this.ram[a & 0x7ff] = v; return; }
    if (a < 0x4000) { this.ppu.writeReg(a & 7, v); return; }
    if (a === 0x4014) { // OAM へ 256 バイトをまとめて写す
      const base = v << 8;
      for (let i = 0; i < 256; i++) this.ppu.writeReg(4, this.cpuRead(base + i));
      this.cpu.stall += 513 + (this.cpu.cycles & 1);
      return;
    }
    if (a === 0x4016) {
      this.strobe = v & 1;
      if (this.strobe) { this.shift[0] = this.pad[0]; this.shift[1] = this.pad[1]; }
      return;
    }
    if (a <= 0x4017) { this.apu.write(a, v); return; }
    this.cart.cpuWrite(a, v);
  }

  // 1フレーム（約 1/60 秒）進める
  runFrame() {
    const ppu = this.ppu, cpu = this.cpu, apu = this.apu;
    ppu.frameDone = false;
    let guard = 0;
    while (!ppu.frameDone && guard++ < 200000) {
      if (this.strobe) { this.shift[0] = this.pad[0]; this.shift[1] = this.pad[1]; }
      const c = cpu.step();
      ppu.step(c * 3);
      apu.step(c);
    }
  }
  setButton(player, btn, down) {
    if (down) this.pad[player] |= 1 << btn; else this.pad[player] &= ~(1 << btn);
  }
}
