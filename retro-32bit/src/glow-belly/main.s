; ムネエソの腹あかり（仮）— 32ビット互換機のオリジナル（PLAN.md 5章）
;   main.s = はじめ・1こまの流れ・遊びの決まり。draw.s = 水・光・プランクトン・捕食者・字。fish.s = 行列とムネエソ
;   レジスタの約束: s7 = I/O、gp = 変数、s6 = いま描く側（0 上・1 下）。サブルーチンは t・a・v をこわしてよい
;   遅延スロットとロードの遅れは自分で nop を入れる（ロードのつぎの1命令ではその値を使わない）

IO     = 0x1f801000
GP0    = 0x810
GP1    = 0x814
ISTAT  = 0x070
D2MADR = 0x0a0
D2BCR  = 0x0a4
D2CHCR = 0x0a8
D6MADR = 0x0e0
D6BCR  = 0x0e4
D6CHCR = 0x0e8
DPCR   = 0x0f0
JDATA  = 0x040
JSTAT  = 0x044
JCTRL  = 0x04a
OTN    = 256

; ボタン（pad.js の BTN）
B_UP    = 0x0010
B_RIGHT = 0x0020
B_DOWN  = 0x0040
B_LEFT  = 0x0080
B_START = 0x0008
B_A     = 0x2000
B_B     = 0x4000

; 変数（gp から）
V_T     = 0     ; 時刻（こま。0〜DAY）
V_FD    = 4     ; 魚の深さ（×256。1 = 4m）
V_VY    = 8     ; 上下の速さ
V_L16   = 12    ; 腹の光の段 ×16（0〜4080）
V_E     = 16    ; エネルギー ×4（0〜16380）
V_PST   = 20    ; 捕食者: 0 いない・1 上がる・2 見る・3 沈む・4 見つかった
V_PT    = 24    ; 捕食者のタイマー
V_SUS   = 28    ; 疑い（160 で見つかる）
V_TH    = 32    ; カメラのたおし（0 横 〜 64 真下から見上げる）
V_CNT   = 36    ; 食べた数
V_LIVES = 40
V_STATE = 44    ; 0 タイトル・1 遊ぶ・2 おわり
V_PAD   = 48
V_PREV  = 52
V_EDGE  = 56    ; このこまで押したボタン
V_RND   = 60
V_I     = 64    ; 魚のいる深さの光の段（0〜255）
V_FADE  = 68    ; 暗くする（0〜255）
V_LOOKS = 72    ; 見上げられた回数
V_BEST  = 76
V_SPN   = 80    ; プランクトンが出るまで
V_EYE   = 84    ; 捕食者の上がりぐあい（0〜240）
V_FLASH = 88    ; 食べたときの光
V_SCL   = 92    ; 字の大きさ（ドット 1 つの点の数）
V_SKY   = 96    ; 空の明るさの段
V_ITOP  = 100   ; 画面の上のふちの光
V_IBOT  = 104   ; 下のふち
V_BLINK = 108
V_TILT  = 112
V_DIM   = 116   ; 弧の色
V_KL    = 120   ; 魚の光の強さ（面の向き × これ）
V_AMB   = 124   ; 魚のまわりの光
V_BASE  = 128   ; 見上げた光の円の色（昼は青・夜は寒い青）
V_RIM   = 132   ; blob のふちの色
V_CMD   = 136   ; blob の命令（0x32 加算・0x30 不透明）
V_HUMON = 140   ; 腹の光の音が鳴っている
V_WOOSH = 144   ; 捕食者のうねりが鳴っている
V_THUMP = 148   ; つぎの鼓動まで
V_EVT   = 152   ; 音の合図（sound.s の EV_〜）

DIE_SUS = 160
LOOKUP  = 48    ; 見上げるカメラのたおし（64 で真下。48 ≒ 67° でななめ下から＝魚の形と腹の点が見える）
TOL     = 12    ; 合っている幅（段。12 段 ≒ 3 倍）
FD_MIN  = 25 * 256   ; 100m
FD_MAX  = 175 * 256  ; 700m
NPLK    = 24
NSNOW   = 40

