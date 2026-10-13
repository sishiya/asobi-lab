// ショートのサムネイル（1080×1920）と説明動画のサムネイル（1280×720）の中身。描くのは short-thumb.html、作るのは _dev/tools/make-short-thumbs.ps1
// （まなびラボ RULES 8.7 と同じ。表の形もまなびラボの _dev/promo/short-thumbs.js と同じ）
// t: ショートの mp4 から取るコマの秒。focus: 絵の中で見せたい点（0〜1、左上が 0,0）、zoom: 寄せる倍率（1 = 横いっぱい）
// kicker: 上の小さな一言、big: いちばん大きな言葉（数字や驚き）、sub: 下の言葉。c1・c2: big の色（上から下へ）
// 数字は動画・ゲームで出している値だけ（想像で盛らない）
window.SHORT_THUMBS = {
  'edge-falls':    { name: '果ての滝の箱庭', t: 3, focus: [0.5, 0.41], zoom: 1.3, wfocus: [0.47, 0.42], wzoom: 0.75, wx: 830, kicker: '何も生まれず、何も消えない', big: '世界の果て', sub: 'から、川が滝になって落ちる', c1: '#eaf4ff', c2: '#8fc3e8' },
};
