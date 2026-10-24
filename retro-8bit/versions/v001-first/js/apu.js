// APU: 音の係。矩形波2・三角波・ノイズ（DMC は鳴らさない）。CPU の1サイクルごとに進め、
// サンプルの長さぶん平均して（箱のフィルター）音の波を出す
const LENGTH = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
const DUTY = [[0, 1, 0, 0, 0, 0, 0, 0], [0, 1, 1, 0, 0, 0, 0, 0], [0, 1, 1, 1, 1, 0, 0, 0], [1, 0, 0, 1, 1, 1, 1, 1]];
const TRI = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const NOISE = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
export const CPU_HZ = 1789773;

class Envelope {
  constructor() { this.start = false; this.div = 0; this.decay = 0; this.loop = false; this.constant = false; this.vol = 0; }
  clock() {
    if (this.start) { this.start = false; this.decay = 15; this.div = this.vol; }
    else if (this.div === 0) {
      this.div = this.vol;
      if (this.decay) this.decay--; else if (this.loop) this.decay = 15;
    } else this.div--;
  }
  get out() { return this.constant ? this.vol : this.decay; }
}

class Pulse {
  constructor(ones) {
    this.ones = ones; // 1 = 矩形波1（スイープの引き算が1つ多い）
    this.env = new Envelope(); this.on = false; this.len = 0; this.duty = 0; this.seq = 0;
    this.period = 0; this.timer = 0;
    this.swOn = false; this.swDiv = 0; this.swPeriod = 0; this.swNeg = false; this.swShift = 0; this.swReload = false;
  }
  write(r, d) {
    switch (r) {
      case 0: this.duty = d >> 6; this.env.loop = !!(d & 0x20); this.env.constant = !!(d & 0x10); this.env.vol = d & 15; break;
      case 1: this.swOn = !!(d & 0x80); this.swPeriod = (d >> 4) & 7; this.swNeg = !!(d & 8); this.swShift = d & 7; this.swReload = true; break;
      case 2: this.period = (this.period & 0x700) | d; break;
      case 3:
        this.period = (this.period & 0xff) | ((d & 7) << 8);
        if (this.on) this.len = LENGTH[d >> 3];
        this.seq = 0; this.env.start = true; break;
    }
  }
  target() {
    const ch = this.period >> this.swShift;
    return this.swNeg ? this.period - ch - this.ones : this.period + ch;
  }
  sweep() {
    const t = this.target();
    if (this.swDiv === 0 && this.swOn && this.swShift && this.period >= 8 && t <= 0x7ff) this.period = t;
    if (this.swDiv === 0 || this.swReload) { this.swDiv = this.swPeriod; this.swReload = false; } else this.swDiv--;
  }
  tick() { // APU の1サイクル（CPU の2サイクル）
    if (this.timer === 0) { this.timer = this.period; this.seq = (this.seq + 1) & 7; } else this.timer--;
  }
  get out() {
    if (!this.len || this.period < 8 || this.target() > 0x7ff || !DUTY[this.duty][this.seq]) return 0;
    return this.env.out;
  }
}

class Triangle {
  constructor() { this.on = false; this.len = 0; this.ctrl = false; this.linLoad = 0; this.lin = 0; this.linReload = false; this.period = 0; this.timer = 0; this.seq = 0; }
  write(r, d) {
    switch (r) {
      case 0: this.ctrl = !!(d & 0x80); this.linLoad = d & 0x7f; break;
      case 2: this.period = (this.period & 0x700) | d; break;
      case 3: this.period = (this.period & 0xff) | ((d & 7) << 8); if (this.on) this.len = LENGTH[d >> 3]; this.linReload = true; break;
    }
  }
  linear() {
    if (this.linReload) this.lin = this.linLoad; else if (this.lin) this.lin--;
    if (!this.ctrl) this.linReload = false;
  }
  tick() { // CPU の1サイクル
    if (this.timer === 0) {
      this.timer = this.period;
      if (this.len && this.lin && this.period >= 2) this.seq = (this.seq + 1) & 31;
    } else this.timer--;
  }
  get out() { return TRI[this.seq]; }
}

