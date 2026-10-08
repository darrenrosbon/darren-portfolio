const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
// Inner pages (pricing) have no hero or home layout: same background, no column positioning.
const IS_HOME = !!document.querySelector('.heading-wrap');
const hero = document.getElementById('hero') || document.documentElement;

const siteMark = document.querySelector('.site-mark');
if (IS_HOME && siteMark && siteMark.getAttribute('href') === '#hero') {
  siteMark.addEventListener('click', (e) => {
    e.preventDefault();
    hero.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', location.pathname + location.search);
  });
}
const BG_FONT_SIZE = 13, CELL = 13;
const BG_COLOR = [150, 150, 150];
const FACE_COLOR = [232, 202, 160];
const MOBILE_BREAKPOINT = 700;
// Visitors who ask for less motion get the still grid and face: no pulses, no wink.
const REDUCED_MOTION = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Face sizing/position scales down and drops lower on narrow screens so it
// doesn't collide with the heading text, which is much wider relative to
// the viewport once font-size clamps to its minimum.
let FACE_FONT, FACE_CELL_W, FACE_CELL_H, FACE_TOP_PADDING;

let W, H, cols, rows, DPR = 1;
// Offscreen copies of the static grid and the face; built in buildCaches().
let bgCache = null, faceOpenCache = null, faceWinkCache = null;
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
  if (W < MOBILE_BREAKPOINT) {
    faceOriginY = FACE_TOP_PADDING; // fixed offset that clears the heading
  } else {
    // Desktop: the fixed CTA card owns the bottom-right corner, so the face
    // must end above it. Shrink to fit if the viewport is too short, then
    // center in the viewport, shifting up if that would reach the card.
    // Reserve the same room for the quote card on every page (whether or not that page
    // shows one) so the face has the identical size and position everywhere.
    const cardBlock = 200;
    const limit = H - cardBlock;
    const scale = Math.max(0.55, Math.min(1, (limit - FACE_TOP_PADDING) / (faceRows * FACE_CELL_H)));
    FACE_FONT *= scale; FACE_CELL_W *= scale; FACE_CELL_H *= scale;
    const fh = faceRows * FACE_CELL_H;
    faceOriginY = Math.max(FACE_TOP_PADDING, Math.min((H - fh) / 2, limit - fh));
  }
  faceOriginX = W - faceCols * FACE_CELL_W;

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

function resize() { layout(false); }

// keepHeight is true only on the second pass after growing the hero to fit
// the desktop column; every other call starts from the CSS height.
function layout(keepHeight) {
  if (!keepHeight && IS_HOME) hero.style.height = '';
  // Canvas is position:fixed, so it covers the viewport, not the (taller,
  // scrolling) hero. Mobile uses the larger of innerHeight/screen.height so
  // the strip revealed when the URL bar collapses is still painted.
  W = hero.clientWidth;
  H = window.innerHeight;
  if (W < MOBILE_BREAKPOINT) H = Math.max(H, window.screen.height || 0);
  if (W === 0 || H === 0) {
    // The hero can briefly report zero size during initial layout in some
    // embedding contexts; bail out and retry next frame rather than crash
    // getImageData with a zero-size read.
    requestAnimationFrame(() => layout(keepHeight));
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
  DPR = dpr;
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
    FACE_TOP_PADDING = 130; // clears the two-line heading + byline above it
  } else {
    FACE_FONT = 3.5; FACE_CELL_W = 2; FACE_CELL_H = 3.5;
    FACE_TOP_PADDING = 28;
  }

  buildFace();
  buildOccupancyMask();
  buildNodes();
  buildCaches();
  if (IS_HOME) {
    sizeSocialIcons();
    positionServices();
    positionAboutSection();
    positionMainBody();
    positionDesktopContact();
    centerPageContent();
  }

  // Grow the hero to fit the last block on the page: the contact block, else
  // the about block, else whichever stacked block comes last.
  const stacked = stackedBlocks();
  const lastBlock = document.querySelector('.desktop-contact') || document.getElementById('about') || stacked[stacked.length - 1];
  if (IS_HOME && lastBlock && !keepHeight && W >= MOBILE_BREAKPOINT) {
    const heroTop = hero.getBoundingClientRect().top;
    const contactBottom = lastBlock.getBoundingClientRect().bottom - heroTop;
    const needed = Math.ceil(contactBottom + (hero.dataset.page === 'about' || hero.dataset.page === 'home' ? 16 : 40));
    if (needed > hero.clientHeight) {
      hero.style.height = needed + 'px';
      layout(true);
      return;
    }
  }

  // The draw loop must not start until the first successful resize has
  // populated rows/occupied/etc. — starting it unconditionally at load
  // races the zero-size retry above and can hit `draw()` with those
  // globals still undefined.
  if (!started) {
    started = true;
    requestAnimationFrame(draw);
  }
}
// Mobile URL-bar show/hide fires height-only resizes on every scroll; a full
// relayout each time would thrash, so only react when the width changes.
window.addEventListener('resize', () => {
  if (W < MOBILE_BREAKPOINT && hero.clientWidth === W) return;
  resize();
});
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
  // Cap the size so icons, gaps and heading fit between the page margins; on very
  // narrow screens the row used to push the first icon off the left edge.
  const gap = 12, sideMargin = 24;
  const fit = (W - sideMargin * 2 - heading.getBoundingClientRect().width - icons.length * gap) / icons.length;
  const size = Math.max(16, Math.min(heading.getBoundingClientRect().height * SOCIAL_ICON_SCALE, fit)) + 'px';
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
// Vertical space between the Projects / Services / Tools blocks (desktop).
const BLOCK_GAP = 48;

