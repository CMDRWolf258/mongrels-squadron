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
      const inGameReport = a.inGameApplicationSubmitted ? 'Applicant reports submitted' : 'Not recorded (legacy or exception)';
      const inGameAudit = app.inGameApplicationVerified
        ? `Verified${app.inGameApplicationVerifiedBy ? ` by ${esc(app.inGameApplicationVerifiedBy)}` : ''}${app.inGameApplicationVerifiedAt ? ` · ${esc(dateLabel(app.inGameApplicationVerifiedAt))}` : ''}`
        : (app.inGameRequirementOverridden ? 'Approved as an exception without verification' : 'Not yet verified');
      return `<article class="application-review-card" data-application-id="${esc(app.id)}">
        <div class="application-review-head"><div><p class="eyebrow">${esc(statusLabel(app.status))}</p><h2>${esc(a.commanderName || 'Unnamed Commander')}</h2><div class="application-review-meta"><span>Discord: ${esc(app.ownerName || 'Unknown')}${app.discordUsername ? ` · @${esc(app.discordUsername)}` : ''}</span><span>Submitted: ${esc(dateLabel(app.submittedAt))}</span>${app.reviewedBy ? `<span>Reviewed by: ${esc(app.reviewedBy)}</span>` : ''}${app.status === 'accepted' && app.acceptedAt ? `<span>Accepted: ${esc(dateLabel(app.acceptedAt))}</span>` : ''}</div></div><span class="application-status-badge ${esc(app.status)}">${esc(statusLabel(app.status))}</span></div>
        <details><summary>View application answers</summary><div class="application-answer-grid">
          ${answer('In-game Squadron Application', inGameReport)}${answer('Experience', a.experience)}${answer('Time Zone', a.timezone)}${answer('Usually Active', a.activeTimes)}${answer('Found Us Through', [a.discoverySource, a.discoveryDetail].filter(Boolean).join(' — '))}
          ${answer('Current Activities', a.currentActivities, true)}${answer('Want to Learn / Do More', a.learnActivities, true)}${answer('PvP Experience', a.pvpExperience)}${answer('Discord Voice', a.voiceComfort)}
          ${answer('Open Play', a.openPlay)}${answer('BGS in Open Acknowledged', a.bgsOpenAcknowledged ? 'Yes' : 'No')}${answer('Why the Mongrels?', a.interestReason, true)}${answer('Looking for from a Squadron', a.squadGoals, true)}${answer('Anything Else', a.additionalInfo, true)}${answer('Final Rules Acknowledgement', a.rulesAcknowledged ? 'Yes' : 'No')}
        </div></details>
        <div class="application-expectations">
          <strong>In-Game Squadron Application</strong>
          <p>${inGameAudit}</p>
          <label class="application-choice"><input type="checkbox" data-in-game-verified ${app.inGameApplicationVerified ? 'checked' : ''}><span>I confirmed this Commander appears in Elite's Squadron applicant list.</span></label>
          <small>Normally verify the in-game application before approval. Website approval grants Discord/site access but cannot accept the Elite Dangerous Squadron application for you. After leadership accepts it in-game, the applicant must return to Squadrons and confirm the acceptance / choose Join Squadron before they actually enter the in-game squad.</small>
        </div>
        <label class="application-note"><span>Private Officer Notes</span><textarea rows="3" maxlength="4000" data-officer-notes placeholder="Visible only to Officers and Site Admin.">${esc(app.officerNotes || '')}</textarea></label>
        <div class="application-review-actions"><button class="btn btn-ghost" type="button" data-review-action="${esc(app.status)}">Save Note / Verification</button>${app.status !== 'under_review' ? '<button class="btn btn-ghost" type="button" data-review-action="under_review">Mark Under Review</button>' : ''}${app.status !== 'accepted' ? '<button class="btn btn-primary" type="button" data-review-action="accepted">Approve & Grant Member Access</button>' : ''}${app.status !== 'declined' ? '<button class="btn btn-ghost" type="button" data-review-action="declined">Decline</button>' : ''}<span class="application-save-status" data-card-status></span></div>
      </article>`;
    }).join('');
  }

  async function updateApplication(card, status) {
    const id = card.dataset.applicationId;
    const current = applications.find(app => app.id === id);
    const commander = current?.answers?.commanderName || 'this Commander';
    const newlyAccepted = status === 'accepted' && current?.status !== 'accepted';
    const inGameVerified = Boolean(card.querySelector('[data-in-game-verified]')?.checked || current?.inGameApplicationVerified);
    let overrideInGameRequirement = false;

    if (newlyAccepted && !inGameVerified) {
      const exceptionApproved = window.confirm(
        `IN-GAME APPLICATION NOT VERIFIED\n\n${commander} has not been marked as verified in Elite's Squadron applicant list. Mongrel applications should normally not be approved until the in-game application is present.\n\nApprove anyway as an exception?`,
      );
      if (!exceptionApproved) return;
      overrideInGameRequirement = true;
    }

    if (newlyAccepted) {
      const approved = window.confirm(
        `Approve ${commander}?\n\nThis will grant the Mongrel Member role in Discord, remove Applicant/Guest onboarding roles, and send the Commander a welcome message with a Member Portal activation link.\n\nElite's in-game Squadron application must still be accepted manually in Elite Dangerous. After leadership accepts it, the Commander must confirm that acceptance / choose Join Squadron on their side to complete in-game membership.`,
      );
      if (!approved) return;
    }

    const notes = card.querySelector('[data-officer-notes]')?.value || '';
    const state = card.querySelector('[data-card-status]');
    const buttons = [...card.querySelectorAll('button[data-review-action]')];
    buttons.forEach(button => { button.disabled = true; });
    if (state) { state.textContent = newlyAccepted ? 'Granting Member access…' : 'Saving…'; state.dataset.state = ''; }
    try {
      const response = await fetch('/api/applications', {
        method:'PUT', credentials:'same-origin', cache:'no-store',
        headers:{ Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'application-review' },
        body:JSON.stringify({ id, status, officerNotes:notes, inGameApplicationVerified:inGameVerified, overrideInGameRequirement }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === 'ingame_application_not_verified') {
          throw new Error('The in-game Squadron application has not been verified. Confirm it in Elite or explicitly approve as an exception.');
        }
        if (data.error === 'member_role_assignment_failed') {
          const detail = data.detail ? `\n\nDiscord: ${data.detail}` : '';
          throw new Error(`Member role could not be granted. The application was NOT marked Accepted. Check the Imperial Mongrels Website bot role hierarchy and Manage Roles permission.${detail}`);
        }
        throw new Error(data.error || `Save failed (${response.status})`);
      }
      const index = applications.findIndex(app => app.id === id);
      if (index >= 0) applications[index] = data.application;

      if (newlyAccepted) {
        const notices = ['Accept the Commander\'s in-game Squadron application in Elite Dangerous if you have not already done so. The Commander must then confirm that acceptance / choose Join Squadron on their side before in-game membership is complete.'];
        if (data.provisioning?.inGameRequirementOverridden) notices.unshift('This approval was recorded as an exception because the in-game application was not verified.');
        if (data.provisioning?.cleanupWarnings) notices.push('One or more Applicant/Guest roles could not be removed automatically; check the member in Discord.');
        if (['failed','cooldown','storage_unavailable'].includes(data.provisioning?.dmStatus)) notices.push('Member access was granted, but the acceptance DM was not delivered automatically.');
        window.alert(`Approved ${commander}.\n\nThe Discord Member role was granted successfully.\n\n${notices.join('\n')}`);
      }
      render();
    } catch (error) {
      console.error('Application review save failed', error);
      if (state) { state.textContent = error?.message || 'Could not save. Try again.'; state.dataset.state = 'error'; }
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
