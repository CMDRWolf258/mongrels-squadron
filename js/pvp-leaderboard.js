(() => {
  const section = document.querySelector('[data-pvp-leaderboard-section]');
  if (!section) return;

  const signedOut = section.querySelector('[data-pvp-leaderboard-signed-out]');
  const board = section.querySelector('[data-pvp-leaderboard]');
  const grid = section.querySelector('[data-pvp-leaderboard-grid]');
  const status = section.querySelector('[data-pvp-leaderboard-status]');
  const generated = section.querySelector('[data-pvp-leaderboard-generated]');
  const refresh = section.querySelector('[data-pvp-leaderboard-refresh]');
  const errorBox = section.querySelector('[data-pvp-leaderboard-error]');
  let refreshTimer = 0;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));

  function ageText(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return 'Unknown';
    const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
    if (seconds < 45) return 'Just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  function absoluteTime(value) {
    const date = new Date(value || '');
    if (!Number.isFinite(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, {
      month:'short',
      day:'numeric',
      hour:'numeric',
      minute:'2-digit',
      timeZoneName:'short',
    }).format(date);
  }

  function formatEntry(key, entry, index) {
    if (key === 'overall_winningest_ship') {
      return `<div class="pvp-record-spotlight"><strong>${safe(entry.ship)}</strong></div>`;
    }
    if (key === 'top_victory_hardpoints') {
      return `<div class="pvp-hardpoint-row"><span>#${index + 1}</span><strong>${safe(entry.label)}</strong></div>`;
    }

    const value = key === 'highest_win_percentage'
      ? `${Number(entry.percentage).toFixed(1)}%`
      : String(entry.value);

    return `<div class="pvp-record-row"><strong>${safe(entry.username)}</strong><span>${safe(value)}</span></div>`;
  }

  function renderCategory(category) {
    const entries = Array.isArray(category.entries) ? category.entries : [];
    const tie = entries.length > 1 && !['top_victory_hardpoints'].includes(category.key);
    const body = entries.length
      ? entries.map((entry, index) => formatEntry(category.key, entry, index)).join('')
      : '<div class="pvp-record-empty">No result yet.</div>';

    return `
      <article class="pvp-record-card" data-record-key="${safe(category.key)}">
        <div class="pvp-record-card-head">
          <div><span>${safe(category.label)}</span><h3>${safe(category.title)}</h3></div>
          ${tie ? `<small>TIE · ${entries.length}</small>` : ''}
        </div>
        <div class="pvp-record-card-body">${body}</div>
      </article>`;
  }

  function showError(message) {
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.querySelector('strong').textContent = 'Leaderboard temporarily unavailable';
      errorBox.querySelector('p').textContent = message;
    }
    if (status) {
      status.textContent = 'OFFLINE';
      status.dataset.state = 'offline';
    }
  }

  function clearError() {
    if (errorBox) errorBox.hidden = true;
  }

  function render(payload) {
    clearError();
    signedOut.hidden = true;
    board.hidden = false;
    grid.innerHTML = payload.leaderboard.map(renderCategory).join('');
    if (status) {
      status.textContent = 'DUELBOT LIVE';
      status.dataset.state = 'live';
    }
    if (generated) {
      generated.textContent = `Updated ${ageText(payload.generated_at)} · ${absoluteTime(payload.generated_at)}`;
      generated.dataset.generatedAt = payload.generated_at;
    }
  }

  async function load() {
    if (refresh) refresh.disabled = true;
    if (status) {
      status.textContent = 'SYNCING';
      status.dataset.state = 'loading';
    }

    try {
      const response = await fetch(`/api/pvp/leaderboard?_=${Date.now()}`, {
        credentials:'same-origin',
        cache:'no-store',
        headers:{Accept:'application/json'},
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        signedOut.hidden = false;
        board.hidden = true;
        return;
      }

      signedOut.hidden = true;
      board.hidden = false;

      if (response.status === 403) {
        showError('This leaderboard is available to verified Mongrel members.');
        return;
      }
      if (!response.ok || payload.ok !== true || !Array.isArray(payload.leaderboard)) {
        showError('DuelBot could not be reached right now. The rest of the PvP hub is unaffected.');
        return;
      }

      render(payload);
    } catch {
      signedOut.hidden = true;
      board.hidden = false;
      showError('DuelBot could not be reached right now. The rest of the PvP hub is unaffected.');
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  refresh?.addEventListener('click', load);
  load();
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, 10 * 60 * 1000);

  window.addEventListener('beforeunload', () => {
    if (refreshTimer) window.clearInterval(refreshTimer);
  });
})();