function stackedBlocks() {
  return ['packages', 'services', 'work', 'process']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function positionServices() {
  const blocks = stackedBlocks();
  if (W < MOBILE_BREAKPOINT) {
    blocks.forEach((b) => { b.style.top = ''; });
    return;
  }
  const heroTop = hero.getBoundingClientRect().top;
  // The headline is taller than the old single line, so the first block starts
  // below it instead of at a fixed offset; each later block follows the last.
  const headingWrap = document.querySelector('.heading-wrap');
  let y = headingWrap.getBoundingClientRect().bottom - heroTop + 32;
  blocks.forEach((b) => {
    b.style.top = y + 'px';
    y = b.getBoundingClientRect().bottom - heroTop + BLOCK_GAP;
  });
}

function positionAboutSection() {
  const about = document.getElementById('about');
  const blocks = stackedBlocks();
  if (!about) return;
  // Under the last stacked block, or straight under the headline when the page has none.
  const above = blocks.length ? blocks[blocks.length - 1] : document.querySelector('.heading-wrap');
  const heroTop = hero.getBoundingClientRect().top;
  const gap = blocks.length ? BLOCK_GAP : 32;
  if (W >= MOBILE_BREAKPOINT) {
    about.style.marginTop = '';
    about.style.top = '0px'; // reset before measuring so the old value can't skew the new one
    const aboveBottom = above.getBoundingClientRect().bottom - heroTop;
    about.style.top = (aboveBottom + gap) + 'px';
    return;
  }
  about.style.top = '';
  about.style.marginTop = gap + 'px'; // face is fixed behind the content now, nothing to clear
}

// Desktop: the WHOLE left column (heading, work, about, contact) centered
// as one unit in the open space between the window's left edge and the
// face's left edge — not just the contact block on its own, and not the
// full window width. All four share one computed `left` so they read as
// a single aligned column, same as they already did with the old fixed
// left:60px, just recentered.
function positionMainBody() {
  const headingWrap = document.querySelector('.heading-wrap');
  const blocks = stackedBlocks();
  const about = document.getElementById('about');
  const contact = document.querySelector('.desktop-contact');
  const column = [headingWrap, ...blocks, about, contact].filter(Boolean);
  if (W < MOBILE_BREAKPOINT) {
    column.forEach((el) => { el.style.left = ''; });
    if (contact) contact.style.width = '';
    if (about) about.style.width = '';
    return;
  }
  // Column width matches the existing CSS formula for the blocks (min(56%, 640px)),
  // read live rather than duplicating the constant.
  // Pages with no stacked blocks (About) use the whole open space beside the face.
  let columnWidth;
  if (blocks.length) {
    columnWidth = blocks[0].getBoundingClientRect().width;
  } else if (about) {
    // Size the column to the content itself, capped to the space beside the face,
    // so the group sits centered with even spacing instead of stretching to the edges.
    about.style.width = 'max-content';
    columnWidth = Math.max(320, Math.min(about.getBoundingClientRect().width, faceOriginX - 96));
    about.style.width = columnWidth + 'px';
  } else {
    columnWidth = Math.min(W * 0.56, 640);
  }
  // The headline/eyebrow share one left edge on every page (the pricing page's own
  // content edge); pages with stacked blocks line them up under it, About centers its
  // wider content in the space beside the face.
  // 64px minimum keeps the eyebrow clear of the logo mark that now shares its row.
  const pageLeft = Math.max(64, (W - 1120) / 2 + 24);
  const columnLeft = blocks.length ? pageLeft : Math.max(24, (faceOriginX - columnWidth) / 2);
  column.forEach((el) => { el.style.left = columnLeft + 'px'; });
  headingWrap.style.left = pageLeft + 'px';
  if (contact) contact.style.width = columnWidth + 'px';
}

// Home and About (desktop): the eyebrow stays pinned at the top while the headline and
// everything below it move down together, centered vertically in the space under it.
function centerPageContent() {
  const page = hero.dataset.page;
  if (page !== 'about' && page !== 'home') return;
  const heading = document.querySelector('.heading-wrap');
  const eyebrow = heading && heading.querySelector('.hero-eyebrow');
  if (!heading || !eyebrow) return;
  if (W < MOBILE_BREAKPOINT) {
    heading.style.top = '';
    ['position', 'left', 'top', 'whiteSpace'].forEach((p) => { eyebrow.style[p] = ''; });
    return;
  }
  // What sits under the headline, in order, with the gap before each item.
  const seq = page === 'about'
    ? [[document.getElementById('about'), 32], [document.querySelector('.desktop-contact'), 36]]
    : [[document.getElementById('packages'), 32]];
  const items = seq.filter(([el]) => el);
  if (!items.length) return;
  const EYEBROW_TOP = 48;
  eyebrow.style.position = 'absolute';
  eyebrow.style.left = '0';
  eyebrow.style.whiteSpace = 'nowrap';
  const headH = heading.getBoundingClientRect().height;
  let groupH = headH;
  items.forEach(([el, gap], i) => {
    // the first gap only applies when the headline itself takes up room
    groupH += (i === 0 && headH === 0 ? 0 : gap) + el.getBoundingClientRect().height;
  });
  const floor = EYEBROW_TOP + eyebrow.getBoundingClientRect().height + 24;
  const areaH = Math.max(window.innerHeight, floor + groupH + 24);
  const top = Math.max(floor, floor + (areaH - floor - groupH) / 2);
  heading.style.top = top + 'px';
  eyebrow.style.top = (EYEBROW_TOP - top) + 'px';
  let y = top + headH;
  items.forEach(([el, gap], i) => {
    y += (i === 0 && headH === 0 ? 0 : gap);
    el.style.top = y + 'px';
    y += el.getBoundingClientRect().height;
  });
}

// Desktop's email + social icons block, vertically centered in the empty
// space below #about — computed from the actual measured position of
// #about and the hero's real height, not a fixed CSS px value (which only
// ever matched whatever viewport happened to be open during testing).
function positionDesktopContact() {
  const block = document.querySelector('.desktop-contact');
  const about = document.getElementById('about');
  if (!block || !about) return;
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
// The home sections are positioned by this script after load, so a deep link like
// index.html#work lands before they have moved. Keep re-jumping while layout settles,
// and stop as soon as the visitor scrolls themselves.
let userScrolled = false;
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, () => { userScrolled = true; }, { passive: true, once: true }));
function jumpToHash() {
  if (!IS_HOME || !location.hash || userScrolled) return;
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { resize(); jumpToHash(); });
}
window.addEventListener('load', () => { jumpToHash(); setTimeout(jumpToHash, 300); setTimeout(jumpToHash, 900); });
jumpToHash();

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
  if (REDUCED_MOTION) return;
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

