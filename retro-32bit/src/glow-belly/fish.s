; ---- ムネエソ: 行列（GTE でかけ算）・形を GTE で投げて並べ表へ・腹の発光器（main.s のつづき） ----
;   ぬりは帯のグーロー（ART.md）: 面の向きと光の向きの内積（GTE）→ 光の強さ f → 頂点の色 × f（CPU）

; GTE の決まった設定（はじめに1回）
fishinit:
  ctc2 zero, 24              ; OFX・OFY = 0（まん中へは GPU の E5）
  ctc2 zero, 25
  li t0, 300
  ctc2 t0, 26                ; H
  li t0, 1365
  ctc2 t0, 29                ; ZSF3 = 1/3
  ; 光の向き（光のほうへ: 上と少し手前）。LLM の 1 行目だけ
  li t0, 0xf6660000          ; L11 = 0, L12 = −2458（上から）
  ctc2 t0, 8
  li t0, 0x0000f333          ; L13 = −3277（手前から。横腹の銀が光る）
  ctc2 t0, 9
  ctc2 zero, 10
  ctc2 zero, 11
  ctc2 zero, 12
  jr ra
  nop

; a0 = 角度 → t0 = sin・t1 = cos
sincos:
  la t2, sintab
  andi t0, a0, 255
  sll t0, t0, 2
  addu t0, t2, t0
  addiu t1, a0, 64
  andi t1, t1, 255
  sll t1, t1, 2
  addu t1, t2, t1
  lw t0, 0(t0)
  lw t1, 0(t1)
  jr ra
  nop
; Rx: [1 0 0; 0 c −s; 0 s c]（a0 = 角度、a1 = 出す所: 3×3 の 16 ビット）
rotx:
  move t9, ra
  jal sincos
  nop
  li t2, 4096
  sh t2, 0(a1)
  sh zero, 2(a1)
  sh zero, 4(a1)
  sh zero, 6(a1)
  sh t1, 8(a1)
  subu t2, zero, t0
  sh t2, 10(a1)
  sh zero, 12(a1)
  sh t0, 14(a1)
  jr t9
  sh t1, 16(a1)
; Ry: [c 0 s; 0 1 0; −s 0 c]
roty:
  move t9, ra
  jal sincos
  nop
  sh t1, 0(a1)
  sh zero, 2(a1)
  sh t0, 4(a1)
  sh zero, 6(a1)
  li t2, 4096
  sh t2, 8(a1)
  sh zero, 10(a1)
  subu t2, zero, t0
  sh t2, 12(a1)
  sh zero, 14(a1)
  jr t9
  sh t1, 16(a1)
; Rz: [c −s 0; s c 0; 0 0 1]
rotz:
  move t9, ra
  jal sincos
  nop
  sh t1, 0(a1)
  subu t2, zero, t0
  sh t2, 2(a1)
  sh zero, 4(a1)
  sh t0, 6(a1)
  sh t1, 8(a1)
  sh zero, 10(a1)
  sh zero, 12(a1)
  sh zero, 14(a1)
  li t2, 4096
  jr t9
  sh t2, 16(a1)

; a0 = 行列 → GTE の RT
setrt:
  lhu t0, 0(a0)
  lhu t1, 2(a0)
  lhu t2, 4(a0)
  lhu t3, 6(a0)
  sll t1, t1, 16
  or t0, t0, t1
  ctc2 t0, 0
  sll t3, t3, 16
  or t2, t2, t3
  ctc2 t2, 1
  lhu t0, 8(a0)
  lhu t1, 10(a0)
  lhu t2, 12(a0)
  lhu t3, 14(a0)
  sll t1, t1, 16
  or t0, t0, t1
  ctc2 t0, 2
  sll t3, t3, 16
  or t2, t2, t3
  ctc2 t2, 3
  lh t0, 16(a0)
  nop
  ctc2 t0, 4
  jr ra
  nop

; C = A × B（a0 = A、a1 = B、a2 = C）。GTE の MVMVA で B の列を1本ずつ回す
matmul:
  move t9, ra
  jal setrt
  nop
  li t4, 0
