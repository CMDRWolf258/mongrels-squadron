(() => {
  const root = document.querySelector('[data-start-daily-tasks]');
  if (!root) return;

  if (!document.querySelector('link[data-start-tasks-style]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '../css/start-tasks.css?v=2';
    style.dataset.startTasksStyle = 'true';
    document.head.appendChild(style);
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const experienceLabels = { new:'Beginner', some:'Developing', comfortable:'Experienced', experienced:'Veteran / Mentor' };
  const kindLabels = { activity:'Activity Task', challenge:'Challenge', squad:'Squad Opportunity' };
  const carouselIndex = new Map();
  let currentData = null;
  let busy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    const url = `/api/start/tasks?tz=${encodeURIComponent(timeZone)}&_=${Date.now()}`;
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'start-daily-tasks';
      options.body = JSON.stringify({ ...body, timeZone });
    }
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function renderGate() {
    root.innerHTML = `<div class="daily-task-gate">
      <div><span class="daily-task-kicker">Members Get Personalized Picks</span><h3>Sign in for today’s assignments</h3><p>Start Here can use your private My Pathway preferences to offer tasks from activities you actually care about. It does not change Pathway progress.</p></div>
      <a class="btn btn-primary" href="/api/auth/login?return=${encodeURIComponent('/start/#daily-tasks')}">Sign in with Discord</a>
    </div>`;
  }

  function renderNoPreferences() {
    root.innerHTML = `<div class="daily-task-gate">
      <div><span class="daily-task-kicker">Choose Your Categories First</span><h3>Tell us what you actually like doing</h3><p>Your daily task categories come from My Pathway preferences, but today’s assignments are a separate system. Pick a few interests once, then come back here whenever you want the site to choose something for you.</p></div>
      <a class="btn btn-primary" href="../pathway/">Set My Preferences</a>
    </div>`;
  }

  function taskMarkup(task, index) {
    const kind = kindLabels[task.kind] || kindLabels.activity;
    return `<article class="daily-option${task.kind === 'squad' ? ' is-squad' : ''}">
      <div class="daily-option-head"><span class="daily-option-number">${String(index + 1).padStart(2,'0')}</span><span class="daily-kind kind-${esc(task.kind || 'activity')}">${esc(kind)}</span></div>
      <h4>${esc(task.title)}</h4>
      <p>${esc(task.objective)}</p>
      <a href="${esc(task.link || '../activities/')}">${task.kind === 'squad' ? 'Open Daily Orders' : 'Open Related Content'} →</a>
    </article>`;
  }

  function normalizedCarouselIndex(categoryId, count) {
    if (!count) return 0;
    const saved = Number(carouselIndex.get(categoryId));
    const index = Number.isFinite(saved) ? saved : count - 1;
    const normalized = Math.max(0, Math.min(count - 1, index));
    carouselIndex.set(categoryId, normalized);
    return normalized;
  }

  function categoryMarkup(category) {
    const revealed = Array.isArray(category.revealed) ? category.revealed : [];
    const remaining = Number(category.remaining) || 0;
    const count = revealed.length;
    const activeIndex = normalizedCarouselIndex(category.id, count);
    const activeTask = count ? revealed[activeIndex] : null;
    const buttonText = count === 0 ? 'Give Me a Task' : remaining > 0 ? `Another Task · ${remaining} Left` : 'Daily Limit Reached';
    const carousel = activeTask ? `
      <div class="daily-carousel" data-daily-carousel="${esc(category.id)}">
        ${taskMarkup(activeTask, activeIndex)}
        ${count > 1 ? `<div class="daily-carousel-nav">
          <button type="button" data-daily-slide="prev" data-daily-activity="${esc(category.id)}" aria-label="Previous ${esc(category.label)} task">←</button>
          <span><strong>${activeIndex + 1}</strong> / ${count}</span>
          <button type="button" data-daily-slide="next" data-daily-activity="${esc(category.id)}" aria-label="Next ${esc(category.label)} task">→</button>
        </div>` : '<div class="daily-carousel-nav is-single"><span>Task 1 of 1</span></div>'}
      </div>` : '<p class="daily-category-empty">Nothing assigned yet. Hit the button and take what the computer gives you.</p>';

    return `<article class="daily-category" data-daily-category="${esc(category.id)}">
      <div class="daily-category-head">
        <div><span class="daily-category-group">${esc(category.group)}</span><h3>${esc(category.label)}</h3></div>
        <span class="daily-experience">${esc(experienceLabels[category.experience] || category.experience)}</span>
      </div>
      <div class="daily-category-meter"><span><strong>${count}</strong> / ${category.limit} revealed today</span><i><b style="width:${Math.min(100, (count / Math.max(1, category.limit)) * 100)}%"></b></i></div>
      ${carousel}
      <div class="daily-category-actions">
        <button class="btn ${count === 0 ? 'btn-primary' : 'btn-ghost'}" type="button" data-daily-reveal="${esc(category.id)}" ${remaining <= 0 ? 'disabled' : ''}>${esc(buttonText)}</button>
        <a class="daily-browse-link" href="${esc(category.link || '../activities/')}">Browse ${esc(category.label)}</a>
      </div>
    </article>`;
  }

  function bindInteractions() {
    root.querySelectorAll('[data-daily-reveal]').forEach(button => button.addEventListener('click', () => reveal(button.dataset.dailyReveal)));
    root.querySelectorAll('[data-daily-slide]').forEach(button => button.addEventListener('click', () => {
      const activity = button.dataset.dailyActivity;
      const category = currentData?.categories?.find(item => item.id === activity);
      const count = Array.isArray(category?.revealed) ? category.revealed.length : 0;
      if (count < 2) return;
      const current = normalizedCarouselIndex(activity, count);
      const delta = button.dataset.dailySlide === 'prev' ? -1 : 1;
      carouselIndex.set(activity, (current + delta + count) % count);
      render(currentData);
    }));
  }

  function render(data) {
    currentData = data;
    if (!data.authenticated) return renderGate();
    if (!data.hasPreferences) return renderNoPreferences();
    const categories = Array.isArray(data.categories) ? data.categories : [];
    root.innerHTML = `
      <div class="daily-task-summary">
        <div><span class="daily-task-kicker">Personalized for ${esc(data.viewer?.displayName || 'you')}</span><strong>${categories.length} activity ${categories.length === 1 ? 'category' : 'categories'} available</strong><small>${esc(data.resetLabel || 'Resets daily')} · maximum ${Number(data.limitPerCategory) || 3} reveals per category.</small></div>
        <a class="btn btn-ghost" href="../pathway/">Adjust Preferences</a>
      </div>
      <div class="daily-category-grid">${categories.map(categoryMarkup).join('')}</div>`;
    bindInteractions();
  }

  async function reveal(activity) {
    if (busy || !activity) return;
    busy = true;
    const button = root.querySelector(`[data-daily-reveal="${CSS.escape(activity)}"]`);
    if (button) { button.disabled = true; button.textContent = 'Picking…'; }
    try {
      const result = await api('POST', { action:'reveal', activity });
      const category = result?.categories?.find(item => item.id === activity);
      const count = Array.isArray(category?.revealed) ? category.revealed.length : 0;
      if (count) carouselIndex.set(activity, count - 1);
      render(result);
    } catch (error) {
      console.error('Could not reveal Start Here daily task', error);
      if (button) { button.disabled = false; button.textContent = 'Try Again'; }
      const card = button?.closest('[data-daily-category]');
      if (card && !card.querySelector('.daily-task-error')) {
        card.insertAdjacentHTML('beforeend', '<p class="daily-task-error">Could not pick a task right now. Please try again.</p>');
      }
    } finally {
      busy = false;
    }
  }

  (async () => {
    root.innerHTML = '<div class="daily-task-loading">Checking today’s options…</div>';
    try { render(await api()); }
    catch (error) {
      console.error('Could not load Start Here daily tasks', error);
      root.innerHTML = '<div class="daily-task-loading is-error">Today’s personalized tasks could not be loaded right now.</div>';
    }
  })();
})();
