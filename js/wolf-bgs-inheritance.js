(() => {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function wolfBgsInheritanceFetch(input, init = undefined) {
    const request = input instanceof Request ? input : null;
    const method = String(init?.method || request?.method || 'GET').toUpperCase();
    let url;
    try { url = new URL(request?.url || input, window.location.href); }
    catch { return nativeFetch(input, init); }

    if (method !== 'PUT' || url.pathname !== '/api/operations/wolf-bgs') {
      return nativeFetch(input, init);
    }

    const writeInit = init ? { ...init } : {};
    const writeResponse = await nativeFetch('/api/operations/wolf-bgs-write', writeInit);
    if (!writeResponse.ok) return writeResponse;

    return nativeFetch(`/api/operations/wolf-bgs?_=${Date.now()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  };
})();

(() => {
  const list = document.querySelector('[data-system-list]');
  if (!list) return;

  const parkedBodies = new WeakMap();
  let lastGuardMs = 0;
  let mountPingQueued = false;
  let healthSection = null;

  const cards = () => [...list.children].filter(el => el.matches?.('details.wolf-system-card'));
  const directBody = card => [...card.children].find(el => el.classList?.contains('wolf-system-body')) || null;

  function requestMountPing() {
    if (mountPingQueued) return;
    mountPingQueued = true;
    Promise.resolve().then(() => {
      mountPingQueued = false;
      if (!list.isConnected) return;
      const ping = document.createComment('wolf-bgs-lazy-mount');
      list.appendChild(ping);
      ping.remove();
    });
  }

  function restoreCard(card) {
    const record = parkedBodies.get(card);
    if (!record) {
      if (directBody(card)) card.dataset.healthHydrated = 'true';
      return false;
    }

    if (record.marker.parentNode === card) record.marker.replaceWith(record.body);
    else card.appendChild(record.body);
    parkedBodies.delete(card);
    delete card.dataset.healthParked;
    card.dataset.healthHydrated = 'true';

    // A cold card can be marked enhanced by a module before its body is restored.
    // Clear only the completion flag so the first open can build the advanced stack.
    if (!record.hydrated) delete card.dataset.rulesEnhanced;
    requestMountPing();
    return true;
  }

  function parkColdCard(card) {
    // Once a card has been opened, it remains mounted for the rest of the page
    // session. This preserves the fast first load without making controls vanish
    // and rebuild during an active workflow.
    if (card.dataset.healthHydrated === 'true') return;
    if (card.open) {
      restoreCard(card);
      return;
    }
    if (parkedBodies.has(card)) return;

    const body = directBody(card);
    if (!body) return;
    const hydrated = Boolean(body.querySelector('[data-faction-strategy-section],[data-slider-objectives-section],[data-conflict-section],[data-order-preview-section]'));
    const marker = document.createComment('wolf-bgs-body-deferred');
    body.replaceWith(marker);
    parkedBodies.set(card, { body, marker, hydrated });
    card.dataset.healthParked = 'true';
  }

  function wireCard(card) {
    if (card.dataset.healthToggleWired === 'true') return;
    card.dataset.healthToggleWired = 'true';
    card.addEventListener('toggle', () => {
      const started = performance.now();
      if (card.open) restoreCard(card);
      else if (card.dataset.healthHydrated !== 'true') parkColdCard(card);
      lastGuardMs = performance.now() - started;
      window.setTimeout(updateHealth, 60);
      window.setTimeout(updateHealth, 300);
    });
  }

  function syncCards() {
    const started = performance.now();
    for (const card of cards()) {
      wireCard(card);
      if (card.open) restoreCard(card);
      else if (card.dataset.healthHydrated !== 'true') parkColdCard(card);
    }
    lastGuardMs = performance.now() - started;
    updateHealth();
  }

  function mountHealthPanel() {
    if (healthSection?.isConnected) return healthSection;
    healthSection = document.querySelector('[data-wolf-health-section]');
    if (healthSection) return healthSection;

    const summary = document.querySelector('.wolf-summary-section');
    if (!summary) return null;

    const section = document.createElement('section');
    section.className = 'section-sm wolf-health-section';
    section.dataset.wolfHealthSection = '';
    section.innerHTML = `<div class="container"><details class="wolf-panel wolf-health-panel" data-wolf-health-panel><summary><span><b>Control Room Health</b><small>iPad / DOM diagnostics and lazy-card performance status</small></span><strong>+</strong></summary><div class="wolf-panel-body"><p class="wolf-section-intro">Collapsed systems start deferred for a fast page load. After you open a system once, its full controls stay mounted for the rest of the page session so sections never disappear and rebuild while you work.</p><div class="wolf-summary-grid"><article><span>Status</span><strong data-health-status>Checking…</strong><small>Lazy-card guard</small></article><article><span>Cards on page</span><strong data-health-cards>—</strong><small>Current paginated view</small></article><article><span>Expanded</span><strong data-health-open>—</strong><small>Currently open</small></article><article><span>Deferred</span><strong data-health-parked>—</strong><small>Never opened this session</small></article><article><span>Advanced previews</span><strong data-health-previews>—</strong><small>Mounted Order Previews</small></article><article><span>DOM elements</span><strong data-health-dom>—</strong><small>Current document</small></article></div><div class="wolf-save-row"><span data-health-note>Sampling Control Room…</span><button type="button" class="btn btn-secondary btn-compact" data-refresh-health>Refresh Health Check</button></div></div></details></div>`;
    summary.insertAdjacentElement('afterend', section);
    section.querySelector('[data-refresh-health]')?.addEventListener('click', updateHealth);
    section.querySelector('[data-wolf-health-panel]')?.addEventListener('toggle', updateHealth);
    return section;
  }

  function updateHealth() {
    const section = mountHealthPanel();
    if (!section) return;
    const liveCards = cards();
    const open = liveCards.filter(card => card.open).length;
    const deferred = liveCards.filter(card => card.dataset.healthParked === 'true').length;
    const warmed = liveCards.filter(card => card.dataset.healthHydrated === 'true').length;
    const previews = liveCards.reduce((count, card) => count + (card.querySelector('[data-order-preview-section]') ? 1 : 0), 0);
    const domElements = document.getElementsByTagName('*').length;

    let status = 'Healthy';
    let note = `${deferred} cold card${deferred===1?' is':'s are'} deferred; ${warmed} opened card${warmed===1?' is':'s are'} kept mounted for stable workflow.`;
    if (!liveCards.length) {
      status = 'Waiting';
      note = 'Waiting for the current system page to render.';
    } else if (liveCards.some(card => card.open && !directBody(card))) {
      status = 'Mounting';
      note = 'An expanded card is still restoring its controls. Refresh this check after it finishes.';
    }

    const set = (selector, value) => { const el = section.querySelector(selector); if (el) el.textContent = value; };
    set('[data-health-status]', status);
    set('[data-health-cards]', String(liveCards.length));
    set('[data-health-open]', String(open));
    set('[data-health-parked]', String(deferred));
    set('[data-health-previews]', String(previews));
    set('[data-health-dom]', domElements.toLocaleString());
    set('[data-health-note]', `${note} Last defer/first-mount pass: ${lastGuardMs.toFixed(1)} ms.`);
  }

  const observer = new MutationObserver(() => syncCards());
  observer.observe(list, { childList:true, subtree:false });
  syncCards();
  window.setTimeout(syncCards, 120);
  window.setTimeout(updateHealth, 500);

  window.WolfBgsHealth = {
    refresh: updateHealth,
    sync: syncCards,
    version: 2,
  };
})();
