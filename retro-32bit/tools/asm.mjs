// 小さな MIPS（R3000A）アセンブラ（自作）。2回読み: 1回目で番地を決め、2回目で語を書く。
//   ; または # からコメント     NAME = 式     label:     @local:（直前のふつうのラベルの中だけ）
//   .org 0x80010000   .word 1,label   .half 1   .byte 1,"ABC"   .ascii "ABC"   .align 4   .space 16
//   レジスタ: $t0 / t0 / $8 など。数: 0x1f 123 'A'。式: + - * / & | ^ << >> ~ ( )  %hi(式) %lo(式)
//   遅延スロットは自分で書く（並べかえない）。ロードのすぐあとでそのレジスタを使わない
//   疑似命令: nop  move  li（値で 1語か2語）  la（いつも2語）  b  bal  beqz  bnez  not  neg
//   GTE（段階B）: cop2 式 で命令の語をそのまま
const REG = {};
'zero at v0 v1 a0 a1 a2 a3 t0 t1 t2 t3 t4 t5 t6 t7 s0 s1 s2 s3 s4 s5 s6 s7 t8 t9 k0 k1 gp sp fp ra'
  .split(' ').forEach((n, i) => { REG[n] = i; REG['$' + n] = i; REG['$' + i] = i; });
REG.s8 = REG.$s8 = 30;

// 形: d s t = rd rs rt、a = シフトの量、i = 16ビットの値、o = 番地へのとび先、m = off(base)
const R3 = { add: 32, addu: 33, sub: 34, subu: 35, and: 36, or: 37, xor: 38, nor: 39, slt: 42, sltu: 43 };
const SHI = { sll: 0, srl: 2, sra: 3 };
const SHV = { sllv: 4, srlv: 6, srav: 7 };
const MD = { mult: 24, multu: 25, div: 26, divu: 27 };
const MF = { mfhi: 16, mflo: 18 };
const MT = { mthi: 17, mtlo: 19 };
const IMM = { addi: 8, addiu: 9, slti: 10, sltiu: 11, andi: 12, ori: 13, xori: 14 };
const BR2 = { beq: 4, bne: 5 };
const BR1 = { blez: [6, 0], bgtz: [7, 0], bltz: [1, 0], bgez: [1, 1], bltzal: [1, 16], bgezal: [1, 17] };
const MEM = { lb: 32, lh: 33, lwl: 34, lw: 35, lbu: 36, lhu: 37, lwr: 38, sb: 40, sh: 41, swl: 42, sw: 43, swr: 46, lwc2: 50, swc2: 58 };
const COP = { mfc0: [16, 0], mtc0: [16, 4], mfc2: [18, 0], cfc2: [18, 2], mtc2: [18, 4], ctc2: [18, 6] };

