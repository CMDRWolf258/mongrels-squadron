(() => {
  const root = document.querySelector('[data-engineering-prep-tracker]');
  if (!root) return;

  let busy = false;
  let trackerOpen = false;
  let flash = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(method = 'GET', body = null) {
    const options = { method, credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Mongrels-Request'] = 'pathway-engineering-campaign';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/pathway/engineering-campaign?_=${Date.now()}`, options);
    if (response.status === 401 || response.status === 403) return { unavailable:true };
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function formattedUpdated(value) {
    if (!value) return 'Not recorded yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Updated previously';
    return `Updated ${date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}`;
  }

  function sourceLabel(value) {
    if (value === 'manual') return 'Manual tracking';
    if (!value) return 'Manual tracking';
    return `Source: ${String(value).replace(/[-_]+/g, ' ')}`;
  }

  function statusMarkup(counter) {
    if (!flash || flash.id !== counter.id) return '<div class="engineering-prep-status" data-prep-status></div>';
    return `<div class="engineering-prep-status" data-prep-status data-state="${esc(flash.state || 'success')}">${esc(flash.message || '')}</div>`;
  }

  function targetMarkup(counter, current) {
    const target = Number(counter.target);
    if (!Number.isFinite(target) || target <= 0) return '';
    const percent = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
    const complete = current >= target;
    return `<div class="engineering-prep-target${complete ? ' is-complete' : ''}">
      <div><span>${esc(counter.targetLabel || 'Tracked prerequisite')}</span><strong>${current.toLocaleString()} / ${target.toLocaleString()} ${esc(counter.unit || '')}</strong></div>
      <div class="engineering-prep-track"><i style="width:${percent}%"></i></div>
      <small>${complete ? 'Tracked milestone reached' : `${percent}% tracked`}</small>
    </div>`;
  }

  function cardMarkup(counter) {
    const quick = Array.isArray(counter.quickAdd) ? counter.quickAdd : [];
    const current = Number.isFinite(Number(counter.current)) ? Number(counter.current) : 0;
    return `<article class="engineering-prep-card" data-prep-counter="${esc(counter.id)}">
      <div class="engineering-prep-card-head">
        <div><h4>${esc(counter.label)}</h4><p>${esc(counter.description || '')}</p></div>
        <div class="engineering-prep-total">${current.toLocaleString()}<small>${esc(counter.unit || 'tracked')}</small></div>
      </div>
      ${targetMarkup(counter, current)}
      ${quick.length ? `<div class="engineering-prep-quick" aria-label="Quick add actual progress">${quick.map(amount => `<button type="button" data-prep-add="${Number(amount)}" title="Record ${Number(amount)} additional ${esc(counter.unit || 'items')}">+${Number(amount)}</button>`).join('')}</div>` : ''}
      <div class="engineering-prep-entry">
        <input type="number" min="1" max="10000" step="1" inputmode="numeric" placeholder="How many did you actually do?" aria-label="Actual additional ${esc(counter.unit || 'items')}" data-prep-actual>
        <button class="btn btn-ghost" type="button" data-prep-record>Record Actual Progress</button>
      </div>
      <details class="engineering-prep-correct">
        <summary>Correct the stored total</summary>
        <div class="engineering-prep-entry">
          <input type="number" min="${Number(counter.minimum) || 0}" max="1000000" step="1" inputmode="numeric" value="${current}" aria-label="Correct total ${esc(counter.unit || 'items')}" data-prep-total>
          <button class="btn btn-ghost" type="button" data-prep-correct-total>Save Correct Total</button>
        </div>
        <p style="margin-top:8px">Use this only when you know the cumulative total is wrong. It replaces the stored number rather than adding to it.</p>
      </details>
      <div class="engineering-prep-meta"><span>${esc(sourceLabel(counter.source))}</span><span>${esc(formattedUpdated(counter.updatedAt))}</span></div>
      ${statusMarkup(counter)}
    </article>`;
  }

  function render(data) {
    const counters = Array.isArray(data?.trackedCounters) ? data.trackedCounters : [];
    if (data?.unavailable || !counters.length) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }

    const existing = root.querySelector('details.engineering-prep-tracker');
    if (existing?.open) trackerOpen = true;

    root.hidden = false;
    root.innerHTML = `<details class="engineering-prep-tracker"${trackerOpen ? ' open' : ''}>
      <summary><span>Engineering Prep Tracker</span><small>${counters.length} cumulative ${counters.length === 1 ? 'counter' : 'counters'}</small></summary>
      <div class="engineering-prep-body">
        <p class="engineering-prep-intro">Use this for prerequisites that build gradually across normal play. Record only what you actually completed. If a future prep task suggests five new markets and you only reach three, record three. These totals belong to Engineering preparation and do not award progress in Trade or another pathway.</p>
        <div class="engineering-prep-list">${counters.map(cardMarkup).join('')}</div>
      </div>
    </details>`;

    const tracker = root.querySelector('details.engineering-prep-tracker');
    tracker?.addEventListener('toggle', () => { trackerOpen = Boolean(tracker.open); });

    root.querySelectorAll('[data-prep-counter]').forEach(card => bindCard(card));
  }

  function bindCard(card) {
    const factId = card.dataset.prepCounter;
    card.querySelectorAll('[data-prep-add]').forEach(button => button.addEventListener('click', () => {
      const amount = Number(button.dataset.prepAdd);
      recordProgress(factId, amount);
    }));

    card.querySelector('[data-prep-record]')?.addEventListener('click', () => {
      const input = card.querySelector('[data-prep-actual]');
      const amount = Number(input?.value);
      if (!Number.isInteger(amount) || amount <= 0) return setCardError(card, 'Enter the number you actually completed.');
      recordProgress(factId, amount);
    });

    card.querySelector('[data-prep-correct-total]')?.addEventListener('click', () => {
      const input = card.querySelector('[data-prep-total]');
      const value = Number(input?.value);
      if (!Number.isInteger(value) || value < 0) return setCardError(card, 'Enter a valid cumulative total.');
      correctTotal(factId, value);
    });
  }

  async function recordProgress(factId, amount) {
    if (busy || !factId || !Number.isInteger(amount) || amount <= 0) return;
    busy = true;
    setBusy(`Recording +${amount}…`);
    try {
      trackerOpen = true;
      flash = { id:factId, state:'success', message:`Recorded +${amount} actual progress.` };
      render(await api('POST', { action:'record_counter', factId, amount }));
    } catch (error) {
      console.error('Could not record Engineering prep progress', error);
      flash = { id:factId, state:'error', message:'Could not save that progress. Try again.' };
      try { render(await api()); } catch { /* keep existing error surface when reload also fails */ }
    } finally {
      busy = false;
      enableButtons();
    }
  }

  async function correctTotal(factId, value) {
    if (busy || !factId || !Number.isInteger(value) || value < 0) return;
    busy = true;
    setBusy('Correcting total…');
    try {
      trackerOpen = true;
      flash = { id:factId, state:'success', message:`Stored total corrected to ${value}.` };
      render(await api('POST', { action:'set_counter_total', factId, value }));
    } catch (error) {
      console.error('Could not correct Engineering prep total', error);
      flash = { id:factId, state:'error', message:'Could not correct that total. Try again.' };
      try { render(await api()); } catch { /* keep existing error surface when reload also fails */ }
    } finally {
      busy = false;
      enableButtons();
    }
  }

  function setCardError(card, message) {
    const status = card.querySelector('[data-prep-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = 'error';
  }

  function setBusy(message) {
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const openStatus = root.querySelector('[data-prep-status]');
    if (openStatus && !openStatus.textContent) openStatus.textContent = message;
  }

  function enableButtons() {
    root.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }

  (async () => {
    try { render(await api()); }
    catch (error) {
      console.error('Could not load Engineering prep tracker', error);
      root.hidden = true;
    }
  })();
})();
