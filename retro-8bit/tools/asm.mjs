// 小さな 6502 アセンブラ（自作）。2回読み: 1回目で番地を決め、2回目でバイトを書く。
//   ; コメント      NAME = 式      label:      @local:（直前のふつうのラベルの中だけ）
//   .org $8000     .byte 1,2,"ABC"   .word label   .pad $FFFA（その番地まで $FF でうめる）
//   lda #$10 / lda $10 / lda $1234,x / lda (ptr),y / lda (ptr,x) / jmp (vec) / asl a
//   式: $ff %0101 123 'A' 名前  + - * / & | ^ << >>  <式（下のバイト） >式（上のバイト）  [ ]（かっこ）
import { OPS, OPERAND_BYTES } from '../js/ops.js';

const BY_MN = {};
OPS.forEach((op, code) => {
  if (!op) return;
  (BY_MN[op.mn] ||= {});
  if (BY_MN[op.mn][op.mode] === undefined) BY_MN[op.mn][op.mode] = code;
});

export function assemble(src, { origin = 0x8000, size = 0x8000 } = {}) {
  const lines = src.split(/\r?\n/);
  const syms = {};
  const zpChoice = new Map(); // 行 → zp の形を使うか（1回目で決めて2回目もそのまま）
  let out, pc, global = '';

  const fail = (ln, msg) => { throw new Error(`${ln + 1}行目: ${msg}\n  ${lines[ln].trim()}`); };
  const local = (name) => name.startsWith('@') ? global + name : name;

  // 式を読む。わからない名前があれば null（1回目だけゆるす）
  function evaluate(expr, ln, strict) {
    const toks = expr.match(/\$[0-9a-fA-F]+|%[01]+|\d+|'.'|@?[A-Za-z_][\w]*|<<|>>|[-+*/&|^<>\[\]]/g) || [];
    let i = 0, unknown = false;
    const peek = () => toks[i];
    function atom() {
      const t = toks[i++];
      if (t === undefined) fail(ln, '式が途中で終わっています: ' + expr);
      if (t === '-') return -atom();
      if (t === '<') return atom() & 0xff;
      if (t === '>') return (atom() >> 8) & 0xff;
      if (t === '[') { const v = or(); if (toks[i++] !== ']') fail(ln, '] がありません'); return v; }
      if (t[0] === '$') return parseInt(t.slice(1), 16);
      if (t[0] === '%') return parseInt(t.slice(1), 2);
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
        v = o === '+' ? v + r : o === '-' ? v - r : o === '*' ? v * r : o === '/' ? Math.trunc(v / r)
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

  function emit(b) {
    const o = pc - origin;
    if (o < 0 || o >= size) throw new Error(`番地 ${pc.toString(16)} が ROM の外です`);
    if (out) out[o] = b & 0xff;
    pc++;
  }

  for (let pass = 1; pass <= 2; pass++) {
    const strict = pass === 2;
    out = pass === 2 ? new Uint8Array(size).fill(0xff) : null;
    pc = origin; global = '';
    lines.forEach((raw, ln) => {
      let line = raw.replace(/;.*$/, '').trim();
      if (!line) return;
      let m;
      // NAME = 式
      if ((m = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
        const v = evaluate(m[2], ln, strict);
        if (v !== null) syms[m[1]] = v;
        return;
      }
      // ラベル
      while ((m = line.match(/^(@?[A-Za-z_]\w*):\s*(.*)$/))) {
        if (!m[1].startsWith('@')) global = m[1];
        const name = local(m[1]);
        if (pass === 1 && name in syms) fail(ln, '同じラベルが2つ: ' + m[1]);
        syms[name] = pc;
        line = m[2].trim();
      }
      if (!line) return;
      // 指示
      if (line[0] === '.') {
        const [, dir, rest = ''] = line.match(/^\.(\w+)\s*(.*)$/);
        const args = splitArgs(rest);
        switch (dir.toLowerCase()) {
          case 'org': pc = evaluate(rest, ln, true); break;
          case 'pad': { const to = evaluate(rest, ln, true); if (to < pc) fail(ln, '.pad が戻っています'); while (pc < to) emit(0xff); break; }
          case 'byte': case 'db':
            for (const a of args) {
              if (a.startsWith('"')) for (const ch of a.slice(1, -1)) emit(ch.charCodeAt(0));
              else emit(evaluate(a, ln, strict) ?? 0);
            }
            break;
          case 'word': case 'dw':
            for (const a of args) { const v = evaluate(a, ln, strict) ?? 0; emit(v & 0xff); emit(v >> 8); }
            break;
          default: fail(ln, '知らない指示: .' + dir);
        }
        return;
      }
      // 命令
      m = line.match(/^([A-Za-z]{3})\s*(.*)$/);
      if (!m) fail(ln, '読めません');
      const mn = m[1].toUpperCase(), opd = m[2].trim();
      const modes = BY_MN[mn];
      if (!modes) fail(ln, '知らない命令: ' + mn);
      let mode, expr = null;
      if (!opd) mode = modes.imp !== undefined ? 'imp' : 'acc';
      else if (/^a$/i.test(opd) && modes.acc !== undefined) mode = 'acc';
      else if (opd[0] === '#') { mode = 'imm'; expr = opd.slice(1); }
      else if ((m = opd.match(/^\((.+)\)\s*,\s*y$/i))) { mode = 'izy'; expr = m[1]; }
      else if ((m = opd.match(/^\((.+)\s*,\s*x\)$/i))) { mode = 'izx'; expr = m[1]; }
      else if ((m = opd.match(/^\((.+)\)$/))) { mode = 'ind'; expr = m[1]; }
      else if (modes.rel !== undefined) { mode = 'rel'; expr = opd; }
      else {
        let idx = '';
        if ((m = opd.match(/^(.+?)\s*,\s*([xy])$/i))) { expr = m[1]; idx = m[2].toLowerCase(); } else expr = opd;
        const zp = idx === '' ? 'zp' : 'zp' + idx, ab = idx === '' ? 'abs' : 'ab' + idx;
        if (pass === 1) {
          const v = evaluate(expr, ln, false);
          zpChoice.set(ln, modes[zp] !== undefined && v !== null && v >= 0 && v < 256);
        }
        mode = zpChoice.get(ln) ? zp : ab;
        if (modes[mode] === undefined) fail(ln, `${mn} にこの形はありません`);
      }
      if (modes[mode] === undefined) fail(ln, `${mn} に ${mode} の形はありません`);
      emit(modes[mode]);
      const n = OPERAND_BYTES[mode];
      let v = expr === null ? 0 : evaluate(expr, ln, strict) ?? 0;
      if (mode === 'rel') {
        if (strict) {
          v = v - (pc + 1);
          if (v < -128 || v > 127) fail(ln, '分かれ道が遠すぎます（' + v + '）');
        }
        emit(v & 0xff);
      } else if (n === 1) {
        if (strict && (v < -128 || v > 255)) fail(ln, '1バイトに入りません: ' + v);
        emit(v);
      } else if (n === 2) { emit(v & 0xff); emit((v >> 8) & 0xff); }
    });
  }
  return { bytes: out, syms };
}

function splitArgs(s) {
  const r = []; let cur = '', q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (ch === ',' && !q) { r.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) r.push(cur.trim());
  return r;
}
