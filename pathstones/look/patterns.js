// ルックの見くらべ（2026-10-19）。同じ配置・同じ動きで、見た目だけを変える。
// 色はすべてここ。look.js は数字を読むだけ。
export const PATTERNS = {
  A: {
    name: '洞窟とカンテラ',
    en: 'Cave & lanterns',
    ground: { kind: 'dirt', base: '#3b3229', dark: '#1f1913', light: '#5c4c3b', accent: '#3c4a25', repeat: 7, rough: 0.95, bump: 2.0 },
    hemi: { sky: '#33405a', ground: '#140f0a', intensity: 0.35 },
    fog: { color: '#0a0806', density: 0.03 },
    bg: '#0a0806',
    lamp: { kind: 'lantern', color: '#ffae5e', intensity: 78, distance: 16, avoid: 3.6, metal: '#2b2622' },
    block: { palette: ['#80776b', '#6f675d', '#8a7e6e', '#766c60'], rough: 0.9, metal: 0.0, legs: '#2a221c', moss: '#4f5f2c' },
    head: { color: '#a3382a', rough: 0.55, eye: '#ff4a20', eyeGlow: 2.5, glass: '#ffd8a0' },
    pilot: { suit: '#3c3048', skin: '#d8b090', hat: '#5a1f1a', goggle: '#ffcf60' },
    player: { suit: '#5c8448', skin: '#e2bd96', hat: '#c9a24a', light: '#ffd49a', lightI: 0.64, lightD: 3.2 },
    trail: { color: '#a08f74', emissive: '#000000', ei: 0 },
    props: { kind: 'rocks', color: '#4b4139', count: 170 },
    trap: { color: '#9a8f80', metal: 0.7 },
    bloom: { strength: 0.75, radius: 0.5, threshold: 0.75 },
    post: { vignette: 1.15, grain: 0.045, tilt: 0 },
    cam: { fov: 34, height: 16, back: 11 },
  },
  B: {
    name: '夜のジオラマ',
    en: 'Night diorama',
    ground: { kind: 'wood', base: '#4a3220', dark: '#2a1a0e', light: '#5e4430', accent: '#2a1b10', repeat: 3, rough: 0.7, bump: 1.2 },
    hemi: { sky: '#5a4a6a', ground: '#1a100a', intensity: 0.25 },
    fog: { color: '#0d0805', density: 0.022 },
    bg: '#0d0805',
    lamp: { kind: 'candle', color: '#ffa04a', intensity: 30, distance: 11, avoid: 3.4, metal: '#efe6d6' },
    block: { palette: ['#d9b06a', '#6b98bf', '#80ad6a', '#e3d7bf', '#c97b5b'], rough: 0.55, metal: 0.0, legs: '#3a2a1c', moss: null },
    head: { color: '#c4372b', rough: 0.3, eye: '#fff0c0', eyeGlow: 1.2, glass: '#cfe8ff' },
    pilot: { suit: '#2c3b66', skin: '#f0c8a0', hat: '#c4372b', goggle: '#ffffff' },
    player: { suit: '#e8c050', skin: '#f2cba4', hat: '#4a8a5a', light: '#ffe0a8', lightI: 0.56, lightD: 3.0 },
    trail: { color: '#b48d62', emissive: '#000000', ei: 0 },
    props: { kind: 'toys', color: '#b8905e', count: 90 },
    trap: { color: '#d0d0d0', metal: 0.9 },
    bloom: { strength: 0.45, radius: 0.5, threshold: 0.85 },
    post: { vignette: 1.05, grain: 0.03, tilt: 0.6 },
    cam: { fov: 28, height: 21, back: 14 },
  },
  C: {
    name: '光る菌の森',
    en: 'Glowing fungus',
    ground: { kind: 'moss', base: '#22403b', dark: '#0e1c1c', light: '#33605a', accent: '#2a6b5e', repeat: 6, rough: 0.9, bump: 1.6 },
    hemi: { sky: '#1d4558', ground: '#04080a', intensity: 0.32 },
    fog: { color: '#020708', density: 0.036 },
    bg: '#020708',
    lamp: { kind: 'mushroom', color: '#62f0cf', intensity: 72, distance: 15, avoid: 3.6, metal: '#c8e8e0' },
    block: { palette: ['#22272d', '#2a2f36', '#1d2126'], rough: 0.35, metal: 0.25, legs: '#101316', moss: null },
    head: { color: '#a8253c', rough: 0.35, eye: '#ff3a5a', eyeGlow: 3.5, glass: '#9fffe8', emissive: '#ff2848', ei: 0.18 },
    pilot: { suit: '#3a2030', skin: '#c8a8a0', hat: '#ff3a5a', goggle: '#ff6a80' },
    player: { suit: '#e0e8d0', skin: '#e8d0b8', hat: '#f0b040', light: '#ffd890', lightI: 0.64, lightD: 3.2 },
    trail: { color: '#3d8f7c', emissive: '#2fd0a8', ei: 0.06 },
    props: { kind: 'fungi', color: '#1a3a34', count: 150 },
    trap: { color: '#7a8a88', metal: 0.8 },
    bloom: { strength: 0.85, radius: 0.55, threshold: 0.6 },
    post: { vignette: 1.25, grain: 0.04, tilt: 0 },
    cam: { fov: 34, height: 16, back: 11 },
  },
  D: {
    name: '墨と提灯',
    en: 'Ink & lanterns',
    toon: true,
    outline: true,
    ground: { kind: 'ink', base: '#4a4740', dark: '#24221e', light: '#68635a', accent: '#100f0e', repeat: 5, rough: 1, bump: 0.8 },
    hemi: { sky: '#8a8a90', ground: '#202020', intensity: 0.22 },
    fog: { color: '#0b0b0b', density: 0.03 },
    bg: '#0b0b0b',
    lamp: { kind: 'paper', color: '#ffb070', intensity: 78, distance: 15, avoid: 3.5, metal: '#1a1a1a' },
    block: { palette: ['#ddd6c6', '#cfc7b4', '#e6dfcf'], rough: 1, metal: 0, legs: '#161616', moss: null },
    head: { color: '#d63a2a', rough: 1, eye: '#fff4d0', eyeGlow: 1.6, glass: '#ffffff' },
    pilot: { suit: '#1c1c1c', skin: '#e8dccb', hat: '#d63a2a', goggle: '#fff4d0' },
    player: { suit: '#f2ead8', skin: '#efe2cc', hat: '#1c1c1c', light: '#ffd8a0', lightI: 0.56, lightD: 3.0 },
    trail: { color: '#6a645a', emissive: '#000000', ei: 0 },
    props: { kind: 'inkstones', color: '#3a3631', count: 120 },
    trap: { color: '#e8e0d0', metal: 0.0 },
    bloom: { strength: 0.55, radius: 0.45, threshold: 0.8 },
    post: { vignette: 1.2, grain: 0.07, tilt: 0 },
    cam: { fov: 34, height: 16, back: 11 },
  },
};

