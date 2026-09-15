(() => {
  const access = document.querySelector('[data-gap-access]');
  const app = document.querySelector('[data-gap-app]');
  const list = document.querySelector('[data-gap-list]');
  const empty = document.querySelector('[data-gap-empty]');
  if (!access || !app || !list) return;

  let items = [];
  let filter = 'open';

  const fetchJson = async (url, options={}) => {
    const response = await fetch(`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`, {credentials:'same-origin',cache:'no-store',...options});
    const payload = await response.json().catch(()=>({}));
    return {response,payload};
  };

  function formatDate(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function updateSummary(summary={}) {
    document.querySelector('[data-gap-open]').textContent = summary.open ?? 0;
    document.querySelector('[data-gap-resolved]').textContent = summary.resolved ?? 0;
    document.querySelector('[data-gap-dismissed]').textContent = summary.dismissed ?? 0;
    document.querySelector('[data-gap-repeated]').textContent = summary.repeated ?? 0;
  }

  function visibleItems() {
    return filter === 'all' ? items : items.filter(item => item.status === filter);
  }

  function render() {
    const visible = visibleItems();
    list.replaceChildren();
    empty.hidden = visible.length > 0;

    visible.forEach(item => {
      const card = document.createElement('article');
      card.className = 'gap-card';

      const head = document.createElement('div');
      head.className = 'gap-card-head';
      const titleWrap = document.createElement('div');
      const meta = document.createElement('div');
      meta.className = 'gap-meta';
      meta.textContent = [
        item.occurrences > 1 ? `${item.occurrences} asks` : '1 ask',
        item.lastAskedBy || 'Member',
        formatDate(item.lastAskedAt),
      ].join(' · ');
      const title = document.createElement('h3');
      title.textContent = item.question;
      titleWrap.append(meta, title);

      const badge = document.createElement('span');
      badge.className = `gap-status gap-status-${item.status}`;
      badge.textContent = item.status;
      head.append(titleWrap, badge);

      const answerLabel = document.createElement('div');
      answerLabel.className = 'gap-label';
      answerLabel.textContent = 'Assistant answer at time of gap';
      const answer = document.createElement('div');
      answer.className = 'gap-answer';
      answer.textContent = item.answer;

      const noteWrap = document.createElement('label');
      noteWrap.className = 'gap-admin-note';
      const noteLabel = document.createElement('span');
      noteLabel.className = 'gap-label';
      noteLabel.textContent = 'Research / database note';
      const note = document.createElement('textarea');
      note.maxLength = 1200;
      note.placeholder = 'Optional: source checked, file to update, what was added, etc.';
      note.value = item.adminNote || '';
      noteWrap.append(noteLabel, note);

      const actions = document.createElement('div');
      actions.className = 'gap-actions';
      if (item.status !== 'resolved') actions.append(makeAction('Mark Resolved','resolved',item,note,'btn btn-primary'));
      if (item.status !== 'open') actions.append(makeAction('Reopen','open',item,note,'btn btn-secondary'));
      if (item.status !== 'dismissed') actions.append(makeAction('Dismiss','dismissed',item,note,'btn btn-secondary'));

      const details = document.createElement('small');
      details.className = 'gap-meta';
      details.textContent = `First asked ${formatDate(item.firstAskedAt)}${item.model ? ` · ${item.model}` : ''}${item.reviewedAt ? ` · reviewed ${formatDate(item.reviewedAt)}` : ''}`;

      card.append(head, answerLabel, answer, noteWrap, actions, details);
      list.appendChild(card);
    });
  }

  function makeAction(label, status, item, note, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      const {response,payload} = await fetchJson('/api/assistant/gaps', {
        method:'PATCH',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'assistant-gap-admin'},
        body:JSON.stringify({id:item.id,status,adminNote:note.value}),
      });
      button.disabled = false;
      if (!response.ok) {
        alert(payload.error || 'Unable to update knowledge gap.');
        return;
      }
      await load();
    });
    return button;
  }

  document.querySelectorAll('[data-gap-filter]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-gap-filter]').forEach(x => x.classList.remove('active'));
      button.classList.add('active');
      filter = button.dataset.gapFilter || 'open';
      render();
    });
  });

  async function load() {
    const {response,payload} = await fetchJson('/api/assistant/gaps');
    if (response.status === 401) {
      access.innerHTML = '<strong>Sign in required.</strong><p>Use the Member Portal to sign in with the Site Admin account.</p><a class="btn btn-primary" href="/api/auth/login?return=%2Fassistant-gaps%2F">Sign in with Discord</a>';
      return;
    }
    if (response.status === 403) {
      access.innerHTML = '<strong>Site Admin only.</strong><p>Your current account does not have access to the Assistant Knowledge Gaps queue.</p>';
      return;
    }
    if (!response.ok) {
      access.innerHTML = '<strong>Knowledge gap log unavailable.</strong><p>The secure assistant log could not be loaded.</p>';
      return;
    }

    items = Array.isArray(payload.items) ? payload.items : [];
    updateSummary(payload.summary || {});
    access.hidden = true;
    app.hidden = false;
    render();
  }

  load().catch(error => {
    console.error('Could not load Assistant Knowledge Gaps', error);
    access.innerHTML = '<strong>Knowledge gap log unavailable.</strong><p>The page encountered an error while loading.</p>';
  });
})();