@col:
  sll t5, t4, 1
  addu t6, a1, t5
  lhu t0, 0(t6)              ; B[0][j]
  lh t1, 6(t6)               ; B[1][j]
  lh t2, 12(t6)              ; B[2][j]
  sll t1, t1, 16
  or t0, t0, t1
  mtc2 t0, 0
  mtc2 t2, 1
  nop
  cop2 0x0486012             ; MVMVA: RT × V0（sf）
  addu t7, a2, t5
  mfc2 t0, 9
  mfc2 t1, 10
  mfc2 t2, 11
  sh t0, 0(t7)
  sh t1, 6(t7)
  sh t2, 12(t7)
  addiu t4, t4, 1
  slti t0, t4, 3
  bnez t0, @col
  nop
  jr t9
  nop

; a0 = 色（0x00BBGGRR）、a1 = 強さ（4096 で 1）→ v0 = 色 × 強さ（255 で止める）。t5〜t7 をこわす
shade:
  li v0, 0
  li t7, 0
@ch:
  srlv t5, a0, t7
  andi t5, t5, 255
  mult t5, a1
  mflo t5
  sra t5, t5, 12
  slti t6, t5, 256
  bnez t6, @c1
  nop
  li t5, 255
@c1:
  sllv t5, t5, t7
  or v0, v0, t5
  addiu t7, t7, 8
  slti t6, t7, 24
  bnez t6, @ch
  nop
  jr ra
  nop

; ムネエソを描く。a0 = 1 なら見上げたシルエット（腹の光と上の光の差の色）
fishdraw:
  addiu sp, sp, -32
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
  sw s4, 20(sp)
  sw s5, 24(sp)
  move s3, a0
  ; 尾をふる（y のまわり）× 上下の向き（z のまわり）× カメラのたおし（x のまわり）
  lw t0, V_T(gp)
  la t1, sintab
  sll t2, t0, 2
  addu t2, t2, t0            ; ×5
  andi t2, t2, 255
  sll t2, t2, 2
  addu t1, t1, t2
  lw a0, 0(t1)
  nop
  sra a0, a0, 9              ; ±8
  la a1, mat_a
  jal roty
  nop
  lw a0, V_VY(gp)
  nop
  sra a0, a0, 4              ; 浮くとき頭が上
  la a1, mat_b
  jal rotz
  nop
  la a0, mat_b
  la a1, mat_a
  la a2, mat_c
  jal matmul
  nop
  lw a0, V_TH(gp)
  nop
  subu a0, zero, a0          ; 下から見上げる（腹がカメラへ）
  la a1, mat_a
  jal rotx
  nop
  la a0, mat_a
  la a1, mat_c
  la a2, mat_b
  jal matmul
  nop
  la a0, mat_b
  jal setrt
  nop
  ; ずらす: 横の画面では x = −56（画面で −40）、見上げる（LOOKUP）とまん中へ。タイトルでは寄る
  lw t0, V_TH(gp)
  li t1, LOOKUP
  subu t1, t1, t0
  bgez t1, @tx
  nop
  li t1, 0
@tx:
  li t2, -75                 ; −56/48 ≒ −75/64
  mult t1, t2
  mflo t1
  sra t1, t1, 6
  li t0, 420
  lw t2, V_STATE(gp)
  li t3, 1
  beq t2, t3, @far
  nop
  li t0, 290                 ; タイトル・おわり: 寄って大きく、まん中に
  li t1, 0
@far:
  ctc2 t1, 5
  ctc2 zero, 6
  ctc2 t0, 7
  ; 光の強さ: 魚の所の光が強いほど銀が明るい
  lw t0, V_I(gp)
  nop
  sll t1, t0, 4              ; ×16
  addiu t1, t1, 1600
  sw t1, V_KL(gp)
  sll t1, t0, 2              ; ×4
  addiu t1, t1, 700
  sw t1, V_AMB(gp)
  ; 並べ表を空に
  la t0, ot + (OTN - 1) * 4
  sw t0, D6MADR(s7)
  li t0, OTN
  sw t0, D6BCR(s7)
  li t0, 0x11000002
  sw t0, D6CHCR(s7)
  ; シルエットの色: 光の円の色 × k/16（k = 16 + (L − I)/2、0〜40）。合っていれば、魚のいるあたりの円の明るさとそろう
  lw t0, V_L16(gp)
  lw t1, V_I(gp)
  srl t0, t0, 4
  subu t0, t0, t1
  sra t0, t0, 1
  addiu t0, t0, 16
  bgez t0, @k1
  nop
  li t0, 0
