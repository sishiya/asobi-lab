// ソフトを作る: src/<ソフト>/main.s ＋ ほかの .s（名前の順）＋ あれば data.mjs の gen() が返す文 をつないで → discs/<ソフト>.exe
//   node retro-32bit/tools/build.mjs [ソフト...]（省くと全部）
import { writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, buildSoft } from './lib.mjs';

const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(ROOT, 'src'));
for (const name of names) {
  const { bytes, exe } = await buildSoft(name);
  writeFileSync(join(ROOT, 'discs', name + '.exe'), exe);
  console.log(`${name}: ${bytes.length} バイト（ファイル ${exe.length} バイト）`);
}
