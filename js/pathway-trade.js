(() => {
  const root = document.querySelector('[data-trade-pathway]');
  const loading = document.querySelector('[data-trade-loading]');
  const content = document.querySelector('[data-trade-content]');
  const pathwayForm = document.querySelector('[data-pathway-form]');
  if (!root || !content) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const experienceLabels = { new:'Beginner', some:'Developing', comfortable:'Experienced', experienced:'Veteran / Mentor' };
  const taskStatusLabels = { pending:'Next / Pending', complete:'Complete', known:'Already knew / had it', skipped:'Skipped for now' };
  const taskTypeLabels = { learn:'Learn', build:'Build', demonstrate:'Demonstrate', challenge:'Challenge', wing:'Wing / Team', mentor:'Teach / Mentor' };
  let assignments = null;
  let busy = false;

  async function preferencesApi() {
    const response = await fetch(`/api/pathway/preferences?_=${Date.now()}`, {
      credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' },
    });
    if (!response.ok) throw new Error(`Preferences request failed (${response.status})`);
    return response.json();
  }

  async function assignmentApi(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'pathway-assignments';
      options.body = JSON.stringify({ ...body, activity:'trade' });
    }
    const response = await fetch(`/api/pathway/assignments?activity=trade&_=${Date.now()}`, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || `Assignment request failed (${response.status})`);
    return payload;
  }

  function currentTask() {
    return assignments?.route?.tasks?.find(task => task.id === assignments.currentTaskId) || null;
  }

  function taskLink(task) {
    if (!task?.link?.url) return '';
    const external = task.link.external || /^https?:\/\//i.test(task.link.url);
    return `<a class="btn btn-ghost" href="${esc(task.link.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(task.link.label || 'Open Resource')}${external ? ' ↗' : ''}</a>`;
  }

  function taskTypeLabel(task) {
    return taskTypeLabels[task?.type] || 'Assignment';
  }

  function render() {
    if (!assignments?.eligible) {
      content.innerHTML = '<div class="pathway-empty"><strong>Trade & Hauling is not in your saved pathway yet.</strong><br>Select Trade & Hauling above and save your pathway to generate a Trade assignment chain.</div>';
      if (loading) loading.hidden = true;
      return;
    }

    const route = assignments.route;
    const current = currentTask();
    const progress = assignments.progress || { completed:0, total:route.tasks.length, percent:0 };
    const allDone = !current;
    const sources = Array.isArray(route.sources) ? route.sources : [];

    content.innerHTML = `
      <article class="ax-route-card">
        <div class="ax-route-head">
          <div><span class="ax-route-kicker">Your Trade development route</span><h3>${esc(route.title)}</h3><p>${esc(route.subtitle)}</p></div>
          <div class="pathway-recommendation-badges"><span class="pathway-badge">${esc(route.band || experienceLabels[assignments.experience] || 'Trade')}</span><span class="pathway-badge is-improve">Trade Route</span></div>
        </div>
        <div class="ax-progress"><div><strong>${progress.completed} / ${progress.total}</strong><span>assignments cleared</span></div><div class="ax-progress-track"><i style="width:${Math.max(0, Math.min(100, Number(progress.percent) || 0))}%"></i></div><span>${Number(progress.percent) || 0}%</span></div>
        <p class="ax-route-audience">${esc(route.audience)}</p>
        <div class="ax-route-actions">${assignments.canChooseAnother ? '<button class="btn btn-ghost" type="button" data-trade-another-route>Give Me Another Route</button>' : ''}<button class="ax-text-button" type="button" data-trade-reset-route>Reset this route</button></div>
      </article>

      ${allDone ? `
        <article class="ax-current-assignment is-graduate">
          <span class="ax-assignment-stage">Route Complete</span>
          <h3>Trade route complete</h3>
          <p>${esc(route.outcome)}</p>
          <a class="btn btn-primary" href="../trading/">Open Trader's Outpost</a>
        </article>` : `
        <article class="ax-current-assignment">
          <div class="ax-assignment-number"><span>${String(current.index).padStart(2,'0')}</span><small>${esc(current.stage)}</small></div>
          <div class="ax-current-copy">
            <span class="ax-next-label">Your Next Trade Assignment</span>
            <div class="ax-assignment-meta"><span class="ax-type-badge type-${esc(current.type || 'learn')}">${esc(taskTypeLabel(current))}</span></div>
            <h3>${esc(current.title)}</h3>
            <p class="ax-objective">${esc(current.objective)}</p>
            <div class="ax-why"><strong>Why this assignment</strong><p>${esc(current.why)}</p></div>
            ${Array.isArray(current.checklist) && current.checklist.length ? `<div class="ax-checklist"><strong>Clear it when you have:</strong><ul>${current.checklist.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
            <div class="ax-assignment-actions">
              <button class="btn btn-primary" type="button" data-trade-task-status="complete" data-trade-task-id="${esc(current.id)}">Complete</button>
              <button class="btn btn-ghost" type="button" data-trade-task-status="known" data-trade-task-id="${esc(current.id)}">Already Know / Have This</button>
              <button class="btn btn-ghost" type="button" data-trade-task-status="skipped" data-trade-task-id="${esc(current.id)}">Skip for Now</button>
              ${taskLink(current)}
            </div>
          </div>
        </article>`}

      <details class="ax-assignment-list">
        <summary>View the full ${esc(route.title)} route</summary>
        <div class="ax-assignment-list-body">
          ${route.tasks.map(task => `<article class="ax-list-task${task.id === assignments.currentTaskId ? ' is-current' : ''}">
            <div class="ax-list-index">${String(task.index).padStart(2,'0')}</div>
            <div><span>${esc(task.stage)} · ${esc(taskTypeLabel(task))}</span><strong>${esc(task.title)}</strong><small>${esc(task.objective)}</small></div>
            <div class="ax-list-status status-${esc(task.status)}"><span>${esc(taskStatusLabels[task.status] || task.status)}</span>${task.status !== 'pending' ? `<button type="button" data-trade-task-status="pending" data-trade-task-id="${esc(task.id)}">Reopen</button>` : ''}</div>
          </article>`).join('')}
        </div>
      </details>

      <details class="ax-sources">
        <summary>Why this route / references</summary>
        <p>${esc(route.sourceNote || '')}</p>
        <div>${sources.map(source => `<a href="${esc(source.url)}"${/^https?:\/\//i.test(source.url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(source.label)}${/^https?:\/\//i.test(source.url) ? ' ↗' : ''}</a>`).join('')}</div>
      </details>
      <div class="ax-action-status" data-trade-action-status></div>`;

    content.querySelector('[data-trade-another-route]')?.addEventListener('click', () => runAction({ action:'another_route' }, 'Picking another Trade route…'));
    content.querySelector('[data-trade-reset-route]')?.addEventListener('click', () => {
      if (!window.confirm(`Reset all progress on ${route.title}?\n\nThis only resets this Trade route. Your pathway preferences are unchanged.`)) return;
      runAction({ action:'reset_route' }, 'Resetting this Trade route…');
    });
    content.querySelectorAll('[data-trade-task-status]').forEach(button => button.addEventListener('click', () => {
      const status = button.dataset.tradeTaskStatus;
      const taskId = button.dataset.tradeTaskId;
      runAction({ action:'set_task', taskId, status }, status === 'pending' ? 'Reopening assignment…' : 'Saving assignment progress…');
    }));
    if (loading) loading.hidden = true;
  }

  async function runAction(body, workingText) {
    if (busy) return;
    busy = true;
    const status = content.querySelector('[data-trade-action-status]');
    if (status) { status.textContent = workingText; status.dataset.state = 'working'; }
    content.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      assignments = await assignmentApi('POST', body);
      render();
      const nextStatus = content.querySelector('[data-trade-action-status]');
      if (nextStatus) { nextStatus.textContent = 'Progress saved.'; nextStatus.dataset.state = 'success'; }
    } catch (error) {
      console.error('Could not update Trade pathway assignment', error);
      if (status) { status.textContent = error?.message || 'Could not update the Trade assignment.'; status.dataset.state = 'error'; }
      content.querySelectorAll('button').forEach(button => { button.disabled = false; });
    } finally {
      busy = false;
    }
  }

  async function load() {
    try {
      const data = await preferencesApi();
      const preferences = data.preferences || {};
      const savedSelected = new Set([...(preferences.interests || []), ...(preferences.improve || [])]);
      root.hidden = !savedSelected.has('trade');
      if (!savedSelected.has('trade')) {
        assignments = null;
        content.innerHTML = '';
        return;
      }
      if (loading) { loading.hidden = false; loading.textContent = 'Building your Trade assignment…'; }
      assignments = await assignmentApi();
      render();
    } catch (error) {
      root.hidden = true;
      console.error('Could not load Trade pathway assignments', error);
    }
  }

  pathwayForm?.addEventListener('submit', () => {
    window.setTimeout(load, 450);
    window.setTimeout(load, 1100);
  });
  window.addEventListener('mongrels:pathway-saved', load);
  load();
})();
