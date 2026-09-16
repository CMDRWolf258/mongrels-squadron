(() => {
  const form = document.querySelector('[data-pathway-form]');
  const preview = document.querySelector('[data-pathway-preview]');
  const summary = document.querySelector('[data-pathway-summary]');
  const goalPreview = document.querySelector('[data-pathway-goal-preview]');
  const saveStatus = document.querySelector('[data-pathway-save-status]');
  const playStyle = document.querySelector('[data-pathway-play-style]');
  const currentGoal = document.querySelector('[data-pathway-current-goal]');
  if (!form || !preview || !summary) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const experienceLabels = { new:'Beginner', some:'Developing', comfortable:'Experienced', experienced:'Veteran / Mentor' };
  const styleLabels = { either:'Solo or group', solo:'Usually solo', group:'Prefer group play' };
  const fullRouteIds = new Set([
    'pve','pvp','ax','surface','bgs','mining','trade','carrier-logistics','engineering',
    'exploration','exobiology','colonization','operations',
  ]);
  const linkMap = {
    pve:'../activities/#combat', pvp:'../pvp/', surface:'../guides/operations/',
    exploration:'../activities/#exploration', exobiology:'../activities/#exploration', colonization:'../projects/',
    powerplay:'../activities/#powerplay', operations:'../operations/#daily-orders',
  };
  const nextSteps = {
    pve:{new:'Start with one rebuy-safe combat ship and a specific low-risk bounty assignment.',some:'Refine one combat ship and practice positioning, module targeting, and tougher PvE fights.',comfortable:'Take on higher-intensity combat, wing roles, and specialized builds.',experienced:'Use your combat experience in squad tasking, mentoring, and advanced build refinement.'},
    pvp:{new:'Start with survivability, pip management, fixed-weapon practice, and an Open-ready ship.',some:'Practice range control, boost timing, target pressure, and consistent damage application.',comfortable:'Refine matchup knowledge, wing coordination, and specialized PvP engineering.',experienced:'Focus on advanced matchups, wing leadership, training others, and competitive refinement.'},
    surface:{new:'Learn suit/weapon basics, settlement access, threat awareness, and the Operation Runner workflow before chasing difficult missions.',some:'Improve equipment, movement, mission selection, and repeatable surface-combat routines.',comfortable:'Take on higher-risk operations and coordinate roles with other Commanders.',experienced:'Use advanced loadouts, operation planning, and mentoring to support organized surface activity.'},
    exploration:{new:'Prepare a safe exploration ship, learn scanning, route planning, and how to return with your data intact.',some:'Improve range, neutron-route confidence, field repairs, and expedition workflow.',comfortable:'Plan longer expeditions, difficult destinations, and efficient discovery/exobiology loops.',experienced:'Lead expeditions, scout unusual targets, and mentor newer explorers.'},
    exobiology:{new:'Learn biological signal discovery, landing/sampling flow, and how to avoid wasting time between samples.',some:'Improve planet selection, movement, and efficient sample routing.',comfortable:'Combine exobiology with long-range exploration and higher-value target selection.',experienced:'Optimize survey workflows, expedition support, and teaching efficient field technique.'},
    colonization:{new:'Learn the basic construction loop, hauling requirements, and how colony development differs from ordinary station play.',some:'Understand build priorities, logistics, economies, and how sites affect system development.',comfortable:'Plan larger construction sequences, carrier support, and economy-focused development.',experienced:'Coordinate multi-site colony strategy, long-haul logistics, and long-term system planning.'},
    powerplay:{new:'Start with the squad’s eventual Powerplay doctrine and learn the current mechanics before committing resources.',some:'Understand activity types, strategic effects, and where your preferred play style contributes.',comfortable:'Coordinate efficient Powerplay activity with squad goals and current priorities.',experienced:'Help shape doctrine, strategy, and advanced coordination once the squad’s Powerplay framework is finalized.'},
    operations:{new:'Read current Daily Orders and choose one task that matches skills you already have.',some:'Learn how your preferred activities plug into larger squad operations and reporting.',comfortable:'Take ownership of complex tasks, coordination, and cross-activity support.',experienced:'Lead, brief, mentor, and help turn strategic goals into clear operational tasking.'},
  };

  let savedData = null;
  let refreshBusy = false;

  async function fetchSaved() {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      const response = await fetch(`/api/pathway/preferences?_=${Date.now()}`, {
        credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' },
      });
      if (!response.ok) return;
      savedData = await response.json();
      renderSavedView();
      updateDraftStatus();
    } catch (error) {
      console.error('Could not refresh saved Pathway view', error);
    } finally {
      refreshBusy = false;
    }
  }

  function savedPreferences() {
    return savedData?.preferences && typeof savedData.preferences === 'object' ? savedData.preferences : {};
  }

  function selectedFrom(prefs) {
    return new Set([...(Array.isArray(prefs?.interests) ? prefs.interests : []), ...(Array.isArray(prefs?.improve) ? prefs.improve : [])]);
  }

  function renderSavedView() {
    if (!savedData) return;
    const prefs = savedPreferences();
    const selected = selectedFrom(prefs);
    const improve = Array.isArray(prefs.improve) ? prefs.improve : [];
    const improveSet = new Set(improve);
    const catalog = Array.isArray(savedData?.catalog?.activities) ? savedData.catalog.activities : [];
    const selectedItems = catalog.filter(item => selected.has(item.id));

    summary.innerHTML = `<span><strong>${selectedItems.length}</strong> saved</span><span><strong>${improve.length}</strong> improvement focus${improve.length === 1 ? '' : 'es'}</span><span>${esc(styleLabels[prefs.playStyle] || styleLabels.either)}</span>`;

    // Every implemented full Pathway owns its own visibility and assignment UI.
    // The saved-view layer only renders fallback cards for activities that do
    // not yet have a full provider (currently Powerplay).
    const genericItems = selectedItems.filter(item => !fullRouteIds.has(item.id));
    preview.innerHTML = `<div data-saved-pathway-preview>${genericItems.length ? `<div class="pathway-recommendations">${genericItems.map(item => genericMarkup(item, prefs, improveSet)).join('')}</div>` : ''}</div>`;

    const goal = String(prefs.currentGoal || '').trim();
    if (goalPreview) {
      goalPreview.hidden = !goal;
      goalPreview.innerHTML = goal ? `<span>Current Personal Goal</span><p>${esc(goal)}</p>` : '';
    }
  }

  function genericMarkup(item, prefs, improveSet) {
    const level = prefs?.experience?.[item.id] || 'new';
    const priority = improveSet.has(item.id);
    const step = nextSteps[item.id]?.[level] || 'Explore the activity and choose one concrete goal to work toward.';
    return `<details class="pathway-activity-section pathway-generic-section${priority ? ' is-priority' : ''}" data-saved-pathway-item="${esc(item.id)}">
      <summary>
        <span class="pathway-activity-title"><small>Pathway</small><strong>${esc(item.label)}</strong></span>
        <span class="pathway-activity-summary-badges"><span class="pathway-badge">${esc(experienceLabels[level] || level)}</span>${priority ? '<span class="pathway-badge is-improve">Improve</span>' : ''}</span>
      </summary>
      <div class="pathway-activity-body pathway-generic-body">
        <p>${priority ? 'You marked this as an area you want to improve.' : 'You marked this as an activity you are interested in.'}</p>
        <span class="pathway-next-label">Recommended next direction</span><strong>${esc(step)}</strong>
        <a class="btn btn-ghost" href="${esc(linkMap[item.id] || '../activities/')}">Open Related Content</a>
      </div>
    </details>`;
  }

  function normalizedSaved() {
    const prefs = savedPreferences();
    const selected = selectedFrom(prefs);
    const experience = {};
    selected.forEach(id => { experience[id] = prefs?.experience?.[id] || 'new'; });
    return {
      interests:[...(prefs.interests || [])].sort(),
      improve:[...(prefs.improve || [])].sort(),
      experience,
      playStyle:prefs.playStyle || 'either',
      currentGoal:String(prefs.currentGoal || '').trim(),
    };
  }

  function normalizedDraft() {
    const interests = [...form.querySelectorAll('[data-pathway-interest]:checked')].map(input => input.value).sort();
    const improve = [...form.querySelectorAll('[data-pathway-improve]:checked')].map(input => input.value).sort();
    const selected = new Set([...interests, ...improve]);
    const experience = {};
    selected.forEach(id => {
      experience[id] = form.querySelector(`[data-pathway-experience="${CSS.escape(id)}"]`)?.value || 'new';
    });
    return {
      interests,
      improve,
      experience,
      playStyle:playStyle?.value || 'either',
      currentGoal:String(currentGoal?.value || '').trim(),
    };
  }

  function hasUnsavedChanges() {
    if (!savedData) return false;
    return JSON.stringify(normalizedDraft()) !== JSON.stringify(normalizedSaved());
  }

  function updateDraftStatus() {
    if (!saveStatus || !savedData) return;
    if (hasUnsavedChanges()) {
      saveStatus.textContent = 'Unsaved changes — Save My Pathway to update Your Pathway.';
      saveStatus.dataset.state = '';
    } else if (saveStatus.dataset.state !== 'success') {
      saveStatus.textContent = 'Your saved Pathway is shown on the right.';
      saveStatus.dataset.state = '';
    }
  }

  function restoreAfterDraftRender() {
    queueMicrotask(() => {
      renderSavedView();
      updateDraftStatus();
    });
  }

  form.addEventListener('change', restoreAfterDraftRender);
  form.addEventListener('input', restoreAfterDraftRender);

  if (saveStatus) {
    new MutationObserver(() => {
      if (saveStatus.dataset.state === 'success' || /pathway preferences saved/i.test(saveStatus.textContent || '')) fetchSaved();
    }).observe(saveStatus, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['data-state'] });
  }

  new MutationObserver(() => {
    if (!preview.querySelector('[data-saved-pathway-preview]')) renderSavedView();
  }).observe(preview, { childList:true, subtree:false });

  window.addEventListener('mongrels:pathway-saved', fetchSaved);
  fetchSaved();
})();
