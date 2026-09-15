(() => {
  const grid = document.querySelector('[data-gallery-grid]');
  const filters = document.querySelector('[data-gallery-filters]');
  const count = document.querySelector('[data-gallery-count]');
  const lightbox = document.querySelector('[data-lightbox]');
  const lightboxImage = document.querySelector('[data-lightbox-image]');
  const lightboxTitle = document.querySelector('[data-lightbox-title]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption]');
  if (!grid || !filters) return;

  const base = '../assets/images/gallery/';
  const imageVersion = 'hq-20260915-1';
  const imageUrl = src => `${base}${src}?v=${imageVersion}`;
  let items = [];
  let active = 'All';

  function card(item) {
    const tags = item.tags.map(tag => `<span>${tag}</span>`).join('');
    return `<button class="gallery-card" type="button" data-gallery-open="${item.src}" aria-label="Open ${item.title}">
      <span class="gallery-image-wrap"><img src="${imageUrl(item.src)}" alt="${item.title}" loading="lazy"></span>
      <span class="gallery-card-copy"><strong>${item.title}</strong><span class="gallery-tags">${tags}</span></span>
    </button>`;
  }

  function render() {
    const visible = active === 'All' ? items : items.filter(item => item.tags.includes(active));
    grid.innerHTML = visible.map(card).join('');
    if (count) count.textContent = `${visible.length} image${visible.length === 1 ? '' : 's'}`;
    filters.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === active));
  }

  function openLightbox(item) {
    if (!lightbox || !item) return;
    lightboxImage.src = imageUrl(item.src);
    lightboxImage.alt = item.title;
    lightboxTitle.textContent = item.title;
    lightboxCaption.textContent = item.caption || '';
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImage.src = '';
    document.body.classList.remove('lightbox-open');
  }

  fetch('../data/gallery.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('Gallery data unavailable'); return r.json(); })
    .then(data => {
      items = Array.isArray(data) ? data : [];
      const tags = [...new Set(items.flatMap(item => item.tags || []))].sort();
      filters.innerHTML = ['All', ...tags].map(tag => `<button type="button" data-filter="${tag}">${tag}</button>`).join('');
      const requested = new URLSearchParams(location.search).get('filter');
      if (requested && (requested === 'All' || tags.includes(requested))) active = requested;
      render();
    })
    .catch(() => {
      grid.innerHTML = '<div class="placeholder"><strong>Gallery unavailable.</strong><p class="muted">The image index could not be loaded.</p></div>';
    });

  filters.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    active = btn.dataset.filter;
    render();
  });

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-gallery-open]');
    if (!btn) return;
    openLightbox(items.find(item => item.src === btn.dataset.galleryOpen));
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-lightbox-close]')) closeLightbox();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
})();
