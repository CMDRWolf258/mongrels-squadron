(() => {
  const gate = document.querySelector('[data-pathway-gate]');
  const app = document.querySelector('[data-pathway-app]');
  const form = document.querySelector('[data-pathway-form]');
  const groupsRoot = document.querySelector('[data-pathway-groups]');
  const saveButton = document.querySelector('[data-pathway-save]');
  const saveStatus = document.querySelector('[data-pathway-save-status]');
  const preview = document.querySelector('[data-pathway-preview]');
  const summary = document.querySelector('[data-pathway-summary]');
  const goalPreview = document.querySelector('[data-pathway-goal-preview]');
  const playStyle = document.querySelector('[data-pathway-play-style]');
  const currentGoal = document.querySelector('[data-pathway-current-goal]');
  if (!gate || !app || !form || !groupsRoot) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const experienceLabels = { new:'New to it', some:'Some experience', comfortable:'Comfortable', experienced:'Experienced' };
  const styleLabels = { either:'Solo or group', solo:'Usually solo', group:'Prefer group play' };
  const linkMap = {
    pve:'../activities/#combat', pvp:'../pvp/', ax:'../activities/#ax', surface:'../guides/operations/',
    mining:'../guides/mining/', trade:'../trading/', 'carrier-logistics':'../carriers/', engineering:'../guides/engineering/',
    exploration:'../activities/#exploration', exobiology:'../activities/#exploration', bgs:'../guides/bgs/', colonization:'../projects/',
    powerplay:'../activities/#powerplay', operations:'../operations/#daily-orders',
  };
  const nextSteps = {
    pve:{new:'Get comfortable with basic ship combat, pips, target selection, and a rebuy-safe combat ship.',some:'Refine one combat ship and practice positioning, module targeting, and tougher PvE fights.',comfortable:'Take on higher-intensity combat, wing roles, and specialized builds.',experienced:'Use your combat experience in squad tasking, mentoring, and advanced build refinement.'},
    pvp:{new:'Start with survivability, pip management, fixed-weapon practice, and an Open-ready ship.',some:'Practice range control, reverski/boost timing, target pressure, and consistent damage application.',comfortable:'Refine matchup knowledge, wing coordination, and specialized PvP engineering.',experienced:'Focus on advanced matchups, wing leadership, training others, and competitive refinement.'},
    ax:{new:'Do not rush the Thargoid fight. Learn the AX basics, choose a starter direction, and identify the modules and Engineering you need first.',some:'Finish a coherent AX build, practice heat/survival fundamentals, and join suitable training before pushing harder targets.',comfortable:'Develop Interceptor fundamentals, heart cycles, shutdown/swarms, and consistent survival under pressure.',experienced:'Refine advanced Interceptor work, wing roles, specialized builds, and current squad AX operations.'},
    surface:{new:'Learn suit/weapon basics, settlement access, threat awareness, and the Operation Runner workflow before chasing difficult missions.',some:'Improve equipment, movement, mission selection, and repeatable surface-combat routines.',comfortable:'Take on higher-risk operations and coordinate roles with other Commanders.',experienced:'Use advanced loadouts, operation planning, and mentoring to support organized surface activity.'},
    mining:{new:'Pick one mining method, outfit one ship correctly, and complete a full locate → mine → sell loop.',some:'Improve site choice, collection efficiency, cargo workflow, and selling decisions.',comfortable:'Specialize in high-value methods, scouting, carrier workflows, or squad supply runs.',experienced:'Optimize routes, teach newer miners, and support strategic construction or commodity goals.'},
    trade:{new:'Learn pad size, cargo capacity, supply/demand, and complete a simple profitable haul safely.',some:'Compare routes, improve turnaround time, and understand demand-sensitive selling.',comfortable:'Run larger logistics chains, carrier loading, and squad-support hauling efficiently.',experienced:'Plan strategic logistics, coordinate haulers, and optimize large-volume operations.'},
    'carrier-logistics':{new:'Learn carrier services, jump planning, tritium needs, and basic loading/unloading coordination.',some:'Practice efficient carrier support runs and movement planning.',comfortable:'Coordinate larger logistics moves, construction support, and multi-Commander loading.',experienced:'Lead carrier logistics, route planning, and contingency support for squad operations.'},
    engineering:{new:'Choose one ship you actually fly and understand what one important module modification would improve.',some:'Build a coherent engineering plan instead of upgrading modules independently.',comfortable:'Refine experimentals, power/thermal tradeoffs, defenses, and role-specific build choices.',experienced:'Optimize edge cases, compare competing engineering philosophies, and help others troubleshoot builds.'},
    exploration:{new:'Prepare a safe exploration ship, learn scanning, route planning, and how to return with your data intact.',some:'Improve range, neutron-route confidence, field repairs, and expedition workflow.',comfortable:'Plan longer expeditions, difficult destinations, and efficient discovery/exobiology loops.',experienced:'Lead expeditions, scout unusual targets, and mentor newer explorers.'},
    exobiology:{new:'Learn biological signal discovery, landing/sampling flow, and how to avoid wasting time between samples.',some:'Improve planet selection, movement, and efficient sample routing.',comfortable:'Combine exobiology with long-range exploration and higher-value target selection.',experienced:'Optimize survey workflows, expedition support, and teaching efficient field technique.'},
    bgs:{new:'Learn influence, mission INF, states, and why “helping” a faction is not always the correct action.',some:'Practice daily workload planning, mission selection, conflicts, and influence control.',comfortable:'Work with expansion, retreat, ownership, state manipulation, and multi-faction planning.',experienced:'Plan campaigns, diagnose unusual BGS behavior, and help lead squad strategy.'},
    colonization:{new:'Learn the basic construction loop, hauling requirements, and how colony development differs from ordinary station play.',some:'Understand build priorities, logistics, economies, and how sites affect system development.',comfortable:'Plan larger construction sequences, carrier support, and economy-focused development.',experienced:'Coordinate multi-site colony strategy, long-haul logistics, and long-term system planning.'},
    powerplay:{new:'Start with the squad’s eventual Powerplay doctrine and learn the current mechanics before committing resources.',some:'Understand activity types, strategic effects, and where your preferred play style contributes.',comfortable:'Coordinate efficient Powerplay activity with squad goals and current priorities.',experienced:'Help shape doctrine, strategy, and advanced coordination once the squad’s Powerplay framework is finalized.'},
    operations:{new:'Read current Daily Orders and choose one task that matches skills you already have.',some:'Learn how your preferred activities plug into larger squad operations and reporting.',comfortable:'Take ownership of complex tasks, coordination, and cross-activity support.',experienced:'Lead, brief, mentor, and help turn strategic goals into clear operational tasking.'},
  };

  let data = null;
  let preferences = null;

  async function api(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'pathway-preferences';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/pathway/preferences?_=${Date.now()}`, options);
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error(payload.error || 'auth'), { auth:true });
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function selectedIds() {
    const interests = [...document.querySelectorAll('[data-pathway-interest]:checked')].map(input => input.value);
    const improve = [...document.querySelectorAll('[data-pathway-improve]:checked')].map(input => input.value);
    return { interests, improve, selected:new Set([...interests, ...improve]) };
  }

  function experienceFor(id) {
    return document.querySelector(`[data-pathway-experience="${CSS.escape(id)}"]`)?.value || 'new';
  }

  function syncCard(card) {
    const interest = card.querySelector('[data-pathway-interest]')?.checked;
    const improve = card.querySelector('[data-pathway-improve]')?.checked;
    const select = card.querySelector('[data-pathway-experience]');
    const active = Boolean(interest || improve);
    card.classList.toggle('is-selected', active);
    if (select) select.disabled = !active;
  }

  function renderPreferences() {
    const catalog = Array.isArray(data?.catalog?.activities) ? data.catalog.activities : [];
    const groups = [...new Set(catalog.map(item => item.group))];
    const interestSet = new Set(preferences?.interests || []);
    const improveSet = new Set(preferences?.improve || []);
    const exp = preferences?.experience || {};

    groupsRoot.innerHTML = groups.map(group => {
      const items = catalog.filter(item => item.group === group);
      return `<section class="pathway-group"><h3 class="pathway-group-title">${esc(group)}</h3><div class="pathway-preference-grid">${items.map(item => {
        const active = interestSet.has(item.id) || improveSet.has(item.id);
        return `<article class="pathway-pref-card${active ? ' is-selected' : ''}" data-pathway-card="${esc(item.id)}">
          <div class="pathway-pref-card-head"><div><h3>${esc(item.label)}</h3><small>${esc(group)}</small></div></div>
          <div class="pathway-pref-options">
            <label class="pathway-choice"><input type="checkbox" value="${esc(item.id)}" data-pathway-interest ${interestSet.has(item.id) ? 'checked' : ''}>Interested</label>
            <label class="pathway-choice"><input type="checkbox" value="${esc(item.id)}" data-pathway-improve ${improveSet.has(item.id) ? 'checked' : ''}>Want to improve</label>
          </div>
          <label class="pathway-experience">Experience
            <select data-pathway-experience="${esc(item.id)}" ${active ? '' : 'disabled'}>
              ${Object.entries(experienceLabels).map(([value,label]) => `<option value="${value}" ${(exp[item.id] || 'new') === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
            </select>
          </label>
        </article>`;
      }).join('')}</div></section>`;
    }).join('');

    playStyle.value = preferences?.playStyle || 'either';
    currentGoal.value = preferences?.currentGoal || '';

    groupsRoot.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
      const card = input.closest('[data-pathway-card]');
      if (card) syncCard(card);
      renderPreview();
    }));
    groupsRoot.querySelectorAll('select').forEach(select => select.addEventListener('change', renderPreview));
    playStyle.addEventListener('change', renderPreview);
    currentGoal.addEventListener('input', renderPreview);
    renderPreview();
  }

  function renderPreview() {
    if (!data) return;
    const { interests, improve, selected } = selectedIds();
    const catalog = Array.isArray(data.catalog.activities) ? data.catalog.activities : [];
    const improveSet = new Set(improve);
    const selectedItems = catalog.filter(item => selected.has(item.id)).sort((a,b) => Number(improveSet.has(b.id)) - Number(improveSet.has(a.id)));

    if (summary) {
      summary.innerHTML = `<span><strong>${selectedItems.length}</strong> selected</span><span><strong>${improve.length}</strong> improvement focus${improve.length === 1 ? '' : 'es'}</span><span>${esc(styleLabels[playStyle.value] || styleLabels.either)}</span>`;
    }

    if (!selectedItems.length) {
      preview.innerHTML = '<div class="pathway-empty"><strong>Choose a few interests to begin.</strong><br>You do not need to fill every category. Two or three activities are enough for My Pathway to start becoming useful.</div>';
    } else {
      preview.innerHTML = `<div class="pathway-recommendations">${selectedItems.map(item => {
        const level = experienceFor(item.id);
        const step = nextSteps[item.id]?.[level] || 'Explore the activity and choose one concrete goal to work toward.';
        const priority = improveSet.has(item.id);
        return `<article class="pathway-recommendation${priority ? ' is-priority' : ''}">
          <div class="pathway-recommendation-top"><h3>${esc(item.label)}</h3><div class="pathway-recommendation-badges"><span class="pathway-badge">${esc(experienceLabels[level] || level)}</span>${priority ? '<span class="pathway-badge is-improve">Improve</span>' : ''}</div></div>
          <p>${priority ? 'You marked this as an area you want to improve.' : 'You marked this as an activity you are interested in.'}</p>
          <span class="pathway-next-label">Recommended next direction</span><strong>${esc(step)}</strong>
          <a class="btn btn-ghost" href="${esc(linkMap[item.id] || '../activities/')}">Open Related Content</a>
        </article>`;
      }).join('')}</div>`;
    }

    const goal = currentGoal.value.trim();
    if (goalPreview) {
      goalPreview.hidden = !goal;
      goalPreview.innerHTML = goal ? `<span>Current Personal Goal</span><p>${esc(goal)}</p>` : '';
    }
  }

  function collect() {
    const { interests, improve, selected } = selectedIds();
    const experience = {};
    selected.forEach(id => { experience[id] = experienceFor(id); });
    return { interests, improve, experience, playStyle:playStyle.value, currentGoal:currentGoal.value.trim() };
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    saveButton.disabled = true;
    saveStatus.textContent = 'Saving your pathway…';
    saveStatus.dataset.state = '';
    try {
      const result = await api('POST', collect());
      preferences = result.preferences;
      saveStatus.textContent = 'Pathway preferences saved.';
      saveStatus.dataset.state = 'success';
      renderPreview();
    } catch (error) {
      console.error('Could not save My Pathway preferences', error);
      saveStatus.textContent = 'Could not save your pathway. Please try again.';
      saveStatus.dataset.state = 'error';
    } finally {
      saveButton.disabled = false;
    }
  });

  (async () => {
    try {
      data = await api();
      preferences = data.preferences || {};
      gate.hidden = true;
      app.hidden = false;
      renderPreferences();
    } catch (error) {
      if (error.auth) {
        gate.hidden = false;
        app.hidden = true;
        const status = gate.querySelector('[data-pathway-gate-status]');
        if (status) status.textContent = 'Sign in with a Mongrel Member account to open My Pathway.';
      } else {
        const status = gate.querySelector('[data-pathway-gate-status]');
        if (status) status.textContent = 'My Pathway could not be loaded. Please try again shortly.';
      }
    }
  })();
})();
