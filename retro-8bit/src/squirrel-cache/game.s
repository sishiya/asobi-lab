; リスの かくしごと（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs squirrel-cache（絵の番号 T_・S_ と地図・字のデータは data.mjs が足す）
; 決まり: 秋、落ちてくるドングリを十字で走って拾い、A でその場にうめる（1 つずつ。ちらして うめる）。
;   カケスや ほかのリスが見ているときに うめると、冬までに とられる。冬は雪で跡が消える。A で掘って、
;   あたりなら食べられる・はずれは時間がへる。ふゆを こすのに いる数を みつけられないと おしまい。
;   見つけられなかったドングリは、春に芽を出して わかい木になる（つぎの年の目じるしにもなる）。5 年で おわり
; 画面: 1 枚の森の地面（16×16 ドットのます 14×12）。地図は RAM の MAP に 1 ます 1 バイト

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
MASK_ON = %00011110

BTN_A = $80
BTN_B = $40
BTN_START = $10
BTN_UP = $08
BTN_DOWN = $04
BTN_LEFT = $02
BTN_RIGHT = $01

F_CACHE = $80      ; ますの印: うめた・見られた・掘った
F_SEEN = $40
F_DUG = $20
K_SAP = 5          ; わかい木
START_CX = 7
START_CY = 8
LAST_YEAR = 5
BAR_MAX = 96       ; 時間の棒（ドット）
MISS_COST = 8      ; はずれで へる時間（棒のドット）
NAC = 3            ; 地面のドングリの数

PH_AINTRO = 0      ; あそぶの中の場面
PH_AUT = 1
PH_AEND = 2
PH_WINTRO = 3
PH_WIN = 4
PH_WEND = 5
PH_REVEAL = 6
PH_SPLATE = 7

; ---- ゼロページ ----
nmi_count = $00
buf_ready = $01
buf_len = $02
frame = $03
pad = $04
pad_old = $05
pad_new = $06
state = $07        ; 0 タイトル・1 あそぶ・2 おわり
rng = $08          ; 2バイト
tmp = $0A
tmp2 = $0B
tmp3 = $0C
tmp4 = $0D
ptr = $0E          ; 2バイト
phase = $10
phase_t = $11
year = $12
sq_cx = $13        ; リスの ます（動いているときは行き先）
sq_cy = $14
sq_x = $15         ; リスの左上のドット
sq_y = $16
sq_dir = $17       ; 0 右・1 左
sq_mv = $18
sq_act = $19       ; うめる・掘るの のこり
carry = $1A
count = $1B        ; 秋: うめた数・冬: みつけた数
goal = $1C         ; 秋: うめる数・冬: いる数
bar_px = $1D
bar_sub = $1E
bar_step = $1F
season = $20       ; 0 秋・1 冬・2 春
lang = $21
caches = $22
left = $23         ; 冬: まだ とられていない うめた ドングリ
trees = $24        ; 芽が出た数（ぜんぶの年）
newrec = $25
oam_i = $26
blink_old = $27
msg_t = $28
spawn_t = $29
pop_t = $2A
pop_kind = $2B
end_t = $2C
mus_on = $2D
paused = $2E
act_kind = $2F     ; 0 なにもしない・1 うめる・2 掘る
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
cell = $3E
ctmp = $3F
score = $40        ; 4 けた
hi = $44           ; 4 けた
ac_st = $48        ; 0 なし・1 落ちている・2 地面
ac_cell = $4B
ac_h = $4E
w_st = $51         ; 見はり 0 カケス・1 ほかのリス。0 いない・1 来る・2 見ている・3 帰る
w_t = $53
w_x = $55
w_y = $57          ; カケス: とまる x・リス: y
w_mark = $59       ; 「！」の のこり
w_dir = $5B        ; 0 左から・1 右から
rev_i = $5D
sprouts = $5E      ; この春に芽が出た数
oam_full = $5F
pop_x = $66
pop_y = $67
fea_n = $68
fea_cell = $69     ; 8 こ（とられた所）
end_kind = $71     ; 0 たりない・1 5 年いきた・2 つぎの年
dig4 = $72         ; 4 けたの数を書くときの入れもの
demo_t = $76
inp = $7A
yi = $7B           ; year - 1（表を引く）
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "SQ01"・いちばん多く みつけた数 4 けた

OAM = $0200
BUF = $0300
MAP = $0400

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
  lda #$5b
  sta rng
  lda #$c3
  sta rng+1
  jsr load_save
  lda #CTRL_ON
  sta PPUCTRL
  jsr go_title

main:
  jsr read_pad
  lda state
  bne @n1
  jsr title_update
  jmp @done
@n1:
  cmp #1
  bne @n2
  jsr play_update
  jmp @done
@n2:
  jsr end_update
@done:
  jsr music_update
  jsr wait_frame
  jmp main

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

; 季節のパレット（season）を書く（画面を消してから）
load_palette:
  lda season
  bne @n0
  lda #<pal_aut
  ldx #>pal_aut
  jmp @go
@n0:
  cmp #1
  bne @n1
  lda #<pal_win
  ldx #>pal_win
  jmp @go
@n1:
  lda #<pal_spr
  ldx #>pal_spr
@go:
  sta ptr
  stx ptr+1
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

; ます X の絵の番号（季節こみ）→ A。X はこわさない
cell_mt:
  lda MAP,x
  and #$0F
  bne @kind
  lda MAP,x
  bpl @nc
  ldy season           ; うめた あと（秋だけ見える）
  bne @nc
  lda #16
  rts
@nc:
  lda MAP,x
  and #F_DUG
  beq @g
  ldy season
  cpy #1
  bne @g
  lda #17+NMT          ; 冬の穴
  rts
@g:
  txa                  ; 地面のちがい
  lsr a
  lsr a
  lsr a
  lsr a
  sta ctmp
  txa
  eor ctmp
  and #15
  tay
  lda gvar,y
@kind:
  ldy season
  cpy #1
  bne @r
  clc
  adc #NMT
@r:
  rts

; 地図を まるごと画面の表へ（画面を消してから）。絵 960 バイトのあとに属性 64 バイト
draw_map:
  bit PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #0
  sta PPUADDR
  sta cell
@row:
  lda #0
  sta tmp3
@half:
  ldx cell
  lda #16
  sta tmp4
@c:
  jsr cell_mt
  tay
  lda tmp3
  bne @bot
  lda mt_tl,y
  sta PPUDATA
  lda mt_tr,y
  sta PPUDATA
  jmp @nx
@bot:
  lda mt_bl,y
  sta PPUDATA
  lda mt_br,y
  sta PPUDATA
