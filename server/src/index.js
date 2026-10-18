// あそびラボのオンラインの部分: 恐竜かけっこ牧場の「みんなの記録」（体重クラスごとの 100m のランキング）。
// 決めごとは dino-race/PLAN.md の v010。送られたものは全部うそかもしれないとして確かめる。
// 保存するのは、牧場の番号（端末でくじ引きした文字列）・クラス・タイム・しっかり度・系統・牧場の名前の番号・遺伝子・日時だけ。
// IP は回数の上限のためにメモリで数えるだけで、保存もログもしない。
import { DurableObject } from 'cloudflare:workers';
import { cleanGenome, massOf, classOf, CLASSES, LINES } from './dino.js';

const PHYS = ['sim1'];           // 物理の版（sim.js や planck を変えてタイムが変わったら足す。版ごとに別の表）
const FARM_WORDS = [62, 54];      // 牧場の名前の言葉の数（dino-race/js/online.js の FARM_A・FARM_B）
const TOP = 20, KEEP = 300;      // 見せる数・クラスごとに残す数
const MAX_BODY = 4096;
const LIMIT = {submit: [12, 600e3], read: [60, 60e3]}; // [回数, ミリ秒] 1つの IP あたり

const json = (data, status, cors) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors}});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const allowed = env.ALLOW.split(',').includes(origin);
    const cors = allowed ? {'access-control-allow-origin': origin, 'vary': 'origin'} : {};
    if (req.method === 'OPTIONS') {
      return new Response(null, {status: allowed ? 204 : 403, headers: {...cors, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400'}});
    }
    if (!allowed) return json({error: 'origin'}, 403, cors);
    const v = url.searchParams.get('v');
    if (!PHYS.includes(v)) return json({error: 'version'}, 400, cors);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const stub = env.BOARD.get(env.BOARD.idFromName('dino-race/' + v));
    if (req.method === 'GET' && url.pathname === '/dino-race/board') {
      const r = await stub.board(ip, url.searchParams.get('farm') || '');
      return json(r, r.error ? 429 : 200, cors);
    }
    const kind = {'/dino-race/submit': 'submit', '/dino-race/rename': 'rename'}[url.pathname];
    if (req.method === 'POST' && kind) {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({error: 'size'}, 413, cors);
      let body;
      try { body = JSON.parse(text); } catch { return json({error: 'json'}, 400, cors); }
      const r = await stub[kind](ip, body);
      return json(r, r.error ? (r.error === 'busy' ? 429 : 400) : 200, cors);
    }
    return json({error: 'not found'}, 404, cors);
  },
};

const isFarm = s => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);
const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const isFname = f => Array.isArray(f) && f.length === 2 && f.every((x, i) => isInt(x, 0, FARM_WORDS[i] - 1));

