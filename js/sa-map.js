// ASCII map of South Africa, drawn cell by cell so it renders identically on
// every device. A <pre> is exposed to mobile text auto-sizing and font
// fallback, which changed its width and clipped it; fixed cells cannot.
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

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cw = w / COLS, ch = h / ROWS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = (ch * 0.98) + 'px ' + FONT;
    ctx.fillStyle = MAP_COLOR;
    ctx.shadowColor = 'rgba(10,10,10,0.95)';
    ctx.shadowBlur = Math.max(2, ch * 0.5);
    for (let r = 0; r < ROWS; r++) {
      const line = LINES[r];
      for (let c = 0; c < line.length; c++) {
        const g = line[c];
        if (g !== ' ') ctx.fillText(g, (c + 0.5) * cw, (r + 0.5) * ch);
      }
    }

    ctx.shadowColor = 'rgba(10,10,10,0.95)';
    ctx.shadowBlur = Math.max(3, ch * 0.6);
    ctx.font = '800 ' + (ch * 0.98 * LABEL.scale) + 'px ' + FONT;
    ctx.fillStyle = GOLD;
    const step = cw * LABEL.scale, n = LABEL.text.length;
    for (let i = 0; i < n; i++) {
      const x = (LABEL.centerCol + 0.5 + (i - (n - 1) / 2) * LABEL.scale) * cw;
      ctx.fillText(LABEL.text[i], x, (LABEL.row + 0.5) * ch);
    }

    const dx = (DOT.col + 0.5) * cw, dy = (DOT.row + 0.5) * ch;
    ctx.shadowColor = 'rgba(241,211,160,0.85)';
    ctx.shadowBlur = Math.max(6, ch * 1.4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(dx - cw * 1.1, dy - ch * 0.8, cw * 2.2, ch * 1.6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '800 ' + (ch * 1.5) + 'px ' + FONT;
    ctx.fillText('@', dx, dy + ch * 0.04);
  }

  draw();
  window.addEventListener('resize', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
