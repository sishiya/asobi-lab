// 庭（ユーザーが決めた目標「でかけた所が家の庭になる」。BRUSHUP.md）: でかけて藪にふれると、ひっつき虫（種）が毛につく。家に帰ると種がぽろぽろ落ちて、落ちた所に芽が出る。
// 芽は「家に帰るたび」一段育つ（芽 → つぼみ → 花。はじめて遊ぶ人が、その回のうちに花を見られるように）。枯れない・日がたっても罰はない。花の並びが、その子たちの足あとの地図になる
// 目標: 藪ごとにちがう5種の花を、庭にそろえる。残すのは 場所・種類・段だけ（端末の中）。手本: 里山で動物の毛につく、実在のひっつき虫5種（花の色も本物に寄せる）
import * as THREE from 'three';
import { height } from './ground.js';
import { makeFeltBall } from './felt.js';

const KEY = 'koenoko.garden', MAX = 40;
export const SEED_KINDS = [ // 藪ごとに1種
  { name: 'キンミズヒキ', burr: [0.46, 0.5, 0.26], petal: [0.95, 0.8, 0.28], heart: [0.82, 0.58, 0.18] },
  { name: 'ヌスビトハギ', burr: [0.52, 0.42, 0.24], petal: [0.88, 0.6, 0.74], heart: [0.96, 0.86, 0.5] },
  { name: 'ミズヒキ', burr: [0.42, 0.34, 0.22], petal: [0.76, 0.22, 0.24], heart: [0.95, 0.85, 0.8] },
  { name: 'イノコヅチ', burr: [0.5, 0.56, 0.3], petal: [0.7, 0.8, 0.46], heart: [0.9, 0.9, 0.6] },
  { name: 'チヂミザサ', burr: [0.56, 0.5, 0.3], petal: [0.97, 0.94, 0.88], heart: [0.72, 0.6, 0.8] },
];
const LEAF = [0.46, 0.6, 0.3], STEM = [0.42, 0.54, 0.28];
function read() { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && Array.isArray(j.plants)) return j; } catch (e) { /* なし */ } return { plants: [] }; }
export function clearGarden() { try { localStorage.removeItem(KEY); } catch (e) { /* なし */ } }
const write = j => { try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) { /* 保存できない */ } };

// ひっつき虫: とげとげの小さなフェルトの玉（毛羽を長く）
export function makeBurr(kind) { const m = makeFeltBall(SEED_KINDS[kind].burr, { r: 0.008, seg: 10, fuzz: 3, len: 0.006 }); m.castShadow = false; return m; }

function plantMesh(p) {
  const g = new THREE.Group(), K = SEED_KINDS[p.kind], add = (c, o) => { const m = makeFeltBall(c, o); g.add(m); return m; };
  if (p.stage === 0) { for (const s of [-1, 1]) { const l = add(LEAF, { r: 0.016, sx: 1.5, sy: 0.5, seg: 12 }); l.position.set(s * 0.016, 0.018, 0); l.rotation.z = s * 0.5; } return g; } // 芽: ふた葉
  const H2 = p.stage === 1 ? 0.07 : 0.11, st = add(STEM, { r: 0.005, sy: H2 / 0.01, seg: 8 }); st.position.y = H2 / 2;
  for (const s of [-1, 1]) { const l = add(LEAF, { r: 0.016, sx: 1.6, sy: 0.45, seg: 12 }); l.position.set(s * 0.02, H2 * 0.35, 0); l.rotation.z = s * 0.45; }
  if (p.stage === 1) { const b = add(K.petal, { r: 0.014, sy: 1.3, seg: 12, fuzz: 2, len: 0.003 }); b.position.y = H2 + 0.008; return g; } // つぼみ
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, pt = add(K.petal, { r: 0.014, sx: 1.5, sy: 0.5, seg: 12, fuzz: 2, len: 0.004 }); pt.position.set(Math.cos(a) * 0.02, H2, Math.sin(a) * 0.02); pt.rotation.y = -a; }
  const h = add(K.heart, { r: 0.011, sy: 0.7, seg: 12, fuzz: 2, len: 0.003 }); h.position.y = H2 + 0.004; return g; // 花
}

export function makeGarden(scene) {
  const data = read(), meshes = new Map(), pops = [];
  const place = (p, pop) => { const m = plantMesh(p); m.position.set(p.x, height(p.x, p.z), p.z); m.rotation.y = p.rot; scene.add(m); meshes.set(p, m); if (pop) { m.scale.setScalar(0.01); pops.push({ m, t: 0 }); } };
  data.plants.forEach(p => place(p, false));
  return {
    get count() { return data.plants.length; }, get plants() { return data.plants; },
    // 種類ごとの いちばん進んだ段（-1＝まだない）
    kinds() { return SEED_KINDS.map((_, k) => data.plants.reduce((m, p) => (p.kind === k ? Math.max(m, p.stage) : m), -1)); },
    get allBloomed() { return this.kinds().every(s => s === 2); }, get celebrated() { return !!data.done; }, celebrate() { data.done = true; write(data); },
    // 家に帰るたび一段育つ。返すのは、はじめて咲いた種類
    growAll() {
      const before = this.kinds();
      for (const p of data.plants) if (p.stage < 2) { p.stage++; const o = meshes.get(p); if (o) scene.remove(o); place(p, true); }
      write(data); return this.kinds().flatMap((s, k) => (s === 2 && before[k] < 2 ? [k] : []));
    },
    // 種が落ちた所に芽（近すぎる所は少しずらす）
    sprout(x, z, kind) {
      for (const q of data.plants) if (Math.hypot(q.x - x, q.z - z) < 0.05) { x += 0.06 * Math.cos(q.rot * 5); z += 0.06 * Math.sin(q.rot * 5); }
      const p = { x, z, kind, stage: 0, rot: Math.random() * 6.28 }; data.plants.push(p);
      if (data.plants.length > MAX) { const i = data.plants.findIndex(o => data.plants.filter(q => q.kind === o.kind).length > 1), o = data.plants.splice(Math.max(0, i), 1)[0], m = meshes.get(o); if (m) scene.remove(m); meshes.delete(o); } // いっぱいなら古い株から（その種類の最後の1株は残す）
      write(data); place(p, true);
    },
    step(dt) { for (const s of pops) { s.t += dt; const k = Math.min(1, s.t / 0.5), e = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; s.m.scale.setScalar(Math.max(0.01, e)); s.done = k >= 1; } for (let i = pops.length - 1; i >= 0; i--) if (pops[i].done) pops.splice(i, 1); }, // ぽんと少しはずんで出る
  };
}
