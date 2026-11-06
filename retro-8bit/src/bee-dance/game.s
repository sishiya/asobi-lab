; ミツバチの おどり（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs（絵の番号 T_・S_ と画面のデータは build.mjs が足す）
; 決まり: 巣の中の仲間のおしりふりダンスは、まっすぐ進む向き＝太陽から見た花の向き（巣板の真上＝太陽）、ふる回数＝遠さ（輪 1〜5）。
; 遊ぶ人はそれを読んで、花畑で向き（16）と遠さ（5）を決めて飛ぶ。1日は 10 回。太陽は 1 回ごとに 1 目もり（22.5 度）ずつ東から西へ動く。

PPUCTRL = $2000
PPUMASK = $2001
PPUSTATUS = $2002
OAMADDR = $2003
PPUSCROLL = $2005
PPUADDR = $2006
PPUDATA = $2007
OAMDMA = $4014
JOY1 = $4016

CTRL_ON = %10001000   ; NMI あり・スプライトの絵は $1000・背景は $0000
MASK_ON = %00011110   ; 背景とスプライトを出す（左の 8 ドットも）

BTN_A = $80
BTN_B = $40
BTN_SELECT = $20
BTN_START = $10
BTN_UP = $08
BTN_DOWN = $04
BTN_LEFT = $02
BTN_RIGHT = $01

NFLIGHT = 10
HIVE_X = 128          ; 巣の画面のダンスの始まり（ハチのまん中）
HIVE_Y = 144
TITLE_X = 128
TITLE_Y = 200

; ---- ゼロページ ----
nmi_count = $00
buf_ready = $01
buf_len = $02
frame = $03
pad = $04
pad_old = $05
pad_new = $06
state = $07        ; 0 タイトル・1 巣・2 ねらう・3 飛んでいく・4 花で・5 もどる・6 おわり
rng = $08          ; 2バイト
tmp = $0A
tmp2 = $0B
tmp3 = $0C
tmp4 = $0D
ptr = $0E          ; 2バイト
oam_i = $10
flight = $11       ; 0〜9
sun = $12          ; 太陽の向き（0 北・4 東・8 南・12 西）
aim_d = $13
aim_k = $14
honey = $15        ; きょうの みつ
hi = $16
st_t = $17
lang = $18
adv = $19          ; この回に踊りで知らせる花（0〜2）
pd = $1A           ; 花の群れ 3 つの向き（3バイト）
pk = $1D           ; 花の群れ 3 つの輪（3バイト）
da = $20           ; ダンスの向き（巣板の真上 = 0）
dn = $21           ; ふる回数（= 輪）
ph = $22           ; 0 まっすぐ（ふる）・1 まわってもどる・2 ひと休み
pt = $23
reps = $24         ; 何回おどったか
bx = $25           ; ハチのまん中
by = $26
gain = $27
sd = $28           ; ハチの絵の向き
side = $29         ; もどる輪の右・左（0・1）
ox0 = $2A          ; ダンスの始まり
mp_a = $2B
mp_b = $2C
mus_on = $2D
paused = $2E       ; 曲の係が見る（このゲームでは止めない）
oy0 = $2F
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
mp_hi = $40
po_d = $41
po_r = $42
tx = $43
ty = $44
rep_t = $46
rr = $47           ; 飛んでいる距離
s16_t = $50        ; put16 の 最初の絵・裏返し・左・上・何枚め
s16_f = $51
s16_x = $52
s16_y = $53
s16_q = $54
sgn = $55
cnt = $56
fi = $57
ft = $58
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "BD01"・ハイスコア

OAM = $0200
BUF = $0300        ; 帰線のあいだに画面へ書くもの: 番地の上・下・長さ・中身…、0 でおわり
ATTR = $0600       ; 花畑の色の表の写し（64 バイト）

.org $8000

; ================= はじめ =================
reset:
  sei
  cld
  ldx #$40
  stx $4017
  ldx #$ff
  txs
  inx
  stx PPUCTRL
  stx PPUMASK
  stx $4010
  bit PPUSTATUS
@vw1:
  bit PPUSTATUS
  bpl @vw1
  lda #0
  tax
@clr:
  sta $00,x
  sta $0100,x
  sta $0300,x
  sta $0400,x
  sta $0500,x
  sta $0600,x
  sta $0700,x
  inx
  bne @clr
  lda #$ff
@hide:
  sta OAM,x
  inx
  bne @hide
@vw2:
  bit PPUSTATUS
  bpl @vw2
  lda #%00001111
  sta $4015
  lda #$5d
  sta rng
  lda #$b3
  sta rng+1
  jsr load_save
  lda #CTRL_ON
  sta PPUCTRL
  jsr go_title

