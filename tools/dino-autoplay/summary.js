// out*/N.json をまとめる: お題ごとの手数と時間の中央値、ぜんぶの時間
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || 'out0';
const runs = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => fs.readFileSync(path.join(dir, f), 'utf8').trim()).filter(Boolean).map(JSON.parse);
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const ids = [...new Set(runs.flatMap(r => r.cups.map(c => c.id)))];
console.log(`runs ${runs.length}, all 11 cleared: ${runs.filter(r => r.cleared === 11).length}`);
console.log('cup       n  stuck  breeds  trains  evolves  races   min(med)  min(max)');
for (const id of ids) {
  const cs = runs.map(r => r.cups.find(c => c.id === id)).filter(Boolean);
  const tm = cs.map(c => (c.time.compute + c.time.ui + c.time.race) / 60);
  const f = k => med(cs.map(c => c[k]));
  console.log(`${id.padEnd(9)} ${String(cs.length).padStart(2)}  ${String(cs.filter(c => c.stuck).length).padStart(5)}  ${String(f('breeds')).padStart(6)}  ${String(f('trains')).padStart(6)}  ${String(f('evolves')).padStart(7)}  ${String(f('races')).padStart(5)}   ${med(tm).toFixed(1).padStart(7)}  ${Math.max(...tm).toFixed(1).padStart(7)}`);
}
const tot = runs.filter(r => r.cleared === 11).map(r => (r.total.compute + r.total.ui + r.total.race) / 60);
if (tot.length) console.log(`total minutes (cleared runs): median ${med(tot).toFixed(0)}, min ${Math.min(...tot).toFixed(0)}, max ${Math.max(...tot).toFixed(0)}; mean ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(0)}`);
const parts = ['compute', 'ui', 'race'].map(k => `${k} ${med(runs.map(r => r.total[k] / 60)).toFixed(0)}`);
console.log('median parts (min):', parts.join(', '));
