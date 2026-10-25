// ソフトの組み立て（build.mjs と確かめの道具で共通）: src/<ソフト>/main.s ＋ ほかの .s（名前の順）＋ data.mjs の gen()
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assemble, makeExe } from './asm.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildSoft(name) {
  const dir = join(ROOT, 'src', name);
  let src = readFileSync(join(dir, 'main.s'), 'utf8');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.s') && f !== 'main.s').sort()) src += '\n' + readFileSync(join(dir, f), 'utf8');
  const data = join(dir, 'data.mjs');
  if (existsSync(data)) src += '\n' + (await import(pathToFileURL(data).href)).gen();
  const out = assemble(src);
  return { ...out, exe: makeExe(out) };
}
