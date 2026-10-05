// ASCII map of South Africa, drawn cell by cell so it renders identically on
// every device. A <pre> is exposed to mobile text auto-sizing and font
// fallback, which changed its width and clipped it; fixed cells cannot.
// The map and label are drawn once into an offscreen buffer; only the
// Johannesburg highlight is redrawn each frame, so its backlight can pulse.
(function () {
  const canvas = document.getElementById('saMap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const LINES = ["                                               #%%#           ", "                                           #%%%%%%%%%%#       ", "                                          #%%%%%++%%%%%#      ", "                                        #%%%%++++++++%%#      ", "                                       #%%%+++:::::++%%%#     ", "                                     #%%%%+++::::::+++%%#     ", "                                    #%%%+++::::::::+++%%#     ", "              #%#                  #%%%+++::::.::::+++%%%#    ", "              #%%%%%%%%%#         #%%%++:::::.::::++%%%%%#    ", "              #%%%%%%%                   :   ::::++%%%# ##    ", "              #%%+++++                        ::+++%%#    #   ", "              #%%+++::                   :   :::+++%%#    ##  ", "              #%%+++::::::::::::::::::::::::::::+++%%#   #%%# ", "              #%%+++::::::::::::::::::::+++++++::++%%%%%%%%#  ", "              #%%+++:::..........:::::++++%%%++++++++%%%%%#   ", "              #%%+++:::.........::::++++%%%%%%%%+++++++%%%#   ", " ##    #%%%%%%%%%++::::........::::+++%%%%# #%%%%%++++%%%#    ", "  #%%%%%%%%%%%%+++::::........::::++%%%%#      #%%%+%%%%#     ", "   #%%%%+++++++++::::.........:::+++%%#         #%%%%%#       ", "    #%%+++::::::::::..........::::++%%%#       #%%%%%#        ", "    #%%+++:::::::..............::::++%%%#    #%%%%%%#         ", "    #%%%++::::..................::::++%%%%%%%%%%%%#           ", "     #%%+++:::...................::::+++%%%%%%%%%#            ", "     #%%%++::::...................::::++++++%%%#              ", "      #%%+++:::................:::::::++++%%%%#               ", "      #%%%++:::::::::::::::::::::::+++++%%%%#                 ", "       #%%+++::::::::::::::::::++++++%%%%%%#                  ", "       #%%+++:::+++++++++++++++++%%%%%%%#                     ", "       #%%%+++++++%%%%%%%%%%%%%%%%%%%#                        ", "        #%%%%%%%%%%%%%%%%%%%%%%%%#                            ", "         #%%%%%%%%#                                           ", "             #                                                "];
  const COLS = 62, ROWS = LINES.length;
  const DOT = { col: 43, row: 10 };
  const LABEL = { text: 'JOHANNESBURG', centerCol: 30.500000, row: 10, scale: 1.5 };
  const MAP_COLOR = '#b8b8b8';
  const GOLD = '#f1d3a0';
  const FONT = "'JetBrains Mono', 'Courier New', monospace";

  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d');
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let W = 0, H = 0, DPR = 1, running = false, visible = true;

  function drawStatic() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    DPR = window.devicePixelRatio || 1;
    W = w; H = h;
    canvas.width = buf.width = Math.round(w * DPR);
    canvas.height = buf.height = Math.round(h * DPR);
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bctx.clearRect(0, 0, w, h);

    const cw = w / COLS, ch = h / ROWS;
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';

    bctx.font = (ch * 0.98) + 'px ' + FONT;
    bctx.fillStyle = MAP_COLOR;
    bctx.shadowColor = 'rgba(10,10,10,0.95)';
    bctx.shadowBlur = Math.max(2, ch * 0.5);
    for (let r = 0; r < ROWS; r++) {
      const line = LINES[r];
      for (let c = 0; c < line.length; c++) {
        const g = line[c];
        if (g !== ' ') bctx.fillText(g, (c + 0.5) * cw, (r + 0.5) * ch);
      }
    }

    bctx.shadowBlur = Math.max(3, ch * 0.6);
    bctx.font = '800 ' + (ch * 0.98 * LABEL.scale) + 'px ' + FONT;
    bctx.fillStyle = GOLD;
    const n = LABEL.text.length;
    for (let i = 0; i < n; i++) {
      const x = (LABEL.centerCol + 0.5 + (i - (n - 1) / 2) * LABEL.scale) * cw;
      bctx.fillText(LABEL.text[i], x, (LABEL.row + 0.5) * ch);
    }
    return true;
  }

  function paint(t) {
    if (!W) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const cw = W / COLS, ch = H / ROWS;
    const dx = (DOT.col + 0.5) * cw, dy = (DOT.row + 0.5) * ch;
    // p breathes 0..1 over about four seconds; reduced motion holds it mid-way
    const p = reduced ? 0.5 : (Math.sin(t / 650) + 1) / 2;

    // backlight sits behind the map characters
    const R = ch * (2.4 + 2.4 * p);
    const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, R);
    grad.addColorStop(0, 'rgba(241,211,160,' + (0.28 + 0.3 * p).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(241,211,160,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(dx - R, dy - R, R * 2, R * 2);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buf, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.shadowColor = 'rgba(241,211,160,' + (0.55 + 0.4 * p).toFixed(3) + ')';
    ctx.shadowBlur = ch * (0.9 + 1.5 * p);
    ctx.fillStyle = GOLD;
    ctx.fillRect(dx - cw * 1.1, dy - ch * 0.8, cw * 2.2, ch * 1.6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0a0a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + (ch * 1.5) + 'px ' + FONT;
    ctx.fillText('@', dx, dy + ch * 0.04);
  }

  function loop(t) {
    if (!running) return;
    paint(t);
    requestAnimationFrame(loop);
  }
  function start() {
    if (reduced || running || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  function redraw() {
    if (drawStatic()) paint(performance.now());
  }

  redraw();
  start();
  window.addEventListener('resize', redraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(canvas);
  }
})();
