(() => {
  const signedOut = document.querySelector('[data-bounty-signed-out]');
  const board = document.querySelector('[data-bounty-board]');
  const grid = document.querySelector('[data-bounty-grid]');
  if (!signedOut || !board || !grid) return;

  const shell = document.querySelector('[data-bounty-editor-shell]');
  const form = document.querySelector('[data-bounty-form]');
  let session = null;
  let items = [];
  let filter = 'active';
  let editing = null;
  let dirty = false;
  const $ = sel => document.querySelector(sel);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const apiFetch = async (url, options={}) => {
    const requestUrl = options.method ? url : `${url}${url.includes('?')?'&':'?'}_=${Date.now()}`;
    const response = await fetch(requestUrl,{credentials:'same-origin',cache:'no-store',...options});
    const payload = await response.json().catch(()=>({}));
    return {response,payload};
  };
  const formatDate = value => {
    if (!value) return 'Open';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  };
  const label = value => ({active:'Active',claimed:'Claimed',complete:'Complete'}[value] || value);

  function visibleItems(){
    return items.filter(item => {
      if (filter === 'mine') return item.isMine;
      if (filter === 'all') return true;
      return item.status === filter;
    }).sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));
  }

  async function copySystem(system, button){
    try { await navigator.clipboard.writeText(system); const old=button.textContent; button.textContent='✓'; button.classList.add('copied'); setTimeout(()=>{button.textContent=old;button.classList.remove('copied');},1000); } catch {}
  }

  function render(){
    const visible = visibleItems();
    grid.replaceChildren();
    $('[data-bounty-empty]').hidden = visible.length > 0;
    visible.forEach(item => {
      const card = document.createElement('article');
      card.className = `bounty-card bounty-${safe(item.status)}`;
      const system = item.system ? `<div class="project-system bounty-system"><span>${safe(item.system)}</span><button type="button" class="copy-system-btn" data-copy-system aria-label="Copy system name">⧉</button></div>` : '';
      card.innerHTML = `
        <div class="bounty-card-head"><div><span class="bounty-status">${safe(label(item.status))}</span></div>${item.canEdit?'<button type="button" class="btn btn-secondary bounty-edit-btn">Edit</button>':''}</div>
        <p class="bounty-kicker">Target Commander</p><h3>${safe(item.target)}</h3>
        ${system}
        <div class="bounty-reward"><span>Reward</span><strong>${safe(item.reward)}</strong></div>
        <p class="bounty-reason">${safe(item.reason)}</p>
        <dl class="bounty-meta"><div><dt>Posted by</dt><dd>${safe(item.ownerName)}</dd></div><div><dt>Expires</dt><dd>${safe(formatDate(item.expires))}</dd></div><div><dt>Proof</dt><dd>${safe(item.proof || 'Screenshot or combat report')}</dd></div></dl>`;
      card.querySelector('[data-copy-system]')?.addEventListener('click', e=>copySystem(item.system,e.currentTarget));
      card.querySelector('.bounty-edit-btn')?.addEventListener('click',()=>openEditor(item));
      grid.appendChild(card);
    });
  }

  function openEditor(item=null){
    editing=item; dirty=false; shell.hidden=false; document.body.classList.add('project-editor-open');
    $('[data-bounty-form-title]').textContent=item?'Edit Bounty':'Post Bounty';
    $('[data-bounty-id]').value=item?.id||'';
    $('[data-bounty-target]').value=item?.target||'';
    $('[data-bounty-reward]').value=item?.reward||'';
    $('[data-bounty-system]').value=item?.system||'';
    $('[data-bounty-status]').value=item?.status||'active';
    $('[data-bounty-expires]').value=item?.expires||'';
    $('[data-bounty-reason]').value=item?.reason||'';
    $('[data-bounty-proof]').value=item?.proof||'';
    $('[data-bounty-delete]').hidden=!item;
    $('[data-bounty-form-status]').textContent='';
  }
  function closeEditor(){ if(dirty && !confirm('Discard unsaved bounty changes?')) return; shell.hidden=true; document.body.classList.remove('project-editor-open'); editing=null; dirty=false; }
  function payload(){ return {id:$('[data-bounty-id]').value||undefined,target:$('[data-bounty-target]').value,reward:$('[data-bounty-reward]').value,system:$('[data-bounty-system]').value,status:$('[data-bounty-status]').value,expires:$('[data-bounty-expires]').value,reason:$('[data-bounty-reason]').value,proof:$('[data-bounty-proof]').value}; }
  async function save(event){ event.preventDefault(); const status=$('[data-bounty-form-status]'); status.textContent='Saving…'; const {response,payload:result}=await apiFetch('/api/bounties',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json','X-Mongrels-Request':'bounty-editor'},body:JSON.stringify(payload())}); if(!response.ok){status.textContent=result.error||'Unable to save bounty.';return;} dirty=false; await load(); shell.hidden=true; document.body.classList.remove('project-editor-open'); }
  async function remove(){ if(!editing || !confirm('Delete this bounty? This cannot be undone.')) return; const {response,payload:result}=await apiFetch(`/api/bounties?id=${encodeURIComponent(editing.id)}`,{method:'DELETE',headers:{'X-Mongrels-Request':'bounty-editor'}}); if(!response.ok){$('[data-bounty-form-status]').textContent=result.error||'Unable to delete bounty.';return;} dirty=false; await load(); shell.hidden=true; document.body.classList.remove('project-editor-open'); }
  async function load(){ const {response,payload}=await apiFetch('/api/bounties'); if(!response.ok){grid.innerHTML='<div class="data-empty-state"><span class="data-empty-icon">!</span><div><strong>Bounty board unavailable.</strong><p>The secure bounty service could not be reached.</p></div></div>';return;} session=payload.viewer; items=Array.isArray(payload.bounties)?payload.bounties:[]; signedOut.hidden=true; board.hidden=false; render(); }

  $('[data-bounty-filter]')?.addEventListener('change',e=>{filter=e.target.value;render();});
  $('[data-bounty-create]')?.addEventListener('click',()=>openEditor());
  document.querySelectorAll('[data-bounty-cancel]').forEach(button=>button.addEventListener('click',closeEditor));
  form?.addEventListener('submit',save); form?.addEventListener('input',()=>{dirty=true;});
  $('[data-bounty-delete]')?.addEventListener('click',remove);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});

  apiFetch('/api/auth/session').then(({response,payload})=>{
    if(response.ok && payload.authenticated && ['member','officer','site_admin'].includes(payload.access)){session=payload;load();}
    else {signedOut.hidden=false;board.hidden=true;}
  }).catch(()=>{});
})();