@nx:
  inx
  dec tmp4
  bne @c
  lda tmp3
  bne @nr
  inc tmp3
  jmp @half
@nr:
  lda cell
  clc
  adc #16
  sta cell
  cmp #$F0
  bne @row
  ; 属性: 2×2 ますずつ
  lda #0
  sta cell             ; 左上のます
@at:
  ldx cell
  txa
  clc
  adc #17
  tax
  jsr cell_pal
  asl a
  asl a
  sta tmp4
  ldx cell
  txa
  clc
  adc #16
  tax
  jsr cell_pal
  ora tmp4
  asl a
  asl a
  sta tmp4
  ldx cell
  inx
  jsr cell_pal
  ora tmp4
  asl a
  asl a
  sta tmp4
  ldx cell
  jsr cell_pal
  ora tmp4
  sta PPUDATA
  lda cell
  clc
  adc #2
  sta cell
  and #15
  bne @at
  lda cell
  clc
  adc #16
  sta cell
  bne @at
  rts

cell_pal:
  jsr cell_mt
  tay
  lda mt_pal,y
  rts

; ます X を書きかえる（書くものへ。上と下の 2 行）
buf_cell:
  stx cell
  txa                  ; 番地 = $2000 + cy*64 + cx*2
  lsr a
  lsr a
  lsr a
  lsr a
  sta ctmp             ; cy
  lsr a
  lsr a
  clc
  adc #$20
  sta tmp2             ; 上
  lda ctmp
  and #3
  lsr a
  ror a
  ror a
  sta tmp4             ; (cy&3)*64
  txa
  and #15
  asl a
  ora tmp4
  sta tmp4             ; 下
  jsr cell_mt
  sta tmp3
  ldy buf_len
  lda tmp2
  sta BUF,y
  lda tmp4
  sta BUF+1,y
  lda #2
  sta BUF+2,y
  ldx tmp3
  lda mt_tl,x
  sta BUF+3,y
  lda mt_tr,x
  sta BUF+4,y
  lda tmp2
  sta BUF+5,y
  lda tmp4
  clc
  adc #32
  sta BUF+6,y
  lda #2
  sta BUF+7,y
  lda mt_bl,x
  sta BUF+8,y
  lda mt_br,x
  sta BUF+9,y
  tya
  clc
  adc #10
  sta buf_len
  ldx cell
  rts

; 板: tmp = 上の行・tmp2 = 行の数（4 の倍数）。列 4〜27。属性もパレット 3 に（画面を消してから）
draw_plate:
  lda tmp
  sta tmp3             ; いまの行
  lda #0
  sta tmp4             ; 何行め
@row:
  lda tmp3             ; 番地 = $2000 + row*32 + 4
  lsr a
  lsr a
  lsr a
  clc
  adc #$20
  bit PPUSTATUS
  sta PPUADDR
  lda tmp3
  asl a
  asl a
  asl a
  asl a
  asl a
  ora #4
  sta PPUADDR
  ldx #0               ; 0 上・1 中・2 下
  lda tmp4
  beq @k
  inx
  clc
  adc #1
  cmp tmp2
  bne @k
  inx
@k:
  lda plate_l,x
  sta PPUDATA
  lda plate_m,x
  ldy #22
@m:
  sta PPUDATA
  dey
  bne @m
  lda plate_r,x
  sta PPUDATA
  inc tmp3
  inc tmp4
  lda tmp4
  cmp tmp2
  bne @row
  ; 属性（行 tmp / 4 から tmp2 / 4 だけ、列 1〜6）
  lda tmp
  lsr a
  lsr a
  sta tmp3             ; ay
  lda tmp2
  lsr a
  lsr a
  sta tmp4
@ar:
  lda #$23
  sta PPUADDR
  lda tmp3
  asl a
  asl a
  asl a
  ora #$C1
  sta PPUADDR
  lda #$FF
  ldy #6
@aw:
  sta PPUDATA
  dey
  bne @aw
  inc tmp3
  dec tmp4
  bne @ar
  rts

; ptr の字のデータ（番地・長さ・中身）を、画面を消したまま書く
vram_msg:
  bit PPUSTATUS
  ldy #0
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  tax
  iny
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  dex
  bne @l
  rts

; A = 字の番号 → 画面を消したまま書き、# の所に tmp4 の数字
say_now:
  jsr say_ptr
  txa
  pha
  jsr vram_msg
  pla
  tax
  lda md_hi,x
  beq @r
  bit PPUSTATUS
  sta PPUADDR
  lda md_lo,x
  sta PPUADDR
  lda tmp4
  clc
  adc #T_0
  sta PPUDATA
@r:
  rts

; 4 けたの数を、画面を消したまま書く: A = 番地の上・tmp = 下・X = ゼロページの数の場所
vram_digits:
  bit PPUSTATUS
  sta PPUADDR
  lda tmp
  sta PPUADDR
  ldy #4
@l:
  lda $00,x
  clc
  adc #T_0
  sta PPUDATA
  inx
  dey
  bne @l
  rts

buf_byte:
  ldy buf_len
  sta BUF,y
  inc buf_len
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

; A = 字の番号（M_…）→ ptr にことばの字・X に表の番号
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

; 字の段に出す（書くものへ）
say_buf:
  jsr say_ptr
  jmp buf_data

; スプライト1つ: tmp = y・tmp2 = 絵・tmp3 = 色と向き・tmp4 = x（X はこわさない）
put_spr:
  lda oam_full
  bne @r
  ldy oam_i
  lda tmp
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
  bne @r
  inc oam_full
@r:
  rts

; 16×16 のスプライト（tmp2 から 4 枚）。tmp3 の $40 で左右を返す（X はこわさない）
put16:
  lda tmp3
  and #$40
  bne @flip
  jsr put_spr
  inc tmp2
  jsr @rx
  jsr put_spr
  inc tmp2
  jsr @lx
  jsr @dy
  jsr put_spr
  inc tmp2
  jsr @rx
  jsr put_spr
  rts
@flip:
  jsr @rx
  jsr put_spr
  inc tmp2
  jsr @lx
  jsr put_spr
  inc tmp2
  jsr @rx
  jsr @dy
  jsr put_spr
  inc tmp2
  jsr @lx
  jsr put_spr
  rts
@rx:
  lda tmp4
  clc
  adc #8
  sta tmp4
  rts
@lx:
  lda tmp4
  sec
  sbc #8
  sta tmp4
  rts
@dy:
  lda tmp
  clc
  adc #8
  sta tmp
  rts

