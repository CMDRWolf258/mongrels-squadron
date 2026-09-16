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
  const axRoot = document.querySelector('[data-ax-pathway]');
  const axLoading = document.querySelector('[data-ax-loading]');
  const axContent = document.querySelector('[data-ax-content]');
  if (!gate || !app || !form || !groupsRoot) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const experienceLabels = { new:'Beginner', some:'Developing', comfortable:'Experienced', experienced:'Veteran / Mentor' };
  const styleLabels = { either:'Solo or group', solo:'Usually solo', group:'Prefer group play' };
  const taskStatusLabels = { pending:'Next / Pending', complete:'Complete', known:'Already knew / had it', skipped:'Skipped for now' };
  const taskTypeLabels = { learn:'Learn', build:'Build', demonstrate:'Demonstrate', challenge:'Challenge', wing:'Wing / Team', mentor:'Teach / Mentor' };
  const linkMap = {
    pve:'../activities/#combat', pvp:'../pvp/', ax:'../activities/#ax', surface:'../guides/operations/',
    mining:'../guides/mining/', trade:'../trading/', 'carrier-logistics':'../carriers/', engineering:'../guides/engineering/',
    exploration:'../activities/#exploration', exobiology:'../activities/#exploration', bgs:'../guides/bgs/', colonization:'../projects/',
    powerplay:'../activities/#powerplay', operations:'../operations/#daily-orders',
  };
  const nextSteps = {
    pve:{new:'Start with one rebuy-safe combat ship and a specific low-risk bounty assignment.',some:'Refine one combat ship and practice positioning, module targeting, and tougher PvE fights.',comfortable:'Take on higher-intensity combat, wing roles, and specialized builds.',experienced:'Use your combat experience in squad tasking, mentoring, and advanced build refinement.'},
    pvp:{new:'Start with survivability, pip management, fixed-weapon practice, and an Open-ready ship.',some:'Practice range control, boost timing, target pressure, and consistent damage application.',comfortable:'Refine matchup knowledge, wing coordination, and specialized PvP engineering.',experienced:'Focus on advanced matchups, wing leadership, training others, and competitive refinement.'},
    ax:{new:'Your AX route will focus on acquiring capability and completing first live fights.',some:'Your AX route will push repeatable Interceptor fundamentals, broader technology, or the next combat tier.',comfortable:'Your AX route will emphasize independent builds, harder Interceptors, and operational competence.',experienced:'Your AX route will emphasize advanced challenges, wing responsibility, and teaching future Hellhounds.'},
    surface:{new:'Learn suit/weapon basics, settlement access, threat awareness, and the Operation Runner workflow before chasing difficult missions.',some:'Improve equipment, movement, mission selection, and repeatable surface-combat routines.',comfortable:'Take on higher-risk operations and coordinate roles with other Commanders.',experienced:'Use advanced loadouts, operation planning, and mentoring to support organized surface activity.'},
    mining:{new:'My Pathway will eventually assign a specific starter mining ship, method, and first full mining run rather than making you choose.',some:'Improve site choice, collection efficiency, cargo workflow, and selling decisions.',comfortable:'Specialize in high-value methods, scouting, carrier workflows, or squad supply runs.',experienced:'Optimize routes, teach newer miners, and support strategic construction or commodity goals.'},
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
  let axAssignments = null;
  let axBusy = false;

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

  async function assignmentApi(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'pathway-assignments';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/pathway/assignments?_=${Date.now()}`, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || `Assignment request failed (${response.status})`);
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
    const { improve, selected } = selectedIds();
    const catalog = Array.isArray(data.catalog.activities) ? data.catalog.activities : [];
    const improveSet = new Set(improve);
    const selectedItems = catalog.filter(item => selected.has(item.id)).sort((a,b) => Number(improveSet.has(b.id)) - Number(improveSet.has(a.id)));

    if (summary) {
      summary.innerHTML = `<span><strong>${selectedItems.length}</strong> selected</span><span><strong>${improve.length}</strong> improvement focus${improve.length === 1 ? '' : 'es'}</span><span>${esc(styleLabels[playStyle.value] || styleLabels.either)}</span>`;
    }

    if (axRoot) axRoot.hidden = !selected.has('ax');

    if (!selectedItems.length) {
      preview.innerHTML = '<div class="pathway-empty"><strong>Choose a few interests to begin.</strong><br>You do not need to fill every category. Two or three activities are enough for My Pathway to start becoming useful.</div>';
    } else {
      preview.innerHTML = `<div class="pathway-recommendations">${selectedItems.filter(item => item.id !== 'ax').map(item => {
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

    if (selected.has('ax') && !axAssignments?.eligible && axContent) {
      axContent.innerHTML = '<div class="pathway-empty"><strong>Save your pathway to receive an AX assignment.</strong><br>Once Anti-Xeno is part of your saved pathway, the site will pick a curated route for you.</div>';
      if (axLoading) axLoading.hidden = true;
    }

    const goal = currentGoal.value.trim();
    if (goalPreview) {
      goalPreview.hidden = !goal;
      goalPreview.innerHTML = goal ? `<span>Current Personal Goal</span><p>${esc(goal)}</p>` : '';
    }
  }

  function currentAxTask() {
    return axAssignments?.route?.tasks?.find(task => task.id === axAssignments.currentTaskId) || null;
  }

  function axTaskLink(task) {
    if (!task?.link?.url) return '';
    const external = task.link.external || /^https?:\/\//i.test(task.link.url);
    return `<a class="btn btn-ghost" href="${esc(task.link.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(task.link.label || 'Open Resource')}${external ? ' ↗' : ''}</a>`;
  }

  function taskTypeLabel(task) {
    return taskTypeLabels[task?.type] || 'Assignment';
  }

  function renderAxAssignments() {
    if (!axRoot || !axContent) return;
    if (!axAssignments?.eligible) {
      axContent.innerHTML = '<div class="pathway-empty"><strong>AX is not in your saved pathway yet.</strong><br>Select Anti-Xeno above and save your pathway to generate an assignment chain.</div>';
      if (axLoading) axLoading.hidden = true;
      return;
    }

    const route = axAssignments.route;
    const current = currentAxTask();
    const progress = axAssignments.progress || { completed:0, total:route.tasks.length, percent:0 };
    const allDone = !current;
    const sources = Array.isArray(route.sources) ? route.sources : [];

    axContent.innerHTML = `
      <article class="ax-route-card">
        <div class="ax-route-head">
          <div><span class="ax-route-kicker">We picked a route for you</span><h3>${esc(route.title)}</h3><p>${esc(route.subtitle)}</p></div>
          <div class="pathway-recommendation-badges"><span class="pathway-badge">${esc(route.band || experienceLabels[axAssignments.experience] || 'AX')}</span><span class="pathway-badge is-improve">AX Route</span></div>
        </div>
        <div class="ax-progress"><div><strong>${progress.completed} / ${progress.total}</strong><span>assignments cleared</span></div><div class="ax-progress-track"><i style="width:${Math.max(0, Math.min(100, Number(progress.percent) || 0))}%"></i></div><span>${Number(progress.percent) || 0}%</span></div>
        <p class="ax-route-audience">${esc(route.audience)}</p>
        <div class="ax-route-actions">${axAssignments.canChooseAnother ? '<button class="btn btn-ghost" type="button" data-ax-another-route>Give Me Another Route</button>' : ''}<button class="ax-text-button" type="button" data-ax-reset-route>Reset this route</button></div>
      </article>

      ${allDone ? `
        <article class="ax-current-assignment is-graduate">
          <span class="ax-assignment-stage">Route Complete</span>
          <h3>Qualification complete</h3>
          <p>${esc(route.outcome)}</p>
          <a class="btn btn-primary" href="../activities/#ax">Explore More AX</a>
        </article>` : `
        <article class="ax-current-assignment">
          <div class="ax-assignment-number"><span>${String(current.index).padStart(2,'0')}</span><small>${esc(current.stage)}</small></div>
          <div class="ax-current-copy">
            <span class="ax-next-label">Your Next Assignment</span>
            <div class="ax-assignment-meta"><span class="ax-type-badge type-${esc(current.type || 'learn')}">${esc(taskTypeLabel(current))}</span></div>
            <h3>${esc(current.title)}</h3>
            <p class="ax-objective">${esc(current.objective)}</p>
            <div class="ax-why"><strong>Why this assignment</strong><p>${esc(current.why)}</p></div>
            ${Array.isArray(current.checklist) && current.checklist.length ? `<div class="ax-checklist"><strong>Clear it when you have:</strong><ul>${current.checklist.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
            <div class="ax-assignment-actions">
              <button class="btn btn-primary" type="button" data-ax-task-status="complete" data-ax-task-id="${esc(current.id)}">Complete</button>
              <button class="btn btn-ghost" type="button" data-ax-task-status="known" data-ax-task-id="${esc(current.id)}">Already Know / Have This</button>
              <button class="btn btn-ghost" type="button" data-ax-task-status="skipped" data-ax-task-id="${esc(current.id)}">Skip for Now</button>
              ${axTaskLink(current)}
            </div>
          </div>
        </article>`}

      <details class="ax-assignment-list">
        <summary>View the full ${esc(route.title)} route</summary>
        <div class="ax-assignment-list-body">
          ${route.tasks.map(task => `<article class="ax-list-task${task.id === axAssignments.currentTaskId ? ' is-current' : ''}" data-ax-list-task="${esc(task.id)}">
            <div class="ax-list-index">${String(task.index).padStart(2,'0')}</div>
            <div><span>${esc(task.stage)} · ${esc(taskTypeLabel(task))}</span><strong>${esc(task.title)}</strong><small>${esc(task.objective)}</small></div>
            <div class="ax-list-status status-${esc(task.status)}"><span>${esc(taskStatusLabels[task.status] || task.status)}</span>${task.status !== 'pending' ? `<button type="button" data-ax-task-status="pending" data-ax-task-id="${esc(task.id)}">Reopen</button>` : ''}</div>
          </article>`).join('')}
        </div>
      </details>

      <details class="ax-sources">
        <summary>Why this route / references</summary>
        <p>${esc(route.sourceNote || '')}</p>
        <div>${sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a>`).join('')}</div>
      </details>
      <div class="ax-action-status" data-ax-action-status></div>`;

    axContent.querySelector('[data-ax-another-route]')?.addEventListener('click', async () => {
      await runAxAction({ action:'another_route' }, 'Picking another approved AX route…');
    });
    axContent.querySelector('[data-ax-reset-route]')?.addEventListener('click', async () => {
      if (!window.confirm(`Reset all progress on ${route.title}?\n\nThis only resets this AX route. Your pathway preferences are unchanged.`)) return;
      await runAxAction({ action:'reset_route' }, 'Resetting this AX route…');
    });
    axContent.querySelectorAll('[data-ax-task-status]').forEach(button => button.addEventListener('click', async () => {
      const status = button.dataset.axTaskStatus;
      const taskId = button.dataset.axTaskId;
      await runAxAction({ action:'set_task', taskId, status }, status === 'pending' ? 'Reopening assignment…' : 'Saving assignment progress…');
    }));
    if (axLoading) axLoading.hidden = true;
  }

  async function runAxAction(body, workingText) {
    if (axBusy) return;
    axBusy = true;
    const status = axContent?.querySelector('[data-ax-action-status]');
    if (status) { status.textContent = workingText; status.dataset.state = 'working'; }
    axContent?.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      axAssignments = await assignmentApi('POST', body);
      renderAxAssignments();
      renderPreview();
      const nextStatus = axContent?.querySelector('[data-ax-action-status]');
      if (nextStatus) { nextStatus.textContent = 'Progress saved.'; nextStatus.dataset.state = 'success'; }
    } catch (error) {
      console.error('Could not update AX pathway assignment', error);
      if (status) { status.textContent = error?.message || 'Could not update the AX assignment.'; status.dataset.state = 'error'; }
      axContent?.querySelectorAll('button').forEach(button => { button.disabled = false; });
    } finally {
      axBusy = false;
    }
  }

  async function loadAxAssignments() {
    if (!axRoot) return;
    const savedSelected = new Set([...(preferences?.interests || []), ...(preferences?.improve || [])]);
    axRoot.hidden = !savedSelected.has('ax');
    if (!savedSelected.has('ax')) {
      axAssignments = null;
      return;
    }
    if (axLoading) { axLoading.hidden = false; axLoading.textContent = 'Building your AX assignment…'; }
    try {
      axAssignments = await assignmentApi();
      renderAxAssignments();
    } catch (error) {
      console.error('Could not load AX assignments', error);
      if (axLoading) { axLoading.hidden = false; axLoading.textContent = 'AX assignments could not be loaded right now.'; }
      if (axContent) axContent.innerHTML = '';
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
      await loadAxAssignments();
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
      await loadAxAssignments();
      renderPreview();
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
