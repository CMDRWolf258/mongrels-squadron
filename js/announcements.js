(() => {
  const gate=document.querySelector('[data-announcements-gate]');
  const gateStatus=document.querySelector('[data-announcements-gate-status]');
  const board=document.querySelector('[data-announcements-board]');
  const list=document.querySelector('[data-announcement-list]');
  const empty=document.querySelector('[data-announcement-empty]');
  const newButton=document.querySelector('[data-announcement-new]');
  const filters=[...document.querySelectorAll('[data-announcement-filter]')];
  const discordState=document.querySelector('[data-announcement-discord-state]');
  const discordTitle=document.querySelector('[data-announcement-discord-title]');
  const discordCopy=document.querySelector('[data-announcement-discord-copy]');
  const shell=document.querySelector('[data-announcement-editor]');
  const form=document.querySelector('[data-announcement-form]');
  const editorTitle=document.querySelector('[data-announcement-editor-title]');
  const idInput=document.querySelector('[data-announcement-id]');
  const titleInput=document.querySelector('[data-announcement-title]');
  const priorityInput=document.querySelector('[data-announcement-priority]');
  const bodyInput=document.querySelector('[data-announcement-body]');
  const editorStatus=document.querySelector('[data-announcement-editor-status]');
  const deleteButton=document.querySelector('[data-announcement-delete]');
  const publishButton=document.querySelector('[data-announcement-publish]');
  const closeButtons=[...document.querySelectorAll('[data-announcement-close]')];

  let state={items:[],canManage:false,discordConfigured:false,filter:'published'};

  const request=async(method='GET',body=null)=>{
    const response=await fetch('/api/announcements',{
      method,
      credentials:'same-origin',
      cache:'no-store',
      headers:{
        Accept:'application/json',
        ...(body?{'Content-Type':'application/json','X-Mongrels-Request':'mongrels-announcements'}:{}),
      },
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    const data=await response.json().catch(()=>({ok:false,error:'invalid_response'}));
    if(!response.ok)throw Object.assign(new Error(data.error||'request_failed'),{status:response.status,data});
    return data;
  };

  const niceDate=value=>{
    if(!value)return'';
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return'';
    return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
  };

  const setEditorStatus=(message,tone='')=>{
    if(!editorStatus)return;
    editorStatus.textContent=message||'';
    editorStatus.dataset.tone=tone;
  };

  const currentItem=()=>state.items.find(item=>item.id===idInput?.value)||null;

  const openEditor=item=>{
    if(!state.canManage||!shell)return;
    shell.hidden=false;
    document.body.classList.add('announcement-editor-open');
    const draft=item||null;
    idInput.value=draft?.id||'';
    titleInput.value=draft?.title||'';
    priorityInput.value=draft?.priority||'standard';
    bodyInput.value=draft?.body||'';
    editorTitle.textContent=draft?'Edit Announcement':'New Announcement';
    deleteButton.hidden=!draft||draft.status!=='draft';
    publishButton.hidden=Boolean(draft&&draft.status==='archived');
    publishButton.textContent=draft?.status==='published'?'Save + Sync Discord':'Publish to Squad + Discord';
    setEditorStatus(draft?.status==='published'?'Published edits will sync to the existing Discord message.':'');
    window.setTimeout(()=>titleInput?.focus(),30);
  };

  const closeEditor=()=>{
    if(!shell)return;
    shell.hidden=true;
    document.body.classList.remove('announcement-editor-open');
    form?.reset();
    idInput.value='';
    setEditorStatus('');
  };

  const payloadFromEditor=()=>({
    id:idInput.value,
    title:titleInput.value,
    priority:priorityInput.value,
    body:bodyInput.value,
  });

  async function saveEditor({publish=false}={}){
    if(!state.canManage)return;
    const payload=payloadFromEditor();
    if(!payload.title.trim()||!payload.body.trim()){
      setEditorStatus('Title and announcement text are required.','error');
      return;
    }
    setEditorStatus(publish?'Publishing announcement…':'Saving announcement…','working');
    try{
      let item=currentItem();
      if(!item){
        const created=await request('POST',payload);
        item=created.item;
        state.items.unshift(item);
        idInput.value=item.id;
      }
      const action=publish?'publish':'save';
      const updated=await request('PUT',{...payload,id:item.id,action});
      replaceItem(updated.item);
      closeEditor();
      await load();
      if(publish&&updated.discord&&!updated.discord.ok){
        showBoardNotice('Published on the website, but Discord did not sync. Check the channel webhook status and publish again to retry.','warning');
      }
    }catch(error){
      setEditorStatus(messageFor(error),'error');
    }
  }

  function replaceItem(item){
    const index=state.items.findIndex(entry=>entry.id===item.id);
    if(index>=0)state.items[index]=item;
    else state.items.unshift(item);
  }

  async function mutate(item,action){
    try{
      const updated=await request('PUT',{id:item.id,action});
      replaceItem(updated.item);
      await load();
      if(updated.discord&&!updated.discord.ok){
        showBoardNotice('Website status updated, but Discord sync needs attention.','warning');
      }
    }catch(error){
      showBoardNotice(messageFor(error),'error');
    }
  }

  async function deleteDraft(item){
    if(item.status!=='draft'||!window.confirm('Delete this draft? This cannot be undone.'))return;
    try{
      await request('DELETE',{id:item.id});
      state.items=state.items.filter(entry=>entry.id!==item.id);
      closeEditor();
      render();
    }catch(error){
      setEditorStatus(messageFor(error),'error');
    }
  }

  function render(){
    if(!list)return;
    const items=state.items.filter(item=>item.status===state.filter);
    list.replaceChildren();
    empty.hidden=items.length>0;

    items.forEach(item=>{
      const article=document.createElement('article');
      article.className='announcement-card'+(item.priority==='important'?' is-important':'');
      article.id='announcement-'+item.id;

      const top=document.createElement('div');
      top.className='announcement-card-top';
      const badges=document.createElement('div');
      badges.className='announcement-badges';
      const status=document.createElement('span');
      status.className='announcement-badge';
      status.textContent=item.status==='draft'?'Draft':item.status==='archived'?'Archived':'Published';
      badges.appendChild(status);
      if(item.priority==='important'){
        const important=document.createElement('span');
        important.className='announcement-badge important';
        important.textContent='Important';
        badges.appendChild(important);
      }
      const meta=document.createElement('span');
      meta.className='announcement-meta';
      const when=item.publishedAt||item.updatedAt||item.createdAt;
      meta.textContent=[item.authorName||'Squadron Command',niceDate(when)].filter(Boolean).join(' · ');
      top.append(badges,meta);

      const heading=document.createElement('h3');
      heading.textContent=item.title;
      const body=document.createElement('p');
      body.className='announcement-body';
      body.textContent=item.body;

      article.append(top,heading,body);

      if(state.canManage){
        const admin=document.createElement('div');
        admin.className='announcement-admin-row';
        const sync=document.createElement('span');
        sync.className='announcement-sync';
        if(item.status==='published'){
          sync.textContent=item.discordLastError
            ? 'Discord sync needs attention'
            : item.discordSynced
              ? 'Discord synced '+(niceDate(item.discordLastSyncedAt)||'')
              : 'Not yet synced to Discord';
          if(item.discordLastError)sync.classList.add('warning');
        }else{
          sync.textContent=item.status==='draft'?'Private draft':'Discord history preserved';
        }
        const actions=document.createElement('div');

        const edit=button('Edit',()=>openEditor(item),'btn btn-secondary btn-compact');
        actions.appendChild(edit);
        if(item.status==='draft'){
          actions.appendChild(button('Publish',()=>mutate(item,'publish'),'btn btn-primary btn-compact'));
        }else if(item.status==='published'){
          actions.appendChild(button('Archive',()=>mutate(item,'archive'),'btn btn-secondary btn-compact'));
        }else if(item.status==='archived'){
          actions.appendChild(button('Restore',()=>mutate(item,'restore'),'btn btn-secondary btn-compact'));
        }
        admin.append(sync,actions);
        article.appendChild(admin);
      }

      list.appendChild(article);
    });
  }

  function button(label,handler,className){
    const element=document.createElement('button');
    element.type='button';
    element.className=className;
    element.textContent=label;
    element.addEventListener('click',handler);
    return element;
  }

  function showBoardNotice(message,tone=''){
    if(!discordState)return;
    discordState.hidden=false;
    discordState.dataset.tone=tone;
    discordTitle.textContent=tone==='error'?'Announcement error':'Announcements status';
    discordCopy.textContent=message;
  }

  function renderDiscordState(){
    if(!state.canManage){
      discordState.hidden=true;
      return;
    }
    discordState.hidden=false;
    discordState.dataset.tone=state.discordConfigured?'ok':'warning';
    discordTitle.textContent=state.discordConfigured?'Discord announcements connected':'Discord announcements not connected';
    discordCopy.textContent=state.discordConfigured
      ? 'Publishing sends new announcements to the dedicated Discord channel. Published edits update the same Discord message.'
      : 'The website manager is ready, but DISCORD_ANNOUNCEMENTS_WEBHOOK_URL still needs to be configured in Cloudflare before Discord delivery can work.';
  }

  async function load(){
    try{
      const data=await request();
      state.items=Array.isArray(data.items)?data.items:[];
      state.canManage=Boolean(data.canManage);
      state.discordConfigured=Boolean(data.discordConfigured);
      gate.hidden=true;
      board.hidden=false;
      newButton.hidden=!state.canManage;
      const draftFilter=document.querySelector('[data-announcement-filter="draft"]');
      if(draftFilter)draftFilter.hidden=!state.canManage;
      if(!state.canManage&&state.filter==='draft')state.filter='published';
      filters.forEach(filter=>filter.classList.toggle('active',filter.dataset.announcementFilter===state.filter));
      renderDiscordState();
      render();
      const hash=window.location.hash;
      if(hash&&hash.startsWith('#announcement-')){
        window.setTimeout(()=>document.querySelector(hash)?.scrollIntoView({block:'center'}),50);
      }
    }catch(error){
      if(error.status===401||error.status===403){
        gate.hidden=false;
        board.hidden=true;
        if(gateStatus)gateStatus.textContent=error.status===401?'Sign in with Discord to continue.':'This Discord account does not currently have member website access.';
        return;
      }
      gate.hidden=false;
      board.hidden=true;
      if(gateStatus)gateStatus.textContent='Announcements are temporarily unavailable.';
    }
  }

  function messageFor(error){
    const code=error?.data?.error||error?.message||'request_failed';
    const messages={
      title_and_body_required:'Title and announcement text are required.',
      announcement_not_found:'That announcement no longer exists.',
      discord_announcements_webhook_not_configured:'The Discord announcements webhook is not configured yet.',
      request_validation_failed:'The secure request check failed. Reload the page and try again.',
    };
    return messages[code]||'The announcement could not be saved. Please try again.';
  }

  filters.forEach(filter=>filter.addEventListener('click',()=>{
    state.filter=filter.dataset.announcementFilter||'published';
    filters.forEach(button=>button.classList.toggle('active',button===filter));
    render();
  }));
  newButton?.addEventListener('click',()=>openEditor(null));
  closeButtons.forEach(button=>button.addEventListener('click',closeEditor));
  form?.addEventListener('submit',event=>{event.preventDefault();saveEditor({publish:false});});
  publishButton?.addEventListener('click',()=>saveEditor({publish:true}));
  deleteButton?.addEventListener('click',()=>{
    const item=currentItem();
    if(item)deleteDraft(item);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell?.hidden)closeEditor();});

  load();
})();