oam_start:
  lda #0
  sta oam_i
  sta oam_full
  rts

hide_rest:
  lda oam_full
  bne @r
  ldx oam_i
  lda #$ff
@l:
  sta OAM,x
  inx
  inx
  inx
  inx
  bne @l
@r:
  rts

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

; ================= 地図 =================
; ふちを作り、ptr の目じるし（ます・種類 … $FF）をおく
init_map:
  ldx #0
@l:
  txa
  lsr a
  lsr a
  lsr a
  lsr a
  sta ctmp             ; cy
  txa
  and #15
  sta tmp4             ; cx
  lda ctmp
  beq @hud
  cmp #15
  beq @hud
  cmp #1
  beq @can
  cmp #14
  beq @bush
  lda tmp4
  beq @tl
  cmp #15
  beq @tr
  lda #0
  jmp @put
@hud:
  lda #12
  jmp @put
@can:
  lda tmp4
  and #1
  clc
  adc #10
  jmp @put
@bush:
  lda tmp4
  and #1
  clc
  adc #8
  jmp @put
@tl:
  lda #6
  jmp @put
@tr:
  lda #7
@put:
  sta MAP,x
  inx
  bne @l
  ldy #0
@m:
  lda (ptr),y
  cmp #$FF
  beq @r
  tax
  iny
  lda (ptr),y
  sta MAP,x
  iny
  jmp @m
@r:
  rts

; リスのいるます → A
sq_idx:
  lda sq_cy
  asl a
  asl a
  asl a
  asl a
  ora sq_cx
  rts

place_sq:
  lda sq_cx
  asl a
  asl a
  asl a
  asl a
  sta sq_x
  lda sq_cy
  asl a
  asl a
  asl a
  asl a
  sta sq_y
  lda #0
  sta sq_mv
  sta sq_act
  rts

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
  lda #0
  sta state
  sta season
  sta paused
  sta blink_old
  sta msg_t
  sta pop_t
  sta fea_n
  lda #<lay_title
  sta ptr
  lda #>lay_title
  sta ptr+1
  jsr init_map
  jsr load_palette
  jsr draw_map
  lda #4
  sta tmp
  lda #8
  sta tmp2
  jsr draw_plate
  lda #16
  sta tmp
  lda #12
  sta tmp2
  jsr draw_plate
  lda #<m_ktop
  sta ptr
  lda #>m_ktop
  sta ptr+1
  jsr vram_msg
  lda #<m_kbot
  sta ptr
  lda #>m_kbot
  sta ptr+1
  jsr vram_msg
  lda #<m_name
  sta ptr
  lda #>m_name
  sta ptr+1
  jsr vram_msg
  lda #<m_lab
  sta ptr
  lda #>m_lab
  sta ptr+1
  jsr vram_msg
  lda #<m_hi
  sta ptr
  lda #>m_hi
  sta ptr+1
  jsr vram_msg
  lda #<ADDR_THI
  sta tmp
  lda #>ADDR_THI
  ldx #hi
  jsr vram_digits
  lda #M_HOW1
  jsr say_now
  lda #M_HOW2
  jsr say_now
  lda #M_HOW3
  jsr say_now
  lda #2
  sta sq_cx
  lda #7
  sta sq_cy
  lda #0
  sta sq_dir
  sta demo_t
  jsr place_sq
  lda #SONG_MAIN
  jsr music_play
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

title_update:
  ; START を おしてね（点めつ）
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jsr say_buf
  jmp @same
@off:
  lda #M_PUSH_OFF
  jsr say_buf
@same:
  ; 見本: 帯の上を走り、4 ますごとに止まって掘る
  lda #0
  sta inp
  lda sq_mv
  ora sq_act
  bne @go
  inc demo_t
  lda demo_t
  cmp #40
  bne @n40
  lda #40
  sta sq_act
  lda #0
  sta act_kind
  jmp @go
@n40:
  cmp #100
  bcc @go
  lda sq_cx
  cmp #13
  bcc @nr
  lda #1
  sta sq_dir
@nr:
  lda sq_cx
  cmp #3
  bcs @nl
  lda #0
  sta sq_dir
@nl:
  lda #BTN_RIGHT
  ldx sq_dir
  beq @rt
  lda #BTN_LEFT
@rt:
  sta inp
  lda demo_t
  cmp #101
  bcc @go
  lda sq_cx
  and #3
  bne @go
  lda #0
  sta demo_t
  sta inp
@go:
  jsr move_sq
  jsr oam_start
  jsr draw_squirrel
  lda #15              ; 枝のカケス
  sta tmp
  lda #S_JAYA
  ldx frame
  cpx #128
  bcc @j
  lda #S_JAYB
@j:
  sta tmp2
  lda #$42
  sta tmp3
  lda #196
  sta tmp4
  jsr put16
  jsr hide_rest
  lda pad_new
  and #BTN_START
  beq @r
  jsr start_game
@r:
  rts

; ================= あそぶ =================
start_game:
  lda frame
  eor rng
  sta rng
  ldx #3
  lda #0
@z:
  sta score,x
  dex
  bpl @z
  sta trees
  sta newrec
  lda #1
  sta year
  sta state
  jsr rand
  and #3
  tax
  lda lay_lo,x
  sta ptr
  lda lay_hi,x
  sta ptr+1
  jsr init_map
  lda #START_CX
  sta sq_cx
  lda #START_CY
  sta sq_cy
  lda #0
  sta sq_dir
  jsr place_sq
  jmp begin_autumn

begin_autumn:
  lda year
  sec
  sbc #1
  sta yi
  tax
  lda #0
  sta season
  sta count
  sta caches
  sta carry
  sta bar_sub
  sta msg_t
  sta pop_t
  sta fea_n
  sta w_mark
  sta w_mark+1
  sta w_st
  sta w_st+1
  sta phase_t
  sta act_kind
  sta sq_act
  ldy #NAC-1
@a:
  sta ac_st,y
  dey
  bpl @a
  lda tab_k,x
  sta goal
  lda tab_astep,x
  sta bar_step
  lda #BAR_MAX
  sta bar_px
  lda tab_away,x
  lsr a
  sta w_t              ; はじめの カケスは 少し早く
  lda #160
  sta w_t+1
  lda #20
  sta spawn_t
  lda #PH_AINTRO
  sta phase
  jsr screen_off
  jsr load_palette
  jsr draw_map
  jsr plate12
  lda year
  sta tmp4
  lda #M_IA1
  jsr say_now
  lda goal
  sta tmp4
  lda #M_IA2
  jsr say_now
  lda #M_IA3
  jsr say_now
  jmp intro_on

