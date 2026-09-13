(() => {
  const list = document.querySelector('#reference-list');
  if (!list) return;
  const search = document.querySelector('#reference-search');
  const category = document.querySelector('#reference-category');
  const count = document.querySelector('#reference-count');
  let entries = [];
  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const contexts = e => {
    const cards = [];
    if (e.pve) cards.push(['PvE', e.pve]);
    if (e.pvp) cards.push(['PvP', e.pvp]);
    if (e.operations) cards.push(['Operations', e.operations]);
    if (e.watchFor) cards.push(['Watch for', e.watchFor]);
    if (!cards.length) return '';
    return `<div class="reference-context">${cards.map(([h,v])=>`<div><strong>${esc(h)}</strong><p>${esc(v)}</p></div>`).join('')}</div>`;
  };
  const sourceLink = s => {
    const href = esc(s.url || '#');
    const external = /^https?:\/\//i.test(String(s.url || ''));
    return `<a href="${href}"${external?' target="_blank" rel="noopener"':''}>${esc(s.name)}${external?' ↗':' →'}</a>`;
  };
  function render() {
    const q = search.value.trim().toLowerCase();
    const cat = category.value;
    const shown = entries.filter(e => (cat === 'all' || e.category === cat) && (!q || [e.topic,e.category,e.ruleOfThumb,...(e.keywords||[]),...(e.details||[]),e.operations||'',e.watchFor||''].join(' ').toLowerCase().includes(q)));
    count.textContent = `${shown.length} of ${entries.length} entries`;
    list.innerHTML = shown.map(e => `<article class="reference-entry" id="${esc(e.id)}"><div class="reference-entry-head"><div><span class="reference-category">${esc(e.category)}</span><h2>${esc(e.topic)}</h2></div><span class="reference-stability">${esc(e.stability || 'reviewed')}</span></div><p class="reference-rule">${esc(e.ruleOfThumb)}</p><details><summary>More info</summary><div class="reference-detail">${(e.details||[]).map(x=>`<p>${esc(x)}</p>`).join('')}${(e.commonMistakes||[]).length?`<h3>Common mistakes</h3><ul>${e.commonMistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${contexts(e)}${(e.sources||[]).length?`<h3>Sources & further reading</h3><div class="reference-sources">${e.sources.map(sourceLink).join('')}</div>`:''}<p class="reference-reviewed">Last reviewed: ${esc(e.reviewedAt || 'Unknown')}</p></div></details></article>`).join('') || '<p class="empty-state">No reference entries match that search.</p>';
  }
  fetch('../../data/elite-knowledge.json', {cache:'no-store'}).then(r=>r.json()).then(data => {
    entries = data.entries || [];
    [...new Set(entries.map(e=>e.category))].sort().forEach(c => category.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`));
    const hash = location.hash.slice(1);
    render();
    if (hash) requestAnimationFrame(() => { const el=document.getElementById(hash); if(el){el.scrollIntoView({block:'start'}); const d=el.querySelector('details'); if(d)d.open=true;} });
  }).catch(() => { list.innerHTML='<p class="empty-state">Reference data could not be loaded.</p>'; count.textContent='Unavailable'; });
  search.addEventListener('input', render); category.addEventListener('change', render);
})();
