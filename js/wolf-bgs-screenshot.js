(() => {
  const API = '/api/operations/wolf-bgs-screenshot';
  const MAX_BYTES = 8 * 1024 * 1024;
  const MAX_IMAGES = 3;
  const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
  const ALLOWED = new Set(['image/png','image/jpeg','image/webp']);
  const sets = new WeakMap();

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  const pct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '—';

  function systemName(card) { return card.dataset.system || ''; }
  function currentSet(card) { return sets.get(card) || []; }

  function currentFactions(card) {
    return [...card.querySelectorAll('[data-faction-row]')].map(row => ({
      name: row.querySelector('[data-faction="name"]')?.value?.trim() || '',
      influence: row.querySelector('[data-faction="influence"]')?.value === '' ? null : Number(row.querySelector('[data-faction="influence"]')?.value),
    })).filter(row => row.name);
  }

  function sectionMarkup() {
    return `<section class="wolf-section wolf-screenshot-import" data-screenshot-import-section>
      <h3>Screenshot Import</h3>
      <p class="wolf-section-intro">Build a screenshot set by pasting, dropping, or choosing up to ${MAX_IMAGES} Elite Dangerous faction-standing screenshots. Add them one at a time or all at once. The set is interpreted together; nothing is saved until you apply reviewed values to the form and then press <b>Submit Status</b>.</p>
      <div class="wolf-screenshot-drop" data-screenshot-drop tabindex="0" role="button" aria-label="Paste, drop, or choose BGS screenshots">
        <input type="file" accept="image/png,image/jpeg,image/webp" data-screenshot-file multiple hidden>
        <div class="wolf-screenshot-drop-copy">
          <strong>Paste or drop screenshot here</strong>
          <span>Each Ctrl+V or drop adds to the current set</span>
          <small>1–${MAX_IMAGES} screenshots · PNG, JPG, or WebP · 8 MB each</small>
        </div>
        <button type="button" class="btn btn-secondary btn-compact" data-screenshot-choose>Add Screenshot(s)</button>
      </div>
      <div class="wolf-screenshot-selection" data-screenshot-selection hidden>
        <div class="wolf-screenshot-set-head">
          <div><strong data-screenshot-count>0 screenshots</strong><span data-screenshot-total-size></span></div>
          <div class="wolf-screenshot-selection-actions"><button type="button" class="btn btn-primary btn-compact" data-screenshot-analyze>Interpret Screenshot Set</button><button type="button" class="btn btn-secondary btn-compact" data-screenshot-clear>Clear Set</button></div>
        </div>
        <div class="wolf-screenshot-items" data-screenshot-items></div>
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

  function resetReview(card) {
    card._wolfScreenshotExtraction = null;
    const review = card.querySelector('[data-screenshot-review]');
    if (review) review.innerHTML = '';
  }

  function revokeSet(items) {
    for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
  }

  function clearSelection(card) {
    revokeSet(currentSet(card));
    sets.delete(card);
    resetReview(card);
    const selection = card.querySelector('[data-screenshot-selection]');
    const input = card.querySelector('[data-screenshot-file]');
    if (selection) selection.hidden = true;
    if (input) input.value = '';
    setMessage(card, '');
  }

  function totalBytes(items) {
    return items.reduce((sum, item) => sum + (Number(item.file?.size) || 0), 0);
  }

  function renderSelection(card) {
    const items = currentSet(card);
    const selection = card.querySelector('[data-screenshot-selection]');
    const list = card.querySelector('[data-screenshot-items]');
    const count = card.querySelector('[data-screenshot-count]');
    const total = card.querySelector('[data-screenshot-total-size]');
    if (selection) selection.hidden = items.length === 0;
    if (count) count.textContent = `${items.length} screenshot${items.length === 1 ? '' : 's'} in set`;
    if (total) total.textContent = `${(totalBytes(items) / 1024 / 1024).toFixed(2)} MB total`;
    if (list) {
      list.innerHTML = items.map((item, index) => `<article class="wolf-screenshot-item">
        <img src="${esc(item.url)}" alt="Screenshot ${index + 1} preview">
        <div><strong>${esc(item.file?.name || `Pasted screenshot ${index + 1}`)}</strong><span>${(Number(item.file?.size || 0) / 1024 / 1024).toFixed(2)} MB</span></div>
        <button type="button" class="wolf-mini-button" data-screenshot-remove="${index}" aria-label="Remove screenshot ${index + 1}">×</button>
      </article>`).join('');
    }
  }

  function validateFile(file) {
    if (!file || !ALLOWED.has(file.type)) return 'Use PNG, JPG, or WebP screenshots.';
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) return 'Each screenshot must be 8 MB or smaller.';
    return '';
  }

  function addFiles(card, incoming) {
    const candidates = [...(incoming || [])].filter(Boolean);
    if (!candidates.length) return;
    const items = [...currentSet(card)];
    let added = 0;
    let lastError = '';

    for (const file of candidates) {
      const error = validateFile(file);
      if (error) { lastError = error; continue; }
      if (items.length >= MAX_IMAGES) { lastError = `A screenshot set can contain at most ${MAX_IMAGES} images.`; break; }
      if (totalBytes(items) + file.size > MAX_TOTAL_BYTES) { lastError = 'The screenshot set is too large. Keep the combined set under 20 MB.'; break; }
      items.push({ file, url:URL.createObjectURL(file) });
      added += 1;
    }

    sets.set(card, items);
    resetReview(card);
    const input = card.querySelector('[data-screenshot-file]');
    if (input) input.value = '';
    renderSelection(card);
    if (added) {
      setMessage(card, `${items.length} screenshot${items.length === 1 ? '' : 's'} ready. Add another or interpret the set. No BGS values have been changed.`, 'working');
    } else if (lastError) {
      setMessage(card, lastError, 'error');
    }
    if (added && lastError) setMessage(card, `${items.length} screenshot${items.length === 1 ? '' : 's'} ready. ${lastError}`, 'working');
  }

  function removeFile(card, index) {
    const items = [...currentSet(card)];
    const item = items[index];
    if (!item) return;
    if (item.url) URL.revokeObjectURL(item.url);
    items.splice(index, 1);
    sets.set(card, items);
    resetReview(card);
    renderSelection(card);
    setMessage(card, items.length ? `${items.length} screenshot${items.length === 1 ? '' : 's'} remain in the set.` : 'Screenshot set cleared.', items.length ? 'working' : '');
  }

  function confidenceClass(value) {
    const n = Number(value) || 0;
    if (n >= 0.9) return 'high';
    if (n >= 0.75) return 'medium';
    return 'low';
  }

  function reviewMarkup(extraction, imageCount) {
    const rows = Array.isArray(extraction?.factions) ? extraction.factions : [];
    const warnings = Array.isArray(extraction?.warnings) ? extraction.warnings : [];
    const body = rows.map(row => {
      const previous = row.previousInfluence;
      const current = Number.isFinite(Number(previous)) ? Number(previous) : null;
      const detected = Number.isFinite(Number(row.influence)) ? Number(row.influence) : null;
      const delta = current !== null && detected !== null ? detected - current : null;
      const confidence = Math.max(0, Math.min(1, Number(row.confidence) || 0));
      const confidenceLabel = `${Math.round(confidence * 100)}%`;
      const observations = Array.isArray(row.observedInfluences) && row.observedInfluences.length > 1
        ? `<small>${row.conflict ? 'Conflicting readings' : 'Seen in set'}: ${row.observedInfluences.map(pct).join(', ')}</small>` : '';
      return `<tr>
        <td><strong>${esc(row.name)}</strong>${row.matchedKnownFaction ? '<small>Matched existing faction</small>' : '<small class="warn">Not matched to current board</small>'}${observations}</td>
        <td>${pct(current)}</td>
        <td><b>${pct(detected)}</b></td>
        <td>${delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`}</td>
        <td><span class="wolf-confidence ${confidenceClass(confidence)}">${confidenceLabel}</span></td>
      </tr>`;
    }).join('');

    const warningHtml = warnings.length ? `<div class="wolf-screenshot-warnings"><strong>Review warnings</strong><ul>${warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : '<div class="wolf-screenshot-ok">No extraction warnings detected.</div>';
    const total = extraction?.totalInfluence === null || extraction?.totalInfluence === undefined ? '—' : `${Number(extraction.totalInfluence).toFixed(2)}%`;
    const ready = Boolean(extraction?.readyToApply);

    return `<div class="wolf-screenshot-review-card">
      <div class="wolf-screenshot-review-head"><div><strong>Interpretation Review</strong><span>${imageCount} screenshot${imageCount === 1 ? '' : 's'} analyzed · ${rows.length} faction row${rows.length === 1 ? '' : 's'} detected · total ${esc(total)}</span></div><span class="wolf-chip">${esc(extraction?.screenType || 'unknown')}</span></div>
      ${warningHtml}
      <div class="wolf-table-scroll"><table class="wolf-screenshot-table"><thead><tr><th>Faction</th><th>Current</th><th>Detected</th><th>Change</th><th>Confidence</th></tr></thead><tbody>${body || '<tr><td colspan="5">No readable faction influence values detected.</td></tr>'}</tbody></table></div>
      <div class="wolf-screenshot-review-actions"><span>${ready ? 'The set covers the known faction board and passes the total-influence check. Applying only fills matched influence fields; it does not submit or save the snapshot.' : 'This set is not complete enough to apply safely. Add/correct screenshots until every known faction is covered and the combined total is approximately 100%.'}</span><button type="button" class="btn btn-primary btn-compact" data-screenshot-apply ${ready ? '' : 'disabled'}>Apply Matched Influence to Form</button></div>
    </div>`;
  }

  async function analyze(card) {
    const items = currentSet(card);
    if (!items.length) {
      setMessage(card, 'Add at least one screenshot first.', 'error');
      return;
    }
    const button = card.querySelector('[data-screenshot-analyze]');
    if (button) button.disabled = true;
    setMessage(card, `Interpreting ${items.length}-screenshot set…`, 'working');

    const form = new FormData();
    items.forEach((item, index) => form.append('images', item.file, item.file.name || `bgs-screenshot-${index + 1}.png`));
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
      if (review) review.innerHTML = reviewMarkup(data.extraction || {}, Number(data.imageCount) || items.length);
      const count = data.extraction?.factions?.filter(row => row.influence !== null).length || 0;
      const ready = Boolean(data.extraction?.readyToApply);
      setMessage(card, count ? `Interpretation complete: ${count} influence value${count === 1 ? '' : 's'} detected. ${ready ? 'Set is complete and ready for review/application.' : 'Review warnings or add another screenshot before applying.'}` : 'Interpretation finished, but no usable influence values were detected.', ready ? 'success' : (count ? 'working' : 'error'));
    } catch (error) {
      console.error(error);
      const friendly = ({
        screenshot_ai_not_configured:'Screenshot interpretation is not configured.',
        assistant_user_budget_exhausted:'Monthly AI usage limit reached.',
        assistant_site_budget_exhausted:'Site AI usage limit reached.',
        screenshot_ai_busy:'Screenshot interpretation is temporarily busy.',
        screenshot_parse_failed:'The screenshot set was read, but the result could not be parsed safely.',
        too_many_images:`A screenshot set can contain at most ${MAX_IMAGES} images.`,
        image_set_too_large:'The screenshot set is too large. Keep the combined set under 20 MB.',
      })[error.message] || 'Could not interpret this screenshot set. Try a clearer image or remove an unrelated screenshot.';
      setMessage(card, friendly, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function apply(card) {
    const extraction = card._wolfScreenshotExtraction;
    if (!extraction?.readyToApply) {
      setMessage(card, 'This screenshot set has not passed the completeness checks, so nothing was applied.', 'error');
      return;
    }
    const rows = Array.isArray(extraction?.factions) ? extraction.factions : [];
    let applied = 0;
    for (const result of rows) {
      if (!result.matchedKnownFaction || result.conflict || !Number.isFinite(Number(result.influence))) continue;
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

  function clipboardImages(event) {
    return [...(event.clipboardData?.items || [])]
      .filter(entry => entry.type.startsWith('image/'))
      .map(entry => entry.getAsFile())
      .filter(Boolean);
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
      const remove = event.target.closest('[data-screenshot-remove]');
      if (remove) { removeFile(card, Number(remove.dataset.screenshotRemove)); return; }
      if (event.target.closest('[data-screenshot-apply]')) { apply(card); }
    });

    input?.addEventListener('change', () => addFiles(card, input.files));

    zone?.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('dragging');
    });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone?.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('dragging');
      addFiles(card, [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith('image/')));
    });
    zone?.addEventListener('paste', event => {
      const images = clipboardImages(event);
      if (!images.length) return;
      event.preventDefault();
      addFiles(card, images);
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