begin_winter:
  ldx yi
  lda #1
  sta season
  lda #0
  sta count
  sta carry
  sta bar_sub
  sta msg_t
  sta phase_t
  sta act_kind
  sta sq_act
  sta w_st
  sta w_st+1
  sta w_mark
  sta w_mark+1
  sta left
  ldy #NAC-1
@a:
  sta ac_st,y
  dey
  bpl @a
  lda tab_need,x
  sta goal
  lda tab_wstep,x
  sta bar_step
  lda #BAR_MAX
  sta bar_px
  ldx #0               ; まだ とられていない うめた数
@c:
  lda MAP,x
  bpl @cn
  and #F_SEEN
  bne @cn
  inc left
@cn:
  inx
  bne @c
  lda #PH_WINTRO
  sta phase
  jsr screen_off
  jsr load_palette
  jsr draw_map
  jsr plate12
  lda year
  sta tmp4
  lda #M_IW1
  jsr say_now
  lda #M_IW2
  jsr say_now
  lda goal
  sta tmp4
  lda #M_IW3
  jsr say_now
  jmp intro_on

begin_spring:
  lda #2
  sta season
  ldx #0               ; 掘ったます（みつけた・はずれ）は もとの地面に
@c:
  lda MAP,x
  and #F_DUG
  beq @cn
  lda MAP,x
  and #$0F
  sta MAP,x
@cn:
  inx
  bne @c
  lda #0
  sta rev_i
  sta sprouts
  sta fea_n
  sta phase_t
  sta msg_t
  lda #PH_REVEAL
  sta phase
  jsr screen_off
  jsr load_palette
  jsr draw_map
  jsr hud_static
  jsr oam_start
  jsr hide_rest
  jmp screen_on

plate12:
  lda #12
  sta tmp
  lda #8
  sta tmp2
  jmp draw_plate

; 季節のはじめの板を出したまま画面をつける
intro_on:
  jsr hud_static
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

; 板を消して、あそぶ
intro_off:
  jsr screen_off
  jsr draw_map
  jsr hud_static
  jsr screen_on
  inc phase
  lda #0
  sta phase_t
  rts

; 字の段: 季節のことばと、時間の棒のはし
hud_static:
  jsr season_word
  jsr say_ptr
  jsr vram_msg
  bit PPUSTATUS
  lda season
  cmp #2
  beq @r
  lda #>ADDR_BARL
  sta PPUADDR
  lda #<ADDR_BARL
  sta PPUADDR
  lda #T_BARL
  sta PPUDATA
  lda #>ADDR_BARR
  sta PPUADDR
  lda #<ADDR_BARR
  sta PPUADDR
  lda #T_BARR
  sta PPUDATA
  jsr hud_cnt_now
@r:
  rts

season_word:
  lda season
  bne @w
  lda #M_ST_AUT
  rts
@w:
  cmp #1
  bne @s
  lda #M_ST_WIN
  rts
@s:
  lda #M_ST_SPR
  rts

; 数と棒を画面を消したまま
hud_cnt_now:
  jsr hud_update
  ldx #0
@l:
  cpx buf_len
  beq @d
  lda BUF,x
  sta PPUADDR
  lda BUF+1,x
  sta PPUADDR
  ldy BUF+2,x
  inx
  inx
  inx
@b:
  lda BUF,x
  sta PPUDATA
  inx
  dey
  bne @b
  jmp @l
@d:
  lda #0
  sta buf_len
  rts

; 字の段の数（count / goal）と時間の棒を書くものへ
hud_update:
  ldy buf_len
  lda #>ADDR_CNT
  sta BUF,y
  lda #<ADDR_CNT
  sta BUF+1,y
  lda #3
  sta BUF+2,y
  lda count
  clc
  adc #T_0
  sta BUF+3,y
  lda #T_SLASH
  sta BUF+4,y
  lda goal
  clc
  adc #T_0
  sta BUF+5,y
  lda #>ADDR_BAR
  sta BUF+6,y
  lda #<ADDR_BAR
  sta BUF+7,y
  lda #12
  sta BUF+8,y
  tya
  clc
  adc #9
  tay
  lda bar_px
  sta tmp
  ldx #12
@b:
  lda tmp
  cmp #8
  bcc @part
  sbc #8
  sta tmp
  lda #T_BAR0+8
  jmp @put
@part:
  clc
  adc #T_BAR0
  pha
  lda #0
  sta tmp
  pla
@put:
  sta BUF,y
  iny
  dex
  bne @b
  sty buf_len
  rts

play_update:
  lda phase
  cmp #PH_AUT
  beq @canp
  cmp #PH_WIN
  bne @np
@canp:
  lda pad_new
  and #BTN_START
  beq @np
  lda paused
  eor #1
  sta paused
  beq @np
  lda #$30
  sta $4004
  lda #$80
  sta $4008
  sta $400B
@np:
  lda paused
  beq @run
  rts
@run:
  inc phase_t
  bne @nt
  dec phase_t          ; 255 で止める
@nt:
  lda phase
  asl a
  tax
  lda ph_tab+1,x
  pha
  lda ph_tab,x
  pha
  rts                  ; 場面ごとの係へ
ph_tab:
  .word ph_intro-1, ph_autumn-1, ph_aend-1, ph_intro-1, ph_winter-1, ph_wend-1, ph_reveal-1, ph_splate-1

; 季節のはじめの板: 2 秒半か A で消える
ph_intro:
  jsr hud_update
  lda phase_t
  cmp #120
  bcs @off
  cmp #24
  bcc @r
  lda pad_new
  and #BTN_A|BTN_B|BTN_START
  beq @r
@off:
  jmp intro_off
@r:
  rts

ph_autumn:
  jsr tick_bar
  lda pad
  sta inp
  jsr move_sq
  jsr try_act
  jsr acorns
  jsr watchers
  jsr pickup
  jsr msg_tick
  jsr draw_all
  jsr hud_update
  lda sq_act
  bne @r
  lda count
  cmp goal
  beq @end
  lda bar_px
  bne @r
@end:
  lda #PH_AEND
  sta phase
  lda #0
  sta phase_t
@r:
  rts

ph_aend:
  jsr msg_tick
  jsr draw_all
  jsr hud_update
  lda phase_t
  cmp #50
  bcc @r
  jmp begin_winter
@r:
  rts

ph_winter:
  jsr tick_bar
  lda pad
  sta inp
  jsr move_sq
  jsr try_act
  jsr msg_tick
  jsr draw_all
  jsr hud_update
  lda sq_act
  bne @r
  lda left
  beq @end
  lda bar_px
  bne @r
