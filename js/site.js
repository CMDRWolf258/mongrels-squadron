(() => {
  const button = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (button && nav) button.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const headerWrap = document.querySelector('.nav-wrap');
  const brand = document.querySelector('.brand');
  if (headerWrap && brand && !document.querySelector('[data-member-access]')) {
    const brandHref = brand.getAttribute('href') || '';
    const base = brandHref.startsWith('../') ? '../' : '';
    const memberLink = document.createElement('a');
    memberLink.className = 'member-access-link';
    memberLink.setAttribute('data-member-access', '');
    memberLink.href = `${base}member/`;
    memberLink.innerHTML = '<span class="member-access-dot" aria-hidden="true"></span><span data-member-access-label>Member Login</span>';
    const menuToggle = headerWrap.querySelector('[data-menu-toggle]');
    if (menuToggle) headerWrap.insertBefore(memberLink, menuToggle);
    else headerWrap.appendChild(memberLink);

    fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(response => response.ok ? response.json() : null)
      .then(session => {
        if (!session || !session.authenticated) return;
        memberLink.classList.add('is-authenticated');
        const label = memberLink.querySelector('[data-member-access-label]');
        if (label) label.textContent = `${session.displayName || 'Member'} · ${session.accessLabel || 'Member'}`;
      })
      .catch(() => {});
  }
})();