.org 0x80010000
start:
  li s7, IO
  la gp, vars
  sw zero, GP1(s7)
  li t0, 0x08000001          ; 320×240・15 ビット
  sw t0, GP1(s7)
  li t0, 0x06c60260
  sw t0, GP1(s7)
  li t0, 0x07042018
  sw t0, GP1(s7)
  li t0, 0x04000002
  sw t0, GP1(s7)
  li t0, 0x03000000
  sw t0, GP1(s7)
  lw t0, DPCR(s7)
  li t1, 0x08000800
  or t0, t0, t1
  sw t0, DPCR(s7)
  li t0, 0x12345679
  sw t0, V_RND(gp)
  li t0, 2
  sw t0, V_SCL(gp)
  li t0, 0x32
  sw t0, V_CMD(gp)
  jal fishinit
  nop
  jal sndinit
  nop
  jal snowinit
  nop
  jal newgame
  nop
  sw zero, V_STATE(gp)       ; タイトルから
  li s6, 0

frame:
  jal begin
  nop
  jal readpad
  nop
  lw t0, V_BLINK(gp)
  nop
  addiu t0, t0, 1
  sw t0, V_BLINK(gp)
  lw t0, V_STATE(gp)
  nop
  beqz t0, @title
  nop
  li t1, 1
  beq t0, t1, @play
  nop
  ; ---- おわり: 食べた数を大きく。START か A で つぎの日 ----
  jal scene
  nop
  jal result
  nop
  lw t0, V_EDGE(gp)
  nop
  andi t0, t0, B_START | B_A
  beqz t0, @end
  nop
  jal newgame
  nop
  li t0, 1
  sw t0, V_STATE(gp)
  li t0, EV_START
  sw t0, V_EVT(gp)
  b @end
  nop
@title:
  ; ---- タイトル: 魚が泳ぐだけ。START か A ではじまる ----
  lw t0, V_T(gp)
  nop
  addiu t0, t0, 1            ; 時刻だけ進めて、泳いで見せる（光は午後のまま）
  andi t0, t0, 1023
  sw t0, V_T(gp)
  la t1, sintab              ; 腹の光: 4 秒で光って消える
  sll t2, t0, 1
  andi t2, t2, 255
  sll t2, t2, 2
  addu t1, t1, t2
  lw t1, 0(t1)
  nop
  addiu t1, t1, 4096
  srl t1, t1, 2              ; 0〜2048
  sw t1, V_L16(gp)
  jal light
  nop
  jal plankton
  nop
  jal scene
  nop
  jal titletext
  nop
  lw t0, V_EDGE(gp)
  nop
  andi t0, t0, B_START | B_A
  beqz t0, @end
  nop
  jal newgame
  nop
  li t0, 1
  sw t0, V_STATE(gp)
  li t0, EV_START
  sw t0, V_EVT(gp)
  b @end
  nop
@play:
  jal update
  nop
  jal scene
  nop
  jal hud
  nop
@end:
  jal sndframe
  nop
  j frame
  nop

; ---- あたらしい日 ----
newgame:
  sw zero, V_T(gp)
  li t0, 120 * 256           ; 480m からはじめる（午後。昼の深さ）
  sw t0, V_FD(gp)
  sw zero, V_VY(gp)
  sw zero, V_L16(gp)
  li t0, 16380
  sw t0, V_E(gp)
  sw zero, V_PST(gp)
  li t0, 300                 ; はじめの見上げは 5 秒後
  sw t0, V_PT(gp)
  sw zero, V_SUS(gp)
  sw zero, V_TH(gp)
  sw zero, V_CNT(gp)
  li t0, 3
  sw t0, V_LIVES(gp)
  sw zero, V_FADE(gp)
  sw zero, V_LOOKS(gp)
  sw zero, V_SPN(gp)
  sw zero, V_EYE(gp)
  sw zero, V_FLASH(gp)
  la t0, plk                 ; プランクトンを空に
  li t1, NPLK
@clr:
  sw zero, 8(t0)
  addiu t1, t1, -1
  bnez t1, @clr
  addiu t0, t0, 12
  jr ra
  nop

