// コントローラーの確かめ: 「光るキューブ」に十字キーを押させて、ソフトの角度（s0＝x のまわり・s1＝y のまわり）の進み方が変わるか。
//   node retro-32bit/tools/test-pad.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const m = new Console32();
m.loadExe(readFileSync(join(ROOT, 'discs/cube.exe')));
const run = (n, b) => {
  const x = m.cpu.r[16], y = m.cpu.r[17];
  m.sio.buttons[0] = b;
  for (let i = 0; i < n; i++) m.runFrame();
  return [(m.cpu.r[16] - x) / n, (m.cpu.r[17] - y) / n];
};
run(5, 0);
let bad = 0;
const check = (name, got, want) => { const ok = got[0] === want[0] && got[1] === want[1]; if (!ok) bad++; console.log(`${ok ? 'ok ' : 'NG '} ${name}: ${got}${ok ? '' : ' （正しくは ' + want + '）'}`); };
check('押さない（ゆっくり回る）', run(30, 0), [0x20, 0x50]);
check('↑', run(30, 1 << BTN.UP), [-0x280, 0x50]);
check('→', run(30, 1 << BTN.RIGHT), [0x20, 0x280]);
check('↓＋←', run(30, (1 << BTN.DOWN) | (1 << BTN.LEFT)), [0x280, -0x280]);
console.log(bad ? `\n${bad} こ ちがいます` : '\nぜんぶ ok');
process.exit(bad ? 1 : 0);
