// 基板をのぞく（PLAN 8章。v031）: 本体の中の図（SVG）と、ゆっくり動かす速さ。
// 部品の働きは、本体の CPU の読み書き・絵の係の読み出し・割りこみの手を、のぞいているあいだだけ包んで数える（閉じたら外す。ふつうに遊ぶ速さは変えない）。
// 図はあそびラボの絵（本物の基板の写真・配置の写しは使わない）。目立たせるのは、いまの出来事1つ（説明の一行と、線を走る粒）
import { TX } from './i18n.js';
import { OPS } from './ops.js';

// 速さ（ふつうの何倍か）。0 は止める
export const SPEEDS = [0, 1 / 10000, 1 / 1000, 1 / 100, 1 / 10, 1];
const SPEED_LABEL = ['⏸', '1/10000', '1/1000', '1/100', '1/10', TX('ふつう', 'Normal')];

// 図の部品: [かぎ, x, y, 幅, 高さ, 名前, 小さな字, 線の色の組]
const CHIPS = [
  ['cpu', 60, 186, 150, 104, 'CPU', TX('計算の係', 'Thinks'), 'cpu'],
  ['ram', 60, 322, 150, 52, TX('作業メモリ', 'Work RAM'), 'RAM 2KB', 'cpu'],
  ['ppu', 370, 186, 150, 104, TX('絵の係', 'Picture chip'), 'PPU', 'ppu'],
  ['vram', 370, 322, 150, 52, TX('画面の表', 'Screen table'), 'VRAM 2KB', 'ppu'],
  ['prg', 146, 44, 96, 62, TX('プログラム', 'Program'), 'PRG ROM', 'cpu'],
  ['map', 254, 44, 62, 62, TX('切りかえ', 'Switch'), TX('マッパー', 'Mapper'), 'cpu'],
  ['wram', 328, 44, 62, 62, TX('電池', 'Battery'), 'RAM 8KB', 'cpu'],
  ['chr', 402, 44, 96, 62, TX('絵の ROM', 'Picture ROM'), 'CHR', 'ppu'],
];
// 線: [かぎ, 道（はじめ → おわり）, 色の組]。粒は道の向き（rev で逆）に走る
const WIRES = [
  ['ram', 'M135 290V322', 'cpu'],
  ['ppu', 'M210 214H370', 'cpu'],
  ['prg', 'M150 186V156H194V106', 'cpu'],
  ['map', 'M194 156H285V106', 'cpu'],
  ['wram', 'M285 156H359V106', 'cpu'],
  ['pad', 'M44 238H60', 'ctl'],
  ['nmi', 'M370 266H210', 'sig'],
  ['chr', 'M450 186V106', 'ppu'],
  ['vram', 'M445 290V322', 'ppu'],
  ['video', 'M520 222H598', 'out'],
  ['audio', 'M210 276H232V306H560V250H598', 'out'],
];
// 1サイクルあたりの、いっぱいに光る働きの量（だいたいの目安）
const REF = { prg: 0.5, ram: 0.12, ppu: 0.04, apu: 0.006, pad: 0.004, map: 0.004, wram: 0.04, chr: 1, vram: 0.5 };

const CH = [TX('矩形波1', 'pulse 1'), TX('矩形波2', 'pulse 2'), TX('三角波', 'triangle'), TX('ノイズ', 'noise'), 'DPCM'];
const PAD_NAMES = ['A', 'B', 'SELECT', 'START', '↑', '↓', '←', '→'];
const hex = (n, w) => '$' + n.toString(16).toUpperCase().padStart(w, '0');

