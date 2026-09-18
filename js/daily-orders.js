(() => {
  const section = document.querySelector('[data-daily-orders]');
  if (!section) return;

  const locked = section.querySelector('[data-orders-locked]');
  const loading = section.querySelector('[data-orders-loading]');
  const memberPanel = section.querySelector('[data-orders-member]');
  const title = section.querySelector('[data-orders-title]');
  const briefing = section.querySelector('[data-orders-briefing]');
  const list = section.querySelector('[data-orders-list]');
  const meta = section.querySelector('[data-orders-meta]');
  const officerNote = section.querySelector('[data-orders-officer-note]');
  const officerNoteText = section.querySelector('[data-orders-officer-note-text]');

  const manager = section.querySelector('[data-orders-manager]');
  const editor = section.querySelector('[data-orders-editor]');
  const editorToggle = section.querySelector('[data-orders-editor-toggle]');
  const editTitle = section.querySelector('[data-orders-edit-title]');
  const editBriefing = section.querySelector('[data-orders-edit-briefing]');
  const editNote = section.querySelector('[data-orders-edit-note]');
  const editorList = section.querySelector('[data-orders-editor-list]');
  const addButton = section.querySelector('[data-orders-add]');
  const clearButton = section.querySelector('[data-orders-clear]');
  const saveButton = section.querySelector('[data-orders-save]');
  const editorStatus = section.querySelector('[data-orders-editor-status]');

  let currentPayload = null;
  let editorBaseline = '';
  let editorDirty = false;

  const setView = view => {
    if (locked) locked.hidden = view !== 'locked';
    if (loading) loading.hidden = view !== 'loading';
    if (memberPanel) memberPanel.hidden = view !== 'member';
  };

  const activeOrderCount = orders => (Array.isArray(orders) ? orders : []).filter(order => {
    const status = String(order?.status || '').trim().toLowerCase();
    return !['complete', 'completed', 'closed', 'cancelled', 'canceled', 'inactive'].includes(status);
  }).length;

  const announceOrders = payload => {
    window.dispatchEvent(new CustomEvent('mongrels:orders-loaded', {
      detail: {
        authenticated: Boolean(payload),
        activeCount: payload ? activeOrderCount(payload.orders) : null,
      },
    }));
  };

  const escapeText = value => String(value == null ? '' : value);

  const copyText = async value => {
    const text = String(value || '');
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand('copy');
    fallback.remove();
    return copied;
  };

  const formatUpdated = value => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const renderOrders = payload => {
    currentPayload = payload;
    announceOrders(payload);

    if (title) title.textContent = payload.title || 'Squadron Daily Orders';
    if (briefing) briefing.textContent = payload.briefing || '';

    if (meta) {
      const bits = [];
      if (payload.updatedAt) bits.push(`Updated ${formatUpdated(payload.updatedAt)}`);
      if (payload.updatedBy) bits.push(`by ${payload.updatedBy}`);
      if (payload.viewer?.displayName) bits.push(`Viewing as ${payload.viewer.displayName}`);
      meta.textContent = bits.join(' · ') || 'Authenticated Mongrel member view';
    }

    if (list) {
      list.replaceChildren();
      const orders = Array.isArray(payload.orders) ? payload.orders : [];

      if (!orders.length) {
        const empty = document.createElement('div');
        empty.className = 'private-order-empty';
        empty.innerHTML = '<strong>No active tasking.</strong><span>Leadership has not posted any operational orders for this cycle.</span>';
        list.appendChild(empty);
      } else {
        orders.forEach((order, index) => {
          const card = document.createElement('article');
          card.className = 'private-order-item';

          const top = document.createElement('div');
          top.className = 'private-order-item-top';

          const number = document.createElement('span');
          number.className = 'private-order-number';
          number.textContent = String(index + 1).padStart(2, '0');
          top.appendChild(number);

          if (order.priority) {
            const priority = document.createElement('span');
            priority.className = 'private-order-priority';
            priority.textContent = escapeText(order.priority);
            top.appendChild(priority);
          }

          if (order.status) {
            const status = document.createElement('span');
            status.className = 'private-order-status';
            status.textContent = escapeText(order.status);
            top.appendChild(status);
          }

          if (order.system) {
            const systemRow = document.createElement('div');
            systemRow.className = 'private-order-system';

            const systemLabel = document.createElement('span');
            systemLabel.className = 'private-order-system-label';
            systemLabel.textContent = 'System';

            const systemName = document.createElement('strong');
            systemName.textContent = escapeText(order.system);

            const copyButton = document.createElement('button');
            copyButton.type = 'button';
            copyButton.className = 'system-copy-button';
            copyButton.setAttribute('aria-label', `Copy system name ${order.system}`);
            copyButton.title = 'Copy system name';
            copyButton.textContent = '⧉';

            const copyFeedback = document.createElement('span');
            copyFeedback.className = 'system-copy-feedback';
            copyFeedback.setAttribute('aria-live', 'polite');

            copyButton.addEventListener('click', async () => {
              const copied = await copyText(order.system);
              copyFeedback.textContent = copied ? 'Copied' : 'Copy failed';
              window.setTimeout(() => { copyFeedback.textContent = ''; }, 1400);
            });

            systemRow.append(systemLabel, systemName, copyButton, copyFeedback);
            card.appendChild(systemRow);
          }

          const heading = document.createElement('h3');
          heading.textContent = escapeText(order.task || 'Operational task');
          const detail = document.createElement('p');
          detail.textContent = escapeText(order.detail || '');

          card.prepend(top);
          card.appendChild(heading);
          if (order.detail) card.appendChild(detail);
          list.appendChild(card);
        });
      }
    }

    if (officerNote) {
      const hasNote = Boolean(payload.officerNote);
      officerNote.hidden = !hasNote;
      if (hasNote && officerNoteText) officerNoteText.textContent = payload.officerNote;
    }

    if (manager) manager.hidden = !payload.canManage;
    if (payload.canManage) populateEditor(payload);

    setView('member');
  };

  const createOrderEditor = order => {
    const card = document.createElement('div');
    card.className = 'orders-editor-item';
    card.dataset.orderId = order?.id || '';
    card.dataset.orderReporting = JSON.stringify(order?.reporting || {});
    card.dataset.orderFaction = order?.faction || '';
    card.dataset.orderKind = order?.kind || '';
    card.dataset.orderSource = order?.source || '';

    const system = makeField('System', 'text', order?.system || '', 120, 'NGC 2546 Sector UZ-G d10-16');
    system.classList.add('orders-editor-field-wide');

    const row = document.createElement('div');
    row.className = 'orders-editor-item-row';

    row.append(
      makeField('Priority', 'text', order?.priority || '', 40, 'Primary'),
      makeField('Status', 'text', order?.status || '', 60, 'Active'),
    );

    const task = makeField('Task', 'text', order?.task || '', 220, 'Complete 30 INF for The Consortium');
    task.classList.add('orders-editor-field-wide');

    const detail = document.createElement('label');
    detail.className = 'orders-editor-field-wide';
    const detailLabel = document.createElement('span');
    detailLabel.textContent = 'Details / stop conditions';
    const detailInput = document.createElement('textarea');
    detailInput.rows = 3;
    detailInput.maxLength = 900;
    detailInput.placeholder = 'Support/avoid instructions, reward choices, quantities, stop conditions, or other details.';
    detailInput.value = order?.detail || '';
    detailInput.dataset.orderField = 'detail';
    detail.append(detailLabel, detailInput);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'orders-editor-remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      card.remove();
      refreshDirtyState();
    });

    card.append(system, row, task, detail, remove);
    return card;
  };

  const makeField = (labelText, type, value, maxLength, placeholder) => {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    input.maxLength = maxLength;
    input.placeholder = placeholder;
    input.value = value;
    input.dataset.orderField = labelText.toLowerCase();
    label.append(span, input);
    return label;
  };

  const populateEditor = payload => {
    if (!editorList) return;
    if (editTitle) editTitle.value = payload.configured ? (payload.title || '') : 'Squadron Daily Orders';
    if (editBriefing) editBriefing.value = payload.configured ? (payload.briefing || '') : '';
    if (editNote) editNote.value = payload.officerNote || '';
    editorList.replaceChildren();
    const orders = Array.isArray(payload.orders) ? payload.orders : [];
    orders.forEach(order => editorList.appendChild(createOrderEditor(order)));
    editorBaseline = JSON.stringify(collectEditorPayload());
    editorDirty = false;
  };

  const collectEditorPayload = () => {
    const orders = [...editorList.querySelectorAll('.orders-editor-item')]
      .map((card, index) => {
        const value = field => card.querySelector(`[data-order-field="${field}"]`)?.value?.trim() || '';
        return {
          id: card.dataset.orderId || `order-${index + 1}`,
          reporting: (() => { try { return JSON.parse(card.dataset.orderReporting || '{}'); } catch { return {}; } })(),
          faction: card.dataset.orderFaction || '',
          kind: card.dataset.orderKind || '',
          source: card.dataset.orderSource || '',
          system: value('system'),
          priority: value('priority'),
          task: value('task'),
          detail: value('detail'),
          status: value('status'),
        };
      })
      .filter(order => order.task);

    return {
      cycleId: currentPayload?.cycleId || '',
      title: editTitle?.value?.trim() || 'Squadron Daily Orders',
      briefing: editBriefing?.value?.trim() || '',
      officerNote: editNote?.value?.trim() || '',
      orders,
    };
  };

  const refreshDirtyState = () => {
    if (!editor || editor.hidden || !editorBaseline) return;
    editorDirty = JSON.stringify(collectEditorPayload()) !== editorBaseline;
  };

  const discardUnsavedChanges = () => {
    if (!editorDirty) return true;
    return window.confirm('Discard unpublished Daily Orders changes?');
  };

  const setEditorStatus = (message, state = '') => {
    if (!editorStatus) return;
    editorStatus.textContent = message;
    editorStatus.dataset.state = state;
  };

  const saveOrders = async event => {
    event.preventDefault();
    if (!currentPayload?.canManage) return;

    saveButton.disabled = true;
    clearButton.disabled = true;
    setEditorStatus('Publishing secure orders…', 'working');

    try {
      const response = await fetch('/api/operations/orders', {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Mongrels-Request': 'daily-orders-editor',
        },
        body: JSON.stringify(collectEditorPayload()),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Save failed (${response.status})`);

      renderOrders(payload);
      editorDirty = false;
      setEditorStatus('Orders published.', 'success');
      if (editor) editor.hidden = true;
      if (editorToggle) editorToggle.textContent = 'Edit Orders';
    } catch (error) {
      console.error('Could not publish Daily Orders', error);
      const message = error.message === 'orders_storage_not_configured'
        ? 'Cloudflare Daily Orders storage is not configured yet.'
        : 'Could not publish orders. Please try again.';
      setEditorStatus(message, 'error');
    } finally {
      saveButton.disabled = false;
      clearButton.disabled = false;
    }
  };

  const clearOrders = async () => {
    if (!currentPayload?.canManage) return;
    if (!window.confirm('Clear the currently published Daily Orders? Members will see “No Daily Orders Posted.”')) return;

    saveButton.disabled = true;
    clearButton.disabled = true;
    setEditorStatus('Clearing published orders…', 'working');

    try {
      const response = await fetch('/api/operations/orders', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'X-Mongrels-Request': 'daily-orders-editor',
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Clear failed (${response.status})`);
      renderOrders(payload);
      editorDirty = false;
      setEditorStatus('Published orders cleared.', 'success');
      if (editor) editor.hidden = true;
      if (editorToggle) editorToggle.textContent = 'Edit Orders';
    } catch (error) {
      console.error('Could not clear Daily Orders', error);
      setEditorStatus('Could not clear orders. Please try again.', 'error');
    } finally {
      saveButton.disabled = false;
      clearButton.disabled = false;
    }
  };

  editorToggle?.addEventListener('click', () => {
    if (!editor) return;
    const opening = editor.hidden;
    if (!opening && !discardUnsavedChanges()) return;
    editor.hidden = !opening;
    editorToggle.textContent = opening ? 'Close Editor' : 'Edit Orders';
    if (opening && currentPayload) populateEditor(currentPayload);
    if (!opening) editorDirty = false;
  });

  addButton?.addEventListener('click', () => {
    if (!editorList || editorList.children.length >= 24) return;
    editorList.appendChild(createOrderEditor({}));
    refreshDirtyState();
    editorList.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  editor?.addEventListener('submit', saveOrders);
  editor?.addEventListener('input', refreshDirtyState);
  editor?.addEventListener('change', refreshDirtyState);
  clearButton?.addEventListener('click', clearOrders);
  window.addEventListener('beforeunload', event => {
    if (!editorDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  const load = async () => {
    setView('loading');

    try {
      const response = await fetch(`/api/operations/orders?_=${Date.now()}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        announceOrders(null);
        setView('locked');
        return;
      }

      if (!response.ok) throw new Error(`Orders request failed (${response.status})`);
      renderOrders(await response.json());
    } catch (error) {
      console.error('Could not load private Daily Orders', error);
      announceOrders(null);
      setView('locked');
      const detail = locked?.querySelector('[data-orders-lock-detail]');
      if (detail) detail.textContent = 'The private orders service could not be reached. Mission Control remains restricted; please try again shortly.';
    }
  };

  load();
})();
