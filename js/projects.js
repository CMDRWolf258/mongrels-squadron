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
  let uploadedEventImageKey = '';
  let originalEventImageKey = '';
  let imageUploadBusy = false;
  const BACKGROUND_REFRESH_MS = 5000;
  const EVENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
  const EVENT_IMAGE_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
  const EVENT_IMAGE_TYPES = new Set(['image/png','image/jpeg','image/webp']);

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

  const setEventImageStatus = (message = '', isError = false) => {
    const target = $('[data-project-image-status]');
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('error', Boolean(isError));
  };

  function renderEventImageEditor(displayName = '') {
    const url = $('[data-project-image-url]')?.value?.trim() || '';
    const drop = $('[data-project-image-drop]');
    const emptyState = $('[data-project-image-empty]');
    const preview = $('[data-project-image-preview]');
    const image = $('[data-project-image-preview-img]');
    const name = $('[data-project-image-preview-name]');
    const remove = $('[data-project-image-remove]');
    if (!drop || !emptyState || !preview || !image || !remove) return;

    drop.classList.toggle('is-uploading', imageUploadBusy);
    emptyState.hidden = Boolean(url);
    preview.hidden = !url;
    remove.hidden = !url;
    if (url) {
      image.src = url;
      const fallbackName = (() => {
        try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'Event image'); }
        catch { return 'Event image'; }
      })();
      name.textContent = displayName || fallbackName;
    } else {
      image.removeAttribute('src');
      name.textContent = '';
    }
  }

  function loadBrowserImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read this image.'));
      };
      image.src = objectUrl;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to optimize this image.')), type, quality);
    });
  }

  async function prepareEventImage(file) {
    if (!file || !EVENT_IMAGE_TYPES.has(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.');
    if (file.size > EVENT_IMAGE_MAX_SOURCE_BYTES) throw new Error('That image is too large. Choose an image under 25 MB.');
    if (file.size <= EVENT_IMAGE_MAX_BYTES) return file;

    setEventImageStatus('Optimizing large image…');
    const image = await loadBrowserImage(file);
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d', { alpha: true }).drawImage(image, 0, 0, width, height);

    let blob = await canvasBlob(canvas, 'image/webp', .88);
    if (blob.size > EVENT_IMAGE_MAX_BYTES) blob = await canvasBlob(canvas, 'image/webp', .75);
    if (blob.size > EVENT_IMAGE_MAX_BYTES) throw new Error('The optimized image is still over 8 MB. Try a smaller image.');
    const base = String(file.name || 'event-image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'event-image';
    return new File([blob], `${base}.webp`, { type: 'image/webp' });
  }

  async function deleteTemporaryEventImage(key) {
    if (!key) return;
    try {
      await apiFetch('/api/projects/event-image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Mongrels-Request': 'project-event-image',
        },
        body: JSON.stringify({ key }),
      });
    } catch {}
  }

  async function uploadEventImage(file) {
    if (imageUploadBusy) return;
    imageUploadBusy = true;
    renderEventImageEditor();
    const choose = $('[data-project-image-choose]');
    const remove = $('[data-project-image-remove]');
    if (choose) choose.disabled = true;
    if (remove) remove.disabled = true;
    try {
      const uploadFile = await prepareEventImage(file);
      setEventImageStatus('Uploading image…');
      const formData = new FormData();
      formData.append('image', uploadFile, uploadFile.name);
      const { response, payload } = await apiFetch('/api/projects/event-image', {
        method: 'POST',
        headers: { 'X-Mongrels-Request': 'project-event-image' },
        body: formData,
      });
      if (!response.ok) {
        const errors = {
          event_image_storage_not_configured: 'Event image storage is not configured.',
          event_image_too_large: 'The optimized image is still too large.',
          unsupported_event_image_type: 'Choose a PNG, JPG, or WebP image.',
          event_manager_access_required: 'Only event creators can upload event images.',
        };
        throw new Error(errors[payload.error] || payload.error || 'Unable to upload image.');
      }

      const previousPending = uploadedEventImageKey;
      $('[data-project-image-key]').value = payload.key || '';
      $('[data-project-image-url]').value = payload.url || '';
      uploadedEventImageKey = payload.key || '';
      dirty = true;
      renderEventImageEditor(uploadFile.name);
      setEventImageStatus('Image ready');
      if (previousPending && previousPending !== uploadedEventImageKey) deleteTemporaryEventImage(previousPending);
    } catch (error) {
      setEventImageStatus(error?.message || 'Unable to upload image.', true);
    } finally {
      imageUploadBusy = false;
      if (choose) choose.disabled = false;
      if (remove) remove.disabled = false;
      const input = $('[data-project-image-file]');
      if (input) input.value = '';
      renderEventImageEditor();
    }
  }

  async function removeEventImage() {
    const keyInput = $('[data-project-image-key]');
    const urlInput = $('[data-project-image-url]');
    const key = keyInput?.value || '';
    if (key && key === uploadedEventImageKey) {
      await deleteTemporaryEventImage(key);
      uploadedEventImageKey = '';
    }
    if (keyInput) keyInput.value = '';
    if (urlInput) urlInput.value = '';
    dirty = true;
    setEventImageStatus('');
    renderEventImageEditor();
  }

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
    $('[data-project-image-key]').value = item?.eventImageKey || '';
    originalEventImageKey = item?.eventImageKey || '';
    uploadedEventImageKey = '';
    imageUploadBusy = false;
    setEventImageStatus('');
    renderEventImageEditor(item?.eventImageUrl ? 'Current event image' : '');
    $('[data-project-description]').value = item?.description || '';
    $('[data-project-help]').value = item?.helpRequested || '';
    $('[data-project-target]').value = item?.target || '';
    $('[data-project-official]').value = item?.official ? 'true' : 'false';
    $('[data-project-delete]').hidden = !item;
    $('[data-project-form-status]').textContent = '';
    updateManagerFields();
    updateEditorLabels();
  }

  async function closeEditor() {
    if (dirty && !confirm('Discard unsaved project changes?')) return;
    if (uploadedEventImageKey && uploadedEventImageKey !== originalEventImageKey) {
      await deleteTemporaryEventImage(uploadedEventImageKey);
    }
    uploadedEventImageKey = '';
    originalEventImageKey = '';
    imageUploadBusy = false;
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
      eventImageKey: $('[data-project-image-key]').value,
      official: $('[data-project-official]').value === 'true',
      description: $('[data-project-description]').value,
      helpRequested: $('[data-project-help]').value,
      target: $('[data-project-target]').value,
    };
  }

  async function save(event) {
    event.preventDefault();
    const target = $('[data-project-form-status]');
    if (imageUploadBusy) {
      target.textContent = 'Wait for the event image upload to finish.';
      return;
    }
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
    uploadedEventImageKey = '';
    originalEventImageKey = '';
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

  const imageDrop = $('[data-project-image-drop]');
  const imageFile = $('[data-project-image-file]');
  $('[data-project-image-choose]')?.addEventListener('click', () => {
    if (!imageUploadBusy) imageFile?.click();
  });
  imageDrop?.addEventListener('click', () => {
    if (!imageUploadBusy) imageFile?.click();
  });
  imageDrop?.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !imageUploadBusy) {
      event.preventDefault();
      imageFile?.click();
    }
  });
  imageDrop?.addEventListener('dragover', event => {
    event.preventDefault();
    if (!imageUploadBusy) imageDrop.classList.add('is-dragover');
  });
  imageDrop?.addEventListener('dragleave', () => imageDrop.classList.remove('is-dragover'));
  imageDrop?.addEventListener('drop', event => {
    event.preventDefault();
    imageDrop.classList.remove('is-dragover');
    if (!imageUploadBusy) uploadEventImage(event.dataTransfer?.files?.[0]);
  });
  imageFile?.addEventListener('change', () => {
    const file = imageFile.files?.[0];
    if (file) uploadEventImage(file);
  });
  $('[data-project-image-remove]')?.addEventListener('click', removeEventImage);
  $('[data-project-image-url]')?.addEventListener('change', async event => {
    const keyInput = $('[data-project-image-key]');
    const currentKey = keyInput?.value || '';
    if (currentKey && currentKey === uploadedEventImageKey) {
      await deleteTemporaryEventImage(currentKey);
      uploadedEventImageKey = '';
    }
    if (keyInput) keyInput.value = '';
    dirty = true;
    setEventImageStatus(event.currentTarget.value.trim() ? 'External image URL selected' : '');
    renderEventImageEditor('External event image');
  });

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
