; ダンゴムシのみち（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs（絵の番号 T_・S_ と画面のデータは data.mjs が足す）
; 決まりは rules.mjs と同じ（walk_step。片方を変えたらもう片方も）: 前がふさがれたときだけ曲がり、曲がる向きは前の曲がりと逆

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
MASK_ON = %00011110   ; 背景とスプライトを出す（左の8ドットも出す）

BTN_A = $80
BTN_B = $40
BTN_SELECT = $20
BTN_START = $10
BTN_UP = $08
BTN_DOWN = $04
BTN_LEFT = $02
BTN_RIGHT = $01

C_SOIL = 0
C_ROCK = 1
C_LEAF = 2
C_SUN = 3
C_STONE = 4
NCELL = 192
FIELD_Y = 31        ; 面のいちばん上のスプライトの y（画面の 32 − 1）

; ---- ゼロページ ----
nmi_count = $00
buf_ready = $01
buf_len = $02
frame = $03
pad = $04
pad_old = $05
pad_new = $06
state = $07        ; 0 タイトル・1 石を置く・2 歩く・3 食べた・4 ひなた・5 エンディング
rng = $08          ; 2バイト
tmp = $0A
tmp2 = $0B
tmp3 = $0C
tmp4 = $0D
ptr = $0E          ; 2バイト
oam_i = $10
stage = $11
unlocked = $12     ; えらべるいちばん先の面
sel = $13
stones_left = $14
stones_max = $15
leaves = $16
bug_x = $17        ; 面の中のドット（ますの 16 倍）
bug_y = $18
bug_h = $19        ; 0 右・1 下・2 左・3 上
bug_next = $1A     ; 0 = つぎは左へ・1 = 右へ
cur_x = $1B
cur_y = $1C
rep_t = $1D
st_t = $1E
blink_old = $1F
start_x = $20
start_y = $21
start_h = $22
stuck = $23
cx = $25
cy = $26
nx = $27
ny = $28
ci = $29
spd = $2A
song = $2B
paused = $2C       ; 曲の係が見る（このゲームでは止めない）
mus_on = $2D
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
crumb_t = $40
crumb_x = $41
crumb_y = $42
m_x = $43          ; 16×16 の絵: 左・上・最初の番号・色と向き
m_y = $44
m_base = $45
m_attr = $46
m_ord = $47
ttl_x = $48
dir_t = $49        ; 曲がる向きを調べるときの向き（a・b）
dir_t2 = $4A
best = $4B         ; いちばん少ない石の数（それで解くと BEST）
lang = $4C         ; 0 かな・1 英語（ページが $7FFF に入れる。タイトルのたびに読む）
LANG = $7FFF

OAM = $0200
BUF = $0300        ; 帰線のあいだに画面へ書くもの: 番地の上・下・長さ・中身…、0 でおわり
MAP = $0400        ; 歩いているあいだの面（葉っぱを食べると土に）
PLAN = $0500       ; 石を置いた面（やりなおすとここから）
SAVE = $6000       ; 電池の RAM: "PB01"・えらべる面

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
  lda #$e1
  sta rng
  lda #$5b
  sta rng+1
  lda #$ff
  sta song
  jsr load_save
  jsr load_palette
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
  jsr plan_update
  jmp @done
@n2:
  cmp #2
  bne @n3
  jsr walk_update
  jmp @done
@n3:
  cmp #3
  bne @n4
  jsr clear_update
  jmp @done
@n4:
  cmp #4
  bne @n5
  jsr sun_update
  jmp @done
@n5:
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

load_palette:
  bit PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #0
  sta PPUADDR
  ldx #0
@l:
  lda palette,x
  sta PPUDATA
  inx
  cpx #32
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

; スプライト1つ: tmp = y・tmp2 = 絵・tmp3 = 色と向き・tmp4 = x（X はこわさない）
put_spr:
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
  rts

; 16×16 の絵: m_x・m_y・m_base・m_attr（$40 で左右、$80 で上下を裏返す。4枚の順も入れかえる）
put_meta:
  ldx #0
  lda m_attr
  and #$40
  beq @nh
  ldx #4
