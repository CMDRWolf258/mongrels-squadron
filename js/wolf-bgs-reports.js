(() => {
  const API='/api/operations/order-reports';
  const systems=document.querySelector('.wolf-systems-section');
  if(!systems)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const fmt=value=>Number.isInteger(n(value))?String(n(value)):n(value).toFixed(1);
  let panel=null;
  let busy=false;
  let loadedAt=0;
  const STALE_MS=5*60*1000;

  function ensurePanel(){
    if(panel)return panel;
    const section=document.createElement('section');
    section.className='section-sm wolf-reports-section';
    section.dataset.wolfReportManager='true';
    section.innerHTML='<div class="container"><details class="wolf-report-manager"><summary><span><b>CURRENT CYCLE REPORTS</b><small>Review, correct, or remove submitted member workload</small></span><span class="wolf-report-manager-count"><strong data-report-count>—</strong><small data-report-cycle>Open to load</small></span><i aria-hidden="true">+</i></summary><div class="wolf-report-manager-body"><div class="wolf-report-manager-toolbar"><span data-report-status>Open this panel to load current-cycle reports.</span><button type="button" class="btn btn-secondary btn-compact" data-report-refresh>Refresh</button></div><div class="wolf-admin-report-list" data-admin-report-list></div></div></details></div>';
    systems.parentNode.insertBefore(section,systems);
    panel=section;
    panel.querySelector('[data-report-refresh]').addEventListener('click',()=>load(true));
    panel.addEventListener('click',handleClick);
    const details=panel.querySelector('.wolf-report-manager');
    details?.addEventListener('toggle',()=>{if(details.open)load();},{passive:true});
    return panel;
  }

  async function load(force=false){
    if(busy)return;
    if(!force&&loadedAt&&Date.now()-loadedAt<STALE_MS)return;
    busy=true;
    const p=ensurePanel();
    const status=p.querySelector('[data-report-status]');
    status.textContent='Loading current-cycle reports…';status.dataset.state='';
    try{
      const response=await fetch(API+'?admin=1&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(response.status===403||!data.canManageReports){p.hidden=true;return;}
      if(!response.ok)throw new Error(data.error||'report_load_failed');
      p.hidden=false;
      loadedAt=Date.now();
      render(data);
    }catch(error){
      console.error(error);
      status.textContent='Could not load current-cycle reports.';status.dataset.state='error';
    }finally{busy=false;}
  }

  function render(data){
    const p=ensurePanel();
    const reports=Array.isArray(data.reports)?data.reports:[];
    p.querySelector('[data-report-count]').textContent=reports.length+' REPORT'+(reports.length===1?'':'S');
    p.querySelector('[data-report-cycle]').textContent=data.cycleId?'Cycle '+shortId(data.cycleId):'No active cycle';
    const status=p.querySelector('[data-report-status]');
    status.textContent=reports.length?'Current cycle · officer controls affect squad totals immediately.':'No reports submitted in the current cycle yet.';
    status.dataset.state='';
    const list=p.querySelector('[data-admin-report-list]');
    if(!reports.length){list.innerHTML='<div class="wolf-admin-report-empty">No submitted reports yet.</div>';return;}

    const ordered=reports.slice().sort((a,b)=>{
      const system=String(a.system||'').localeCompare(String(b.system||''));
      if(system)return system;
      return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));
    });
    list.innerHTML=ordered.map(report=>reportCard(report)).join('');
  }

  function reportCard(report){
    const legacy=report.legacy?'<span class="wolf-report-legacy">COMBINED PRIOR TOTAL</span>':'';
    return '<article class="wolf-admin-report" data-report-id="'+esc(report.id)+'" data-report-type="'+esc(report.reportType)+'">'+
      '<div class="wolf-admin-report-main"><div class="wolf-admin-report-who"><strong>'+esc(report.displayName||'Mongrel CMDR')+'</strong><small>'+esc(stamp(report.updatedAt||report.createdAt))+'</small></div>'+
      '<div class="wolf-admin-report-target"><strong>'+esc(report.system||'Squad-wide')+'</strong><small>'+esc(report.faction||'No faction')+'</small></div>'+
      '<div class="wolf-admin-report-value"><strong>'+esc(amount(report))+'</strong><small>'+esc(typeLabel(report.reportType))+'</small>'+legacy+'</div>'+
      '<div class="wolf-admin-report-actions"><button type="button" data-admin-edit>Edit</button><button type="button" data-admin-delete>Delete</button></div></div>'+
      '<div class="wolf-admin-report-editor" data-admin-editor hidden>'+editorMarkup(report)+'</div></article>';
  }

  function editorMarkup(report){
    const counts=report.counts||{};
    if(report.reportType==='inf'){
      return '<div class="wolf-report-edit-grid">'+['inf2','inf3','inf4','inf5'].map((key,i)=>numberField(key,'+'+(i+2)+' INF',counts[key])).join('')+'</div>'+editorActions();
    }
    if(['bounties','trade','exploration'].includes(report.reportType)){
      return '<div class="wolf-report-edit-grid wolf-report-edit-grid-credit">'+numberField('millions','M Cr',counts.millions,'0.1')+'</div>'+editorActions();
    }
    if(report.reportType==='cz'){
      const wins=['low','medium','high'].map(key=>numberField(key,'Win '+cap(key),counts[key])).join('');
      const losses=['lossLow','lossMedium','lossHigh'].map((key,i)=>numberField(key,'Loss '+['Low','Medium','High'][i],counts[key])).join('');
      const disconnects=['disconnectLow','disconnectMedium','disconnectHigh'].map((key,i)=>numberField(key,'DC '+['Low','Medium','High'][i],counts[key])).join('');
      return '<div class="wolf-report-edit-cz"><label><span>Mode</span><select data-edit-mode><option value="solo"'+(report.mode!=='wing'?' selected':'')+'>Solo</option><option value="wing"'+(report.mode==='wing'?' selected':'')+'>Wing</option></select></label><label class="wolf-report-bonds"><input type="checkbox" data-edit-bonds'+(report.bondsRedeemed?' checked':'')+'> Combat Bonds redeemed</label></div><div class="wolf-report-edit-grid">'+wins+losses+disconnects+'</div>'+editorActions();
    }
    return editorActions();
  }

  function numberField(key,label,value,step='1'){
    return '<label><span>'+esc(label)+'</span><input type="number" min="0" step="'+step+'" value="'+esc(n(value))+'" data-edit-field="'+esc(key)+'"></label>';
  }

  function editorActions(){
    return '<div class="wolf-report-edit-actions"><span data-edit-status></span><button type="button" class="btn btn-secondary btn-compact" data-admin-cancel>Cancel</button><button type="button" class="btn btn-primary btn-compact" data-admin-save>Save Changes</button></div>';
  }

  async function handleClick(event){
    const row=event.target.closest('[data-report-id]');
    if(!row)return;
    const id=row.dataset.reportId;
    if(event.target.closest('[data-admin-edit]')){
      row.querySelector('[data-admin-editor]').hidden=false;
      event.target.closest('[data-admin-edit]').disabled=true;
      return;
    }
    if(event.target.closest('[data-admin-cancel]')){
      await load();return;
    }
    if(event.target.closest('[data-admin-save]')){
      await saveRow(row,id);return;
    }
    if(event.target.closest('[data-admin-delete]')){
      const who=row.querySelector('.wolf-admin-report-who strong')?.textContent||'this CMDR';
      const value=row.querySelector('.wolf-admin-report-value strong')?.textContent||'this report';
      if(!window.confirm('Delete '+value+' submitted by '+who+'? Squad progress will be recalculated immediately.'))return;
      await mutate('DELETE',{reportId:id},'Deleting report…');
    }
  }

  async function saveRow(row,id){
    const type=row.dataset.reportType;
    const body={reportId:id};
    const field=key=>n(row.querySelector('[data-edit-field="'+key+'"]')?.value);
    if(type==='inf')body.inf={inf2:field('inf2'),inf3:field('inf3'),inf4:field('inf4'),inf5:field('inf5')};
    else if(['bounties','trade','exploration'].includes(type))body.millions=field('millions');
    else if(type==='cz'){
      body.mode=row.querySelector('[data-edit-mode]')?.value==='wing'?'wing':'solo';
      body.bondsRedeemed=Boolean(row.querySelector('[data-edit-bonds]')?.checked);
      body.cz={low:field('low'),medium:field('medium'),high:field('high'),lossLow:field('lossLow'),lossMedium:field('lossMedium'),lossHigh:field('lossHigh'),disconnectLow:field('disconnectLow'),disconnectMedium:field('disconnectMedium'),disconnectHigh:field('disconnectHigh')};
    }
    const local=row.querySelector('[data-edit-status]');
    local.textContent='Saving…';
    await mutate('PATCH',body,'Saving report…',local);
  }

  async function mutate(method,body,message,localStatus=null){
    if(busy)return;
    busy=true;
    const p=ensurePanel(),status=p.querySelector('[data-report-status]');
    status.textContent=message;status.dataset.state='working';
    try{
      const response=await fetch(API,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Mongrels-Request':'daily-order-report'},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'report_mutation_failed');
      if(localStatus)localStatus.textContent='Saved';
      status.textContent=method==='DELETE'?'Report deleted. Squad totals recalculated.':'Report updated. Squad totals recalculated.';
      status.dataset.state='success';
      busy=false;
      setTimeout(()=>load(true),160);
    }catch(error){
      console.error(error);
      if(localStatus)localStatus.textContent='Could not save';
      status.textContent='Could not change report.';status.dataset.state='error';
      busy=false;
    }
  }

  function amount(report){
    if(report.reportType==='inf')return fmt(report.score)+' INF';
    if(['bounties','trade','exploration'].includes(report.reportType))return fmt(report.score)+' M Cr';
    if(report.reportType==='cz')return fmt(report.score)+' CZ pts';
    return fmt(report.score);
  }

  function typeLabel(type){
    return ({inf:'Mission INF',bounties:'Bounty vouchers',trade:'Trade profit',exploration:'Exploration data',cz:'Conflict Zones'})[type]||type||'Report';
  }

  function stamp(value){
    if(!value)return'Unknown time';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return'Unknown time';
    return date.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function cap(value){return String(value||'').charAt(0).toUpperCase()+String(value||'').slice(1)}
  function shortId(value){const text=String(value||'');return text.length>14?text.slice(0,8)+'…'+text.slice(-5):text}

  function start(){
    ensurePanel();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
