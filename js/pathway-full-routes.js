(() => {
  const preview = document.querySelector('[data-pathway-preview]');
  if (!preview) return;

  const fullPathwayRoots = new Map([
    ['PvE Combat', document.querySelector('[data-pve-pathway]')],
    ['PvP', document.querySelector('[data-pvp-pathway]')],
    ['Operations', document.querySelector('[data-operations-pathway]')],
    ['Background Simulation', document.querySelector('[data-bgs-pathway]')],
    ['Mining', document.querySelector('[data-mining-pathway]')],
    ['Trade & Hauling', document.querySelector('[data-trade-pathway]')],
    ['Carrier Logistics', document.querySelector('[data-carrier-logistics-pathway]')],
    ['Engineering & Shipbuilding', document.querySelector('[data-engineering-pathway]')],
    ['Exploration', document.querySelector('[data-exploration-pathway]')],
    ['Exobiology', document.querySelector('[data-exobiology-pathway]')],
  ]);

  function fullRouteIsVisible(label) {
    const root = fullPathwayRoots.get(label);
    return Boolean(root && !root.hidden);
  }

  function removeDuplicateGenericSections() {
    preview.querySelectorAll('.pathway-generic-section[data-pathway-label]').forEach(section => {
      if (fullRouteIsVisible(section.dataset.pathwayLabel || '')) section.remove();
    });
  }

  function normalizePreviewCards() {
    preview.querySelectorAll('.pathway-recommendation').forEach(card => {
      const heading = card.querySelector('h3');
      const label = heading?.textContent?.trim();
      if (!label) return;

      if (fullRouteIsVisible(label)) {
        card.remove();
        return;
      }

      const top = card.querySelector('.pathway-recommendation-top');
      const badges = top?.querySelector('.pathway-recommendation-badges');
      const details = document.createElement('details');
      details.className = `pathway-activity-section pathway-generic-section${card.classList.contains('is-priority') ? ' is-priority' : ''}`;
      details.dataset.pathwayLabel = label;

      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.className = 'pathway-activity-title';
      const kicker = document.createElement('small');
      kicker.textContent = 'Pathway';
      const name = document.createElement('strong');
      name.textContent = label;
      title.append(kicker, name);
      summary.appendChild(title);

      if (badges?.children?.length) {
        const meta = document.createElement('span');
        meta.className = 'pathway-activity-summary-badges';
        [...badges.children].forEach(badge => meta.appendChild(badge.cloneNode(true)));
        summary.appendChild(meta);
      }

      const body = document.createElement('div');
      body.className = 'pathway-activity-body pathway-generic-body';
      [...card.children].forEach(child => {
        if (child !== top) body.appendChild(child);
      });

      details.append(summary, body);
      card.replaceWith(details);
    });

    removeDuplicateGenericSections();
  }

  new MutationObserver(normalizePreviewCards).observe(preview, { childList:true, subtree:true });
  fullPathwayRoots.forEach(root => {
    if (!root) return;
    new MutationObserver(removeDuplicateGenericSections).observe(root, { attributes:true, attributeFilter:['hidden'] });
  });

  normalizePreviewCards();
})();
