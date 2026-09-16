(() => {
  const list = document.querySelector('[data-resource-list]');
  const search = document.querySelector('[data-resource-search]');
  const activity = document.querySelector('[data-resource-activity]');
  const type = document.querySelector('[data-resource-type]');
  const count = document.querySelector('[data-resource-count]');
  if (!list || !search || !activity || !type || !count) return;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let resources = [];

  function matches(resource) {
    const q = search.value.trim().toLowerCase();
    const selectedActivity = activity.value;
    const selectedType = type.value;
    const haystack = [
      resource.name,
      resource.shortName,
      resource.type,
      resource.summary,
      resource.mongrelUse,
      ...(resource.activities || []),
      ...(resource.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return (!q || haystack.includes(q))
      && (selectedActivity === 'all' || (resource.activities || []).includes(selectedActivity))
      && (selectedType === 'all' || resource.type === selectedType);
  }

  function card(resource) {
    const activities = (resource.activities || []).map(item => `<span>${esc(item)}</span>`).join('');
    const label = resource.shortName ? `${resource.name} (${resource.shortName})` : resource.name;
    return `<article class="resource-card resource-tool-card">
      <span class="eyebrow">${esc(resource.type || 'Resource')}</span>
      <h2>${esc(label)}</h2>
      <p>${esc(resource.summary || '')}</p>
      <div class="resource-mongrel-use"><strong>Mongrel use</strong><p>${esc(resource.mongrelUse || '')}</p></div>
      ${activities ? `<div class="resource-tags" aria-label="Activities">${activities}</div>` : ''}
      <a class="text-link" href="${esc(resource.url)}" target="_blank" rel="noopener">Open ${esc(resource.shortName || resource.name)} ↗</a>
    </article>`;
  }

  function render() {
    const shown = resources.filter(matches);
    count.textContent = `${shown.length} of ${resources.length} resources`;
    list.innerHTML = shown.map(card).join('') || '<p class="empty-state">No resources match those filters.</p>';
  }

  function addOptions() {
    const activities = [...new Set(resources.flatMap(resource => resource.activities || []))].sort((a, b) => a.localeCompare(b));
    const types = [...new Set(resources.map(resource => resource.type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    activities.forEach(item => activity.insertAdjacentHTML('beforeend', `<option value="${esc(item)}">${esc(item)}</option>`));
    types.forEach(item => type.insertAdjacentHTML('beforeend', `<option value="${esc(item)}">${esc(item)}</option>`));
  }

  async function load() {
    const response = await fetch('../../data/resources.json', { cache:'no-store' });
    if (!response.ok) throw new Error('Unable to load resource toolbox');
    const data = await response.json();
    resources = Array.isArray(data.resources) ? data.resources.filter(resource => resource?.id && resource?.name && resource?.url) : [];
    addOptions();
    render();
  }

  search.addEventListener('input', render);
  activity.addEventListener('change', render);
  type.addEventListener('change', render);
  load().catch(error => {
    console.error(error);
    count.textContent = 'Unavailable';
    list.innerHTML = '<p class="empty-state">The resource toolbox could not be loaded.</p>';
  });
})();