main:
  jsr read_pad
  lda state
  asl a
  tax
  lda state_tab,x
  sta ptr
  lda state_tab+1,x
  sta ptr+1
  jsr @call
  jsr music_update
  jsr wait_frame
  jmp main
@call:
  jmp (ptr)

state_tab: .word title_update, hive_update, aim_update, out_update, flower_update, back_update, end_update

irq:
  rti

; ================= 帰線（NMI） =================
nmi:
  pha
  txa
  pha
  tya
  pha
  lda #0
  sta OAMADDR
  lda #>OAM
  sta OAMDMA
  lda buf_ready
  beq @skip
  ldx #0
@ent:
  lda BUF,x
  beq @end
  sta PPUADDR
  lda BUF+1,x
  sta PPUADDR
  ldy BUF+2,x
  inx
  inx
  inx
@dat:
  lda BUF,x
  sta PPUDATA
  inx
  dey
  bne @dat
  jmp @ent
@end:
  lda #0
  sta buf_ready
  sta buf_len
@skip:
  lda #0
  sta PPUSCROLL
  sta PPUSCROLL
  lda #CTRL_ON
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  inc nmi_count
  pla
  tay
  pla
  tax
  pla
  rti

; 書くものを閉じて、つぎの帰線を待つ
wait_frame:
  ldx buf_len
  lda #0
  sta BUF,x
  lda #1
  sta buf_ready
  lda nmi_count
@w:
  cmp nmi_count
  beq @w
  inc frame
  rts

; ================= 画面の道具 =================
screen_off:
  jsr wait_frame
  lda #0
  sta PPUCTRL
  sta PPUMASK
  rts

screen_on:
  lda #0
  sta buf_len
  bit PPUSTATUS
@w:
  bit PPUSTATUS
  bpl @w
  lda #0
  sta PPUSCROLL
  sta PPUSCROLL
  lda #CTRL_ON
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  rts

; ptr の 32 バイトを色の表へ（画面を消してから）
load_pal:
  bit PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #0
  sta PPUADDR
  ldy #0
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  cpy #32
  bne @l
  rts

; ptr の 1024 バイトを画面の表へ（画面を消してから）
draw_nt:
  bit PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldx #4
  ldy #0
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  bne @l
  inc ptr+1
  dex
  bne @l
  rts

; 書くものの見出し: A = 番地の上・X = 下・Y = 長さ
buf_head:
  sty tmp
  ldy buf_len
  sta BUF,y
  txa
  sta BUF+1,y
  lda tmp
  sta BUF+2,y
  iny
  iny
  iny
  sty buf_len
  rts

; ptr のデータ（番地・長さ・中身）をそのまま書くものへ
buf_data:
  ldy #2
  lda (ptr),y
  clc
  adc #3
  sta tmp2
  ldy #0
  ldx buf_len
@l:
  lda (ptr),y
  sta BUF,x
  inx
  iny
  cpy tmp2
  bne @l
  stx buf_len
  rts

; ptr のデータを画面へじかに（画面を消しているとき）
text_now:
  bit PPUSTATUS
  ldy #0
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  sta tmp2
  inc tmp2
  inc tmp2
  inc tmp2
  iny
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  cpy tmp2
  bne @l
  rts

; A = 字の番号（M_…）→ ptr にことばの字
say_ptr:
  ldx lang
  beq @j
  clc
  adc #MSG_N
@j:
  tax
  lda msg_lo,x
  sta ptr
  lda msg_hi,x
  sta ptr+1
  rts
; A = 字の番号 → 帰線で書く
say:
  jsr say_ptr
  jmp buf_data
; A = 字の番号 → いま書く（画面を消しているとき）
say_now:
  jsr say_ptr
  jmp text_now

; A（0〜255）を 3 けたで PPUDATA へ（番地は先に決めておく）。tmp・tmp2 をこわす
num3_ppu:
  ldx #0
@h:
  cmp #100
  bcc @hd
  sbc #100
  inx
  bne @h
@hd:
  sta tmp
  txa
  clc
  adc #T_0
  sta PPUDATA
  lda tmp
num2_ppu:
  ldx #0
@t:
  cmp #10
  bcc @td
  sbc #10
  inx
  bne @t
@td:
  sta tmp
  txa
  clc
  adc #T_0
  sta PPUDATA
  lda tmp
  clc
  adc #T_0
  sta PPUDATA
  rts

; 番地 A（上）・X（下）を PPUADDR へ
set_addr:
  bit PPUSTATUS
  sta PPUADDR
  stx PPUADDR
  rts

; ================= スプライト =================
; 8×8 一つ: tmp = y・tmp2 = 絵・tmp3 = 色・tmp4 = x
put_spr:
  ldy oam_i
  beq @ok
  cpy #252          ; いっぱい（64 枚）なら出さない
  bcs @r
