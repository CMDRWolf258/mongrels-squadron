(() => {
  const root = document.querySelector('[data-cg-hauler-prep]');
  const tradeRoot = document.querySelector('[data-trade-pathway]');
  if (!root || !tradeRoot) return;

  let data = null;
  let busy = false;
  let loaded = false;
  let open = false;
  let flash = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusLabel = { pending:'Pending', complete:'Complete', known:'Already Know / Have This', skipped:'Skipped for Now' };
  const typeLabel = { learn:'Learn', build:'Build', demonstrate:'Demonstrate', challenge:'Challenge', wing:'Wing / Team' };

  async function api(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'pathway-cg-hauler-prep';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/pathway/cg-hauler-prep?_=${Date.now()}`, options);
    if (response.status === 401 || response.status === 403) return { unavailable:true };
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function notes(task) {
    const rows = [];
    if (task?.why) rows.push(`<div><strong>Why this matters</strong><p>${esc(task.why)}</p></div>`);
    if (task?.payoff) rows.push(`<div class="is-payoff"><strong>What success looks like</strong><p>${esc(task.payoff)}</p></div>`);
    return rows.length ? `<div class="cg-hauler-notes">${rows.join('')}</div>` : '';
  }

  function checklist(task) {
    if (!Array.isArray(task?.checklist) || !task.checklist.length) return '';
    return `<ul class="cg-hauler-checklist">${task.checklist.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  function stepList(view) {
    return `<details class="cg-hauler-steps">
      <summary>View all training steps</summary>
      <div class="cg-hauler-step-list">${(view.tasks || []).map(task => `<article class="cg-hauler-step${task.id === view.current?.id ? ' is-current' : ''}${task.status === 'complete' || task.status === 'known' ? ' is-complete' : ''}">
        <span>${String(task.index).padStart(2,'0')}</span>
        <div><small>${esc(task.stage)} · ${esc(typeLabel[task.type] || 'Assignment')}</small><strong>${esc(task.title)}</strong></div>
        <div class="cg-hauler-step-state"><small>${esc(statusLabel[task.status] || task.status)}</small>${task.status !== 'pending' ? `<button type="button" data-cg-task="${esc(task.id)}" data-cg-status="pending">Reopen</button>` : ''}</div>
      </article>`).join('')}</div>
    </details>`;
  }

  function currentCard(view) {
    const task = view.current;
    if (!task) {
      return `<article class="cg-hauler-current is-complete"><span>Specialty Complete</span><h4>Hostile-hauling prep complete</h4><p>You have worked through the build, escape, coordination, and controlled-delivery drills. Keep using the same habits when a real Community Goal or squad logistics operation gets busy.</p></article>`;
    }
    return `<article class="cg-hauler-current">
      <span>${esc(task.stage)} · ${esc(typeLabel[task.type] || 'Assignment')}</span>
      <h4>${esc(task.title)}</h4>
      <p>${esc(task.objective)}</p>
      ${checklist(task)}
      ${notes(task)}
      <div class="cg-hauler-actions">
        <button class="btn btn-primary" type="button" data-cg-task="${esc(task.id)}" data-cg-status="complete">Complete</button>
        <button class="btn btn-ghost" type="button" data-cg-task="${esc(task.id)}" data-cg-status="known">Already Know / Have This</button>
        <button class="cg-hauler-text-button" type="button" data-cg-task="${esc(task.id)}" data-cg-status="skipped">Skip for Now</button>
      </div>
    </article>`;
  }

  function render(payload) {
    data = payload;
    if (payload?.unavailable || tradeRoot.hidden) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    const old = root.querySelector('details.cg-hauler-prep');
    if (old?.open) open = true;
    const view = payload?.view;
    if (!view) return;
    root.hidden = false;
    root.innerHTML = `<details class="cg-hauler-prep"${open ? ' open' : ''}>
      <summary>
        <span><small>Trade Specialty Training</small><strong>${esc(view.title)}</strong></span>
        <span class="cg-hauler-summary-state">${view.progress.completed} / ${view.progress.total}</span>
      </summary>
      <div class="cg-hauler-body">
        <div class="cg-hauler-intro"><small>Doctrine</small><strong>${esc(view.doctrine)}</strong><p>${esc(view.subtitle)}</p></div>
        <div class="cg-hauler-progress"><span>${view.progress.completed} / ${view.progress.total} credited</span><div><i style="width:${view.progress.percent}%"></i></div><strong>${view.progress.percent}%</strong></div>
        ${currentCard(view)}
        ${stepList(view)}
        <div class="cg-hauler-footer"><button class="cg-hauler-text-button" type="button" data-cg-reset>Reset specialty progress</button></div>
        <div class="cg-hauler-status" data-cg-status${flash ? ` data-state="${esc(flash.state)}"` : ''}>${esc(flash?.message || '')}</div>
      </div>
    </details>`;
    const details = root.querySelector('details.cg-hauler-prep');
    details?.addEventListener('toggle', () => { open = Boolean(details.open); });
    bind();
  }

  function bind() {
    root.querySelectorAll('[data-cg-task]').forEach(button => button.addEventListener('click', () => {
      run({ action:'set_task', taskId:button.dataset.cgTask, status:button.dataset.cgStatus }, 'Saving specialty progress…');
    }));
    root.querySelector('[data-cg-reset]')?.addEventListener('click', () => {
      if (!window.confirm('Reset all Community Goal Hauler Prep progress?\n\nThis does not change your main Trade pathway.')) return;
      run({ action:'reset' }, 'Resetting specialty progress…');
    });
  }

  function setBusy(message) {
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const status = root.querySelector('[data-cg-status]');
    if (status) { status.textContent = message; status.dataset.state = 'working'; }
  }

  async function run(body, message) {
    if (busy) return;
    busy = true;
    open = true;
    setBusy(message);
    try {
      flash = { state:'success', message:'Specialty progress saved.' };
      render(await api('POST', body));
    } catch (error) {
      console.error('Could not update Community Goal Hauler Prep', error);
      flash = { state:'error', message:error?.message || 'Could not save specialty progress.' };
      try { render(await api()); } catch { /* keep current surface */ }
    } finally {
      busy = false;
      root.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }

  async function load() {
    if (tradeRoot.hidden) {
      root.hidden = true;
      return;
    }
    try {
      render(await api());
      loaded = true;
    } catch (error) {
      console.error('Could not load Community Goal Hauler Prep', error);
      root.hidden = true;
    }
  }

  const observer = new MutationObserver(() => {
    if (!tradeRoot.hidden && !loaded) load();
    if (tradeRoot.hidden) root.hidden = true;
  });
  observer.observe(tradeRoot, { attributes:true, attributeFilter:['hidden'] });

  if (!tradeRoot.hidden) load();
})();
