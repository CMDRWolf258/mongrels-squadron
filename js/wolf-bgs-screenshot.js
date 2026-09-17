(() => {
  const API = '/api/operations/wolf-bgs-screenshot';
  const MAX_BYTES = 8 * 1024 * 1024;
  const ALLOWED = new Set(['image/png','image/jpeg','image/webp']);
  const files = new WeakMap();
  const previews = new WeakMap();

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  const pct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '—';

  function systemName(card) { return card.dataset.system || ''; }

  function currentFactions(card) {
    return [...card.querySelectorAll('[data-faction-row]')].map(row => ({
      name: row.querySelector('[data-faction="name"]')?.value?.trim() || '',
      influence: row.querySelector('[data-faction="influence"]')?.value === '' ? null : Number(row.querySelector('[data-faction="influence"]')?.value),
    })).filter(row => row.name);
  }

  function sectionMarkup() {
    return `<section class="wolf-section wolf-screenshot-import" data-screenshot-import-section>
      <h3>Screenshot Import</h3>
      <p class="wolf-section-intro">Drop, paste, or choose an Elite Dangerous faction-standing screenshot. The image is interpreted into a review panel first; nothing is saved until you apply values to the form and then press <b>Submit Status</b>.</p>
      <div class="wolf-screenshot-drop" data-screenshot-drop tabindex="0" role="button" aria-label="Drop or choose a BGS screenshot">
        <input type="file" accept="image/png,image/jpeg,image/webp" data-screenshot-file hidden>
        <div class="wolf-screenshot-drop-copy">
          <strong>Drop screenshot here</strong>
          <span>or paste an image / choose a file</span>
          <small>PNG, JPG, or WebP · maximum 8 MB</small>
        </div>
        <button type="button" class="btn btn-secondary btn-compact" data-screenshot-choose>Choose Screenshot</button>
      </div>
      <div class="wolf-screenshot-selection" data-screenshot-selection hidden>
        <img data-screenshot-preview alt="Selected screenshot preview">
        <div><strong data-screenshot-name>Screenshot selected</strong><span data-screenshot-size></span><div class="wolf-screenshot-selection-actions"><button type="button" class="btn btn-primary btn-compact" data-screenshot-analyze>Interpret Screenshot</button><button type="button" class="btn btn-secondary btn-compact" data-screenshot-clear>Clear</button></div></div>
      </div>
      <div class="wolf-status-message" data-screenshot-message></div>
      <div data-screenshot-review></div>
    </section>`;
  }

  function mount(card) {
    if (card.querySelector('[data-screenshot-import-section]')) return;
    const board = [...card.querySelectorAll('.wolf-section')].find(section => norm(section.querySelector('h3')?.textContent) === 'system status & faction board');
    if (!board) return;
    board.insertAdjacentHTML('afterend', sectionMarkup());
    wire(card);
  }

  function setMessage(card, text, mode = '') {
    const el = card.querySelector('[data-screenshot-message]');
    if (!el) return;
    el.textContent = text;
    el.className = `wolf-status-message ${mode}`.trim();
  }

  function clearSelection(card) {
    const oldUrl = previews.get(card);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    previews.delete(card);
    files.delete(card);
    const selection = card.querySelector('[data-screenshot-selection]');
    const review = card.querySelector('[data-screenshot-review]');
    const input = card.querySelector('[data-screenshot-file]');
    if (selection) selection.hidden = true;
    if (review) review.innerHTML = '';
    if (input) input.value = '';
    setMessage(card, '');
  }

  function selectFile(card, file) {
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setMessage(card, 'Use a PNG, JPG, or WebP screenshot.', 'error');
      return;
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) {
      setMessage(card, 'Screenshot must be 8 MB or smaller.', 'error');
      return;
    }

    const oldUrl = previews.get(card);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const url = URL.createObjectURL(file);
    previews.set(card, url);
    files.set(card, file);

    const selection = card.querySelector('[data-screenshot-selection]');
    const img = card.querySelector('[data-screenshot-preview]');
    const name = card.querySelector('[data-screenshot-name]');
    const size = card.querySelector('[data-screenshot-size]');
    const review = card.querySelector('[data-screenshot-review]');
    if (selection) selection.hidden = false;
    if (img) img.src = url;
    if (name) name.textContent = file.name || 'Pasted screenshot';
    if (size) size.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    if (review) review.innerHTML = '';
    setMessage(card, 'Ready to interpret. No BGS values have been changed.', 'working');
  }

  function confidenceClass(value) {
    const n = Number(value) || 0;
    if (n >= 0.9) return 'high';
    if (n >= 0.75) return 'medium';
    return 'low';
  }

  function reviewMarkup(extraction) {
    const rows = Array.isArray(extraction?.factions) ? extraction.factions : [];
    const warnings = Array.isArray(extraction?.warnings) ? extraction.warnings : [];
    const body = rows.map(row => {
      const previous = row.previousInfluence;
      const current = Number.isFinite(Number(previous)) ? Number(previous) : null;
      const detected = Number.isFinite(Number(row.influence)) ? Number(row.influence) : null;
      const delta = current !== null && detected !== null ? detected - current : null;
      const confidence = Math.max(0, Math.min(1, Number(row.confidence) || 0));
      const confidenceLabel = `${Math.round(confidence * 100)}%`;
      return `<tr>
        <td><strong>${esc(row.name)}</strong>${row.matchedKnownFaction ? '<small>Matched existing faction</small>' : '<small class="warn">Not matched to current board</small>'}</td>
        <td>${pct(current)}</td>
        <td><b>${pct(detected)}</b></td>
        <td>${delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`}</td>
        <td><span class="wolf-confidence ${confidenceClass(confidence)}">${confidenceLabel}</span></td>
      </tr>`;
    }).join('');

    const warningHtml = warnings.length ? `<div class="wolf-screenshot-warnings"><strong>Review warnings</strong><ul>${warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : '<div class="wolf-screenshot-ok">No extraction warnings detected.</div>';
    const total = extraction?.totalInfluence === null || extraction?.totalInfluence === undefined ? '—' : `${Number(extraction.totalInfluence).toFixed(2)}%`;

    return `<div class="wolf-screenshot-review-card">
      <div class="wolf-screenshot-review-head"><div><strong>Interpretation Review</strong><span>${rows.length} faction row${rows.length === 1 ? '' : 's'} detected · total ${esc(total)}</span></div><span class="wolf-chip">${esc(extraction?.screenType || 'unknown')}</span></div>
      ${warningHtml}
      <div class="wolf-table-scroll"><table class="wolf-screenshot-table"><thead><tr><th>Faction</th><th>Current</th><th>Detected</th><th>Change</th><th>Confidence</th></tr></thead><tbody>${body || '<tr><td colspan="5">No readable faction influence values detected.</td></tr>'}</tbody></table></div>
      <div class="wolf-screenshot-review-actions"><span>Apply only fills matched influence fields. It does not submit or save the snapshot.</span><button type="button" class="btn btn-primary btn-compact" data-screenshot-apply ${rows.some(row => row.matchedKnownFaction && Number.isFinite(Number(row.influence))) ? '' : 'disabled'}>Apply Matched Influence to Form</button></div>
    </div>`;
  }

  async function analyze(card) {
    const file = files.get(card);
    if (!file) {
      setMessage(card, 'Choose a screenshot first.', 'error');
      return;
    }
    const button = card.querySelector('[data-screenshot-analyze]');
    if (button) button.disabled = true;
    setMessage(card, 'Interpreting screenshot…', 'working');

    const form = new FormData();
    form.append('image', file, file.name || 'bgs-screenshot.png');
    form.append('system', systemName(card));
    form.append('factions', JSON.stringify(currentFactions(card)));

    try {
      const response = await fetch(API, {
        method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{ 'X-Mongrels-Request':'wolf-bgs-control' },
        body:form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Screenshot interpretation failed (${response.status})`);
      card._wolfScreenshotExtraction = data.extraction || null;
      const review = card.querySelector('[data-screenshot-review]');
      if (review) review.innerHTML = reviewMarkup(data.extraction || {});
      const count = data.extraction?.factions?.filter(row => row.influence !== null).length || 0;
      setMessage(card, count ? `Interpretation complete: ${count} influence value${count === 1 ? '' : 's'} detected. Review before applying.` : 'Interpretation finished, but no usable influence values were detected.', count ? 'success' : 'error');
    } catch (error) {
      console.error(error);
      const friendly = ({
        screenshot_ai_not_configured:'Screenshot interpretation is not configured.',
        assistant_user_budget_exhausted:'Monthly AI usage limit reached.',
        assistant_site_budget_exhausted:'Site AI usage limit reached.',
        screenshot_ai_busy:'Screenshot interpretation is temporarily busy.',
        screenshot_parse_failed:'The image was read, but the result could not be parsed safely.',
      })[error.message] || 'Could not interpret this screenshot. Try another crop or clearer image.';
      setMessage(card, friendly, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function apply(card) {
    const extraction = card._wolfScreenshotExtraction;
    const rows = Array.isArray(extraction?.factions) ? extraction.factions : [];
    let applied = 0;
    for (const result of rows) {
      if (!result.matchedKnownFaction || !Number.isFinite(Number(result.influence))) continue;
      const target = [...card.querySelectorAll('[data-faction-row]')].find(row => norm(row.querySelector('[data-faction="name"]')?.value) === norm(result.name));
      const input = target?.querySelector('[data-faction="influence"]');
      if (!input) continue;
      input.value = Number(result.influence).toFixed(2);
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      target.classList.add('wolf-screenshot-applied');
      window.setTimeout(() => target.classList.remove('wolf-screenshot-applied'), 1600);
      applied += 1;
    }
    setMessage(card, applied ? `${applied} matched influence value${applied === 1 ? '' : 's'} applied to the editable faction board. Review them, then press Submit Status when ready.` : 'No matched influence values were applied.', applied ? 'success' : 'error');
  }

  function wire(card) {
    if (card.dataset.screenshotWired === 'true') return;
    card.dataset.screenshotWired = 'true';
    const zone = card.querySelector('[data-screenshot-drop]');
    const input = card.querySelector('[data-screenshot-file]');

    card.addEventListener('click', event => {
      if (event.target.closest('[data-screenshot-choose]')) { input?.click(); return; }
      if (event.target.closest('[data-screenshot-analyze]')) { analyze(card); return; }
      if (event.target.closest('[data-screenshot-clear]')) { clearSelection(card); return; }
      if (event.target.closest('[data-screenshot-apply]')) { apply(card); }
    });

    input?.addEventListener('change', () => selectFile(card, input.files?.[0]));

    zone?.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('dragging');
    });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone?.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('dragging');
      selectFile(card, [...(event.dataTransfer?.files || [])].find(file => file.type.startsWith('image/')));
    });
    zone?.addEventListener('paste', event => {
      const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith('image/'));
      if (!item) return;
      event.preventDefault();
      const file = item.getAsFile();
      if (file) selectFile(card, file);
    });
    zone?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input?.click();
      }
    });
  }

  function enhanceAll() {
    document.querySelectorAll('.wolf-system-card').forEach(mount);
  }

  function watch() {
    const list = document.querySelector('[data-system-list]');
    if (!list || list.dataset.screenshotObserved === 'true') return false;
    list.dataset.screenshotObserved = 'true';
    const observer = new MutationObserver(enhanceAll);
    observer.observe(list, { childList:true, subtree:false });
    return true;
  }

  function init() {
    const wait = () => {
      if (!document.querySelector('[data-system-list]')) { window.setTimeout(wait, 80); return; }
      watch();
      enhanceAll();
    };
    wait();
  }

  init();
})();
