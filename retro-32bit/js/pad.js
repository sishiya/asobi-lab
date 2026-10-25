// コントローラーの口（SIO0: 1F801040〜）と、十字キーのパッド。
//   やりとり: 選ぶ（CTRL の 1 番）→ 01 を送る（FF が返る）→ 42（41＝十字キーのパッド）→ 00（5A）→ 00（ボタンの下のバイト）→ 00（上のバイト）。
//   ボタンは押すと 0（押していないと 1）。1 バイトごとに「受けとった」の合図（ACK）→ CTRL の 12 番が立っていれば割りこみ 7
//   ボタンの名前はあそびラボで決める（BTN）。番号は口の決まりのまま
//   メモリーカード（段階E）: 口 1 に差してある。81 で呼ぶと、1 フレーム（128 バイト）ずつ読む（52 'R'）・書く（57 'W'）。全部で 1024 フレーム＝128KB
//     読む: 81 52 00 00 上 下 00 00 00 00 [128 こ] 00 00 → FF 08 5A 5D 00 00 5C 5D 上 下 [データ] 合計 47
//     書く: 81 57 00 00 上 下 [128 こ] 合計 00 00 00 → FF 08 5A 5D 00 00 … 5C 5D 47。合計 = 上 ^ 下 ^ データ
//     08 は「新しいカード」の印（はじめて書くまで）。中身はページが端末の中だけに保存する（送らない）
//   マウス: 口 2 に差せる（ページが画面をつかんだら差す）。01 → 42 で 12（マウス）・5A・ボタン 2 バイト（押すと 0。左 = 11 ビット・右 = 10 ビット）・動いた x・y（-128〜127）
//     読んだら動いた量は 0 にもどる
export const BTN = {
  SELECT: 0, START: 3, UP: 4, RIGHT: 5, DOWN: 6, LEFT: 7,
  L2: 8, R2: 9, L: 10, R: 11, Y: 12, A: 13, B: 14, X: 15, // A＝右・B＝下・X＝左・Y＝上（ひし形にならぶ4つ）
};

export const CARD_SIZE = 128 * 1024;
export class MemCard {
  constructor(data, onWrite) {
    this.data = data && data.length === CARD_SIZE ? data : MemCard.format();
    this.flag = 0x08;
    this.onWrite = onWrite || (() => {});
  }
  // 空のカード: フレーム 0 に「MC」、フレーム 1〜15 に空いているブロックの印（A0）。どのフレームも最後のバイトは前の 127 バイトの XOR
  static format() {
    const d = new Uint8Array(CARD_SIZE);
    const seal = (f) => { let x = 0; for (let i = 0; i < 127; i++) x ^= d[f * 128 + i]; d[f * 128 + 127] = x; };
    d[0] = 0x4d; d[1] = 0x43; seal(0);
    for (let f = 1; f < 16; f++) { d[f * 128] = 0xa0; d[f * 128 + 8] = 0xff; d[f * 128 + 9] = 0xff; seal(f); }
    for (let f = 16; f < 36; f++) { d.fill(0xff, f * 128, f * 128 + 8); }   // 悪いフレームの一覧（空）
    return d;
  }
}