@nh:
  lda m_attr
  and #$80
  beq @nv
  txa
  clc
  adc #8
  tax
@nv:
  stx m_ord
  lda m_attr
  sta tmp3
  ldx #0
@l:
  lda m_y
  clc
  adc meta_dy,x
  sta tmp
  lda m_x
  clc
  adc meta_dx,x
  sta tmp4
  txa
  clc
  adc m_ord
  tay
  lda meta_ord,y
  clc
  adc m_base
  sta tmp2
  jsr put_spr
  inx
  cpx #4
  bne @l
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

; A = 曲の番号（同じ曲が鳴っていれば、はじめからにしない）
play_song:
  cmp song
  bne @new
  ldx mus_on
  bne @r
@new:
  sta song
  jsr music_play
@r:
  rts

; A（0〜99）を2けたの字に: tmp2 = 十の位・tmp3 = 一の位
two_digits:
  ldx #0
@t:
  cmp #10
  bcc @u
  sbc #10
  inx
  bne @t
@u:
  clc
  adc #T_0
  sta tmp3
  txa
  clc
  adc #T_0
  sta tmp2
  rts

; A = 字の番号（M_…）→ ptr にことばの字（buf_data で書く）
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

; ================= セーブ =================
load_save:
  ldx #3
@c:
  lda SAVE,x
  cmp save_magic,x
  bne @new
  dex
  bpl @c
  lda SAVE+4
  cmp #NSTAGE
  bcs @new
  sta unlocked
  rts
@new:
  ldx #3
@w:
  lda save_magic,x
  sta SAVE,x
  dex
  bpl @w
  lda #0
  sta SAVE+4
  sta unlocked
  rts

; ================= タイトル =================
go_title:
  ; ことば（ページが電源を入れる前に $7FFF へ。1 だけが英語、ほかは かな）
  ldx #0
  lda LANG
  cmp #1
  bne @lj
  inx
@lj:
  stx lang
  jsr screen_off
  lda #<nt_title
  sta ptr
  lda #>nt_title
  sta ptr+1
  jsr draw_nt
  lda unlocked
  sta sel
  lda #0
  sta state
  sta blink_old
  sta ttl_x
  jsr clear_oam
  lda #SONG_MAIN
  jsr play_song
  jsr screen_on
  lda #M_TSTAGE
  jsr say_ptr
  jsr buf_data
  jsr title_digits
  rts

title_digits:
  lda sel
  clc
  adc #1
  jsr two_digits
  lda #>ADDR_TSTAGE
  ldx #<ADDR_TSTAGE
  ldy lang
  bne @en
  lda #>ADDR_TSTAGE_JA
  ldx #<ADDR_TSTAGE_JA
@en:
  ldy #2
  jsr buf_head
  lda tmp2
  jsr buf_byte
  lda tmp3
  jsr buf_byte
  rts

title_update:
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jsr say_ptr
  jmp @put
@off:
  lda #M_PUSH_OFF
  jsr say_ptr
@put:
  jsr buf_data
@same:
  ; ←→ で面をえらぶ（とどいた面まで）
  lda pad_new
  and #BTN_LEFT
  beq @nl
  lda sel
  beq @nl
  dec sel
  jsr title_digits
  jsr sfx_take
@nl:
  lda pad_new
  and #BTN_RIGHT
  beq @nr
  lda sel
  cmp unlocked
  bcs @nr
  inc sel
  jsr title_digits
  jsr sfx_take
@nr:
  jsr title_sprites
  lda pad_new
  and #BTN_START
  beq @r
  lda sel
  sta stage
  jsr sfx_place
  jsr load_stage
@r:
  rts

title_sprites:
  lda #0
  sta oam_i
  ; 面えらびの矢じるし
  lda #119
  sta tmp
  lda #1
  sta tmp3
  lda sel
  beq @nol
  lda #S_ARROWR
  sta tmp2
  lda #$41
  sta tmp3
  lda #84
  sta tmp4
  jsr put_spr
@nol:
  lda sel
  cmp unlocked
  bcs @nor
  lda #S_ARROWR
  sta tmp2
  lda #1
  sta tmp3
  lda #164
  sta tmp4
  jsr put_spr