@end:
  lda #PH_WEND
  sta phase
  lda #0
  sta phase_t
@r:
  rts

ph_wend:
  jsr msg_tick
  jsr draw_all
  jsr hud_update
  lda phase_t
  cmp #60
  bcc @r
  jmp begin_spring
@r:
  rts

; 春: 雪がとけ、のこったドングリから 1 つずつ芽が出る（とられた所は から）
ph_reveal:
  jsr draw_all
  lda phase_t
  cmp #20
  bcc @r
  lda frame
  and #15
  bne @r
  ldx rev_i
@f:
  lda MAP,x
  bmi @got
  inx
  bne @f
  ; もう ない: 少し待って 板
  lda #255
  sta rev_i
  lda #PH_SPLATE
  sta phase
  lda #0
  sta phase_t
  rts
@got:
  inx
  stx rev_i
  dex
  lda MAP,x
  and #F_SEEN
  beq @sprout
  lda #0               ; とられた: から
  sta MAP,x
  lda fea_n
  cmp #8
  bcs @nf
  tay
  txa
  sta fea_cell,y
  inc fea_n
@nf:
  jsr sfx_steal
  rts
@sprout:
  lda #K_SAP
  sta MAP,x
  jsr buf_cell
  inc sprouts
  inc trees
  jsr sfx_sprout
@r:
  rts

ph_splate:
  lda phase_t
  cmp #40
  bne @wait
  ; 板を出す
  ldx #0               ; 0 たりない・1 5 年いきた・2 つぎの年
  lda count
  cmp goal
  bcc @k
  ldx #1
  lda year
  cmp #LAST_YEAR
  bcs @k
  ldx #2
@k:
  stx end_kind
  jsr screen_off
  jsr draw_map
  jsr hud_static
  jsr plate12
  lda #M_IS1
  jsr say_now
  lda sprouts
  sta tmp4
  lda #M_IS2
  jsr say_now
  lda end_kind
  clc
  adc #M_IS3A
  jsr say_now
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts
@wait:
  bcs @shown
  jmp draw_all
@shown:
  cmp #200
  bcs @next
  cmp #80
  bcc @r
  lda pad_new
  and #BTN_A|BTN_B|BTN_START
  beq @r
@next:
  lda end_kind
  cmp #2
  bne @over
  inc year
  jmp begin_autumn
@over:
  jmp go_end
@r:
  rts

; 時間の棒をへらす
tick_bar:
  inc bar_sub
  lda bar_sub
  cmp bar_step
  bcc @r
  lda #0
  sta bar_sub
  lda bar_px
  beq @r
  dec bar_px
@r:
  rts

; 字の段のお知らせを もとにもどす
msg_tick:
  lda msg_t
  beq @r
  dec msg_t
  bne @r
  jsr season_word
  jmp say_buf
@r:
  rts

; A = 字の番号を字の段に 1 秒半
alert:
  jsr say_buf
  lda #90
  sta msg_t
  rts

; ---- リスが走る（inp の十字） ----
move_sq:
  lda sq_act
  beq @free
  dec sq_act
  bne @r
  jmp act_done
@free:
  lda sq_mv
  beq @idle
  lda sq_cx
  asl a
  asl a
  asl a
  asl a
  cmp sq_x
  beq @yy
  bcc @xl
  inc sq_x
  inc sq_x
  jmp @chk
@xl:
  dec sq_x
  dec sq_x
@yy:
  lda sq_cy
  asl a
  asl a
  asl a
  asl a
  cmp sq_y
  beq @chk
  bcc @yu
  inc sq_y
  inc sq_y
  jmp @chk
@yu:
  dec sq_y
  dec sq_y
@chk:
  lda sq_cx
  asl a
  asl a
  asl a
  asl a
  cmp sq_x
  bne @r
  lda sq_cy
  asl a
  asl a
  asl a
  asl a
  cmp sq_y
  bne @r
  lda #0
  sta sq_mv
@r:
  rts
@idle:
  lda inp
  and #BTN_UP
  beq @nu
  lda #$F0             ; -16
  jmp @try
@nu:
  lda inp
  and #BTN_DOWN
  beq @nd
  lda #16
  jmp @try
@nd:
  lda inp
  and #BTN_LEFT
  beq @nl
  lda #1
  sta sq_dir
  lda #$FF
  jmp @try
@nl:
  lda inp
  and #BTN_RIGHT
  beq @r
  lda #0
  sta sq_dir
  lda #1
@try:
  sta tmp
  jsr sq_idx
  clc
  adc tmp
  tax
  lda MAP,x
  and #$0F
  beq @ok
  cmp #K_SAP
  bne @r
@ok:
  txa
  and #15
  sta sq_cx
  txa
  lsr a
  lsr a
  lsr a
  lsr a
  sta sq_cy
  lda #1
  sta sq_mv
  jmp @free

; ---- A: うめる（秋）・掘る（冬） ----
try_act:
  lda sq_mv
  ora sq_act
  bne @r
  lda pad_new
  and #BTN_A|BTN_B
  beq @r
  jsr sq_idx
  tax
  lda season
  bne @dig
  lda carry
  beq @r
  lda MAP,x            ; なにもない地面だけ（印もなし）
  bne @no
  ldy #NAC-1           ; ドングリが ころがっている所も だめ
@ac:
  lda ac_st,y
  beq @an
  txa
  cmp ac_cell,y
  beq @no
@an:
  dey
  bpl @ac
  lda #1
  sta act_kind
  lda #24
  sta sq_act
  jsr sfx_dig
  rts
@dig:
  lda MAP,x
  and #$0F
  bne @no
  lda MAP,x
  and #F_DUG
  bne @no
  lda #2
  sta act_kind
  lda #20
  sta sq_act
  jsr sfx_dig
@r:
  rts
@no:
  jsr sfx_no
  rts

act_done:
  jsr sq_idx
  tax
  lda act_kind
  cmp #1
  beq @bury
  cmp #2
  beq @dig
  rts
@bury:
  lda #0
  sta carry
  inc count
  inc caches
  lda MAP,x
  ora #F_CACHE
  sta MAP,x
  jsr buf_cell
  jsr sfx_pat
  ; 見られていたか
  lda #0
  sta tmp4
  ldy #1
@w:
  lda w_st,y
  cmp #2
  bne @wn
  lda #50
  sta w_mark,y
  inc tmp4
@wn:
  dey
  bpl @w
  lda tmp4
  beq @r
  lda MAP,x
  ora #F_SEEN
  sta MAP,x
  lda #M_ST_SEEN
  jsr alert
  jsr sfx_seen
