; カエルのよる（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs（絵の番号 T_・S_ と画面のデータは build.mjs が足す）

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
MASK_ON = %00011010   ; 背景とスプライトを出す（スプライトは左の8ドットを隠す）

BTN_A = $80
BTN_B = $40
BTN_SELECT = $20
BTN_START = $10
BTN_UP = $08
BTN_DOWN = $04
BTN_LEFT = $02
BTN_RIGHT = $01

TONGUE_MAX = 148
NBUG = 6

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
frog_x = $10
tongue = $11       ; 舌の長さ（ドット）
tongue_st = $12    ; 0 なし・1 のびる・2 もどる
dizzy = $13        ; 目を回しているあいだ（フレーム）
lives = $14
catch_n = $15      ; この1回でとった数
time_s = $16
time_f = $17
score = $18        ; 6けた（上のけたから）
hi = $1E           ; 6けた
spawn_t = $24
level = $25
oam_i = $26
end_t = $27
sky = $28
paused = $29
catch_pts = $2A    ; この1回の点（10点の数）
blink_old = $2B
end_kind = $2C     ; 0 ハートがなくなった・1 朝が来た
mus_on = $2D
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
bug_type = $40     ; 0 なし・1 ハエ・2 ガ・3 ホタル（6つずつ）
bug_x = $46
bug_xl = $4C
bug_y = $52
bug_ph = $58
bug_sp = $5E
bug_si = $64
bug_dir = $6A      ; 0 右へ・1 左へ
bug_st = $70       ; 0 飛ぶ・1 舌にくっついた
bug_dy = $76       ; いまの高さ

OAM = $0200
BUF = $0300        ; 帰線のあいだに画面へ書くもの: 番地の上・下・長さ・中身…、0 でおわり

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
  lda #$ac
  sta rng+1
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
  lda #$3f
  sta PPUADDR
  lda #$00
  sta PPUADDR
  lda sky
  sta PPUDATA
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
  lda #$3f
  sta PPUADDR
  lda #$00
  sta PPUADDR
  lda sky
  sta PPUDATA
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

; カエル（16×16）: A = 絵の最初の番号
put_frog:
  sta tmp2
  lda #175
  sta tmp
  lda #0
  sta tmp3
  lda frog_x
  sta tmp4
  jsr put_spr
  inc tmp2
  lda frog_x
  clc
  adc #8
  sta tmp4
  jsr put_spr
  inc tmp2
  lda #183
  sta tmp
  lda frog_x
  sta tmp4
  jsr put_spr
  inc tmp2
  lda frog_x
  clc
  adc #8
  sta tmp4
  jsr put_spr
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

; ================= タイトル =================
go_title:
  jsr screen_off
  lda #<nt_title
  sta ptr
  lda #>nt_title
  sta ptr+1
  jsr draw_nt
  bit PPUSTATUS
  lda #>ADDR_HI
  sta PPUADDR
  lda #<ADDR_HI
  sta PPUADDR
  ldx #0
@l:
  lda hi,x
  clc
  adc #T_0
  sta PPUDATA
  inx
  cpx #6
  bne @l
  lda #0
  sta state
  sta paused
  sta blink_old
  lda #$0f
  sta sky
  jsr clear_oam
  lda #SONG_MAIN
  jsr music_play
  jsr screen_on
  rts

title_update:
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #<txt_push
  sta ptr
  lda #>txt_push
  sta ptr+1
  jmp @put
@off:
  lda #<txt_push_off
  sta ptr
  lda #>txt_push_off
  sta ptr+1
@put:
  jsr buf_data
@same:
  jsr title_sprites
  lda pad_new
  and #BTN_START
  beq @r
  jsr start_game
@r:
  rts

title_sprites:
  lda #0
  sta oam_i
  lda #120
  sta frog_x
  lda #S_FROG
  jsr put_frog
  lda #103
  sta tmp
  lda #2
  sta tmp3
  lda #64
  sta tmp4
  lda frame
  and #4
  beq @a
  lda #S_FLYB
  bne @b
@a:
  lda #S_FLYA
@b:
  sta tmp2
  jsr put_spr
  lda #112
  sta tmp4
  lda frame
  and #8
  beq @c
  lda #S_MOTHB
  bne @d
@c:
  lda #S_MOTHA
@d:
  sta tmp2
  jsr put_spr
  lda #3
  sta tmp3
  lda #160
  sta tmp4
  lda frame
  and #32
  beq @e
  lda #S_FIREOFF
  bne @f
@e:
  lda #S_FIREON
