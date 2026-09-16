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
    ['Colonization', document.querySelector('[data-colonization-pathway]')],
    ['Squadron Coordination', document.querySelector('[data-squadron-coordination-pathway]')],
  ]);

  function fullRouteExists(label) {
    return Boolean(fullPathwayRoots.get(label));
  }

  function removeDuplicateGenericSections() {
    preview.querySelectorAll('.pathway-generic-section[data-pathway-label]').forEach(section => {
      if (fullRouteExists(section.dataset.pathwayLabel || '')) section.remove();
    });
  }

  function normalizePreviewCards() {
    preview.querySelectorAll('.pathway-recommendation').forEach(card => {
      const heading = card.querySelector('h3');
      const label = heading?.textContent?.trim();
      if (!label) return;

      // Full Pathways own their activity presentation. Never leave the old
      // generic recommendation card behind while the provider is loading.
      if (fullRouteExists(label)) {
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
  normalizePreviewCards();
})();
