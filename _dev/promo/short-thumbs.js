// ショートのサムネイル（1080×1920）と説明動画のサムネイル（1280×720）の中身。描くのは short-thumb.html、作るのは _dev/tools/make-short-thumbs.ps1
// （まなびラボ RULES 8.7 と同じ。表の形もまなびラボの _dev/promo/short-thumbs.js と同じ）
// t: ショートの mp4 から取るコマの秒。focus: 絵の中で見せたい点（0〜1、左上が 0,0）、zoom: 寄せる倍率（1 = 横いっぱい）
// kicker: 上の小さな一言、big: いちばん大きな言葉（数字や驚き）、sub: 下の言葉。c1・c2: big の色（上から下へ）
// 数字は動画・ゲームで出している値だけ（想像で盛らない）。wname: 説明動画の下の名前の後ろ（省くと「使い方と見どころ」。あそびラボのゲームは「あそびかたと見どころ」）
// 札の形: 'pill'（右上にアイコン＋あそびラボ）か 'icon'（左上に しし屋 あそびラボ、右上はアイコンだけ）。short-thumb.html の badge
window.ASOBI_BADGE = 'icon';   // 2026-10-19 ユーザーが見くらべて 'icon' に決めた
window.SHORT_THUMBS = {
  'edge-falls':    { name: '果ての滝の箱庭', t: 3, focus: [0.5, 0.41], zoom: 1.3, wfocus: [0.47, 0.42], wzoom: 0.75, wx: 830, kicker: '何も生まれず、何も消えない', big: '世界の果て', sub: 'から、川が滝になって落ちる', c1: '#eaf4ff', c2: '#8fc3e8' },
  'dino-race':     { name: '恐竜かけっこ牧場', wname: 'あそびかたと見どころ', t: 32.2, focus: [0.68, 0.655], zoom: 2.6, wfocus: [0.6, 0.62], wzoom: 1.25, wx: 900, kicker: '恐竜を育てて、人の世界記録に挑む', big: '9.58秒', sub: 'より速い恐竜を育てろ！', c1: '#fff1c9', c2: '#f08a5a' },
  'face-in-frame': { name: '名画の顔ハメ', wname: 'あそびかたと見どころ', t: 13.5, focus: [0.6, 0.43], zoom: 1.5, wfocus: [0.6, 0.43], wzoom: 0.9, wx: 880, kicker: '名画の顔に、自分の顔をはめる', big: '口をへの字に！', sub: '5秒で、写楽の表情をまねろ', c1: '#fff1c9', c2: '#e8b04a' },
};