@k1:
  slti t1, t0, 41
  bnez t1, @k2
  nop
  li t0, 40
@k2:
  sll a1, t0, 8              ; k × 256 = 4096 × k/16
  lw a0, V_BASE(gp)
  jal shade
  nop
  li t0, 0x30000000
  or s2, v0, t0
  la s0, ftri
  la s1, pkts
  li s5, NFTRI
@tri:
  la t9, fvtx
  lbu t0, 0(s0)
  lbu t1, 1(s0)
  lbu t2, 2(s0)
  sll t0, t0, 3
  addu t0, t9, t0
  sll t1, t1, 3
  addu t1, t9, t1
  sll t2, t2, 3
  addu t2, t9, t2
  lwc2 0, 0(t0)
  lwc2 1, 4(t0)
  lwc2 2, 0(t1)
  lwc2 3, 4(t1)
  lwc2 4, 0(t2)
  lwc2 5, 4(t2)
  nop
  cop2 0x0280030             ; RTPT
  nop
  cop2 0x1400006             ; NCLIP
  mfc2 t0, 24
  nop
  blez t0, @skip
  nop
  swc2 12, 8(s1)
  swc2 13, 16(s1)
  swc2 14, 24(s1)
  cop2 0x158002d             ; AVSZ3
  mfc2 s4, 7
  beqz s3, @lit
  nop
  sw s2, 4(s1)               ; シルエット（3 点とも同じ色）
  sw s2, 12(s1)
  b @col2
  sw s2, 20(s1)
@lit:
  lwc2 0, 4(s0)
  lwc2 1, 8(s0)
  nop
  cop2 0x0086012             ; MVMVA: RT × 面の向き
  nop
  cop2 0x00be412             ; MVMVA: LLM × IR（lm）→ IR1 = 光の向きとの内積
  nop
  mfc2 t0, 9
  lw t1, V_KL(gp)
  nop
  mult t0, t1
  mflo t0
  sra t0, t0, 12
  lw t1, V_AMB(gp)
  nop
  addu a1, t0, t1            ; 光の強さ f
  la t9, fcol
  lbu t0, 0(s0)
  nop
  sll t0, t0, 2
  addu t0, t9, t0
  lw a0, 0(t0)
  jal shade
  nop
  li t0, 0x30000000
  or v0, v0, t0
  sw v0, 4(s1)
  la t9, fcol
  lbu t0, 1(s0)
  nop
  sll t0, t0, 2
  addu t0, t9, t0
  lw a0, 0(t0)
  jal shade
  nop
  sw v0, 12(s1)
  la t9, fcol
  lbu t0, 2(s0)
  nop
  sll t0, t0, 2
  addu t0, t9, t0
  lw a0, 0(t0)
  jal shade
  nop
  sw v0, 20(s1)
@col2:
  srl t3, s4, 2
  slti t1, t3, OTN
  bnez t1, @ok
  nop
  li t3, OTN - 1
@ok:
  la t9, ot
  sll t3, t3, 2
  addu t3, t9, t3
  lw t1, 0(t3)
  li t2, 0x00ffffff
  and t1, t1, t2
  lui t4, 0x0600
  or t1, t1, t4
  sw t1, 0(s1)
  and t1, s1, t2
  sw t1, 0(t3)
  addiu s1, s1, 28
@skip:
  addiu s5, s5, -1
  bnez s5, @tri
  addiu s0, s0, 16
  ; 並べ表を GPU へ（奥から）
  la t0, ot + (OTN - 1) * 4
  sw t0, D2MADR(s7)
  sw zero, D2BCR(s7)
  li t0, 0x01000401
  sw t0, D2CHCR(s7)
@dma:
  lw t0, D2CHCR(s7)
  li t1, 0x01000000
  and t0, t0, t1
  bnez t0, @dma
  nop
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  lw s3, 16(sp)
  lw s4, 20(sp)
  lw s5, 24(sp)
  jr ra
  addiu sp, sp, 32

