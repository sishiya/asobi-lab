; ---- 絵: 水・光の筋・マリンスノー・プランクトン・捕食者・見上げた画面・字（main.s のつづき） ----

; 場面をまるごと描く（V_TH が 32 より小さければ横の画面、大きければ見上げた画面）
scene:
  addiu sp, sp, -8
  sw ra, 0(sp)
  lw t0, V_TH(gp)
  nop
  slti t1, t0, 32
  beqz t1, @up
  nop
  ; ---- 横の画面 ----
  ; 水: 上のふちと下のふちの光の色のグーロー
  lw a0, V_ITOP(gp)
  jal palc
  nop
  move t8, v0
  lw a0, V_IBOT(gp)
  jal palc
  nop
  li t0, 0x38000000
  or t0, t0, t8
  sw t0, GP0(s7)
  li t0, 0xff88ff60          ; (−160,−120)
  sw t0, GP0(s7)
  sw t8, GP0(s7)
  li t0, 0xff8800a0          ; (160,−120)
  sw t0, GP0(s7)
  sw v0, GP0(s7)
  li t0, 0x0078ff60          ; (−160,120)
  sw t0, GP0(s7)
  sw v0, GP0(s7)
  li t0, 0x007800a0          ; (160,120)
  sw t0, GP0(s7)
  jal snow
  nop
  jal plkdraw
  nop
  jal predside
  nop
  li a0, 0
  jal fishdraw
  nop
  jal photodraw
  nop
  jal rays
  nop
  b @fade
  nop
@up:
  ; ---- 見上げた画面: 上からの光の円（明るさ＝魚の所の光）と、魚の腹のシルエット ----
  ; 捕食者の目は暗さに慣れている: 上の光の円はいつも同じ明るさ（段 200）に見せ、魚の腹との差だけを 2 倍にして見せる
  li a0, 96
  jal palc
  nop
  li t0, 0x28000000          ; まわりは暗く
  or t0, t0, v0
  sw t0, GP0(s7)
  li t0, 0xff88ff60
  sw t0, GP0(s7)
  li t0, 0xff8800a0
  sw t0, GP0(s7)
  li t0, 0x0078ff60
  sw t0, GP0(s7)
  li t0, 0x007800a0
  sw t0, GP0(s7)
  jal disc
  nop
  li a0, 1
  jal fishdraw
  nop
  jal predup
  nop
  ; 案内: A▲ B▼（下のまん中）
  la a0, s_hint
  li a1, -36
  li a2, 100
  li a3, 0x00b0b8c0
  jal text
  nop
@fade:
  ; 見つかったとき: 引き算の半透明で暗くする
  lw t0, V_FADE(gp)
  nop
  blez t0, @nofade
  nop
  li t1, 0xe1000640
  sw t1, GP0(s7)
  sll t1, t0, 8
  or t1, t1, t0
  sll t1, t1, 8
  or t1, t1, t0
  li t2, 0x2a000000
  or t1, t1, t2
  sw t1, GP0(s7)
  li t0, 0xff88ff60
  sw t0, GP0(s7)
  li t0, 0xff8800a0
  sw t0, GP0(s7)
  li t0, 0x0078ff60
  sw t0, GP0(s7)
  li t0, 0x007800a0
  sw t0, GP0(s7)
  li t1, 0xe1000620
  sw t1, GP0(s7)
@nofade:
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; a0 = 光の段（0〜255）→ v0 = 水の色（0x00BBGGRR）
palc:
  bgez a0, @p1
  nop
  li a0, 0
@p1:
  slti v0, a0, 256
  bnez v0, @p2
  nop
  li a0, 255
@p2:
  la v0, pal
  sll a0, a0, 2
  addu v0, v0, a0
  lw v0, 0(v0)
  jr ra
  nop