let nextSpawn = 0;
// Each pulse lives 2.8s; one starts roughly every 110ms, so about 25 are alive at
// once. A steady trickle replaces the old bursts, which read as a rhythmic flicker.
const PULSE_LIFE = 2800;
const PULSE_ARM_CELLS = 5;

// The grid and the face never change between frames, so they are rendered once
// into offscreen images and only blitted each frame. Redrawing thousands of
// characters per frame was what made the animation stutter.

function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * DPR));
  c.height = Math.max(1, Math.round(h * DPR));
  const cx = c.getContext('2d');
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.textBaseline = 'top';
  return c;
}

function paintFace(layer, lines) {
  const cx = layer.getContext('2d');
  cx.font = `${FACE_FONT}px 'Courier New', monospace`;
  cx.fillStyle = `rgb(${FACE_COLOR[0]}, ${FACE_COLOR[1]}, ${FACE_COLOR[2]})`;
  for (let row = 0; row < faceRows; row++) {
    const line = lines[row];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === ' ') continue;
      cx.fillText(ch, c * FACE_CELL_W, row * FACE_CELL_H);
    }
  }
}

function buildCaches() {
  bgCache = makeLayer(W, H);
  const bx = bgCache.getContext('2d');
  bx.font = `${BG_FONT_SIZE}px 'Courier New', monospace`;
  for (let row = 0; row < rows; row++) {
    if (!occupied[row]) continue;
    const onH = row % GRID_SPACING === 0;
    for (let col = 0; col < cols; col++) {
      if (occupied[row][col]) continue;
      const onV = col % GRID_SPACING === 0;
      if (!onH && !onV) continue;
      let ch = onH ? '-' : '|';
      if (onH && onV) ch = '+';
      bx.fillStyle = `rgba(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]}, ${onH && onV ? 0.14 : 0.07})`;
      bx.fillText(ch, col * CELL, row * CELL);
    }
  }
  bx.font = `10px 'Courier New', monospace`;
  bx.fillStyle = `rgba(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]}, 0.22)`;
  for (let row = GRID_SPACING; row < rows; row += GRID_SPACING * 3) {
    if (!occupied[row]) continue;
    for (let col = GRID_SPACING; col < cols; col += GRID_SPACING * 4) {
      if (occupied[row][col]) continue;
      const tag = `${String(col * 4).padStart(3, '0')}.${String(row * 4).padStart(3, '0')}`;
      bx.fillText(tag, col * CELL + 4, row * CELL - 12);
    }
  }

  const fw = faceCols * FACE_CELL_W + 4, fh = faceRows * FACE_CELL_H + 4;
  faceOpenCache = makeLayer(fw, fh);
  faceWinkCache = makeLayer(fw, fh);
  paintFace(faceOpenCache, faceLines);
  paintFace(faceWinkCache, winkPatchLines);
}

