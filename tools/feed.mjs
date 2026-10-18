// feed.xml・feed-en.xml（RSS／Atom）を、入口の GAMES から作りなおす（まなびラボの _dev/tools/seo.mjs のフィードと同じ形）。
// 使い方: node tools/feed.mjs          … 書きかえる
//         node tools/feed.mjs --check  … 書きかえずに、古いところがあれば知らせる（終了コード 1）
// 入口のゲームの公開と更新を RSS リーダーへ知らせる。1本＝1件、更新日は GAMES の updated。保管庫のゲームは入れない。
// 入口の head の <!-- feed -->〜<!-- /feed --> にフィードの場所も置く（RSS リーダーが入口の URL から見つけられるように）。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://sishiya.github.io/asobi-lab/';
const check = process.argv.includes('--check');

const entrancePath = join(root, 'index.html');
const entrance = readFileSync(entrancePath, 'utf8');
const m = entrance.match(/const GAMES = (\[[\s\S]*?\n\]);/);
if (!m) throw new Error('index.html に GAMES が見つからない');
const GAMES = new Function('return ' + m[1])();

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const rel = p => p.slice(root.length + 1).replace(/\\/g, '/');
const stale = [];
function write(p, body) {
  let old = '';
  try { old = readFileSync(p, 'utf8'); } catch (e) {}
  if (old !== body) { stale.push(p); if (!check) writeFileSync(p, body); }
}

// 入口の head（description の次の行）
const LINKS = '<!-- feed（tools/feed.mjs が作る。手で直さない） -->\n'
  + '<link rel="alternate" type="application/atom+xml" title="あそびラボ" href="' + BASE + 'feed.xml"><link rel="alternate" type="application/atom+xml" title="Asobi Lab (English)" href="' + BASE + 'feed-en.xml">\n'
  + '<!-- /feed -->';
let head;
if (/<!-- feed[（ ][\s\S]*?<!-- \/feed -->/.test(entrance)) head = entrance.replace(/<!-- feed[（ ][\s\S]*?<!-- \/feed -->/, () => LINKS);
else {
  const d = entrance.match(/^<meta name="description"[^\n]*\n/m);
  if (!d) throw new Error('index.html に description の行が見つからない');
  head = entrance.replace(d[0], () => d[0] + LINKS + '\n');
}
write(entrancePath, head);

const toTime = d => d + 'T00:00:00+09:00';
const latest = GAMES.map(g => g.updated).sort().pop();
function feed(lang) {
  const en = lang === 'en';
  const self = BASE + (en ? 'feed-en.xml' : 'feed.xml');
  const q = en ? '?lang=en' : '';
  const items = [...GAMES].sort((a, b) => b.updated.localeCompare(a.updated) || b.created.localeCompare(a.created));
  const entries = items.map(g => {
    const url = BASE + g.id + '/';
    const title = en ? (g.title_en || g.title) : g.title;
    const desc = en ? (g.desc_en || g.desc) : g.desc;
    return `  <entry>\n    <title>${esc(title)}</title>\n    <link href="${url}${q}"/>\n    <id>${url}${q}</id>\n`
      + `    <published>${toTime(g.created)}</published>\n    <updated>${toTime(g.updated)}</updated>\n`
      + `    <summary>${esc(desc)}</summary>\n  </entry>`;
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">\n`
    + `  <title>${en ? 'Asobi Lab' : 'あそびラボ'}</title>\n`
    + `  <subtitle>${esc(en ? 'New and updated games' : 'ゲームの公開と更新')}</subtitle>\n`
    + `  <link href="${BASE}${q}"/>\n  <link rel="self" href="${self}"/>\n`
    + `  <id>${self}</id>\n  <updated>${toTime(latest)}</updated>\n  <author><name>${en ? 'Shishiya' : 'しし屋'}</name></author>\n`
    + entries.join('\n') + '\n</feed>\n';
}
write(join(root, 'feed.xml'), feed('ja'));
write(join(root, 'feed-en.xml'), feed('en'));

if (check) {
  if (stale.length) { console.log('古い（node tools/feed.mjs を走らせる）: ' + stale.map(rel).join(', ')); process.exit(1); }
  console.log('feed: OK');
} else {
  console.log(stale.length ? '書きかえた: ' + stale.map(rel).join(', ') : '変更なし');
}