@r:
  rts
@dig:
  lda MAP,x
  ora #F_DUG
  sta MAP,x
  jsr buf_cell
  lda MAP,x
  bmi @cache
  ; はずれ: 時間がへる
  lda bar_px
  sec
  sbc #MISS_COST
  bcs @bp
  lda #0
@bp:
  sta bar_px
  lda #M_ST_MISS
  jsr alert
  jmp sfx_miss
@cache:
  jsr pop_here
  lda MAP,x
  and #F_SEEN
  beq @found
  lda #1               ; とられていた: から
  sta pop_kind
  lda #M_ST_STOLEN
  jsr alert
  jmp sfx_steal
@found:
  lda #0
  sta pop_kind
  inc count
  dec left
  jsr score_inc
  lda #M_ST_FOUND
  jsr alert
  jmp sfx_found

pop_here:
  lda sq_x
  clc
  adc #4
  sta pop_x
  lda sq_y
  sta pop_y
  lda #36
  sta pop_t
  rts

score_inc:
  ldx #3
@l:
  inc score,x
  lda score,x
  cmp #10
  bcc @r
  lda #0
  sta score,x
  dex
  bpl @l
@r:
  rts

; ---- ドングリが落ちてくる・拾う ----
acorns:
  dec spawn_t
  beq @spawn
  jmp @upd
@spawn:
  jsr rand
  and #31
  clc
  adc #22
  sta spawn_t
  ; いまの数（地面・落ちている・持っている・うめた）が うめる数＋1 より少ないときだけ
  lda count
  clc
  adc carry
  sta tmp
  ldy #NAC-1
  ldx #$FF
@cnt:
  lda ac_st,y
  beq @fr
  inc tmp
  jmp @cn
@fr:
  tya
  tax
@cn:
  dey
  bpl @cnt
  cpx #$FF
  beq @upd
  lda goal
  clc
  adc #1
  cmp tmp
  bcc @upd
  beq @upd
  stx tmp3             ; あいている入れもの
  lda #8
  sta tmp2
@try:
  jsr rand
  and #15
  beq @again
  cmp #15
  beq @again
  sta tmp4
  jsr rand
  and #15
  cmp #2
  bcc @again
  cmp #14
  bcs @again
  asl a
  asl a
  asl a
  asl a
  ora tmp4
  tax
  lda MAP,x
  bne @again
  jsr sq_idx
  sta tmp
  cpx tmp
  beq @again
  ldy #NAC-1
@dup:
  lda ac_st,y
  beq @dn
  txa
  cmp ac_cell,y
  beq @again
@dn:
  dey
  bpl @dup
  ldy tmp3
  txa
  sta ac_cell,y
  lda #1
  sta ac_st,y
  lda #64
  sta ac_h,y
  jmp @upd
@again:
  dec tmp2
  bne @try
@upd:
  ldy #NAC-1
@u:
  lda ac_st,y
  cmp #1
  bne @un
  lda ac_h,y
  sec
  sbc #3
  bcs @hh
  lda #0
@hh:
  sta ac_h,y
  bne @un
  lda #2
  sta ac_st,y
  tya
  pha
  jsr sfx_thud
  pla
  tay
@un:
  dey
  bpl @u
  rts

pickup:
  lda carry
  bne @r
  lda sq_mv
  ora sq_act
  bne @r
  jsr sq_idx
  sta tmp
  ldy #NAC-1
@l:
  lda ac_st,y
  cmp #2
  bne @n
  lda ac_cell,y
  cmp tmp
  bne @n
  lda #0
  sta ac_st,y
  lda #1
  sta carry
  jmp sfx_pick
@n:
  dey
  bpl @l
@r:
  rts

; ---- 見はり（0 カケス・1 ほかのリス） ----
jay_upd:
  lda w_st
  bne @j1
  dec w_t
  beq @come
  rts
@come:
  jsr rand             ; 来る: 左か右から、枝の どこかへ
  and #1
  sta w_dir
  tay
  lda w_from,y
  sta w_x
  jsr rand
  and #127
  clc
  adc #56
  sta w_y              ; とまる x
  lda #1
  sta w_st
  jsr sfx_jay
  rts
@j1:
  cmp #1
  bne @j2
  lda w_x
  cmp w_y
  beq @perch
  bcc @jr
  dec w_x
  dec w_x
  lda w_x
  cmp w_y
  bcs @r1
  lda w_y
  sta w_x
  rts
@jr:
  inc w_x
  inc w_x
  lda w_x
  cmp w_y
  bcc @r1
  lda w_y
  sta w_x
  rts
@r1:
  rts
@perch:
  lda #2
  sta w_st
  lda tab_watch,x
  sta w_t
  rts
@j2:
  cmp #2
  bne @j3
  dec w_t
  bne @r2
  lda #3
  sta w_st
  rts
@r2:
  rts
@j3:
  lda w_dir            ; 来た方へ帰る
  bne @jgr
  lda w_x
  sec
  sbc #3
  sta w_x
  bcs @r3
  jmp @jgone
@jgr:
  lda w_x
  clc
  adc #3
  sta w_x
  bcc @r3
@jgone:
  lda #0
  sta w_st
  jsr rand
  and #63
  clc
  adc tab_away,x
  sta w_t
  rts
@r3:
  rts

watchers:
  ldx yi
  jsr jay_upd
  ; ほかのリス（3 年めから）
  lda tab_rival,x
  beq @r
  lda w_st+1
  bne @s1
  dec w_t+1
  bne @r
  jsr rand
  and #1
  sta w_dir+1
  tay
  lda r_from,y
  sta w_x+1
  jsr rand             ; 高さ: 3〜12 行め
  and #7
  clc
  adc #3
  asl a
  asl a
  asl a
  asl a
  sta w_y+1
  lda #1
  sta w_st+1
  rts
@s1:
  cmp #1
  bne @s2
  ldy w_dir+1
  lda w_x+1
  cmp r_peek,y
  beq @spe
  clc
  adc r_step,y
  sta w_x+1
  rts
@spe:
  lda #2
  sta w_st+1
  lda tab_watch,x
  sta w_t+1
  rts
@s2:
  cmp #2
  bne @s3
  dec w_t+1
  bne @r
  lda #3
  sta w_st+1
  rts
@s3:
  ldy w_dir+1
  lda w_x+1
  cmp r_from,y
  beq @sgone
  sec
  sbc r_step,y
  sta w_x+1
  rts
@sgone:
  lda #0
  sta w_st+1
  jsr rand
  and #63
  clc
  adc tab_away,x
  sta w_t+1