@ok:
  lda tmp
  sec
  sbc #1
  sta OAM,y
  lda tmp2
  sta OAM+1,y
  lda tmp3
  sta OAM+2,y
  lda tmp4
  sta OAM+3,y
  tya
  clc
  adc #4
  sta oam_i
@r:
  rts

; 16×16: tmp = 上・tmp4 = 左・s16_t = 最初の絵（左上・右上・左下・右下）・tmp3 = 色と裏返し（$40 左右・$80 上下）
put16:
  lda tmp
  sta s16_y
  lda tmp4
  sta s16_x
  lda #0
  sta s16_f
  lda tmp3
  and #$40
  beq @nh
  inc s16_f
@nh:
  lda tmp3
  bpl @nv
  lda s16_f
  ora #2
  sta s16_f
@nv:
  ldx #0
@q:
  lda s16_x
  sta tmp4
  txa
  and #1
  beq @x0
  lda tmp4
  clc
  adc #8
  sta tmp4
@x0:
  lda s16_y
  sta tmp
  txa
  and #2
  beq @y0
  lda tmp
  clc
  adc #8
  sta tmp
@y0:
  txa
  eor s16_f
  clc
  adc s16_t
  sta tmp2
  stx s16_q
  jsr put_spr
  ldx s16_q
  inx
  cpx #4
  bne @q
  rts

hide_rest:
  ldx oam_i
  lda #$ff
@l:
  sta OAM,x
  inx
  inx
  inx
  inx
  bne @l
  rts

clear_oam:
  lda #0
  sta oam_i
  jsr hide_rest
  rts

; ハチ（まん中 bx・by、向き sd）。はねは frame で動く
draw_bee:
  lda by
  sec
  sbc #8
  sta tmp
  lda bx
  sec
  sbc #8
  sta tmp4
  ldx sd
  lda bee_tile,x
  sta s16_t
  lda frame
  and #2
  beq @w
  lda s16_t
  clc
  adc #20
  sta s16_t
@w:
  lda bee_attr,x
  sta tmp3
  jmp put16

; 16×16 のしるし（s16_t = 最初の絵・tmp3 = 色）を、まん中 tx・ty に
put16_at:
  lda ty
  sec
  sbc #8
  sta tmp
  lda tx
  sec
  sbc #8
  sta tmp4
  jmp put16

read_pad:
  lda pad
  sta pad_old
  lda #1
  sta JOY1
  sta pad
  lda #0
  sta JOY1
@l:
  lda JOY1
  lsr a
  rol pad
  bcc @l
  lda pad_old
  eor #$ff
  and pad
  sta pad_new
  rts

rand:
  ldy #8
  lda rng
@l:
  asl a
  rol rng+1
  bcc @n
  eor #$39
@n:
  dey
  bne @l
  sta rng
  rts

; ================= かけ算 =================
; A × Y（符号なし）→ A = 上の位・mp_b = 下の位
mul8:
  sta mp_a
  sty mp_b
  lda #0
  ldy #8
  lsr mp_b
@l:
  bcc @n
  clc
  adc mp_a
@n:
  ror a
  ror mp_b
  dey
  bne @l
  rts

; A = 向きの長さ（符号つき、16 倍）・Y = 長さ（ドット）→ A = 符号つきのドット（A×Y÷16）。X・Y をこわす
smul:
  ldx #0
  cmp #$80
  bcc @p
  eor #$ff
  clc
  adc #1
  ldx #1
@p:
  stx sgn
  jsr mul8
  sta mp_hi
  lda mp_b
  lsr mp_hi
  ror a
  lsr mp_hi
  ror a
  lsr mp_hi
  ror a
  lsr mp_hi
  ror a
  ldx sgn
  beq @r
  eor #$ff
  clc
  adc #1
@r:
  rts

; X = 向き・Y = 長さ → tx・ty = その向きへ進んだぶん（符号つき）
pos_off:
  stx po_d
  sty po_r
  lda ux,x
  jsr smul
  sta tx
  ldx po_d
  ldy po_r
  lda uy,x
  jsr smul
  sta ty
  rts

; ================= ダンス（タイトルと巣の画面） =================
; ox0・oy0 から、da の向きへ、dn 回ふりながら 8×dn ドット進み、横へ輪をかいてもどる。これをくり返す
dance_start:
  lda #0
  sta ph
  sta pt
  sta reps
  sta side
  lda ox0
  sta bx
  lda oy0
  sta by
  lda da
  sta sd
  rts

dance_update:
  lda ph
  beq @run
  cmp #1
  beq @ret
  jmp @rest
