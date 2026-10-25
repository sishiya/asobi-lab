// アセンブリのロードの遅れを探す: lw・lh・lhu・lb・lbu・lwc のすぐ次の命令が、読んだレジスタを使っていたら知らせる（本物どおり、前の値が見える）
//   node retro-32bit/tools/lint-asm.mjs src/dig32/*.s
import { readFileSync } from 'node:fs';

const LOAD = /^\s*(lw|lh|lhu|lb|lbu)\s+(\$?\w+)\s*,/;
let found = 0;
for (const file of process.argv.slice(2)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const code = lines.map((l, i) => [i, l.replace(/;.*/, '').trim()]).filter(([, l]) => l && !l.endsWith(':') && !l.startsWith('.') && !/^\w+\s*=/.test(l));
  for (let k = 0; k + 1 < code.length; k++) {
    const m = LOAD.exec(code[k][1]);
    if (!m) continue;
    const reg = m[2].replace('$', ''), next = code[k + 1][1];
    if (/^@?\w+:/.test(lines[code[k + 1][0]].trim())) continue;
    const [op, ...args] = next.split(/[\s,()]+/).filter(Boolean);
    // 書きこむ先（1 番目）は使っていないとみなす（sw・sh・sb・分岐・mult は 1 番目も読む）
    const reads = /^(sw|sh|sb|beq|bne|beqz|bnez|bgez|bltz|blez|bgtz|mult|multu|div|divu|jr|jalr|mtc2|ctc2|move)$/.test(op) ? args : args.slice(1);
    if (op === 'move' && args[1] === reg) { report(); continue; }
    if (reads.includes(reg)) report();
    function report() { found++; console.log(`${file}:${code[k + 1][0] + 1}: ${reg} を読んだすぐ次で使っている → ${next}`); }
  }
}
console.log(found ? `${found} か所` : 'なし');
