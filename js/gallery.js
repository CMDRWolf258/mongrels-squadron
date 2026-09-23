(() => {
  const grid = document.querySelector('[data-gallery-grid]');
  const filters = document.querySelector('[data-gallery-filters]');
  const count = document.querySelector('[data-gallery-count]');
  const lightbox = document.querySelector('[data-lightbox]');
  const lightboxImage = document.querySelector('[data-lightbox-image]');
  const lightboxTitle = document.querySelector('[data-lightbox-title]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption]');
  const lightboxCredit = document.querySelector('[data-lightbox-credit]');
  if (!grid || !filters) return;

  const memberSignin = document.querySelector('[data-gallery-member-signin]');
  const memberTools = document.querySelector('[data-gallery-member-tools]');
  const quotaText = document.querySelector('[data-gallery-quota]');
  const submitForm = document.querySelector('[data-gallery-submit-form]');
  const submitTitle = document.querySelector('[data-gallery-submit-title]');
  const submitCaption = document.querySelector('[data-gallery-submit-caption]');
  const tagPicker = document.querySelector('[data-gallery-tag-picker]');
  const uploadDrop = document.querySelector('[data-gallery-upload-drop]');
  const uploadFile = document.querySelector('[data-gallery-upload-file]');
  const uploadEmpty = document.querySelector('[data-gallery-upload-empty]');
  const uploadPreview = document.querySelector('[data-gallery-upload-preview]');
  const uploadPreviewImage = document.querySelector('[data-gallery-upload-preview-img]');
  const uploadPreviewName = document.querySelector('[data-gallery-upload-preview-name]');
  const uploadChoose = document.querySelector('[data-gallery-upload-choose]');
  const submitButton = document.querySelector('[data-gallery-submit]');
  const submitStatus = document.querySelector('[data-gallery-submit-status]');
  const mineWrap = document.querySelector('[data-gallery-mine]');
  const reviewSection = document.querySelector('[data-gallery-review-section]');
  const reviewGrid = document.querySelector('[data-gallery-review-grid]');
  const pendingCount = document.querySelector('[data-gallery-pending-count]');
  const adminSection = document.querySelector('[data-gallery-admin-section]');
  const adminGrid = document.querySelector('[data-gallery-admin-grid]');
  const adminCount = document.querySelector('[data-gallery-admin-count]');

  const base = '../assets/images/gallery/';
  const imageVersion = 'hq-20260915-1';
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/png','image/jpeg','image/webp']);
  let staticItems = [];
  let approvedItems = [];
  let items = [];
  let active = 'All';
  let apiState = null;
  let selectedFile = null;
  let selectedPreviewUrl = '';
  let uploadBusy = false;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const apiFetch = async (url, options = {}) => {
    const requestUrl = options.method ? url : `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
    const response = await fetch(requestUrl, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const itemKey = item => item.id || `static:${item.src}`;
  const imageUrl = item => item.url || `${base}${item.src}?v=${imageVersion}`;

  function card(item) {
    const tags = (item.tags || []).map(tag => `<span>${safe(tag)}</span>`).join('');
    return `<button class="gallery-card" type="button" data-gallery-open="${safe(itemKey(item))}" aria-label="Open ${safe(item.title)}">
      <span class="gallery-image-wrap"><img src="${safe(imageUrl(item))}" alt="${safe(item.title)}" loading="lazy"></span>
      <span class="gallery-card-copy"><strong>${safe(item.title)}</strong><span class="gallery-tags">${tags}</span></span>
    </button>`;
  }

  function rebuildGallery() {
    items = [...approvedItems, ...staticItems];
    const tags = [...new Set(items.flatMap(item => item.tags || []))].sort();
    if (active !== 'All' && !tags.includes(active)) active = 'All';
    filters.innerHTML = ['All', ...tags].map(tag => `<button type="button" data-filter="${safe(tag)}">${safe(tag)}</button>`).join('');
    const requested = new URLSearchParams(location.search).get('filter');
    if (requested && !window.__galleryFilterHandled && (requested === 'All' || tags.includes(requested))) {
      window.__galleryFilterHandled = true;
      active = requested;
    }
    render();
  }

  function render() {
    const visible = active === 'All' ? items : items.filter(item => (item.tags || []).includes(active));
    grid.innerHTML = visible.length
      ? visible.map(card).join('')
      : '<div class="placeholder"><strong>No images in this view.</strong><p class="muted">Try another Gallery filter.</p></div>';
    if (count) count.textContent = `${visible.length} image${visible.length === 1 ? '' : 's'}`;
    filters.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === active));
  }

  function openLightbox(item) {
    if (!lightbox || !item) return;
    lightboxImage.src = imageUrl(item);
    lightboxImage.alt = item.title || 'Gallery image';
    lightboxTitle.textContent = item.title || '';
    lightboxCaption.textContent = item.caption || '';
    if (lightboxCredit) {
      lightboxCredit.textContent = item.contributorName ? `Submitted by ${item.contributorName}` : '';
      lightboxCredit.hidden = !item.contributorName;
    }
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImage.src = '';
    if (lightboxCredit) {
      lightboxCredit.textContent = '';
      lightboxCredit.hidden = true;
    }
    document.body.classList.remove('lightbox-open');
  }

  function statusClass(status) {
    return ['pending','approved','rejected','removed'].includes(status) ? status : 'pending';
  }

  function statusLabel(status) {
    return ({ pending:'Pending Review', approved:'Approved', rejected:'Rejected', removed:'Removed by Admin' })[status] || status;
  }

  function renderMine() {
    if (!mineWrap) return;
    const mine = Array.isArray(apiState?.mine) ? apiState.mine : [];
    if (!mine.length) {
      mineWrap.innerHTML = '<p class="muted">No submissions yet.</p>';
      return;
    }
    mineWrap.innerHTML = `<div class="gallery-my-list">${mine.map(item => {
      const thumb = item.url
        ? `<img class="gallery-my-thumb" src="${safe(item.url)}" alt="">`
        : '<span class="gallery-my-placeholder">No preview</span>';
      const note = item.reviewNote ? `<small>${safe(item.reviewNote)}</small>` : '';
      return `<article class="gallery-my-item">${thumb}<div><strong>${safe(item.title)}</strong><small>${safe(new Date(item.submittedAt).toLocaleString())}</small><span class="gallery-status ${statusClass(item.status)}">${safe(statusLabel(item.status))}</span>${note}</div></article>`;
    }).join('')}</div>`;
  }

  function normalizeReviewTags(value) {
    const allowed = new Set(apiState?.tags || []);
    const out = [];
    String(value || '').split(',').map(x => x.trim()).filter(Boolean).forEach(tag => {
      const canonical = [...allowed].find(x => x.toLowerCase() === tag.toLowerCase());
      if (canonical && !out.includes(canonical) && out.length < 3) out.push(canonical);
    });
    return out;
  }

  function renderReviewQueue() {
    if (!reviewGrid || !reviewSection || !pendingCount) return;
    const canModerate = Boolean(apiState?.canModerate);
    reviewSection.hidden = !canModerate;
    if (!canModerate) return;
    const pending = Array.isArray(apiState?.pending) ? apiState.pending : [];
    pendingCount.textContent = `${pending.length} pending`;
    if (!pending.length) {
      reviewGrid.innerHTML = '<div class="gallery-review-empty">No Gallery submissions are waiting for review.</div>';
      return;
    }
    reviewGrid.innerHTML = pending.map(item => `<article class="gallery-review-card" data-gallery-review-id="${safe(item.id)}">
      <img src="${safe(item.url)}" alt="${safe(item.title)}">
      <div class="gallery-review-body">
        <div class="gallery-review-meta"><span>Submitted by <strong>${safe(item.ownerName)}</strong></span><span>${safe(new Date(item.submittedAt).toLocaleString())}</span></div>
        <div class="gallery-review-fields">
          <label><span>Title</span><input type="text" maxlength="120" value="${safe(item.title)}" data-review-title></label>
          <label><span>Caption</span><textarea rows="3" maxlength="600" data-review-caption>${safe(item.caption || '')}</textarea></label>
          <label><span>Tags · comma separated · max 3</span><input type="text" value="${safe((item.tags || []).join(', '))}" data-review-tags></label>
          <label><span>Review note · optional</span><textarea rows="2" maxlength="300" data-review-note placeholder="Shown to the submitter if useful"></textarea></label>
        </div>
        <div class="gallery-review-actions">
          <button class="btn btn-primary" type="button" data-gallery-review-action="approve">Approve</button>
          <button class="btn btn-secondary" type="button" data-gallery-review-action="reject">Reject</button>
        </div>
        <span class="gallery-review-status" data-gallery-review-status aria-live="polite"></span>
      </div>
    </article>`).join('');
  }

  function renderAdminApproved() {
    if (!adminSection || !adminGrid || !adminCount) return;
    const canRemove = Boolean(apiState?.canRemoveApproved);
    adminSection.hidden = !canRemove;
    if (!canRemove) return;

    const approved = Array.isArray(apiState?.approvedManaged) ? apiState.approvedManaged : [];
    adminCount.textContent = `${approved.length} published`;
    if (!approved.length) {
      adminGrid.innerHTML = '<div class="gallery-review-empty">No approved member submissions are currently published.</div>';
      return;
    }

    adminGrid.innerHTML = approved.map(item => `<article class="gallery-admin-card" data-gallery-admin-id="${safe(item.id)}">
      <img src="${safe(item.url)}" alt="${safe(item.title)}">
      <div class="gallery-admin-body">
        <div><strong>${safe(item.title)}</strong><span>Submitted by ${safe(item.ownerName || 'Mongrel Commander')}</span></div>
        <div class="gallery-admin-tags">${(item.tags || []).map(tag => `<span>${safe(tag)}</span>`).join('')}</div>
        <label><span>Removal note · optional</span><textarea rows="2" maxlength="300" data-gallery-remove-note placeholder="Reason for removal"></textarea></label>
        <button class="btn btn-secondary" type="button" data-gallery-remove-approved>Remove from Gallery</button>
        <span class="gallery-review-status" data-gallery-remove-status aria-live="polite"></span>
      </div>
    </article>`).join('');
  }

  function renderMemberState() {
    const viewer = apiState?.viewer;
    if (memberSignin) memberSignin.hidden = Boolean(viewer);
    if (memberTools) memberTools.hidden = !viewer;
    if (!viewer) {
      if (reviewSection) reviewSection.hidden = true;
      if (adminSection) adminSection.hidden = true;
      return;
    }

    const quota = apiState?.quota || { used:0, limit:10, remaining:10 };
    if (quotaText) quotaText.textContent = `${Number(quota.used)||0} / ${Number(quota.limit)||10}`;
    if (submitButton) submitButton.disabled = quota.remaining <= 0 || uploadBusy;
    if (uploadChoose) uploadChoose.disabled = quota.remaining <= 0 || uploadBusy;
    if (quota.remaining <= 0) setSubmitStatus('Daily upload limit reached. You can submit again after 00:00 UTC.', true);
    renderTagPicker();
    renderMine();
    renderReviewQueue();
    renderAdminApproved();
  }

  function renderTagPicker() {
    if (!tagPicker) return;
    const current = new Set([...tagPicker.querySelectorAll('input:checked')].map(input => input.value));
    const tags = Array.isArray(apiState?.tags) ? apiState.tags : [];
    tagPicker.innerHTML = tags.map(tag => `<label class="gallery-tag-option"><input type="checkbox" value="${safe(tag)}" ${current.has(tag) ? 'checked' : ''}><span>${safe(tag)}</span></label>`).join('');
    updateTagLimit();
  }

  function selectedTags() {
    return [...(tagPicker?.querySelectorAll('input:checked') || [])].map(input => input.value).slice(0,3);
  }

  function updateTagLimit() {
    if (!tagPicker) return;
    const checked = tagPicker.querySelectorAll('input:checked').length;
    tagPicker.querySelectorAll('input').forEach(input => {
      const disabled = checked >= 3 && !input.checked;
      input.disabled = disabled;
      input.closest('.gallery-tag-option')?.classList.toggle('is-disabled', disabled);
    });
  }

  function setSubmitStatus(message = '', error = false) {
    if (!submitStatus) return;
    submitStatus.textContent = message;
    submitStatus.classList.toggle('error', Boolean(error));
  }

  function clearPreviewUrl() {
    if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl);
    selectedPreviewUrl = '';
  }

  function setSelectedFile(file) {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setSubmitStatus('Choose a PNG, JPG, or WebP image.', true);
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setSubmitStatus('Choose an image under 25 MB.', true);
      return;
    }
    selectedFile = file;
    clearPreviewUrl();
    selectedPreviewUrl = URL.createObjectURL(file);
    if (uploadPreviewImage) uploadPreviewImage.src = selectedPreviewUrl;
    if (uploadPreviewName) uploadPreviewName.textContent = file.name || 'Gallery image';
    if (uploadEmpty) uploadEmpty.hidden = true;
    if (uploadPreview) uploadPreview.hidden = false;
    setSubmitStatus(file.size > MAX_UPLOAD_BYTES ? 'Large image selected · it will be optimized before upload.' : 'Image ready');
  }

  function resetSubmissionForm() {
    submitForm?.reset();
    selectedFile = null;
    clearPreviewUrl();
    if (uploadPreviewImage) uploadPreviewImage.removeAttribute('src');
    if (uploadPreviewName) uploadPreviewName.textContent = '';
    if (uploadEmpty) uploadEmpty.hidden = false;
    if (uploadPreview) uploadPreview.hidden = true;
    if (uploadFile) uploadFile.value = '';
    setSubmitStatus('');
    renderTagPicker();
  }

  function loadBrowserImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read this image.')); };
      image.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to optimize this image.')), type, quality);
    });
  }

  async function prepareImage(file) {
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    setSubmitStatus('Optimizing large image…');
    const image = await loadBrowserImage(file);
    const maxDimension = 2400;
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    canvas.getContext('2d', { alpha:true }).drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await canvasBlob(canvas, 'image/webp', .88);
    if (blob.size > MAX_UPLOAD_BYTES) blob = await canvasBlob(canvas, 'image/webp', .75);
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('The optimized image is still over 8 MB. Try a smaller screenshot.');
    const baseName = String(file.name || 'mongrel-gallery').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0,70) || 'mongrel-gallery';
    return new File([blob], `${baseName}.webp`, { type:'image/webp' });
  }

  async function refreshApiState() {
    try {
      const { response, payload } = await apiFetch('/api/gallery');
      if (!response.ok) throw new Error(payload.error || 'Gallery service unavailable');
      apiState = payload;
      approvedItems = (Array.isArray(payload.approved) ? payload.approved : []).map(item => ({ ...item, id:`submission:${item.id}` }));
      renderMemberState();
      rebuildGallery();
    } catch {
      apiState = null;
      approvedItems = [];
      if (memberSignin) memberSignin.hidden = false;
      if (memberTools) memberTools.hidden = true;
      if (reviewSection) reviewSection.hidden = true;
      if (adminSection) adminSection.hidden = true;
      rebuildGallery();
    }
  }

  async function submitGalleryImage(event) {
    event.preventDefault();
    if (uploadBusy) return;
    const quota = apiState?.quota;
    if (quota && quota.remaining <= 0) {
      setSubmitStatus('Daily upload limit reached.', true);
      return;
    }
    const title = submitTitle?.value.trim() || '';
    const caption = submitCaption?.value.trim() || '';
    const tags = selectedTags();
    if (!title) return setSubmitStatus('Add a title before submitting.', true);
    if (!tags.length) return setSubmitStatus('Choose at least one Gallery tag.', true);
    if (!selectedFile) return setSubmitStatus('Choose an image before submitting.', true);

    uploadBusy = true;
    uploadDrop?.classList.add('is-busy');
    if (submitButton) submitButton.disabled = true;
    if (uploadChoose) uploadChoose.disabled = true;
    try {
      const file = await prepareImage(selectedFile);
      setSubmitStatus('Uploading for leadership review…');
      const form = new FormData();
      form.append('image', file, file.name);
      form.append('title', title);
      form.append('caption', caption);
      form.append('tags', JSON.stringify(tags));
      const { response, payload } = await apiFetch('/api/gallery', {
        method:'POST',
        headers:{'X-Mongrels-Request':'gallery-submission'},
        body:form,
      });
      if (!response.ok) {
        const errors = {
          gallery_daily_upload_limit:'Daily upload limit reached.',
          gallery_image_storage_not_configured:'Gallery image storage is not configured.',
          gallery_image_too_large:'The image is still too large after optimization.',
          unsupported_gallery_image_type:'Choose a PNG, JPG, or WebP image.',
          gallery_title_required:'Add a title before submitting.',
          gallery_tag_required:'Choose at least one Gallery tag.',
        };
        throw new Error(errors[payload.error] || payload.error || 'Unable to submit image.');
      }
      resetSubmissionForm();
      setSubmitStatus('Submitted · waiting for leadership approval.');
      await refreshApiState();
    } catch (error) {
      setSubmitStatus(error?.message || 'Unable to submit image.', true);
    } finally {
      uploadBusy = false;
      uploadDrop?.classList.remove('is-busy');
      renderMemberState();
    }
  }

  async function moderateSubmission(card, action) {
    const id = card?.dataset.galleryReviewId;
    if (!id) return;
    const status = card.querySelector('[data-gallery-review-status]');
    const buttons = card.querySelectorAll('[data-gallery-review-action]');
    buttons.forEach(button => button.disabled = true);
    if (status) {
      status.textContent = action === 'approve' ? 'Approving…' : 'Rejecting…';
      status.classList.remove('error');
    }
    const body = {
      id,
      action,
      title:card.querySelector('[data-review-title]')?.value || '',
      caption:card.querySelector('[data-review-caption]')?.value || '',
      tags:normalizeReviewTags(card.querySelector('[data-review-tags]')?.value || ''),
      reviewNote:card.querySelector('[data-review-note]')?.value || '',
    };
    try {
      const { response, payload } = await apiFetch('/api/gallery', {
        method:'PATCH',
        headers:{
          'Content-Type':'application/json',
          'X-Mongrels-Request':'gallery-moderation',
        },
        body:JSON.stringify(body),
      });
      if (!response.ok) throw new Error(payload.error || 'Unable to review submission.');
      await refreshApiState();
    } catch (error) {
      buttons.forEach(button => button.disabled = false);
      if (status) {
        status.textContent = error?.message || 'Unable to review submission.';
        status.classList.add('error');
      }
    }
  }

  async function removeApprovedSubmission(card) {
    const id = card?.dataset.galleryAdminId;
    if (!id || !confirm('Remove this approved image from the public Gallery? The R2 image file will also be deleted.')) return;
    const button = card.querySelector('[data-gallery-remove-approved]');
    const status = card.querySelector('[data-gallery-remove-status]');
    if (button) button.disabled = true;
    if (status) {
      status.textContent = 'Removing…';
      status.classList.remove('error');
    }

    try {
      const { response, payload } = await apiFetch('/api/gallery', {
        method:'PATCH',
        headers:{
          'Content-Type':'application/json',
          'X-Mongrels-Request':'gallery-moderation',
        },
        body:JSON.stringify({
          id,
          action:'remove',
          reviewNote:card.querySelector('[data-gallery-remove-note]')?.value || '',
        }),
      });
      if (!response.ok) {
        const errors = {
          site_admin_access_required:'Only Site Admin can remove approved Gallery images.',
          gallery_submission_not_approved:'This image is no longer an approved Gallery submission.',
        };
        throw new Error(errors[payload.error] || payload.error || 'Unable to remove Gallery image.');
      }
      await refreshApiState();
    } catch (error) {
      if (button) button.disabled = false;
      if (status) {
        status.textContent = error?.message || 'Unable to remove Gallery image.';
        status.classList.add('error');
      }
    }
  }

  async function loadStaticGallery() {
    try {
      const response = await fetch('../data/gallery.json', { cache:'no-store' });
      if (!response.ok) throw new Error('Gallery data unavailable');
      const data = await response.json();
      staticItems = (Array.isArray(data) ? data : []).map(item => ({ ...item, id:`static:${item.src}` }));
    } catch {
      staticItems = [];
    }
    rebuildGallery();
  }

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    active = button.dataset.filter;
    render();
  });

  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-open]');
    if (!button) return;
    openLightbox(items.find(item => itemKey(item) === button.dataset.galleryOpen));
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-lightbox-close]')) closeLightbox();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLightbox(); });

  submitForm?.addEventListener('submit', submitGalleryImage);
  tagPicker?.addEventListener('change', updateTagLimit);
  uploadChoose?.addEventListener('click', () => { if (!uploadBusy) uploadFile?.click(); });
  uploadDrop?.addEventListener('click', () => { if (!uploadBusy) uploadFile?.click(); });
  uploadDrop?.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !uploadBusy) {
      event.preventDefault();
      uploadFile?.click();
    }
  });
  uploadDrop?.addEventListener('dragover', event => {
    event.preventDefault();
    if (!uploadBusy) uploadDrop.classList.add('is-dragover');
  });
  uploadDrop?.addEventListener('dragleave', () => uploadDrop.classList.remove('is-dragover'));
  uploadDrop?.addEventListener('drop', event => {
    event.preventDefault();
    uploadDrop.classList.remove('is-dragover');
    if (!uploadBusy) setSelectedFile(event.dataTransfer?.files?.[0]);
  });
  uploadFile?.addEventListener('change', () => {
    const file = uploadFile.files?.[0];
    if (file) setSelectedFile(file);
  });

  reviewGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-review-action]');
    if (!button) return;
    moderateSubmission(button.closest('[data-gallery-review-id]'), button.dataset.galleryReviewAction);
  });

  adminGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-remove-approved]');
    if (!button) return;
    removeApprovedSubmission(button.closest('[data-gallery-admin-id]'));
  });

  Promise.all([loadStaticGallery(), refreshApiState()]);
})();
