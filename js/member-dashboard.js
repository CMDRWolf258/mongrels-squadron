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
  function installFrontierScoutUi() {
    const card = document.querySelector('#mongrel-scout');
    const panel = document.querySelector('#mongrel-scout-setup');
    if (!card || !panel) return null;

    if (!document.querySelector('#frontier-scout-styles')) {
      const style = document.createElement('style');
      style.id = 'frontier-scout-styles';
      style.textContent = `
        .frontier-scout-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}
        .frontier-scout-box{padding:14px;border:1px solid rgba(98,220,255,.16);background:rgba(0,0,0,.14)}
        .frontier-scout-box strong{display:block;margin-bottom:5px}
        .frontier-scout-box span,.frontier-scout-meta{color:var(--muted,#aab5bf);line-height:1.45}
        .frontier-scout-actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}
        .frontier-scout-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}
        .frontier-scout-kpi{padding:12px;border:1px solid rgba(98,220,255,.14);background:rgba(98,220,255,.035)}
        .frontier-scout-kpi span{display:block;color:var(--muted,#aab5bf);font-size:.82rem;text-transform:uppercase;letter-spacing:.06em}
        .frontier-scout-kpi strong{display:block;margin-top:4px;font-size:1.05rem}
        .frontier-scout-events{display:grid;gap:8px;margin-top:14px}
        .frontier-scout-event{padding:10px 12px;border-left:2px solid rgba(98,220,255,.4);background:rgba(255,255,255,.018)}
        .frontier-scout-event strong{display:block}.frontier-scout-event small{color:var(--muted,#aab5bf)}
        @media(max-width:700px){.frontier-scout-grid,.frontier-scout-kpis{grid-template-columns:1fr}}
      `;
      document.head.appendChild(style);
    }

    const badge = card.querySelector('.member-command-badge');
    if (badge) badge.textContent = 'Frontier CAPI';
    const paragraph = card.querySelector('p:not(.eyebrow)');
    if (paragraph) paragraph.textContent = 'Connect your Elite account once, then let Mongrel Scout verify BGS work from Frontier journal data without requiring EDMC for normal reward tracking.';
    const oldActions = card.querySelector('.member-scout-actions');
    if (oldActions) oldActions.innerHTML = '<a class="btn btn-primary" href="#mongrel-scout-setup">Open Scout</a>';

    panel.innerHTML = `
      <div class="member-panel-heading"><div><p class="eyebrow">Mongrel Scout · Frontier CAPI</p><h3>Elite Account Uplink</h3></div><span data-frontier-badge>Checking…</span></div>
      <p>Primary reward verification uses Frontier's authenticated journal feed. Live EDMC Scout remains available as an optional real-time telemetry mode.</p>
      <div class="frontier-scout-grid">
        <div class="frontier-scout-box"><strong>Elite connection</strong><span data-frontier-connection>Checking Frontier integration…</span></div>
        <div class="frontier-scout-box"><strong>Test system</strong><span data-frontier-system>NGC 2546 Sector UZ-G d10-16</span></div>
      </div>
      <div class="frontier-scout-actions">
        <a class="btn btn-primary" href="/api/frontier/login" data-frontier-connect>Connect Elite Account</a>
        <button class="btn btn-primary" type="button" data-frontier-sync hidden>Sync 10-16 Activity</button>
        <button class="btn btn-ghost" type="button" data-frontier-disconnect hidden>Disconnect</button>
      </div>
      <p class="member-scout-note" data-frontier-result>Checking your Frontier connection status.</p>
      <div class="frontier-scout-kpis" data-frontier-kpis hidden>
        <div class="frontier-scout-kpi"><span>Mission INF</span><strong data-frontier-inf>0</strong></div>
        <div class="frontier-scout-kpi"><span>Bounties Redeemed</span><strong data-frontier-bounties>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>Combat Bonds Redeemed</span><strong data-frontier-bonds>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>CZ Bonds Awarded</span><strong data-frontier-cz>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>Trade Delivered</span><strong data-frontier-trade>0 t</strong></div>
        <div class="frontier-scout-kpi"><span>Exploration Sold</span><strong data-frontier-exploration>0 Cr</strong></div>
      </div>
      <div class="frontier-scout-events" data-frontier-events></div>
      <p class="member-scout-note"><strong>Privacy:</strong> the server parses the Frontier journal in memory and keeps only BGS-relevant verification events for the configured Scout system. It does not retain your complete journal, credit balance, ship build, materials, or unrelated travel history.</p>
      <details class="member-scout-note"><summary><strong>Optional Live Scout (EDMC)</strong></summary><p>EDMC Scout is still available for immediate faction-board reporting and future live telemetry. It is no longer required for the normal Frontier-based reward-verification path.</p><div class="member-scout-actions"><a class="btn btn-ghost" href="/downloads/mongrel-scout.zip">Download Live Scout</a></div></details>
    `;
    return panel;
  }

  const frontierMoney = value => `${Math.round(Number(value)||0).toLocaleString()} Cr`;
  const frontierDate = value => {
    if (!value) return 'Not yet';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  };
  function frontierEventLabel(event) {
    if (event.type === 'mission_inf') return `Mission INF · ${(event.effects||[]).reduce((n,x)=>n+(Number(x.infUnits)||0),0)} INF`;
    if (event.type === 'bounties_redeemed') return `Bounties redeemed · ${frontierMoney(event.amount)}`;
    if (event.type === 'combat_bonds_redeemed') return `Combat bonds redeemed · ${frontierMoney(event.amount)}`;
    if (event.type === 'cz_bond_awarded') return `CZ bond awarded · ${frontierMoney(event.amount)}`;
    if (event.type === 'market_sell') return `Market sale · ${Number(event.count||0).toLocaleString()} t ${event.commodity||''}`;
    if (event.type === 'exploration_sale') return `Exploration data sold · ${frontierMoney(event.amount)}`;
    return String(event.sourceEvent || event.type || 'Journal event');
  }
  function renderFrontierScout(payload) {
    const badge=document.querySelector('[data-frontier-badge]');
    const connection=document.querySelector('[data-frontier-connection]');
    const result=document.querySelector('[data-frontier-result]');
    const connect=document.querySelector('[data-frontier-connect]');
    const sync=document.querySelector('[data-frontier-sync]');
    const disconnect=document.querySelector('[data-frontier-disconnect]');
    const kpis=document.querySelector('[data-frontier-kpis]');
    const events=document.querySelector('[data-frontier-events]');
    if (!badge) return;

    if (!payload?.configured) {
      badge.textContent='Setup Required';
      if(connection) connection.textContent='Frontier developer client is not configured on the site yet.';
      if(result) result.textContent='The Scout UI is installed. Add the Frontier Client ID in Cloudflare after Frontier approves the application, then this button will become active.';
      if(connect){connect.setAttribute('aria-disabled','true');connect.classList.add('is-disabled');connect.removeAttribute('href');}
      if(sync) sync.hidden=true;if(disconnect)disconnect.hidden=true;if(kpis)kpis.hidden=true;
      return;
    }
    if (!payload.connected) {
      badge.textContent='Not Connected';
      if(connection) connection.textContent='No Elite account connected to this website member yet.';
      if(result) result.textContent='Connect once through Frontier. Mongrel Scout will then use refresh tokens between sessions until Frontier requires re-authorization.';
      if(connect){connect.href='/api/frontier/login';connect.hidden=false;connect.removeAttribute('aria-disabled');connect.classList.remove('is-disabled');}
      if(sync)sync.hidden=true;if(disconnect)disconnect.hidden=true;if(kpis)kpis.hidden=true;
      if(events)events.replaceChildren();
      return;
    }
    const account=payload.account||{};
    badge.textContent='Connected';
    if(connection) connection.textContent=`${account.commander||'Elite CMDR'} · last sync ${frontierDate(account.lastSyncAt)}`;
    if(result) result.textContent=`Frontier connection active. Re-authorization target: ${frontierDate(account.reauthDueAt)}. Journal events keep their original timestamps, so delayed CAPI delivery will not move verified work into the wrong BGS cycle.`;
    if(connect)connect.hidden=true;if(sync)sync.hidden=false;if(disconnect)disconnect.hidden=false;
    if(kpis)kpis.hidden=false;
    const s=payload.summary||{};
    const set=(sel,text)=>{const el=document.querySelector(sel);if(el)el.textContent=text;};
    set('[data-frontier-inf]',Number(s.missionInf||0).toLocaleString());
    set('[data-frontier-bounties]',frontierMoney(s.bounties));
    set('[data-frontier-bonds]',frontierMoney(s.combatBondsRedeemed));
    set('[data-frontier-cz]',frontierMoney(s.czBondAwards));
    set('[data-frontier-trade]',`${Number(s.tradeTonnage||0).toLocaleString()} t`);
    set('[data-frontier-exploration]',frontierMoney(s.explorationSales));
    if(events){
      events.replaceChildren();
      (payload.recentEvents||[]).slice(0,8).forEach(event=>{
        const row=document.createElement('div');row.className='frontier-scout-event';
        const strong=document.createElement('strong');strong.textContent=frontierEventLabel(event);
        const small=document.createElement('small');small.textContent=[frontierDate(event.timestamp),event.station,event.system].filter(Boolean).join(' · ');
        row.append(strong,small);events.appendChild(row);
      });
    }
  }
  async function loadFrontierScout() {
    installFrontierScoutUi();
    try {
      const {response,payload}=await fetchJson('/api/frontier/status');
      if(!response.ok) throw new Error(payload?.error||'Frontier status failed');
      renderFrontierScout(payload);
    } catch(error) {
      console.error('Could not load Frontier Scout',error);
      const result=document.querySelector('[data-frontier-result]');
      if(result)result.textContent='The Frontier Scout service could not be reached.';
    }

    document.querySelector('[data-frontier-sync]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;button.textContent='Syncing…';
      const result=document.querySelector('[data-frontier-result]');if(result)result.textContent='Requesting today\'s Frontier journal and checking 10-16 BGS activity…';
      try{
        const response=await fetch('/api/frontier/sync',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Mongrels-Request':'mongrel-frontier'}});
        const payload=await response.json().catch(()=>({}));
        if(!response.ok||!payload.ok)throw new Error(payload.error||`Sync failed (${response.status})`);
        const refreshed=await fetchJson('/api/frontier/status');
        if(refreshed.response.ok)renderFrontierScout(refreshed.payload);
        if(result)result.textContent=payload.partial?'Frontier returned a partial journal. Your verified events were saved; sync again later after the session completes.':`Sync complete. ${Number(payload.newEvents||0)} qualifying 10-16 journal events were found in Frontier's current response.`;
      }catch(error){
        console.error('Frontier Scout sync failed',error);
        if(result)result.textContent=String(error.message||'Sync failed').includes('reauthorization')?'Frontier requires you to reconnect your Elite account.':'Frontier sync could not be completed. Try again after the game session or if CAPI is temporarily unavailable.';
      }finally{button.disabled=false;button.textContent='Sync 10-16 Activity';}
    });
    document.querySelector('[data-frontier-disconnect]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{
        const response=await fetch('/api/frontier/disconnect',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Mongrels-Request':'mongrel-frontier'}});
        if(!response.ok)throw new Error('Disconnect failed');
        const refreshed=await fetchJson('/api/frontier/status');if(refreshed.response.ok)renderFrontierScout(refreshed.payload);
      }catch(error){console.error('Frontier disconnect failed',error);}finally{button.disabled=false;}
    });
  }

  loadFrontierScout();

  init();
})();
