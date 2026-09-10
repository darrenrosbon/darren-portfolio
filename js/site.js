const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hero = document.getElementById('hero');

document.querySelector('.site-mark').addEventListener('click', (e) => {
  e.preventDefault();
  hero.scrollIntoView({ behavior: 'smooth' });
  history.replaceState(null, '', location.pathname + location.search);
});
const BG_FONT_SIZE = 13, CELL = 13;
const BG_COLOR = [150, 150, 150];
const FACE_COLOR = [232, 202, 160];
const MOBILE_BREAKPOINT = 700;

// Face sizing/position scales down and drops lower on narrow screens so it
// doesn't collide with the heading text, which is much wider relative to
// the viewport once font-size clamps to its minimum.
let FACE_FONT, FACE_CELL_W, FACE_CELL_H, FACE_TOP_PADDING;

let W, H, cols, rows;
let faceLines, winkPatchLines, faceCols, faceRows, faceOriginX, faceOriginY;
let occupied;

// ASCII_ART and ASCII_ART_WINK are two independently-generated conversions
// (open eye vs. closed eye), not one clean edit of the other — dithering
// differs slightly everywhere, not just at the eye. Swapping the whole
// face on every blink would make the entire portrait shimmer, not just
// the eye. Instead, isolate the eye in the raw (unmirrored) grid — rows
// 95-125, cols 88-147, found from where the two files actually differ,
// with a little padding — and only substitute that box's characters from
// the closed version. Everything outside the box stays byte-identical to
// the open face regardless of blink state.
const WINK_ROW_START = 95, WINK_ROW_END = 125;
const WINK_COL_START = 88, WINK_COL_END = 147; // inclusive

// Drawn directly (no mirroring) — unlike the old profile-cutout art, this
// is a full front-facing portrait already in the right orientation, so
// flipping it column-by-column would just mirror the face left/right for
// no reason.
function buildFace() {
  faceLines = ASCII_ART.replace(/\r/g, '').split('\n');
  const closedLines = ASCII_ART_WINK.replace(/\r/g, '').split('\n');
  faceCols = Math.max(...faceLines.map(l => l.length));
  faceRows = faceLines.length;
  faceOriginX = W - faceCols * FACE_CELL_W;
  faceOriginY = FACE_TOP_PADDING;

  winkPatchLines = faceLines.map((line, row) => {
    if (row < WINK_ROW_START || row > WINK_ROW_END) return line;
    const closed = closedLines[row] || '';
    const width = Math.max(line.length, closed.length, WINK_COL_END + 1);
    const chars = line.padEnd(width, ' ').split('');
    const closedPadded = closed.padEnd(width, ' ');
    for (let c = WINK_COL_START; c <= WINK_COL_END; c++) chars[c] = closedPadded[c];
    return chars.join('');
  });
}

function buildOccupancyMask() {
  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const mctx = mask.getContext('2d');
  mctx.fillStyle = '#fff';
  for (let row = 0; row < faceRows; row++) {
    const line = faceLines[row];
    let lo = Infinity, hi = -Infinity;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === ' ') continue;
      if (c < lo) lo = c;
      if (c > hi) hi = c;
    }
    if (hi < lo) continue;
    const xStart = faceOriginX + lo * FACE_CELL_W;
    const xEnd = faceOriginX + (hi + 1) * FACE_CELL_W;
    const y = faceOriginY + row * FACE_CELL_H;
    mctx.fillRect(xStart - 1, y - 1, xEnd - xStart + 2, FACE_CELL_H + 2);
  }
  const data = mctx.getImageData(0, 0, W, H).data;

  occupied = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (let row = 0; row < rows; row++) {
    const py = row * CELL + Math.floor(CELL / 2);
    for (let col = 0; col < cols; col++) {
      const px = col * CELL + Math.floor(CELL / 2);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const idx = (py * W + px) * 4;
      if (data[idx + 3] > 40) occupied[row][col] = true;
    }
  }
}

