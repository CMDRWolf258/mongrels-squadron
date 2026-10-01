(()=>{
  'use strict';
  const $=sel=>document.querySelector(sel);
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={
    data:null,filter:'all',editing:null,
    editorImageOriginalKey:'',
    editorImageTempKey:'',
    editorImagePreviewUrl:'',
  }; // Public feed and Site Admin editorial state stay separate.
  const storyId=()=>new URLSearchParams(location.search).get('story')||'';
  const when=value=>{const d=new Date(value||'');return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):''};
  const api=async(method='GET',body=null,url='/api/newsroom')=>{
    const options={method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
    if(body!==null){
      options.headers['Content-Type']='application/json';
      options.headers['X-Mongrels-Request']='mongrels-newsroom';
      options.body=JSON.stringify(body);
    }else if(method!=='GET'){
      options.headers['X-Mongrels-Request']='mongrels-newsroom';
    }
    const response=await fetch(url,options);
    const payload=await response.json().catch(()=>({}));
    return{response,payload};
  };
  const published=()=>Array.isArray(state.data?.items)?state.data.items.filter(item=>item.status==='published'):[];
  const categoryLabel=id=>state.data?.categories?.find(x=>x.id===id)?.label||'Squadron News';

  function storyHref(id){return '?story='+encodeURIComponent(id)}
  function renderFilters(){
    const host=$('[data-newsroom-filters]'); if(!host)return;
    const options=[{id:'all',label:'All'},...(state.data?.categories||[])];
    host.innerHTML=options.map(item=>`<button class="newsroom-filter ${state.filter===item.id?'active':''}" type="button" data-newsroom-filter="${safe(item.id)}">${safe(item.label)}</button>`).join('');
    host.querySelectorAll('[data-newsroom-filter]').forEach(button=>button.addEventListener('click',()=>{
      state.filter=button.dataset.newsroomFilter||'all';
      renderIndex();
      renderFilters();
    }));
  }

  function storyCard(item){
    return `<a class="newsroom-story-card" href="${storyHref(item.id)}"><span class="newsroom-kicker">${safe(categoryLabel(item.category))}</span><h3>${safe(item.title)}</h3><p>${safe(item.deck||item.body)}</p><footer>By ${safe(item.byline||'The Morning Walk')} · ${safe(when(item.publishedAt||item.updatedAt))}</footer></a>`;
  }
  function leadCard(item){
    return `<article class="newsroom-lead-card"><div class="newsroom-lead-mark"><span>MW</span></div><div class="newsroom-lead-copy"><span class="newsroom-kicker">${safe(categoryLabel(item.category))} · Latest</span><h3>${safe(item.title)}</h3><p class="newsroom-deck">${safe(item.deck||item.body.slice(0,360))}</p><span class="newsroom-byline">By ${safe(item.byline||'The Morning Walk')} · ${safe(when(item.publishedAt||item.updatedAt))}</span><a class="newsroom-read-link" href="${storyHref(item.id)}">Read the full story →</a></div></article>`;
  }

  function articleFigure(item){
    if(!item?.imageUrl)return'';
    const placement=['upper-left','upper-right','lower-left','lower-right'].includes(item.imagePlacement)?item.imagePlacement:'upper-right';
    const caption=String(item.imageCaption||'').trim();
    const credit=String(item.imageCredit||'').trim();
    const figcaption=(caption||credit)
      ?`<figcaption>${caption?`<span>${safe(caption)}</span>`:''}${credit?`<small>Photo: ${safe(credit)}</small>`:''}</figcaption>`
      :'';
    return `<figure class="newsroom-press-photo ${safe(placement)}"><div class="newsroom-press-photo-frame"><img src="${safe(item.imageUrl)}" alt="${safe(caption||item.title||'Morning Walk press photograph')}"></div>${figcaption}</figure>`;
  }
  function articleBodyMarkup(item){
    const text=String(item?.body||'').trim();
    const paragraphs=text?text.split(/\n\s*\n/).map(part=>part.trim()).filter(Boolean):[];
    const figure=articleFigure(item);
    const lower=String(item?.imagePlacement||'').startsWith('lower-');
    let insertAt=0;
    if(lower&&paragraphs.length>1)insertAt=Math.max(1,Math.ceil(paragraphs.length/2));
    if(lower&&paragraphs.length<=1)insertAt=paragraphs.length;
    const parts=[];
    paragraphs.forEach((paragraph,index)=>{
      if(figure&&index===insertAt)parts.push(figure);
      parts.push(`<p>${safe(paragraph).replace(/\n/g,'<br>')}</p>`);
    });
    if(figure&&insertAt>=paragraphs.length)parts.push(figure);
    if(!paragraphs.length&&figure)parts.push(figure);
    return `<div class="newsroom-story-body">${parts.join('')}</div>`;
  }
  function articleMarkup(item,{preview=false}={}){
    const date=preview?'Unpublished preview':when(item.publishedAt||item.updatedAt);
    return `<article class="newsroom-article ${preview?'is-preview':''}">${preview?'':'<a class="newsroom-article-back" href="./">← Back to The Morning Walk</a>'}<span class="newsroom-kicker">${safe(categoryLabel(item.category))}</span><h2>${safe(item.title||'Untitled Story')}</h2>${item.deck?`<p class="newsroom-deck">${safe(item.deck)}</p>`:''}<div class="newsroom-article-meta"><span>By ${safe(item.byline||'The Morning Walk')}</span><span>•</span><span>${safe(date)}</span></div>${articleBodyMarkup(item)}</article>`;
  }

  function renderIndex(){
    const index=$('[data-newsroom-index]'),view=$('[data-newsroom-story-view]');
    if(!index||!view)return;
    const requested=storyId();
    const selected=published().find(item=>item.id===requested);
    if(selected){
      index.hidden=true;view.hidden=false;
      view.innerHTML=articleMarkup(selected);
      return;
    }
    view.hidden=true;view.replaceChildren();index.hidden=false;
    const all=published().filter(item=>state.filter==='all'||item.category===state.filter);
    const lead=$('[data-newsroom-lead]'),list=$('[data-newsroom-list]'),empty=$('[data-newsroom-empty]');
    if(!all.length){lead.innerHTML='';list.innerHTML='';empty.hidden=false;return;}
    empty.hidden=true;
    lead.innerHTML=leadCard(all[0]);
    list.innerHTML=all.slice(1).map(storyCard).join('');
  }

  function renderDesk(){
    const section=$('[data-newsroom-desk]'),host=$('[data-newsroom-desk-list]'),count=$('[data-newsroom-desk-count]');
    if(!section||!host)return;
    const canManage=Boolean(state.data?.canManage);
    section.hidden=!canManage;
    $('[data-newsroom-new]').hidden=!canManage;
    if(!canManage)return;
    const items=(state.data.items||[]).filter(item=>item.status!=='published');
    if(count)count.textContent=items.length+' draft / archived';
    host.innerHTML=items.length?items.map(item=>`<article class="newsroom-desk-item"><div><span class="newsroom-status">${safe(item.status)}</span><strong>${safe(item.title||'Untitled story')}</strong><small>${safe(categoryLabel(item.category))} · Updated ${safe(when(item.updatedAt))}</small></div><button class="btn btn-secondary btn-compact" type="button" data-newsroom-edit="${safe(item.id)}">Edit</button></article>`).join(''):'<div class="newsroom-empty"><strong>No stories waiting on the desk.</strong><span>Start a draft whenever something worth reporting happens.</span></div>';
    host.querySelectorAll('[data-newsroom-edit]').forEach(button=>button.addEventListener('click',()=>{
      const item=(state.data.items||[]).find(row=>row.id===button.dataset.newsroomEdit);
      if(item)openEditor(item);
    }));
  }

  function populateCategories(selected='squadron-news'){
    const select=$('[data-newsroom-category]'); if(!select)return;
    select.innerHTML=(state.data?.categories||[]).map(item=>`<option value="${safe(item.id)}" ${item.id===selected?'selected':''}>${safe(item.label)}</option>`).join('');
  }
  function setEditorStatus(message,tone=''){
    const host=$('[data-newsroom-editor-status]'); if(!host)return;
    host.textContent=message||'';host.dataset.tone=tone;
  }
  function setImageStatus(message,tone=''){
    const host=$('[data-newsroom-image-status]');if(!host)return;
    host.textContent=message||'';host.dataset.tone=tone;
  }
  function updateImageEditor(){
    const has=Boolean($('[data-newsroom-image-key]')?.value&&state.editorImagePreviewUrl);
    $('[data-newsroom-image-empty]').hidden=has;
    $('[data-newsroom-image-thumb]').hidden=!has;
    $('[data-newsroom-image-meta]').hidden=!has;
    $('[data-newsroom-image-remove]').hidden=!has;
    if(has)$('[data-newsroom-image-thumb-img]').src=state.editorImagePreviewUrl;
    else $('[data-newsroom-image-thumb-img]').removeAttribute('src');
  }
  async function deleteTemporaryImage(key){
    if(!key)return;
    try{
      await fetch('/api/newsroom/image',{
        method:'DELETE',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'mongrels-newsroom-image'},
        body:JSON.stringify({key}),
      });
    }catch{}
  }
  async function uploadImage(file){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setImageStatus('Choose a PNG, JPG, or WebP image.','error');return;}
    if(file.size>8*1024*1024){setImageStatus('Image is larger than the 8 MB limit.','error');return;}
    setImageStatus('Uploading press photo…','working');
    const priorTemp=state.editorImageTempKey;
    const form=new FormData();form.append('image',file);
    try{
      const response=await fetch('/api/newsroom/image',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'X-Mongrels-Request':'mongrels-newsroom-image'},body:form,
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to upload image.');
      state.editorImageTempKey=payload.key||'';
      state.editorImagePreviewUrl=payload.previewUrl||'';
      $('[data-newsroom-image-key]').value=state.editorImageTempKey;
      updateImageEditor();
      setImageStatus('Press photo ready. Preview the article to see the print treatment.');
      if(priorTemp&&priorTemp!==state.editorImageTempKey)deleteTemporaryImage(priorTemp);
    }catch(error){setImageStatus(error.message||'Unable to upload image.','error');}
    finally{$('[data-newsroom-image-file]').value='';}
  }
  function removeImage(){
    const current=$('[data-newsroom-image-key]').value;
    if(current&&current===state.editorImageTempKey){
      deleteTemporaryImage(current);
      state.editorImageTempKey='';
    }
    $('[data-newsroom-image-key]').value='';
    state.editorImagePreviewUrl='';
    updateImageEditor();
    setImageStatus(state.editorImageOriginalKey?'Image will be removed when you save the story.':'');
  }
  function previewStory(){
    const payload=editorPayload('save');
    if(!payload.title.trim()||!payload.body.trim()){setEditorStatus('Add a headline and story before previewing.','error');return;}
    const preview={
      ...payload,
      status:'draft',
      imageUrl:state.editorImagePreviewUrl,
      publishedAt:'',
      updatedAt:new Date().toISOString(),
    };
    $('[data-newsroom-preview-content]').innerHTML=articleMarkup(preview,{preview:true});
    $('[data-newsroom-preview-shell]').hidden=false;
    document.body.classList.add('newsroom-preview-open');
  }
  function closePreview(){
    $('[data-newsroom-preview-shell]').hidden=true;
    $('[data-newsroom-preview-content]').replaceChildren();
    document.body.classList.remove('newsroom-preview-open');
  }

  function openEditor(item=null){
    if(!state.data?.canManage)return;
    state.editing=item;
    $('[data-newsroom-editor-title]').textContent=item?'Edit Story':'New Story';
    $('[data-newsroom-id]').value=item?.id||'';
    $('[data-newsroom-title]').value=item?.title||'';
    $('[data-newsroom-deck]').value=item?.deck||'';
    $('[data-newsroom-byline]').value=item?.byline||state.data?.viewer?.displayName||'';
    $('[data-newsroom-body]').value=item?.body||'';
    state.editorImageOriginalKey=item?.imageKey||'';
    state.editorImageTempKey='';
    state.editorImagePreviewUrl=item?.imageUrl||'';
    $('[data-newsroom-image-key]').value=item?.imageKey||'';
    $('[data-newsroom-image-placement]').value=item?.imagePlacement||'upper-right';
    $('[data-newsroom-image-caption]').value=item?.imageCaption||'';
    $('[data-newsroom-image-credit]').value=item?.imageCredit||'';
    updateImageEditor();
    setImageStatus(item?.imageKey?'Current press photo loaded.':'');
    populateCategories(item?.category||'squadron-news');
    $('[data-newsroom-delete]').hidden=item?.status!=='draft';
    $('[data-newsroom-archive]').hidden=item?.status!=='published';
    $('[data-newsroom-restore]').hidden=item?.status!=='archived';
    $('[data-newsroom-save]').hidden=item?.status==='archived';
    $('[data-newsroom-publish]').hidden=item?.status==='archived';
    setEditorStatus(item?('Status: '+item.status):'New stories begin as private drafts.');
    $('[data-newsroom-editor]').hidden=false;
    document.body.classList.add('newsroom-editor-open');
    $('[data-newsroom-title]').focus();
  }
  function closeEditor({discardTemp=true}={}){
    closePreview();
    if(discardTemp&&state.editorImageTempKey)deleteTemporaryImage(state.editorImageTempKey);
    $('[data-newsroom-editor]').hidden=true;
    document.body.classList.remove('newsroom-editor-open');
    state.editing=null;
    state.editorImageOriginalKey='';
    state.editorImageTempKey='';
    state.editorImagePreviewUrl='';
    setEditorStatus('');
    setImageStatus('');
  }
  function editorPayload(action='save'){
    return{
      id:$('[data-newsroom-id]').value,
      action,
      title:$('[data-newsroom-title]').value,
      category:$('[data-newsroom-category]').value,
      byline:$('[data-newsroom-byline]').value,
      deck:$('[data-newsroom-deck]').value,
      body:$('[data-newsroom-body]').value,
      imageKey:$('[data-newsroom-image-key]').value,
      imagePlacement:$('[data-newsroom-image-placement]').value,
      imageCaption:$('[data-newsroom-image-caption]').value,
      imageCredit:$('[data-newsroom-image-credit]').value,
    };
  }
  async function saveStory(action='save'){
    if(!state.data?.canManage)return;
    const payload=editorPayload(action);
    if(!payload.title.trim()||!payload.body.trim()){setEditorStatus('Headline and story are required.','error');return;}
    setEditorStatus(action==='publish'?'Publishing…':action==='archive'?'Archiving…':action==='restore'?'Restoring…':'Saving draft…','working');
    try{
      let result;
      if(!payload.id){
        result=await api('POST',payload);
        if(!result.response.ok)throw new Error(result.payload.error||'Unable to save story.');
        payload.id=result.payload.item?.id||'';
        if(action!=='save')result=await api('PUT',payload);
      }else{
        result=await api('PUT',payload);
      }
      if(!result.response.ok)throw new Error(result.payload.error||'Unable to save story.');
      state.editorImageTempKey='';
      closeEditor({discardTemp:false});await load();
    }catch(error){setEditorStatus(error.message||'Unable to save story.','error');}
  }
  async function deleteDraft(){
    const id=$('[data-newsroom-id]').value;if(!id)return;
    if(!confirm('Delete this draft? This cannot be undone.'))return;
    setEditorStatus('Deleting draft…','working');
    try{
      const {response,payload}=await api('DELETE',null,'/api/newsroom?id='+encodeURIComponent(id));
      if(!response.ok)throw new Error(payload.error||'Unable to delete draft.');
      state.editorImageTempKey='';
      closeEditor({discardTemp:false});await load();
    }catch(error){setEditorStatus(error.message||'Unable to delete draft.','error');}
  }

  async function load(){
    try{
      const {response,payload}=await api();
      if(!response.ok)throw new Error(payload.error||'Unable to load the Newsroom.');
      state.data=payload;
      renderFilters();renderIndex();renderDesk();
    }catch(error){
      const empty=$('[data-newsroom-empty]');
      if(empty){empty.hidden=false;empty.innerHTML='<strong>The presses hit a snag.</strong><span>'+safe(error.message||'Unable to load the Newsroom.')+'</span>';}
    }
  }

  $('[data-newsroom-new]')?.addEventListener('click',()=>openEditor());
  const imageFile=$('[data-newsroom-image-file]');
  const imageDrop=$('[data-newsroom-image-drop]');
  $('[data-newsroom-image-choose]')?.addEventListener('click',()=>imageFile?.click());
  imageDrop?.addEventListener('click',()=>imageFile?.click());
  imageDrop?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();imageFile?.click();}});
  imageFile?.addEventListener('change',()=>uploadImage(imageFile.files?.[0]));
  for(const type of ['dragenter','dragover'])imageDrop?.addEventListener(type,event=>{event.preventDefault();imageDrop.classList.add('is-dragging');});
  for(const type of ['dragleave','drop'])imageDrop?.addEventListener(type,event=>{event.preventDefault();imageDrop.classList.remove('is-dragging');});
  imageDrop?.addEventListener('drop',event=>uploadImage(event.dataTransfer?.files?.[0]));
  $('[data-newsroom-image-remove]')?.addEventListener('click',removeImage);
  $('[data-newsroom-preview]')?.addEventListener('click',previewStory);
  document.querySelectorAll('[data-newsroom-preview-close]').forEach(node=>node.addEventListener('click',closePreview));
  document.querySelectorAll('[data-newsroom-close]').forEach(node=>node.addEventListener('click',closeEditor));
  $('[data-newsroom-form]')?.addEventListener('submit',event=>{event.preventDefault();saveStory('save');});
  $('[data-newsroom-publish]')?.addEventListener('click',()=>saveStory('publish'));
  $('[data-newsroom-archive]')?.addEventListener('click',()=>saveStory('archive'));
  $('[data-newsroom-restore]')?.addEventListener('click',()=>saveStory('restore'));
  $('[data-newsroom-delete]')?.addEventListener('click',deleteDraft);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(!$('[data-newsroom-preview-shell]')?.hidden){closePreview();return;}
    if(!$('[data-newsroom-editor]')?.hidden)closeEditor();
  });
  window.addEventListener('popstate',renderIndex);
  load();
})();