@nor:
  ; 土の帯を歩くダンゴムシ（岩で曲がらない飾り）
  lda frame
  and #1
  bne @nm
  inc ttl_x
@nm:
  lda ttl_x
  sta m_x
  lda #175
  sta m_y
  lda ttl_x
  and #8
  beq @a
  lda #S_BUGR2
  bne @b
@a:
  lda #S_BUGR1
@b:
  sta m_base
  lda #0
  sta m_attr
  jsr put_meta
  jsr hide_rest
  rts

; ================= 面をはじめる =================
load_stage:
  jsr screen_off
  ldx stage
  lda stage_nt_lo,x
  sta ptr
  lda stage_nt_hi,x
  sta ptr+1
  jsr draw_nt
  ldx stage
  lda stage_cells_lo,x
  sta ptr
  lda stage_cells_hi,x
  sta ptr+1
  ldy #0
@c:
  lda (ptr),y
  sta PLAN,y
  sta MAP,y
  iny
  cpy #NCELL
  bne @c
  lda (ptr),y
  sta start_x
  sta cur_x
  iny
  lda (ptr),y
  sta start_y
  sta cur_y
  iny
  lda (ptr),y
  sta start_h
  iny
  lda (ptr),y
  sta stones_max
  sta stones_left
  iny
  lda (ptr),y
  sta best
  jsr reset_bug
  lda #1
  sta state
  lda #0
  sta crumb_t
  jsr clear_oam
  lda #SONG_MAIN
  jsr play_song
  jsr screen_on
  jsr hud_icons
  lda stage
  asl a
  clc
  adc #M_STAGE
  pha
  jsr say_ptr
  jsr buf_data
  pla
  clc
  adc #1
  jsr say_ptr
  jsr buf_data
  jsr plan_hint
  rts

; 下の案内（石のない面は「見てて」）
plan_hint:
  lda stones_max
  bne @p
  lda #M_HINT_WATCH
  jsr say_ptr
  jmp buf_data
@p:
  lda #M_HINT_PLAN
  jsr say_ptr
  jmp buf_data

; ダンゴムシをはじめの場所へ。葉っぱの数を数えなおす
reset_bug:
  lda start_x
  asl a
  asl a
  asl a
  asl a
  sta bug_x
  lda start_y
  asl a
  asl a
  asl a
  asl a
  sta bug_y
  lda start_h
  sta bug_h
  lda #0
  sta bug_next
  sta stuck
  sta leaves
  ldx #0
@l:
  lda MAP,x
  cmp #C_LEAF
  bne @n
  inc leaves
@n:
  inx
  cpx #NCELL
  bne @l
  rts

; 字の段の小石の印（のこり・使った・なし）
hud_icons:
  lda #>ADDR_ICONS
  ldx #<ADDR_ICONS
  ldy #4
  jsr buf_head
  ldx #0
@l:
  cpx stones_left
  bcs @off
  lda #T_ICON
  bne @p
@off:
  cpx stones_max
  bcs @none
  lda #T_ICONOFF
  bne @p
@none:
  lda #0
@p:
  jsr buf_byte
  inx
  cpx #4
  bne @l
  rts

; ます X を描きなおす（MAP の中身で）。X はこわさない
draw_cell:
  stx ci
  txa
  and #15
  sta cx
  txa
  lsr a
  lsr a
  lsr a
  lsr a
  sta cy
  lda MAP,x
  cmp #C_ROCK
  bne @n1
  lda #T_ROCK
  bne @have
@n1:
  cmp #C_LEAF
  bne @n2
  lda #T_LEAF
  bne @have
@n2:
  cmp #C_SUN
  bne @n3
  lda cx
  eor cy
  and #1
  asl a
  asl a
  clc
  adc #T_SUN1
  bne @have
@n3:
  cmp #C_STONE
  bne @soil
  lda #T_STONE
  bne @have
@soil:
  lda cy
  asl a
  eor cx
  and #3
  asl a
  asl a
  clc
  adc #T_SOIL1