@run:
  ; まっすぐ: pt = 0 〜 8×dn−1。8 フレームで 1 回ふる（ブッ）
  lda pt
  and #7
  bne @nb
  jsr sfx_buzz
@nb:
  ldx da
  ldy pt
  jsr pos_off
  lda ox0
  clc
  adc tx
  sta bx
  lda oy0
  clc
  adc ty
  sta by
  ; 横にふる
  lda pt
  and #7
  tax
  lda wag_s,x
  clc
  adc da
  adc #4
  and #15
  pha
  lda wag_m,x
  tay
  pla
  tax
  jsr pos_off
  lda bx
  clc
  adc tx
  sta bx
  lda by
  clc
  adc ty
  sta by
  lda da
  sta sd
  inc pt
  lda dn
  asl a
  asl a
  asl a
  cmp pt
  bne @r
  lda #1
  sta ph
  lda #0
  sta pt
@r:
  rts
@ret:
  ; もどる: pt = 0〜31。まっすぐの線の上を L から 0 へ、横へ半円（arc）にずれる
  lda dn
  asl a
  asl a
  asl a
  sta tmp3            ; L
  ldy pt
  jsr mul8            ; L×pt → A 上・mp_b 下。÷32
  sta mp_hi
  lda mp_b
  ldx #5
@sh:
  lsr mp_hi
  ror a
  dex
  bne @sh
  sta tmp2
  lda tmp3
  sec
  sbc tmp2
  tay
  ldx da
  jsr pos_off
  lda ox0
  clc
  adc tx
  sta bx
  lda oy0
  clc
  adc ty
  sta by
  ; 横へ（side = 0 右・1 左）
  lda side
  asl a
  asl a
  asl a
  clc
  adc da
  adc #4
  and #15
  tax
  ldy pt
  lda arc,y
  tay
  jsr pos_off
  lda bx
  clc
  adc tx
  sta bx
  lda by
  clc
  adc ty
  sta by
  ; 向き: 横 → うしろ → 反対の横（4 から 12 まで回る）
  lda pt
  lsr a
  lsr a
  clc
  adc #4
  ldx side
  beq @sr
  eor #$ff
  clc
  adc #1
@sr:
  clc
  adc da
  and #15
  sta sd
  inc pt
  lda pt
  cmp #32
  bne @r2
  lda #2
  sta ph
  lda #0
  sta pt
  lda ox0
  sta bx
  lda oy0
  sta by
  lda da
  sta sd
@r2:
  rts
@rest:
  inc pt
  lda pt
  cmp #10
  bne @r3
  lda #0
  sta ph
  sta pt
  inc reps
  lda side
  eor #1
  sta side
@r3:
  rts

; ダンスの足あと（この回にふった所に黄の点）と、踊るハチ
draw_dance:
  ldx #0
  lda ph
  bne @all
  lda pt
  lsr a
  lsr a
  lsr a
  sta cnt           ; ふった数
  jmp @dl
@all:
  lda dn
  sta cnt
@dl:
  cpx cnt
  beq @bee
  txa
  pha
  asl a
  asl a
  asl a
  ora #4
  tay
  ldx da
  jsr pos_off
  lda oy0
  clc
  adc ty
  sec
  sbc #4
  sta tmp
  lda ox0
  clc
  adc tx
  sec
  sbc #4
  sta tmp4
  lda #S_TRAIL
  sta tmp2
  lda #2
  sta tmp3
  jsr put_spr
  pla
  tax
  inx
  jmp @dl
@bee:
  jmp draw_bee

; ================= タイトル =================
go_title:
  ldx #0
  lda LANG
  cmp #1
  bne @lj
  inx
@lj:
  stx lang
  jsr screen_off
  lda #<pal_hive
  sta ptr
  lda #>pal_hive
  sta ptr+1
  jsr load_pal
  lda #<nt_title_0
  ldx #>nt_title_0
  ldy lang
  beq @t0
  lda #<nt_title_1
  ldx #>nt_title_1
@t0:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda #>ADDR_HI
  ldx #<ADDR_HI
  jsr set_addr
  lda hi
  jsr num3_ppu
  lda #0
  sta state
  sta st_t
  lda #TITLE_X
  sta ox0
  lda #TITLE_Y
  sta oy0
  lda #0
  sta da
  lda #3
  sta dn
  jsr dance_start
  jsr clear_oam
  lda #SONG_MAIN
  jsr music_play
  jsr screen_on
  rts

title_update:
  inc st_t
  jsr dance_update
  ; タイトルの踊りは、ひと回りごとに向きを変える（右・左・上）
  lda ph
  cmp #2
  bne @nd
  lda pt
  cmp #9
  bne @nd
  lda reps
  and #3
  tax
  lda title_da,x
  sta da
