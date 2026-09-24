(() => {
  const header = document.querySelector('.site-header');
  const headerWrap = document.querySelector('.nav-wrap');
  const brand = document.querySelector('.brand');
  const nav = document.querySelector('[data-nav]');
  const button = document.querySelector('[data-menu-toggle]');
  let memberMenu = null;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const rootBase = (() => {
    const raw = brand?.getAttribute('href') || '';
    if (!raw) return '';
    if (raw === '/' || raw.endsWith('/')) return raw;
    if (/index\.html(?:[?#].*)?$/i.test(raw)) return raw.replace(/index\.html(?:[?#].*)?$/i, '');
    const slash = raw.lastIndexOf('/');
    return slash >= 0 ? raw.slice(0, slash + 1) : '';
  })();
  const root = path => `${rootBase}${path}`;

  function ensureNavigationStyles() {
    if (document.querySelector('link[data-navigation-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = root('css/navigation-v2.css?v=11');
    link.dataset.navigationV2 = 'true';
    document.head.appendChild(link);
  }

  function currentSection() {
    const path = window.location.pathname.toLowerCase();
    if (/\/start\//.test(path)) return 'start';
    if (/\/(activities|pvp|trading)\//.test(path)) return 'activities';
    if (/\/(operations|projects|carriers|escort)\//.test(path)) return 'command';
    if (/\/(guides|ships|assistant)\//.test(path)) return 'resources';
    if (/\/(about|members|gallery|announcements)\//.test(path)) return 'community';
    if (/\/(recruitment|apply)\//.test(path)) return 'join';
    return '';
  }

  function navGroup(label, key, columns, footer = '') {
    const current = currentSection() === key ? ' is-current' : '';
    const columnHtml = columns.map(column => `
      <div class="nav-mega-column">
        <span class="nav-mega-label">${column.label}</span>
        ${column.links.map(link => `<a href="${link.href}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${link.title}<small>${link.note}</small></a>`).join('')}
      </div>`).join('');
    return `<details class="nav-group${current}" data-nav-key="${key}"><summary>${label}</summary><div class="nav-mega${columns.length === 2 ? ' nav-mega-two' : ''}">${columnHtml}${footer ? `<div class="nav-mega-footer">${footer}</div>` : ''}</div></details>`;
  }

  function installNavigation() {
    if (!header || !headerWrap || !nav) return;
    ensureNavigationStyles();
    header.classList.add('site-header-v2');
    headerWrap.classList.add('nav-wrap-v2');
    nav.classList.add('nav-links-v2');

    const startCurrent = currentSection() === 'start' ? ' aria-current="page"' : '';
    const joinCurrent = currentSection() === 'join' ? ' aria-current="page"' : '';

    nav.innerHTML = `
      <a href="${root('start/')}"${startCurrent}>Start Here</a>
      ${navGroup('Activities', 'activities', [
        { label:'Combat', links:[
          { href:root('activities/#combat'), title:'Combat Overview', note:'PvE, PvP, AX and surface combat' },
          { href:root('pvp/'), title:'PvP', note:'Training, Bounty Board and combat tools' },
          { href:root('activities/#ax'), title:'Anti-Xeno', note:'Guided AX pathways, training and combat progression' },
        ]},
        { label:'Industry & Discovery', links:[
          { href:root('guides/mining/'), title:'Mining', note:'Field Manual and mining workflows' },
          { href:root('trading/'), title:'Trade & Logistics', note:"Trader's Outpost and hauling" },
          { href:root('activities/#exploration'), title:'Exploration & Exobiology', note:'Browse the activity and future pathway' },
        ]},
        { label:'Galaxy & Frontier', links:[
          { href:root('guides/bgs/'), title:'BGS', note:'Operator Manual and faction mechanics' },
          { href:root('projects/'), title:'Colonization', note:'Projects, construction and frontier work' },
          { href:root('activities/#powerplay'), title:'Powerplay', note:'Dedicated content is planned' },
        ]},
      ], '<strong>Not sure what sounds fun?</strong><span>Open Activities and browse without committing to a specialty.</span>')}
      ${navGroup('Command', 'command', [
        { label:'Current Squadron Work', links:[
          { href:root('operations/'), title:'Mission Control', note:'Strategic picture and priority systems' },
          { href:root('operations/#daily-orders'), title:'Daily Orders', note:'What the squad needs right now' },
          { href:root('projects/'), title:'Projects & Events', note:'Campaigns, construction and expeditions' },
        ]},
        { label:'Coordination', links:[
          { href:root('carriers/#carrier-coordination'), title:'Carrier Coordination', note:'Fleet carriers, movement and logistics' },
          { href:root('escort/'), title:'Combat Escort Network', note:'Live protection and support requests' },
          { href:root('guides/operations/'), title:'Operations Field Manual', note:'Prepare for squad operations' },
          { href:root('member/'), title:'Member Portal', note:'Private member starting point' },
        ]},
      ])}
      ${navGroup('Resources', 'resources', [
        { label:'Learn & Look Up', links:[
          { href:root('guides/'), title:'Mongrel Field Manual', note:'Guides for activities and mechanics' },
          { href:root('guides/engineering/'), title:'Engineering', note:'Build philosophy and module modification' },
          { href:root('guides/reference/'), title:'Reference Database', note:'Dense lookups and exact mechanics' },
          { href:root('guides/glossary/'), title:'Glossary', note:'Acronyms and Elite terminology' },
        ]},
        { label:'Build & Tools', links:[
          { href:root('ships/'), title:'Ship Catalogue', note:'Mongrel builds and EDSY links' },
          { href:root('guides/resources/'), title:'Mongrel Toolbox', note:'Trusted specialist tools, apps and databases' },
          { href:root('assistant/'), title:'Ask the Mongrels', note:'Ask questions and get routed to the right knowledge' },
        ]},
      ])}
      ${navGroup('Community', 'community', [
        { label:'The Pack', links:[
          { href:root('about/'), title:'About the Mongrels', note:'History, identity and squad rules' },
          { href:root('announcements/'), title:'Announcements', note:'Official squad notices and leadership updates' },
          { href:root('members/'), title:'Squadron Roster', note:'Members, specialties and profiles' },
          { href:root('gallery/'), title:'Gallery', note:'Ships, operations and discoveries' },
        ]},
        { label:'Connect', links:[
          { href:'https://discord.com/invite/EWWKJrfAFJ', title:'Discord', note:'Coordination and day-to-day community', external:true },
          { href:root('recruitment/'), title:'Recruitment', note:'How to join the Regiment' },
        ]},
      ])}
      <a href="${root('recruitment/')}"${joinCurrent}>Join Us</a>`;
  }

  installNavigation();

  const groups = [...document.querySelectorAll('.site-header-v2 details.nav-group')];
  const closeGroups = except => groups.forEach(group => { if (group !== except) group.open = false; });
  const compactNav = () => window.matchMedia('(max-width:1060px)').matches;

  const pinActivitiesTop = group => {
    if (!nav || !compactNav() || group?.dataset?.navKey !== 'activities') return;
    nav.scrollTop = 0;
  };

  groups.forEach(group => {
    const summary = group.querySelector(':scope > summary');
    summary?.addEventListener('click', event => {
      if (!compactNav()) return;
      event.preventDefault();
      const opening = !group.open;
      if (!opening) {
        group.open = false;
        return;
      }
      if (group.dataset.navKey === 'activities' && nav) nav.scrollTop = 0;
      closeGroups(group);
      group.open = true;
      if (memberMenu) memberMenu.open = false;
      pinActivitiesTop(group);
    });

    group.addEventListener('toggle', () => {
      if (!group.open) return;
      closeGroups(group);
      if (memberMenu) memberMenu.open = false;
      pinActivitiesTop(group);
    });
  });

  if (button && nav) button.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    if (open) nav.scrollTop = 0;
    else closeGroups();
    if (memberMenu) memberMenu.open = false;
  });

  nav?.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if (link.hash && link.pathname === window.location.pathname) {
      nav.classList.remove('open');
      button?.setAttribute('aria-expanded', 'false');
      closeGroups();
    }
  });

  document.addEventListener('click', event => {
    if (nav?.classList.contains('open') && !event.target.closest('.site-header-v2 [data-nav]') && !event.target.closest('.site-header-v2 [data-menu-toggle]')) {
      nav.classList.remove('open');
      button?.setAttribute('aria-expanded', 'false');
      closeGroups();
    }
    if (!event.target.closest('.site-header-v2 .nav-group')) closeGroups();
    if (memberMenu && !event.target.closest('.member-access-menu')) memberMenu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeGroups();
      if (memberMenu) memberMenu.open = false;
      nav?.classList.remove('open');
      button?.setAttribute('aria-expanded', 'false');
    }
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  if (headerWrap && brand && !document.querySelector('[data-member-access]')) {
    const memberLink = document.createElement('a');
    memberLink.className = 'member-access-link';
    memberLink.setAttribute('data-member-access', '');
    memberLink.href = root('member/');
    memberLink.innerHTML = '<span class="member-access-dot" aria-hidden="true"></span><span data-member-access-label>Member Login</span>';
    if (button) headerWrap.insertBefore(memberLink, button);
    else headerWrap.appendChild(memberLink);

    const activateMemberMenu = session => {
      if (!session || !session.authenticated) return false;
      const menu = document.createElement('details');
      menu.className = 'member-access-menu';
      menu.setAttribute('data-member-access', '');
      const displayName = escapeHtml(session.displayName || 'Member');
      const accessLabel = escapeHtml(session.accessLabel || 'Member');
      menu.innerHTML = `
        <summary><span class="member-access-dot" aria-hidden="true"></span><span class="member-access-name">${displayName} · ${accessLabel}</span></summary>
        <div class="member-access-menu-panel">
          <a class="member-access-pathway" href="${root('pathway/')}"><strong>My Pathway</strong><small>Personal goals, interests and next steps</small></a>
          <a href="${root('pursuits/')}"><strong>Mongrel Pursuits</strong><small>Activities you enjoy and want to fly with the pack</small></a>
          <a href="${root('member/')}"><strong>Member Portal</strong><small>Tasking, projects and private squad tools</small></a>
          <a href="${root('profile/')}"><strong>My Profile</strong><small>Roster identity, specialties and showcase</small></a>
          <a class="member-access-signout" href="/api/auth/logout?return=%2F">Sign Out</a>
        </div>`;
      menu.addEventListener('toggle', () => {
        if (menu.open) {
          closeGroups();
          nav?.classList.remove('open');
          button?.setAttribute('aria-expanded', 'false');
        }
      });
      memberLink.replaceWith(menu);
      memberMenu = menu;
      return true;
    };

    const fetchSession = () => fetch(`/api/auth/session?_=${Date.now()}`, {
      credentials: 'same-origin',
      headers: { Accept:'application/json' },
      cache:'no-store',
    }).then(response => response.ok ? response.json() : null);

    const callbackJustReturned = new URLSearchParams(window.location.search).get('login') === 'success';
    const delays = callbackJustReturned ? [0, 250, 700] : [0];

    (async () => {
      for (const delay of delays) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        const session = await fetchSession().catch(() => null);
        if (activateMemberMenu(session)) return;
      }
    })();
  }
})();