@have:
  sta tmp3
  ; 番地 = $2080 + cy×64 + cx×2
  lda cy
  lsr a
  lsr a
  clc
  adc #$20
  sta tmp4
  lda cy
  and #3
  asl a
  asl a
  asl a
  asl a
  asl a
  asl a
  sta tmp2
  lda cx
  asl a
  ora tmp2
  clc
  adc #$80
  sta tmp2
  bcc @nc
  inc tmp4
@nc:
  lda tmp4
  ldx tmp2
  ldy #2
  jsr buf_head
  lda tmp3
  jsr buf_byte
  ldx tmp3
  inx
  txa
  jsr buf_byte
  lda tmp2
  clc
  adc #32
  tax
  lda tmp4
  adc #0
  ldy #2
  jsr buf_head
  ldx tmp3
  inx
  inx
  txa
  jsr buf_byte
  ldx tmp3
  inx
  inx
  inx
  txa
  jsr buf_byte
  ldx ci
  rts

; ================= 石を置く =================
plan_update:
  jsr move_cursor
  lda pad_new
  and #BTN_A
  beq @na
  jsr toggle_stone
@na:
  lda pad_new
  and #BTN_SELECT
  beq @ns
  jsr clear_stones
@ns:
  lda pad_new
  and #BTN_START
  beq @nst
  lda #2
  sta state
  lda #M_HINT_WALK
  jsr say_ptr
  jsr buf_data
  jsr sfx_place
@nst:
  jsr draw_sprites
  rts

; 十字キーでカーソル（押しつづけると くりかえす）
move_cursor:
  lda pad_new
  and #$0f
  beq @held
  sta tmp4
  lda #14
  sta rep_t
  jmp @move
@held:
  lda pad
  and #$0f
  beq @r
  dec rep_t
  bne @r
  lda #5
  sta rep_t
  lda pad
  and #$0f
  sta tmp4
@move:
  lda tmp4
  and #BTN_RIGHT
  beq @nr
  lda cur_x
  cmp #15
  bcs @nr
  inc cur_x
@nr:
  lda tmp4
  and #BTN_LEFT
  beq @nl
  lda cur_x
  beq @nl
  dec cur_x
@nl:
  lda tmp4
  and #BTN_DOWN
  beq @nd
  lda cur_y
  cmp #11
  bcs @nd
  inc cur_y
@nd:
  lda tmp4
  and #BTN_UP
  beq @r
  lda cur_y
  beq @r
  dec cur_y
@r:
  rts

toggle_stone:
  lda cur_y
  asl a
  asl a
  asl a
  asl a
  ora cur_x
  tax
  lda PLAN,x
  cmp #C_STONE
  beq @take
  cmp #C_SOIL
  bne @err
  lda cur_x
  cmp start_x
  bne @ok
  lda cur_y
  cmp start_y
  beq @err
@ok:
  lda stones_left
  beq @err
  dec stones_left
  lda #C_STONE
  sta PLAN,x
  sta MAP,x
  jsr draw_cell
  jsr hud_icons
  jsr sfx_place
  rts
@take:
  inc stones_left
  lda #C_SOIL
  sta PLAN,x
  sta MAP,x
  jsr draw_cell
  jsr hud_icons
  jsr sfx_take
  rts
@err:
  jsr sfx_err
  rts

; 置いた石をぜんぶもどす
clear_stones:
  lda stones_left
  cmp stones_max
  beq @r
  ldx #0
@l:
  lda PLAN,x
  cmp #C_STONE
  bne @n
  lda #C_SOIL
  sta PLAN,x
  sta MAP,x
  jsr draw_cell
@n:
  inx
  cpx #NCELL
  bne @l
  lda stones_max
  sta stones_left
  jsr hud_icons
  jsr sfx_take
@r:
  rts

; ================= 歩く =================
walk_update:
  lda pad_new
  and #BTN_B
  beq @nb
  jsr sfx_take
  jsr stop_walk
  jsr draw_sprites
  rts
@nb:
  lda #1
  sta spd
  lda pad
  and #BTN_A
  beq @l
  inc spd
@l:
  lda stuck
  bne @draw
  lda bug_x
  ora bug_y
  and #15
  bne @mv
  jsr walk_step
  lda state
  cmp #2
  bne @draw
  lda stuck
  bne @draw