; ---- 1こまの決まり ----
update:
  addiu sp, sp, -8
  sw ra, 0(sp)
  ; 時刻。朝になったらおわり
  lw t0, V_T(gp)
  nop
  addiu t0, t0, 1
  sw t0, V_T(gp)
  slti t1, t0, DAY
  bnez t1, @day
  nop
  jal finish
  nop
@day:
  lw t0, V_PST(gp)
  li t1, 4
  beq t0, t1, @noinput       ; 見つかって暗くなる間は動けない
  nop
  ; 浮く・沈む（押している間はその向きへ速く、はなすとゆっくり止まる）
  lw s0, V_PAD(gp)
  li t2, 0
  andi t1, s0, B_UP
  beqz t1, @nu
  nop
  li t2, -0x70
@nu:
  andi t1, s0, B_DOWN
  beqz t1, @nd
  nop
  li t2, 0x70
@nd:
  lw t3, V_VY(gp)
  nop
  subu t4, t2, t3            ; 速さを目標へ 1/8 ずつ
  sra t4, t4, 3
  addu t3, t3, t4
  sw t3, V_VY(gp)
  lw t0, V_FD(gp)
  nop
  addu t0, t0, t3
  li t1, FD_MIN
  slt t2, t0, t1
  beqz t2, @fd1
  nop
  move t0, t1
@fd1:
  li t1, FD_MAX
  slt t2, t1, t0
  beqz t2, @fd2
  nop
  move t0, t1
@fd2:
  sw t0, V_FD(gp)
  ; 腹の光: A で強く・B で弱く
  lw t0, V_L16(gp)
  andi t1, s0, B_A
  beqz t1, @na
  nop
  addiu t0, t0, 64
@na:
  andi t1, s0, B_B
  beqz t1, @nb
  nop
  addiu t0, t0, -64
@nb:
  bgez t0, @l1
  nop
  li t0, 0
@l1:
  slti t1, t0, 4081
  bnez t1, @l2
  nop
  li t0, 4080
@l2:
  lw t1, V_E(gp)
  nop
  bnez t1, @l3               ; エネルギーがなければ光は消える
  nop
  li t0, 0
@l3:
  sw t0, V_L16(gp)
@noinput:
  jal light
  nop
  ; エネルギー: 光の段の表（4 倍）だけ減る
  lw t0, V_L16(gp)
  la t1, cost
  srl t0, t0, 4
  sll t0, t0, 1
  addu t1, t1, t0
  lhu t1, 0(t1)
  lw t2, V_E(gp)
  nop
  subu t2, t2, t1
  bgez t2, @e1
  nop
  li t2, 0
@e1:
  sw t2, V_E(gp)
  jal predator
  nop
  jal plankton
  nop
  ; カメラ: 見上げられている間は真下へ、ほかは横へ
  lw t0, V_PST(gp)
  lw t1, V_PT(gp)
  li t2, 0                   ; 目標
  li t3, 1
  bne t0, t3, @c1
  nop
  slti t3, t1, 30            ; 上がりきる 0.5 秒前から回りこむ
  beqz t3, @c2
  nop
  li t2, LOOKUP
  b @c2
  nop
@c1:
  li t3, 2
  bne t0, t3, @c2
  nop
  li t2, LOOKUP
@c2:
  lw t0, V_TH(gp)
  nop
  slt t3, t0, t2
  beqz t3, @c3
  nop
  addiu t0, t0, 3
  slt t3, t2, t0
  beqz t3, @c4
  nop
  move t0, t2
  b @c4
  nop
@c3:
  slt t3, t2, t0
  beqz t3, @c4
  nop
  addiu t0, t0, -4
  bgez t0, @c4
  nop
  li t0, 0
@c4:
  sw t0, V_TH(gp)
  lw t0, V_FLASH(gp)
  nop
  blez t0, @f1
  nop
  addiu t0, t0, -1
  sw t0, V_FLASH(gp)
