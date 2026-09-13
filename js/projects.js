(() => {
  const board = document.querySelector('[data-projects-board]');
  if (!board) return;

  const signedOut = document.querySelector('[data-projects-signed-out]');
  const grid = document.querySelector('[data-project-grid]');
  const empty = document.querySelector('[data-project-empty]');
  const shell = document.querySelector('[data-project-editor-shell]');
  const form = document.querySelector('[data-project-form]');

  let session = null;
  let items = [];
  let filter = 'active';
  let editing = null;
  let dirty = false;
  const memberParam = new URLSearchParams(location.search).get('member') || '';
  let memberFilter = null;

  const $ = sel => document.querySelector(sel);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const apiFetch = async (url, options = {}) => {
    const requestUrl = options.method ? url : `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
    const response = await fetch(requestUrl, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const statusLabel = status => ({
    planning: 'Planning', active: 'Active', paused: 'Paused', complete: 'Complete'
  }[status] || status);

  const formatDate = value => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const copyText = async (text, button) => {
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = old; }, 1100);
    } catch {}
  };

  const timestamp = value => {
    const t = Date.parse(value || '');
    return Number.isFinite(t) ? t : 0;
  };

  const eventDate = item => {
    const t = Date.parse(item.deadline ? `${item.deadline}T12:00:00` : '');
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  };

  function sortProjects(list) {
    return list.sort((a, b) => {
      if (filter === 'events') return eventDate(a) - eventDate(b) || timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (filter === 'official') return timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (filter === 'mine') return (a.status === 'complete') - (b.status === 'complete') || timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (filter === 'archive') return timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (a.official !== b.official) return a.official ? -1 : 1;
      if (a.status !== b.status) {
        const rank = { active: 0, planning: 1, paused: 2, complete: 3 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      }
      return timestamp(b.updatedAt) - timestamp(a.updatedAt);
    });
  }

  function filteredItems() {
    const list = items.filter(item => {
      if (filter === 'all') return true;
      if (filter === 'mine') return item.isMine;
      if (filter === 'archive') return item.status === 'complete';
      if (filter === 'events') return item.kind === 'event' && item.status !== 'complete';
      if (filter === 'member') return item.kind === 'project' && !item.official && item.status !== 'complete';
      if (filter === 'official') return item.kind === 'project' && item.official && item.status !== 'complete';
      return item.kind === 'project' && item.status !== 'complete';
    });
    return sortProjects(list);
  }

  function render() {
    const active = items.filter(i => i.kind === 'project' && i.status !== 'complete').length;
    const events = items.filter(i => i.kind === 'event' && i.status !== 'complete').length;
    const mine = items.filter(i => i.isMine && i.status !== 'complete').length;
    const archive = items.filter(i => i.status === 'complete').length;

    $('[data-project-count-active]').textContent = active;
    $('[data-project-count-events]').textContent = events;
    $('[data-project-count-mine]').textContent = mine;
    $('[data-project-count-archive]').textContent = archive;

    const list = filteredItems();
    grid.replaceChildren();
    empty.hidden = list.length > 0;

    list.forEach(item => {
      const card = document.createElement('article');
      card.className = `project-card${item.kind === 'event' ? ' project-card-event' : ''}${item.official ? ' project-card-official' : ''}`;

      const system = item.system
        ? `<div class="project-system"><span>${safe(item.system)}</span><button type="button" class="copy-system-btn" data-copy-system="${safe(item.system)}" aria-label="Copy system name">⧉</button></div>`
        : '';

      const progress = item.kind === 'project'
        ? `<div class="project-progress"><div><span>Progress</span><strong>${Number(item.progress) || 0}%</strong></div><div class="project-progress-track"><span style="width:${Math.max(0, Math.min(100, Number(item.progress) || 0))}%"></span></div></div>`
        : '';

      const help = item.helpRequested
        ? `<div class="project-help"><span>Help Requested</span><p>${safe(item.helpRequested)}</p></div>`
        : '';

      const target = item.target
        ? `<div class="project-target"><span>Goal / Target</span><strong>${safe(item.target)}</strong></div>`
        : '';

      const eventClock = item.kind === 'event' && item.eventTime ? ` · ${safe(item.eventTime)} UTC` : '';
      const dateCallout = item.deadline
        ? `<div class="project-date-callout ${item.kind === 'event' ? 'event-date' : ''}"><span>${item.kind === 'event' ? 'Event Date' : 'Target Date'}</span><strong>${safe(formatDate(item.deadline))}${eventClock}</strong></div>`
        : '';
      const eventType = item.kind === 'event' && item.eventType ? `<div class="project-event-type"><span>Event Type</span><strong>${safe(item.eventType)}</strong></div>` : '';

      card.innerHTML = `
        <div class="project-card-top">
          <div class="project-badges">
            <span class="project-type ${item.official ? 'official' : ''}">${item.official ? 'Squad ' : 'Member '}${item.kind === 'event' ? 'Event' : 'Project'}</span>
            <span class="project-status">${safe(statusLabel(item.status))}</span>
          </div>
          ${item.canEdit ? '<button class="btn btn-secondary project-edit-btn" type="button">Edit</button>' : ''}
        </div>
        <p class="eyebrow">${safe(item.category || 'Project')}</p>
        <h3>${safe(item.title)}</h3>
        ${dateCallout}
        ${eventType}
        ${system}
        <p class="project-description">${safe(item.description)}</p>
        ${help}
        ${target}
        ${progress}
        <div class="project-card-meta"><span>Posted by <strong>${safe(item.ownerName)}</strong></span></div>`;

      card.querySelector('[data-copy-system]')?.addEventListener('click', e => copyText(item.system, e.currentTarget));
      card.querySelector('.project-edit-btn')?.addEventListener('click', () => openEditor(item));
      grid.appendChild(card);
    });
  }

  function updateEditorLabels() {
    const isEvent = $('[data-project-kind]').value === 'event';
    const dateLabel = $('[data-project-date-label]');
    if (dateLabel) dateLabel.textContent = isEvent ? 'Event date' : 'Target / deadline date';
    $('[data-project-progress]').closest('label').hidden = isEvent;
    $('[data-project-target]').closest('label').hidden = isEvent;
    $('[data-project-time-wrap]').hidden = !isEvent;
    $('[data-project-event-type-wrap]').hidden = !isEvent;
    if (!editing) $('[data-project-form-title]').textContent = isEvent ? 'New Event' : 'New Project';
    const submit = $('[data-project-submit]'); if (submit) submit.textContent = isEvent ? 'Save Event' : 'Save Project';
  }

  function openEditor(item = null) {
    editing = item;
    dirty = false;
    shell.hidden = false;
    document.body.classList.add('project-editor-open');
    $('[data-project-form-title]').textContent = item ? 'Edit Project' : 'New Project';
    $('[data-project-id]').value = item?.id || '';
    $('[data-project-kind]').value = item?.kind || 'project';
    $('[data-project-title]').value = item?.title || '';
    $('[data-project-system]').value = item?.system || '';
    $('[data-project-category]').value = item?.category || 'Colonization';
    $('[data-project-status]').value = item?.status || 'active';
    $('[data-project-progress]').value = item?.progress ?? 0;
    $('[data-project-deadline]').value = item?.deadline || '';
    $('[data-project-time]').value = item?.eventTime || '';
    $('[data-project-event-type]').value = item?.eventType || 'Training';
    $('[data-project-description]').value = item?.description || '';
    $('[data-project-help]').value = item?.helpRequested || '';
    $('[data-project-target]').value = item?.target || '';
    $('[data-project-official]').value = item?.official ? 'true' : 'false';
    $('[data-project-delete]').hidden = !item;
    $('[data-project-form-status]').textContent = '';
    updateManagerFields();
    updateEditorLabels();
  }

  function closeEditor() {
    if (dirty && !confirm('Discard unsaved project changes?')) return;
    shell.hidden = true;
    document.body.classList.remove('project-editor-open');
    editing = null;
    dirty = false;
  }

  function updateManagerFields() {
    const manager = session && ['officer', 'site_admin'].includes(session.access);
    $('[data-project-kind-wrap]').hidden = !manager;
    $('[data-project-official-wrap]').hidden = !manager;
    if (!manager) $('[data-project-kind]').value = 'project';
  }

  function payload() {
    return {
      id: $('[data-project-id]').value || undefined,
      kind: $('[data-project-kind]').value,
      title: $('[data-project-title]').value,
      system: $('[data-project-system]').value,
      category: $('[data-project-category]').value,
      status: $('[data-project-status]').value,
      progress: Number($('[data-project-progress]').value) || 0,
      deadline: $('[data-project-deadline]').value,
      eventTime: $('[data-project-time]').value,
      eventType: $('[data-project-event-type]').value,
      official: $('[data-project-official]').value === 'true',
      description: $('[data-project-description]').value,
      helpRequested: $('[data-project-help]').value,
      target: $('[data-project-target]').value,
    };
  }

  async function save(event) {
    event.preventDefault();
    const target = $('[data-project-form-status]');
    target.textContent = 'Saving…';
    const body = payload();
    const method = editing ? 'PUT' : 'POST';
    const { response, payload: result } = await apiFetch('/api/projects', {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Mongrels-Request': 'projects-editor' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      target.textContent = result.error || 'Unable to save project.';
      return;
    }
    dirty = false;
    await load();
    shell.hidden = true;
    document.body.classList.remove('project-editor-open');
  }

  async function remove() {
    if (!editing || !confirm('Delete this project? This cannot be undone.')) return;
    const { response, payload: result } = await apiFetch(`/api/projects?id=${encodeURIComponent(editing.id)}`, {
      method: 'DELETE',
      headers: { 'X-Mongrels-Request': 'projects-editor' },
    });
    if (!response.ok) {
      $('[data-project-form-status]').textContent = result.error || 'Unable to delete project.';
      return;
    }
    dirty = false;
    await load();
    shell.hidden = true;
    document.body.classList.remove('project-editor-open');
  }


  function renderMemberFilter() {
    document.querySelector('[data-member-filter-banner]')?.remove();
    if (!memberFilter) return;
    const container = board.querySelector('.container');
    const anchor = container?.querySelector('.projects-toolbar-head');
    if (!container || !anchor) return;
    const banner = document.createElement('div');
    banner.className = 'member-filter-banner';
    banner.dataset.memberFilterBanner = '';
    banner.innerHTML = `<div><span>Member View</span><strong>${safe(memberFilter.name)}</strong><small>Showing this CMDR's Projects & Events posts.</small></div><a class="btn btn-ghost" href="../projects/">Show Everyone</a>`;
    container.insertBefore(banner, anchor);
  }

  async function load() {
    const memberQuery = memberParam ? `?member=${encodeURIComponent(memberParam)}` : '';
    const { response, payload } = await apiFetch(`/api/projects${memberQuery}`);
    if (!response.ok) {
      grid.innerHTML = '<div class="data-empty-state"><span class="data-empty-icon">!</span><div><strong>Project board unavailable.</strong><p>The secure project service could not be reached.</p></div></div>';
      return;
    }
    session = payload.viewer;
    items = Array.isArray(payload.items) ? payload.items : [];
    memberFilter = payload.memberFilter || null;
    if (memberParam && memberFilter && !window.__memberProjectFilterHandled) { filter = 'all'; window.__memberProjectFilterHandled = true; document.querySelectorAll('[data-project-filter]').forEach(x => x.classList.remove('active')); }
    renderMemberFilter();
    signedOut.hidden = true;
    board.hidden = false;
    render();
    const params = new URLSearchParams(location.search);
    if (!window.__projectViewHandled && params.get('view') === 'events') {
      window.__projectViewHandled = true;
      filter = 'events';
      document.querySelectorAll('[data-project-filter]').forEach(x => x.classList.toggle('active', x.dataset.projectFilter === 'events'));
      render();
    }
    if (!window.__projectPrefillHandled && params.get('create') === 'event' && ['officer','site_admin'].includes(session.access)) {
      window.__projectPrefillHandled = true;
      openEditor();
      $('[data-project-kind]').value = 'event';
      $('[data-project-category]').value = params.get('category') || 'PvP';
      $('[data-project-event-type]').value = params.get('eventType') || 'Training';
      updateEditorLabels();
    }
  }

  document.querySelectorAll('[data-project-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-project-filter]').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    filter = button.dataset.projectFilter;
    render();
  }));

  document.querySelectorAll('[data-project-create]').forEach(button => button.addEventListener('click', () => openEditor()));
  document.querySelectorAll('[data-project-cancel]').forEach(button => button.addEventListener('click', closeEditor));
  form?.addEventListener('submit', save);
  form?.addEventListener('input', () => { dirty = true; });
  $('[data-project-kind]')?.addEventListener('change', () => { dirty = true; updateEditorLabels(); });
  $('[data-project-delete]')?.addEventListener('click', remove);

  window.addEventListener('beforeunload', event => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  apiFetch('/api/auth/session').then(({ response, payload }) => {
    if (response.ok && payload.authenticated && ['member', 'officer', 'site_admin'].includes(payload.access)) {
      session = payload;
      load();
    } else {
      signedOut.hidden = false;
      board.hidden = true;
    }
  }).catch(() => {});
})();
