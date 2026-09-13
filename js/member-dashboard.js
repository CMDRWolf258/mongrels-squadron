(() => {
  const dashboard = document.querySelector('[data-auth-profile]');
  if (!dashboard) return;

  const officerPanel = document.querySelector('[data-dashboard-officer]');
  const memberNote = document.querySelector('[data-dashboard-member-note]');
  const count = document.querySelector('[data-dashboard-orders-count]');
  const summary = document.querySelector('[data-dashboard-orders-summary]');
  const preview = document.querySelector('[data-dashboard-orders-preview]');

  const fetchJson = url => fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  }).then(async response => ({ response, payload: await response.json().catch(() => ({})) }));

  const renderOrders = payload => {
    const orders = Array.isArray(payload?.orders) ? payload.orders : [];
    const active = orders.filter(order => String(order.status || '').toLowerCase() !== 'complete' && String(order.status || '').toLowerCase() !== 'completed');
    const visible = active.length ? active : orders;

    if (count) count.textContent = orders.length ? `${orders.length} ${orders.length === 1 ? 'Task' : 'Tasks'}` : 'No Tasking';
    if (summary) {
      summary.textContent = payload?.configured
        ? (payload.briefing || (orders.length ? 'Current squadron tasking is posted.' : 'A briefing is posted with no structured tasks.'))
        : 'No Daily Orders have been posted yet.';
    }

    if (!preview) return;
    preview.replaceChildren();

    visible.slice(0, 3).forEach(order => {
      const row = document.createElement('div');
      row.className = 'member-order-preview-row';
      const meta = document.createElement('span');
      meta.textContent = [order.priority, order.system].filter(Boolean).join(' · ') || 'Operational Task';
      const task = document.createElement('strong');
      task.textContent = order.task || 'Operational task';
      row.append(meta, task);
      preview.appendChild(row);
    });

    if (visible.length > 3) {
      const more = document.createElement('small');
      more.textContent = `+${visible.length - 3} more task${visible.length - 3 === 1 ? '' : 's'}`;
      preview.appendChild(more);
    }
  };

  const renderUnavailable = () => {
    if (count) count.textContent = 'Unavailable';
    if (summary) summary.textContent = 'The secure Daily Orders service could not be reached.';
  };

  const init = async () => {
    try {
      const { response, payload: session } = await fetchJson('/api/auth/session');
      if (!response.ok || !session.authenticated) return;

      const isOfficer = session.access === 'officer' || session.access === 'site_admin';
      if (officerPanel) officerPanel.hidden = !isOfficer;
      if (memberNote) memberNote.hidden = isOfficer;

      const ordersResult = await fetchJson('/api/operations/orders');
      if (ordersResult.response.ok) renderOrders(ordersResult.payload);
      else renderUnavailable();
    } catch (error) {
      console.error('Could not load member dashboard', error);
      renderUnavailable();
    }
  };

  init();
})();