; 光の筋（上が明るいときだけ。加算の半透明の斜めの帯 3 本、ゆっくりゆれる）
rays:
  lw t0, V_ITOP(gp)
  nop
  addiu t0, t0, -150
  blez t0, @none
  nop
  srl t0, t0, 1              ; 強さ（0〜52）
  srl t1, t0, 1
  sll t2, t0, 8
  or t1, t1, t2
  sll t2, t0, 16
  or t1, t1, t2              ; 0x00 B G R/2
  li t2, 0x2a000000
  or t9, t1, t2
  lw t3, V_T(gp)
  la t4, sintab
  sll t3, t3, 1
  andi t3, t3, 255
  sll t3, t3, 2
  addu t4, t4, t3
  lw t3, 0(t4)
  nop
  sra t3, t3, 9              ; ±8
  la t5, raytab
  li t6, 3
@r:
  lh t7, 0(t5)               ; 上の x
  lh t8, 2(t5)               ; 幅
  addu t7, t7, t3
  sw t9, GP0(s7)
  li t0, 0xff880000
  andi t1, t7, 0xffff
  or t1, t1, t0
  sw t1, GP0(s7)             ; 左上
  addu t2, t7, t8
  andi t2, t2, 0xffff
  or t2, t2, t0
  sw t2, GP0(s7)             ; 右上
  addiu t1, t7, 70
  andi t1, t1, 0xffff
  li t0, 0x00780000
  or t1, t1, t0
  sw t1, GP0(s7)             ; 左下
  addu t2, t7, t8
  addu t2, t2, t8
  addiu t2, t2, 70
  andi t2, t2, 0xffff
  or t2, t2, t0
  sw t2, GP0(s7)             ; 右下（下ほど広い）
  addiu t6, t6, -1
  bnez t6, @r
  addiu t5, t5, 4
@none:
  jr ra
  nop

; マリンスノー: 深さとともに上下に流れる白い粒（加算の 1 点）
snowinit:
  move t9, ra
  la t8, snowp
  li t7, NSNOW
@si:
  jal rand
  nop
  andi t0, v0, 0x1fff        ; x ×16（0〜511）→ −160〜
  addiu t0, t0, -2560
  sw t0, 0(t8)
  srl t0, v0, 16
  andi t0, t0, 0xfff         ; 深さ ×16（0〜255）
  sw t0, 4(t8)
  addiu t7, t7, -1
  bnez t7, @si
  addiu t8, t8, 8
  jr t9
  nop
snow:
  la t8, snowp
  li t7, NSNOW
  lw t6, V_FD(gp)
  nop
  sra t6, t6, 4
@s:
  lw t0, 0(t8)
  nop
  addiu t0, t0, -5
  li t1, -2600
  slt t1, t0, t1
  beqz t1, @s1
  nop
  addiu t0, t0, 5200
@s1:
  sw t0, 0(t8)
  lw t1, 4(t8)
  nop
  subu t1, t1, t6
  sll t2, t1, 1
  addu t1, t1, t2            ; ×3
  sra t1, t1, 4
  addiu t1, t1, 128
  andi t1, t1, 255
  addiu t1, t1, -128         ; −128〜127 で折り返す
  sra t0, t0, 4
  li t2, 0x6a181c20          ; 1 点・加算
  sw t2, GP0(s7)
  sll t1, t1, 16
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t7, t7, -1
  bnez t7, @s
  addiu t8, t8, 8
  jr ra
  nop

; プランクトン: 青緑にまたたく点（3×3 のにじみ＋まん中の 1 点）
plkdraw:
  la t8, plk
  li t7, NPLK
  lw t6, V_FD(gp)
  nop
  sra t6, t6, 4