// 2回目（2026-10-19）: ユーザー「雰囲気は A が好き。ゲームとしては D」。世界は A、登場物を D のように読みやすく
{
  const A = PATTERNS.A, D = PATTERNS.D;
  // E: 世界は A。登場物は D そのもの（アニメ調の陰影・ふちどり・白い積み木・赤い頭）
  PATTERNS.E = { ...A, name: '洞窟＋墨の登場物', en: 'Cave + ink actors', actorToon: true, actorOutline: true,
    block: { ...D.block }, head: { ...D.head }, pilot: D.pilot, player: { ...D.player, lightI: A.player.lightI }, trap: D.trap };
  // F: 世界は A。登場物は写実のまま、明るい石とふちどりだけ足す
  PATTERNS.F = { ...A, name: '洞窟＋ふちどり', en: 'Cave + outlines', actorOutline: true,
    block: { ...A.block, palette: ['#cbc1b0', '#bfb5a4', '#d6cdbc', '#c4b9a6'], rough: 0.8 },
    head: { ...A.head, color: '#c8382a', emissive: '#ff2a18', ei: 0.12 },
    player: { ...A.player, suit: '#e8e0c8', hat: '#3c6a38' } };
  // G: F に、暗がりをほんの少しだけ明るく・跡を濃く（灯りの外でも、目をこらせば形がわかる）
  PATTERNS.G = { ...PATTERNS.F, name: '洞窟＋ふちどり（暗がり少し明るく）', en: 'Cave + outlines, softer dark',
    hemi: { ...A.hemi, intensity: 0.75 }, fog: { ...A.fog, density: 0.024 },
    trail: { color: '#c8b08a', emissive: '#3a2a10', ei: 0.25 } };
}

// 3回目（2026-10-19）: D に決まった（ユーザー）。D を土台に、ふちどり・積み木の色・頭と操縦席の作りこみを振る
{
  const D = PATTERNS.D;
  const v = (name, o) => ({ ...D, name, ...o, block: { ...D.block, ...(o.block || {}) }, head: { ...D.head, ...(o.head || {}) } });
  PATTERNS.D1 = v('D＋ふちどり太め', { outlineK: 1.9 });
  PATTERNS.D2 = v('D＋ふちどり細め', { outlineK: 0.45 });
  PATTERNS.D3 = v('D＋白と朱のしま', { block: { palette: ['#e6dfcf', '#9a3426'] } });
  PATTERNS.D4 = v('D＋頭から色が移る', { block: { gradient: ['#e8743a', '#e6dfcf'] } });
  PATTERNS.D5 = v('D＋操縦席を作りこむ', { head: { cockpit: 'deluxe', flag: '#141414' } });
  // D7 ヘビ型（snakes: 2）はユーザーがオミット（2026-10-19）。しくみ（look.js の kind 'snake'）は残してある
  PATTERNS.D6 = v('D＋くみあわせ', { outlineK: 1.35, block: { gradient: ['#e8743a', '#e6dfcf'] }, head: { cockpit: 'deluxe', face: 'kumadori', flag: '#141414' } });
}
