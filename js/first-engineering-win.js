(() => {
  const root = document.querySelector('[data-first-engineering-win]');
  if (!root) return;

  let busy = false;
  let justCompleted = false;
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

  function resourceLink(step) {
    if (!step?.resource) return '';
    const external = Boolean(step.external) || /^https?:\/\//i.test(step.resource);
    return `<a class="btn btn-ghost first-win-resource" href="${esc(step.resource)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>Open Related Resource${external ? ' ↗' : ''}</a>`;
  }

  function safetyMarkup(step) {
    const safety = step?.safety;
    if (!safety) return '';
    const items = Array.isArray(safety.checklist) ? safety.checklist : [];
    return `<div class="first-win-safety">
      <strong>Open-play safety check</strong>
      <p>${esc(safety.warning || '')}</p>
      ${items.length ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function detailMarkup(step) {
    const bits = [];
    if (step?.why) bits.push(`<div class="first-win-note"><strong>Why this step</strong><p>${esc(step.why)}</p></div>`);
    if (step?.stoppingPoint) bits.push(`<div class="first-win-stop"><strong>Stopping point</strong><p>${esc(step.stoppingPoint)}</p></div>`);
    if (step?.payoff) bits.push(`<div class="first-win-note"><strong>What to notice</strong><p>${esc(step.payoff)}</p></div>`);
    return bits.join('');
  }

  function wrap(markup) {
    return `<div class="container first-engineering-win-shell">${markup}</div>`;
  }

  function render(data) {
    const first = data?.firstEngineeringWin;
    if (data?.unavailable || !first || first.readyForPublicUI !== true || first.dismissed) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }

    if (first.complete) {
      if (!justCompleted) {
        root.hidden = true;
        root.innerHTML = '';
        return;
      }
      root.hidden = false;
      root.innerHTML = wrap(`<article class="first-win-card is-complete">
        <div class="first-win-kicker">First Engineering Win</div>
        <h3>You opened the door.</h3>
        <p>You have taken a ship you already use, made a real Engineering improvement, and tested the payoff. From here, deeper Engineering is your choice.</p>
        <div class="first-win-actions"><a class="btn btn-primary" href="../pathway/">Explore My Pathway</a><a class="btn btn-ghost" href="../guides/engineering/">Engineering Guide</a></div>
      </article>`);
      return;
    }

    const step = first.current;
    if (!step) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }

    const completed = Number(first.completed) || 0;
    const total = Number(first.total) || 1;
    const percent = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));

    root.hidden = false;
    root.innerHTML = wrap(`<article class="first-win-card">
      <div class="first-win-head">
        <div><span class="first-win-kicker">Optional Engineering Nudge</span><h3>${esc(first.title)}</h3><p>${esc(first.subtitle)}</p></div>
        <span class="first-win-progress-label">${completed} / ${total}</span>
      </div>
      <div class="first-win-progress"><i><b style="width:${percent}%"></b></i><span>${percent}%</span></div>
      <div class="first-win-current">
        <span class="first-win-stage">${esc(step.stage || 'Next Step')} · Step ${Number(step.index) || completed + 1}</span>
        <h4>${esc(step.title)}</h4>
        <p>${esc(step.objective)}</p>
        ${safetyMarkup(step)}
        ${detailMarkup(step)}
      </div>
      <div class="first-win-actions">
        <button class="btn btn-primary" type="button" data-first-win-done data-fact-id="${esc(step.factId)}">Done / Already Did This</button>
        ${resourceLink(step)}
        <button class="first-win-dismiss" type="button" data-first-win-dismiss>Hide this starter</button>
      </div>
      <p class="first-win-foot">One small step at a time. This starter is optional, and finishing it does not force you into a larger Engineering campaign.</p>
      <div class="first-win-status" data-first-win-status aria-live="polite"></div>
    </article>`);

    root.querySelector('[data-first-win-done]')?.addEventListener('click', completeStep);
    root.querySelector('[data-first-win-dismiss]')?.addEventListener('click', dismiss);
  }

  async function completeStep(event) {
    if (busy) return;
    const factId = event.currentTarget?.dataset?.factId;
    if (!factId) return;
    busy = true;
    setBusy('Saving progress…');
    try {
      const result = await api('POST', { action:'set_first_win_step', factId, complete:true });
      justCompleted = Boolean(result?.firstEngineeringWin?.complete);
      render(result);
    } catch (error) {
      console.error('Could not update First Engineering Win', error);
      setBusy('Could not save that step. Try again.', 'error');
    } finally {
      busy = false;
      enableButtons();
    }
  }

  async function dismiss() {
    if (busy) return;
    if (!window.confirm('Hide First Engineering Win?\n\nThis only hides the optional starter. It does not change your My Pathway preferences or normal Engineering progress.')) return;
    busy = true;
    setBusy('Hiding starter…');
    try {
      render(await api('POST', { action:'dismiss_first_win' }));
    } catch (error) {
      console.error('Could not dismiss First Engineering Win', error);
      setBusy('Could not hide the starter right now.', 'error');
    } finally {
      busy = false;
      enableButtons();
    }
  }

  function setBusy(message, state = 'working') {
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const status = root.querySelector('[data-first-win-status]');
    if (status) {
      status.textContent = message;
      status.dataset.state = state;
    }
  }

  function enableButtons() {
    root.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }

  (async () => {
    try { render(await api()); }
    catch (error) {
      console.error('Could not load First Engineering Win', error);
      root.hidden = true;
    }
  })();
})();