@f:
  sta tmp2
  jsr put_spr
  jsr hide_rest
  rts

; ================= あそぶ =================
start_game:
  jsr screen_off
  lda #<nt_play
  sta ptr
  lda #>nt_play
  sta ptr+1
  jsr draw_nt
  lda #0
  ldx #5
@z:
  sta score,x
  dex
  bpl @z
  ldx #NBUG-1
@b:
  sta bug_type,x
  sta bug_st,x
  dex
  bpl @b
  sta tongue
  sta tongue_st
  sta dizzy
  sta catch_n
  sta paused
  sta level
  sta time_f
  lda #120
  sta frog_x
  lda #3
  sta lives
  lda #90
  sta time_s
  lda #40
  sta spawn_t
  lda #$0f
  sta sky
  lda frame
  eor rng
  sta rng
  lda #1
  sta state
  jsr clear_oam
  jsr screen_on
  rts

play_update:
  lda pad_new
  and #BTN_START
  beq @np
  lda paused
  eor #1
  sta paused
  beq @poff
  lda #<txt_pause
  sta ptr
  lda #>txt_pause
  sta ptr+1
  jmp @pput
@poff:
  lda #<txt_pause_off
  sta ptr
  lda #>txt_pause_off
  sta ptr+1
@pput:
  jsr buf_data
  lda paused
  beq @np
  lda #$30           ; 止めたら音も止める
  sta $4004
  lda #$80
  sta $4008
  sta $400B
@np:
  lda paused
  beq @run
  rts
@run:
  jsr update_time
  jsr update_frog
  jsr update_tongue
  jsr spawn_bugs
  jsr update_bugs
  jsr draw_play
  jsr hud
  lda lives
  beq @over
  lda time_s
  bne @r
  lda #1
  bne @end
@over:
  lda #0
@end:
  sta end_kind
  jsr go_end
@r:
  rts

update_time:
  inc time_f
  lda time_f
  cmp #60
  bcc @r
  lda #0
  sta time_f
  lda time_s
  beq @r
  dec time_s
  lda #90
  sec
  sbc time_s
  lsr a
  lsr a
  lsr a
  lsr a
  cmp #5
  bcc @lv
  lda #5
@lv:
  sta level
  ; 空の色（だんだん夜明け）
  ldx time_s
  lda #$0f
  cpx #30
  bcs @s
  lda #$01
  cpx #16
  bcs @s
  lda #$02
  cpx #8
  bcs @s
  lda #$12
  cpx #3
  bcs @s
  lda #$21
@s:
  sta sky
@r:
  rts

update_frog:
  lda dizzy
  beq @nd
  dec dizzy
  rts
@nd:
  lda tongue_st
  bne @r
  lda pad
  and #BTN_LEFT
  beq @nl
  lda frog_x
  cmp #10
  bcc @nl
  sec
  sbc #2
  sta frog_x
@nl:
  lda pad
  and #BTN_RIGHT
  beq @nr
  lda frog_x
  cmp #230
  bcs @nr
  clc
  adc #2
  sta frog_x
@nr:
  lda pad_new
  and #BTN_A|BTN_B
  beq @r
  lda #1
  sta tongue_st
  lda #0
  sta catch_n
  sta catch_pts
  jsr sfx_tongue
@r:
  rts

update_tongue:
  lda tongue_st
  bne @a
  rts
@a:
  cmp #1
  bne @back
  lda tongue
  clc
  adc #8
  sta tongue
  cmp #TONGUE_MAX
  bcc @hit
  lda #TONGUE_MAX
  sta tongue
  lda #2
  sta tongue_st
  jmp @hit
@back:
  lda tongue
  sec
  sbc #6
  bcs @b2
  lda #0
@b2:
  sta tongue
  bne @hit
  lda #0
  sta tongue_st
  jsr eat_catch
  rts
@hit:
  jsr tongue_hits
  rts

; 舌の先に虫が当たったか
tongue_hits:
  lda frog_x
  clc
  adc #8
  sta tmp            ; 先の x
  lda #182
  sec
  sbc tongue
  sta tmp2           ; 先の y
  ldx #NBUG-1
@l:
  lda bug_type,x
  beq @next
  lda bug_st,x
  bne @next
  lda bug_x,x
  clc
  adc #4
  sec
  sbc tmp
  bcs @px
  eor #$ff
  adc #1
@px:
  sta tmp3           ; |x のずれ|
  lda bug_dy,x
  clc
  adc #4
  sec
  sbc tmp2
  bcs @py
  eor #$ff
  adc #1