function resize() {
  W = hero.clientWidth;
  H = hero.clientHeight;
  if (W === 0 || H === 0) {
    // The hero can briefly report zero size during initial layout in some
    // embedding contexts; bail out and retry next frame rather than crash
    // getImageData with a zero-size read.
    requestAnimationFrame(resize);
    return;
  }
  // Backing store sized for the device's actual pixel density, not just
  // its CSS pixels — without this, a phone at DPR 2-3 gets a canvas bitmap
  // stretched 2-3x to fill the screen, which is what was smearing the
  // ASCII face into blurry stripes on mobile while desktop (DPR 1 in most
  // test setups) looked fine. ctx.setTransform (not ctx.scale) so repeat
  // calls on window resize replace the matrix instead of compounding it —
  // every fillText/drawImage call below keeps using plain CSS-pixel
  // coordinates (W, H, FACE_CELL_*, CELL) and the transform does the rest.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cols = Math.ceil(W / CELL);
  rows = Math.ceil(H / CELL);

  // Cell sizes scaled down from the old profile art's values (3/5/5) by
  // the ratio of old:new grid dimensions (98x131 -> 158x191), so the face
  // occupies about the same footprint on screen despite the new art
  // having ~1.5x more rows/cols of detail.
  if (W < MOBILE_BREAKPOINT) {
    FACE_FONT = 2.45; FACE_CELL_W = 1.4; FACE_CELL_H = 2.45;
    FACE_TOP_PADDING = 90; // clears the heading (now single-line, "and stuff" moved out of flow) + byline above it
  } else {
    FACE_FONT = 3.5; FACE_CELL_W = 2; FACE_CELL_H = 3.5;
    FACE_TOP_PADDING = 28; // leaves room below the face for "the guy behind the work"
  }

  buildFace();
  buildOccupancyMask();
  buildNodes();
  equalizeCardSizes();
  sizeSocialIcons();
  positionAboutSection();
  positionMainBody();
  positionDesktopContact();

  // The draw loop must not start until the first successful resize has
  // populated rows/occupied/etc. — starting it unconditionally at load
  // races the zero-size retry above and can hit `draw()` with those
  // globals still undefined.
  if (!started) {
    started = true;
    requestAnimationFrame(draw);
  }
}
window.addEventListener('resize', resize);
let started = false;

const GRID_SPACING = 6;
let nodes = [];
let pulses = [];
function buildNodes() {
  nodes = [];
  for (let row = 0; row < rows; row += GRID_SPACING) {
    for (let col = 0; col < cols; col += GRID_SPACING) {
      if (!occupied[row] || !occupied[row][col]) nodes.push({ col, row });
    }
  }
}

// Mobile's project cards are separate boxes stacked in one column, so
// unlike the desktop grid (equal-size cells for free) each one naturally
// sizes to its own content — and with align-items:flex-start (CSS) that
// means each card is only as wide as its own longest line, not stretched
// to fill #work regardless of need. Measure every card's true natural
// width and height, then match every card to the largest of each —
// smallest shared size that still fits the biggest card, not a guessed
// fixed box and not dead space stretched out to cover the face behind it.
// Desktop's grid cells already share a row/column via CSS, so this is a
// no-op there.
function equalizeCardSizes() {
  const cards = document.querySelectorAll('.card');
  if (!cards.length) return;
  cards.forEach((c) => { c.style.width = ''; c.style.height = ''; }); // reset before measuring
  if (W >= MOBILE_BREAKPOINT) return;
  let maxW = 0, maxH = 0;
  cards.forEach((c) => {
    const r = c.getBoundingClientRect();
    maxW = Math.max(maxW, r.width);
    maxH = Math.max(maxH, r.height);
  });
  cards.forEach((c) => { c.style.width = maxW + 'px'; c.style.height = maxH + 'px'; });
}

