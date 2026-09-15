(() => {
  const list = document.querySelector('#reference-list');
  if (!list) return;
  const search = document.querySelector('#reference-search');
  const category = document.querySelector('#reference-category');
  const count = document.querySelector('#reference-count');
  const DATA_SOURCES = [
    '../../data/elite-knowledge.json',
    '../../data/elite-knowledge-engineering-materials.json',
    '../../data/elite-knowledge-guardian-tech.json',
    '../../data/elite-knowledge-human-tech.json',
    '../../data/elite-knowledge-ranks-permits.json',
    '../../data/elite-knowledge-navigation-travel.json',
    '../../data/elite-knowledge-salvage-piracy.json',
    '../../data/elite-knowledge-multiplayer.json',
    '../../data/elite-knowledge-hangar-compatibility.json',
    '../../data/elite-knowledge-merc-modules.json',
    '../../data/elite-knowledge-field-support.json',
    '../../data/elite-knowledge-crime-missions.json',
    '../../data/elite-knowledge-odyssey.json',
    '../../data/elite-knowledge-exploration.json',
    '../../data/elite-knowledge-ax.json',
    '../../data/elite-knowledge-combat.json',
    '../../data/elite-knowledge-carriers-trade.json',
    '../../data/elite-knowledge-colonization.json',
    '../../data/elite-knowledge-powerplay.json',
  ];
  let entries = [];
  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const quickFacts = e => {
    if (!Array.isArray(e.quickFacts) || !e.quickFacts.length) return '';
    return `<div class="reference-quickfacts">${e.quickFacts.map(x=>`<div><span>${esc(x.label)}</span><strong>${esc(x.value)}</strong></div>`).join('')}</div>`;
  };
  const examples = e => {
    if (!Array.isArray(e.examples) || !e.examples.length) return '';
    return `<h3>Worked examples</h3><div class="reference-examples">${e.examples.map(x=>`<div><strong>${esc(x.title)}</strong><p>${esc(x.body)}</p></div>`).join('')}</div>`;
  };
  const tables = e => {
    if (!Array.isArray(e.tables) || !e.tables.length) return '';
    return e.tables.map(t=>`<div class="reference-table-block"><h3>${esc(t.title||'Quick reference')}</h3><div class="guide-table-wrap"><table class="guide-table"><thead><tr>${(t.columns||[]).map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(t.rows||[]).map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('');
  };
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
    list.innerHTML = shown.map(e => `<article class="reference-entry" id="${esc(e.id)}"><div class="reference-entry-head"><div><span class="reference-category">${esc(e.category)}</span><h2>${esc(e.topic)}</h2></div><span class="reference-stability">${esc(e.stability || 'reviewed')}</span></div><p class="reference-rule">${esc(e.ruleOfThumb)}</p>${quickFacts(e)}<details><summary>More info</summary><div class="reference-detail">${(e.details||[]).map(x=>`<p>${esc(x)}</p>`).join('')}${tables(e)}${examples(e)}${(e.commonMistakes||[]).length?`<h3>Common mistakes</h3><ul>${e.commonMistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${contexts(e)}${(e.sources||[]).length?`<h3>Sources & further reading</h3><div class="reference-sources">${e.sources.map(sourceLink).join('')}</div>`:''}<p class="reference-reviewed">Last reviewed: ${esc(e.reviewedAt || 'Unknown')}</p></div></details></article>`).join('') || '<p class="empty-state">No reference entries match that search.</p>';
  }
  async function loadReferenceData() {
    const results = await Promise.allSettled(DATA_SOURCES.map(async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Unable to load ${url}`);
      return response.json();
    }));
    const loaded = results.filter(x => x.status === 'fulfilled').map(x => x.value);
    if (!loaded.length) throw new Error('No reference sources loaded');
    const seen = new Set();
    entries = loaded.flatMap(data => Array.isArray(data.entries) ? data.entries : []).filter(entry => {
      if (!entry || !entry.id || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
    [...new Set(entries.map(e=>e.category).filter(Boolean))].sort().forEach(c => category.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`));
    const hash = location.hash.slice(1);
    render();
    if (hash) requestAnimationFrame(() => { const el=document.getElementById(hash); if(el){el.scrollIntoView({block:'start'}); const d=el.querySelector('details'); if(d)d.open=true;} });
  }
  loadReferenceData().catch(() => { list.innerHTML='<p class="empty-state">Reference data could not be loaded.</p>'; count.textContent='Unavailable'; });
  search.addEventListener('input', render); category.addEventListener('change', render);
})();