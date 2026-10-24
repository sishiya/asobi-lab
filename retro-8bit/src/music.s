; 曲の係（どのゲームでも共通。build.mjs が game.s のうしろにつなぐ）
; メロディは矩形波2、ベースは三角波。効果音は矩形波1とノイズなので、曲とぶつからない。
; メロディは 1 フレームずつ音量を下げる（env_tab。はじめに強く、のばすと小さく）＝ 毎音いっぱいの音量で鳴らさない。
; ベースは三角波の線形カウンタで短く切る（TRI_LIN）。曲ごとの音色（デューティ）は song_duty。
; ゲームの game.s で決めておくもの: mus_on・mus_ptr0/1・mus_t0/1・mus_base0/1・paused（ゼロページ）
; data.mjs が決めるもの: song_tab・song_duty・env_tab・ENV_LEN・TRI_LIN・period_lo/hi

env_i0 = $3B       ; いまの音の何フレーム目か
mus_duty = $3C     ; 矩形波2の音色（$00 12.5%・$40 25%・$80 50%）
mus_note0 = $3D    ; いま鳴っているメロディ（0 = 休み）

; A = 曲の番号
music_play:
  tax
  lda song_duty,x
  sta mus_duty
  txa
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
  lda #0
  sta mus_note0
  rts

music_stop:
  lda #0
  sta mus_on
  sta mus_note0
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
  ; メロディの音量（音の頭から ENV_LEN フレームで下がって、そのあとは同じ）
  lda mus_note0
  beq @nv
  ldx env_i0
  lda env_tab,x
  ora mus_duty
  ora #$30
  sta $4004
  cpx #ENV_LEN-1
  bcs @nv
  inc env_i0
@nv:
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
  stx mus_note0
  txa
  beq @rest
  lda #0
  sta env_i0
  lda env_tab
  ora mus_duty
  ora #$30
  sta $4004
  lda #$08
  sta $4005
  lda period_lo-1,x
  sta $4006
  lda period_hi-1,x
  sta $4007
  rts
@rest:
  lda #$30
  sta $4004
  rts

; 三角波（ベース）。短く切って、ずっと鳴りつづけないように
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
  lda #TRI_LIN
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