const smooth = (t) => t * t * (3 - 2 * t);

function drawPulses(tMs) {
  if (REDUCED_MOTION) return;
  if (tMs >= nextSpawn && nodes.length) {
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    pulses.push({ col: n.col, row: n.row, start: tMs });
    nextSpawn = tMs + 70 + Math.random() * 80;
  }
  pulses = pulses.filter(p => tMs - p.start < PULSE_LIFE);

  ctx.font = `${BG_FONT_SIZE}px 'Courier New', monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = `rgb(${BG_COLOR[0]}, ${BG_COLOR[1]}, ${BG_COLOR[2]})`;

  for (const p of pulses) {
    if (!occupied[p.row]) continue;
    const age = (tMs - p.start) / PULSE_LIFE;
    const life = Math.pow(1 - age, 1.6);
    const fadeIn = smooth(Math.min(1, age / 0.14));

    const coreAlpha = fadeIn * life;
    if (coreAlpha > 0.01 && !occupied[p.row][p.col]) {
      ctx.globalAlpha = coreAlpha;
      ctx.fillText('#', p.col * CELL, p.row * CELL);
    }

    const front = age * PULSE_ARM_CELLS;
    const reach = Math.min(PULSE_ARM_CELLS, Math.ceil(front));
    for (let i = 1; i <= reach; i++) {
      const grow = smooth(Math.min(1, front - (i - 1)));
      const a = grow * life * 0.5 * (1 - (i - 1) * 0.12);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      const dirs = [[i, 0], [-i, 0], [0, i], [0, -i]];
      for (const [dc, dr] of dirs) {
        const cc = p.col + dc, rr = p.row + dr;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        if (!occupied[rr] || occupied[rr][cc]) continue;
        ctx.fillText(dc !== 0 ? '-' : '|', cc * CELL, rr * CELL);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawFace() {
  const layer = isWinking ? faceWinkCache : faceOpenCache;
  // Mobile content scrolls over the fixed face; dim it so text stays legible.
  // Inner pages have wide content over the face, so it sits back further there.
  ctx.globalAlpha = !IS_HOME ? 0.35 : (W < MOBILE_BREAKPOINT ? 0.5 : 1);
  ctx.drawImage(layer, faceOriginX, faceOriginY, layer.width / DPR, layer.height / DPR);
  ctx.globalAlpha = 1;
}

function draw(tMs) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bgCache, 0, 0, W, H);
  drawPulses(tMs);
  updateBlink(tMs);
  drawFace();
  drawWinkStar(tMs);
  requestAnimationFrame(draw);
}
