// ソフトを作る: src/<ソフト>/main.s（＋あれば data.mjs の gen() が返す文をうしろにつなぐ）→ discs/<ソフト>.exe
//   node retro-32bit/tools/build.mjs [ソフト...]（省くと全部）
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assemble, makeExe } from './asm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(ROOT, 'src'));
for (const name of names) {
  const dir = join(ROOT, 'src', name);
  let src = readFileSync(join(dir, 'main.s'), 'utf8');
  const data = join(dir, 'data.mjs');
  if (existsSync(data)) src += '\n' + (await import(pathToFileURL(data).href)).gen();
  const out = assemble(src);
  const exe = makeExe(out);
  writeFileSync(join(ROOT, 'discs', name + '.exe'), exe);
  console.log(`${name}: ${out.bytes.length} バイト（ファイル ${exe.length} バイト）`);
}