// 命令の意味（1命令ずつ進めるときに出す）
const GLOSS = {
  LDA: TX('A に読む', 'load into A'), LDX: TX('X に読む', 'load into X'), LDY: TX('Y に読む', 'load into Y'),
  STA: TX('A を書く', 'store A'), STX: TX('X を書く', 'store X'), STY: TX('Y を書く', 'store Y'),
  JMP: TX('とぶ', 'jump'), JSR: TX('呼ぶ', 'call'), RTS: TX('呼ばれた所へもどる', 'return'), RTI: TX('割りこみからもどる', 'return from interrupt'),
  BNE: TX('ちがう（0 でない）ならとぶ', 'jump if not equal'), BEQ: TX('同じ（0）ならとぶ', 'jump if equal'), BPL: TX('プラスならとぶ', 'jump if plus'), BMI: TX('マイナスならとぶ', 'jump if minus'),
  BCC: TX('くり上がりなしならとぶ', 'jump if no carry'), BCS: TX('くり上がりならとぶ', 'jump if carry'), BVC: TX('あふれなしならとぶ', 'jump if no overflow'), BVS: TX('あふれならとぶ', 'jump if overflow'),
  CMP: TX('A とくらべる', 'compare with A'), CPX: TX('X とくらべる', 'compare with X'), CPY: TX('Y とくらべる', 'compare with Y'),
  ADC: TX('たす', 'add'), SBC: TX('ひく', 'subtract'), INC: TX('1 ふやす', 'add 1'), DEC: TX('1 へらす', 'take 1'),
  INX: TX('X を 1 ふやす', 'X + 1'), INY: TX('Y を 1 ふやす', 'Y + 1'), DEX: TX('X を 1 へらす', 'X − 1'), DEY: TX('Y を 1 へらす', 'Y − 1'),
  AND: TX('ビットを残す', 'keep bits'), ORA: TX('ビットを立てる', 'set bits'), EOR: TX('ビットを裏返す', 'flip bits'), BIT: TX('ビットをしらべる', 'test bits'),
  ASL: TX('左へずらす（×2）', 'shift left (×2)'), LSR: TX('右へずらす（÷2）', 'shift right (÷2)'), ROL: TX('左へまわす', 'rotate left'), ROR: TX('右へまわす', 'rotate right'),
  PHA: TX('A を積む', 'push A'), PLA: TX('A へおろす', 'pull A'), PHP: TX('しるしを積む', 'push flags'), PLP: TX('しるしをおろす', 'pull flags'),
  TAX: TX('A を X へ', 'A to X'), TAY: TX('A を Y へ', 'A to Y'), TXA: TX('X を A へ', 'X to A'), TYA: TX('Y を A へ', 'Y to A'), TSX: TX('積み場所を X へ', 'stack to X'), TXS: TX('X を積み場所へ', 'X to stack'),
  CLC: TX('くり上がりを消す', 'clear carry'), SEC: TX('くり上がりを立てる', 'set carry'), CLI: TX('割りこみを許す', 'allow interrupts'), SEI: TX('割りこみを止める', 'block interrupts'),
  CLD: TX('10進を消す', 'clear decimal'), SED: TX('10進を立てる', 'set decimal'), CLV: TX('あふれを消す', 'clear overflow'), NOP: TX('何もしない', 'do nothing'), BRK: TX('止まる', 'break'),
};