@f1:
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; 光の段: 空（時刻）− 深さ × 4/3。魚の所・画面の上と下のふち（± 40 = ±160m）
light:
  lw t0, V_T(gp)
  la t1, sky
  srl t0, t0, 6
  sll t0, t0, 1
  addu t1, t1, t0
  lh t2, 0(t1)
  lw t3, V_FD(gp)
  sw t2, V_SKY(gp)
  sra t3, t3, 8
  move a2, ra
  move a0, t3
  bal @lv
  nop
  sw v0, V_I(gp)
  addiu a0, t3, -40
  bal @lv
  nop
  sw v0, V_ITOP(gp)
  addiu a0, t3, 40
  bal @lv
  nop
  sw v0, V_IBOT(gp)
  jr a2
  nop
@lv:                          ; a0 = 深さ → v0 = 段（0〜255）
  sll v0, a0, 2
  li t4, 3
  div v0, t4
  mflo v0
  subu v0, t2, v0
  bgez v0, @lv1
  nop
  li v0, 0
@lv1:
  slti t4, v0, 256
  bnez t4, @lv2
  nop
  li v0, 255
@lv2:
  jr ra
  nop

; ---- 捕食者（下から見上げる） ----
predator:
  lw t0, V_PST(gp)
  lw t1, V_PT(gp)
  nop
  addiu t1, t1, -1
  sw t1, V_PT(gp)
  beqz t0, @idle
  nop
  li t2, 1
  beq t0, t2, @rise
  nop
  li t2, 2
  beq t0, t2, @watch
  nop
  li t2, 3
  beq t0, t2, @sink
  nop
  ; 4: 見つかった。画面を暗くして、命を1つ
  lw t2, V_FADE(gp)
  nop
  addiu t2, t2, 6
  slti t3, t2, 256
  bnez t3, @fd
  nop
  li t2, 255
@fd:
  sw t2, V_FADE(gp)
  bgtz t1, @pr
  nop
  lw t2, V_LIVES(gp)
  nop
  addiu t2, t2, -1
  sw t2, V_LIVES(gp)
  sw zero, V_PST(gp)
  li t3, 300
  sw t3, V_PT(gp)
  sw zero, V_TH(gp)
  sw zero, V_EYE(gp)
  sw zero, V_SUS(gp)
  sw zero, V_FADE(gp)
  sw zero, V_L16(gp)
  bgtz t2, @pr
  nop
  move t9, ra                ; 命がなくなった: おわり（腹をともす）
  jal finish
  nop
  move ra, t9
  b @pr
  nop
@idle:
  bgtz t1, @pr
  nop
  li t2, 1
  sw t2, V_PST(gp)
  lw t2, V_LOOKS(gp)
  nop
  addiu t2, t2, 1
  sw t2, V_LOOKS(gp)
  li t3, 60                  ; 上がるのは 1 秒（はじめの1回は 2 秒）
  li t4, 1
  bne t2, t4, @r0
  nop
  li t3, 120
@r0:
  sw t3, V_PT(gp)
  b @pr
  nop
@rise:
  lw t2, V_EYE(gp)
  nop
  addiu t2, t2, 4
  slti t3, t2, 241
  bnez t3, @r1
  nop
  li t2, 240
@r1:
  sw t2, V_EYE(gp)
  bgtz t1, @pr
  nop
  li t2, 2
  sw t2, V_PST(gp)
  li t2, 150                 ; 見るのは 2.5 秒
  sw t2, V_PT(gp)
  sw zero, V_SUS(gp)
  b @pr
  nop
@watch:
  ; はずれ = |L − I|。幅をこえた分だけ疑いがふえる。合っていれば減る
  lw t2, V_L16(gp)
  lw t3, V_I(gp)
  srl t2, t2, 4
  subu t2, t2, t3
  bgez t2, @w1
  nop
  subu t2, zero, t2
@w1:
  lw t4, V_SUS(gp)
  addiu t2, t2, -TOL
  bgtz t2, @w2
  nop
  addiu t4, t4, -2
  bgez t4, @w4
  nop
  li t4, 0
  b @w4
  nop
@w2:
  srl t2, t2, 5              ; 疑い += 1 + はずれ/32（ゆっくり。押しはじめるのがおくれても間に合う幅）
  addiu t2, t2, 1
  lw t3, V_LOOKS(gp)         ; はじめの1回はゆっくり
  li t5, 1
  bne t3, t5, @w3
  nop
  srl t2, t2, 2
  addiu t2, t2, 1
