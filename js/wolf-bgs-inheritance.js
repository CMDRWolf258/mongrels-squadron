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

  const favoritesFirst = document.querySelector('[data-favorites-first]');
  if (favoritesFirst) favoritesFirst.checked = true;

  const MAX_WARM_CARDS = 2;
  const parkedBodies = new WeakMap();
  let warmLru = [];
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

  function pruneWarmLru() {
    warmLru = warmLru.filter(card => card.isConnected && card.parentNode === list && card.dataset.healthHydrated === 'true' && Boolean(directBody(card)));
  }

  function touchWarm(card) {
    pruneWarmLru();
    warmLru = warmLru.filter(item => item !== card);
    warmLru.push(card);
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
    delete card.dataset.healthEvicted;
    card.dataset.healthHydrated = 'true';

    // A never-opened cold card can be marked enhanced by a module before its
    // body is restored. Only that cold first-open case needs a fresh enhancement
    // pass. Re-opened LRU cards already contain their complete generated controls.
    if (!record.hydrated) delete card.dataset.rulesEnhanced;
    requestMountPing();
    return true;
  }

  function parkCard(card, { evicted = false } = {}) {
    if (parkedBodies.has(card)) {
      if (evicted) card.dataset.healthEvicted = 'true';
      return;
    }

    const body = directBody(card);
    if (!body) return;
    const hydrated = card.dataset.healthHydrated === 'true' || Boolean(body.querySelector('[data-faction-strategy-section],[data-slider-objectives-section],[data-conflict-section],[data-order-preview-section]'));
    const marker = document.createComment(evicted ? 'wolf-bgs-body-lru-evicted' : 'wolf-bgs-body-deferred');
    body.replaceWith(marker);
    parkedBodies.set(card, { body, marker, hydrated });
    card.dataset.healthParked = 'true';
    if (evicted) card.dataset.healthEvicted = 'true';
    warmLru = warmLru.filter(item => item !== card);
  }

  function parkColdCard(card) {
    if (card.dataset.healthHydrated === 'true') return;
    if (card.open) return;
    parkCard(card);
  }

  function evictWarmCard(card) {
    if (!card || !directBody(card)) return;
    if (card.open) card.open = false;
    parkCard(card, { evicted:true });
  }

  function enforceWarmLimit(activeCard) {
    pruneWarmLru();
    while (warmLru.length > MAX_WARM_CARDS) {
      const victimIndex = warmLru.findIndex(card => card !== activeCard);
      if (victimIndex < 0) break;
      const [victim] = warmLru.splice(victimIndex, 1);
      evictWarmCard(victim);
    }
  }

  function activateCard(card) {
    restoreCard(card);
    touchWarm(card);
    enforceWarmLimit(card);
  }

  function wireCard(card) {
    if (card.dataset.healthToggleWired === 'true') return;
    card.dataset.healthToggleWired = 'true';
    card.addEventListener('toggle', () => {
      const started = performance.now();
      if (card.open) activateCard(card);
      else if (card.dataset.healthHydrated !== 'true') parkColdCard(card);
      // Warm cards deliberately remain attached when manually collapsed. They
      // leave the active DOM only when a third system is opened and the LRU
      // cache explicitly evicts the least-recently-used card.
      lastGuardMs = performance.now() - started;
      window.setTimeout(updateHealth, 60);
      window.setTimeout(updateHealth, 300);
    });
  }

  function syncCards() {
    const started = performance.now();
    pruneWarmLru();
    for (const card of cards()) {
      wireCard(card);
      if (card.open) activateCard(card);
      else if (card.dataset.healthHydrated !== 'true' && !parkedBodies.has(card)) parkColdCard(card);
    }
    enforceWarmLimit(null);
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
    section.innerHTML = `<div class="container"><details class="wolf-panel wolf-health-panel" data-wolf-health-panel><summary><span><b>Control Room Health</b><small>iPad / DOM diagnostics and two-card warm cache</small></span><strong>+</strong></summary><div class="wolf-panel-body"><p class="wolf-section-intro">Live systems start deferred for a fast page load. The two most recently used systems stay fully mounted for instant reuse. Opening a third system automatically collapses and parks the least-recently-used warm card; its generated controls and unsaved form values remain cached off-DOM for a quick reopen.</p><div class="wolf-summary-grid"><article><span>Status</span><strong data-health-status>Checking…</strong><small>Lazy-card guard</small></article><article><span>Cards on page</span><strong data-health-cards>—</strong><small>Current paginated view</small></article><article><span>Expanded</span><strong data-health-open>—</strong><small>Currently open</small></article><article><span>Warm cache</span><strong data-health-warm>—</strong><small>Maximum ${MAX_WARM_CARDS} mounted</small></article><article><span>Deferred</span><strong data-health-parked>—</strong><small>Cold / LRU parked off-DOM</small></article><article><span>Advanced previews</span><strong data-health-previews>—</strong><small>Mounted Order Previews</small></article><article><span>DOM elements</span><strong data-health-dom>—</strong><small>Current document</small></article></div><div class="wolf-save-row"><span data-health-note>Sampling Control Room…</span><button type="button" class="btn btn-secondary btn-compact" data-refresh-health>Refresh Health Check</button></div></div></details></div>`;
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
    const warm = liveCards.filter(card => card.dataset.healthHydrated === 'true' && Boolean(directBody(card))).length;
    const previews = liveCards.reduce((count, card) => count + (card.querySelector('[data-order-preview-section]') ? 1 : 0), 0);
    const domElements = document.getElementsByTagName('*').length;

    let status = 'Healthy';
    let note = `${warm}/${MAX_WARM_CARDS} warm cache slot${MAX_WARM_CARDS===1?'':'s'} in use; ${deferred} card${deferred===1?' is':'s are'} parked off-DOM.`;
    if (!liveCards.length) {
      status = 'Waiting';
      note = 'Waiting for the current system page to render.';
    } else if (liveCards.some(card => card.open && !directBody(card))) {
      status = 'Mounting';
      note = 'An expanded card is still restoring its controls. Refresh this check after it finishes.';
    } else if (warm > MAX_WARM_CARDS) {
      status = 'Heavy';
      note = `${warm} warm cards are mounted, above the ${MAX_WARM_CARDS}-card cache target.`;
    }

    const set = (selector, value) => { const el = section.querySelector(selector); if (el) el.textContent = value; };
    set('[data-health-status]', status);
    set('[data-health-cards]', String(liveCards.length));
    set('[data-health-open]', String(open));
    set('[data-health-warm]', `${warm} / ${MAX_WARM_CARDS}`);
    set('[data-health-parked]', String(deferred));
    set('[data-health-previews]', String(previews));
    set('[data-health-dom]', domElements.toLocaleString());
    set('[data-health-note]', `${note} Last defer/cache pass: ${lastGuardMs.toFixed(1)} ms.`);
  }

  const observer = new MutationObserver(() => syncCards());
  observer.observe(list, { childList:true, subtree:false });
  syncCards();
  window.setTimeout(syncCards, 120);
  window.setTimeout(updateHealth, 500);

  window.WolfBgsHealth = {
    refresh: updateHealth,
    sync: syncCards,
    warmLimit: MAX_WARM_CARDS,
    version: 3,
  };
})();
