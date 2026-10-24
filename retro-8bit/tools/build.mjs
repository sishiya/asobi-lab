// ROM を組み立てる: src/<ゲーム>/data.mjs（絵・画面・曲・表）＋ src/<ゲーム>/game.s（6502）→ roms/<ゲーム>.nes。
//   node retro-8bit/tools/build.mjs            （全部）
//   node retro-8bit/tools/build.mjs dino-ranch （1本）
//   --preview で _dev/retro-8bit/<ゲーム>-chr.png（絵の一覧）
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assemble } from './asm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const named = args.filter((a) => !a.startsWith('--'));
const games = named.length ? named : readdirSync(join(ROOT, 'src'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src', d.name, 'game.s'))).map((d) => d.name);

for (const game of games) {
  const mod = await import(pathToFileURL(join(ROOT, 'src', game, 'data.mjs')).href);
  const { chr, count, sym, data } = mod.build();
  const consts = Object.entries(sym).map(([k, v]) => `${k} = ${v}`).join('\n');
  const src = `${consts}\n${readFileSync(join(ROOT, 'src', game, 'game.s'), 'utf8')}\n${data}\n.pad $FFFA\n.word nmi, reset, irq\n`;
  const { bytes, syms } = assemble(src, { origin: 0x8000, size: 0x8000 });

  // iNES: PRG 32KB×1・CHR 8KB×1・マッパー 0。ふだんは縦の折り返し（mod.HORIZONTAL で横）、mod.BATTERY なら $6000 の電池つきの RAM
  const f6 = (mod.HORIZONTAL ? 0 : 1) | (mod.BATTERY ? 2 : 0);
  const header = new Uint8Array([0x4e, 0x45, 0x53, 0x1a, 2, 1, f6, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const rom = new Uint8Array(16 + 32768 + 8192);
  rom.set(header); rom.set(bytes, 16); rom.set(chr, 16 + 32768);
  mkdirSync(join(ROOT, 'roms'), { recursive: true });
  writeFileSync(join(ROOT, 'roms', game + '.nes'), rom);
  const used = bytes.findLastIndex((b, i) => i < 0x7ffa && b !== 0xff) + 1;
  console.log(`roms/${game}.nes: プログラム ${syms.palette - 0x8000} バイト・データこみで ${used} / 32762 バイト、背景の絵 ${count[0]}・スプライト ${count[1]} 枚`);

  if (args.includes('--preview')) {
    const { writePng } = await import('./png.mjs');
    const { PALETTE_RGB } = await import('../js/palette.js');
    const pals = mod.PALETTES;
    const out = join(ROOT, '..', '_dev', 'retro-8bit');
    mkdirSync(out, { recursive: true });
    // 絵の表 2 枚を 16×16 に並べる（スプライトは 16 枚ごとにパレットを変えて見る）
    writePng(join(out, `${game}-chr.png`), 256, 128, (x, y) => {
      const t = x >> 7, n = ((y >> 3) << 4) | ((x & 127) >> 3), o = t * 4096 + n * 16 + (y & 7);
      const c = ((chr[o] >> (7 - (x & 7))) & 1) | (((chr[o + 8] >> (7 - (x & 7))) & 1) << 1);
      const p = t ? pals[4 + Math.min(3, Math.floor(n / 16) % 4)] : pals[0];
      return c ? PALETTE_RGB[p[c]] : 0x202020;
    }, 3);
    console.log(`  絵の一覧: _dev/retro-8bit/${game}-chr.png`);
  }
}