@w3:
  addu t4, t4, t2
  lw t3, V_LOOKS(gp)         ; はじめの1回は練習: 見つかる手前で止める（A の案内と影の変わり方で覚える）
  li t5, 1
  bne t3, t5, @w4
  nop
  slti t3, t4, DIE_SUS - 8
  bnez t3, @w4
  nop
  li t4, DIE_SUS - 8
@w4:
  sw t4, V_SUS(gp)
  slti t3, t4, DIE_SUS
  bnez t3, @w5
  nop
  li t2, 4                   ; 見つかった
  sw t2, V_PST(gp)
  lw t2, V_EVT(gp)
  nop
  ori t2, t2, EV_CAUGHT
  sw t2, V_EVT(gp)
  li t2, 60
  sw t2, V_PT(gp)
  b @pr
  nop
@w5:
  bgtz t1, @pr
  nop
  li t2, 3
  sw t2, V_PST(gp)
  li t2, 40
  sw t2, V_PT(gp)
  b @pr
  nop
@sink:
  lw t2, V_EYE(gp)
  nop
  addiu t2, t2, -6
  bgez t2, @s1
  nop
  li t2, 0
@s1:
  sw t2, V_EYE(gp)
  lw t3, V_SUS(gp)           ; 疑いも引いていく
  nop
  srl t3, t3, 1
  sw t3, V_SUS(gp)
  bgtz t1, @pr
  nop
  sw zero, V_PST(gp)
  move t9, ra                ; つぎまで 6〜10 秒
  jal rand
  nop
  move ra, t9
  andi v0, v0, 255
  addiu v0, v0, 360
  sw v0, V_PT(gp)
@pr:
  jr ra
  nop

; ---- プランクトン: 右から流れてくる。魚にふれると食べる ----
plankton:
  addiu sp, sp, -8
  sw ra, 0(sp)
  lw t0, V_SPN(gp)
  nop
  addiu t0, t0, -1
  bgtz t0, @nospawn
  nop
  ; 空いている所をさがす
  la t1, plk
  li t2, NPLK
@find:
  lw t3, 8(t1)
  nop
  beqz t3, @got
  nop
  addiu t2, t2, -1
  bnez t2, @find
  addiu t1, t1, 12
  b @setspn
  nop
@got:
  move t8, t1
  jal rand
  nop
  li t3, 180 * 16
  sw t3, 0(t8)               ; x（×16）
  andi t4, v0, 63
  lw t5, V_SKY(gp)
  la t6, spawnday
  slti t5, t5, 240           ; 空が暗ければ夜の表
  beqz t5, @sd
  nop
  la t6, spawnnight
@sd:
  addu t6, t6, t4
  lbu t4, 0(t6)
  srl t5, v0, 8              ; 少しずらす
  andi t5, t5, 15
  sll t4, t4, 4
  addu t4, t4, t5
  sw t4, 4(t8)               ; 深さ（×16）
  li t3, 1
  sw t3, 8(t8)
@setspn:
  lw t5, V_SKY(gp)
  li t0, 34                  ; 昼はまばら
  slti t5, t5, 240
  beqz t5, @nospawn
  nop
  li t0, 14                  ; 夜は多い
@nospawn:
  sw t0, V_SPN(gp)
  ; 流す・食べる
  la t1, plk
  li t2, NPLK
  lw t7, V_FD(gp)
  nop
  sra t7, t7, 4              ; 魚の深さ ×16
@mv:
  lw t3, 8(t1)
  nop
  beqz t3, @next
  nop
  lw t3, 0(t1)
  nop
  addiu t3, t3, -12
  sw t3, 0(t1)
  li t4, -180 * 16
  slt t4, t3, t4
  beqz t4, @in
  nop
  sw zero, 8(t1)
  b @next
  nop
@in:
  lw t4, V_STATE(gp)         ; タイトルでは食べない
  nop
  beqz t4, @next
  nop
  lw t4, V_PST(gp)           ; 見つかって暗い間も食べない
  li t5, 4
  beq t4, t5, @next
  nop
  sra t3, t3, 4              ; 画面の x
  addiu t3, t3, 40           ; 魚は x = −40
  bgez t3, @ax
  nop
  subu t3, zero, t3