export class SIO {
  constructor(raise) {
    this.raise = raise;       // 割りこみを立てる関数
    this.buttons = [0, 0];    // 押しているボタン（1 が押している）。口 1・口 2
    this.mode = 0; this.ctrl = 0; this.baud = 0;
    this.rx = []; this.irq = false;
    this.step = 0;            // いま何バイト目か（0 = 選ばれていない）
    this.cards = [null, null]; // メモリーカード（口 1・口 2）
    this.mc = null;           // カードとやりとりしている途中
    this.mouse = null;        // 口 2 のマウス { dx, dy, left, right }（null = 差していない）
    this.step2 = 0;
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
      if (!(v & 2)) { this.step = 0; this.step2 = 0; this.mc = null; }   // 選ぶのをやめた
      this.ctrl = v & ~0x50;
    } else if (off === 0xe) this.baud = v;
    else if (off === 0) this.send(v & 0xff);
  }
  send(b) {
    if (!(this.ctrl & 2)) { this.rx.push(0xff); return; }
    const port = (this.ctrl >> 13) & 1, btn = ~this.buttons[port] & 0xffff;
    if (this.mc || (this.step === 0 && b === 0x81)) { this.cardByte(port, b); return; }
    if (port === 1) { this.mouseByte(b); return; }   // 口 2: マウス（差していなければ何も返さない）
    let reply = 0xff, ack = false;
    switch (this.step) {
      case 0: if (b === 0x01) { ack = true; this.step = 1; } break;  // パッドを呼んだ
      case 1: reply = 0x41; ack = true; this.step = 2; break;         // 41 = 十字キーのパッド
      case 2: reply = 0x5a; ack = true; this.step = 3; break;
      case 3: reply = btn & 0xff; ack = true; this.step = 4; break;
      case 4: reply = btn >> 8; this.step = 0; break;                  // 最後は合図なし
      default: this.step = 0;
    }
    this.rx.push(reply);
    if (ack && (this.ctrl & 0x1000)) { this.irq = true; this.raise(); }
  }
  // メモリーカードとの 1 バイト
  cardByte(port, b) {
    const card = this.cards[port];
    let reply = 0xff, ack = true;
    if (!this.mc) {
      if (!card) { this.rx.push(0xff); return; }   // カードが差していない（合図なし）
      this.mc = { i: 1, cmd: 0, addr: 0, chk: 0, buf: new Uint8Array(128) };
      this.rx.push(0xff); this.ackIrq(); return;
    }
    const m = this.mc, i = m.i++;
    if (i === 1) { m.cmd = b; reply = card.flag; if (b !== 0x52 && b !== 0x57) { reply = 0xff; ack = false; this.mc = null; } }
    else if (i === 2) reply = 0x5a;
    else if (i === 3) reply = 0x5d;
    else if (i === 4) { m.addr = (b & 3) << 8; reply = 0; }
    else if (i === 5) { m.addr |= b; m.addr &= 1023; reply = (m.cmd === 0x57) ? m.addr >> 8 : 0; }
    else if (m.cmd === 0x52) {
      if (i === 6) reply = 0x5c;
      else if (i === 7) reply = 0x5d;
      else if (i === 8) reply = m.addr >> 8;
      else if (i === 9) { reply = m.addr & 0xff; m.chk = (m.addr >> 8) ^ (m.addr & 0xff); }
      else if (i < 138) { const v = card.data[m.addr * 128 + (i - 10)]; m.chk ^= v; reply = v; }
      else if (i === 138) reply = m.chk;
      else { reply = 0x47; ack = false; this.mc = null; }
    } else {
      if (i < 134) { m.buf[i - 6] = b; reply = 0; }
      else if (i === 134) { let x = (m.addr >> 8) ^ (m.addr & 0xff); for (const v of m.buf) x ^= v; m.ok = x === b; reply = 0; }
      else if (i === 135) reply = 0x5c;
      else if (i === 136) reply = 0x5d;
      else {
        if (m.ok) { card.data.set(m.buf, m.addr * 128); card.flag = 0; card.onWrite(m.addr); }
        reply = m.ok ? 0x47 : 0x4e; ack = false; this.mc = null;
      }
    }
    this.rx.push(reply);
    if (ack) this.ackIrq();
  }
  // 口 2 のマウスとの 1 バイト
  mouseByte(b) {
    const ms = this.mouse;
    if (!ms) { this.rx.push(0xff); this.step2 = 0; return; }
    let reply = 0xff, ack = true;
    const clamp = (v) => Math.max(-128, Math.min(127, Math.round(v)));
    switch (this.step2) {
      case 0: if (b !== 0x01) { this.rx.push(0xff); return; } this.step2 = 1; break;
      case 1: reply = 0x12; this.step2 = 2; break;
      case 2: reply = 0x5a; this.step2 = 3; break;
      case 3: reply = 0xff; this.step2 = 4; break;
      case 4: reply = 0xf3 | (ms.right ? 0 : 4) | (ms.left ? 0 : 8); this.step2 = 5; break;
      case 5: { const v = clamp(ms.dx); ms.dx -= v; reply = v & 0xff; this.step2 = 6; break; }
      case 6: { const v = clamp(ms.dy); ms.dy -= v; reply = v & 0xff; this.step2 = 0; ack = false; break; }
      default: this.step2 = 0;
    }
    this.rx.push(reply);
    if (ack) this.ackIrq();
  }
  ackIrq() { if (this.ctrl & 0x1000) { this.irq = true; this.raise(); } }
}
