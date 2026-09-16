(() => {
  const dashboard = document.querySelector('[data-auth-profile]');
  if (!dashboard) return;
  const $ = sel => document.querySelector(sel);
  const officerPanel = $('[data-dashboard-officer]');
  const memberNote = $('[data-dashboard-member-note]');
  const siteAdminLinks = document.querySelectorAll('[data-dashboard-site-admin]');
  const count = $('[data-dashboard-orders-count]');
  const summary = $('[data-dashboard-orders-summary]');
  const preview = $('[data-dashboard-orders-preview]');
  const projectCount = $('[data-dashboard-projects-count]');
  const projectSummary = $('[data-dashboard-projects-summary]');
  const projectPreview = $('[data-dashboard-projects-preview]');
  const carrierCount = $('[data-dashboard-carriers-count]');
  const carrierSummary = $('[data-dashboard-carriers-summary]');
  const carrierPreview = $('[data-dashboard-carriers-preview]');
  const tradeCount = $('[data-dashboard-trades-count]');
  const tradeSummary = $('[data-dashboard-trades-summary]');
  const tradePreview = $('[data-dashboard-trades-preview]');
  const bountyCount = $('[data-dashboard-bounty-count]');
  const bountySummary = $('[data-dashboard-bounty-summary]');
  const bountyPreview = $('[data-dashboard-bounty-preview]');
  const onboarding = $('[data-new-member-onboarding]');
  const onboardingBadge = $('[data-onboarding-badge]');
  const onboardingIntro = $('[data-onboarding-intro]');
  const onboardingResult = $('[data-onboarding-result]');
  const onboardingDismiss = $('[data-onboarding-dismiss]');
  const onboardingProfile = $('[data-onboarding-profile]');

  const fetchJson = url => fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'}).then(async response=>({response,payload:await response.json().catch(()=>({}))}));
  const renderOrders = payload => { const orders=Array.isArray(payload?.orders)?payload.orders:[]; const active=orders.filter(o=>!['complete','completed'].includes(String(o.status||'').toLowerCase())); const visible=active.length?active:orders; if(count)count.textContent=orders.length?`${orders.length} ${orders.length===1?'Task':'Tasks'}`:'No Tasking'; if(summary)summary.textContent=payload?.configured?(payload.briefing||(orders.length?'Current squadron tasking is posted.':'A briefing is posted with no structured tasks.')):'No Daily Orders have been posted yet.'; if(!preview)return; preview.replaceChildren(); visible.slice(0,3).forEach(o=>{const row=document.createElement('div');row.className='member-order-preview-row';const meta=document.createElement('span');meta.textContent=[o.priority,o.system].filter(Boolean).join(' · ')||'Operational Task';const task=document.createElement('strong');task.textContent=o.task||'Operational task';row.append(meta,task);preview.appendChild(row);}); if(visible.length>3){const more=document.createElement('small');more.textContent=`+${visible.length-3} more task${visible.length-3===1?'':'s'}`;preview.appendChild(more);}};
  const formatDate=value=>{if(!value)return'';const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{month:'short',day:'numeric'});};
  const projectScore=item=>{let score=0;if(item.official)score+=1000;if(item.kind==='event'&&item.deadline){const days=(new Date(`${item.deadline}T12:00:00`).getTime()-Date.now())/86400000;if(days>=-1&&days<=30)score+=800-Math.max(0,days)*10;}if(item.status==='active')score+=300;if(item.isMine)score+=120;score+=Math.min(100,Number(item.progress)||0);return score;};
  const renderProjects=payload=>{const items=Array.isArray(payload?.items)?payload.items:[];const active=items.filter(i=>i.status!=='complete');if(projectCount)projectCount.textContent=active.length?`${active.length} Active`:'No Active Posts';if(projectSummary)projectSummary.textContent=active.length?'The most relevant active projects, help requests, and upcoming events are shown below.':'No active member projects or squad events are posted right now.';if(!projectPreview)return;projectPreview.replaceChildren();active.sort((a,b)=>projectScore(b)-projectScore(a)).slice(0,3).forEach(i=>{const row=document.createElement('div');row.className='member-order-preview-row';const meta=document.createElement('span');meta.textContent=[i.kind==='event'?'Event':(i.official?'Squad Project':i.category),i.system,i.deadline?formatDate(i.deadline):''].filter(Boolean).join(' · ');const title=document.createElement('strong');title.textContent=i.title;row.append(meta,title);projectPreview.appendChild(row);});};
  const renderCarriers=payload=>{const posts=Array.isArray(payload?.posts)?payload.posts:[];const active=posts.filter(p=>p.status!=='complete');if(carrierCount)carrierCount.textContent=active.length?`${active.length} Active`:'No Active Posts';if(carrierSummary)carrierSummary.textContent=active.length?'Upcoming moves and logistics requests that may need member attention.':'No active carrier moves or logistics requests are posted right now.';if(!carrierPreview)return;carrierPreview.replaceChildren();active.sort((a,b)=>{if(a.priority!==b.priority)return a.priority==='urgent'?-1:1;const ad=a.departure?Date.parse(a.departure):Infinity,bd=b.departure?Date.parse(b.departure):Infinity;return ad-bd;}).slice(0,3).forEach(p=>{const row=document.createElement('div');row.className='member-order-preview-row';const meta=document.createElement('span');meta.textContent=[p.priority==='urgent'?'Urgent':null,p.carrierCallsign,p.destination].filter(Boolean).join(' · ');const title=document.createElement('strong');title.textContent=`${p.carrierName} — ${String(p.activityType||'Coordination').replace(/_/g,' ')}`;row.append(meta,title);carrierPreview.appendChild(row);});};
  const renderTrades=payload=>{const items=Array.isArray(payload?.routes)?payload.routes:[];const active=items.filter(i=>i.status!=='complete'&&i.status!=='expired');if(tradeCount)tradeCount.textContent=active.length?`${active.length} Active`:'No Active Routes';if(tradeSummary)tradeSummary.textContent=active.length?'Current strategic hauling and member-posted trade opportunities are shown below.':'No active member-posted trade routes are available right now.';if(!tradePreview)return;tradePreview.replaceChildren();active.sort((a,b)=>(b.category==='squad')-(a.category==='squad')||(Number(b.profitPerTon)||0)-(Number(a.profitPerTon)||0)).slice(0,3).forEach(i=>{const row=document.createElement('div');row.className='member-order-preview-row';const meta=document.createElement('span');meta.textContent=[i.category==='squad'?'Squad Support':(i.profitPerTon?`${Number(i.profitPerTon).toLocaleString()} Cr/t`:'Trade Route'),i.destinationSystem].filter(Boolean).join(' · ');const title=document.createElement('strong');title.textContent=i.title||i.commodity||'Trade opportunity';row.append(meta,title);tradePreview.appendChild(row);});};
  const renderBounties=payload=>{const items=Array.isArray(payload?.bounties)?payload.bounties:[];const active=items.filter(i=>i.status==='active');if(bountyCount)bountyCount.textContent=active.length?`${active.length} Active`:'No Active Bounties';if(bountySummary)bountySummary.textContent=active.length?'Current member-posted in-game PvP contracts are shown below.':'No active in-game bounty contracts are posted right now.';if(!bountyPreview)return;bountyPreview.replaceChildren();active.slice(0,3).forEach(i=>{const row=document.createElement('div');row.className='member-bounty-preview-row';const target=document.createElement('strong');target.className='member-bounty-target';target.textContent=i.target;const reward=document.createElement('strong');reward.className='member-bounty-reward';reward.textContent=i.reward;const meta=document.createElement('span');meta.textContent=i.system||'PvP Contract';row.append(target,reward,meta);bountyPreview.appendChild(row);});};
  const renderUnavailable=()=>{if(count)count.textContent='Unavailable';if(summary)summary.textContent='The secure Daily Orders service could not be reached.';};

  function setOnboardingRow(name, complete) {
    const row = document.querySelector(`[data-onboarding-row="${name}"]`);
    if (!row) return;
    row.classList.toggle('member-onboarding-complete', Boolean(complete));
  }

  function renderOnboarding(payload) {
    if (!onboarding || !payload?.eligible) return;
    onboarding.hidden = false;
    const tasks = payload.tasks || {};
    const inGame = document.querySelector('[data-onboarding-task="inGameConfirmed"]');
    const tasking = document.querySelector('[data-onboarding-task="reviewedTasking"]');
    if (inGame) inGame.checked = Boolean(tasks.inGameConfirmed);
    if (tasking) tasking.checked = Boolean(tasks.reviewedTasking);
    if (onboardingProfile) onboardingProfile.checked = Boolean(tasks.profileCreated);
    setOnboardingRow('inGameConfirmed', tasks.inGameConfirmed);
    setOnboardingRow('profileCreated', tasks.profileCreated);
    setOnboardingRow('reviewedTasking', tasks.reviewedTasking);

    if (payload.complete) {
      if (onboardingBadge) onboardingBadge.textContent = 'Complete';
      if (onboardingIntro) onboardingIntro.textContent = 'Your new-member setup is complete. You can keep this checklist visible for reference or dismiss it from the Member Portal.';
      if (onboardingDismiss) onboardingDismiss.hidden = false;
      if (onboardingResult) onboardingResult.textContent = 'All onboarding items complete.';
    } else {
      if (onboardingBadge) onboardingBadge.textContent = 'Getting Started';
      if (onboardingIntro) onboardingIntro.textContent = 'Your Discord access is active. Finish these last setup items so your in-game and website membership are fully squared away.';
      if (onboardingDismiss) onboardingDismiss.hidden = true;
      if (onboardingResult) onboardingResult.textContent = 'Checklist progress saves automatically.';
    }
  }

  async function saveOnboardingTask(task, completed, input) {
    if (input) input.disabled = true;
    if (onboardingResult) onboardingResult.textContent = 'Saving checklist…';
    try {
      const response = await fetch('/api/member/onboarding', {
        method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'member-onboarding',Accept:'application/json'},
        body:JSON.stringify({action:'set_task',task,completed}),
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `Save failed (${response.status})`);
      const refreshed = await fetchJson('/api/member/onboarding');
      if (refreshed.response.ok) renderOnboarding(refreshed.payload);
    } catch (error) {
      console.error('Could not save onboarding task', error);
      if (input) input.checked = !completed;
      if (onboardingResult) onboardingResult.textContent = 'Could not save that checklist item. Try again.';
    } finally {
      if (input) input.disabled = false;
    }
  }

  document.querySelectorAll('[data-onboarding-task]').forEach(input => {
    input.addEventListener('change', () => saveOnboardingTask(input.dataset.onboardingTask, input.checked, input));
  });

  onboardingDismiss?.addEventListener('click', async () => {
    onboardingDismiss.disabled = true;
    if (onboardingResult) onboardingResult.textContent = 'Completing onboarding…';
    try {
      const response = await fetch('/api/member/onboarding', {
        method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'member-onboarding',Accept:'application/json'},
        body:JSON.stringify({action:'dismiss'}),
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `Request failed (${response.status})`);
      onboarding.hidden = true;
    } catch (error) {
      console.error('Could not complete onboarding', error);
      if (onboardingResult) onboardingResult.textContent = 'Could not complete onboarding. Make sure every checklist item is finished.';
      onboardingDismiss.disabled = false;
    }
  });

  const init=async()=>{try{const {response,payload:session}=await fetchJson('/api/auth/session');if(!response.ok||!session.authenticated)return;const isOfficer=['officer','site_admin'].includes(session.access);if(officerPanel)officerPanel.hidden=!isOfficer;if(memberNote)memberNote.hidden=isOfficer;siteAdminLinks.forEach(link=>{link.hidden=session.access!=='site_admin';});const [ordersResult,projectsResult,carrierResult,tradeResult,bountyResult,onboardingResultData]=await Promise.all([fetchJson('/api/operations/orders'),fetchJson('/api/projects'),fetchJson('/api/carriers?resource=coordination'),fetchJson('/api/trades'),fetchJson('/api/bounties'),fetchJson('/api/member/onboarding')]);if(ordersResult.response.ok)renderOrders(ordersResult.payload);else renderUnavailable();if(projectsResult.response.ok)renderProjects(projectsResult.payload);if(carrierResult.response.ok)renderCarriers(carrierResult.payload);if(tradeResult.response.ok)renderTrades(tradeResult.payload);if(bountyResult.response.ok)renderBounties(bountyResult.payload);if(onboardingResultData.response.ok)renderOnboarding(onboardingResultData.payload);}catch(error){console.error('Could not load member dashboard',error);renderUnavailable();}};
  init();
})();
