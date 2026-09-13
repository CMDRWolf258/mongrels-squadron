(() => {
  const dashboard = document.querySelector('[data-auth-profile]');
  if (!dashboard) return;

  const officerPanel = document.querySelector('[data-dashboard-officer]');
  const memberNote = document.querySelector('[data-dashboard-member-note]');
  const count = document.querySelector('[data-dashboard-orders-count]');
  const summary = document.querySelector('[data-dashboard-orders-summary]');
  const preview = document.querySelector('[data-dashboard-orders-preview]');
  const projectCount = document.querySelector('[data-dashboard-projects-count]');
  const projectSummary = document.querySelector('[data-dashboard-projects-summary]');
  const projectPreview = document.querySelector('[data-dashboard-projects-preview]');

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


  const renderProjects = payload => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const active = items.filter(item => item.status !== 'complete');
    if (projectCount) projectCount.textContent = active.length ? `${active.length} Active` : 'No Active Posts';
    if (projectSummary) projectSummary.textContent = active.length ? 'Active projects, help requests, and squad events are waiting on the board.' : 'No active member projects or squad events are posted right now.';
    if (!projectPreview) return; projectPreview.replaceChildren();
    active.slice(0,2).forEach(item => { const row=document.createElement('div'); row.className='member-order-preview-row'; const meta=document.createElement('span'); meta.textContent=[item.kind==='event'?'Event':item.category,item.system].filter(Boolean).join(' · '); const title=document.createElement('strong'); title.textContent=item.title; row.append(meta,title); projectPreview.appendChild(row); });
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

      const [ordersResult, projectsResult] = await Promise.all([fetchJson('/api/operations/orders'), fetchJson('/api/projects')]);
      if (ordersResult.response.ok) renderOrders(ordersResult.payload); else renderUnavailable();
      if (projectsResult.response.ok) renderProjects(projectsResult.payload);
    } catch (error) {
      console.error('Could not load member dashboard', error);
      renderUnavailable();
    }
  };

  init();
})();