@py:
  sta tmp4           ; |y のずれ|
  lda bug_type,x
  cmp #3
  beq @isfire
  lda tmp3
  cmp #8
  bcs @next
  lda tmp4
  cmp #9
  bcs @next
  jmp @catch
@isfire:             ; ホタルは当たりを小さく（かすっただけでは食べない）
  lda tmp3
  cmp #5
  bcs @next
  lda tmp4
  cmp #6
  bcs @next
  jmp @fire
@catch:
  lda #1
  sta bug_st,x
  inc catch_n
  lda bug_type,x
  cmp #2
  bne @fly
  lda catch_pts
  clc
  adc #3
  sta catch_pts
  jmp @snd
@fly:
  inc catch_pts
@snd:
  txa
  pha
  jsr sfx_catch
  pla
  tax
  jmp @next
@fire:
  lda #0
  sta bug_type,x
  txa
  pha
  jsr hurt
  pla
  tax
@next:
  dex
  bpl @l
  rts

; ホタルを食べた（毒）
hurt:
  lda lives
  beq @z
  dec lives
@z:
  lda #90
  sta dizzy
  lda #2
  sta tongue_st
  jsr sfx_hurt
  rts

; 舌がもどった: とった虫を食べて点に（点 × とった数）
eat_catch:
  lda catch_n
  beq @r
  ldx #NBUG-1
@l:
  lda bug_st,x
  beq @n
  lda #0
  sta bug_st,x
  sta bug_type,x
@n:
  dex
  bpl @l
  ldx catch_n
@m:
  ldy catch_pts
@a:
  jsr add_ten
  dey
  bne @a
  dex
  bne @m
  jsr sfx_eat
@r:
  rts

add_ten:
  txa
  pha
  ldx #4
@l:
  inc score,x
  lda score,x
  cmp #10
  bcc @d
  lda #0
  sta score,x
  dex
  bpl @l
  ldx #5
  lda #9
@c:
  sta score,x
  dex
  bpl @c
@d:
  pla
  tax
  rts

spawn_bugs:
  dec spawn_t
  bne @r
  ldx level
  lda spawn_iv,x
  sta spawn_t
  ldx #NBUG-1
@f:
  lda bug_type,x
  beq @got
  dex
  bpl @f
@r:
  rts
@got:
  jsr rand
  and #15
  ldy level
  cmp fire_ch,y
  bcs @nf
  lda #3
  bne @set
@nf:
  cmp #12
  bcc @fl
  lda #2
  bne @set
@fl:
  lda #1
@set:
  sta bug_type,x
  lda #0
  sta bug_st,x
  sta bug_xl,x
  jsr rand
  and #63
  sta tmp
  jsr rand
  and #31
  clc
  adc tmp
  adc #44
  sta bug_y,x
  sta bug_dy,x
  jsr rand
  sta bug_ph,x
  jsr rand
  and #1
  sta bug_dir,x
  beq @left
  lda #246
  bne @sx
@left:
  lda #0
@sx:
  sta bug_x,x
  ldy bug_type,x
  lda spd_si-1,y
  sta bug_si,x
  lda level
  asl a
  asl a
  asl a
  asl a
  clc
  adc spd_sp-1,y
  sta bug_sp,x
  bcc @r2
  inc bug_si,x
@r2:
  rts

update_bugs:
  ldx #NBUG-1
@l:
  lda bug_type,x
  bne @live
  jmp @next
@live:
  lda bug_st,x
  beq @fly
  lda frog_x
  clc
  adc #4
  sta bug_x,x
  lda #178
  sec
  sbc tongue
  sta bug_dy,x
  jmp @next
@fly:
  ldy bug_type,x
  lda bug_ph,x
  clc
  adc ph_step-1,y
  sta bug_ph,x
  lda bug_dir,x
  bne @mleft
  lda bug_xl,x
  clc
  adc bug_sp,x
  sta bug_xl,x
  lda bug_x,x
  adc bug_si,x
  sta bug_x,x
  cmp #248
  bcs @gone
  jmp @yy
@mleft:
  lda bug_xl,x
  sec
  sbc bug_sp,x
  sta bug_xl,x
  lda bug_x,x
  sbc bug_si,x
  sta bug_x,x
  bcc @gone
  jmp @yy
@gone:
  lda #0
  sta bug_type,x
  jmp @next
@yy:
  lda bug_ph,x
  lsr a
  lsr a
  clc
  adc wave_off-1,y
  tay
  lda wave,y
  clc
  adc bug_y,x
  sta bug_dy,x