@p:
  lw t0, 8(t8)
  nop
  beqz t0, @pn
  nop
  lw t1, 4(t8)
  lw t0, 0(t8)
  subu t1, t1, t6
  sll t2, t1, 1
  addu t1, t1, t2
  sra t1, t1, 4              ; 画面の y
  addiu t2, t1, 124
  sltiu t2, t2, 248
  beqz t2, @pn
  nop
  sra t0, t0, 4
  ; またたき: 時刻と番号で明るさをかえる
  lw t3, V_T(gp)
  nop
  addu t3, t3, t7
  sll t3, t3, 3
  andi t3, t3, 0x3f
  addiu t3, t3, 0x30         ; 0x30〜0x6f
  sll t4, t3, 8
  sll t5, t3, 16
  or t4, t4, t5
  srl t5, t3, 2
  or t4, t4, t5              ; 0x00 t t t/4（青緑）
  li t5, 0x62000000
  or t5, t5, t4
  sw t5, GP0(s7)             ; にじみ 3×3（加算）
  addiu t2, t1, -1
  sll t2, t2, 16
  addiu t5, t0, -1
  andi t5, t5, 0xffff
  or t2, t2, t5
  sw t2, GP0(s7)
  li t5, 0x00030003
  sw t5, GP0(s7)
  li t5, 0x6a60f0c0          ; まん中の 1 点
  sw t5, GP0(s7)
  sll t2, t1, 16
  andi t5, t0, 0xffff
  or t2, t2, t5
  sw t2, GP0(s7)
@pn:
  addiu t7, t7, -1
  bnez t7, @p
  addiu t8, t8, 12
  jr ra
  nop

; 捕食者（横の画面）: 下の暗がりから上がる、細長いデメニギスのなかまのシルエット。目は上を向いた筒の、淡い輪
predside:
  lw t0, V_EYE(gp)
  nop
  blez t0, @ps
  nop
  srl t0, t0, 1
  li t1, 178
  subu t9, t1, t0            ; 体の y（178 → 58）
  ; 体: 細長い魚の形（predshape の点を、まん中 (−40, y) から扇に）。色は下のふちの水より暗く
  lw a0, V_IBOT(gp)
  move t8, ra
  srl a0, a0, 2
  jal palc
  nop
  move ra, t8
  li t0, 0x20000000
  or t7, v0, t0
  la t6, predshape
  li t5, 15
@pf:
  sw t7, GP0(s7)
  sll t0, t9, 16
  li t1, 0xffce              ; まん中 x = −50
  or t0, t0, t1
  sw t0, GP0(s7)
  lh t0, 0(t6)
  lh t1, 2(t6)
  addiu t0, t0, -40
  addu t1, t1, t9
  sll t1, t1, 16
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  lh t0, 4(t6)
  lh t1, 6(t6)
  addiu t0, t0, -40
  addu t1, t1, t9
  sll t1, t1, 16
  andi t0, t0, 0xffff
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t5, t5, -1
  bnez t5, @pf
  addiu t6, t6, 4
  ; 目: 上を向いた淡い輪（光るのではなく、上の光を映す）
  li a1, 0
  addiu a2, t9, -14
  li a3, 5
  move t8, ra
  jal ring
  nop
  move ra, t8
@ps:
  jr ra
  nop

; 輪（線をつなぐ 9 点）: a1 = x, a2 = y, a3 = 半径。色は疑いの強さ（V_SUS）で淡い灰 → 白
ring:
  lw t0, V_SUS(gp)
  nop
  addiu t0, t0, 96
  slti t1, t0, 256
  bnez t1, @g1
  nop
  li t0, 255
@g1:
  sll t1, t0, 8
  or t1, t1, t0
  sll t1, t1, 8
  or t1, t1, t0
  li t2, 0x48000000
  or t1, t1, t2
  sw t1, GP0(s7)
  la t3, sintab
  li t4, 0