@nd:
  lda #0
  sta oam_i
  jsr draw_dance
  jsr hide_rest
  ; START を点めつ
  lda st_t
  and #31
  bne @nb
  lda st_t
  and #32
  beq @on
  lda #M_PUSH_OFF
  jsr say
  jmp @nb
@on:
  lda #M_PUSH
  jsr say
@nb:
  lda pad_new
  and #BTN_START
  beq @r
  jsr new_day
@r:
  rts

; ================= 1日のはじめ =================
new_day:
  lda frame
  eor rng
  sta rng
  lda st_t
  eor rng+1
  ora #1
  sta rng+1
  lda #0
  sta honey
  sta flight
  ; 花の群れ 0: はじめの回の太陽の向き（ダンスは真上）。輪 1〜3
  lda #4
  sta pd
  jsr rand3
  clc
  adc #1
  sta pk
  ; 花の群れ 1: 2 回めの太陽から右へ 90 度。輪 2〜4
  lda #9
  sta pd+1
  jsr rand3
  clc
  adc #2
  sta pk+1
  ; 花の群れ 2: ほかの 2 つから離れた所
@p2:
  jsr rand
  and #15
  sta pd+2
  jsr rand5
  clc
  adc #1
  sta pk+2
  ldx #0
  jsr apart
  bcc @p2
  ldx #1
  jsr apart
  bcc @p2
  jmp go_hive

; 0〜2
rand3:
  jsr rand
  and #3
  cmp #3
  beq rand3
  rts
; 0〜4
rand5:
  jsr rand
  and #7
  cmp #5
  bcs rand5
  rts
; 群れ 2 と群れ X が離れているか（向きが 3 以上ちがう、か、輪が 2 以上ちがう）→ C = 1
apart:
  lda pd+2
  sec
  sbc pd,x
  and #15
  cmp #9
  bcc @a
  eor #$ff
  clc
  adc #1
  and #15
@a:
  cmp #3
  bcs @yes
  lda pk+2
  sec
  sbc pk,x
  bcs @b
  eor #$ff
  clc
  adc #1
@b:
  cmp #2
  bcs @yes
  clc
  rts
@yes:
  sec
  rts

; ================= 巣（ダンスを見る） =================
go_hive:
  jsr screen_off
  lda #<pal_hive
  sta ptr
  lda #>pal_hive
  sta ptr+1
  jsr load_pal
  lda #<nt_hive
  sta ptr
  lda #>nt_hive
  sta ptr+1
  jsr draw_nt
  jsr hud_now
  lda #M_H_WAIT
  jsr say_now
  ; この回の太陽と、知らせる花
  lda flight
  clc
  adc #4
  sta sun
  lda flight
  cmp #3
  bcc @f
  jsr rand3
@f:
  sta adv
  tax
  lda pd,x
  sec
  sbc sun
  and #15
  sta da
  lda pk,x
  sta dn
  lda #HIVE_X
  sta ox0
  lda #HIVE_Y
  sta oy0
  jsr dance_start
  lda #1
  sta state
  jsr clear_oam
  jsr screen_on
  rts

; 字の段: 何回め・みつ（画面を消しているとき）
hud_now:
  lda #M_FLIGHT
  jsr say_now
  lda #M_HONEY
  jsr say_now
  lda #>ADDR_FLIGHT
  ldx #<ADDR_FLIGHT
  jsr set_addr
  lda flight
  clc
  adc #1
  jsr num2_ppu
  lda #>ADDR_HONEY
  ldx #<ADDR_HONEY
  jsr set_addr
  lda honey
  jmp num3_ppu

hive_update:
  jsr dance_update
  ; 1 回おどったら、A で外へ（案内を出す）
  lda reps
  cmp #1
  bne @nh
  lda ph
  bne @nh
  lda pt
  bne @nh
  lda #M_H_HIVE
  jsr say
@nh:
  lda #0
  sta oam_i
  jsr draw_dance
  jsr draw_crowd
  jsr hide_rest
  lda reps
  beq @r
  lda pad_new
  and #BTN_A
  beq @r
  jmp go_field
@r:
  rts

; 見ている仲間（すみの 4 ひき。ダンスとはスプライトの行がかさならない所）
draw_crowd:
  ldx #3
@l:
  txa
  pha
  lda crowd_x,x
  sta bx
  lda crowd_y,x
  sta by
  lda crowd_d,x
  sta sd
  jsr draw_bee
  pla
  tax
  dex
  bpl @l
  rts

