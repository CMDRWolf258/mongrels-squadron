(() => {
  const button = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (button && nav) button.addEventListener('click', () => { const open = nav.classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); });
  const year = document.querySelector('[data-year]'); if (year) year.textContent = new Date().getFullYear();
})();
