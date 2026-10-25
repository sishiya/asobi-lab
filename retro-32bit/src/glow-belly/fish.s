; ---- ムネエソ: 行列（GTE でかけ算）・形を GTE で投げて並べ表へ・腹の発光器（main.s のつづき） ----

; GTE の決まった設定（はじめに1回）
fishinit:
  ctc2 zero, 24              ; OFX・OFY = 0（まん中へは GPU の E5）
  ctc2 zero, 25
  li t0, 300
  ctc2 t0, 26                ; H
  li t0, 1365
  ctc2 t0, 29                ; ZSF3 = 1/3
  ; 光の向き（光のほうへ: 上と少し手前）。LLM の 1 行目だけ
  li t0, 0xf1ec0000          ; L11 = 0, L12 = −3604
  ctc2 t0, 8
  li t0, 0x0000f87b          ; L13 = −1925
  ctc2 t0, 9
  ctc2 zero, 10
  ctc2 zero, 11
  ctc2 zero, 12
  ctc2 zero, 17
  ctc2 zero, 18
  ctc2 zero, 20
  li t0, 520                 ; まわりの光（青み）
  ctc2 t0, 13
  li t0, 700
  ctc2 t0, 14
  li t0, 1000
  ctc2 t0, 15
  jr ra
  nop

; a0 = 角度、a1 = 出す所（3×3 の 16 ビット）。sincos は t0 = sin・t1 = cos
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
; Rx: [1 0 0; 0 c −s; 0 s c]
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

; ムネエソを描く。a0 = 1 なら見上げたシルエット（腹の光の明るさの1色）
fishdraw:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
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
  ; ずらす: 横の画面では x = −56（画面で −40）、見上げるとまん中へ
  lw t0, V_TH(gp)
  li t1, 64
  subu t1, t1, t0
  li t2, -56
  mult t1, t2
  mflo t1
  sra t1, t1, 6
  ctc2 t1, 5
  ctc2 zero, 6
  li t0, 420
  ctc2 t0, 7
  ; 光の色 = 魚の所の光の明るさ（深いほど暗い銀）
  lw t0, V_I(gp)
  nop
  sll t1, t0, 4
  sll t0, t0, 2
  addu t0, t0, t1            ; ×20
  addiu t0, t0, 1000
  srl t1, t0, 1
  srl t2, t0, 3
  addu t1, t1, t2            ; R ×0.62
  ctc2 t1, 16                ; LR1（LR2 = 0）
  srl t1, t0, 3
  subu t1, t0, t1            ; G ×0.88
  sll t1, t1, 16
  ctc2 t1, 17                ; LG1（LR3 = 0）
  ctc2 t0, 19                ; LB1
  ; 並べ表を空に
  la t0, ot + (OTN - 1) * 4
  sw t0, D6MADR(s7)
  li t0, OTN
  sw t0, D6BCR(s7)
  li t0, 0x11000002
  sw t0, D6CHCR(s7)
  ; シルエットの色: 上の光の円（段 200）からの差を 2 倍に（腹の光 L − 上からの光 I）
  lw a0, V_L16(gp)
  lw t0, V_I(gp)
  srl a0, a0, 4
  subu a0, a0, t0
  sll a0, a0, 1
  addiu a0, a0, 200
  jal palc
  nop
  li t0, 0x20000000
  or s2, v0, t0
  la s0, ftri
  la s1, pkts
  li t8, NFTRI
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
  swc2 13, 12(s1)
  swc2 14, 16(s1)
  cop2 0x158002d             ; AVSZ3
  mfc2 t3, 7
  beqz s3, @lit
  nop
  b @col2
  sw s2, 4(s1)               ; シルエット
@lit:
  lwc2 0, 4(s0)
  lwc2 1, 8(s0)
  lw t0, 12(s0)
  nop
  mtc2 t0, 6
  cop2 0x0086012             ; MVMVA: RT × 面の向き
  nop
  cop2 0x00be412             ; MVMVA: LLM × IR（lm）
  nop
  cop2 0x138041c             ; CC
  nop
  swc2 22, 4(s1)
@col2:
  srl t3, t3, 2
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
  lui t4, 0x0400
  or t1, t1, t4
  sw t1, 0(s1)
  and t1, s1, t2
  sw t1, 0(t3)
  addiu s1, s1, 20
@skip:
  addiu t8, t8, -1
  bnez t8, @tri
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
  jr ra
  addiu sp, sp, 24

; 腹の発光器（横の画面だけ）: 明るさ＝腹の光の段。消えているときは暗い点
photodraw:
  lw t9, V_L16(gp)
  nop
  srl t9, t9, 4              ; 0〜255
  ; 色: 青緑（R = L/4・G = L×7/8・B = L）
  srl t0, t9, 2
  srl t1, t9, 3
  subu t1, t9, t1
  sll t1, t1, 8
  or t0, t0, t1
  sll t1, t9, 16
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
  beqz t9, @dark
  nop
  li t2, 0x62000000          ; にじみ 3×3（加算）
  or t2, t2, t8
  sw t2, GP0(s7)
  addiu t3, t1, -1
  sll t3, t3, 16
  addiu t4, t0, -1
  andi t4, t4, 0xffff
  or t3, t3, t4
  sw t3, GP0(s7)
  li t3, 0x00030003
  sw t3, GP0(s7)
  li t2, 0x68000000          ; まん中の 1 点（白っぽく）
  srl t3, t9, 1
  addiu t3, t3, 0x60
  sll t4, t3, 8
  or t4, t4, t3
  sll t5, t3, 16
  or t4, t4, t5
  or t2, t2, t4
  sw t2, GP0(s7)
  b @phn
  nop
@dark:
  li t2, 0x68101818          ; 消えた発光器
  sw t2, GP0(s7)
@phn:
  sll t3, t1, 16
  andi t4, t0, 0xffff
  or t3, t3, t4
  sw t3, GP0(s7)
  addiu t7, t7, -1
  bnez t7, @ph
  addiu t6, t6, 8
  jr ra
  nop

; ---- 変数と作業の場所 ----
.align 4
vars:   .space 128
plk:    .space NPLK * 12
snowp:  .space NSNOW * 8
numbuf: .space 8
mat_a:  .space 20
mat_b:  .space 20
mat_c:  .space 20
ot:     .space OTN * 4
pkts:   .space 64 * 20
