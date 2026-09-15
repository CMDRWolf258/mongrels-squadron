(() => {
  const form = document.querySelector('[data-carrier-form]');
  const shell = document.querySelector('[data-carrier-editor-shell]');
  if (!form || !shell) return;

  const MAX_ROLE_LENGTH = 80;
  const originalSelect = form.querySelector('[data-carrier-role-edit]');
  if (!originalSelect) return;

  const standardRoles = [...originalSelect.options]
    .map(option => option.textContent.trim())
    .filter(role => role && role !== 'Other');

  const hostLabel = originalSelect.closest('label');
  const heading = hostLabel?.querySelector(':scope > span');
  if (heading) heading.textContent = 'Primary Roles';

  const roleValue = document.createElement('input');
  roleValue.type = 'hidden';
  roleValue.dataset.carrierRoleEdit = '';
  roleValue.value = originalSelect.value || 'General Logistics';

  const rolePicker = document.createElement('details');
  rolePicker.className = 'carrier-role-picker';
  rolePicker.innerHTML = `
    <summary data-carrier-role-summary>General Logistics</summary>
    <div class="carrier-role-menu">
      <div class="carrier-role-options">
        ${standardRoles.map(role => `<label><input type="checkbox" value="${escapeHtml(role)}" data-carrier-role-option> <span>${escapeHtml(role)}</span></label>`).join('')}
        <label><input type="checkbox" value="Other" data-carrier-role-option data-carrier-role-other> <span>Other</span></label>
      </div>
      <label class="carrier-role-other-field" data-carrier-role-other-wrap hidden>
        <span>Custom Primary Role</span>
        <input type="text" maxlength="60" data-carrier-role-other-text placeholder="Enter your role">
      </label>
      <small data-carrier-role-help>Select one or more roles. They will display as a comma-separated list.</small>
    </div>`;

  originalSelect.replaceWith(roleValue);
  hostLabel?.appendChild(rolePicker);

  const optionBoxes = [...rolePicker.querySelectorAll('[data-carrier-role-option]')];
  const otherBox = rolePicker.querySelector('[data-carrier-role-other]');
  const otherWrap = rolePicker.querySelector('[data-carrier-role-other-wrap]');
  const otherText = rolePicker.querySelector('[data-carrier-role-other-text]');
  const summary = rolePicker.querySelector('[data-carrier-role-summary]');
  const help = rolePicker.querySelector('[data-carrier-role-help]');
  const status = form.querySelector('[data-carrier-form-status]');

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function splitRoles(value) {
    return String(value || '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
  }

  function selectedRoles() {
    const selected = optionBoxes
      .filter(box => box.checked && box !== otherBox)
      .map(box => box.value);
    if (otherBox.checked && otherText.value.trim()) selected.push(otherText.value.trim());
    return selected;
  }

  function updateRoleValue({ announce = false } = {}) {
    otherWrap.hidden = !otherBox.checked;
    otherText.required = otherBox.checked;
    const roles = selectedRoles();
    const joined = roles.join(', ');
    roleValue.value = joined;
    summary.textContent = joined || (otherBox.checked ? 'Enter custom role…' : 'Choose roles…');
    const tooLong = joined.length > MAX_ROLE_LENGTH;
    help.textContent = tooLong
      ? `Role list is ${joined.length} characters; keep it at ${MAX_ROLE_LENGTH} or fewer.`
      : 'Select one or more roles. They will display as a comma-separated list.';
    help.classList.toggle('carrier-role-error', tooLong);
    if (announce) roleValue.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function syncPickerFromSavedValue() {
    const saved = splitRoles(roleValue.value);
    const custom = saved.filter(role => !standardRoles.includes(role));
    optionBoxes.forEach(box => { box.checked = box !== otherBox && saved.includes(box.value); });
    otherBox.checked = custom.length > 0;
    otherText.value = custom.join(', ');
    updateRoleValue();
  }

  optionBoxes.forEach(box => box.addEventListener('change', () => updateRoleValue({ announce: true })));
  otherText.addEventListener('input', () => updateRoleValue({ announce: true }));

  document.addEventListener('click', event => {
    if (rolePicker.open && !rolePicker.contains(event.target)) rolePicker.removeAttribute('open');
  });

  // Move destructive and discard actions to clearer locations without changing
  // the existing carrier save/delete handlers.
  const actions = form.querySelector('.project-editor-actions');
  const deleteButton = form.querySelector('[data-carrier-delete]');
  const saveButton = form.querySelector('button[type="submit"]');
  const headClose = form.querySelector('.project-editor-head [data-carrier-cancel]');
  if (actions && deleteButton && saveButton && headClose && status) {
    const oldButtonGroup = deleteButton.parentElement;
    const dangerGroup = document.createElement('div');
    dangerGroup.className = 'carrier-editor-danger';
    const primaryGroup = document.createElement('div');
    primaryGroup.className = 'carrier-editor-primary-actions';

    deleteButton.classList.add('carrier-delete-danger');
    dangerGroup.appendChild(deleteButton);
    headClose.remove();
    headClose.textContent = 'Discard Changes';
    primaryGroup.append(headClose, saveButton);

    oldButtonGroup?.remove();
    actions.replaceChildren(dangerGroup, status, primaryGroup);
  }

  function refreshEditorControls() {
    if (shell.hidden) return;
    queueMicrotask(() => {
      syncPickerFromSavedValue();
      const editing = Boolean(form.querySelector('[data-carrier-id]')?.value);
      if (saveButton) saveButton.textContent = editing ? 'Save Changes' : 'Register Carrier';
      if (headClose) headClose.textContent = editing ? 'Discard Changes' : 'Cancel';
      rolePicker.removeAttribute('open');
    });
  }

  new MutationObserver(refreshEditorControls).observe(shell, { attributes: true, attributeFilter: ['hidden'] });

  // Validate before the original carrier submit handler runs.
  form.addEventListener('submit', event => {
    updateRoleValue();
    const roles = selectedRoles();
    if (!roles.length || (otherBox.checked && !otherText.value.trim()) || roleValue.value.length > MAX_ROLE_LENGTH) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (status) {
        status.textContent = !roles.length
          ? 'Select at least one primary role.'
          : roleValue.value.length > MAX_ROLE_LENGTH
            ? `Primary roles must total ${MAX_ROLE_LENGTH} characters or fewer.`
            : 'Enter a custom primary role for Other.';
      }
      rolePicker.open = true;
      return;
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .carrier-role-picker{position:relative;width:100%}
    .carrier-role-picker>summary{list-style:none;cursor:pointer;width:100%;min-height:44px;border:1px solid var(--line);border-radius:9px;background:#0b1014;color:var(--text);padding:12px 38px 12px 12px;position:relative}
    .carrier-role-picker>summary::-webkit-details-marker{display:none}
    .carrier-role-picker>summary::after{content:'▾';position:absolute;right:13px;color:var(--accent)}
    .carrier-role-picker[open]>summary{border-color:var(--line-accent)}
    .carrier-role-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;right:0;padding:12px;border:1px solid var(--line-accent);border-radius:10px;background:#080d10;box-shadow:0 18px 42px rgba(0,0,0,.5)}
    .carrier-role-options{display:grid;gap:5px;max-height:260px;overflow:auto}
    .carrier-role-options label{display:flex;grid-template-columns:none;align-items:center;gap:9px;padding:7px 8px;border-radius:7px;cursor:pointer}
    .carrier-role-options label:hover{background:var(--accent-soft)}
    .carrier-role-options input{width:auto!important;margin:0;accent-color:var(--accent)}
    .carrier-role-other-field{margin-top:9px;padding-top:10px;border-top:1px solid var(--line)}
    .carrier-role-menu small{display:block;margin-top:9px;color:var(--muted);line-height:1.4}
    .carrier-role-menu small.carrier-role-error{color:var(--danger)}
    .carrier-editor-danger{margin-right:auto}
    .carrier-editor-primary-actions{margin-left:auto}
    .carrier-delete-danger{border-color:rgba(255,123,123,.38)!important;color:var(--danger)!important;background:rgba(255,123,123,.07)!important}
    .carrier-delete-danger:hover{border-color:var(--danger)!important;background:rgba(255,123,123,.12)!important}
    @media(max-width:520px){
      .carrier-role-menu{position:relative;top:auto;margin-top:6px}
      .project-editor-actions .carrier-editor-danger,.project-editor-actions .carrier-editor-primary-actions{display:flex;grid-template-columns:none;width:100%}
      .carrier-editor-danger .btn{width:auto}
      .carrier-editor-primary-actions{justify-content:stretch}
      .carrier-editor-primary-actions .btn{flex:1}
    }
  `;
  document.head.appendChild(style);
})();