(() => {
  const preview = document.querySelector('[data-pathway-preview]');
  if (!preview) return;

  const fullPathwayLabels = new Set([
    'Background Simulation',
    'Mining',
    'Trade & Hauling',
    'Carrier Logistics',
    'Engineering & Shipbuilding',
  ]);

  function normalizePreviewCards() {
    preview.querySelectorAll('.pathway-recommendation').forEach(card => {
      const heading = card.querySelector('h3');
      const label = heading?.textContent?.trim();
      if (!label) return;

      if (fullPathwayLabels.has(label)) {
        card.remove();
        return;
      }

      const top = card.querySelector('.pathway-recommendation-top');
      const badges = top?.querySelector('.pathway-recommendation-badges');
      const details = document.createElement('details');
      details.className = `pathway-activity-section pathway-generic-section${card.classList.contains('is-priority') ? ' is-priority' : ''}`;

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
  }

  new MutationObserver(normalizePreviewCards).observe(preview, { childList:true, subtree:true });
  normalizePreviewCards();
})();