@next:
  dex
  bmi @done
  jmp @l
@done:
  rts

draw_play:
  lda #0
  sta oam_i
  lda dizzy
  beq @nd
  lda #S_FROGDIZZY
  bne @f
@nd:
  lda tongue_st
  beq @idle
  lda #S_FROGOPEN
  bne @f
@idle:
  lda #S_FROG
@f:
  jsr put_frog
  lda dizzy
  beq @nostar
  lda #166
  sta tmp
  lda #S_DIZZY
  sta tmp2
  lda #3
  sta tmp3
  lda frame
  and #8
  beq @s1
  lda frog_x
  jmp @s2
@s1:
  lda frog_x
  clc
  adc #8
@s2:
  sta tmp4
  jsr put_spr
@nostar:
  ldx #NBUG-1
@b:
  lda bug_type,x
  bne @draw
  jmp @bn
@draw:
  lda bug_dy,x
  sec
  sbc #1
  sta tmp
  lda bug_x,x
  sta tmp4
  lda bug_type,x
  cmp #3
  beq @fire
  cmp #2
  beq @moth
  lda #2
  sta tmp3
  lda frame
  and #4
  beq @fa
  lda #S_FLYB
  bne @put
@fa:
  lda #S_FLYA
  bne @put
@moth:
  lda #2
  sta tmp3
  lda frame
  and #8
  beq @ma
  lda #S_MOTHB
  bne @put
@ma:
  lda #S_MOTHA
  bne @put
@fire:
  lda #3
  sta tmp3
  txa
  asl a
  asl a
  asl a
  clc
  adc frame
  and #32
  beq @fo
  lda #S_FIREOFF
  bne @put
@fo:
  lda #S_FIREON
@put:
  sta tmp2
  lda bug_dir,x
  beq @nflip
  lda tmp3
  ora #$40
  sta tmp3
@nflip:
  jsr put_spr
@bn:
  dex
  bmi @tongue
  jmp @b
@tongue:
  lda tongue_st
  beq @hearts
  lda frog_x
  clc
  adc #4
  sta tmp4
  lda #1
  sta tmp3
  lda #S_TIP
  sta tmp2
  lda #177
  sec
  sbc tongue
  sta tmp
  jsr put_spr
  lda #S_TONGUE
  sta tmp2
@seg:
  lda tmp
  clc
  adc #8
  sta tmp
  cmp #176
  bcs @hearts
  jsr put_spr
  jmp @seg
@hearts:
  lda #23
  sta tmp
  lda #1
  sta tmp3
  ldx #0
@h:
  lda heart_x,x
  sta tmp4
  cpx lives
  bcc @full
  lda #S_HEARTOFF
  bne @hp
@full:
  lda #S_HEART
@hp:
  sta tmp2
  jsr put_spr
  inx
  cpx #3
  bne @h
  jsr hide_rest
  rts

; 点と時間を画面の上へ
hud:
  lda #>ADDR_SCORE
  ldx #<ADDR_SCORE
  ldy #6
  jsr buf_head
  ldx #0
@l:
  lda score,x
  clc
  adc #T_0
  jsr buf_byte
  inx
  cpx #6
  bne @l
  lda #>ADDR_TIME
  ldx #<ADDR_TIME
  ldy #2
  jsr buf_head
  lda time_s
  ldx #0
@t:
  cmp #10
  bcc @u
  sbc #10
  inx
  bne @t
@u:
  pha
  txa
  clc
  adc #T_0
  jsr buf_byte
  pla
  clc
  adc #T_0
  jsr buf_byte
  rts

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  sta tongue
  sta tongue_st
  ldx #NBUG-1
@cl:
  lda bug_st,x
  beq @cn
  lda #0
  sta bug_st,x
  sta bug_type,x
@cn:
  dex
  bpl @cl
  ; ハイスコア
  ldx #0
@c:
  lda score,x
  cmp hi,x
  bcc @nohi
  bne @newhi
  inx
  cpx #6
  bne @c
  jmp @nohi
@newhi:
  ldx #5
@cp:
  lda score,x
  sta hi,x
  dex
  bpl @cp
@nohi:
  lda end_kind
  beq @over
  lda #<txt_morning
  sta ptr
  lda #>txt_morning
  sta ptr+1
  jsr buf_data
  lda #SONG_MORNING
  jsr music_play
  rts
@over:
  lda #<txt_over
  sta ptr
  lda #>txt_over
  sta ptr+1
  jsr buf_data
  lda #SONG_OVER
  jsr music_play
  rts