async function hashOf(g) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(g)));
  return [...new Uint8Array(buf)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1つの物理の版につき1つ。クラスごとの表を SQLite に
export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS rec (
      farm TEXT NOT NULL, cls TEXT NOT NULL, t REAL NOT NULL, ok INTEGER NOT NULL,
      line TEXT NOT NULL, fname TEXT NOT NULL, g TEXT NOT NULL, gh TEXT NOT NULL UNIQUE, at INTEGER NOT NULL,
      PRIMARY KEY (farm, cls))`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS rec_cls_t ON rec (cls, t)');
    this.hits = new Map(); // IP → {kind: [時刻...]}（メモリだけ）
    this.top = null;       // 表のキャッシュ（書きこむと消す）
  }

  busy(ip, kind) {
    const [n, ms] = LIMIT[kind], now = Date.now();
    const h = this.hits.get(ip) || {};
    const list = (h[kind] || []).filter(t => now - t < ms);
    if (list.length >= n) return true;
    list.push(now); h[kind] = list; this.hits.set(ip, h);
    if (this.hits.size > 5000) this.hits.clear(); // メモリを使いすぎない
    return false;
  }

  tops() {
    if (!this.top) {
      const out = {};
      for (const [c] of CLASSES) {
        out[c] = this.sql.exec('SELECT t, ok, line, fname, g FROM rec WHERE cls = ? ORDER BY t, at LIMIT ?', c, TOP).toArray()
          .map(r => ({t: r.t, ok: r.ok, line: JSON.parse(r.line), fname: JSON.parse(r.fname), g: JSON.parse(r.g)}));
      }
      this.top = out;
    }
    return this.top;
  }

  mine(farm) {
    const out = {};
    if (!isFarm(farm)) return out;
    for (const r of this.sql.exec('SELECT cls, t, at FROM rec WHERE farm = ?', farm).toArray()) {
      const ahead = this.sql.exec('SELECT COUNT(*) AS n FROM rec WHERE cls = ? AND (t < ? OR (t = ? AND at < ?))', r.cls, r.t, r.t, r.at).one().n;
      out[r.cls] = {rank: ahead + 1, t: r.t};
    }
    return out;
  }

  async board(ip, farm) {
    if (this.busy(ip, 'read')) return {error: 'busy'};
    return {classes: this.tops(), mine: this.mine(farm), now: Date.now()};
  }

  async submit(ip, b) {
    if (this.busy(ip, 'submit')) return {error: 'busy'};
    if (!b || typeof b !== 'object') return {error: 'shape'};
    const g = cleanGenome(b.g);
    if (!g) return {error: 'genome'};
    if (!isFarm(b.farm)) return {error: 'farm'};
    if (!isFname(b.fname)) return {error: 'fname'};
    if (!Array.isArray(b.line) || b.line.length < 1 || b.line.length > 2 || !b.line.every(x => LINES.includes(x))) return {error: 'line'};
    if (typeof b.t !== 'number' || !Number.isFinite(b.t) || b.t < 5 || b.t > 40) return {error: 'time'};
    if (!isInt(b.ok, 7, 10)) return {error: 'steady'};
    const M = massOf(g), cls = classOf(M);
    const gh = await hashOf(g);
    const dup = this.sql.exec('SELECT farm, cls FROM rec WHERE gh = ?', gh).toArray()[0];
    if (dup && !(dup.farm === b.farm && dup.cls === cls)) return {error: 'same'}; // 同じ恐竜はほかの牧場・クラスにいる
    const t = Math.round(b.t * 1000) / 1000;
    this.sql.exec(`INSERT INTO rec (farm, cls, t, ok, line, fname, g, gh, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (farm, cls) DO UPDATE SET t = excluded.t, ok = excluded.ok, line = excluded.line, fname = excluded.fname, g = excluded.g, gh = excluded.gh, at = excluded.at`,
      b.farm, cls, t, b.ok, JSON.stringify(b.line), JSON.stringify(b.fname), JSON.stringify(g), gh, Date.now());
    // 牧場の名前は牧場ごとに1つ（出し直したら、ほかのクラスの行もそろえる）
    this.sql.exec('UPDATE rec SET fname = ? WHERE farm = ?', JSON.stringify(b.fname), b.farm);
    // クラスごとに速いほうから KEEP まで残す
    this.sql.exec('DELETE FROM rec WHERE cls = ? AND rowid NOT IN (SELECT rowid FROM rec WHERE cls = ? ORDER BY t, at LIMIT ?)', cls, cls, KEEP);
    this.top = null;
    return {ok: true, cls, M, mine: this.mine(b.farm)};
  }

  // 牧場の名前だけ変える（その牧場の行ぜんぶ）
  async rename(ip, b) {
    if (this.busy(ip, 'submit')) return {error: 'busy'};
    if (!b || !isFarm(b.farm) || !isFname(b.fname)) return {error: 'shape'};
    this.sql.exec('UPDATE rec SET fname = ? WHERE farm = ?', JSON.stringify(b.fname), b.farm);
    this.top = null;
    return {ok: true};
  }
}
