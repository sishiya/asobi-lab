// コントローラーの口（SIO0: 1F801040〜）と、十字キーのパッド。
//   やりとり: 選ぶ（CTRL の 1 番）→ 01 を送る（FF が返る）→ 42（41＝十字キーのパッド）→ 00（5A）→ 00（ボタンの下のバイト）→ 00（上のバイト）。
//   ボタンは押すと 0（押していないと 1）。1 バイトごとに「受けとった」の合図（ACK）→ CTRL の 12 番が立っていれば割りこみ 7
//   ボタンの名前はあそびラボで決める（BTN）。番号は口の決まりのまま
export const BTN = {
  SELECT: 0, START: 3, UP: 4, RIGHT: 5, DOWN: 6, LEFT: 7,
  L2: 8, R2: 9, L: 10, R: 11, Y: 12, A: 13, B: 14, X: 15, // A＝右・B＝下・X＝左・Y＝上（ひし形にならぶ4つ）
};

export class SIO {
  constructor(raise) {
    this.raise = raise;       // 割りこみを立てる関数
    this.buttons = [0, 0];    // 押しているボタン（1 が押している）。口 1・口 2
    this.mode = 0; this.ctrl = 0; this.baud = 0;
    this.rx = []; this.irq = false;
    this.step = 0;            // いま何バイト目か（0 = 選ばれていない）
  }
  stat() {
    return 1 | 4 | (this.rx.length ? 2 : 0) | (this.irq ? 0x200 : 0);
  }
  read32(off) {
    if (off === 0) return this.rx.length ? this.rx.shift() : 0xff;
    if (off === 4) return this.stat();
    if (off === 8) return this.mode | (this.ctrl << 16);
    if (off === 0xc) return this.baud << 16;
    return 0;
  }
  write16(off, v) {
    if (off === 8) this.mode = v;
    else if (off === 0xa) {
      if (v & 0x40) { this.ctrl = 0; this.rx = []; this.irq = false; this.step = 0; return; }
      if (v & 0x10) this.irq = false;
      if (!(v & 2)) this.step = 0;   // 選ぶのをやめた
      this.ctrl = v & ~0x50;
    } else if (off === 0xe) this.baud = v;
    else if (off === 0) this.send(v & 0xff);
  }
  send(b) {
    if (!(this.ctrl & 2)) { this.rx.push(0xff); return; }
    const port = (this.ctrl >> 13) & 1, btn = ~this.buttons[port] & 0xffff;
    if (port === 1) { this.rx.push(0xff); return; } // 口 2 には何もつながっていない
    let reply = 0xff, ack = false;
    switch (this.step) {
      case 0: if (b === 0x01) { ack = true; this.step = 1; } break;  // パッドを呼んだ（ほかの 81 はメモリーカード: 段階E）
      case 1: reply = 0x41; ack = true; this.step = 2; break;         // 41 = 十字キーのパッド
      case 2: reply = 0x5a; ack = true; this.step = 3; break;
      case 3: reply = btn & 0xff; ack = true; this.step = 4; break;
      case 4: reply = btn >> 8; this.step = 0; break;                  // 最後は合図なし
      default: this.step = 0;
    }
    this.rx.push(reply);
    if (ack && (this.ctrl & 0x1000)) { this.irq = true; this.raise(); }
  }
}