end_update:
  lda end_t
  cmp #200
  bcs @k
  inc end_t
@k:
  jsr update_bugs
  jsr draw_play
  lda end_t
  cmp #90
  bne @np
  lda #<txt_push
  sta ptr
  lda #>txt_push
  sta ptr+1
  jsr buf_data
@np:
  lda end_t
  cmp #90
  bcc @r
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
sfx_tongue:
  lda #%10010110
  sta $4000
  lda #%10001010
  sta $4001
  lda #$00
  sta $4002
  lda #$12
  sta $4003
  rts

sfx_catch:
  lda #%10011000
  sta $4000
  lda #$08
  sta $4001
  ldy catch_n
  lda catch_pitch,y
  sta $4002
  lda #$00
  sta $4003
  rts

sfx_eat:
  lda #%01011000
  sta $4000
  lda #%10010010
  sta $4001
  lda #$c0
  sta $4002
  lda #$10
  sta $4003
  rts

sfx_hurt:
  lda #%00000100
  sta $400C
  lda #$0a
  sta $400E
  lda #$40
  sta $400F
  lda #%10011010
  sta $4000
  lda #%10110011
  sta $4001
  lda #$00
  sta $4002
  lda #$11
  sta $4003
  rts

; A = 曲の番号
music_play:
  asl a
  asl a
  tax
  lda song_tab,x
  sta mus_base0
  sta mus_ptr0
  lda song_tab+1,x
  sta mus_base0+1
  sta mus_ptr0+1
  lda song_tab+2,x
  sta mus_base1
  sta mus_ptr1
  lda song_tab+3,x
  sta mus_base1+1
  sta mus_ptr1+1
  lda #1
  sta mus_t0
  sta mus_t1
  sta mus_on
  rts

music_stop:
  lda #0
  sta mus_on
  lda #$30
  sta $4004
  lda #$80
  sta $4008
  sta $400B
  rts

music_update:
  lda mus_on
  beq @r
  lda paused
  bne @r
  dec mus_t0
  bne @c1
  jsr mus_ch0
  lda mus_on
  beq @r
@c1:
  dec mus_t1
  bne @r
  jsr mus_ch1
@r:
  rts

; 矩形波2（メロディ）
mus_ch0:
  ldy #0
  lda (mus_ptr0),y
  cmp #$ff
  bne @nl
  lda mus_base0
  sta mus_ptr0
  lda mus_base0+1
  sta mus_ptr0+1
  lda (mus_ptr0),y
@nl:
  cmp #$fe
  bne @ns
  jsr music_stop
  rts
@ns:
  tax
  iny
  lda (mus_ptr0),y
  sta mus_t0
  lda mus_ptr0
  clc
  adc #2
  sta mus_ptr0
  bcc @p
  inc mus_ptr0+1
@p:
  txa
  beq @rest
  lda #%01000101
  sta $4004
  lda #$08
  sta $4005
  lda period_lo-1,x
  sta $4006
  lda period_hi-1,x
  ora #$08
  sta $4007
  rts
@rest:
  lda #$30
  sta $4004
  rts

; 三角波（ベース）
mus_ch1:
  ldy #0
  lda (mus_ptr1),y
  cmp #$ff
  bne @nl
  lda mus_base1
  sta mus_ptr1
  lda mus_base1+1
  sta mus_ptr1+1
  lda (mus_ptr1),y
@nl:
  cmp #$fe
  bne @ns
  jsr music_stop
  rts
@ns:
  tax
  iny
  lda (mus_ptr1),y
  sta mus_t1
  lda mus_ptr1
  clc
  adc #2
  sta mus_ptr1
  bcc @p
  inc mus_ptr1+1
@p:
  txa
  beq @rest
  lda #$50
  sta $4008
  lda period_lo-1,x
  sta $400A
  lda period_hi-1,x
  ora #$08
  sta $400B
  rts
@rest:
  lda #$80
  sta $4008
  sta $400B
  rts

; ================= 決まりの表 =================
spawn_iv: .byte 60, 52, 44, 38, 32, 28
fire_ch: .byte 2, 3, 4, 4, 5, 6        ; 16 のうちホタルになる数
spd_si: .byte 1, 0, 0                  ; 速さの整数（ハエ・ガ・ホタル）
spd_sp: .byte $00, $90, $70            ; 速さの小数
ph_step: .byte 12, 4, 6                ; ゆれの速さ
heart_x: .byte 16, 26, 36
catch_pitch: .byte $a0, $a0, $80, $68, $58, $48, $40