; ================= 花畑（ねらって飛ぶ） =================
go_field:
  jsr sfx_tick
  jsr screen_off
  lda #<pal_field
  sta ptr
  lda #>pal_field
  sta ptr+1
  jsr load_pal
  lda #<nt_field
  sta ptr
  lda #>nt_field
  sta ptr+1
  jsr draw_nt
  ; 色の表の写し（nt_field の 960 バイトめから 64）
  lda #<nt_field
  clc
  adc #$c0
  sta ptr
  lda #>nt_field
  adc #3
  sta ptr+1
  ldy #63
@ca:
  lda (ptr),y
  sta ATTR,y
  dey
  bpl @ca
  ; 花の群れ 3 つ: 32×32 の絵（16 ドットの区切り 2×2）と、その所の色。字の段と画面のふちにはかからないように
  ldx #2
@fl:
  stx fi
  lda pd,x
  asl a
  sta tmp
  asl a
  clc
  adc tmp            ; 向き×6
  adc pk,x
  tay
  lda pos_x,y
  sec
  sbc #8
  lsr a
  lsr a
  lsr a
  lsr a
  cmp #15
  bcc @cx
  lda #14
@cx:
  sta tmp3           ; 16 ドットの列（左）
  lda pos_y,y
  sec
  sbc #8
  lsr a
  lsr a
  lsr a
  lsr a
  cmp #2
  bcs @cy
  lda #2
@cy:
  cmp #14
  bcc @cy2
  lda #13
@cy2:
  sta tmp4           ; 16 ドットの行（上）
  ; 番地 = $2000 + 行×64 + 列×2
  lda tmp4
  lsr a
  lsr a
  clc
  adc #$20
  sta tmp2
  lda tmp4
  and #3
  asl a
  asl a
  asl a
  asl a
  asl a
  asl a
  sta tmp
  lda tmp3
  asl a
  ora tmp
  sta tmp
  ldx fi
  lda #T_FL0
  cpx #1
  bne @w
  lda #T_FL1
@w:
  sta ft
  lda #4
  sta cnt
@row:
  lda tmp2
  ldx tmp
  jsr set_addr
  ldy #4
@t:
  lda ft
  sta PPUDATA
  inc ft
  dey
  bne @t
  lda tmp
  clc
  adc #32
  sta tmp
  lda tmp2
  adc #0
  sta tmp2
  dec cnt
  bne @row
  ; 色（4 つの区切り）
  ldx tmp3
  ldy tmp4
  jsr set_attr
  ldx tmp3
  inx
  ldy tmp4
  jsr set_attr
  ldx tmp3
  ldy tmp4
  iny
  jsr set_attr
  ldx tmp3
  inx
  ldy tmp4
  iny
  jsr set_attr
  ldx fi
  dex
  bmi @fd
  jmp @fl
@fd:
  ; 色の表を書く
  lda #$23
  ldx #$c0
  jsr set_addr
  ldy #0
@wa:
  lda ATTR,y
  sta PPUDATA
  iny
  cpy #64
  bne @wa
  jsr hud_now
  lda #M_H_AIM
  jsr say_now
  lda sun
  sta aim_d
  lda #3
  sta aim_k
  lda #0
  sta rep_t
  lda #2
  sta state
  jsr clear_oam
  jsr screen_on
  rts

; 色の表の写しで、16 ドットの区切り（X 列・Y 行）を花の色（パレット 1）に
set_attr:
  stx s16_x
  sty s16_y
  tya
  lsr a
  asl a
  asl a
  asl a
  sta s16_q
  txa
  lsr a
  ora s16_q
  sta s16_q
  lda s16_y
  and #1
  asl a
  asl a
  sta s16_f
  lda s16_x
  and #1
  asl a
  ora s16_f
  tax
  lda #3
  sta s16_t
  lda #1
  sta sgn
  cpx #0
  beq @d
@s:
  asl s16_t
  asl sgn
  dex
  bne @s
@d:
  ldy s16_q
  lda s16_t
  eor #$ff
  and ATTR,y
  ora sgn
  sta ATTR,y
  rts

; ←→ は押しつづけると くりかえす（14 フレームのあと 6 ごと）
aim_update:
  lda pad
  and #BTN_LEFT|BTN_RIGHT
  bne @held
  lda #0
  sta rep_t
  jmp @ud
@held:
  lda pad_new
  and #BTN_LEFT|BTN_RIGHT
  beq @rep
  lda #14
  sta rep_t
  jmp @turn
@rep:
  dec rep_t
  bne @ud
  lda #6
  sta rep_t
@turn:
  lda pad
  and #BTN_RIGHT
  beq @lf
  inc aim_d
  jmp @td
@lf:
  dec aim_d
@td:
  lda aim_d
  and #15
  sta aim_d
  jsr sfx_tick
