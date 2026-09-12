(() => {
  const status = document.querySelector('[data-auth-status]');
  const detail = document.querySelector('[data-auth-detail]');
  const login = document.querySelector('[data-discord-login]');
  const profile = document.querySelector('[data-auth-profile]');
  const signedOut = document.querySelector('[data-auth-signed-out]');
  const params = new URLSearchParams(window.location.search);
  const loginResult = params.get('login');

  const resultMessages = {
    denied: 'Discord authorization was cancelled. No changes were made.',
    state_error: 'The login request expired or could not be verified. Please try again.',
    server_error: 'Discord login reached the site, but the secure callback failed. Please try again.',
    no_access: 'Discord sign-in succeeded, but this account does not currently have Mongrel website access.',
  };

  const cleanLoginQuery = () => {
    if (!window.history || !window.history.replaceState) return;
    const clean = new URL(window.location.href);
    clean.searchParams.delete('login');
    clean.searchParams.delete('level');
    window.history.replaceState({}, document.title, `${clean.pathname}${clean.search}${clean.hash}`);
  };

  const updateHeader = session => {
    if (!session || !session.authenticated) return;
    const memberLink = document.querySelector('[data-member-access]');
    if (!memberLink) return;
    memberLink.classList.add('is-authenticated');
    const label = memberLink.querySelector('[data-member-access-label]');
    if (label) label.textContent = `${session.displayName || 'Member'} · ${session.accessLabel || 'Member'}`;
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

  const renderFinishing = () => {
    if (signedOut) signedOut.hidden = false;
    if (profile) profile.hidden = true;
    if (status) status.textContent = 'Finishing secure sign-in…';
    if (detail) detail.textContent = 'Discord verified your account. The site is confirming your secure session now.';
    if (login) {
      login.setAttribute('aria-disabled', 'true');
      login.classList.add('is-disabled');
      login.removeAttribute('href');
    }
  };

  const renderSession = session => {
    if (!session || !session.authenticated) return false;
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
    updateHeader(session);
    cleanLoginQuery();
    return true;
  };

  const fetchSession = () => fetch(`/api/auth/session?_=${Date.now()}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  }).then(response => {
    if (!response.ok) throw new Error('Auth backend unavailable');
    return response.json();
  });

  const finishLogin = async () => {
    if (loginResult === 'success') renderFinishing();

    const delays = loginResult === 'success' ? [0, 200, 500, 1000, 1600] : [0];
    let lastSession = null;

    for (const delay of delays) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const session = await fetchSession();
        lastSession = session;
        if (renderSession(session)) return;
      } catch (error) {
        if (delay === delays[delays.length - 1]) throw error;
      }
    }

    if (lastSession && !lastSession.authenticated) renderSignedOut();
  };

  finishLogin().catch(() => {
    if (status) status.textContent = 'Authentication service unavailable';
    if (detail) detail.textContent = 'The public site is available, but the secure member service could not be reached.';
    if (login) {
      login.removeAttribute('aria-disabled');
      login.classList.remove('is-disabled');
      login.href = '/api/auth/login?return=%2Fmember%2F';
    }
  });
})();