// Mobile's icon row stretches to the two-line heading's height via CSS
// (align-items:stretch), and each icon is meant to size itself to match
// via aspect-ratio:1/1 — but aspect-ratio's interaction with flex stretch
// resolves the icon's WIDTH from its SVG's own intrinsic size instead of
// from the stretched height, so the icons render as tall thin rectangles,
// not squares. Measuring the heading's real height and setting each
// icon's width/height explicitly sidesteps that CSS ambiguity entirely —
// same "measure the real DOM, don't fight the cascade" approach already
// used for the cards above. Desktop's icons are a fixed 40x40 in CSS and
// don't need this.
const SOCIAL_ICON_SCALE = 0.82; // a touch smaller than the full heading height, not a full stretch-fill

function sizeSocialIcons() {
  const icons = document.querySelectorAll('.guy-heading-row .social-icon');
  if (!icons.length) return;
  icons.forEach((i) => { i.style.width = ''; i.style.height = ''; i.style.alignSelf = ''; }); // reset before measuring
  if (W >= MOBILE_BREAKPOINT) return;
  const heading = document.querySelector('.guy-heading');
  if (!heading) return;
  const size = (heading.getBoundingClientRect().height * SOCIAL_ICON_SCALE) + 'px';
  // align-self:center — an explicit height opts the item out of the row's
  // align-items:stretch, so without this it'd anchor to the top instead
  // of sitting centered against the two-line heading.
  icons.forEach((i) => { i.style.width = size; i.style.height = size; i.style.alignSelf = 'center'; });
}

// Positions #about relative to the face's actual bottom edge, computed —
// not a fixed CSS pixel value tuned against one test environment, which
// kept being wrong whenever the content above it changed (different font
// rendering/wrapping, or — the bug this caught — the work grid gaining a
// 5th card and wrapping to a 3rd row, which pushed #work's real bottom
// edge below the desktop rule's fixed top:500px and caused an overlap).
function positionAboutSection() {
  const about = document.getElementById('about');
  const work = document.getElementById('work');
  const heroTop = hero.getBoundingClientRect().top;
  const gap = 24;
  if (W >= MOBILE_BREAKPOINT) {
    about.style.marginTop = '';
    about.style.top = '0px'; // reset before measuring so the old value can't skew the new one
    const workBottom = work.getBoundingClientRect().bottom - heroTop;
    about.style.top = (workBottom + gap) + 'px';
    return;
  }
  about.style.top = '';
  about.style.marginTop = '0px'; // reset before measuring so the old value can't skew the new one
  const workBottom = work.getBoundingClientRect().bottom - heroTop;
  const faceBottom = FACE_TOP_PADDING + faceRows * FACE_CELL_H;
  const marginTop = Math.max(gap, (faceBottom + gap) - workBottom);
  about.style.marginTop = marginTop + 'px';
}

// Desktop: the WHOLE left column (heading, work, about, contact) centered
// as one unit in the open space between the window's left edge and the
// face's left edge — not just the contact block on its own, and not the
// full window width. All four share one computed `left` so they read as
// a single aligned column, same as they already did with the old fixed
// left:60px, just recentered.
function positionMainBody() {
  const headingWrap = document.querySelector('.heading-wrap');
  const work = document.getElementById('work');
  const about = document.getElementById('about');
  const contact = document.querySelector('.desktop-contact');
  if (W < MOBILE_BREAKPOINT) {
    [headingWrap, work, about, contact].forEach((el) => { if (el) el.style.left = ''; });
    if (contact) contact.style.width = '';
    return;
  }
  // Column width matches the existing CSS formula for #work/#about
  // (min(56%, 640px)) — read live rather than duplicating the constant,
  // so this stays correct if that CSS value ever changes.
  const columnWidth = work.getBoundingClientRect().width;
  const columnLeft = Math.max(24, (faceOriginX - columnWidth) / 2);

  headingWrap.style.left = columnLeft + 'px';
  work.style.left = columnLeft + 'px';
  about.style.left = columnLeft + 'px';
  if (contact) {
    contact.style.left = columnLeft + 'px';
    contact.style.width = columnWidth + 'px';
  }
}