@rg:
  sll t5, t4, 5              ; 角度 = k × 32
  andi t5, t5, 255
  sll t5, t5, 2
  addu t6, t3, t5
  lw t6, 0(t6)               ; sin
  addiu t5, t5, 256          ; +64 の角度（×4）
  andi t5, t5, 1023
  addu t7, t3, t5
  lw t7, 0(t7)               ; cos
  mult t6, a3
  mflo t6
  sra t6, t6, 12
  addu t6, t6, a2
  mult t7, a3
  mflo t7
  sra t7, t7, 12
  addu t7, t7, a1
  sll t6, t6, 16
  andi t7, t7, 0xffff
  or t6, t6, t7
  sw t6, GP0(s7)
  addiu t4, t4, 1
  slti t5, t4, 9
  bnez t5, @rg
  nop
  li t0, 0x55555555
  sw t0, GP0(s7)
  jr ra
  nop

; 見上げた画面の光の円（まん中が魚の所の光、ふちが半分）
disc:
  addiu sp, sp, -8
  sw ra, 0(sp)
  li a0, 200
  jal palc
  nop
  move t9, v0                ; まん中の色
  li a0, 132
  jal palc
  nop
  move t8, v0                ; ふちの色
  la t3, sintab
  li t4, 0
@d:
  li t0, 0x30000000          ; グーローの三角形
  or t0, t0, t9
  sw t0, GP0(s7)
  li t0, 0xfff60000          ; まん中 (0,−10)
  sw t0, GP0(s7)
  move a1, t4
  bal @pt
  nop
  addiu a1, t4, 1
  bal @pt
  nop
  addiu t4, t4, 1
  slti t0, t4, 16
  bnez t0, @d
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop
@pt:                          ; a1 = 番号 → 色と点（だ円 150×110）を送る
  sw t8, GP0(s7)
  sll t5, a1, 4
  andi t5, t5, 255
  sll t5, t5, 2
  addu t6, t3, t5
  lw t6, 0(t6)
  addiu t5, t5, 256
  andi t5, t5, 1023
  addu t7, t3, t5
  lw t7, 0(t7)
  li t0, 110
  mult t6, t0
  mflo t6
  sra t6, t6, 12
  addiu t6, t6, -10
  li t0, 150
  mult t7, t0
  mflo t7
  sra t7, t7, 12
  sll t6, t6, 16
  andi t7, t7, 0xffff
  or t6, t6, t7
  sw t6, GP0(s7)
  jr ra
  nop

; 見上げた画面の捕食者: 下のふちに、上を向いた2つの目の輪（疑いで大きく白く）
predup:
  move t9, ra
  lw t0, V_SUS(gp)
  nop
  srl t0, t0, 4
  addiu a3, t0, 8            ; 半径 8〜18
  li a1, -60
  li a2, 92
  jal ring
  nop
  lw t0, V_SUS(gp)
  nop
  srl t0, t0, 4
  addiu a3, t0, 8
  li a1, 60
  li a2, 92
  jal ring
  nop
  jr t9
  nop

; ---- 字（5×7 のドット字。V_SCL 倍） ----
; a0 = 字の番号の列（0xff で終わり・0xfe はすきま）、a1 = x、a2 = y、a3 = 色
text:
  lw t9, V_SCL(gp)
  li t0, 0x60000000
  or a3, a3, t0              ; 四角（大きさは語で）
  sll t8, t9, 16
  or t8, t8, t9              ; 大きさの語
@ch:
  lbu t0, 0(a0)
  nop
  li t1, 0xff
  beq t0, t1, @done
  nop
  li t1, 0xfe
  beq t0, t1, @adv
  nop
  la t1, font
  sll t2, t0, 3
  subu t2, t2, t0            ; ×7
  addu t1, t1, t2
  move t2, a2                ; 行の y
  li t3, 7
@row:
  lbu t4, 0(t1)
  move t5, a1                ; 列の x
  li t6, 16
@col:
  and t7, t4, t6
  beqz t7, @off
  nop
  sw a3, GP0(s7)
  sll t7, t2, 16
  andi v1, t5, 0xffff
  or t7, t7, v1
  sw t7, GP0(s7)
  sw t8, GP0(s7)
