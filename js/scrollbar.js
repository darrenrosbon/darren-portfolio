// Site scrollbar: the browser's own bar is hidden in CSS (so the page width and the
// face art never depend on it); this draws a slim replacement on the left edge.
// Scrolling itself stays native (wheel, touch, keyboard); the thumb only mirrors it
// and can be dragged, and the track can be clicked to page up or down.
(function () {
  const root = document.documentElement;

  const style = document.createElement('style');
  style.textContent = `
    .site-scroll { position:fixed; left:6px; top:12px; bottom:12px; width:12px; z-index:60; }
    .site-scroll[hidden] { display:none; }
    .site-scroll::before { content:""; position:absolute; left:4px; top:0; bottom:0; width:2px; background:rgba(232,202,160,0.12); }
    .site-scroll-thumb { position:absolute; left:3px; width:4px; border-radius:2px; background:#e8caa0; opacity:.4;
      transition:opacity .15s ease, width .15s ease, left .15s ease; touch-action:none; cursor:grab; }
    .site-scroll:hover .site-scroll-thumb, .site-scroll.dragging .site-scroll-thumb { opacity:.9; width:6px; left:2px; }
    .site-scroll.dragging .site-scroll-thumb { cursor:grabbing; }
    .site-scroll.dragging { user-select:none; }
    @media (prefers-reduced-motion: reduce) { .site-scroll-thumb { transition:none; } }
    /* No custom scrollbar on mobile; touch scrolling needs no indicator. */
    @media (max-width: 700px) { .site-scroll { display:none !important; } }
  `;
  document.head.appendChild(style);

  const track = document.createElement('div');
  track.className = 'site-scroll';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div');
  thumb.className = 'site-scroll-thumb';
  track.appendChild(thumb);
  document.body.appendChild(track);

  let maxScroll = 0, thumbH = 0, maxThumbTop = 0;

  function measure() {
    const doc = root.scrollHeight, vh = window.innerHeight;
    maxScroll = Math.max(0, doc - vh);
    track.hidden = maxScroll <= 1;
    if (track.hidden) return;
    const trackH = track.clientHeight;
    thumbH = Math.max(36, Math.round(trackH * vh / doc));
    maxThumbTop = Math.max(0, trackH - thumbH);
    thumb.style.height = thumbH + 'px';
  }

  function place() {
    if (track.hidden) return;
    const y = window.scrollY || root.scrollTop;
    thumb.style.top = (maxScroll ? (y / maxScroll) * maxThumbTop : 0) + 'px';
  }

  function refresh() { measure(); place(); }

  window.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', refresh);
  window.addEventListener('load', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);
    ro.observe(root);
  }
  // Pages that move blocks around after load can change height without a resize event.
  let lastH = 0;
  setInterval(() => { if (root.scrollHeight !== lastH) { lastH = root.scrollHeight; refresh(); } }, 400);

  // Drag the thumb
  let dragStartY = 0, dragStartScroll = 0;
  thumb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    thumb.setPointerCapture(e.pointerId);
    track.classList.add('dragging');
    dragStartY = e.clientY;
    dragStartScroll = window.scrollY;
  });
  thumb.addEventListener('pointermove', (e) => {
    if (!track.classList.contains('dragging') || !maxThumbTop) return;
    const dy = e.clientY - dragStartY;
    window.scrollTo(0, dragStartScroll + dy * (maxScroll / maxThumbTop));
  });
  function endDrag(e) {
    track.classList.remove('dragging');
    if (thumb.hasPointerCapture && thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
  }
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  // Click the track (not the thumb) to page toward that point
  track.addEventListener('pointerdown', (e) => {
    if (e.target !== track) return;
    const rect = thumb.getBoundingClientRect();
    const dir = e.clientY < rect.top ? -1 : 1;
    window.scrollBy({ top: dir * window.innerHeight * 0.9, behavior: 'smooth' });
  });

  refresh();
})();
