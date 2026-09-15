(() => {
  const shell = document.querySelector('[data-carrier-editor-shell]');
  const form = document.querySelector('[data-carrier-form]');
  const deleteButton = document.querySelector('[data-carrier-delete]');
  if (!shell || !form || !deleteButton) return;

  const permissions = new Map();
  let loaded = false;

  async function loadPermissions() {
    try {
      const response = await fetch(`/api/carriers?resource=registry&_permissions=${Date.now()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json();
      (Array.isArray(payload.carriers) ? payload.carriers : []).forEach(carrier => {
        permissions.set(carrier.id, {
          canEdit: carrier.canEdit === true,
          canDelete: carrier.canDelete === true,
        });
      });
      loaded = true;
      updateDeleteButton();
    } catch {
      // Fail closed: if permissions cannot be confirmed, do not expose Delete.
    }
  }

  function updateDeleteButton() {
    const id = form.querySelector('[data-carrier-id]')?.value || '';
    if (!id) {
      deleteButton.hidden = true;
      return;
    }
    const permission = permissions.get(id);
    deleteButton.hidden = !loaded || permission?.canDelete !== true;
  }

  // Start hidden until the API explicitly confirms delete permission.
  deleteButton.hidden = true;

  new MutationObserver(() => {
    if (!shell.hidden) queueMicrotask(updateDeleteButton);
  }).observe(shell, { attributes: true, attributeFilter: ['hidden'] });

  form.querySelector('[data-carrier-id]')?.addEventListener('change', updateDeleteButton);
  loadPermissions();
})();