@r:
  rts

; ---- 絵 ----
draw_all:
  jsr oam_start
  ; 「！」と「目」（見はりの上）
  ldx #1
@mk:
  lda w_st,x
  beq @mn
  lda w_mark,x
  beq @eye
  dec w_mark,x
  jsr mark_pos
  lda #S_WARN
  sta tmp2
  lda #3
  sta tmp3
  jsr put_spr
  inc tmp2
  lda tmp
  clc
  adc #8
  sta tmp
  jsr put_spr
  jmp @mn
@eye:
  lda w_st,x
  cmp #2
  bne @mn
  lda frame
  and #16
  beq @mn
  jsr mark_pos
  lda #S_EYE
  sta tmp2
  lda #3
  sta tmp3
  jsr put_spr
@mn:
  dex
  bpl @mk
  ; 出てきたドングリ・から
  lda pop_t
  beq @np
  dec pop_t
  lda pop_t
  lsr a
  lsr a
  clc
  adc pop_y
  sec
  sbc #10
  sta tmp
  lda pop_x
  sta tmp4
  lda #1
  sta tmp3
  lda #S_ACORN
  ldy pop_kind
  beq @pk
  lda #S_SHELL
@pk:
  sta tmp2
  jsr put_spr
@np:
  ; 持っているドングリ（口に）
  lda carry
  beq @nc
  lda sq_y
  clc
  adc #6
  sta tmp
  lda #S_ACORN
  sta tmp2
  lda #1
  sta tmp3
  lda sq_x
  ldy sq_dir
  bne @cl
  clc
  adc #10
  jmp @cx
@cl:
  sec
  sbc #2
@cx:
  sta tmp4
  jsr put_spr
@nc:
  jsr draw_squirrel
  ; カケス
  lda w_st
  beq @nj
  lda #15
  sta tmp
  lda w_st
  cmp #2
  beq @perch
  lda #9               ; 飛んでいる
  sta tmp
  lda frame
  and #4
  beq @jf
  lda #S_JAYFB
  jmp @jt
@jf:
  lda #S_JAYFA
  jmp @jt
@perch:
  lda frame
  and #64
  beq @ja
  lda #S_JAYB
  jmp @jt
@ja:
  lda #S_JAYA
@jt:
  sta tmp2
  lda #2
  sta tmp3
  ; 向き: 飛ぶときは進む方、とまったら まん中を見る
  lda w_st
  cmp #2
  bne @jmov
  lda w_x
  bpl @jo
  jmp @jflip
@jmov:
  cmp #1
  bne @jback
  lda w_dir
  beq @jo
  jmp @jflip
@jback:
  lda w_dir
  bne @jo
@jflip:
  lda #$42
  sta tmp3
@jo:
  lda w_x
  sta tmp4
  jsr put16
@nj:
  ; ほかのリス
  lda w_st+1
  beq @nr
  lda w_y+1
  sec
  sbc #1
  sta tmp
  lda w_x+1
  sta tmp4
  lda #3
  ldy w_dir+1
  beq @rf
  lda #$43
@rf:
  sta tmp3
  lda #S_SQSIT
  ldy w_st+1
  cpy #2
  beq @rs
  lda frame
  and #4
  beq @rr
  lda #S_SQRUNA
  jmp @rs
@rr:
  lda #S_SQRUNB
@rs:
  sta tmp2
  jsr put16
@nr:
  ; 地面のドングリと影
  ldx #NAC-1
@ac:
  lda ac_st,x
  beq @an
  jsr cell_xy          ; tmp4 = x・tmp = y（ますの左上）
  lda tmp4
  clc
  adc #4
  sta tmp4
  lda tmp
  clc
  adc #3
  sec
  sbc ac_h,x
  bcs @ay
  lda #$F8             ; まだ画面の上
@ay:
  sta tmp3             ; ドングリの y
  lda ac_st,x
  cmp #1
  bne @aon
  lda tmp              ; 影
  clc
  adc #5
  sta tmp
  lda tmp3
  pha
  lda #S_ACORNSHADOW
  sta tmp2
  lda #1
  sta tmp3
  jsr put_spr
  pla
  sta tmp
  jmp @adr
@aon:
  lda tmp3
  sta tmp
@adr:
  lda #S_ACORN
  sta tmp2
  lda #1
  sta tmp3
  jsr put_spr
@an:
  dex
  bpl @ac
  ; 春: とられた所の から
  ldx fea_n
  beq @nf
@fe:
  dex
  lda fea_cell,x
  stx ctmp
  tax
  jsr cell_xy_a
  ldx ctmp
  lda tmp4
  clc
  adc #4
  sta tmp4
  lda tmp
  clc
  adc #3
  sta tmp
  lda #S_SHELL
  sta tmp2
  lda #1
  sta tmp3
  jsr put_spr
  cpx #0
  bne @fe
@nf:
  ; 字の段のドングリ
  lda state
  cmp #1
  bne @end
  lda season
  cmp #2
  beq @end
  lda #6
  sta tmp
  lda #S_ACORN
  sta tmp2
  lda #1
  sta tmp3
  lda #86
  sta tmp4
  jsr put_spr
@end:
  jmp hide_rest

; 見はり X の上の しるしの場所 → tmp・tmp4
mark_pos:
  lda w_x,x
  clc
  adc #4
  cpx #0
  beq @j
  ldy w_dir+1          ; リス: 顔のがわ
  beq @rl
  sec
  sbc #2
  jmp @rj
@rl:
  clc
  adc #2
@rj:
  sta tmp4
  lda w_y+1
  sec
  sbc #13
  sta tmp
  rts
@j:
  sta tmp4
  lda #2
  sta tmp
  rts

; ドングリ X のますの左上 → tmp4 = x・tmp = y - 1（スプライトの y）
cell_xy:
  lda ac_cell,x
cell_xy_a:
  pha
  and #15
  asl a
  asl a
  asl a
  asl a
  sta tmp4
  pla
  and #$F0
  sec
  sbc #1
  sta tmp
  rts

draw_squirrel:
  lda sq_y
  sec
  sbc #1
  sta tmp
  lda sq_x
  sta tmp4
  lda #0
  ldy sq_dir
  beq @d
  lda #$40
@d:
  sta tmp3
  lda sq_act
  beq @na
  lda frame
  and #8
  beq @da
  lda #S_SQDIGB
  jmp @put
@da:
  lda #S_SQDIGA
  jmp @put
@na:
  lda sq_mv
  beq @sit
  lda frame
  and #4
  beq @ra
  lda #S_SQRUNB
  jmp @put