@mv:
  ldx bug_h
  lda bug_x
  clc
  adc dir_dx,x
  sta bug_x
  lda bug_y
  clc
  adc dir_dy,x
  sta bug_y
  dec spd
  bne @l
@draw:
  jsr draw_sprites
  rts

; ますのまん中で: 食べる・ひなた・曲がる（rules.mjs の walk と同じ）
walk_step:
  lda bug_x
  lsr a
  lsr a
  lsr a
  lsr a
  sta cx
  lda bug_y
  lsr a
  lsr a
  lsr a
  lsr a
  sta cy
  asl a
  asl a
  asl a
  asl a
  ora cx
  tax
  lda MAP,x
  cmp #C_LEAF
  bne @nleaf
  lda #C_SOIL
  sta MAP,x
  jsr draw_cell
  jsr sfx_eat
  lda #24
  sta crumb_t
  lda bug_x
  sta crumb_x
  lda bug_y
  sta crumb_y
  dec leaves
  bne @turn
  jsr go_clear
  rts
@nleaf:
  cmp #C_SUN
  bne @turn
  jsr go_sun
  rts
@turn:
  ldy bug_h
  jsr blocked_dir
  bcc @go
  ; 前がふさがれた: つぎの向き（a）へ。だめなら逆（b）へ（つぎの向きは変えない）。どちらもだめなら引き返す
  lda bug_next
  beq @left
  lda bug_h
  clc
  adc #1
  and #3
  sta dir_t
  lda bug_h
  clc
  adc #3
  and #3
  sta dir_t2
  jmp @try
@left:
  lda bug_h
  clc
  adc #3
  and #3
  sta dir_t
  lda bug_h
  clc
  adc #1
  and #3
  sta dir_t2
@try:
  ldy dir_t
  jsr blocked_dir
  bcs @tryb
  lda dir_t
  sta bug_h
  lda bug_next
  jsr sfx_turn
  lda bug_next
  eor #1
  sta bug_next
  rts
@tryb:
  ldy dir_t2
  jsr blocked_dir
  bcs @back
  lda dir_t2
  sta bug_h
  lda bug_next
  eor #1
  jsr sfx_turn
  rts
@back:
  lda bug_h
  eor #2
  sta bug_h
  ldy bug_h
  jsr blocked_dir
  bcc @go
  lda #1
  sta stuck
  jsr sfx_err
  rts
@go:
  jsr sfx_step
  rts

; Y の向きの となりのますがふさがっていれば C = 1（cx・cy のまわり）
blocked_dir:
  lda cx
  clc
  adc dir_dx,y
  cmp #16
  bcs @r
  sta nx
  lda cy
  clc
  adc dir_dy,y
  cmp #12
  bcs @r
  asl a
  asl a
  asl a
  asl a
  ora nx
  tax
  lda MAP,x
  cmp #C_ROCK
  beq @b
  cmp #C_STONE
  beq @b
  clc
  rts
@b:
  sec
@r:
  rts

; 歩くのをやめて、石を置くところへもどる（食べた葉っぱも元にもどす）
stop_walk:
  ldx #0
@l:
  lda MAP,x
  cmp PLAN,x
  beq @n
  lda PLAN,x
  sta MAP,x
  jsr draw_cell
@n:
  inx
  cpx #NCELL
  bne @l
  jsr reset_bug
  lda #1
  sta state
  lda #0
  sta crumb_t
  jsr plan_hint
  rts

; ================= 食べた・ひなた =================
go_clear:
  lda #3
  sta state
  lda #0
  sta st_t
  ; とどいた面を増やして残す
  ldx stage
  inx
  cpx #NSTAGE
  bcs @nsave
  cpx unlocked
  bcc @nsave
  beq @nsave
  stx unlocked
  stx SAVE+4
@nsave:
  lda #SONG_CLEAR
  sta song
  jsr music_play
  ; 石がゆとりのある面で、いちばん少ない数で解いたら BEST
  lda stones_max
  cmp best
  beq @plain
  sec
  sbc stones_left
  cmp best
  bne @plain
  lda #M_HINT_BEST
  jsr say_ptr
  jmp @put