@off:
  addu t5, t5, t9
  srl t6, t6, 1
  bnez t6, @col
  nop
  addu t2, t2, t9
  addiu t3, t3, -1
  bnez t3, @row
  addiu t1, t1, 1
@adv:
  sll t0, t9, 2
  addu t0, t0, t9
  addu t0, t0, t9            ; 6 × 大きさ
  addu a1, a1, t0
  b @ch
  addiu a0, a0, 1
@done:
  jr ra
  nop

; a0 = 数 → 字の番号の列を numbuf に作って text へ（a1・a2・a3 はそのまま）
num:
  la t0, numbuf + 7
  li t1, 0xff
  sb t1, 0(t0)
  li t2, 10
@n:
  divu a0, t2
  mfhi t3
  mflo a0
  addiu t0, t0, -1
  bnez a0, @n
  sb t3, 0(t0)
  b text
  move a0, t0

; 左上: 食べた数・命・エネルギー。右上: 1日の時計。右下: 深さ
hud:
  addiu sp, sp, -8
  sw ra, 0(sp)
  li t0, 0x62506010          ; プランクトンの印
  sw t0, GP0(s7)
  li t0, 0xff92ff6c          ; (−148,−110)
  sw t0, GP0(s7)
  li t0, 0x00050005
  sw t0, GP0(s7)
  lw a0, V_CNT(gp)
  li a1, -138
  li a2, -114
  li a3, 0x00e8e0d8
  jal num
  nop
  ; 命（小さな銀のひし形）
  lw t9, V_LIVES(gp)
  li t8, -150
@lv:
  blez t9, @lvd
  nop
  li t0, 0x28c8c0b8
  sw t0, GP0(s7)
  li t1, 0xff9e0000          ; y = −98
  addiu t2, t8, 3
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa10000          ; y = −95
  andi t2, t8, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  addiu t2, t8, 7
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  li t1, 0xffa40000
  addiu t2, t8, 3
  andi t2, t2, 0xffff
  or t2, t2, t1
  sw t2, GP0(s7)
  addiu t9, t9, -1
  b @lv
  addiu t8, t8, 10
@lvd:
  ; エネルギー（8 つの目もり）
  lw t9, V_E(gp)
  li t8, 0
@eg:
  sll t0, t8, 11             ; 目もり 1 つ = 2048
  slt t0, t0, t9
  li t1, 0x60302820          ; 消えた目もり（暗い）
  beqz t0, @ed
  nop
  li t1, 0x60c0d040          ; ついた目もり（腹の光の色）
@ed:
  sw t1, GP0(s7)
  sll t0, t8, 3
  subu t0, t0, t8            ; ×7
  addiu t0, t0, -150
  andi t0, t0, 0xffff
  li t1, 0xffaa0000          ; y = −86
  or t0, t0, t1
  sw t0, GP0(s7)
  li t0, 0x00030005
  sw t0, GP0(s7)
  addiu t8, t8, 1
  slti t0, t8, 8
  bnez t0, @eg
  nop
  ; 1日の時計: 弧の上を、昼は太陽・夜は月の点が左から右へ
  li a1, 128
  li a2, -100
  li a3, 18
  li t0, 0x00303438
  sw t0, V_DIM(gp)
  jal arc
  nop
  lw t0, V_T(gp)             ; 角度 = T × 128 / DAY（0 → 128 で半周）
  li t1, 128
  mult t0, t1
  mflo t0
  li t1, DAY
  div t0, t1
  mflo t0
  la t3, sintab
  sll t0, t0, 2
  addu t4, t3, t0
  lw t4, 0(t4)               ; sin
  addiu t0, t0, 256
  andi t0, t0, 1023
  addu t5, t3, t0
  lw t5, 0(t5)               ; cos
  li t1, 18
  mult t4, t1
  mflo t4
  sra t4, t4, 12
  li t6, -100
  subu t4, t6, t4            ; y = cy − sin×r
  mult t5, t1
  mflo t5
  sra t5, t5, 12
  li t6, 128
  subu t5, t6, t5            ; x = cx − cos×r
  lw t6, V_SKY(gp)
  li t0, 0x6070e0f0          ; 太陽（黄）
  slti t6, t6, 240
  beqz t6, @sun
  nop
  li t0, 0x60e0d8c8          ; 月（白）
