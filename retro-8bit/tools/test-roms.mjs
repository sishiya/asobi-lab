// エミュレータ検証用のテスト ROM を、画面なしで動かして結果を読む（手元だけ）。
//   node retro-8bit/tools/test-roms.mjs [ファイル…]   （省くと _dev/retro-8bit/test-roms/ の中を全部）
// テスト ROM は Git に入れない・公開しない（PLAN.md 0章。2026-10-24 ユーザーの OK のあと手元にダウンロード）。
// 結果の読み方:
//   - nestest: 自動の形（PC を $C000 から）で動かし、$02・$03 が 0 なら合格（ちがえば、まちがった試しの番号）
//   - blargg のテスト: $6000 が $80 のあいだ動いている、$81 ならリセットを押す、それ以外が結果（0 = 合格）。$6004 から説明の字
//   - 結果を画面にだけ出すもの（古い sprite_hit_tests・cpu_timing_test）は、画面の字から PASSED／FAILED を読む。絵は _dev/retro-8bit/test-roms/out/
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8 } from '../js/nes.js';
import { writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, '..', '_dev', 'retro-8bit', 'test-roms');
const OUT = join(DIR, 'out');
const list = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'out' ? [] : list(join(d, e.name))) : e.name.endsWith('.nes') ? [join(d, e.name)] : []);
const files = process.argv.slice(2).length ? process.argv.slice(2) : (existsSync(DIR) ? list(DIR) : []);
if (!files.length) { console.log('テスト ROM がありません（_dev/retro-8bit/test-roms/）'); process.exit(0); }
mkdirSync(OUT, { recursive: true });

function shot(nes, name) {
  const fb = nes.ppu.frame;
  writePng(join(OUT, name + '.png'), 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2);
}
const text = (nes) => { let s = ''; for (let a = 4; a < 8192; a++) { const c = nes.cart.prgRam[a]; if (!c) break; s += String.fromCharCode(c); } return s.trim().replace(/\n+/g, ' / '); };

let pass = 0, fail = 0;
for (const f of files) {
  const name = basename(f, '.nes');
  let nes, result;
  try { nes = new Console8(readFileSync(f), 44100); } catch (e) { console.log(`--   ${name}: 開けない（${e.message}）`); fail++; continue; }
  if (name === 'nestest') {
    nes.cpu.pc = 0xc000; // 自動の形
    for (let i = 0; i < 120; i++) nes.runFrame();
    const a = nes.ram[2], b = nes.ram[3];
    result = a === 0 && b === 0 ? 'ok' : `NG（$02=${a.toString(16)} $03=${b.toString(16)}。nestest.txt の表の番号）`;
  } else {
    let resetAt = -1, f2 = 0;
    const sig = () => nes.cart.prgRam[1] === 0xde && nes.cart.prgRam[2] === 0xb0 && nes.cart.prgRam[3] === 0x61;
    for (; f2 < 60 * 60; f2++) {
      nes.runFrame();
      if (!sig()) continue;
      const st = nes.cart.prgRam[0];
      if (st === 0x81 && resetAt < 0) resetAt = f2 + 8;
      if (resetAt === f2) { nes.reset(); resetAt = -2; }
      if (st < 0x80) break;
    }
    if (!sig()) {
      // 結果を画面にだけ出すテスト: 画面の表の字（絵の番号＝ASCII）から PASSED・FAILED を読む
      let scr = '';
      for (let i = 0; i < 960; i++) { const c = nes.ppu.vram[i]; scr += c >= 32 && c < 127 ? String.fromCharCode(c) : ' '; }
      scr = scr.replace(/\s+/g, ' ').trim();
      result = /PASSED/.test(scr) ? 'ok' : /FAIL/.test(scr) ? 'NG ' + scr.slice(0, 120) : '（結果の字なし。画面を見る）';
    }
    else {
      const st = nes.cart.prgRam[0];
      result = st === 0 ? 'ok' : st >= 0x80 ? `終わらない（$6000=${st.toString(16)}）` : `NG（${st}）`;
      const t = text(nes);
      if (t && st !== 0) result += ' ' + t.slice(0, 160);
    }
  }
  shot(nes, name);
  const ok = result === 'ok';
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok ' : '-- '} ${name}: ${result}`);
}
console.log(`\n合格 ${pass}・ほか ${fail}。画面の絵: _dev/retro-8bit/test-roms/out/`);
