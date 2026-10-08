// Mobile navigation: on narrow screens the inline links collapse behind a burger button
// that opens a dropdown panel. On desktop nothing changes (the button stays hidden).
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .nav-toggle { display:none; }
    .m-bar { display:none; }
    @media (max-width: 700px) {
      html { scroll-padding-top:64px; }
      /* sticky top bar: logo mark, studio name between, burger */
      .m-bar { display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; right:0; height:56px; z-index:10;
        background:rgba(10,10,10,0.96); border-bottom:1px solid rgba(232,202,160,0.18); }
      .m-bar-title { color:#e8caa0; font-weight:500; font-size:12px; letter-spacing:2px; white-space:nowrap; }
      .site-mark { position:fixed; top:28px; transform:translateY(-50%); z-index:12; }
      .hero-eyebrow, p.eyebrow { display:none; }
      .heading-wrap { padding-top:84px; }
      .wrap { padding-block-start:84px; }

      .nav-toggle {
        display:flex; flex-direction:column; justify-content:center; align-items:center; gap:5px;
        position:fixed; top:8px; right:12px; width:40px; height:40px; padding:0; z-index:90;
        background:transparent; border:0; color:#e8caa0; cursor:pointer;
      }
      .nav-toggle:focus-visible { outline:2px solid #e8caa0; outline-offset:3px; }
      .nav-toggle span { display:block; width:22px; height:2px; background:currentColor; transform-origin:center;
        box-shadow:0 0 6px 2px rgba(10,10,10,0.9);
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
    .wa-fab { display:none; }
    @media (max-width: 700px) {
      .wa-fab {
        display:flex; align-items:center; justify-content:center; position:fixed; right:16px; z-index:80;
        bottom:calc(16px + env(safe-area-inset-bottom)); width:54px; height:54px; border-radius:50%;
        background:#e8caa0; color:#0a0a0a; box-shadow:0 6px 18px rgba(0,0,0,0.55);
        -webkit-tap-highlight-color:transparent; transition:background-color .2s ease, transform .15s ease;
      }
      .wa-fab:active { transform:scale(.94); background:#f2dcb9; }
      .wa-fab:focus-visible { outline:2px solid #e8caa0; outline-offset:3px; }
      .wa-fab svg { width:28px; height:28px; display:block; }
    }
    @media (prefers-reduced-motion: reduce) {
      .nav-toggle span, .byline.top-nav { transition:none !important; }
    }
  `;
  document.head.appendChild(style);

  function init() {
  const nav = document.querySelector('.top-nav');
  if (!nav) return;
  if (!nav.id) nav.id = 'siteNav';

  // Sticky top bar (mobile only, see CSS): carries the studio name that used to sit above the headline
  const tag = document.querySelector('.hero-eyebrow, .eyebrow');
  const bar = document.createElement('div');
  bar.className = 'm-bar';
  bar.innerHTML = '<span class="m-bar-title"></span>';
  bar.firstChild.textContent = tag ? tag.textContent.trim() : 'ROBSON WEB STUDIO';
  document.body.insertBefore(bar, document.body.firstChild);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-label', 'Menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', nav.id);
  btn.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(btn);

  // Floating WhatsApp button: home page only, and mobile only (hidden by CSS on wider screens)
  const isHome = !!document.querySelector('#hero[data-page="home"]');
  if (isHome) {
  const fab = document.createElement('a');
  fab.className = 'wa-fab';
  fab.href = 'https://wa.me/27844114748?text=Hi%20Darren%2C%20I%27d%20like%20a%20website%20quote';
  fab.target = '_blank';
  fab.rel = 'noopener noreferrer';
  fab.setAttribute('aria-label', 'Chat on WhatsApp');
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  document.body.appendChild(fab);
  }

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
  }

  // The stylesheet above is injected immediately (this script runs in <head>) so the nav never
  // flashes unstyled; the markup work waits for the page to be parsed.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
