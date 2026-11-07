// 試しに歩かせて測る（ページと手元の学習で同じ）: 起伏のある地面で、左回り→右回りの8の字
// 測るもの: 進んだ道のり・曲がり方・転んだか・足のすべり（地面についている足が横に動いた距離）・Y字（後ろ足が前足より前に着いた割合）・1こまの計算時間
import { heights, height, SIZE, RES } from './ground.js';
import { buildHare, drive, pose, GROUND, decodeParams } from './hare.js';
import { shape } from './reference.js';

export function makeField(R) {
  const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 240;
  world.createCollider(R.ColliderDesc.heightfield(RES, RES, heights(), { x: SIZE, y: 1, z: SIZE }).setFriction(1.0).setCollisionGroups(GROUND), world.createRigidBody(R.RigidBodyDesc.fixed()));
  return world;
}

// 足が地面についているか（かかとか指先のどちらかが、地面から 5mm 以内）
export const rotv = (q, v) => { const [x, y, z] = v, ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z, iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z; return [ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x]; };
export function footDown(f) { return !!contactPoint(f); }
// 地面についている点（かかとか指先の低いほう）。ついていなければ null
export function contactPoint(f) {
  const t = f.body.translation(), q = f.body.rotation(); let best = null;
  f.ends.forEach((e, k) => { const d = rotv(q, e), x = t.x + d[0], y = t.y + d[1], z = t.z + d[2], g = y - f.r - height(x, z); if (g < 0.005 && (!best || g < best.g)) best = { x, z, g, k }; });
  return best;
}

// 1回の試し。v＝リズムの数（0..1 の並び）。dur 秒。turn(t) で曲がり方を決める
export function trial(R, v, { dur = 8, at = [0, 0, 0], turn = t => (t < dur / 2 ? 1 : -1), onFrame = null, H: H0 = null, world: W0 = null, setup = null } = {}) {
  const world = W0 || makeField(R), H = H0 || buildHare(R, world, at, height), q = decodeParams(v);
  if (setup) setup(world, H); // 確かめ用（摩擦を変えるなど）
  const steps = Math.round(dur * 240), stand = 0.4;
  let dist = 0, yawGain = 0, drift = 0, slip = 0, contactT = 0, hindTD = 0, yTD = 0, lead = 0, fell = false, last = pose(H), ms = 0, lastFore = {}, flight = 0, samples = 0;
  const events = [], key = f => (f.hind ? 'h' : 'f') + (f.side > 0 ? 'L' : 'R');
  const spineAng = () => { const a = H.parts.pelvis.body.rotation(), b = H.parts.chest.body.rotation(), w = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z, z = a.w * b.z - a.z * b.w + a.x * b.y - a.y * b.x; return 2 * Math.atan2(z, w); };
  for (let k = 0; k < steps; k++) {
    const t = k / 240, g = t < stand ? 0 : Math.min(1, (t - stand) * 3), tc = turn(t);
    drive(H, q, t, g, tc);
    const t0 = performance.now(); world.step(); ms += performance.now() - t0;
    const P = pose(H);
    if (k % 4 === 0) {
      dist += (P.x - last.x) * last.fx + (P.z - last.z) * last.fz;
      let dy = P.yaw - last.yaw; dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2; yawGain += dy * tc; if (tc === 0 && t > stand) drift += dy; // まっすぐと言われたのに流れた分
      for (const f of H.feet) {
        const c = contactPoint(f), d = !!c, p = c || f.body.translation(); // すべりは、地面についている点の動き（足が転がる分は数えない）
        if (d && f.down && f.at && f.at.k === c.k) { slip += Math.hypot(p.x - f.at.x, p.z - f.at.z); contactT += 4 / 240; } // かかと↔指先へ移ったときは数えない
        if (d && !f.down && t > stand) { // 足をついた
          const along = p.x * P.fx + p.z * P.fz;
          if (!f.hind) lastFore[f.side] = along;
          else if (lastFore[1] != null && lastFore[-1] != null) { hindTD++; const dl = along - Math.max(lastFore[1], lastFore[-1]); lead += Math.max(-1, Math.min(1, dl / 0.3)); if (dl > 0) yTD++; } // 後ろ足が前足よりどれだけ前に着いたか
        }
        if (d !== f.down && t > stand + 0.5) events.push({ t, key: key(f), down: d, spine: spineAng() }); // 足が着く・はなれる（手本とくらべる）
        f.down = d; f.at = c ? { x: c.x, z: c.z, k: c.k } : null;
      }
      if (t > stand + 0.5) { samples++; if (!H.feet.some(f => f.down)) flight++; }
      last = P;
      if (P.up < 0.35 || P.y - height(P.x, P.z) < 0.05) { fell = true; break; }
      if (onFrame) onFrame(t, H, P);
    }
  }
  return { dist, yaw: yawGain, drift, slip: slip / Math.max(contactT, 1e-3), fell, yRatio: hindTD ? yTD / hindTD : 0, yLead: hindTD ? lead / hindTD : -1, hindTD, msPerStep: ms / steps, ...(() => { const sh = shape(events, dur - stand - 0.5); return { match: sh.score, parts: sh.parts, freq: sh.freq }; })(), flight: samples ? flight / samples : 0, H, world };
}

// 学習の点数: 前へ進む ＋ 言われた向きへ曲がる ＋ Y字 − すべり − 転ぶ
// 速さは「ゆっくり跳ぶ」ほど（秒速 0.5m まで）で頭打ち。足のすべりは強く引く（すべって進む動きを本物と見なさない）。Y字の跳び方に点
// slipW＝すべりの重み（はじめは軽く＝まず動けるように、あとで重く＝すべらない跳び方へ）
// imit＝手本（本物の足をつく順）にどれだけ合わせるか、fallW＝転ぶ罰（はじめは軽く＝跳ぶことをためせるように、あとで重く）
// yawW＝言われた向きに曲がる重み（0.25 だと曲がらない跳び方に逃げた。遊ぶ人の操作に合わせるときは 1）。まっすぐのとき流れた分も引く
export const score = (r, dur = 6, slipW = 8, imit = 0, fallW = 0.6, yawW = 0.25) => Math.min(r.dist, 0.5 * dur) + yawW * r.yaw - yawW * Math.abs(r.drift || 0) + 2 * r.yRatio * Math.min(1, r.hindTD / 8) + 2 * (r.yLead ?? -1) * Math.min(1, r.hindTD / 8) - slipW * r.slip - (r.fell ? fallW : 0) + imit * (r.match - 0.5) * 2;
