(() => {
  const recordedThisView = new Map();
  let busy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function opportunities(task) {
    return Array.isArray(task?.engineeringPrep) ? task.engineeringPrep.filter(item => item?.factId && item?.label) : [];
  }

  function markup(task) {
    const items = opportunities(task);
    if (!items.length) return '';
    const taskId = String(task?.id || '');
    return `<details class="pathway-cross-prep" data-cross-prep-task="${esc(taskId)}">
      <summary><span><small>Optional background progress</small><strong>Engineering Prep</strong></span><em>Does not affect this assignment</em></summary>
      <div class="pathway-cross-prep-body">
        <p class="pathway-cross-prep-intro">This task can overlap with a future Engineer prerequisite. Record only progress that actually happened; skipping this section changes nothing about your Pathway assignment.</p>
        ${items.map(item => opportunityMarkup(taskId, item)).join('')}
      </div>
    </details>`;
  }

  function opportunityMarkup(taskId, item) {
    const quick = Array.isArray(item.quickAdd) ? item.quickAdd.filter(value => Number.isInteger(Number(value)) && Number(value) > 0) : [];
    const max = Number.isInteger(Number(item.maxContribution)) ? Number(item.maxContribution) : 10000;
    const exactEntry = max > 10;
    return `<article class="pathway-cross-prep-item" data-cross-prep-item data-cross-prep-fact="${esc(item.factId)}" data-cross-prep-max="${max}" data-cross-prep-task-id="${esc(taskId)}">
      <div class="pathway-cross-prep-head"><div><strong>${esc(item.label)}</strong><span>${item.target ? `Target: ${Number(item.target).toLocaleString()} ${esc(item.unit || '')}` : esc(item.unit || '')}</span></div></div>
      <p>${esc(item.prompt || '')}</p>
      ${item.note ? `<small class="pathway-cross-prep-note">${esc(item.note)}</small>` : ''}
      <div class="pathway-cross-prep-actions">
        ${quick.map(amount => `<button class="btn btn-ghost" type="button" data-cross-prep-add="${Number(amount)}">+${Number(amount)} ${esc(item.unit || '')}</button>`).join('')}
        ${exactEntry ? `<div class="pathway-cross-prep-exact"><input type="number" min="1" max="${max}" step="1" inputmode="numeric" placeholder="Actual ${esc(item.unit || 'amount')}" data-cross-prep-exact><button class="btn btn-ghost" type="button" data-cross-prep-record>Record</button></div>` : ''}
        ${item.resourceUrl ? `<a class="btn btn-ghost" href="${esc(item.resourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.resourceLabel || 'Engineer reference')} ↗</a>` : ''}
      </div>
      <div class="pathway-cross-prep-status" data-cross-prep-status></div>
    </article>`;
  }

  function bind(container) {
    if (!container) return;
    container.querySelectorAll('[data-cross-prep-item]').forEach(item => {
      item.querySelectorAll('[data-cross-prep-add]').forEach(button => button.addEventListener('click', () => {
        record(item, Number(button.dataset.crossPrepAdd));
      }));
      item.querySelector('[data-cross-prep-record]')?.addEventListener('click', () => {
        const input = item.querySelector('[data-cross-prep-exact]');
        const amount = Number(input?.value);
        if (!Number.isInteger(amount) || amount <= 0) return show(item, 'Enter the amount you actually completed.', 'error');
        record(item, amount);
      });
    });
  }

  async function record(item, amount) {
    if (busy || !item || !Number.isInteger(amount) || amount <= 0) return;
    const factId = item.dataset.crossPrepFact || '';
    const taskId = item.dataset.crossPrepTaskId || '';
    const max = Math.max(1, Number(item.dataset.crossPrepMax) || 10000);
    const key = `${taskId}:${factId}`;
    const already = Number(recordedThisView.get(key) || 0);
    const remaining = Math.max(0, max - already);
    if (amount > remaining) {
      return show(item, remaining ? `Record at most ${remaining} more from this task in this page session.` : 'This task’s suggested contribution has already been recorded in this page session.', 'error');
    }

    busy = true;
    setDisabled(item, true);
    show(item, `Recording +${amount} to Engineering Prep…`, 'working');
    try {
      const response = await fetch(`/api/pathway/engineering-campaign?_=${Date.now()}`, {
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/json',
          'X-Mongrels-Request':'pathway-engineering-campaign',
        },
        body:JSON.stringify({ action:'record_counter', factId, amount }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      recordedThisView.set(key, already + amount);
      const counter = (payload.trackedCounters || []).find(entry => entry.id === factId);
      const target = Number(counter?.target);
      const current = Number(counter?.current);
      const suffix = Number.isFinite(current)
        ? Number.isFinite(target) && target > 0
          ? ` Engineering Prep is now ${current.toLocaleString()} / ${target.toLocaleString()}.`
          : ` Engineering Prep is now ${current.toLocaleString()}.`
        : '';
      show(item, `Recorded +${amount}.${suffix}`, 'success');
      const input = item.querySelector('[data-cross-prep-exact]');
      if (input) input.value = '';
      window.dispatchEvent(new CustomEvent('mongrels:engineering-campaign-updated', { detail:{ source:'cross-path-prep' } }));
    } catch (error) {
      console.error('Could not record cross-path Engineering prep', error);
      show(item, 'Could not save that Engineering prep progress. Try again.', 'error');
    } finally {
      busy = false;
      setDisabled(item, false);
    }
  }

  function show(item, message, state = '') {
    const status = item?.querySelector('[data-cross-prep-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function setDisabled(item, disabled) {
    item?.querySelectorAll('button,input').forEach(control => { control.disabled = disabled; });
  }

  window.MongrelEngineeringPrep = { markup, bind };
})();
