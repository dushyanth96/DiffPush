#!/usr/bin/env node
/* Dependency-free per-problem social cards.
 *
 * The app is a static-export site with 369 crawlable problem pages, but every
 * page shared the same og-image.png. This module renders a deterministic
 * 1200x630 PNG per problem at build time: obsidian canvas, faint grid, topic
 * eyebrow, wrapped title, difficulty + optimal complexity, site mark.
 *
 * No native deps, no fonts to install: a 5x7 bitmap face is drawn as integer
 * blocks, which keeps the build reproducible on any machine/CI.
 */
const zlib = require('zlib')

/* --------------------------------- PNG ---------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* -------------------------------- canvas -------------------------------- */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

class Canvas {
  constructor(width, height, bg) {
    this.w = width
    this.h = height
    this.px = Buffer.alloc(width * height * 3)
    const [r, g, b] = hex(bg)
    for (let i = 0; i < this.px.length; i += 3) {
      this.px[i] = r
      this.px[i + 1] = g
      this.px[i + 2] = b
    }
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 3
    this.px[i] = color[0]
    this.px[i + 1] = color[1]
    this.px[i + 2] = color[2]
  }

  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color)
  }

  stroke(x, y, w, h, color, size = 1) {
    this.rect(x, y, w, size, color)
    this.rect(x, y + h - size, w, size, color)
    this.rect(x, y, size, h, color)
    this.rect(x + w - size, y, size, h, color)
  }

  png() {
    return encodePng(this.w, this.h, this.px)
  }
}

/* ------------------------------ bitmap font ------------------------------ */

const G = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10011', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10011', '10101', '10101', '10101', '11001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  ',': ['00000', '00000', '00000', '00000', '00110', '00110', '01000'],
  ':': ['00000', '00110', '00110', '00000', '00110', '00110', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  '{': ['00110', '00100', '00100', '01000', '00100', '00100', '00110'],
  '}': ['01100', '00100', '00100', '00010', '00100', '00100', '01100'],
  '·': ['00000', '00000', '00000', '00100', '00000', '00000', '00000'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '^': ['00100', '01010', '10001', '00000', '00000', '00000', '00000'],
  '~': ['00000', '00000', '01001', '10110', '00000', '00000', '00000'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  ';': ['00000', '00110', '00110', '00000', '00110', '00110', '01000'],
}

const ADVANCE = 6 // 5px glyph + 1px gap

function textWidth(str, scale) {
  return String(str).length * ADVANCE * scale - scale
}

function drawText(canvas, str, x, y, scale, color) {
  const chars = String(str).toUpperCase()
  let cx = x
  for (const ch of chars) {
    const glyph = G[ch] ?? G['?']
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') canvas.rect(cx + col * scale, y + row * scale, scale, scale, color)
      }
    }
    cx += ADVANCE * scale
  }
  return cx - scale
}

function wrapWords(str, maxWidth, scale) {
  const words = String(str).toUpperCase().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (textWidth(probe, scale) <= maxWidth || !line) line = probe
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

/* ------------------------------- the card -------------------------------- */

const COLORS = {
  bg: hex('#07090E'),
  grid: hex('#101724'),
  white: hex('#F4F7FB'),
  slate: hex('#7D8B9F'),
  slateDim: hex('#4B5768'),
  emerald: hex('#10B981'),
  amber: hex('#F59E0B'),
  rose: hex('#F43F5E'),
  panel: hex('#0D111A'),
}

const DIFF_COLOR = {
  Easy: COLORS.emerald,
  Medium: COLORS.amber,
  Hard: COLORS.rose,
  Baseline: COLORS.emerald,
  'Standard Bar': COLORS.amber,
  'DiffPush Tier': COLORS.rose,
}

// Rough glyph-count budget per line at each scale (canvas is 1200 wide, 80px
// margins). Kept explicit so the title never spills off the card.
const TITLE_SCALE_STEPS = [6, 5, 4, 3]

function buildCard({ title, topic, difficulty, time, space, engine, eyebrow, chip, meta, footer }) {
  const canvas = new Canvas(1200, 630, '#07090E')
  const W = 1200
  const M = 80

  // faint blueprint grid
  for (let x = M; x <= W - M; x += 48) canvas.rect(x, 150, 1, 400, COLORS.grid)
  for (let y = 150; y <= 550; y += 48) canvas.rect(M, y, W - M * 2, 1, COLORS.grid)

  // brand mark + wordmark
  canvas.rect(M, 56, 22, 22, COLORS.emerald)
  canvas.rect(M + 7, 62, 4, 10, COLORS.bg)
  canvas.rect(M + 11, 62, 4, 5, COLORS.bg)
  drawText(canvas, 'DIFFPUSH', M + 34, 58, 3, COLORS.white)
  const right = 'A2Z DSA SHEET · 369 PROBLEMS'
  drawText(canvas, right, W - M - textWidth(right, 2), 62, 2, COLORS.slateDim)

  canvas.rect(M, 168, 56, 4, COLORS.emerald)

  const eyebrowText = eyebrow ?? [topic, difficulty].filter(Boolean).join(' / ')
  drawText(canvas, eyebrowText, M, 192, 2, COLORS.emerald)

  // title: pick the largest scale that fits in three lines
  let scale = TITLE_SCALE_STEPS[TITLE_SCALE_STEPS.length - 1]
  let lines = wrapWords(title, W - M * 2, scale)
  for (const s of TITLE_SCALE_STEPS) {
    const candidate = wrapWords(title, W - M * 2, s)
    if (candidate.length <= 3) { scale = s; lines = candidate; break }
  }

  const lineH = scale * 9
  let y = 240
  for (const line of lines.slice(0, 3)) {
    drawText(canvas, line, M, y, scale, COLORS.white)
    y += lineH
  }

  // difficulty chip
  const diffLabel = String(chip || difficulty || 'PROBLEM').toUpperCase()
  const chipW = textWidth(diffLabel, 2) + 24
  const chipY = 512
  canvas.rect(M, chipY, chipW, 30, COLORS.panel)
  canvas.stroke(M, chipY, chipW, 30, DIFF_COLOR[difficulty] ?? COLORS.slate, 1)
  drawText(canvas, diffLabel, M + 12, chipY + 8, 2, DIFF_COLOR[difficulty] ?? COLORS.slate)

  // complexity + runtime
  const metaText = meta ?? `OPTIMAL ${time || '?'} TIME · ${space || '?'} SPACE`
  if (metaText) drawText(canvas, metaText, M + chipW + 20, chipY + 8, 2, COLORS.slate)

  // footer
  canvas.rect(M, 566, W - M * 2, 1, COLORS.grid)
  drawText(canvas, footer || engine || 'RUNS IN YOUR BROWSER · COMMITS TO GITHUB AFTER REVIEW', M, 582, 2, COLORS.slateDim)
  const site = 'DIFFPUSH.PAGES.DEV'
  drawText(canvas, site, W - M - textWidth(site, 2), 582, 2, COLORS.slateDim)

  return canvas.png()
}

module.exports = { buildCard, textWidth, drawText, Canvas, encodePng }