@ra:
  lda #S_SQRUNA
  jmp @put
@sit:
  lda frame
  and #63
  cmp #8
  bcs @s1
  lda #S_SQSIT2
  jmp @put
@s1:
  lda #S_SQSIT
@put:
  sta tmp2
  jmp put16

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  sta blink_old
  sta pop_t
  sta fea_n
  sta sq_act
  sta sq_mv
  sta sq_dir
  ldx #$C7             ; リスは下のほうの地面に すわらせる
@sq:
  lda MAP,x
  and #$0F
  beq @sqok
  inx
  jmp @sq
@sqok:
  txa
  and #15
  sta sq_cx
  txa
  lsr a
  lsr a
  lsr a
  lsr a
  sta sq_cy
  jsr place_sq
  ldx #0
@c:
  lda score,x
  cmp hi,x
  bcc @nohi
  bne @newhi
  inx
  cpx #4
  bne @c
  jmp @nohi
@newhi:
  ldx #3
@cp:
  lda score,x
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @cp
  lda #1
  sta newrec
@nohi:
  lda #SONG_OVER
  jsr music_play
  ; 芽の数を 4 けたに
  lda #0
  sta dig4
  sta dig4+1
  sta dig4+2
  lda trees
@t:
  cmp #10
  bcc @t1
  sbc #10
  inc dig4+2
  jmp @t
@t1:
  sta dig4+3
  jsr screen_off
  lda #2
  sta season
  jsr load_palette
  jsr draw_map
  lda #4
  sta tmp
  lda #16
  sta tmp2
  jsr draw_plate
  lda #M_R_FAIL
  ldx end_kind
  beq @f
  lda #M_R_WIN
@f:
  jsr say_now
  lda #M_R_FOUND
  jsr say_now
  lda #M_R_BEST
  jsr say_now
  lda #M_R_TREE
  jsr say_now
  lda newrec
  beq @nn
  lda #M_R_NEW
  jsr say_now
@nn:
  lda #<ADDR_EFOUND
  sta tmp
  lda #>ADDR_EFOUND
  ldx #score
  jsr vram_digits
  lda #<ADDR_EBEST
  sta tmp
  lda #>ADDR_EBEST
  ldx #hi
  jsr vram_digits
  lda #<ADDR_ETREE
  sta tmp
  lda #>ADDR_ETREE
  ldx #dig4
  jsr vram_digits
  lda #M_ST_NONE
  jsr say_now
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

end_update:
  lda end_t
  cmp #200
  bcs @k
  inc end_t
@k:
  jsr oam_start
  jsr draw_squirrel
  jsr hide_rest
  lda end_t
  cmp #90
  bcc @r
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_R_PUSH
  jsr say_buf
  jmp @same
@off:
  lda #M_R_PUSH_OFF
  jsr say_buf
@same:
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
sfx_pick:              ; 拾う: ぴょこっと上がる
  lda #%10011000
  sta $4000
  lda #%10001010
  sta $4001
  lda #$90
  sta $4002
  lda #$10
  sta $4003
  rts

sfx_dig:               ; 土を かく
  lda #%00000011
  sta $400C
  lda #$0C
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_pat:               ; うめて ぽんぽん
  lda #%00000100
  sta $400C
  lda #$0E
  sta $400E
  lda #$10
  sta $400F
  lda #%10010110
  sta $4000
  lda #%00000000
  sta $4001
  lda #$40
  sta $4002
  lda #$12
  sta $4003
  rts

sfx_found:             ; みつけた: 上がる
  lda #%01011010
  sta $4000
  lda #%10010010
  sta $4001
  lda #$C0
  sta $4002
  lda #$28
  sta $4003
  rts

sfx_sprout:            ; 芽: やわらかく上がる
  lda #%01010110
  sta $4000
  lda #%10010011
  sta $4001
  lda #$A0
  sta $4002
  lda #$30
  sta $4003
  rts

sfx_miss:              ; はずれ: 下がる
  lda #%10011001
  sta $4000
  lda #%10100010
  sta $4001
  lda #$60
  sta $4002
  lda #$31
  sta $4003
  rts

sfx_no:                ; できない: みじかく
  lda #%10010100
  sta $4000
  lda #%00000000
  sta $4001
  lda #$00
  sta $4002
  lda #$09
  sta $4003
  rts

sfx_seen:              ; 見られた: カケスの「ジェーッ」
  lda #%00001010
  sta $400C
  lda #$03
  sta $400E
  lda #$30
  sta $400F
  lda #%00011010
  sta $4000
  lda #%10100001
  sta $4001
  lda #$A0
  sta $4002
  lda #$18
  sta $4003
  rts

sfx_jay:               ; カケスが来た
  lda #%00000110
  sta $400C
  lda #$02
  sta $400E
  lda #$10
  sta $400F
  rts

sfx_steal:             ; とられていた
  lda #%00000101
  sta $400C
  lda #$05
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_thud:              ; ドングリが落ちた
  lda #%00000010
  sta $400C
  lda #$09
  sta $400E
  lda #$08
  sta $400F
  rts

; ================= セーブ =================
load_save:
  ldx #3
@c:
  lda SAVE,x
  cmp save_magic,x
  bne @new
  dex
  bpl @c
  ldx #3
@d:
  lda SAVE+4,x
  cmp #10
  bcs @new
  sta hi,x
  dex
  bpl @d
  rts
@new:
  ldx #3
@w:
  lda save_magic,x
  sta SAVE,x
  lda #0
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @w
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 決まりの表 =================
save_magic: .byte 'S', 'Q', '0', '1'
plate_l: .byte T_P0, T_P3, T_P5
plate_m: .byte T_P1, 0, T_P6
plate_r: .byte T_P2, T_P4, T_P7
; 年ごと（1〜5 年め）
tab_k: .byte 4, 5, 6, 7, 8            ; うめる数
tab_need: .byte 3, 4, 4, 5, 6         ; 冬に いる数
tab_astep: .byte 22, 24, 25, 26, 28   ; 秋の棒が 1 ドット へるフレーム（96 ドット）
tab_wstep: .byte 19, 17, 15, 13, 11   ; 冬
tab_away: .byte 220, 180, 150, 130, 110  ; 見はりが いないあいだ（＋0〜63）
tab_watch: .byte 140, 160, 180, 200, 220 ; 見ているあいだ
tab_rival: .byte 0, 0, 1, 1, 1
w_from: .byte 0, 240
r_from: .byte 0, 240
r_peek: .byte 12, 228
r_step: .byte 1, $FF