// Desktop's email + social icons block, vertically centered in the empty
// space below #about — computed from the actual measured position of
// #about and the hero's real height, not a fixed CSS px value (which only
// ever matched whatever viewport happened to be open during testing).
function positionDesktopContact() {
  const block = document.querySelector('.desktop-contact');
  const about = document.getElementById('about');
  if (!block) return;
  if (W < MOBILE_BREAKPOINT) {
    block.style.top = '';
    return;
  }
  const heroTop = hero.getBoundingClientRect().top;
  const aboutBottom = about.getBoundingClientRect().bottom - heroTop;
  const heroHeight = hero.getBoundingClientRect().height;
  const blockHeight = block.getBoundingClientRect().height;
  const top = aboutBottom + Math.max(24, (heroHeight - aboutBottom - blockHeight) / 2);
  block.style.top = top + 'px';
}

resize();

// Fonts loading after initial layout can reflow #work's text (different
// wrap points), which would silently invalidate the measurements above —
// redo it once the real font is actually in place. Order matters: the
// column's left position depends on #work's rendered width, and the
// vertical centering depends on #about's rendered bottom, both of which
// can shift once the real font swaps in.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { equalizeCardSizes(); sizeSocialIcons(); positionAboutSection(); positionMainBody(); positionDesktopContact(); });
}

// Occasional blink, cartoon-wink style: eye closes and holds for a beat,
// then a little twinkle star pops in next to it, spins, and fades before
// the eye reopens. isWinking gates drawFace()'s winkPatchLines swap (see
// above); blinkState/blinkStateStart drive the star's own timing, updated
// once per frame in draw() rather than via nested setTimeouts, so its
// scale/rotation/fade can be computed smoothly against the same tMs the
// rest of the canvas animates on.
let isWinking = false;
let blinkState = 'idle'; // 'idle' | 'closed' | 'star'
let blinkStateStart = 0;
const BLINK_CLOSED_HOLD = 1000; // eye stays shut before the star shows up
const STAR_IN = 150, STAR_HOLD = 450, STAR_OUT = 200;
const STAR_TOTAL = STAR_IN + STAR_HOLD + STAR_OUT;

function scheduleNextBlink() {
  const delay = 4000 + Math.random() * 5000;
  setTimeout(() => {
    isWinking = true;
    blinkState = 'closed';
    blinkStateStart = performance.now();
  }, delay);
}
scheduleNextBlink();

function updateBlink(tMs) {
  if (blinkState === 'idle') return;
  const elapsed = tMs - blinkStateStart;
  if (blinkState === 'closed' && elapsed >= BLINK_CLOSED_HOLD) {
    blinkState = 'star';
    blinkStateStart = tMs;
  } else if (blinkState === 'star' && elapsed >= STAR_TOTAL) {
    blinkState = 'idle';
    isWinking = false;
    scheduleNextBlink();
  }
}

