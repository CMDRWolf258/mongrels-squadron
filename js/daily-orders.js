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
  const management = section.querySelector('[data-orders-management]');

  const setView = view => {
    if (locked) locked.hidden = view !== 'locked';
    if (loading) loading.hidden = view !== 'loading';
    if (memberPanel) memberPanel.hidden = view !== 'member';
  };

  const escapeText = value => String(value == null ? '' : value);

  const renderOrders = payload => {
    if (title) title.textContent = payload.title || 'Squadron Daily Orders';
    if (briefing) briefing.textContent = payload.briefing || '';

    if (meta) {
      const bits = [];
      if (payload.updatedAt) bits.push(`Updated ${payload.updatedAt}`);
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

          const heading = document.createElement('h3');
          heading.textContent = escapeText(order.task || 'Operational task');
          const detail = document.createElement('p');
          detail.textContent = escapeText(order.detail || '');

          card.append(top, heading);
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

    if (management) management.hidden = !payload.canManage;
    setView('member');
  };

  const load = async () => {
    setView('loading');

    try {
      const response = await fetch(`/api/operations/orders?_=${Date.now()}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        setView('locked');
        return;
      }

      if (!response.ok) throw new Error(`Orders request failed (${response.status})`);
      renderOrders(await response.json());
    } catch (error) {
      console.error('Could not load private Daily Orders', error);
      setView('locked');
      const detail = locked?.querySelector('[data-orders-lock-detail]');
      if (detail) detail.textContent = 'The private orders service could not be reached. Public operations data remains available.';
    }
  };

  load();
})();