@ud:
  lda pad_new
  and #BTN_UP
  beq @nu
  lda aim_k
  cmp #5
  beq @nu
  inc aim_k
  jsr sfx_tick
@nu:
  lda pad_new
  and #BTN_DOWN
  beq @nd
  lda aim_k
  cmp #1
  beq @nd
  dec aim_k
  jsr sfx_tick
@nd:
  lda #0
  sta oam_i
  jsr draw_sun
  jsr draw_aim
  jsr hide_rest
  lda pad_new
  and #BTN_A
  beq @r
  lda #0
  sta rr
  lda #3
  sta state
  lda #M_H_FLY
  jsr say
@r:
  rts

; 太陽: 巣から太陽の向きへ 108 ドット（字の段にかからないよう、上は 44 まで）
draw_sun:
  ldx sun
  ldy #108
  jsr pos_off
  lda tx
  clc
  adc #CX
  sta tx
  lda ty
  clc
  adc #CY
  cmp #44
  bcs @y
  lda #44
@y:
  cmp #228
  bcc @y2
  lda #228
@y2:
  sta ty
  lda #S_SUN
  sta s16_t
  lda #1
  sta tmp3
  jmp put16_at

; ねらい: 輪 1 〜 aim_k−1 に白い点、aim_k に輪のしるし
draw_aim:
  lda #1
  sta cnt
@l:
  lda cnt
  cmp aim_k
  beq @t
  jsr ring_pos
  lda ty
  sec
  sbc #4
  sta tmp
  lda tx
  sec
  sbc #4
  sta tmp4
  lda #S_DOT
  sta tmp2
  lda #2
  sta tmp3
  jsr put_spr
  inc cnt
  jmp @l
@t:
  jsr ring_pos
  lda #S_TARGET
  sta s16_t
  lda #2
  sta tmp3
  jmp put16_at

; 向き aim_d・輪 cnt の場所 → tx・ty（まん中）
ring_pos:
  lda aim_d
  asl a
  sta tmp
  asl a
  clc
  adc tmp
  adc cnt
  tay
  lda pos_x,y
  sta tx
  lda pos_y,y
  sta ty
  rts

; 飛んでいく: 2 ドットずつ、ねらった輪まで
out_update:
  lda rr
  clc
  adc #2
  sta rr
  ldx aim_k
  cmp ring_r,x
  bcc @fly
  lda ring_r,x
  sta rr
  jsr eval_gain
  lda #4
  sta state
  lda #0
  sta st_t
  lda gain
  beq @miss
  cmp #10
  beq @hit
  lda #M_H_NEAR
  jsr say
  jsr sfx_near
  jmp @fly
@hit:
  lda #M_H_HIT
  jsr say
  jsr sfx_hit
  jmp @fly
@miss:
  lda #M_H_MISS
  jsr say
  jsr sfx_miss
@fly:
  lda aim_d
  sta sd
  jmp draw_flight

; ハチを巣から rr の所に（向き sd）。太陽とねらいのしるしも
draw_flight:
  ldx aim_d
  ldy rr
  jsr pos_off
  lda tx
  clc
  adc #CX
  sta bx
  lda ty
  clc
  adc #CY
  sta by
  lda #0
  sta oam_i
  jsr draw_bee
  jsr draw_sun
  lda aim_k
  sta cnt
  jsr ring_pos
  lda #S_TARGET
  sta s16_t
  lda #2
  sta tmp3
  jsr put16_at
  jmp hide_rest

; 花で: みつのつぶが上へ（とれたとき）。60 フレームでもどる
flower_update:
  inc st_t
  lda aim_d
  sta sd
  jsr draw_flight
  lda gain
  beq @nd
  lda by
  sec
  sbc #12
  sta tmp
  lda st_t
  lsr a
  lsr a
  sta tmp2
  lda tmp
  sec
  sbc tmp2
  sta tmp
  lda bx
  sec
  sbc #4
  sta tmp4
  lda #S_DROP
  sta tmp2
  lda #3
  sta tmp3
  jsr put_spr
  jsr hide_rest
@nd:
  lda st_t
  cmp #60
  bne @r
  lda #5
  sta state
@r:
  rts

; もどる: 巣へ。着いたら みつを足して、つぎの回か、1日のおわりへ
back_update:
  lda rr
  sec
  sbc #2
  bcs @s
  lda #0
@s:
  sta rr
  lda aim_d
  eor #8
  sta sd
  jsr draw_flight
  lda rr
  bne @r
  lda honey
  clc
  adc gain
  sta honey
  inc flight
  lda flight
  cmp #NFLIGHT
  bne @next
  jmp go_end
@next:
  jmp go_hive
@r:
  rts