// A classic 4-point cartoon sparkle (long spikes on the axes, short ones
// on the diagonals) rather than a plain 5-point star — reads as a
// "twinkle" at a glance, which a regular star doesn't at this size.
function drawSparkle(cx, cy, size, rotation, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${FACE_COLOR[0]}, ${FACE_COLOR[1]}, ${FACE_COLOR[2]})`;
  const outerR = size, innerR = size * 0.32;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWinkStar(tMs) {
  if (blinkState !== 'star') return;
  const elapsed = tMs - blinkStateStart;
  let t; // 0..1 grow/fade envelope
  if (elapsed < STAR_IN) {
    t = elapsed / STAR_IN;
  } else if (elapsed < STAR_IN + STAR_HOLD) {
    t = 1;
  } else {
    t = 1 - (elapsed - STAR_IN - STAR_HOLD) / STAR_OUT;
  }
  t = Math.max(0, Math.min(1, t));
  if (t <= 0) return;

  const rotation = (elapsed / STAR_TOTAL) * Math.PI * 1.4; // a slow, lazy spin, not a whirl
  const cx = faceOriginX + ((WINK_COL_START + WINK_COL_END) / 2) * FACE_CELL_W;
  const cy = faceOriginY + ((WINK_ROW_START + WINK_ROW_END) / 2) * FACE_CELL_H;
  const starSize = 11 * FACE_CELL_W;
  drawSparkle(cx, cy, starSize * t, rotation, t);
}

let lastSpawn = 0;
const PULSE_LIFE = 1400;

function drawBackground(tMs) {
  ctx.font = `${BG_FONT_SIZE}px 'Courier New', monospace`;
  ctx.textBaseline = 'top';

  for (let row = 0; row < rows; row++) {
    if (!occupied[row]) continue; // defensive: guards a mid-resize inconsistency, see resize()
    const onH = row % GRID_SPACING === 0;
    for (let col = 0; col < cols; col++) {
      if (occupied[row][col]) continue;
      const onV = col % GRID_SPACING === 0;
      if (!onH && !onV) continue;
      let ch = onH ? '-' : '|';
      if (onH && onV) ch = '+';
      ctx.fillStyle = `rgba(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]}, ${onH && onV ? 0.14 : 0.07})`;
      ctx.fillText(ch, col * CELL, row * CELL);
    }
  }

  if (tMs - lastSpawn > 220 && nodes.length) {
    const spawnCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < spawnCount; i++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      pulses.push({ col: n.col, row: n.row, start: tMs });
    }
    lastSpawn = tMs;
  }
  pulses = pulses.filter(p => tMs - p.start < PULSE_LIFE);

  for (const p of pulses) {
    if (!occupied[p.row]) continue;
    const age = (tMs - p.start) / PULSE_LIFE;
    const coreAlpha = Math.max(0, 1 - age * 2.2);
    if (coreAlpha > 0 && !occupied[p.row][p.col]) {
      ctx.fillStyle = `rgba(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]}, ${coreAlpha.toFixed(3)})`;
      ctx.fillText('#', p.col * CELL, p.row * CELL);
    }
    const armLen = Math.floor(age * 5);
    const armAlpha = (1 - age) * 0.5;
    if (armAlpha > 0.02) {
      for (let i = 1; i <= armLen; i++) {
        const dirs = [[i, 0], [-i, 0], [0, i], [0, -i]];
        for (const [dc, dr] of dirs) {
          const cc = p.col + dc, rr = p.row + dr;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          if (!occupied[rr] || occupied[rr][cc]) continue;
          ctx.fillStyle = `rgba(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]}, ${armAlpha.toFixed(3)})`;
          ctx.fillText(dc !== 0 ? '-' : '|', cc * CELL, rr * CELL);
        }
      }
    }
  }

  ctx.font = `10px 'Courier New', monospace`;
  for (let row = GRID_SPACING; row < rows; row += GRID_SPACING * 3) {
    if (!occupied[row]) continue;
    for (let col = GRID_SPACING; col < cols; col += GRID_SPACING * 4) {
      if (occupied[row][col]) continue;
      const tag = `${String(col * 4).padStart(3, '0')}.${String(row * 4).padStart(3, '0')}`;
      ctx.fillStyle = `rgba(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]}, 0.22)`;
      ctx.fillText(tag, col * CELL + 4, row * CELL - 12);
    }
  }
}

function drawFace() {
  ctx.font = `${FACE_FONT}px 'Courier New', monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = `rgb(${FACE_COLOR[0]}, ${FACE_COLOR[1]}, ${FACE_COLOR[2]})`;
  const lines = isWinking ? winkPatchLines : faceLines;
  for (let row = 0; row < faceRows; row++) {
    const line = lines[row];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === ' ') continue;
      ctx.fillText(ch, faceOriginX + c * FACE_CELL_W, faceOriginY + row * FACE_CELL_H);
    }
  }
}

function draw(tMs) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  drawBackground(tMs);
  updateBlink(tMs);
  drawFace();
  drawWinkStar(tMs);
  requestAnimationFrame(draw);
}
