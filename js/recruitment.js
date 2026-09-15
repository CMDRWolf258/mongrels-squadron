(() => {
  const wrap = document.querySelector('[data-recruitment-actions]');
  const primary = document.querySelector('[data-recruitment-primary]');
  const secondary = document.querySelector('[data-recruitment-secondary]');
  const status = document.querySelector('[data-recruitment-status]');
  if (!wrap || !primary) return;

  const setLink = (element, label, href, external = false) => {
    if (!element) return;
    element.textContent = label;
    element.href = href;
    element.hidden = false;
    if (external) { element.target = '_blank'; element.rel = 'noopener noreferrer'; }
    else { element.removeAttribute('target'); element.removeAttribute('rel'); }
  };

  async function load() {
    try {
      const response = await fetch('/api/auth/session', { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
      const session = await response.json();
      if (!session.authenticated) {
        setLink(primary, 'Join Our Discord', 'https://discord.com/invite/EWWKJrfAFJ', true);
        setLink(secondary, 'Already in Discord? Apply', '/api/auth/login?return=%2Fapply%2F');
        if (status) status.textContent = 'Discord is the community entrance; the website handles the application.';
        return;
      }

      if (['member','officer','site_admin'].includes(session.access)) {
        const joined = document.createElement('div');
        joined.className = 'joined-state';
        joined.innerHTML = 'Mongrel Member<small>Joined</small>';
        primary.replaceWith(joined);
        setLink(secondary, 'Preview Application Questions', '/apply/');
        if (status) status.textContent = 'You are already part of the Regiment. Recruitment remains visible so you can guide prospective Commanders through the application.';
        return;
      }

      if (!session.membershipVerified) {
        setLink(primary, 'Join Our Discord', 'https://discord.com/invite/EWWKJrfAFJ', true);
        setLink(secondary, 'Sign In Again After Joining', '/api/auth/login?return=%2Frecruitment%2F%23how-to-join');
        if (status) status.textContent = 'Your signed-in Discord account is not currently detected in the Mongrels server.';
        return;
      }

      let label = 'Start Application';
      try {
        const appResponse = await fetch('/api/applications', { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } });
        const appData = await appResponse.json();
        if (appResponse.ok && appData.mine) label = appData.mine.status === 'draft' ? 'Continue Application' : 'Application Status';
      } catch {}
      setLink(primary, label, '/apply/');
      setLink(secondary, 'Open Discord', 'https://discord.com/invite/EWWKJrfAFJ', true);
      if (status) status.textContent = 'Your Discord identity is connected. Applications are completed and tracked here on the site.';
    } catch {
      setLink(primary, 'Join Our Discord', 'https://discord.com/invite/EWWKJrfAFJ', true);
      if (status) status.textContent = 'Recruitment status could not be checked right now.';
    }
  }
  load();
})();