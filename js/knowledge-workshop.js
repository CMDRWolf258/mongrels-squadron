(() => {
  const access = document.querySelector('[data-kw-access]');
  const app = document.querySelector('[data-kw-app]');
  const list = document.querySelector('[data-kw-list]');
  const empty = document.querySelector('[data-kw-empty]');
  const editor = document.querySelector('[data-kw-editor]');
  const placeholder = document.querySelector('[data-kw-placeholder]');
  if (!access || !app || !list || !editor) return;

  const fields = {
    id:document.querySelector('[data-kw-id]'),
    topic:document.querySelector('[data-kw-topic]'),
    category:document.querySelector('[data-kw-category]'),
    question:document.querySelector('[data-kw-question]'),
    answer:document.querySelector('[data-kw-answer]'),
    details:document.querySelector('[data-kw-details]'),
    keywords:document.querySelector('[data-kw-keywords]'),
    sourceClaim:document.querySelector('[data-kw-source-claim]'),
    fieldNotes:document.querySelector('[data-kw-field-notes]'),
    sources:document.querySelector('[data-kw-sources]'),
    status:document.querySelector('[data-kw-status]'),
    confidence:document.querySelector('[data-kw-confidence]'),
    stability:document.querySelector('[data-kw-stability]'),
    gameVersion:document.querySelector('[data-kw-game-version]'),
    assistantVisible:document.querySelector('[data-kw-assistant-visible]'),
    result:document.querySelector('[data-kw-result]'),
    editorTitle:document.querySelector('[data-kw-editor-title]'),
  };

  let items = [];
  let filter = 'review';
  let searchText = '';

  const fetchJson = async (url, options={}) => {
    const response = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), {credentials:'same-origin',cache:'no-store',...options});
    const payload = await response.json().catch(() => ({}));
    return {response,payload};
  };

  const formatDate = value => {
    if (!value) return 'Not reviewed';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {year:'numeric',month:'short',day:'numeric'});
  };

  const escText = value => String(value || '');

  function updateSummary(summary={}) {
    document.querySelector('[data-kw-review]').textContent = summary.review ?? 0;
    document.querySelector('[data-kw-draft]').textContent = summary.draft ?? 0;
    document.querySelector('[data-kw-approved]').textContent = summary.approved ?? 0;
    document.querySelector('[data-kw-retired]').textContent = summary.retired ?? 0;
  }

  function visibleItems() {
    const q = searchText.trim().toLowerCase();
    return items.filter(item => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!q) return true;
      return [item.topic,item.category,item.question,item.answer,item.sourceClaim,item.fieldNotes,...(item.keywords || [])].join(' ').toLowerCase().includes(q);
    });
  }

  function render() {
    const visible = visibleItems();
    list.replaceChildren();
    empty.hidden = visible.length > 0;
    visible.forEach(item => {
      const card = document.createElement('article');
      card.className = 'kw-card';

      const head = document.createElement('div');
      head.className = 'kw-card-head';
      const wrap = document.createElement('div');
      const meta = document.createElement('div');
      meta.className = 'kw-meta';
      meta.textContent = [item.category || 'General', item.confidence || 'unverified', item.origin === 'research' ? 'research candidate' : 'manual'].join(' · ');
      const title = document.createElement('h3');
      title.textContent = item.topic || 'Untitled know-how';
      wrap.append(meta, title);

      const badge = document.createElement('span');
      badge.className = 'kw-badge kw-badge-' + item.status;
      badge.textContent = item.status === 'review' ? 'Needs Review' : item.status;
      head.append(wrap, badge);

      const answer = document.createElement('p');
      answer.textContent = item.answer || 'No approved answer drafted yet.';

      const details = document.createElement('div');
      details.className = 'kw-meta';
      details.style.marginTop = '10px';
      details.textContent = (item.sources?.length || 0) + ' source' + ((item.sources?.length || 0) === 1 ? '' : 's') + ' · updated ' + formatDate(item.updatedAt || item.createdAt);

      const actions = document.createElement('div');
      actions.className = 'kw-card-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-secondary';
      edit.textContent = 'Review / Edit';
      edit.addEventListener('click', () => openEditor(item));
      actions.append(edit);

      card.append(head, answer, details, actions);
      list.append(card);
    });
  }

  function openEditor(item) {
    const value = item || {};
    fields.id.value = value.id || '';
    fields.topic.value = value.topic || '';
    fields.category.value = value.category || 'General';
    fields.question.value = value.question || '';
    fields.answer.value = value.answer || '';
    fields.details.value = (value.details || []).join('\n');
    fields.keywords.value = (value.keywords || []).join('\n');
    fields.sourceClaim.value = value.sourceClaim || '';
    fields.fieldNotes.value = value.fieldNotes || '';
    fields.sources.value = (value.sources || []).map(source => [source.name || '',source.url || '',source.type || '',source.note || ''].join(' | ').replace(/\s+\|\s*$/,'')).join('\n');
    fields.status.value = value.status || 'draft';
    fields.confidence.value = value.confidence || 'unverified';
    fields.stability.value = value.stability || 'stable';
    fields.gameVersion.value = value.gameVersion || '';
    fields.assistantVisible.checked = value.assistantVisible !== false;
    fields.result.textContent = value.reviewedAt ? 'Last approved/reviewed ' + formatDate(value.reviewedAt) : '';
    fields.editorTitle.textContent = value.id ? 'Review know-how' : 'New know-how';
    placeholder.hidden = true;
    editor.hidden = false;
    if (window.innerWidth < 900) editor.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function closeEditor() {
    editor.hidden = true;
    placeholder.hidden = false;
    fields.result.textContent = '';
  }

  function parseLines(value, splitCommas=false) {
    const pattern = splitCommas ? /\n|,/ : /\n/;
    return [...new Set(String(value || '').split(pattern).map(x => x.trim()).filter(Boolean))];
  }

  function parseSources(value) {
    return String(value || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(x => x.trim());
      return {name:parts[0] || '',url:parts[1] || '',type:parts[2] || '',note:parts.slice(3).join(' | ') || ''};
    });
  }

  function payloadFromEditor() {
    return {
      topic:fields.topic.value.trim(),
      category:fields.category.value.trim() || 'General',
      question:fields.question.value.trim(),
      answer:fields.answer.value.trim(),
      details:parseLines(fields.details.value, false),
      keywords:parseLines(fields.keywords.value, true),
      sourceClaim:fields.sourceClaim.value.trim(),
      fieldNotes:fields.fieldNotes.value.trim(),
      sources:parseSources(fields.sources.value),
      status:fields.status.value,
      confidence:fields.confidence.value,
      stability:fields.stability.value,
      gameVersion:fields.gameVersion.value.trim(),
      assistantVisible:fields.assistantVisible.checked,
    };
  }

  async function save(forceDraft=false) {
    const item = payloadFromEditor();
    if (forceDraft) item.status = 'draft';
    if (!item.topic || !item.answer) {
      fields.result.textContent = 'Topic and Mongrel answer are required.';
      return;
    }
    fields.result.textContent = 'Saving…';
    const id = fields.id.value;
    const method = id ? 'PATCH' : 'POST';
    const body = id ? {id,item} : {item};
    const {response,payload} = await fetchJson('/api/knowledge-workshop', {
      method,
      headers:{'Content-Type':'application/json','X-Mongrels-Request':'knowledge-workshop-admin'},
      body:JSON.stringify(body),
    });
    if (!response.ok) {
      fields.result.textContent = payload.error || 'Unable to save know-how.';
      return;
    }
    fields.result.textContent = item.status === 'approved' ? 'Saved and approved for Ask the Mongrels.' : 'Saved.';
    await load(false);
    if (payload.item) openEditor(payload.item);
  }

  editor.addEventListener('submit', event => {
    event.preventDefault();
    save(false).catch(error => { console.error(error); fields.result.textContent = 'Save failed.'; });
  });
  document.querySelector('[data-kw-save-draft]').addEventListener('click', () => save(true).catch(console.error));
  document.querySelector('[data-kw-new]').addEventListener('click', () => openEditor(null));
  document.querySelector('[data-kw-cancel]').addEventListener('click', closeEditor);
  document.querySelector('[data-kw-search]').addEventListener('input', event => { searchText = event.target.value; render(); });

  document.querySelectorAll('[data-kw-filter]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-kw-filter]').forEach(x => x.classList.remove('active'));
      button.classList.add('active');
      filter = button.dataset.kwFilter || 'all';
      render();
    });
  });

  async function load(resetEditor=true) {
    const {response,payload} = await fetchJson('/api/knowledge-workshop');
    if (response.status === 401) {
      access.innerHTML = '<strong>Sign in required.</strong><p>Use the Member Portal to sign in with the Site Admin account.</p><a class="btn btn-primary" href="/api/auth/login?return=%2Fknowledge-workshop%2F">Sign in with Discord</a>';
      return;
    }
    if (response.status === 403) {
      access.innerHTML = '<strong>Site Admin only.</strong><p>Your current account does not have access to the Knowledge Workshop.</p>';
      return;
    }
    if (!response.ok) {
      access.innerHTML = '<strong>Knowledge Workshop unavailable.</strong><p>The secure editorial store could not be loaded.</p>';
      return;
    }
    items = Array.isArray(payload.items) ? payload.items : [];
    updateSummary(payload.summary || {});
    access.hidden = true;
    app.hidden = false;
    render();
    if (resetEditor) closeEditor();
  }

  load().catch(error => {
    console.error('Could not load Knowledge Workshop', error);
    access.innerHTML = '<strong>Knowledge Workshop unavailable.</strong><p>The page encountered an error while loading.</p>';
  });
})();
