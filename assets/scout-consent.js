// Purely local consent UI. Prevent accidental double-submission while the
// browser follows the OAuth redirect back to ChatGPT.
(() => {
  const form = document.querySelector('form[method="post"]');
  if (!form) return;
  form.addEventListener('submit', event => {
    const decision = event.submitter?.value === 'approve' ? 'approve' : 'deny';
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'decision';
    field.value = decision;
    form.appendChild(field);
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    const status = document.getElementById('consent-progress');
    if (status) status.hidden = false;
  }, {once: true});
})();
