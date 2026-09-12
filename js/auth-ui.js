(() => {
  const status = document.querySelector('[data-auth-status]');
  const detail = document.querySelector('[data-auth-detail]');
  const login = document.querySelector('[data-discord-login]');
  const profile = document.querySelector('[data-auth-profile]');
  const signedOut = document.querySelector('[data-auth-signed-out]');
  const loginResult = new URLSearchParams(window.location.search).get('login');

  const resultMessages = {
    denied: 'Discord authorization was cancelled. No changes were made.',
    state_error: 'The login request expired or could not be verified. Please try again.',
    server_error: 'Discord login reached the site, but the secure callback failed. Please try again.',
    no_access: 'Discord sign-in succeeded, but this account does not currently have Mongrel website access.',
  };

  const renderSignedOut = () => {
    if (signedOut) signedOut.hidden = false;
    if (profile) profile.hidden = true;
    if (status) status.textContent = 'Ready for Discord authentication';
    if (detail) detail.textContent = resultMessages[loginResult] || 'Sign in with Discord to verify your Mongrels website access level.';
    if (login) {
      login.removeAttribute('aria-disabled');
      login.classList.remove('is-disabled');
      login.href = '/api/auth/login?return=%2Fmember%2F';
    }
  };

  const renderSession = session => {
    if (!session || !session.authenticated) return renderSignedOut();
    if (signedOut) signedOut.hidden = true;
    if (profile) {
      profile.hidden = false;
      const name = profile.querySelector('[data-member-name]');
      const level = profile.querySelector('[data-member-level]');
      const sessionDetail = profile.querySelector('[data-member-session-detail]');
      if (name) name.textContent = session.displayName || session.username || 'Mongrel Member';
      if (level) level.textContent = session.accessLabel || 'Member';
      if (sessionDetail) {
        sessionDetail.textContent = session.access === 'no_access'
          ? 'Discord identity verified, but no approved website role was found.'
          : 'Secure session active. Website authority is assigned independently from Discord server ownership.';
      }
    }
  };

  fetch('/api/auth/session', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
    .then(response => {
      if (!response.ok) throw new Error('Auth backend unavailable');
      return response.json();
    })
    .then(renderSession)
    .catch(() => {
      if (status) status.textContent = 'Authentication service unavailable';
      if (detail) detail.textContent = 'The public site is available, but the secure member service could not be reached.';
      if (login) login.href = '/api/auth/login?return=%2Fmember%2F';
    });
})();