(() => {
  const signedOut = document.querySelector('[data-pvp-events-signed-out]');
  const board = document.querySelector('[data-pvp-events-board]');
  const grid = document.querySelector('[data-pvp-event-grid]');
  if (!signedOut || !board || !grid) return;
  const empty = document.querySelector('[data-pvp-event-empty]');
  const create = document.querySelector('[data-pvp-event-create]');
  const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fetchJson = async url => { const response=await fetch(`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`,{credentials:'same-origin',cache:'no-store'}); return {response,payload:await response.json().catch(()=>({}))}; };
  const formatDate = value => { if(!value)return 'Date TBD'; const d=new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{weekday:'short',year:'numeric',month:'short',day:'numeric'}); };
  async function copySystem(system,button){try{await navigator.clipboard.writeText(system);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1000);}catch{}}
  function render(items){
    const events=items.filter(i=>i.kind==='event'&&i.category==='PvP'&&i.status!=='complete').sort((a,b)=>Date.parse(`${a.deadline||'9999-12-31'}T${a.eventTime||'12:00'}:00`)-Date.parse(`${b.deadline||'9999-12-31'}T${b.eventTime||'12:00'}:00`));
    grid.replaceChildren(); empty.hidden=events.length>0;
    events.forEach(item=>{const card=document.createElement('article');card.className='pvp-calendar-card';const system=item.system?`<div class="pvp-calendar-system"><span>${safe(item.system)}</span><button class="copy-system-btn" type="button" data-copy-system aria-label="Copy system name">⧉</button></div>`:'';card.innerHTML=`<div class="pvp-calendar-date"><span>${safe(formatDate(item.deadline))}</span><strong>${item.eventTime?safe(item.eventTime)+' UTC':'Time TBD'}</strong></div><div class="pvp-calendar-body"><div class="pvp-calendar-badges"><span>${safe(item.eventType||'PvP Event')}</span>${item.official?'<span class="official">Official Squadron Event</span>':''}</div><h3>${safe(item.title)}</h3>${system}<p>${safe(item.description||'')}</p><div class="pvp-calendar-meta"><span>Organizer <strong>${safe(item.ownerName)}</strong></span><a href="../projects/?view=events">View in Projects & Events</a></div></div>`;card.querySelector('[data-copy-system]')?.addEventListener('click',e=>copySystem(item.system,e.currentTarget));grid.appendChild(card);});
  }
  Promise.all([fetchJson('/api/auth/session'),fetchJson('/api/projects')]).then(([sessionResult,projectResult])=>{if(!sessionResult.response.ok||!sessionResult.payload.authenticated||!projectResult.response.ok){signedOut.hidden=false;board.hidden=true;return;} signedOut.hidden=true;board.hidden=false;create.hidden=!projectResult.payload.canModerate;render(Array.isArray(projectResult.payload.items)?projectResult.payload.items:[]);}).catch(()=>{});
})();