@ax:
  slti t3, t3, 30
  beqz t3, @next
  nop
  lw t4, 4(t1)
  nop
  subu t4, t4, t7            ; 深さの差（×16）→ 画面では ×3
  bgez t4, @ay
  nop
  subu t4, zero, t4
@ay:
  slti t4, t4, 7 * 16        ; ±7（画面で ±21）
  beqz t4, @next
  nop
  sw zero, 8(t1)             ; 食べた
  lw t4, V_CNT(gp)
  nop
  addiu t4, t4, 1
  sw t4, V_CNT(gp)
  lw t4, V_E(gp)
  nop
  addiu t4, t4, 1600         ; エネルギー +400（4 倍で持つ）
  slti t5, t4, 16381
  bnez t5, @e2
  nop
  li t4, 16380
@e2:
  sw t4, V_E(gp)
  li t4, 12
  sw t4, V_FLASH(gp)
  lw t4, V_EVT(gp)
  nop
  ori t4, t4, EV_EAT
  sw t4, V_EVT(gp)
@next:
  addiu t2, t2, -1
  bnez t2, @mv
  addiu t1, t1, 12
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; おわり: 腹をともし、カメラを横へ（おわりの画面のごほうびの絵）
finish:
  li t0, 2
  sw t0, V_STATE(gp)
  li t0, 2400
  sw t0, V_L16(gp)
  sw zero, V_TH(gp)
  sw zero, V_EYE(gp)
  sw zero, V_PST(gp)
  sw zero, V_FADE(gp)
  jr ra
  nop

; 乱数（xorshift）→ v0
rand:
  lw v0, V_RND(gp)
  nop
  sll t0, v0, 13
  xor v0, v0, t0
  srl t0, v0, 17
  xor v0, v0, t0
  sll t0, v0, 5
  xor v0, v0, t0
  jr ra
  sw v0, V_RND(gp)

; ---- 垂直帰線を待ち、描きおえた側を見せ、反対側に描く準備 ----
begin:
@wait:
  lw t0, ISTAT(s7)
  nop
  andi t0, t0, 1
  beqz t0, @wait
  nop
  li t0, -2
  sw t0, ISTAT(s7)
  sll t1, s6, 18
  li t0, 0x05000000
  or t0, t0, t1
  sw t0, GP1(s7)
  xori s6, s6, 1
  sll t2, s6, 8
  sll t1, t2, 10
  li t0, 0xe3000000
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t1, t2, 239
  sll t1, t1, 10
  ori t1, t1, 319
  li t0, 0xe4000000
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t1, t2, 120
  sll t1, t1, 11
  ori t1, t1, 160
  li t0, 0xe5000000
  or t0, t0, t1
  sw t0, GP0(s7)
  li t0, 0xe1000620          ; ディザ・加算の半透明
  sw t0, GP0(s7)
  jr ra
  nop

; パッド（口 1）→ V_PAD・V_EDGE（このこまで押したもの）
readpad:
  move t8, ra
  li t0, 0x0003
  sh t0, JCTRL(s7)
  li a0, 0x01
  bal @xfer
  nop
  li a0, 0x42
  bal @xfer
  nop
  li a0, 0
  bal @xfer
  nop
  li a0, 0
  bal @xfer
  nop
  move t5, v0
  li a0, 0
  bal @xfer
  nop
  sh zero, JCTRL(s7)
  sll v0, v0, 8
  or v0, v0, t5
  not v0, v0
  andi v0, v0, 0xffff
  lw t1, V_PAD(gp)
  sw v0, V_PAD(gp)
  sw t1, V_PREV(gp)
  not t1, t1
  and t1, t1, v0
  jr t8
  sw t1, V_EDGE(gp)
@xfer:
  sb a0, JDATA(s7)
@w:
  lw t0, JSTAT(s7)
  nop
  andi t0, t0, 2
  beqz t0, @w
  nop
  lbu v0, JDATA(s7)
  jr ra
  nop