export function assemble(src, { origin = 0x80010000 } = {}) {
  const lines = src.split(/\r?\n/);
  const syms = {};
  const liLong = new Map(); // 行 → li を2語にするか（1回目で決めて2回目もそのまま）
  let pc, global = '', passNo = 0;
  const fail = (ln, msg) => { throw new Error(`${ln + 1}行目: ${msg}\n  ${lines[ln].trim()}`); };
  const local = (name) => name.startsWith('@') ? global + name : name;

  function evaluate(expr, ln, strict) {
    const toks = expr.match(/0x[0-9a-fA-F]+|\d+|'.'|%hi|%lo|@?[A-Za-z_][\w.]*|<<|>>|[-+*/&|^~()]/g) || [];
    let i = 0, unknown = false;
    const peek = () => toks[i];
    function atom() {
      const t = toks[i++];
      if (t === undefined) fail(ln, '式が途中で終わっています: ' + expr);
      if (t === '-') return -atom();
      if (t === '~') return ~atom();
      if (t === '%hi' || t === '%lo') {
        if (toks[i++] !== '(') fail(ln, t + ' のあとに ( がありません');
        const v = or(); if (toks[i++] !== ')') fail(ln, ') がありません');
        // %lo は符号つきで足されるので、%hi はそのぶん繰り上げる
        return t === '%lo' ? (v << 16) >> 16 : ((v + 0x8000) >>> 16) & 0xffff;
      }
      if (t === '(') { const v = or(); if (toks[i++] !== ')') fail(ln, ') がありません'); return v; }
      if (t.startsWith('0x')) return parseInt(t, 16);
      if (t[0] === "'") return t.charCodeAt(1);
      if (/^\d/.test(t)) return parseInt(t, 10);
      const name = local(t);
      if (name in syms) return syms[name];
      if (strict) fail(ln, '知らない名前: ' + t);
      unknown = true; return 0;
    }
    const bin = (next, ops) => () => {
      let v = next();
      while (ops.includes(peek())) {
        const o = toks[i++], r = next();
        v = o === '+' ? v + r : o === '-' ? v - r : o === '*' ? Math.imul(v, r) : o === '/' ? Math.trunc(v / r)
          : o === '&' ? v & r : o === '|' ? v | r : o === '^' ? v ^ r : o === '<<' ? v << r : v >> r;
      }
      return v;
    };
    const mul = bin(atom, ['*', '/']), add = bin(mul, ['+', '-']), sh = bin(add, ['<<', '>>']);
    const and = bin(sh, ['&']), xor = bin(and, ['^']), or = bin(xor, ['|']);
    const v = or();
    if (i < toks.length) fail(ln, '式が読めません: ' + expr);
    return unknown ? null : v;
  }

  function splitArgs(s) {
    const out = []; let cur = '', q = false;
    for (const ch of s) {
      if (ch === '"') q = !q;
      if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function pass(final) {
    pc = origin >>> 0; global = '';
    const bytes = new Map(); // 番地 → バイト（.byte などの半端のため。最後に語へまとめる）
    const put8 = (v) => { bytes.set(pc, v & 0xff); pc = (pc + 1) >>> 0; };
    const put32 = (v) => { for (let k = 0; k < 4; k++) put8(v >>> (k * 8)); };
    lines.forEach((raw, ln) => {
      let line = raw.replace(/("[^"]*")|[;#].*$/g, (m, s) => s || '').trim();
      if (!line) return;
      let m;
      while ((m = line.match(/^(@?[A-Za-z_][\w.]*):\s*/))) {
        if (!m[1].startsWith('@')) global = m[1];
        const name = local(m[1]);
        if (passNo === 0 && name in syms) fail(ln, '同じラベルが2回: ' + m[1]);
        syms[name] = pc;
        line = line.slice(m[0].length);
      }
      if (!line) return;
      if ((m = line.match(/^([A-Za-z_][\w.]*)\s*=\s*(.+)$/))) {
        const v = evaluate(m[2], ln, final);
        if (v !== null) syms[m[1]] = v;
        return;
      }
      const sp = line.search(/\s/);
      const op = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
      const args = splitArgs(sp < 0 ? '' : line.slice(sp + 1));
      const ev = (e) => { const v = evaluate(e, ln, final); return v === null ? 0 : v; };
      const reg = (s) => { const r = REG[s?.toLowerCase()]; if (r === undefined) fail(ln, 'レジスタが読めません: ' + s); return r; };
      const need = (n) => { if (args.length !== n) fail(ln, `${op} は ${n} つ書きます`); };
      const imm16 = (v, signed) => {
        if (final && (signed ? v < -0x8000 || v > 0x7fff : v < -0x8000 || v > 0xffff)) fail(ln, '16ビットに入りません: ' + v);
        return v & 0xffff;
      };
      const rtype = (s, t, d, a, f) => put32((s << 21) | (t << 16) | (d << 11) | (a << 6) | f);
      const itype = (o, s, t, i) => put32((o << 26) | (s << 21) | (t << 16) | (i & 0xffff));
      const branch = (o, s, t, target) => {
        const off = (((ev(target) >>> 0) - (pc + 4)) | 0) >> 2;
        if (final && (off < -0x8000 || off > 0x7fff)) fail(ln, 'とび先が遠すぎます');
        itype(o, s, t, off);
      };
      const memArg = (s) => {
        const mm = s.match(/^(.*)\((\$?\w+)\)$/);
        return mm ? [mm[1].trim() ? ev(mm[1]) : 0, reg(mm[2])] : [ev(s), 0];
      };
      if (op === '.org') { need(1); pc = ev(args[0]) >>> 0; return; }
      if (op === '.align') { const n = ev(args[0]); while (pc % n) put8(0); return; }
      if (op === '.space') { const n = ev(args[0]); for (let k = 0; k < n; k++) put8(0); return; }
      if (op === '.word') { args.forEach((a) => put32(ev(a))); return; }
      if (op === '.half') { args.forEach((a) => { const v = ev(a); put8(v); put8(v >> 8); }); return; }
      if (op === '.byte' || op === '.ascii') {
        args.forEach((a) => { if (a.startsWith('"')) for (const ch of a.slice(1, -1)) put8(ch.charCodeAt(0)); else put8(ev(a)); });
        return;
      }
      if (op.startsWith('.')) fail(ln, '知らない指示: ' + op);
      if (pc & 3) fail(ln, '命令の番地が 4 の倍数ではありません（.align 4 を）');

      if (op in R3) { need(3); rtype(reg(args[1]), reg(args[2]), reg(args[0]), 0, R3[op]); }
      else if (op in SHI) { need(3); rtype(0, reg(args[1]), reg(args[0]), ev(args[2]) & 31, SHI[op]); }
      else if (op in SHV) { need(3); rtype(reg(args[2]), reg(args[1]), reg(args[0]), 0, SHV[op]); }
      else if (op in MD) { need(2); rtype(reg(args[0]), reg(args[1]), 0, 0, MD[op]); }
      else if (op in MF) { need(1); rtype(0, 0, reg(args[0]), 0, MF[op]); }
      else if (op in MT) { need(1); rtype(reg(args[0]), 0, 0, 0, MT[op]); }
      else if (op === 'jr') { need(1); rtype(reg(args[0]), 0, 0, 0, 8); }
      else if (op === 'jalr') { const [d, s] = args.length === 1 ? [31, reg(args[0])] : [reg(args[0]), reg(args[1])]; rtype(s, 0, d, 0, 9); }
      else if (op === 'syscall' || op === 'break') put32(((args.length ? ev(args[0]) : 0) << 6) | (op === 'syscall' ? 12 : 13));
      else if (op in IMM) { need(3); itype(IMM[op], reg(args[1]), reg(args[0]), imm16(ev(args[2]), op === 'addi' || op === 'addiu' || op === 'slti' || op === 'sltiu')); }
      else if (op === 'lui') { need(2); itype(15, 0, reg(args[0]), imm16(ev(args[1]), false)); }
      else if (op in BR2) { need(3); branch(BR2[op], reg(args[0]), reg(args[1]), args[2]); }
      else if (op in BR1) { need(2); const [o, t] = BR1[op]; branch(o, reg(args[0]), t, args[1]); }
      else if (op in MEM) {
        need(2); const [off, base] = memArg(args[1]);
        const rt = op === 'lwc2' || op === 'swc2' ? ev(args[0]) & 31 : reg(args[0]);
        itype(MEM[op], base, rt, imm16(off, true));
      }
      else if (op === 'j' || op === 'jal') {
        need(1); const t = ev(args[0]) >>> 0;
        if (final && ((t ^ (pc + 4)) & 0xf0000000)) fail(ln, 'とび先が別の 256MB にあります');
        put32(((op === 'j' ? 2 : 3) << 26) | ((t >>> 2) & 0x3ffffff));
      }
      else if (op in COP) {
        need(2); const [o, s] = COP[op];
        put32((o << 26) | (s << 21) | (reg(args[0]) << 16) | ((ev(args[1].replace(/^\$/, '')) & 31) << 11));
      }
      else if (op === 'rfe') put32(0x42000010);
      else if (op === 'cop2') { need(1); put32((18 << 26) | (1 << 25) | (ev(args[0]) & 0x1ffffff)); }
      // 疑似命令
      else if (op === 'nop') put32(0);
      else if (op === 'move') { need(2); rtype(reg(args[1]), 0, reg(args[0]), 0, 33); }
      else if (op === 'not') { need(2); rtype(reg(args[1]), 0, reg(args[0]), 0, 39); }
      else if (op === 'neg') { need(2); rtype(0, reg(args[1]), reg(args[0]), 0, 35); }
      else if (op === 'li') {
        need(2); const rt = reg(args[0]);
        if (!final) { const v = evaluate(args[1], ln, false); liLong.set(ln, v === null || v < -0x8000 || v > 0xffff); }
        const v = ev(args[1]);
        if (liLong.get(ln)) { itype(15, 0, rt, (v >>> 16) & 0xffff); itype(13, rt, rt, v & 0xffff); }
        else if (v < 0) itype(9, 0, rt, v); else itype(13, 0, rt, v);
      }
      else if (op === 'la') {
        need(2); const rt = reg(args[0]), v = ev(args[1]);
        itype(15, 0, rt, ((v + 0x8000) >>> 16) & 0xffff); itype(9, rt, rt, v);
      }
      else if (op === 'b') { need(1); branch(4, 0, 0, args[0]); }
      else if (op === 'bal') { need(1); branch(1, 0, 17, args[0]); }
      else if (op === 'beqz') { need(2); branch(4, reg(args[0]), 0, args[1]); }
      else if (op === 'bnez') { need(2); branch(5, reg(args[0]), 0, args[1]); }
      else fail(ln, '知らない命令: ' + op);
    });
    return bytes;
  }

  // 番地が決まるまで読みなおす（うしろで決まる名前を .space などの大きさに使っても、ずれないように）
  passNo = 0; let before = '';
  for (; passNo < 6; passNo++) {
    pass(false);
    const now = JSON.stringify(syms);
    if (now === before) break;
    before = now;
  }
  passNo = 99;
  const bytes = pass(true);
  if (!bytes.size) return { bytes: new Uint8Array(0), origin: origin >>> 0, syms };
  let lo = Infinity, hi = 0;
  for (const a of bytes.keys()) { if (a < lo) lo = a; if (a > hi) hi = a; }
  const out = new Uint8Array(hi - lo + 1);
  for (const [a, v] of bytes) out[a - lo] = v;
  return { bytes: out, origin: lo, syms };
}

// 実行ファイルの形（頭 2048 バイト + 本体。本体は 2048 の倍数）。ほかの道具で作ったファイルも開けるように、決まった形に合わせる
export function makeExe({ bytes, origin, syms }, { entry = 'start', stack = 0x801ffff0 } = {}) {
  const size = Math.ceil(bytes.length / 2048) * 2048;
  const out = new Uint8Array(2048 + size);
  const dv = new DataView(out.buffer);
  out.set([0x50, 0x53, 0x2d, 0x58, 0x20, 0x45, 0x58, 0x45]); // 形式の印（8 文字）
  dv.setUint32(0x10, syms[entry] >>> 0, true); // はじめの番地
  dv.setUint32(0x14, 0, true);                // gp
  dv.setUint32(0x18, origin, true);           // 置く番地
  dv.setUint32(0x1c, size, true);             // 大きさ
  dv.setUint32(0x30, stack, true);            // スタックのいちばん上
  out.set(bytes, 2048);
  return out;
}