@sun:
  sw t0, GP0(s7)
  addiu t4, t4, -2
  addiu t5, t5, -2
  sll t4, t4, 16
  andi t5, t5, 0xffff
  or t4, t4, t5
  sw t4, GP0(s7)
  li t0, 0x00050005
  sw t0, GP0(s7)
  ; 深さ（m）
  lw a0, V_FD(gp)
  nop
  sra a0, a0, 8
  sll a0, a0, 2
  li a1, 96
  li a2, 100
  li a3, 0x00a8b0b8
  jal num
  nop
  la a0, s_m
  li a1, 140
  li a2, 100
  li a3, 0x00a8b0b8
  jal text
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 半円の弧（上半分）: a1 = x、a2 = y、a3 = 半径、色は V_DIM
arc:
  lw t0, V_DIM(gp)
  li t1, 0x48000000
  or t0, t0, t1
  sw t0, GP0(s7)
  la t3, sintab
  li t4, 0
@a:
  sll t5, t4, 4              ; 0〜128 を 16 ずつ
  sll t5, t5, 2
  addu t6, t3, t5
  lw t6, 0(t6)
  addiu t5, t5, 256
  andi t5, t5, 1023
  addu t7, t3, t5
  lw t7, 0(t7)
  mult t6, a3
  mflo t6
  sra t6, t6, 12
  subu t6, a2, t6
  mult t7, a3
  mflo t7
  sra t7, t7, 12
  subu t7, a1, t7
  sll t6, t6, 16
  andi t7, t7, 0xffff
  or t6, t6, t7
  sw t6, GP0(s7)
  addiu t4, t4, 1
  slti t5, t4, 9
  bnez t5, @a
  nop
  li t0, 0x55555555
  sw t0, GP0(s7)
  jr ra
  nop

; タイトル: START がまたたく
titletext:
  lw t0, V_BLINK(gp)
  nop
  andi t0, t0, 32
  beqz t0, @tt
  nop
  la a0, s_start
  li a1, -30
  li a2, 76
  li a3, 0x00e8e0d8
  b text
  nop
@tt:
  jr ra
  nop

; おわり: 食べた数を大きく。START がまたたく
result:
  addiu sp, sp, -8
  sw ra, 0(sp)
  li t0, 0x62506010
  sw t0, GP0(s7)
  li t0, 0xffe8ffc0          ; (−64,−24)
  sw t0, GP0(s7)
  li t0, 0x000c000c
  sw t0, GP0(s7)
  li t0, 5
  sw t0, V_SCL(gp)
  lw a0, V_CNT(gp)
  li a1, -40
  li a2, -38
  li a3, 0x00f0e8e0
  jal num
  nop
  li t0, 2
  sw t0, V_SCL(gp)
  jal titletext
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 字の列（番号: 0〜9・A10 B11 S12 T13 R14 m15 ^16 v17・すきま 0xfe・終わり 0xff）
s_start: .byte 12, 13, 10, 14, 13, 0xff
s_hint:  .byte 10, 16, 0xfe, 0xfe, 11, 17, 0xff
s_m:     .byte 15, 0xff
.align 4
; 光の筋: 上の x と幅
raytab:  .half -120, 22, -40, 30, 50, 18
; 捕食者（デメニギスのなかま）の形: まわりの点（頭が右、目は頭の上で上を向く）。最初の点を最後にもくり返す
predshape:
  .half 60, 0, 52, -6, 40, -12, 20, -9, -20, -7, -60, -5, -90, -3, -106, -13
  .half -100, 0, -106, 13, -90, 3, -60, 6, -20, 9, 20, 10, 44, 8, 60, 0
