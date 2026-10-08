// Mobile navigation: on narrow screens the inline links collapse behind a burger button
// that opens a dropdown panel. On desktop nothing changes (the button stays hidden).
(function () {
  const nav = document.querySelector('.top-nav');
  if (!nav) return;
  if (!nav.id) nav.id = 'siteNav';

  const style = document.createElement('style');
  style.textContent = `
    .nav-toggle { display:none; }
    @media (max-width: 700px) {
      .nav-toggle {
        display:flex; flex-direction:column; justify-content:center; align-items:center; gap:5px;
        position:fixed; top:14px; right:12px; width:40px; height:40px; padding:0; z-index:90;
        background:rgba(10,10,10,0.88); border:1px solid rgba(232,202,160,0.6); color:#e8caa0; cursor:pointer;
        transition:background-color .2s ease, border-color .2s ease;
      }
      .nav-toggle:hover, .nav-toggle[aria-expanded="true"] { background:#1b1813; border-color:#e8caa0; }
      .nav-toggle:focus-visible { outline:2px solid #e8caa0; outline-offset:3px; }
      .nav-toggle span { display:block; width:18px; height:2px; background:currentColor; transform-origin:center;
        transition:transform .25s cubic-bezier(.4,0,.2,1), opacity .15s ease; }
      .nav-toggle[aria-expanded="true"] span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
      .nav-toggle[aria-expanded="true"] span:nth-child(2) { opacity:0; }
      .nav-toggle[aria-expanded="true"] span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }

      .byline.top-nav {
        position:fixed; top:64px; left:16px; right:16px; z-index:85; transform:translateY(-8px);
        display:flex; flex-direction:column; align-items:stretch; gap:0; padding:6px;
        background:rgba(10,10,10,0.97); border:1px solid #e8caa0; box-shadow:0 14px 30px rgba(0,0,0,0.6);
        text-align:left; font-size:15px;
        opacity:0; visibility:hidden;
        transition:opacity .2s ease, transform .2s ease, visibility 0s linear .2s;
      }
      .byline.top-nav.open { opacity:1; visibility:visible; transform:none; transition:opacity .2s ease, transform .2s ease, visibility 0s; }
      .byline.top-nav a { padding:14px 12px; font-size:15px; opacity:1; border-bottom:1px solid rgba(232,202,160,0.15); }
      .byline.top-nav a[aria-current="page"] { text-decoration:none; background:rgba(232,202,160,0.1); }
      .byline.top-nav a:hover { text-decoration:none; background:rgba(232,202,160,0.08); }
      .byline.top-nav a:last-child { border-bottom:0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .nav-toggle span, .byline.top-nav { transition:none !important; }
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-label', 'Menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', nav.id);
  btn.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(btn);

  const mq = window.matchMedia('(max-width: 700px)');

  function setOpen(open, refocus) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    if (!open && refocus) btn.focus();
  }

  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false, true);
  });
  const onChange = () => { if (!mq.matches) setOpen(false); };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
})();
