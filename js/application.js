(() => {
  const gate = document.querySelector('[data-application-gate]');
  const gateStatus = document.querySelector('[data-application-gate-status]');
  const memberState = document.querySelector('[data-application-member]');
  const statusCard = document.querySelector('[data-application-status]');
  const form = document.querySelector('[data-application-form]');
  const saveButton = document.querySelector('[data-save-draft]');
  const submitButton = document.querySelector('[data-submit-application]');
  const saveStatus = document.querySelector('[data-application-save-status]');
  const discoverySelect = document.querySelector('[data-field="discoverySource"]');
  const discoveryDetail = document.querySelector('[data-discovery-detail]');

  if (!gate || !form) return;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const dateLabel = value => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
  };
  const statusLabel = status => ({ draft:'Draft', submitted:'Submitted', under_review:'Under Review', accepted:'Accepted', declined:'Declined' }[status] || status || 'Unknown');
  const statusCopy = status => ({
    submitted: 'Your website application has been sent to Mongrel leadership. Leadership will also verify your in-game Squadron application before approval.',
    under_review: 'Mongrel leadership is reviewing your application and confirming the matching in-game Squadron application.',
    accepted: 'Your website application has been accepted and your Discord Mongrel Member role has been granted. Activate Member Access below. To finish in-game membership, after leadership approves your Elite Squadron application, return to the Squadrons panel and choose Join Squadron / Confirm.',
    declined: 'This application is closed. If leadership asked you to follow up, please contact them through Discord.',
  }[status] || 'Your application has been saved.');

  const setVisible = target => {
    gate.hidden = target !== 'gate';
    memberState.hidden = target !== 'member';
    statusCard.hidden = target !== 'status';
    form.hidden = target !== 'form';
  };

  function updateDiscoveryDetail() {
    if (!discoveryDetail || !discoverySelect) return;
    discoveryDetail.hidden = !['Current Mongrel member', 'Other'].includes(discoverySelect.value);
  }
  discoverySelect?.addEventListener('change', updateDiscoveryDetail);

  function collectChecks(group) {
    return [...document.querySelectorAll(`[data-check-group="${group}"] input[type="checkbox"]:checked`)].map(input => input.value);
  }
  function collectRadio(group) {
    return document.querySelector(`[data-radio-group="${group}"] input[type="radio"]:checked`)?.value || '';
  }
  function text(field) { return document.querySelector(`[data-field="${field}"]`)?.value?.trim() || ''; }
  function checked(field) { return Boolean(document.querySelector(`[data-field="${field}"]`)?.checked); }

  function collectAnswers() {
    return {
      commanderName: text('commanderName'),
      experience: text('experience'),
      timezone: text('timezone'),
      activeTimes: collectChecks('activeTimes'),
      discoverySource: text('discoverySource'),
      discoveryDetail: text('discoveryDetail'),
      interestReason: text('interestReason'),
      currentActivities: collectChecks('currentActivities'),
      learnActivities: collectChecks('learnActivities'),
      pvpExperience: collectRadio('pvpExperience'),
      voiceComfort: collectRadio('voiceComfort'),
      openPlay: collectRadio('openPlay'),
      bgsOpenAcknowledged: checked('bgsOpenAcknowledged'),
      squadGoals: text('squadGoals'),
      additionalInfo: text('additionalInfo'),
      inGameApplicationSubmitted: checked('inGameApplicationSubmitted'),
      rulesAcknowledged: checked('rulesAcknowledged'),
    };
  }

  function setField(field, value) {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (!input) return;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value ?? '';
  }
  function setChecks(group, values) {
    const selected = new Set(Array.isArray(values) ? values : []);
    document.querySelectorAll(`[data-check-group="${group}"] input[type="checkbox"]`).forEach(input => { input.checked = selected.has(input.value); });
  }
  function setRadio(group, value) {
    document.querySelectorAll(`[data-radio-group="${group}"] input[type="radio"]`).forEach(input => { input.checked = input.value === value; });
  }
  function populate(answers = {}) {
    ['commanderName','experience','timezone','discoverySource','discoveryDetail','interestReason','squadGoals','additionalInfo','bgsOpenAcknowledged','inGameApplicationSubmitted','rulesAcknowledged'].forEach(field => setField(field, answers[field]));
    setChecks('activeTimes', answers.activeTimes);
    setChecks('currentActivities', answers.currentActivities);
    setChecks('learnActivities', answers.learnActivities);
    setRadio('pvpExperience', answers.pvpExperience);
    setRadio('voiceComfort', answers.voiceComfort);
    setRadio('openPlay', answers.openPlay);
    updateDiscoveryDetail();
  }

  function answer(label, value, wide = false) {
    const display = Array.isArray(value) ? (value.length ? value.join(', ') : '—') : (value || '—');
    return `<div class="application-answer${wide ? ' wide' : ''}"><span>${esc(label)}</span><p>${esc(display)}</p></div>`;
  }
  function renderStatus(application) {
    const a = application?.answers || {};
    const status = application?.status || 'submitted';
    const acceptedActions = status === 'accepted'
      ? '<div class="actions" style="margin-top:18px"><a class="btn btn-primary" href="/api/auth/login?return=%2Fmember%2F">Activate Member Access</a><a class="btn btn-ghost" href="../member/">Member Portal</a></div>'
      : '';
    statusCard.innerHTML = `<div class="application-status-head"><div><p class="eyebrow">Application Status</p><h2>${esc(a.commanderName || 'Mongrel Application')}</h2><p>${esc(statusCopy(status))}</p>${acceptedActions}</div><span class="application-status-badge ${esc(status)}">${esc(statusLabel(status))}</span></div>
      <div class="application-answer-grid">
        ${answer('Discord', application.ownerName || '')}${answer('Submitted', dateLabel(application.submittedAt || application.updatedAt))}${status === 'accepted' ? answer('Accepted', dateLabel(application.acceptedAt || application.updatedAt)) : ''}
        ${answer('In-game Squadron Application', a.inGameApplicationSubmitted ? 'Submitted to Regiment of Imperial Mongrels' : 'Not recorded')}
        ${answer('Experience', a.experience)}${answer('Time Zone', a.timezone)}
        ${answer('Usually Active', a.activeTimes)}${answer('Found Us Through', [a.discoverySource, a.discoveryDetail].filter(Boolean).join(' — '))}
        ${answer('Current Activities', a.currentActivities, true)}${answer('Want to Learn / Do More', a.learnActivities, true)}
        ${answer('PvP Experience', a.pvpExperience)}${answer('Discord Voice', a.voiceComfort)}
        ${answer('Open Play', a.openPlay)}${answer('BGS in Open Acknowledged', a.bgsOpenAcknowledged ? 'Yes' : 'No')}
        ${answer('Why the Mongrels?', a.interestReason, true)}${answer('Looking for from a Squadron', a.squadGoals, true)}${answer('Anything Else', a.additionalInfo, true)}
      </div>`;
    setVisible('status');
  }

  function showSaveStatus(message, state = '') {
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.dataset.state = state;
  }

  async function save(action) {
    const answers = collectAnswers();
    saveButton.disabled = true;
    submitButton.disabled = true;
    showSaveStatus(action === 'submit' ? 'Submitting application…' : 'Saving draft…');
    try {
      const response = await fetch('/api/applications', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept:'application/json', 'Content-Type':'application/json', 'X-Mongrels-Request':'application-editor' },
        body: JSON.stringify({ action, answers }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === 'application_incomplete') {
          showSaveStatus('A few required fields still need an answer before you can submit. Be sure you have also submitted the in-game Squadron application.', 'error');
          focusMissing(data.fields || []);
          return;
        }
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      if (action === 'submit') renderStatus(data.application);
      else showSaveStatus(`Draft saved ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}.`, 'success');
    } catch (error) {
      console.error('Application save failed', error);
      showSaveStatus('Could not save the application. Please try again.', 'error');
    } finally {
      saveButton.disabled = false;
      submitButton.disabled = false;
    }
  }

  function focusMissing(fields) {
    const first = fields[0];
    if (!first) return;
    const direct = document.querySelector(`[data-field="${first}"]`);
    const group = document.querySelector(`[data-check-group="${first}"], [data-radio-group="${first}"]`);
    const target = direct || group;
    target?.scrollIntoView({ behavior:'smooth', block:'center' });
    direct?.focus?.();
  }

  function enableMemberPreview() {
    if (memberState.querySelector('[data-preview-application]')) return;
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.style.marginTop = '18px';
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'btn btn-ghost';
    preview.dataset.previewApplication = 'true';
    preview.textContent = 'Preview Application Questions';
    actions.appendChild(preview);
    memberState.appendChild(actions);
    preview.addEventListener('click', () => {
      populate({});
      setVisible('form');
      saveButton.hidden = true;
      submitButton.type = 'button';
      submitButton.textContent = 'Back to Member Status';
      showSaveStatus('Preview only — your member account cannot save or submit an application.');
      submitButton.onclick = () => {
        submitButton.onclick = null;
        submitButton.type = 'submit';
        submitButton.textContent = 'Submit Application';
        saveButton.hidden = false;
        setVisible('member');
      };
    });
  }

  saveButton?.addEventListener('click', () => save('save'));
  form.addEventListener('submit', event => { event.preventDefault(); save('submit'); });

  async function load() {
    setVisible('gate');
    try {
      const sessionResponse = await fetch('/api/auth/session', { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
      const session = await sessionResponse.json();
      if (!session.authenticated) {
        if (gateStatus) gateStatus.textContent = 'Sign in with Discord to begin.';
        return;
      }
      if (!session.membershipVerified && !['member','officer','site_admin'].includes(session.access)) {
        if (gateStatus) gateStatus.textContent = 'Your Discord account is signed in, but it is not currently a member of the Mongrels Discord server. Join the server first, then sign in again.';
        return;
      }

      const response = await fetch('/api/applications', { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Application lookup failed (${response.status})`);
      if (data.alreadyMember) { setVisible('member'); enableMemberPreview(); return; }
      if (data.mine && data.mine.status !== 'draft') { renderStatus(data.mine); return; }
      populate(data.mine?.answers || {});
      showSaveStatus(data.mine ? `Draft last saved ${dateLabel(data.mine.updatedAt)}.` : 'Draft not yet saved.', data.mine ? 'success' : '');
      setVisible('form');
    } catch (error) {
      console.error('Application load failed', error);
      if (gateStatus) gateStatus.textContent = 'The application system could not be loaded. Please try again.';
      setVisible('gate');
    }
  }

  load();
})();
