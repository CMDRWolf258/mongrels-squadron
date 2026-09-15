(() => {
  const gate = document.querySelector('[data-review-gate]');
  const gateStatus = document.querySelector('[data-review-gate-status]');
  const board = document.querySelector('[data-review-board]');
  const list = document.querySelector('[data-review-list]');
  const filter = document.querySelector('[data-review-filter]');
  const count = document.querySelector('[data-review-count]');
  let applications = [];

  if (!gate || !board || !list) return;
  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const dateLabel = value => { const d = value ? new Date(value) : null; return !d || Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(d); };
  const statusLabel = status => ({ submitted:'Submitted', under_review:'Under Review', accepted:'Accepted', declined:'Declined' }[status] || status || 'Unknown');
  const answer = (label, value, wide = false) => { const display = Array.isArray(value) ? (value.length ? value.join(', ') : '—') : (value || '—'); return `<div class="application-answer${wide ? ' wide' : ''}"><span>${esc(label)}</span><p>${esc(display)}</p></div>`; };

  function visibleApplications() {
    const mode = filter?.value || 'active';
    if (mode === 'all') return applications;
    if (mode === 'active') return applications.filter(app => ['submitted','under_review'].includes(app.status));
    return applications.filter(app => app.status === mode);
  }

  function render() {
    const rows = visibleApplications();
    if (count) count.textContent = `${rows.length} application${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      list.innerHTML = '<div class="application-review-card"><strong>No applications in this view.</strong><p class="muted">New submitted applications will appear here automatically.</p></div>';
      return;
    }
    list.innerHTML = rows.map(app => {
      const a = app.answers || {};
      return `<article class="application-review-card" data-application-id="${esc(app.id)}">
        <div class="application-review-head"><div><p class="eyebrow">${esc(statusLabel(app.status))}</p><h2>${esc(a.commanderName || 'Unnamed Commander')}</h2><div class="application-review-meta"><span>Discord: ${esc(app.ownerName || 'Unknown')}${app.discordUsername ? ` · @${esc(app.discordUsername)}` : ''}</span><span>Submitted: ${esc(dateLabel(app.submittedAt))}</span>${app.reviewedBy ? `<span>Reviewed by: ${esc(app.reviewedBy)}</span>` : ''}</div></div><span class="application-status-badge ${esc(app.status)}">${esc(statusLabel(app.status))}</span></div>
        <details><summary>View application answers</summary><div class="application-answer-grid">
          ${answer('Experience', a.experience)}${answer('Time Zone', a.timezone)}${answer('Usually Active', a.activeTimes)}${answer('Found Us Through', [a.discoverySource, a.discoveryDetail].filter(Boolean).join(' — '))}
          ${answer('Current Activities', a.currentActivities, true)}${answer('Want to Learn / Do More', a.learnActivities, true)}${answer('PvP Experience', a.pvpExperience)}${answer('Discord Voice', a.voiceComfort)}
          ${answer('Open Play', a.openPlay)}${answer('BGS in Open Acknowledged', a.bgsOpenAcknowledged ? 'Yes' : 'No')}${answer('Why the Mongrels?', a.interestReason, true)}${answer('Looking for from a Squadron', a.squadGoals, true)}${answer('Anything Else', a.additionalInfo, true)}${answer('Final Rules Acknowledgement', a.rulesAcknowledged ? 'Yes' : 'No')}
        </div></details>
        <label class="application-note"><span>Private Officer Notes</span><textarea rows="3" maxlength="4000" data-officer-notes placeholder="Visible only to Officers and Site Admin.">${esc(app.officerNotes || '')}</textarea></label>
        <div class="application-review-actions"><button class="btn btn-ghost" type="button" data-review-action="${esc(app.status)}">Save Note</button>${app.status !== 'under_review' ? '<button class="btn btn-ghost" type="button" data-review-action="under_review">Mark Under Review</button>' : ''}${app.status !== 'accepted' ? '<button class="btn btn-primary" type="button" data-review-action="accepted">Accept</button>' : ''}${app.status !== 'declined' ? '<button class="btn btn-ghost" type="button" data-review-action="declined">Decline</button>' : ''}<span class="application-save-status" data-card-status></span></div>
      </article>`;
    }).join('');
  }

  async function updateApplication(card, status) {
    const id = card.dataset.applicationId;
    const notes = card.querySelector('[data-officer-notes]')?.value || '';
    const state = card.querySelector('[data-card-status]');
    const buttons = [...card.querySelectorAll('button[data-review-action]')];
    buttons.forEach(button => { button.disabled = true; });
    if (state) { state.textContent = 'Saving…'; state.dataset.state = ''; }
    try {
      const response = await fetch('/api/applications', {
        method:'PUT', credentials:'same-origin', cache:'no-store',
        headers:{ Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'application-review' },
        body:JSON.stringify({ id, status, officerNotes:notes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Save failed (${response.status})`);
      const index = applications.findIndex(app => app.id === id);
      if (index >= 0) applications[index] = data.application;
      render();
    } catch (error) {
      console.error('Application review save failed', error);
      if (state) { state.textContent = 'Could not save. Try again.'; state.dataset.state = 'error'; }
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-review-action]');
    if (!button) return;
    const card = button.closest('[data-application-id]');
    if (card) updateApplication(card, button.dataset.reviewAction);
  });
  filter?.addEventListener('change', render);

  async function load() {
    try {
      const response = await fetch('/api/applications', { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { if (gateStatus) gateStatus.textContent = 'Officer sign-in required.'; return; }
      if (response.status === 403 || !data.canReview) { if (gateStatus) gateStatus.textContent = 'This page is restricted to Mongrel Officers and the Site Admin.'; return; }
      if (!response.ok) throw new Error(data.error || `Load failed (${response.status})`);
      applications = Array.isArray(data.applications) ? data.applications : [];
      gate.hidden = true; board.hidden = false; render();
    } catch (error) {
      console.error('Applications load failed', error);
      if (gateStatus) gateStatus.textContent = 'Recruitment applications could not be loaded. Please try again.';
    }
  }
  load();
})();