; 腹の発光器: 明るさ＝腹の光の段。消えているときは、くぼみ #23384a。光ると #7fe8ff へ、にじみ 5×5。
;   横の画面で光っていると、腹の下に淡い光を落とす
photodraw:
  lw t9, V_L16(gp)
  nop
  srl t9, t9, 4              ; 0〜255
  srl t0, t9, 1              ; R = L/2
  srl t1, t9, 4
  subu t1, t9, t1            ; G = L × 15/16
  sll t1, t1, 8
  or t0, t0, t1
  sll t1, t9, 16             ; B = L
  or t8, t0, t1
  la t6, photo
  li t7, NPHOTO
@ph:
  lwc2 0, 0(t6)
  lwc2 1, 4(t6)
  nop
  cop2 0x0180001             ; RTPS（RT・TR は魚のまま）
  nop
  mfc2 t0, 14
  nop
  sra t1, t0, 16             ; y
  sll t0, t0, 16
  sra t0, t0, 16             ; x
  slti t2, t9, 8
  bnez t2, @dark
  nop
  srl t2, t8, 1              ; にじみ 5×5（加算・色の半分）
  li t3, 0x007f7f7f
  and t2, t2, t3
  li t3, 0x62000000
  or t2, t2, t3
  sw t2, GP0(s7)
  addiu t3, t1, -2
  sll t3, t3, 16
  addiu t4, t0, -2
  andi t4, t4, 0xffff
  or t3, t3, t4
  sw t3, GP0(s7)
  li t3, 0x00050005
  sw t3, GP0(s7)
  li t2, 0x62000000          ; しん 2×2（加算・色そのまま）
  or t2, t2, t8
  lw t3, V_TH(gp)            ; 見上げた画面で強すぎる（L − I > 12）ときは、白くまたたく
  nop
  slti t3, t3, 32
  bnez t3, @tw
  nop
  lw t3, V_I(gp)
  nop
  subu t3, t9, t3
  slti t3, t3, TOL + 1
  bnez t3, @tw
  nop
  lw t3, V_T(gp)
  nop
  andi t3, t3, 8
  beqz t3, @tw
  nop
  li t2, 0x62ffffff
@tw:
  sw t2, GP0(s7)
  addiu t3, t1, -1
  sll t3, t3, 16
  addiu t4, t0, -1
  andi t4, t4, 0xffff
  or t3, t3, t4
  sw t3, GP0(s7)
  li t3, 0x00020002
  sw t3, GP0(s7)
  b @phn
  nop
@dark:
  li t2, 0x6078604a          ; 消えた発光器: くぼみ #4a6078（2×2。縁なしで銀にうもれる）
  sw t2, GP0(s7)
  sll t3, t1, 16
  andi t4, t0, 0xffff
  or t3, t3, t4
  sw t3, GP0(s7)
  li t3, 0x00020002
  sw t3, GP0(s7)
@phn:
  addiu t7, t7, -1
  bnez t7, @ph
  addiu t6, t6, 8
  ; 腹の下に落ちる淡い光（横の画面・光っているとき）: 上が光の色の 1/4、下が黒（加算なので消える）のグーロー
  lw t0, V_TH(gp)
  nop
  slti t0, t0, 32
  beqz t0, @nopool
  nop
  slti t0, t9, 8
  bnez t0, @nopool
  nop
  lw t1, V_STATE(gp)         ; 遊ぶ画面だけ（タイトルとおわりは魚がまん中にいる）
  li t2, 1
  bne t1, t2, @nopool
  nop
  srl t0, t8, 2
  li t1, 0x003f3f3f
  and t0, t0, t1
  li t1, 0x3a000000
  or t0, t0, t1
  sw t0, GP0(s7)
  li t0, 0x0022ffb4          ; (−76,34)
  sw t0, GP0(s7)
  sw zero, GP0(s7)
  li t0, 0x0022fffc          ; (−4,34)
  sw t0, GP0(s7)
  sw zero, GP0(s7)
  li t0, 0x0048ffa0          ; (−96,72)
  sw t0, GP0(s7)
  sw zero, GP0(s7)
  li t0, 0x00480010          ; (16,72)
  sw t0, GP0(s7)
@nopool:
  jr ra
  nop

; ---- 変数と作業の場所 ----
.align 4
vars:   .space 192
plk:    .space NPLK * 12
snowp:  .space NSNOW * 8
numbuf: .space 8
mat_a:  .space 20
mat_b:  .space 20
mat_c:  .space 20
ot:     .space OTN * 4
pkts:   .space 100 * 28
