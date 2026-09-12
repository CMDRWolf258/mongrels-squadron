(() => {
  const status = document.querySelector('[data-auth-status]');
  const detail = document.querySelector('[data-auth-detail]');
  const login = document.querySelector('[data-discord-login]');
  const profile = document.querySelector('[data-auth-profile]');
  const signedOut = document.querySelector('[data-auth-signed-out]');

  const renderSetup = () => {
    if (status) status.textContent = 'Authentication backend not connected yet';
    if (detail) detail.textContent = 'The member portal interface is ready. Discord OAuth and secure role checks will be connected in the next phase.';
    if (login) {
      login.setAttribute('aria-disabled', 'true');
      login.classList.add('is-disabled');
      login.addEventListener('click', event => event.preventDefault());
    }
  };

  const renderSession = session => {
    if (!session || !session.authenticated) return renderSetup();
    if (signedOut) signedOut.hidden = true;
    if (profile) {
      profile.hidden = false;
      profile.querySelector('[data-member-name]').textContent = session.displayName || 'Mongrel Member';
      profile.querySelector('[data-member-level]').textContent = session.accessLabel || 'Member';
    }
    if (status) status.textContent = 'Signed in with Discord';
    if (detail) detail.textContent = 'Your website permissions are determined by Mongrel access rules, not by Discord server ownership.';
  };

  // This endpoint intentionally does not exist on GitHub Pages. Once the site
  // is moved behind the secure backend it will return the authenticated session.
  fetch('./api/session', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error('Auth backend unavailable');
      return response.json();
    })
    .then(renderSession)
    .catch(renderSetup);
})();