class Noise {
  constructor() { this.env = new Envelope(); this.on = false; this.len = 0; this.mode = false; this.period = 4; this.timer = 0; this.sr = 1; }
  write(r, d) {
    switch (r) {
      case 0: this.env.loop = !!(d & 0x20); this.env.constant = !!(d & 0x10); this.env.vol = d & 15; break;
      case 2: this.mode = !!(d & 0x80); this.period = NOISE[d & 15]; break;
      case 3: if (this.on) this.len = LENGTH[d >> 3]; this.env.start = true; break;
    }
  }
  tick() { // CPU の1サイクル（表は CPU のサイクル）
    if (this.timer === 0) {
      this.timer = this.period - 1;
      const fb = (this.sr & 1) ^ ((this.sr >> (this.mode ? 6 : 1)) & 1);
      this.sr = (this.sr >> 1) | (fb << 14);
    } else this.timer--;
  }
  get out() { return (!this.len || (this.sr & 1)) ? 0 : this.env.out; }
}

export class APU {
  constructor(sampleRate = 44100) {
    this.p1 = new Pulse(1); this.p2 = new Pulse(0); this.tri = new Triangle(); this.noise = new Noise();
    this.cycle = 0; this.frameCycle = 0; this.five = false; this.irqOff = false; this.frameIrq = false;
    this.setRate(sampleRate);
    this.hp = 0; this.hpPrev = 0; this.lp = 0;
  }
  setRate(r) {
    this.rate = r; this.perSample = CPU_HZ / r; this.acc = 0; this.sum = 0; this.cnt = 0;
    this.out = new Float32Array(4096); this.outLen = 0;
  }
  write(a, d) {
    if (a < 0x4004) this.p1.write(a & 3, d);
    else if (a < 0x4008) this.p2.write(a & 3, d);
    else if (a < 0x400c) this.tri.write(a & 3, d);
    else if (a < 0x4010) this.noise.write(a & 3, d);
    else if (a === 0x4015) {
      for (const [ch, bit] of [[this.p1, 1], [this.p2, 2], [this.tri, 4], [this.noise, 8]]) {
        ch.on = !!(d & bit); if (!ch.on) ch.len = 0;
      }
    } else if (a === 0x4017) {
      this.five = !!(d & 0x80); this.irqOff = !!(d & 0x40);
      if (this.irqOff) this.frameIrq = false;
      this.frameCycle = 0;
      if (this.five) { this.quarter(); this.half(); }
    }
  }
  read() { // $4015
    let s = (this.p1.len ? 1 : 0) | (this.p2.len ? 2 : 0) | (this.tri.len ? 4 : 0) | (this.noise.len ? 8 : 0) | (this.frameIrq ? 0x40 : 0);
    this.frameIrq = false;
    return s;
  }
  quarter() { this.p1.env.clock(); this.p2.env.clock(); this.noise.env.clock(); this.tri.linear(); }
  half() {
    for (const ch of [this.p1, this.p2, this.noise]) if (ch.len && !ch.env.loop) ch.len--;
    if (this.tri.len && !this.tri.ctrl) this.tri.len--;
    this.p1.sweep(); this.p2.sweep();
  }
  step(n) {
    while (n-- > 0) {
      this.cycle++;
      // フレームカウンタ（CPU のサイクルで数える）
      const f = ++this.frameCycle;
      if (f === 7457) this.quarter();
      else if (f === 14913) { this.quarter(); this.half(); }
      else if (f === 22371) this.quarter();
      else if (!this.five && f === 29829) { this.quarter(); this.half(); if (!this.irqOff) this.frameIrq = true; this.frameCycle = 0; }
      else if (this.five && f === 37281) { this.quarter(); this.half(); this.frameCycle = 0; }
      if (this.cycle & 1) { this.p1.tick(); this.p2.tick(); }
      this.tri.tick(); this.noise.tick();

      const p = this.p1.out + this.p2.out;
      const pulse = p ? 95.88 / (8128 / p + 100) : 0;
      const t = this.tri.out / 8227 + this.noise.out / 12241;
      const tnd = t ? 159.79 / (1 / t + 100) : 0;
      this.sum += pulse + tnd; this.cnt++;
      if (++this.acc >= this.perSample) {
        this.acc -= this.perSample;
        let s = this.sum / this.cnt; this.sum = 0; this.cnt = 0;
        // 直流を消す（ハイパス）と、少しまるめる（ローパス）
        const hp = s - this.hpPrev + 0.996 * this.hp; this.hpPrev = s; this.hp = hp;
        this.lp += (hp - this.lp) * 0.6;
        if (this.outLen < this.out.length) this.out[this.outLen++] = this.lp;
      }
    }
  }
  take() { const r = this.out.slice(0, this.outLen); this.outLen = 0; return r; }
}
