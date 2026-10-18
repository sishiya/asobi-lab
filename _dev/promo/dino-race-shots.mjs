// 恐竜かけっこ牧場の紹介動画（v2・2026-10-19）で見せる、本物のゲーム画面をスマホの大きさで撮る（公開しない開発用）。
// 使い方（ゲームのフォルダ＝リポジトリのルートで）: node _dev/promo/dino-race-shots.mjs [--game=_dev/promo/out/game/dino-race]
//   ゲームは --game のフォルダ（既定はコミットずみの版を書き出した out/game。書き出しは README「別の会話がゲームを書きかえている途中」）。
// 撮った絵は _dev/promo/out/dino-shots/<名前>.png（390×844 の3倍）。台本 dino-race.html・dino-race-guide.html が読む。
// 操作はゲームのボタンをそのまま押す（物理や数は変えない）。大会の場面だけ、牧場に dino-genomes.json の「fast」（ラプトルどうしの子）を
// 生まれた子として入れたセーブから始める（自分で遊んで作れる子。初級のメダルもセーブに入れて中級を開く）。
// 情報がうつらないための決まりは tools/playwright/lib.mjs（まっさらなブラウザ・外へ出ない）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, safeContext } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const GAME = opt('game', '_dev/promo/out/game/dino-race');
const OUT = path.join(ROOT, '_dev/promo/out/dino-shots');
fs.mkdirSync(OUT, { recursive: true });
const G = JSON.parse(fs.readFileSync(path.join(ROOT, '_dev/promo/dino-genomes.json'), 'utf8'));

const server = await serve();
const browser = await launch();
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(init) {
  const ctx = await safeContext(browser, server.origin, { width: 390, height: 844, scale: 3 });
  // 日本語・ダークモード（動画の色にそろえる）
  await ctx.addInitScript(s => { try { localStorage.setItem('manabi-lang', 'ja'); if (s) for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) {} }, init || null);
  const page = await ctx.newPage();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/${GAME}/index.html`);
  await page.waitForFunction(() => window.__dino && document.querySelector('#ranch .card'), null, { timeout: 30000 });
  return { ctx, page };
}
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
// 記録が出るまで待つ（牧場のカードの .wait が消える）
const waitRecords = page => page.waitForFunction(() => !document.querySelector('#ranch .card.wait') && !document.querySelector('.kid.egg-wait'), null, { timeout: 120000 });

try {
  // ---- 1. はじめから: タイトル → 牧場 → 2匹選ぶ → かけ合わせのシート → 卵 → かえった子 ----
  {
    const { ctx, page } = await open();
    await sleep(2500); await page.evaluate(() => { for (let i = 0; i < 90; i++) window.__dino.stepView(1 / 30); });
    await sleep(500); await shot(page, 'title');
    await page.click('#titleBtns .primary'); await waitRecords(page); await sleep(800);
    await shot(page, 'ranch');
    const cards = await page.$$eval('#ranch .card', cs => cs.map(c => c.textContent));
    const pick = async re => { const i = cards.findIndex(s => re.test(s)); await page.click(`#ranch .card >> nth=${i}`); await sleep(300); };
    await pick(/ラプトル/); await pick(/ティラノ/);
    await sleep(500); await shot(page, 'ranch-selected');
    await page.click('#btnBreed'); await sleep(900); await shot(page, 'breed');
    await page.click('#btnBreedGo'); await sleep(700); await shot(page, 'eggs');
    await waitRecords(page); await sleep(1500); await shot(page, 'kids');
    await page.evaluate(() => window.__dino.setTab('cups')); await sleep(700); await shot(page, 'cups');
    await ctx.close();
  }
  // ---- 2. 大会「人の世界記録をやぶれ」: ラプトルどうしの子で出る（本番の調子は毎回ちがうので、勝つまで撮りなおす） ----
  for (let tryN = 1; tryN <= 6; tryN++) {
    const sp = { raptor: 1, compy: 1, trex: 1 };
    const fast = { id: 'k-fast', name: 'ラプトル 4号', g: G.fast, gen: 1, parents: ['raptor', 'raptor'], from: 'raptor', origin: 'ヴェロキラプトル × ヴェロキラプトル' };
    const { ctx, page } = await open();
    await page.click('#titleBtns .primary'); await waitRecords(page); await sleep(500);
    // セーブに子を足して読み直す（ゲームの読み込みの確かめ cleanDino を通る形）
    await page.evaluate(f => {
      const s = JSON.parse(localStorage.getItem('asobi-lab/dino-race/ranch-v1'));
      s.ranch.push(f); s.serial = 5; localStorage.setItem('asobi-lab/dino-race/ranch-v1', JSON.stringify(s));
      const p = JSON.parse(localStorage.getItem('asobi-lab/dino-race/progress-v1') || '{}');
      p.medals = {}; for (const c of eval('CUPS')) if (c.tier === 1) p.medals[c.id] = { t: 10, name: f.name };
      localStorage.setItem('asobi-lab/dino-race/progress-v1', JSON.stringify(p));
      sessionStorage.setItem('asobi-lab/dino-race/skip-title', '1');
    }, fast);
    await page.reload(); await page.waitForFunction(() => window.__dino && document.querySelector('#ranch .card'), null, { timeout: 30000 });
    await waitRecords(page); await sleep(800);
    if (tryN === 1) await shot(page, 'ranch-fast');
    await page.evaluate(() => window.__dino.setTab('cups')); await sleep(500);
    await page.click('#tierSeg button >> nth=1').catch(() => {}); await sleep(500);
    if (tryN === 1) await shot(page, 'cups-2');
    await page.evaluate(() => window.__dino.openPick(eval('CUPS').find(c => c.id === 'human'))); await sleep(900);
    if (tryN === 1) await shot(page, 'pick');
    await page.click('#sheetBody .pick button:not([disabled]) >> nth=0'); await sleep(3500);
    await shot(page, 'race-' + tryN);
    await page.click('#btnSkip').catch(() => {}); await sleep(3500);
    const txt = await page.$eval('#sheetBody', e => e.textContent).catch(() => '');
    await shot(page, 'result-' + tryN);
    const won = /メダル/.test(txt) && !/転/.test(txt.slice(0, 80));
    console.log('try', tryN, won ? 'WIN' : 'no', txt.slice(0, 120).replace(/\s+/g, ' '));
    if (won) { fs.copyFileSync(path.join(OUT, `result-${tryN}.png`), path.join(OUT, 'result.png')); fs.copyFileSync(path.join(OUT, `race-${tryN}.png`), path.join(OUT, 'race.png'));
      await page.click('#btnSheetClose').catch(() => {}); await sleep(600);
      await page.evaluate(() => window.__dino.setTab('book')); await sleep(800); await shot(page, 'book');
      await page.click('#bookSeg button >> nth=1').catch(() => {}); await sleep(800); await shot(page, 'book-chart');
      await page.click('#bookSeg button >> nth=3').catch(() => {}); await sleep(1500); await shot(page, 'book-online');
      await ctx.close(); break; }
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
}
