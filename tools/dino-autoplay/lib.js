// dino-race のゲームのファイルをそのまま Node で読む。物理の手間（恐竜×ステップ）を数える
const fs = require('fs'), vm = require('vm'), path = require('path');
const GAME = process.env.GAME || path.join(__dirname, '../../dino-race/js');
const planck = require('planck');
const ctx = {planck, console, Math, TX: (a, b) => a, prog: {medals: {}, joined: {}}};
vm.createContext(ctx);
for (const f of ['genome.js', 'sim.js', 'ga.js', 'cups.js']) vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), ctx, {filename: f});
const cost = {steps: 0};
ctx.__cost = cost;
vm.runInContext(`{ const orig = stepRace; stepRace = function(R, o) { __cost.steps += R.dinos.reduce((s, d) => s + (d.removed ? 0 : 1), 0); return orig(R, o); }; }`, ctx);
const pick = 'GENES SPECIES CUPS REFS FINISH LIMIT TRIES bodyPlan measureRobust evaluate jitter crossover mutate makeRng makePop stepGeneration scoreOf score1 cloneGenome'.split(' ');
module.exports = {...vm.runInContext(`({${pick.join(',')}})`, ctx), cost, ctx};