; みつ: 3 つの花の群れのうち、いちばん近いもので決める。向きも輪も同じ → 10、どちらか 1 つずれ → 5（においで見つける）
eval_gain:
  lda #0
  sta gain
  ldx #2
@l:
  lda aim_d
  sec
  sbc pd,x
  and #15
  cmp #9
  bcc @a
  eor #$ff
  clc
  adc #1
  and #15
@a:
  sta tmp
  lda aim_k
  sec
  sbc pk,x
  bcs @b
  eor #$ff
  clc
  adc #1
@b:
  clc
  adc tmp
  bne @c
  lda #10
  jmp @set
@c:
  cmp #1
  bne @nx
  lda #5
@set:
  cmp gain
  bcc @nx
  sta gain
@nx:
  dex
  bpl @l
  rts

; ================= 1日のおわり =================
go_end:
  jsr screen_off
  lda #<pal_hive
  sta ptr
  lda #>pal_hive
  sta ptr+1
  jsr load_pal
  lda #<nt_end_0
  ldx #>nt_end_0
  ldy lang
  beq @e0
  lda #<nt_end_1
  ldx #>nt_end_1
@e0:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda honey
  cmp hi
  bcc @nh
  sta hi
  sta SAVE+4
@nh:
  lda #>ADDR_END_TODAY
  ldx #<ADDR_END_TODAY
  jsr set_addr
  lda honey
  jsr num3_ppu
  lda #>ADDR_END_BEST
  ldx #<ADDR_END_BEST
  jsr set_addr
  lda hi
  jsr num3_ppu
  lda #6
  sta state
  lda #0
  sta st_t
  jsr clear_oam
  lda #SONG_END
  jsr music_play
  jsr screen_on
  rts

end_update:
  inc st_t
  lda st_t
  cmp #60
  bcc @r
  lda pad_new
  and #BTN_START|BTN_A
  beq @r
  jmp go_title
@r:
  rts

; ================= 音（矩形波 1 とノイズ。曲は矩形波 2 と三角波） =================
sfx_buzz:
  lda #%00010110
  sta $4000
  lda #$00
  sta $4001
  lda #$80
  sta $4002
  lda #$01
  sta $4003
  rts
sfx_tick:
  lda #%10010011
  sta $4000
  lda #$00
  sta $4001
  lda #$a0
  sta $4002
  lda #$00
  sta $4003
  rts
sfx_hit:
  lda #%10011000
  sta $4000
  lda #%10011010    ; だんだん高く
  sta $4001
  lda #$d0
  sta $4002
  lda #$20
  sta $4003
  rts
sfx_near:
  lda #%10010110
  sta $4000
  lda #$00
  sta $4001
  lda #$e0
  sta $4002
  lda #$10
  sta $4003
  rts
sfx_miss:
  lda #%00011000
  sta $400C
  lda #$0c
  sta $400E
  lda #$10
  sta $400F
  rts

; ================= セーブ（ハイスコア） =================
load_save:
  ldx #3
@c:
  lda SAVE,x
  cmp save_magic,x
  bne @new
  dex
  bpl @c
  lda SAVE+4
  cmp #101
  bcs @new
  sta hi
  rts
@new:
  ldx #3
@w:
  lda save_magic,x
  sta SAVE,x
  dex
  bpl @w
  lda #0
  sta hi
  sta SAVE+4
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 決まりの表 =================
save_magic: .byte 'B', 'D', '0', '1'
; ハチの絵: 向き 0〜15 → 絵（0・22.5・45・67.5・90 度の 5 つ）と裏返し
bee_tile: .byte S_B0A, S_B1A, S_B2A, S_B3A, S_B4A, S_B3A, S_B2A, S_B1A, S_B0A, S_B1A, S_B2A, S_B3A, S_B4A, S_B3A, S_B2A, S_B1A
bee_attr: .byte $00, $00, $00, $00, $00, $80, $80, $80, $80, $C0, $C0, $C0, $C0, $40, $40, $40
; ふる: 8 フレームで 1 回（横へ 0・2・3・2・0・2・3・2 ドット、前半は右・後半は左）
wag_m: .byte 0, 2, 3, 2, 0, 2, 3, 2
wag_s: .byte 0, 0, 0, 0, 8, 8, 8, 8
; もどる半円（32 フレーム）の横のずれ（ドット）
arc: .byte 0, 1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 14, 14, 14, 13, 13, 12, 12, 11, 10, 9, 8, 7, 5, 4, 3, 1
; 見ている仲間
crowd_x: .byte 40, 216, 48, 208
crowd_y: .byte 64, 72, 216, 210
crowd_d: .byte 6, 10, 2, 14
; タイトルの踊りの向き（右・上・左・上）
title_da: .byte 2, 0, 14, 0