@plain:
  lda #M_HINT_CLEAR
  jsr say_ptr
@put:
  jsr buf_data
  rts

clear_update:
  lda st_t
  cmp #255
  beq @k
  inc st_t
@k:
  jsr draw_sprites
  lda st_t
  cmp #40
  bcc @r
  lda pad_new
  and #BTN_A|BTN_START
  beq @r
  jsr sfx_place
  ldx stage
  inx
  cpx #NSTAGE
  bcs @end
  stx stage
  jsr load_stage
  rts
@end:
  jsr go_ending
@r:
  rts

go_sun:
  lda #4
  sta state
  lda #0
  sta st_t
  jsr sfx_sun
  lda #M_HINT_SUN
  jsr say_ptr
  jsr buf_data
  rts

sun_update:
  inc st_t
  jsr draw_sprites
  lda st_t
  cmp #100
  bcc @r
  jsr stop_walk
@r:
  rts

; ================= スプライト（石を置く・歩く・食べた・ひなた） =================
draw_sprites:
  lda #0
  sta oam_i
  ; カーソル（石を置くときだけ）
  lda state
  cmp #1
  bne @ncur
  lda cur_x
  asl a
  asl a
  asl a
  asl a
  sta m_x
  lda cur_y
  asl a
  asl a
  asl a
  asl a
  clc
  adc #FIELD_Y
  sta m_y
  lda #S_CURSOR
  sta m_base
  lda #1
  sta m_attr
  jsr put_meta
@ncur:
  ; 葉のかけら
  lda crumb_t
  beq @ncr
  dec crumb_t
  lda #24
  sec
  sbc crumb_t
  lsr a
  sta tmp4
  lda crumb_y
  clc
  adc #FIELD_Y+4
  sec
  sbc tmp4
  sta tmp
  lda #S_CRUMB
  sta tmp2
  lda #2
  sta tmp3
  lda crumb_x
  sec
  sbc tmp4
  sta tmp4
  jsr put_spr
  lda #24
  sec
  sbc crumb_t
  lsr a
  clc
  adc crumb_x
  adc #8
  sta tmp4
  lda #$42
  sta tmp3
  jsr put_spr
@ncr:
  ; つぎに曲がる向きの矢じるし（石を置く・歩くとき）
  lda state
  cmp #3
  bcs @narrow
  jsr put_arrow
@narrow:
  ; ダンゴムシ（ひなたでは丸くなる）
  lda bug_x
  sta m_x
  lda bug_y
  clc
  adc #FIELD_Y
  sta m_y
  lda state
  cmp #4
  bne @bug
  lda #S_BALL
  sta m_base
  lda #0
  sta m_attr
  lda st_t
  and #4
  beq @nb
  inc m_y
@nb:
  jsr put_meta
  jmp @done
@bug:
  ; 歩く足（石を置くあいだは ゆっくり、食べたあとは はやく）
  lda state
  cmp #2
  beq @walk
  cmp #3
  beq @happy
  lda frame
  and #32
  jmp @leg
@happy:
  lda frame
  and #4
  jmp @leg
@walk:
  lda bug_x
  eor bug_y
  and #8
@leg:
  sta tmp4
  ldx bug_h
  lda bug_tile,x
  ldy tmp4
  beq @f1
  clc
  adc #4
@f1:
  sta m_base
  lda bug_flip,x
  sta m_attr
  jsr put_meta
@done:
  jsr hide_rest
  rts

; 「まっすぐ進んで、ぶつかったら左（右）へ」の矢じるしを、ダンゴムシの前のますに（16×16）
; 絵は向き×つぎの曲がり（bug_h×2＋bug_next）で turn_tile・turn_attr から。前のますが面の外なら出さない
put_arrow:
  lda stuck
  bne @r
  lda frame
  and #16
  bne @show
  lda state
  cmp #2
  bne @show
  rts
@show:
  ldx bug_h
  lda bug_x
  cpx #0
  bne @n0
  cmp #240
  bcs @r
@n0:
  cpx #2
  bne @n2
  cmp #16
  bcc @r
@n2:
  lda bug_y
  cpx #1
  bne @n1
  cmp #176
  bcs @r
