; ---- 島のブロックと、外に出ている面の一覧（main.s のつづき） ----
;   世界は 8×8 の柱（チャンク）16 本。チャンク c = cz×4 + cx。面の一覧は faces + c×MAXF×4 に、数は fcount + c×4
;   面の語: x（5）| z（5）<< 5 | y（4）<< 10 | 向き（3）<< 14 | ブロック（5）<< 17
;   出す面: となりが空気のときだけ（水のとなりも出さない＝水の上の面は不透明なので、水の下は見えない）。水は上の面だけ

; a0 = ブロックの番号 → そのチャンク（ふちなら、となりのチャンクも）に作りなおしの印
markdirty:
  andi t0, a0, 31            ; x
  srl t1, a0, 5
  andi t1, t1, 31            ; z
  lw t9, V_DIRTY(gp)
  srl t2, t0, 3              ; cx
  srl t3, t1, 3              ; cz
  move t8, ra
  bal @set
  nop
  andi t4, t0, 7
  bnez t4, @x1
  nop
  beqz t2, @x1
  nop
  addiu t2, t2, -1           ; 左のとなり
  bal @set
  nop
  addiu t2, t2, 1
@x1:
  li t5, 7
  bne t4, t5, @x2
  nop
  li t5, 3
  beq t2, t5, @x2
  nop
  addiu t2, t2, 1            ; 右のとなり
  bal @set
  nop
  addiu t2, t2, -1
@x2:
  andi t4, t1, 7
  bnez t4, @z1
  nop
  beqz t3, @z1
  nop
  addiu t3, t3, -1
  bal @set
  nop
  addiu t3, t3, 1
@z1:
  li t5, 7
  bne t4, t5, @z2
  nop
  li t5, 3
  beq t3, t5, @z2
  nop
  addiu t3, t3, 1
  bal @set
  nop
@z2:
  sw t9, V_DIRTY(gp)
  jr t8
  nop
@set:                         ; t9 |= 1 << (cz×4 + cx)
  sll t6, t3, 2
  addu t6, t6, t2
  li t7, 1
  sllv t7, t7, t6
  jr ra
  or t9, t9, t7

; ぜんぶのチャンクを作る（はじめ）
rebuildall:
  addiu sp, sp, -8
  sw ra, 0(sp)
  sw s0, 4(sp)
  li s0, 0
@a:
  move a0, s0
  jal buildchunk
  nop
  addiu s0, s0, 1
  slti t0, s0, 16
  bnez t0, @a
  nop
  sw zero, V_DIRTY(gp)
  lw ra, 0(sp)
  lw s0, 4(sp)
  jr ra
  addiu sp, sp, 8

; 印のついたチャンクを、1 こまに 2 本まで作りなおす
rebuilddirty:
  addiu sp, sp, -12
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  li s0, 0
  li s1, 2
@d:
  lw t0, V_DIRTY(gp)
  li t1, 1
  sllv t1, t1, s0
  and t2, t0, t1
  beqz t2, @dn
  nop
  xor t0, t0, t1
  sw t0, V_DIRTY(gp)
  move a0, s0
  jal buildchunk
  nop
  addiu s1, s1, -1
  beqz s1, @dd
  nop
@dn:
  addiu s0, s0, 1
  slti t0, s0, 16
  bnez t0, @d
  nop
@dd:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  jr ra
  addiu sp, sp, 12

; a0 = チャンク → 面の一覧を作る
buildchunk:
  addiu sp, sp, -28
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
  sw s4, 20(sp)
  sw s5, 24(sp)
  sll t0, a0, 12             ; × MAXF × 4（1024 × 4）
  la s0, faces
  addu s0, s0, t0            ; 書く場所
  sll t0, a0, 2
  la t1, fcount
  addu s5, t1, t0            ; 数を書く場所
  andi t0, a0, 3
  sll s4, t0, 3              ; x のはじめ（cx × 8）
  srl t0, a0, 2
  sll t9, t0, 3              ; z のはじめ（cz × 8）
  li s1, 0                   ; 数
  la t8, world
  li s3, 0                   ; y
@y:
  move s2, t9                ; z
@z:
  move a1, s4                ; x
@x:
  sll t0, s3, 10
  sll t1, s2, 5
  addu t0, t0, t1
  addu t0, t0, a1            ; 番号
  addu t1, t8, t0
  lbu t2, 0(t1)              ; ブロック
  nop
  beqz t2, @nextx
  nop
  ; 面の語のもと
  sll t3, s2, 5
  or t3, t3, a1
  sll t4, s3, 10
  or t3, t3, t4
  sll t4, t2, 17
  or t3, t3, t4
  li t4, 9
  beq t2, t4, @water
  nop
  ; +x
  li t5, 31
  beq a1, t5, @e0
  nop
  lbu t6, 1(t1)
  nop
  bnez t6, @n0
  nop
@e0:
  li a2, 0
  bal @emit
  nop
@n0:
  ; −x
  beqz a1, @e1
  nop
  lbu t6, -1(t1)
  nop
  bnez t6, @n1
  nop
@e1:
  li a2, 1
  bal @emit
  nop
@n1:
  ; +y
  li t5, 15
  beq s3, t5, @e2
  nop
  lbu t6, 1024(t1)
  nop
  bnez t6, @n2
  nop
@e2:
  li a2, 2
  bal @emit
  nop
@n2:
  ; −y（いちばん下は出さない）
  beqz s3, @n3
  nop
  lbu t6, -1024(t1)
  nop
  bnez t6, @n3
  nop
  li a2, 3
  bal @emit
  nop
@n3:
  ; +z
  li t5, 31
  beq s2, t5, @e4
  nop
  lbu t6, 32(t1)
  nop
  bnez t6, @n4
  nop
@e4:
  li a2, 4
  bal @emit
  nop
@n4:
  ; −z
  beqz s2, @e5
  nop
  lbu t6, -32(t1)
  nop
  bnez t6, @nextx
  nop
@e5:
  li a2, 5
  bal @emit
  nop
  b @nextx
  nop
@water:                       ; 水は上の面だけ（上が空気のとき）
  li t5, 15
  beq s3, t5, @ew
  nop
  lbu t6, 1024(t1)
  nop
  bnez t6, @nextx
  nop
@ew:
  li a2, 2
  bal @emit
  nop
@nextx:
  addiu a1, a1, 1
  addiu t0, s4, 8
  bne a1, t0, @x
  nop
  addiu s2, s2, 1
  addiu t0, t9, 8
  bne s2, t0, @z
  nop
  addiu s3, s3, 1
  slti t0, s3, H
  bnez t0, @y
  nop
  sw s1, 0(s5)
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  lw s3, 16(sp)
  lw s4, 20(sp)
  lw s5, 24(sp)
  jr ra
  addiu sp, sp, 28
@emit:                        ; a2 = 向き → 面の語を足す（MAXF まで）
  slti t5, s1, MAXF
  beqz t5, @full
  nop
  sll t5, a2, 14
  or t5, t5, t3
  sw t5, 0(s0)
  addiu s0, s0, 4
  addiu s1, s1, 1
@full:
  jr ra
  nop
