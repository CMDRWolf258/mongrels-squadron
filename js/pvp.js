(() => {
  const board = document.getElementById('bountyBoard');
  const filter = document.getElementById('bountyFilter');
  if (!board) return;

  let bounties = [];

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const normalizeStatus = value => String(value || 'active').toLowerCase();

  function render() {
    const selected = filter?.value || 'active';
    const visible = bounties.filter(item => selected === 'all' || normalizeStatus(item.status) === selected);

    if (!visible.length) {
      board.innerHTML = `
        <div class="data-empty-state">
          <span class="data-empty-icon">◇</span>
          <div><strong>No ${selected === 'all' ? '' : escapeHtml(selected) + ' '}bounties posted.</strong><p>Contracts added to <code>data/bounties.json</code> will appear here automatically.</p></div>
        </div>`;
      return;
    }

    board.innerHTML = visible.map(item => {
      const status = normalizeStatus(item.status);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      return `
        <article class="bounty-card bounty-${escapeHtml(status)}">
          <div class="bounty-card-head">
            <span class="bounty-status">${escapeHtml(status)}</span>
            <span class="bounty-id">${escapeHtml(item.id || '')}</span>
          </div>
          <p class="bounty-kicker">Target Commander</p>
          <h3>${escapeHtml(item.target || 'Unknown CMDR')}</h3>
          <div class="bounty-reward"><span>Reward</span><strong>${escapeHtml(item.reward || 'To be determined')}</strong></div>
          <p class="bounty-reason">${escapeHtml(item.reason || 'No contract details supplied.')}</p>
          <dl class="bounty-meta">
            <div><dt>Posted by</dt><dd>${escapeHtml(item.issuer || 'Mongrel Leadership')}</dd></div>
            <div><dt>Expires</dt><dd>${escapeHtml(item.expires || 'Open')}</dd></div>
            <div><dt>Proof</dt><dd>${escapeHtml(item.proof || 'Combat evidence')}</dd></div>
          </dl>
          ${tags.length ? `<div class="bounty-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </article>`;
    }).join('');
  }

  fetch('../data/bounties.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Unable to load bounty data');
      return response.json();
    })
    .then(data => {
      bounties = Array.isArray(data) ? data : (data.bounties || []);
      render();
    })
    .catch(() => {
      board.innerHTML = '<div class="data-empty-state"><span class="data-empty-icon">◇</span><div><strong>Bounty board unavailable.</strong><p>Check <code>data/bounties.json</code> and try again.</p></div></div>';
    });

  filter?.addEventListener('change', render);
})();
