// Shared image lightbox for the gallery pages. Keyboard users can open any
// image with Enter or Space; focus moves into the dialog and returns to the
// image that opened it on close.
(function () {
  const box = document.getElementById('lightbox');
  if (!box) return;
  const boxImg = document.getElementById('lightboxImg');
  const closeBtn = box.querySelector('.g-lightbox-close');
  // Tall images (like brand sheets) open at readable width and scroll, instead of shrinking to fit.
  const scrollTall = box.hasAttribute('data-scroll-tall');
  let opener = null;

  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Enlarged image');

  document.querySelectorAll('.g-piece img').forEach((img) => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Enlarge: ' + img.alt);
  });

  function openBox(img) {
    opener = img;
    boxImg.src = img.src;
    boxImg.alt = img.alt;
    if (scrollTall) box.classList.toggle('tall', img.naturalHeight / img.naturalWidth > 1.45);
    box.scrollTop = 0;
    box.hidden = false;
    closeBtn.focus();
  }
  function closeBox() {
    box.hidden = true;
    boxImg.removeAttribute('src');
    if (opener) opener.focus();
    opener = null;
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.g-piece img');
    if (img) openBox(img);
    else if (!box.hidden && e.target !== boxImg) closeBox();
  });
  document.addEventListener('keydown', (e) => {
    if (box.hidden) {
      const img = e.target.closest && e.target.closest('.g-piece img');
      if (img && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBox(img); }
      return;
    }
    if (e.key === 'Escape') closeBox();
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); } // the close button is the only control
  });
})();
