(() => {
  const API = '/api/operations/wolf-bgs-sliders';
  const RULES_API = '/api/operations/wolf-bgs-rules';
  const MONGREL = 'Regiment of Imperial Mongrels';

  let state = {
    systemSliderObjectives: {},
    sliderUpdatedAt: {},
    sliderUpdatedBy: {},
    rules: { workload: { bountyMillionsPerCmdr:20, tradeProfitMillionsPerCmdr:20 } },
  };

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const norm = value => String(value || '').trim().toLowerCase();
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);

  function fmt(value) {
    if (!value) return 'never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
  }

  async function request(action, body = {}) {
    const response = await fetch(API, {
      method:'PUT', credentials:'same-origin', cache:'no-store',
      headers:{ Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'wolf-bgs-control' },
      body:JSON.stringify({ action, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function load() {
    const [sliderResponse, rulesResponse] = await Promise.all([
      fetch(`${API}?_=${Date.now()}`, { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } }),
      fetch(`${RULES_API}?_=${Date.now()}`, { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } }),
    ]);
    if (!sliderResponse.ok) throw new Error(`Slider objective request failed (${sliderResponse.status})`);
    const sliderData = await sliderResponse.json();
    const rulesData = rulesResponse.ok ? await rulesResponse.json() : {};
    state = { ...state, ...sliderData, rules:rulesData.rules || state.rules };
  }

  function systemName(card) { return card.dataset.system || ''; }

  function factionRows(card) {
    return [...card.querySelectorAll('[data-faction-row]')].map(row => ({
      name:row.querySelector('[data-faction="name"]')?.value?.trim() || '',
      influence:num(row.querySelector('[data-faction="influence"]')?.value),
    })).filter(row => row.name);
  }

  function savedObjective(system, faction) {
    return (state.systemSliderObjectives?.[system] || []).find(row => norm(row.faction) === norm(faction)) || {};
  }

  function factionStrategyRow(card, faction) {
    return [...card.querySelectorAll('[data-faction-strategy-row]')].find(row => norm(row.dataset.factionName) === norm(faction)) || null;
  }

  function factionIntent(card, faction) {
    const row = factionStrategyRow(card, faction);
    return row?.querySelector('[data-faction-strategy="intent"]')?.value || 'no-action';
  }

  function targetBand(card, faction) {
    if (norm(faction) === norm(MONGREL)) {
      return {
        min:num(card.querySelector('[data-setting="targetMin"]')?.value),
        max:num(card.querySelector('[data-setting="targetMax"]')?.value),
      };
    }
    const row = factionStrategyRow(card, faction);
    return {
      min:num(row?.querySelector('[data-faction-strategy="targetMin"]')?.value),
      max:num(row?.querySelector('[data-faction-strategy="targetMax"]')?.value),
    };
  }

  function currentInfluence(card, faction) {
    return factionRows(card).find(row => norm(row.name) === norm(faction))?.influence ?? null;
  }

  function influenceGuard(card, faction) {
    const current = currentInfluence(card, faction);
    const { min, max } = targetBand(card, faction);
    const intent = factionIntent(card, faction);

    if (current !== null && max !== null && current >= max) {
      return { key:'ceiling', text:`${faction} is at/above its ${max}% influence ceiling. Positive slider work must not automatically override the influence ceiling.` };
    }
    if (current !== null && min !== null && current < min) {
      return { key:'support-compatible', text:`${faction} is below its ${min}% influence floor, so positive slider work can also serve the influence objective.` };
    }
    if (intent === 'suppress') {
      return { key:'avoid-positive', text:`${faction} is configured for suppression. Positive slider work is blocked unless Wolf explicitly changes the influence plan.` };
    }
    if (intent === 'maintain' || intent === 'no-action' || (current !== null && (min !== null || max !== null))) {
      return { key:'minimize', text:`Influence is being held. Use the lowest practical INF reward choices and modest workloads; zero-INF slider movement is not assumed.` };
    }
    if (intent === 'support') {
      return { key:'support-compatible', text:`Influence support is compatible with this faction's current strategy.` };
    }
    return { key:'neutral', text:'No explicit influence guard is configured for this faction.' };
  }

  function objectiveOptions(value) {
    return `<option value="ignore" ${!value||value==='ignore'?'selected':''}>Ignore</option>
      <option value="raise" ${value==='raise'?'selected':''}>Raise</option>
      <option value="hold" ${value==='hold'?'selected':''}>Hold</option>
      <option value="lower" ${value==='lower'?'selected':''}>Lower</option>`;
  }

  function securityOptions(value) {
    return `${objectiveOptions(value)}
      <option value="locked" ${value==='locked'?'selected':''}>Locked / not actionable</option>`;
  }

  function sectionMarkup(card) {
    const system = systemName(card);
    const body = factionRows(card).map(row => {
      const saved = savedObjective(system, row.name);
      const guard = influenceGuard(card, row.name);
      return `<tr data-slider-objective-row data-faction-name="${esc(row.name)}">
        <td><strong>${esc(row.name)}</strong><small>${row.influence === null ? '—' : `${row.influence.toFixed(2)}%`}</small></td>
        <td><select data-slider-objective="economyObjective">${objectiveOptions(saved.economyObjective)}</select></td>
        <td><select data-slider-objective="securityObjective">${securityOptions(saved.securityObjective)}</select></td>
        <td><span class="wolf-slider-guard ${esc(guard.key)}">${esc(guard.text)}</span></td>
      </tr>`;
    }).join('');
    const savedAt = state.sliderUpdatedAt?.[system];
    const savedBy = state.sliderUpdatedBy?.[system];
    return `<section class="wolf-section wolf-slider-objectives" data-slider-objectives-section>
      <h3>Economy & Security Objectives</h3>
      <p class="wolf-section-intro">These objectives are independent from influence intent. A Raise objective tells automation to push that slider while respecting the faction's influence guardrail; it never assumes slider movement can be made with zero influence effect.</p>
      <div class="wolf-slider-callout"><strong>Slider-first doctrine</strong><span>When influence should hold, prefer low-INF mission reward choices and modest Economy/Security workloads. If a faction is already at its influence ceiling, positive slider work is paused unless Wolf explicitly overrides the guardrail.</span></div>
      <div class="wolf-table-scroll"><table class="wolf-slider-table"><thead><tr><th>Faction</th><th>Economy</th><th>Security</th><th>Influence guardrail</th></tr></thead><tbody>${body}</tbody></table></div>
      <p class="wolf-slider-footnote">For factions whose Security slider is not actionable (for example, a known locked case), choose <b>Locked / not actionable</b>. Automatic government/ethos detection is not assumed yet.</p>
      <div class="wolf-faction-strategy-actions"><span data-slider-objectives-message>${savedAt ? `Saved ${esc(fmt(savedAt))} by ${esc(savedBy || 'Wolf')}` : 'No Economy/Security objectives saved yet.'}</span><div><button type="button" class="btn btn-secondary btn-compact" data-reset-slider-objectives>Reset Slider Objectives</button><button type="button" class="btn btn-primary btn-compact" data-save-slider-objectives>Save Slider Objectives</button></div></div>
    </section>`;
  }

  function collectObjectives(card) {
    return [...card.querySelectorAll('[data-slider-objective-row]')].map(row => ({
      faction:row.dataset.factionName || '',
      economyObjective:row.querySelector('[data-slider-objective="economyObjective"]')?.value || 'ignore',
      securityObjective:row.querySelector('[data-slider-objective="securityObjective"]')?.value || 'ignore',
      notes:'',
    }));
  }

  async function saveObjectives(card) {
    const system = systemName(card);
    const button = card.querySelector('[data-save-slider-objectives]');
    const message = card.querySelector('[data-slider-objectives-message]');
    if (button) button.disabled = true;
    if (message) message.textContent = 'Saving Economy/Security objectives…';
    try {
      const data = await request('save-system-slider-objectives', { system, objectives:collectObjectives(card) });
      state = { ...state, ...data };
      if (message) message.textContent = `Saved ${fmt(state.sliderUpdatedAt?.[system])} by ${state.sliderUpdatedBy?.[system] || 'Wolf'}`;
      refreshPreview(card);
    } catch (error) {
      console.error(error);
      if (message) message.textContent = 'Could not save Economy/Security objectives.';
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function resetObjectives(card) {
    const system = systemName(card);
    if (!window.confirm(`Reset Economy and Security objectives for ${system}? Influence strategy, manual faction data, and system settings will not be changed.`)) return;
    const message = card.querySelector('[data-slider-objectives-message]');
    try {
      const data = await request('reset-system-slider-objectives', { system });
      state = { ...state, ...data };
      const section = card.querySelector('[data-slider-objectives-section]');
      if (section) section.outerHTML = sectionMarkup(card);
      wireSection(card);
      refreshPreview(card);
    } catch (error) {
      console.error(error);
      if (message) message.textContent = 'Could not reset Economy/Security objectives.';
    }
  }

  function activeObjectiveRows(card) {
    const section = card.querySelector('[data-slider-objectives-section]');
    if (!section) return [];
    return [...section.querySelectorAll('[data-slider-objective-row]')].map(row => ({
      faction:row.dataset.factionName || '',
      economy:row.querySelector('[data-slider-objective="economyObjective"]')?.value || 'ignore',
      security:row.querySelector('[data-slider-objective="securityObjective"]')?.value || 'ignore',
    })).filter(row => row.economy !== 'ignore' || row.security !== 'ignore');
  }

  function objectiveLine(card, row) {
    const guard = influenceGuard(card, row.faction);
    const trade = Number(state.rules?.workload?.tradeProfitMillionsPerCmdr ?? 20);
    const bounties = Number(state.rules?.workload?.bountyMillionsPerCmdr ?? 20);
    const items = [];

    if (row.economy === 'raise') {
      if (['ceiling','avoid-positive'].includes(guard.key)) items.push(`Economy ↑ for ${row.faction}: configured, but positive Economy work is blocked by the current influence guardrail.`);
      else items.push(`Economy ↑ for ${row.faction}: favor low-INF economic mission rewards and modest profitable trade (about ${trade}M Cr profit per participating CMDR as the current workload reference).`);
    } else if (row.economy === 'hold') {
      items.push(`Economy ↔ for ${row.faction}: do not deliberately push the Economy slider; avoid large economic workloads unless another higher-priority objective requires them.`);
    } else if (row.economy === 'lower') {
      items.push(`Economy ↓ for ${row.faction}: objective recorded, but no automatic negative-Economy workload is issued yet; keep this advisory until a validated recipe is encoded.`);
    }

    if (row.security === 'raise') {
      if (['ceiling','avoid-positive'].includes(guard.key)) items.push(`Security ↑ for ${row.faction}: configured, but positive Security work is blocked by the current influence guardrail.`);
      else items.push(`Security ↑ for ${row.faction}: favor low-INF security/combat mission rewards and modest bounty turn-ins (about ${bounties}M Cr per participating CMDR as the current workload reference).`);
    } else if (row.security === 'hold') {
      items.push(`Security ↔ for ${row.faction}: do not deliberately push Security; avoid unnecessary bounty/security work unless another objective requires it.`);
    } else if (row.security === 'lower') {
      items.push(`Security ↓ for ${row.faction}: objective recorded, but no automatic negative-Security workload is issued yet; keep this advisory until a validated recipe is encoded.`);
    } else if (row.security === 'locked') {
      items.push(`Security locked for ${row.faction}: do not generate Security-slider orders.`);
    }

    return { guard, items };
  }

  function refreshGuardText(card) {
    card.querySelectorAll('[data-slider-objective-row]').forEach(row => {
      const faction = row.dataset.factionName || '';
      const guard = influenceGuard(card, faction);
      const cell = row.querySelector('.wolf-slider-guard');
      if (!cell) return;
      cell.className = `wolf-slider-guard ${guard.key}`;
      cell.textContent = guard.text;
    });
  }

  function refreshPreview(card) {
    const preview = [...card.querySelectorAll('.wolf-section')]
      .find(section => norm(section.querySelector('h3')?.textContent) === 'programmed automation')
      ?.querySelector('.wolf-automation-preview:not(.wolf-ai-preview)');
    if (!preview) return;

    const rows = activeObjectiveRows(card);
    const lines = [];
    for (const row of rows) {
      const result = objectiveLine(card, row);
      lines.push(...result.items.map(item => `<li>${esc(item)}</li>`));
      if (result.guard.key === 'minimize') lines.push(`<li class="guard">Influence guard — ${esc(result.guard.text)}</li>`);
    }

    const html = rows.length
      ? `<div class="wolf-slider-preview-inner"><b>Economy / Security layer</b><ul>${lines.join('')}</ul><small>Slider work is coordinated with influence strategy; it does not claim zero-INF effects.</small></div>`
      : `<div class="wolf-slider-preview-inner muted"><b>Economy / Security layer</b><span>No slider objectives configured for this system.</span></div>`;

    let host = preview.querySelector('[data-slider-preview]');
    if (!host) {
      host = document.createElement('div');
      host.dataset.sliderPreview = '';
      host.className = 'wolf-slider-preview';
      preview.appendChild(host);
    }
    if (host.innerHTML !== html) host.innerHTML = html;
  }

  function wireSection(card) {
    if (card.dataset.sliderWired === 'true') return;
    card.dataset.sliderWired = 'true';
    card.addEventListener('change', event => {
      if (event.target.matches('[data-slider-objective],[data-faction-strategy],[data-setting="targetMin"],[data-setting="targetMax"],[data-faction="influence"]')) {
        refreshGuardText(card);
        refreshPreview(card);
      }
    });
    card.addEventListener('click', event => {
      if (event.target.closest('[data-save-slider-objectives]')) { saveObjectives(card); return; }
      if (event.target.closest('[data-reset-slider-objectives]')) { resetObjectives(card); }
    });
  }

  function ensureSection(card) {
    if (card.querySelector('[data-slider-objectives-section]')) {
      wireSection(card);
      refreshGuardText(card);
      refreshPreview(card);
      return true;
    }
    const factionStrategy = card.querySelector('[data-faction-strategy-section]');
    if (!factionStrategy) return false;
    factionStrategy.insertAdjacentHTML('afterend', sectionMarkup(card));
    wireSection(card);
    refreshPreview(card);
    return true;
  }

  function enhanceAll() {
    document.querySelectorAll('.wolf-system-card').forEach(card => ensureSection(card));
  }

  function watch() {
    const list = document.querySelector('[data-system-list]');
    if (!list || list.dataset.sliderObserved === 'true') return;
    list.dataset.sliderObserved = 'true';
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => { queued = false; enhanceAll(); }, 30);
    });
    observer.observe(list, { childList:true, subtree:true });
  }

  async function init() {
    try { await load(); }
    catch (error) { console.error('Could not load Wolf BGS Economy/Security objectives', error); }

    const waitForDeck = () => {
      const list = document.querySelector('[data-system-list]');
      if (!list) { window.setTimeout(waitForDeck, 80); return; }
      watch();
      enhanceAll();
      if (![...document.querySelectorAll('.wolf-system-card')].some(card => card.querySelector('[data-faction-strategy-section]'))) {
        window.setTimeout(enhanceAll, 120);
        window.setTimeout(enhanceAll, 320);
      }
    };
    waitForDeck();
  }

  init();
})();