export function createBoard(root, beamCanvas) {
  const NS = 'http://www.w3.org/2000/svg';
  root.innerHTML = `
    <div class="spd" role="group" aria-label="${TX('速さ', 'Speed')}">
      ${SPEEDS.map((s, i) => `<button type="button" data-speed="${i}" ${i === 0 ? `aria-label="${TX('止める', 'Pause')}"` : ''}>${SPEED_LABEL[i]}</button>`).join('')}
    </div>
    <div class="stepper"><button type="button" data-step="op">${TX('1命令', '1 step')} ▸</button><button type="button" data-step="frame">${TX('1こま', '1 frame')} ▸▸</button></div>
    <svg class="pcb" viewBox="0 0 640 392" role="img" aria-label="${TX('本体の中の図', 'Inside the console')}"></svg>
    <div class="cap" aria-live="polite"><code class="op"></code><span class="txt"></span></div>`;
  const svg = root.querySelector('svg');
  const capOp = root.querySelector('.op'), capTxt = root.querySelector('.txt');
  const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; };

  // 基板の地とカセット（上のふちから差しこむ）
  const defs = el('defs', {}), pat = el('pattern', { id: 'vias', width: 16, height: 16, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 8, cy: 8, r: 1.2, fill: 'rgba(255,255,255,.05)' }, pat);
  el('rect', { class: 'base', x: 4, y: 136, width: 632, height: 252, rx: 14 });
  el('rect', { class: 'vias', x: 4, y: 136, width: 632, height: 252, rx: 14 });
  const cartG = el('g', { class: 'cartg' });
  el('rect', { class: 'cartpcb', x: 128, y: 14, width: 388, height: 112, rx: 10 }, cartG);
  el('text', { class: 'area', x: 140, y: 32 }, cartG).textContent = TX('カセット', 'Cassette');
  for (let x = 150; x < 494; x += 10) el('rect', { class: 'finger', x, y: 118, width: 6, height: 14, rx: 1 }, cartG);
  el('text', { class: 'area', x: 18, y: 156 }, svg).textContent = TX('本体', 'Console');

  const parts = {}, wires = {};
  const wireG = el('g', {});
  for (const [k, d, kind] of WIRES) {
    const g = el('g', { class: 'wire ' + kind }, wireG);
    el('path', { class: 'under', d }, g);
    const p = el('path', { class: 'glow', d }, g);
    wires[k] = { g, p, len: 0 };
  }
  // 線の名前（少しだけ）
  el('text', { class: 'wlbl cpu', x: 290, y: 207, 'text-anchor': 'middle' }).textContent = TX('CPU の線', 'CPU bus');
  el('text', { class: 'wlbl sig', x: 290, y: 284, 'text-anchor': 'middle' }).textContent = TX('合図', 'signal');
  el('text', { class: 'wlbl ppu', x: 458, y: 152 }).textContent = TX('絵の線', 'picture bus');

  for (const [k, x, y, w, h, name, sub, kind] of CHIPS) {
    const g = el('g', { class: 'chip ' + kind });
    // 足（銀の小さな四角）
    const legs = el('g', { class: 'legs' }, g);
    const n = Math.max(3, Math.floor(w / 14));
    for (let i = 0; i < n; i++) {
      const lx = x + 8 + (i * (w - 16)) / (n - 1) - 2;
      el('rect', { x: lx, y: y - 4, width: 4, height: 5 }, legs);
      el('rect', { x: lx, y: y + h - 1, width: 4, height: 5 }, legs);
    }
    el('rect', { class: 'body', x, y, width: w, height: h, rx: 6 }, g);
    el('circle', { class: 'pin1', cx: x + 9, cy: y + 9, r: 2.5 }, g);
    const t = el('text', { class: 'name', x: x + w / 2, y: y + h / 2 + (h > 60 ? -6 : -2), 'text-anchor': 'middle' }, g); t.textContent = name;
    const s = el('text', { class: 'sub', x: x + w / 2, y: y + h / 2 + (h > 60 ? 10 : 13), 'text-anchor': 'middle' }, g); s.textContent = sub;
    parts[k] = { g, t, s };
  }
  // CPU の中の音の係（本物も CPU と同じ石の中）
  {
    const g = el('g', { class: 'chip sub apu' });
    el('rect', { class: 'body', x: 72, y: 254, width: 126, height: 26, rx: 4 }, g);
    el('text', { class: 'name small', x: 135, y: 271, 'text-anchor': 'middle' }, g).textContent = TX('音の係', 'Sound');
    parts.apu = { g };
    parts.cpu.t.setAttribute('y', 222); parts.cpu.s.setAttribute('y', 238);
  }
  // コントローラーの口・テレビへの口
  for (const [k, x, label] of [['pad', 8, '1P'], ['tv', 598, 'TV']]) {
    const g = el('g', { class: 'jack ' + (k === 'pad' ? 'ctl' : k) });   // .pad は画面のコントローラーの名前なので使わない
    el('rect', { class: 'body', x, y: 200, width: 36, height: 76, rx: 6 }, g);
    for (let i = 0; i < 3; i++) el('circle', { class: 'hole', cx: x + 18, cy: 218 + i * 18, r: 4 }, g);
    el('text', { class: 'name small', x: x + 18, y: 194, 'text-anchor': 'middle' }, g).textContent = label;
    parts[k] = { g };
  }
  const pkG = el('g', { class: 'pks' });
  const capWhere = el('text', { class: 'where', x: 626, y: 380, 'text-anchor': 'end' });   // いまビームのいる行（図の右下）

  // ---------- 数える ----------
  let nes = null, cart = null;
  const cnt = {}, lvl = {};
  const KEYS = ['cpu', 'apu', 'ram', 'ppu', 'vram', 'prg', 'map', 'wram', 'chr', 'pad', 'nmi', 'video', 'audio', 'tv'];
  for (const k of KEYS) { cnt[k] = 0; lvl[k] = 0; }
  let lastCycles = 0, nowMs = 0;
  let best = null;            // まだ見せていない、いちばん目立つ出来事
  let shown = null, shownAt = -1e9, shownN = 0;
  let stepLog = null;         // 1命令ずつのときの、その命令の出来事
  let padBits = [];
  const packets = [];
  let pcMin = 1e9, pcMax = -1;

  // text は関数（出すときだけ文を作る。ふつうの速さでは1こまに何万回も呼ばれるので、集めない）
  function ev(kind, prio, text, wire, rev) {
    if (speed === 1 && !stepLog) return;
    if (wire && prio >= 4) packet(wire, rev, kind === 'nmi' ? 'sig' : null);
    if (!stepLog && best && prio < best.prio) return;
    const e = { kind, prio, text, wire, rev, t: nowMs };
    if (stepLog) stepLog.push(e);
    if (!best || prio >= best.prio) best = e;
  }
  function packet(wire, rev, kind) {
    if (speed > 1 / 100 && speed !== 0) return;   // 速いときは粒を出さない（線の光だけ）
    const w = wires[wire]; if (!w) return;
    if (packets.some((p) => p.w === w && nowMs - p.t0 < 160)) return;
    if (packets.length > 6) packets.shift().c.remove();
    if (!w.len) w.len = w.p.getTotalLength();
    const c = el('circle', { r: 5, class: 'pk ' + (kind || WIRES.find((x) => x[0] === wire)[2]) }, pkG);
    packets.push({ w, c, rev, t0: nowMs });
  }

  function cpuRead(a, v) {
    if (a < 0x2000) { cnt.ram++; ev('ramr', 1, () => TX(`作業メモリから読む（${hex(a & 0x7ff, 3)}）`, `Read work RAM (${hex(a & 0x7ff, 3)})`), 'ram', true); return; }
    if (a < 0x4000) {
      cnt.ppu++;
      if ((a & 7) === 2) ev('ppus', 3, () => TX('絵の係に「描き終わった？」と聞く', 'Ask the picture chip "done drawing?"'), 'ppu', true);
      else ev('ppur', 3, () => TX('絵の係から読む', 'Read from the picture chip'), 'ppu', true);
      return;
    }
    if (a === 0x4016 || a === 0x4017) {
      cnt.pad++;
      if (a === 0x4016) {
        padBits.push(v & 1);
        if (padBits.length === 8) {
          const on = padBits.map((b, i) => (b ? PAD_NAMES[i] : null)).filter(Boolean);
          ev('padRead', 5, () => TX(`ボタン8つを、1本の線で1つずつ読んだ。押していたのは: ${on.length ? on.join('・') : 'なし'}`,
            `Read the 8 buttons one by one on a single wire. Held: ${on.length ? on.join(', ') : 'none'}`), 'pad', true);
        } else ev('padBit', 4, () => TX(`ボタンを1つ読む: ${PAD_NAMES[padBits.length - 1] || '?'} は ${v & 1 ? '押している' : 'はなしている'}`,
          `Read one button: ${PAD_NAMES[padBits.length - 1] || '?'} is ${v & 1 ? 'held' : 'up'}`), 'pad', true);
      }
      return;
    }
    if (a === 0x4015) { cnt.apu++; return; }
    if (a >= 0x8000) { cnt.prg++; ev('prg', 0, () => TX('プログラムを読む', 'Read the program'), 'prg', true); return; }
    if (a >= 0x6000) { cnt.wram++; ev('wramr', 1, () => TX('カセットのメモリから読む', 'Read cassette RAM'), 'wram', true); return; }
    if (a >= 0x4020) cnt.map++;
  }
  function cpuWrite(a, v) {
    if (a < 0x2000) { cnt.ram++; ev('ramw', 2, () => TX(`作業メモリに書く（${hex(a & 0x7ff, 3)} ← ${hex(v, 2)}）`, `Write work RAM (${hex(a & 0x7ff, 3)} ← ${hex(v, 2)})`), 'ram'); return; }
    if (a < 0x4000) {
      cnt.ppu++;
      const r = a & 7, pv = nes.ppu.v & 0x3fff;
      ev('ppuw' + r, r === 7 ? 3 : 4, () => [
        TX('絵の係の設定', 'Picture chip settings'),
        TX('映すもの（背景・キャラ）を決める', 'Choose what to show (background, sprites)'), '',
        TX('キャラの表の、書く場所', 'Where to write in the sprite table'), TX('キャラの表に書く', 'Write the sprite table'),
        TX('スクロール（画面をずらす）', 'Scroll (shift the screen)'), TX('画面の表の、書く場所を決める', 'Set where to write in the screen table'),
        pv < 0x2000 ? TX('絵の RAM に書く', 'Write picture RAM') : pv < 0x3f00 ? TX('画面の表に書く（背景の1マス）', 'Write the screen table (one background tile)') : TX('色の表に書く', 'Write the color table'),
      ][r] || TX('絵の係に書く', 'Write to the picture chip'), 'ppu');
      return;
    }
    if (a === 0x4014) {
      cnt.ppu += 256;   // 作業メモリから読む 256 回は、cpuRead が数える
      ev('dma', 5, () => TX('キャラの位置 256 バイトを、作業メモリから絵の係へまとめて送る（DMA）',
        'Send 256 bytes of sprite positions from work RAM to the picture chip at once (DMA)'), 'ppu');
      packet('ram', true);
      return;
    }
    if (a === 0x4016) {
      cnt.pad++;
      if (v & 1) { padBits = []; ev('padLatch', 5, () => TX('ボタンの今を写しとる（8つを1列にならべる）', 'Latch the buttons (all 8 in a row)'), 'pad'); }
      return;
    }
    if (a < 0x4018) {
      cnt.apu++;
      ev('apu', 4, () => {
        let t;
        if (a === 0x4015) t = TX('どの音を鳴らすかを決める', 'Choose which voices play');
        else if (a === 0x4017) t = TX('音の係の時計の設定', 'Sound chip timer settings');
        else {
          const ch = CH[(a - 0x4000) >> 2], r = a & 3;
          t = r === 3 && a < 0x4010 ? TX(`${ch} を鳴らしはじめる`, `Start a note on ${ch}`) : TX(`${ch} の音を変える`, `Change ${ch}`);
        }
        return TX('音の係へ: ', 'Sound chip: ') + t;
      }, null);
      return;
    }
    if (a >= 0x8000) {
      if (cart.mapper !== 0) { cnt.map++; ev('bank', 5, () => TX('ROM の切りかえ（カセットの中で、見える場所を入れかえる）', 'Bank switch (swap which part of the ROM is visible)'), 'map'); }
      return;
    }
    if (a >= 0x6000) {
      cnt.wram++;
      if (cart.battery) ev('save', 4, () => TX(`電池のメモリに書く（セーブ。${hex(a, 4)}）`, `Write battery RAM (save, ${hex(a, 4)})`), 'wram');
      else ev('wramw', 2, () => TX('カセットのメモリに書く', 'Write cassette RAM'), 'wram');
      return;
    }
    if (a >= 0x4020) cnt.map++;
  }

  function attach(n) {
    detach();
    nes = n; cart = n.cart;
    const proto = Object.getPrototypeOf(n);
    n.cpuRead = (a) => { const v = proto.cpuRead.call(n, a); cpuRead(a, v); return v; };
    n.cpuWrite = (a, v) => { cpuWrite(a, v); proto.cpuWrite.call(n, a, v); };
    const ppu = n.ppu, pr = Object.getPrototypeOf(ppu).read;
    ppu.read = function (a) { a &= 0x3fff; if (a < 0x2000) cnt.chr++; else if (a < 0x3f00) cnt.vram++; return pr.call(this, a); };
    const cpu = n.cpu, ci = Object.getPrototypeOf(cpu).interrupt;
    cpu.interrupt = function (vec, b) {
      cnt.cpu += 8;
      if (vec === 0xfffa) { cnt.nmi++; ev('nmi', 5, () => TX('描き終わりの合図（NMI）。CPU は、つぎのこまの準備へ', 'Done-drawing signal (NMI). The CPU starts getting the next frame ready'), 'nmi'); }
      else ev('irq', 5, () => TX('割りこみ（IRQ）。カセットか音の係が CPU を呼んだ', 'Interrupt (IRQ). The cassette or the sound chip called the CPU'), null);
      return ci.call(this, vec, b);
    };
    lastCycles = cpu.cycles;
    // カセットの中身は、さしたソフトに合わせて
    const kb = (x) => Math.round(x / 1024) + 'KB';
    parts.prg.s.textContent = 'PRG ROM ' + kb(cart.prg.length);
    parts.chr.t.textContent = cart.chrRam ? TX('絵の RAM', 'Picture RAM') : TX('絵の ROM', 'Picture ROM');
    parts.chr.s.textContent = (cart.chrRam ? 'CHR RAM ' : 'CHR ROM ') + kb(cart.chr.length);
    parts.map.s.textContent = cart.mapper ? TX('マッパー ', 'Mapper ') + cart.mapper : '';
    parts.map.g.classList.toggle('off', !cart.mapper); wires.map.g.classList.toggle('off', !cart.mapper);
    parts.wram.g.classList.toggle('off', !cart.battery); wires.wram.g.classList.toggle('off', !cart.battery);
    best = null; shown = null; capOp.textContent = ''; setCap(speed === 1 ? HINT : '');
  }
  function detach() {
    if (!nes) return;
    delete nes.cpuRead; delete nes.cpuWrite; delete nes.ppu.read; delete nes.cpu.interrupt;
    nes = null;
  }

  // ---------- 速さ ----------
  let speed = 1;
  const HINT = TX('ゆっくりにすると、部品のあいだの出来事が読めます', 'Slow down to read what passes between the parts');
  const spdBtns = [...root.querySelectorAll('[data-speed]')], stepBtns = [...root.querySelectorAll('[data-step]')];
  const api = { attach, detach, onSpeed: null, onStep: null, get speed() { return speed; } };
  function setSpeed(i) {
    speed = SPEEDS[i];
    for (const b of spdBtns) b.setAttribute('aria-pressed', String(+b.dataset.speed === i));
    for (const b of stepBtns) b.disabled = speed !== 0;
    if (speed === 1) { capOp.textContent = ''; setCap(HINT); }
    api.onSpeed?.(speed);
  }
  for (const b of spdBtns) b.addEventListener('click', () => setSpeed(+b.dataset.speed));
  for (const b of stepBtns) b.addEventListener('click', () => api.onStep?.(b.dataset.step));
  api.setSpeed = (s) => setSpeed(Math.max(0, SPEEDS.indexOf(s)));

  const txt = (e) => (typeof e.text === 'function' ? e.text() : e.text);
  function setCap(t) { if (capTxt.textContent !== t) capTxt.textContent = t; }

  // 1命令を進める前に、その命令を読む（読んでも何も変わらない所だけ）
  function peek(a) { if (a < 0x2000) return nes.ram[a & 0x7ff]; if (a >= 0x8000) return cart.cpuRead(a); return 0; }
  function disasm(pc) {
    const op = OPS[peek(pc)];
    if (!op) return { s: hex(pc, 4) + '  ???', mn: '' };
    const b1 = peek((pc + 1) & 0xffff), w = b1 | (peek((pc + 2) & 0xffff) << 8);
    const arg = {
      imp: '', acc: 'A', imm: '#' + hex(b1, 2), zp: hex(b1, 2), zpx: hex(b1, 2) + ',X', zpy: hex(b1, 2) + ',Y', abs: hex(w, 4), abx: hex(w, 4) + ',X', aby: hex(w, 4) + ',Y',
      ind: '(' + hex(w, 4) + ')', izx: '(' + hex(b1, 2) + ',X)', izy: '(' + hex(b1, 2) + '),Y', rel: hex((pc + 2 + ((b1 << 24) >> 24)) & 0xffff, 4),
    }[op.mode];
    return { s: `${hex(pc, 4)}  ${op.mn} ${arg}`.trimEnd(), mn: op.mn };
  }
  // 1命令（main が nes.step を呼ぶ前後で）
  api.beginStep = () => { stepLog = []; return disasm(nes.cpu.pc); };
  api.endStep = (d) => {
    const log = stepLog; stepLog = null;
    const top = log.reduce((m, e) => (!m || e.prio > m.prio ? e : m), null);
    capOp.textContent = d.s;
    setCap((GLOSS[d.mn] || '') + (top && top.prio >= 1 ? ' — ' + txt(top) : ''));
    best = null; shown = { kind: 'step' }; shownAt = nowMs;
  };

  // ---------- 毎こま: 光と説明 ----------
  const HOLD = 1500;   // 説明の一行は、これだけは出しておく（読めるように）
  api.update = (dt) => {
    if (!nes) return;
    nowMs += dt;
    const cyc = Math.max(0, nes.cpu.cycles - lastCycles); lastCycles = nes.cpu.cycles;
    const ppu = nes.ppu, apu = nes.apu;
    cnt.cpu += cyc;
    if (cyc && ppu.line < 240 && ppu.rendering) cnt.video += cyc;
    const sounding = (apu.p1.len ? 1 : 0) + (apu.p2.len ? 1 : 0) + (apu.tri.len ? 1 : 0) + (apu.noise.len ? 1 : 0);
    const fall = Math.exp(-dt / 140);
    for (const k of KEYS) {
      let target;
      if (k === 'cpu') target = cyc ? 0.55 : 0;
      else if (k === 'video') target = cyc ? Math.min(1, cnt.video / cyc) : 0;
      else if (k === 'audio') target = cyc ? sounding / 4 : 0;
      else if (k === 'nmi') target = cnt.nmi ? 1 : 0;
      else if (k === 'tv') target = Math.max(lvl.video, lvl.audio);
      else target = cyc ? Math.min(1, Math.sqrt(cnt[k] / cyc / REF[k])) : (cnt[k] ? 1 : 0);
      if (k === 'apu') target = Math.max(target, cyc ? sounding / 6 : 0);
      if (k === 'ppu') target = Math.max(target, lvl.video * 0.8);   // 絵の係は、描いているあいだずっと働く
      lvl[k] = Math.max(lvl[k] * fall, target);
      cnt[k] = 0;
    }
    lvl.cpu = Math.max(lvl.cpu, lvl.nmi);
    for (const k of KEYS) {
      const a = lvl[k].toFixed(2);
      if (parts[k]) parts[k].g.style.setProperty('--a', a);
      if (wires[k]) wires[k].g.style.setProperty('--a', a);
    }
    // 粒
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i], u = (nowMs - p.t0) / 650;
      if (u >= 1) { p.c.remove(); packets.splice(i, 1); continue; }
      const e = u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2;
      const pt = p.w.p.getPointAtLength((p.rev ? 1 - e : e) * p.w.len);
      p.c.setAttribute('cx', pt.x.toFixed(1)); p.c.setAttribute('cy', pt.y.toFixed(1));
    }
    // CPU が同じ所をくりかえしているか（合図を待つ輪）。説明を出すあいだの PC のはば
    if (cyc) { const pc = nes.cpu.pc; pcMin = Math.min(pcMin, pc); pcMax = Math.max(pcMax, pc); }
    // 説明の一行（ゆっくりのときだけ。ふつうの速さでは読めないので出さない）
    if (speed !== 1 && speed !== 0 && best && nowMs - shownAt > HOLD) {
      if (best.prio <= 2 && pcMax - pcMin < 16) best = { kind: 'wait', prio: 2, text: TX('CPU は待っている（合図が来るまで、同じ所をくりかえす）', 'The CPU is waiting (looping until the signal comes)') };
      pcMin = 1e9; pcMax = -1;
      if (shown && shown.kind === best.kind && best.prio >= 3) shownN++; else shownN = 1;
      shown = best; shownAt = nowMs; best = null;
      capOp.textContent = '';
      setCap(txt(shown) + (shownN > 1 ? TX(`（くりかえし ${shownN}）`, ` (×${shownN})`) : ''));
    } else if (speed === 0) best = null;
    // いまビームのいる所
    const L = ppu.line;
    const w = L < 240 ? TX(`ビーム ${L + 1} 行目`, `Beam on line ${L + 1}`) : TX('ビームは上へもどる途中（帰線）', 'Beam returning to the top (blanking)');
    const wt = speed === 1 ? '' : w;
    if (capWhere.textContent !== wt) capWhere.textContent = wt;
    drawBeam();
  };

  // 画面の上の、ビームの点（ゆっくりのとき）
  const bg = beamCanvas.getContext('2d');
  function drawBeam() {
    bg.clearRect(0, 0, 256, 240);
    if (!nes || speed === 1) return;
    const L = nes.ppu.line, D = nes.ppu.dot;
    if (L >= 240) return;
    const x = Math.min(255, Math.max(0, D - 1));
    bg.fillStyle = 'rgba(255,240,180,.18)'; bg.fillRect(0, L, 256, 1);
    const gr = bg.createRadialGradient(x, L + 0.5, 0, x, L + 0.5, 6);
    gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.35, 'rgba(255,220,120,.6)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
    bg.fillStyle = gr; bg.fillRect(x - 6, L - 6, 13, 13);
  }

  setSpeed(SPEEDS.length - 1);
  return api;
}
