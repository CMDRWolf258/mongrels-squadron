(() => {
  const header = document.querySelector('.site-header-v2');
  if (!header) return;

  const groups = [...header.querySelectorAll('details.nav-group')];
  const menuToggle = header.querySelector('[data-menu-toggle]');
  const nav = header.querySelector('[data-nav]');

  const closeGroups = except => {
    groups.forEach(group => {
      if (group !== except) group.open = false;
    });
  };

  groups.forEach(group => {
    group.addEventListener('toggle', () => {
      if (group.open) closeGroups(group);
    });
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header-v2 .nav-group')) closeGroups();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeGroups();
  });

  menuToggle?.addEventListener('click', () => {
    if (nav && !nav.classList.contains('open')) closeGroups();
  });
})();
