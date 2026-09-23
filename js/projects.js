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
  let lastBoardSignature = '';
  let backgroundRefreshRunning = false;
  const BACKGROUND_REFRESH_MS = 5000;

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
    planning: 'Planning', active: 'Active', paused: 'Paused', cancelled: 'Cancelled', complete: 'Complete'
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

  const eventClosed = item => ['cancelled','complete'].includes(item?.status);

  const rsvpLabel = status => ({
    going: 'Going',
    maybe: 'Maybe',
    cant: 'Can’t Make It',
  }[status] || '');

  function eventRsvpMarkup(item) {
    if (item.kind !== 'event' || !item.rsvp) return '';
    const counts = item.rsvp.counts || {};
    const roster = item.rsvp.roster || {};
    const current = item.rsvp.current || '';
    const open = Boolean(item.rsvp.open);
    const rosterLines = [
      ['Going', roster.going || []],
      ['Maybe', roster.maybe || []],
      ['Can’t Make It', roster.cant || []],
    ].filter(([,names]) => names.length).map(([label,names]) =>
      `<div class="project-rsvp-roster-line"><strong>${safe(label)}:</strong> ${safe(names.join(', '))}</div>`
    ).join('');

    return `
      <div class="project-rsvp" data-event-rsvp="${safe(item.id)}">
        <div class="project-rsvp-head"><strong>RSVP</strong><span>${open ? 'Open' : 'Closed'}${current ? ` · You: ${safe(rsvpLabel(current))}` : ''}</span></div>
        <div class="project-rsvp-counts">
          <span>✅ Going <b>${Number(counts.going)||0}</b></span>
          <span>🤔 Maybe <b>${Number(counts.maybe)||0}</b></span>
          <span>❌ Can’t Make It <b>${Number(counts.cant)||0}</b></span>
        </div>
        <div class="project-rsvp-actions">
          <button type="button" class="project-rsvp-button${current==='going'?' is-selected':''}" data-event-rsvp-choice="going" ${open?'':'disabled'}>✅ Going</button>
          <button type="button" class="project-rsvp-button${current==='maybe'?' is-selected':''}" data-event-rsvp-choice="maybe" ${open?'':'disabled'}>🤔 Maybe</button>
          <button type="button" class="project-rsvp-button${current==='cant'?' is-selected':''}" data-event-rsvp-choice="cant" ${open?'':'disabled'}>❌ Can’t Make It</button>
        </div>
        ${rosterLines ? `<details class="project-rsvp-roster"><summary>View RSVP roster</summary><div class="project-rsvp-roster-grid">${rosterLines}</div></details>` : ''}
      </div>`;
  }

  async function setEventRsvp(item, status, button) {
    if (!item?.id || !item?.rsvp?.open) return;
    const buttons = button?.closest('[data-event-rsvp]')?.querySelectorAll('button') || [];
    buttons.forEach(x => x.disabled = true);
    try {
      const { response, payload } = await apiFetch('/api/projects/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mongrels-Request': 'project-event-rsvp',
        },
        body: JSON.stringify({ id: item.id, status }),
      });
      if (!response.ok) {
        alert(payload.error === 'event_rsvp_closed' ? 'This event is no longer accepting RSVPs.' : (payload.error || 'Unable to update RSVP.'));
        await load();
        return;
      }
      await load();
    } catch {
      alert('Unable to update RSVP right now.');
      buttons.forEach(x => x.disabled = false);
    }
  }

  function sortProjects(list) {
    return list.sort((a, b) => {
      if (filter === 'events') return eventDate(a) - eventDate(b) || timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (filter === 'official') return timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (filter === 'mine') return eventClosed(a) - eventClosed(b) || timestamp(b.updatedAt) - timestamp(a.updatedAt);
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
      if (filter === 'archive') return ['complete','cancelled'].includes(item.status);
      if (filter === 'events') return item.kind === 'event' && !eventClosed(item);
      if (filter === 'member') return item.kind === 'project' && !item.official && item.status !== 'complete';
      if (filter === 'official') return item.kind === 'project' && item.official && item.status !== 'complete';
      return item.kind === 'project' && item.status !== 'complete';
    });
    return sortProjects(list);
  }

  function render() {
    const active = items.filter(i => i.kind === 'project' && i.status !== 'complete').length;
    const events = items.filter(i => i.kind === 'event' && !eventClosed(i)).length;
    const mine = items.filter(i => i.isMine && !eventClosed(i)).length;
    const archive = items.filter(i => ['complete','cancelled'].includes(i.status)).length;

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
      card.id = item.kind === 'event' ? `event-${item.id}` : `project-${item.id}`;
      if (item.kind === 'event') card.dataset.eventStatus = item.status || 'active';

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
      const eventImage = item.kind === 'event' && item.eventImageUrl
        ? `<div class="project-event-image"><img src="${safe(item.eventImageUrl)}" alt="Event image for ${safe(item.title)}" loading="lazy" referrerpolicy="no-referrer"></div>`
        : '';

      const rsvp = eventRsvpMarkup(item);
      const eventDiscord = item.kind === 'event' && item.canEdit
        ? `<div class="project-event-discord${item.eventDiscord?.lastError ? ' warning' : ''}">${item.eventDiscord?.lastError
          ? `Discord sync needs attention: ${safe(item.eventDiscord.lastError)}`
          : item.eventDiscord?.linked
            ? `Discord event card synced${item.eventDiscord.lastSyncedAt ? ` · ${safe(new Date(item.eventDiscord.lastSyncedAt).toLocaleString())}` : ''}`
            : 'Discord event card not yet published'}</div>`
        : '';

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
        ${eventImage}
        ${help}
        ${target}
        ${progress}
        ${rsvp}
        ${eventDiscord}
        <div class="project-card-meta"><span>Posted by <strong>${safe(item.ownerName)}</strong></span></div>`;

      card.querySelector('[data-copy-system]')?.addEventListener('click', e => copyText(item.system, e.currentTarget));
      card.querySelector('.project-edit-btn')?.addEventListener('click', () => openEditor(item));
      card.querySelectorAll('[data-event-rsvp-choice]').forEach(button => {
        button.addEventListener('click', () => setEventRsvp(item, button.dataset.eventRsvpChoice, button));
      });
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
    $('[data-project-image-wrap]').hidden = !isEvent;
    const cancelledOption = document.querySelector('[data-event-status-only]');
    if (cancelledOption) {
      cancelledOption.hidden = !isEvent;
      cancelledOption.disabled = !isEvent;
      if (!isEvent && $('[data-project-status]').value === 'cancelled') $('[data-project-status]').value = 'active';
    }
    if (!editing) $('[data-project-form-title]').textContent = isEvent ? 'New Event' : 'New Project';
    const submit = $('[data-project-submit]'); if (submit) submit.textContent = isEvent ? 'Save Event' : 'Save Project';
  }

  function openEditor(item = null) {
    editing = item;
    dirty = false;
    shell.hidden = false;
    document.body.classList.add('project-editor-open');
    $('[data-project-form-title]').textContent = item ? (item.kind === 'event' ? 'Edit Event' : 'Edit Project') : 'New Project';
    $('[data-project-id]').value = item?.id || '';
    $('[data-project-kind]').value = item?.kind || 'project';
    $('[data-project-kind]').disabled = Boolean(item);
    $('[data-project-title]').value = item?.title || '';
    $('[data-project-system]').value = item?.system || '';
    $('[data-project-category]').value = item?.category || 'Colonization';
    $('[data-project-status]').value = item?.status || 'active';
    $('[data-project-progress]').value = item?.progress ?? 0;
    $('[data-project-deadline]').value = item?.deadline || '';
    $('[data-project-time]').value = item?.eventTime || '';
    $('[data-project-event-type]').value = item?.eventType || 'Training';
    $('[data-project-image-url]').value = item?.eventImageUrl || '';
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
    $('[data-project-kind]').disabled = false;
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
      eventImageUrl: $('[data-project-image-url]').value,
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
      const errors = {
        published_event_must_be_cancelled_or_completed: 'Published events must be cancelled or completed instead of deleted.',
      };
      target.textContent = errors[result.error] || result.error || 'Unable to save project.';
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
      const errors = {
        published_event_must_be_cancelled_or_completed: 'This event has Discord history. Mark it Cancelled or Complete instead of deleting it.',
      };
      $('[data-project-form-status]').textContent = errors[result.error] || result.error || 'Unable to delete project.';
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

  function boardSignature(nextItems, nextMemberFilter) {
    return JSON.stringify({
      items: Array.isArray(nextItems) ? nextItems : [],
      memberFilter: nextMemberFilter || null,
    });
  }

  async function refreshBoardQuietly() {
    if (backgroundRefreshRunning || document.hidden || dirty || (shell && !shell.hidden) || !session) return;
    backgroundRefreshRunning = true;
    try {
      const memberQuery = memberParam ? `?member=${encodeURIComponent(memberParam)}` : '';
      const { response, payload } = await apiFetch(`/api/projects${memberQuery}`);
      if (!response.ok) return;

      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      const nextMemberFilter = payload.memberFilter || null;
      const nextSignature = boardSignature(nextItems, nextMemberFilter);
      if (nextSignature === lastBoardSignature) return;

      const openRosters = new Set(
        [...document.querySelectorAll('.project-rsvp-roster[open]')]
          .map(details => details.closest('[data-event-rsvp]')?.dataset?.eventRsvp)
          .filter(Boolean)
      );

      items = nextItems;
      memberFilter = nextMemberFilter;
      lastBoardSignature = nextSignature;
      renderMemberFilter();
      render();

      openRosters.forEach(id => {
        document.querySelector(`[data-event-rsvp="${CSS.escape(id)}"] .project-rsvp-roster`)?.setAttribute('open','');
      });
    } catch {
      // Background freshness is best-effort; the normal board remains usable.
    } finally {
      backgroundRefreshRunning = false;
    }
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
    lastBoardSignature = boardSignature(items, memberFilter);
    if (memberParam && memberFilter && !window.__memberProjectFilterHandled) { filter = 'all'; window.__memberProjectFilterHandled = true; document.querySelectorAll('[data-project-filter]').forEach(x => x.classList.remove('active')); }
    renderMemberFilter();
    signedOut.hidden = true;
    board.hidden = false;
    render();
    if (memberParam && memberFilter && !window.__memberProjectAnchorHandled) { window.__memberProjectAnchorHandled = true; requestAnimationFrame(() => document.getElementById('project-list')?.scrollIntoView({block:'start'})); }
    const params = new URLSearchParams(location.search);
    if (!window.__projectViewHandled && params.get('view') === 'events') {
      window.__projectViewHandled = true;
      filter = 'events';
      document.querySelectorAll('[data-project-filter]').forEach(x => x.classList.toggle('active', x.dataset.projectFilter === 'events'));
      render();
    }
    if (!window.__projectHashHandled && location.hash && /^#(?:event|project)-/.test(location.hash)) {
      window.__projectHashHandled = true;
      requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({block:'center'}));
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

  window.setInterval(refreshBoardQuietly, BACKGROUND_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshBoardQuietly();
  });
})();
