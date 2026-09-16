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

  function removeGenericFullPathwayCards() {
    preview.querySelectorAll('.pathway-recommendation').forEach(card => {
      const label = card.querySelector('h3')?.textContent?.trim();
      if (fullPathwayLabels.has(label)) card.remove();
    });
  }

  new MutationObserver(removeGenericFullPathwayCards).observe(preview, { childList:true, subtree:true });
  removeGenericFullPathwayCards();
})();