@n1:
  cpx #3
  bne @n3
  cmp #16
  bcc @r
@n3:
  lda bug_x
  clc
  adc ahead_dx,x
  sta m_x
  lda bug_y
  clc
  adc #FIELD_Y
  clc
  adc ahead_dy,x
  sta m_y
  txa
  asl a
  ora bug_next
  tax
  lda turn_tile,x
  sta m_base
  lda turn_attr,x
  sta m_attr
  jsr put_meta
@r:
  rts

; ================= エンディング =================
go_ending:
  jsr screen_off
  lda #<nt_end_ja
  ldx #>nt_end_ja
  ldy lang
  beq @ja
  lda #<nt_end_en
  ldx #>nt_end_en
@ja:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda #5
  sta state
  lda #0
  sta st_t
  sta ttl_x
  jsr clear_oam
  lda #SONG_ENDING
  jsr play_song
  jsr screen_on
  rts

end_update:
  lda st_t
  cmp #255
  beq @k
  inc st_t
@k:
  lda #0
  sta oam_i
  lda frame
  and #1
  bne @nm
  inc ttl_x
@nm:
  lda ttl_x
  sta m_x
  lda #191
  sta m_y
  lda ttl_x
  and #8
  beq @a
  lda #S_BUGR2
  bne @b
@a:
  lda #S_BUGR1
@b:
  sta m_base
  lda #0
  sta m_attr
  jsr put_meta
  jsr hide_rest
  lda st_t
  cmp #120
  bcc @r
  lda pad_new
  and #BTN_START|BTN_A
  beq @r
  jsr go_title
@r:
  rts

; ================= 音（矩形波1とノイズ。曲は矩形波2と三角波） =================
sfx_step:
  lda #%00110001
  sta $400C
  lda #$0e
  sta $400E
  lda #$08
  sta $400F
  rts

; A = 0 左へ・1 右へ（左は低く、右は高く）
sfx_turn:
  tax
  lda #%10000011
  sta $4000
  lda #$08
  sta $4001
  lda turn_pitch,x
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_place:
  lda #%00000010
  sta $400C
  lda #$06
  sta $400E
  lda #$18
  sta $400F
  lda #%10000010
  sta $4000
  lda #$08
  sta $4001
  lda #$60
  sta $4002
  lda #$09
  sta $4003
  rts

sfx_take:
  lda #%10000010
  sta $4000
  lda #$08
  sta $4001
  lda #$90
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_err:
  lda #%01000011
  sta $4000
  lda #$08
  sta $4001
  lda #$80
  sta $4002
  lda #$0a
  sta $4003
  rts

sfx_eat:
  lda #%10000100
  sta $4000
  lda #%10101011
  sta $4001
  lda #$80
  sta $4002
  lda #$09
  sta $4003
  rts

sfx_sun:
  lda #%10000110
  sta $4000
  lda #%10100010
  sta $4001
  lda #$a0
  sta $4002
  lda #$08
  sta $4003
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 表 =================
save_magic: .byte 'P', 'B', '0', '1'
dir_dx: .byte 1, 0, $ff, 0
dir_dy: .byte 0, 1, 0, $ff
meta_dx: .byte 0, 8, 0, 8
meta_dy: .byte 0, 0, 8, 8
meta_ord: .byte 0, 1, 2, 3,  1, 0, 3, 2,  2, 3, 0, 1,  3, 2, 1, 0
bug_tile: .byte S_BUGR1, S_BUGU1, S_BUGR1, S_BUGU1
bug_flip: .byte $00, $80, $40, $00
; 曲がる矢じるし: 前のますへのずれ（右・下・左・上）と、向き×つぎの曲がり（左・右）の絵と裏返し
ahead_dx: .byte 16, 0, $f0, 0
ahead_dy: .byte 0, 16, 0, $f0
turn_tile: .byte S_TURNRU, S_TURNRU,  S_TURNUR, S_TURNUR,  S_TURNRU, S_TURNRU,  S_TURNUR, S_TURNUR
turn_attr: .byte $01, $81,  $81, $C1,  $C1, $41,  $41, $01
turn_pitch: .byte $fd, $a8
