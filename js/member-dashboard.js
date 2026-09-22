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
  const rewardsBadge = $('[data-dashboard-rewards-badge]');
  const rewardsSummary = $('[data-dashboard-rewards-summary]');
  const rewardsPreview = $('[data-dashboard-rewards-preview]');
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
  const renderRewards=payload=>{
    const s=payload?.summary||{};
    const owed=Number(s.owedCredits)||0;
    const paid=Number(s.paidCredits)||0;
    const entries=Array.isArray(payload?.entries)?payload.entries:[];
    if(rewardsBadge)rewardsBadge.textContent=owed?owed.toLocaleString()+' Cr Owed':'0 Cr Owed';
    if(rewardsSummary)rewardsSummary.textContent=entries.length
      ? `Your reward ledger currently shows ${owed.toLocaleString()} Cr owed and ${paid.toLocaleString()} Cr settled.`
      : 'No reward ledger entries yet. Verified Scout activity is currently shown as reward preview only and does not create debt.';
    if(!rewardsPreview)return;
    rewardsPreview.replaceChildren();
    entries.slice(0,3).forEach(entry=>{
      const row=document.createElement('div');row.className='member-order-preview-row';
      const meta=document.createElement('span');
      meta.textContent=[entry.status==='paid'?'Paid':'Owed',entry.createdAt?new Date(entry.createdAt).toLocaleDateString():null].filter(Boolean).join(' · ');
      const title=document.createElement('strong');
      const amount=Number(entry.amountCredits)||0;
      title.textContent=`${amount>=0?'+':''}${amount.toLocaleString()} Cr · ${entry.reason||'Squad reward'}`;
      row.append(meta,title);rewardsPreview.appendChild(row);
    });
  };
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

  const init=async()=>{try{const {response,payload:session}=await fetchJson('/api/auth/session');if(!response.ok||!session.authenticated)return;const isOfficer=['officer','site_admin'].includes(session.access);if(officerPanel)officerPanel.hidden=!isOfficer;if(memberNote)memberNote.hidden=isOfficer;siteAdminLinks.forEach(link=>{link.hidden=session.access!=='site_admin';});const [ordersResult,projectsResult,carrierResult,tradeResult,bountyResult,onboardingResultData,rewardsResult]=await Promise.all([fetchJson('/api/operations/orders'),fetchJson('/api/projects'),fetchJson('/api/carriers?resource=coordination'),fetchJson('/api/trades'),fetchJson('/api/bounties'),fetchJson('/api/member/onboarding'),fetchJson('/api/rewards/status')]);if(ordersResult.response.ok)renderOrders(ordersResult.payload);else renderUnavailable();if(projectsResult.response.ok)renderProjects(projectsResult.payload);if(carrierResult.response.ok)renderCarriers(carrierResult.payload);if(tradeResult.response.ok)renderTrades(tradeResult.payload);if(bountyResult.response.ok)renderBounties(bountyResult.payload);if(onboardingResultData.response.ok)renderOnboarding(onboardingResultData.payload);if(rewardsResult.response.ok)renderRewards(rewardsResult.payload);}catch(error){console.error('Could not load member dashboard',error);renderUnavailable();}};
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
    if (badge) badge.textContent = 'Frontier + EDMC';
    const paragraph = card.querySelector('p:not(.eyebrow)');
    if (paragraph) paragraph.textContent = 'Connect Elite for reward verification, and use Live Scout when you want fresh faction-board data sent directly into Wolf BGS Control.';
    const oldActions = card.querySelector('.member-scout-actions');
    if (oldActions) oldActions.innerHTML = '<a class="btn btn-primary" href="/api/frontier/login" data-frontier-card-connect>Connect Elite Account</a><a class="btn btn-ghost" href="#mongrel-scout-setup">Scout & Setup</a>';

    panel.innerHTML = `
      <div class="member-panel-heading"><div><p class="eyebrow">Member Elite Tools</p><h3>Elite Connection & Live Scout</h3></div><span data-frontier-badge>Checking…</span></div>
      <p><strong>Connect Elite</strong> is used for reward verification. <strong>Live Scout (EDMC)</strong> is the separate tool that sends fresh faction-board snapshots to Wolf BGS Control.</p>
      <div class="frontier-scout-grid">
        <div class="frontier-scout-box"><strong>Elite connection</strong><span data-frontier-connection>Checking Frontier integration…</span></div>
        <div class="frontier-scout-box"><strong>Verification scope</strong><span data-frontier-system>Waiting for Daily Orders, Colonization Jobs, or claim tracking…</span></div>
      </div>
      <div class="frontier-scout-actions">
        <a class="btn btn-primary" href="/api/frontier/login" data-frontier-connect>Connect Elite Account</a>
        <button class="btn btn-primary" type="button" data-frontier-sync hidden>Sync Activity</button>
        <button class="btn btn-ghost" type="button" data-frontier-disconnect hidden>Disconnect</button>
      </div>
      <p class="member-scout-note" data-frontier-result>Checking your Frontier connection status.</p>
      <div class="frontier-scout-kpis" data-frontier-kpis hidden>
        <div class="frontier-scout-kpi"><span>Mission INF</span><strong data-frontier-inf>0</strong></div>
        <div class="frontier-scout-kpi"><span>Bounties Redeemed</span><strong data-frontier-bounties>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>Combat Bonds Redeemed</span><strong data-frontier-bonds>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>CZ Bonds Awarded</span><strong data-frontier-cz>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>BGS Trade Profit</span><strong data-frontier-trade>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>Exploration Sold</span><strong data-frontier-exploration>0 Cr</strong></div>
        <div class="frontier-scout-kpi"><span>Colonization Delivered</span><strong data-frontier-colonization>0 t</strong></div>
        <div class="frontier-scout-kpi"><span>System Claims Seen</span><strong data-frontier-claims>0</strong></div>
      </div>
      <div class="frontier-scout-events" data-frontier-events></div>
      <div class="frontier-scout-events" data-frontier-order-matches hidden></div>
      <details class="member-scout-note" data-frontier-diagnostics hidden>
        <summary><strong>Admin diagnostic journal trace</strong></summary>
        <p>This temporary test view shows timestamped event names and a small whitelist of safe fields from active Daily Order or Colonization Job systems, plus system-claim events from the connected CMDR, so we can diagnose verification behavior without retaining the full journal.</p>
        <div class="frontier-scout-events" data-frontier-diagnostic-events></div>
      </details>
      <p class="member-scout-note"><strong>Privacy:</strong> the server parses the Frontier journal in memory and keeps only BGS-relevant verification events for active Daily Order or Colonization Job systems plus colonization system-claim/release events. It does not retain your complete journal, credit balance, ship build, materials, or unrelated travel history.</p>
      <details class="member-scout-note" id="live-scout-setup"><summary><strong>Live Scout (EDMC) · Faction-board setup</strong></summary>
        <p>Live Scout is event-driven. It sends a complete faction board when Elite writes an <strong>FSDJump</strong>, <strong>Location</strong>, or <strong>CarrierJump</strong> journal event. It does not continuously poll influence while you remain parked in one system.</p>
        <div class="member-scout-steps">
          <div class="member-scout-step"><b>1. Install EDMC</b><span>Use Elite Dangerous Market Connector on the machine that can read your live Elite journal folder.</span></div>
          <div class="member-scout-step"><b>2. Download Live Scout</b><span>Download the ZIP, extract it, and copy the <strong>MongrelScout</strong> folder into EDMC's plugin folder.</span></div>
          <div class="member-scout-step"><b>3. Restart EDMC</b><span>Confirm the plugin loads in EDMC, then open Settings → Mongrel Scout.</span></div>
          <div class="member-scout-step"><b>4. Enter your token</b><span>Paste the Scout token issued by leadership, leave the supplied endpoint unchanged, and enable Scout.</span></div>
          <div class="member-scout-step"><b>5. Get a fresh board</b><span>Jump into the Mongrel system. If you are already sitting there and need a fresh post-tick board, <strong>jump out and back in</strong>.</span></div>
          <div class="member-scout-step"><b>6. Confirm the upload</b><span>EDMC should show <strong>Updated &lt;system&gt;</strong>. Leaving Scout running is fine, but new influence only arrives when Elite emits another qualifying full-board event.</span></div>
        </div>
        <div class="member-scout-actions"><a class="btn btn-ghost" href="/api/downloads/mongrel-scout">Download Live Scout</a></div>
      </details>
    `;
    return panel;
  }

  const frontierMoney = value => `${Math.round(Number(value)||0).toLocaleString()} Cr`;
  const frontierDate = value => {
    if (!value) return 'Not yet';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  };
  let frontierCooldownTimer=null;
  function frontierCooldownText(seconds){
    const total=Math.max(0,Math.ceil(Number(seconds)||0));
    const m=Math.floor(total/60),s=total%60;
    return `Sync available in ${m}:${String(s).padStart(2,'0')}`;
  }
  function applyFrontierCooldown(cooldown){
    const button=document.querySelector('[data-frontier-sync]');
    if(!button)return;
    if(frontierCooldownTimer){clearInterval(frontierCooldownTimer);frontierCooldownTimer=null;}
    const next=Date.parse(cooldown?.nextSyncAt||'');
    const update=()=>{
      const remaining=Number.isFinite(next)?Math.max(0,Math.ceil((next-Date.now())/1000)):0;
      if(remaining>0){
        button.disabled=true;
        button.textContent=frontierCooldownText(remaining);
      }else{
        const canSync=button.dataset.claimTracking!=='false';
        button.disabled=!canSync;
        button.textContent=canSync?'Sync Activity':'Sync unavailable';
        if(frontierCooldownTimer){clearInterval(frontierCooldownTimer);frontierCooldownTimer=null;}
      }
    };
    update();
    if(Number.isFinite(next)&&next>Date.now())frontierCooldownTimer=setInterval(update,1000);
  }
  function frontierEventLabel(event) {
    if (event.type === 'mission_inf') {
      const effects=event.effects||[];
      const inf=effects.reduce((n,x)=>n+(Number(x.infUnits)||0),0);
      const rep=effects.reduce((n,x)=>n+(Number(x.repUnits)||0),0);
      const factions=[...new Set(effects.map(x=>x.faction).filter(Boolean))];
      return `Mission · ${inf} INF${rep ? ` · REP ${rep>0?'+':''}${rep}` : ''}${factions.length ? ` · ${factions.join(', ')}` : ''}`;
    }
    if (event.type === 'bounties_redeemed') {
      const split=(event.factions||[]).map(x=>`${x.faction}: ${frontierMoney(x.amount)}`).join(' · ');
      return `Bounties redeemed · ${frontierMoney(event.amount)}${split ? ` · ${split}` : ''}`;
    }
    if (event.type === 'combat_bonds_redeemed') {
      const split=(event.factions||[]).map(x=>`${x.faction}: ${frontierMoney(x.amount)}`).join(' · ');
      return `Combat bonds redeemed · ${frontierMoney(event.amount)}${split ? ` · ${split}` : ''}`;
    }
    if (event.type === 'cz_bond_awarded') return `CZ bond awarded · ${frontierMoney(event.amount)}`;
    if (event.type === 'market_sell') {
      const qty=Number(event.count||0).toLocaleString();
      const commodity=event.commodity||'commodity';
      const faction=event.stationFaction ? ` · ${event.stationFaction}` : '';
      if (event.profitKnown === true && Number.isFinite(Number(event.profit))) {
        const eligibility=event.bgsTradeEligible===true
          ? ' · BGS trade verified'
          : event.tradeEligibilityReason
            ? ` · not reward eligible: ${String(event.tradeEligibilityReason).replaceAll('_',' ')}`
            : '';
        return `Market sale · ${frontierMoney(event.profit)} profit · ${frontierMoney(event.total)} revenue · ${qty} t ${commodity}${faction}${eligibility}`;
      }
      return `Market sale · profit pending re-sync · ${frontierMoney(event.total)} revenue · ${qty} t ${commodity}${faction}`;
    }
    if (event.type === 'exploration_sale') return `Exploration data sold · ${frontierMoney(event.amount)}`;
    if (event.type === 'colonization_system_claim') return 'Colonization system claim recorded';
    if (event.type === 'colonization_system_claim_release') return 'Colonization system claim released';
    if (event.type === 'colonization_depot') {
      const progress=Number.isFinite(Number(event.constructionProgress))
        ? ` · ${Math.max(0,Math.min(100,Number(event.constructionProgress)*100)).toFixed(1)}% complete`
        : '';
      return `Construction site observed${progress}`;
    }
    if (event.type === 'colonization_contribution') {
      const parts=(event.contributions||[]).map(item=>`${Number(item.amount||0).toLocaleString()} t ${item.commodity||item.commodityCode||'commodity'}`).join(' · ');
      return `Colonization delivery · ${Number(event.totalTons||0).toLocaleString()} t${parts?` · ${parts}`:''}`;
    }
    if (event.type === 'npc_text') {
      const text = event.messageLocalised || event.message || 'NPC journal message';
      return event.possibleReputation ? `Reputation diagnostic · ${text}` : `NPC journal text · ${text}`;
    }
    return String(event.sourceEvent || event.type || 'Journal event');
  }
  function renderFrontierScout(payload) {
    const badge=document.querySelector('[data-frontier-badge]');
    const connection=document.querySelector('[data-frontier-connection]');
    const result=document.querySelector('[data-frontier-result]');
    const connect=document.querySelector('[data-frontier-connect]');
    const sync=document.querySelector('[data-frontier-sync]');
    const disconnect=document.querySelector('[data-frontier-disconnect]');
    const cardConnect=document.querySelector('[data-frontier-card-connect]');
    const kpis=document.querySelector('[data-frontier-kpis]');
    const events=document.querySelector('[data-frontier-events]');
    const orderMatches=document.querySelector('[data-frontier-order-matches]');
    const scope=document.querySelector('[data-frontier-system]');
    if (!badge) return;

    if (!payload?.configured) {
      badge.textContent='Setup Required';
      if(connection) connection.textContent='Frontier developer client is not configured on the site yet.';
      if(result) result.textContent='The Scout UI is installed. Add the Frontier Client ID in Cloudflare after Frontier approves the application, then this button will become active.';
      if(connect){connect.setAttribute('aria-disabled','true');connect.classList.add('is-disabled');connect.removeAttribute('href');}
      if(cardConnect){cardConnect.setAttribute('aria-disabled','true');cardConnect.classList.add('is-disabled');cardConnect.removeAttribute('href');}
      if(sync) sync.hidden=true;if(disconnect)disconnect.hidden=true;if(kpis)kpis.hidden=true;
      return;
    }
    if (!payload.connected) {
      badge.textContent='Not Connected';
      if(connection) connection.textContent='No Elite account connected to this website member yet.';
      if(result) result.textContent='Connect once through Frontier. Mongrel Scout will then use refresh tokens between sessions until Frontier requires re-authorization.';
      if(connect){connect.href='/api/frontier/login';connect.hidden=false;connect.removeAttribute('aria-disabled');connect.classList.remove('is-disabled');}
      if(cardConnect){cardConnect.href='/api/frontier/login';cardConnect.hidden=false;cardConnect.removeAttribute('aria-disabled');cardConnect.classList.remove('is-disabled');}
      if(sync)sync.hidden=true;if(disconnect)disconnect.hidden=true;if(kpis)kpis.hidden=true;
      if(events)events.replaceChildren();
      if(orderMatches){orderMatches.replaceChildren();orderMatches.hidden=true;}
      return;
    }
    const account=payload.account||{};
    const targetSystems=Array.isArray(payload.targetSystems)?payload.targetSystems:[];
    badge.textContent='Connected';
    if(connection) connection.textContent=`${account.commander||'Elite CMDR'} · last sync ${frontierDate(account.lastSyncAt)}`;
    if(scope)scope.textContent=targetSystems.length
      ? targetSystems.join(' · ')
      : 'No scoped Daily Order / Colonization Job systems · system-claim tracking remains active.';
    if(result) result.textContent=targetSystems.length
      ? `Frontier connection active. Scout is scoped automatically to ${targetSystems.length} verification system${targetSystems.length===1?'':'s'} from active Daily Orders and Colonization Jobs, while colonization system claims are tracked globally for this CMDR.`
      : 'Frontier connection active. System-claim tracking remains available even without an active Daily Order or Colonization Job.';
    if(connect)connect.hidden=true;if(cardConnect)cardConnect.hidden=true;if(sync){sync.hidden=false;sync.dataset.claimTracking=String(payload.claimTrackingEnabled!==false);}if(disconnect)disconnect.hidden=false;
    applyFrontierCooldown(payload.cooldown);
    if(kpis)kpis.hidden=false;
    const s=payload.summary||{};
    const set=(sel,text)=>{const el=document.querySelector(sel);if(el)el.textContent=text;};
    set('[data-frontier-inf]',Number(s.missionInf||0).toLocaleString());
    set('[data-frontier-bounties]',frontierMoney(s.bounties));
    set('[data-frontier-bonds]',frontierMoney(s.combatBondsRedeemed));
    set('[data-frontier-cz]',frontierMoney(s.czBondAwards));
    const tradeText=frontierMoney(s.tradeEligibleProfit);
    set('[data-frontier-trade]',tradeText);
    set('[data-frontier-exploration]',frontierMoney(s.explorationSales));
    set('[data-frontier-colonization]',Number(s.colonizationTons||0).toLocaleString()+' t');
    set('[data-frontier-claims]',Number(s.colonizationSystemClaims||0).toLocaleString());
    if(events){
      events.replaceChildren();
      (payload.recentEvents||[]).slice(0,8).forEach(event=>{
        const row=document.createElement('div');row.className='frontier-scout-event';
        const strong=document.createElement('strong');strong.textContent=frontierEventLabel(event);
        const matchText=(event.orderMatches||[]).length
          ? '✓ Matched: '+event.orderMatches.map(match=>match.orderTask).join(' · ')
          : event.orderMatchStatus==='ambiguous' ? 'Needs order assignment' : '';
        const small=document.createElement('small');small.textContent=[frontierDate(event.timestamp),event.station,event.system,matchText].filter(Boolean).join(' · ');
        row.append(strong,small);events.appendChild(row);
      });
    }
    if(orderMatches){
      const matched=Array.isArray(payload.verifiedOrders)?payload.verifiedOrders:[];
      orderMatches.replaceChildren();
      orderMatches.hidden=!matched.length;
      if(matched.length){
        const heading=document.createElement('div');heading.className='frontier-scout-event';
        const hs=document.createElement('strong');hs.textContent='VERIFIED DAILY ORDER MATCHES';
        const hsmall=document.createElement('small');hsmall.textContent='Machine-verified contribution currently attached to active published orders.';
        heading.append(hs,hsmall);orderMatches.appendChild(heading);
        matched.forEach(item=>{
          const row=document.createElement('div');row.className='frontier-scout-event';
          const strong=document.createElement('strong');strong.textContent=item.task||'Daily Order';
          const small=document.createElement('small');
          const reward=item.rewardEligible
            ? `Reward preview: ${Number(item.entitlementMillions||0).toLocaleString()}M / ${Number(item.capMillions||0).toLocaleString()}M Cr cap · preview only`
            : '';
          small.textContent=[`${Number(item.contribution||0).toLocaleString()} ${item.unit||''} verified`,reward,item.faction,item.system,`revision ${item.revision||1}`].filter(Boolean).join(' · ');
          row.append(strong,small);orderMatches.appendChild(row);
        });
      }
    }
  }
  function renderFrontierDiagnostics(items) {
    const details=document.querySelector('[data-frontier-diagnostics]');
    const container=document.querySelector('[data-frontier-diagnostic-events]');
    if(!details||!container)return;
    const rows=Array.isArray(items)?items:[];
    details.hidden=!rows.length;
    container.replaceChildren();
    rows.slice(0,500).forEach(item=>{
      const row=document.createElement('div');row.className='frontier-scout-event';
      const strong=document.createElement('strong');strong.textContent=`${frontierDate(item.timestamp)} · ${item.event||'Unknown event'}`;
      const safe={...item};delete safe.timestamp;delete safe.event;delete safe.system;delete safe.station;
      const small=document.createElement('small');
      const parts=[];
      if(item.station)parts.push(item.station);
      for(const [key,value] of Object.entries(safe)){
        if(key==='keys')continue;
        parts.push(`${key}: ${String(value)}`);
      }
      if(Array.isArray(item.keys)&&item.keys.length)parts.push(`keys: ${item.keys.join(', ')}`);
      small.textContent=parts.join(' · ');
      row.append(strong,small);container.appendChild(row);
    });
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
      const result=document.querySelector('[data-frontier-result]');if(result)result.textContent='Requesting Frontier journal data and checking activity against active Daily Orders and Colonization Jobs…';
      try{
        const response=await fetch('/api/frontier/sync',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Mongrels-Request':'mongrel-frontier'}});
        const payload=await response.json().catch(()=>({}));
        if(response.status===429&&payload.error==='frontier_sync_cooldown'){
          applyFrontierCooldown({nextSyncAt:payload.nextSyncAt,remainingSeconds:payload.retryAfterSeconds});
          if(result)result.textContent=frontierCooldownText(payload.retryAfterSeconds);
          return;
        }
        if(!response.ok||!payload.ok)throw new Error(payload.error||`Sync failed (${response.status})`);
        renderFrontierDiagnostics(payload.diagnosticEvents);
        const refreshed=await fetchJson('/api/frontier/status');
        if(refreshed.response.ok)renderFrontierScout(refreshed.payload);
        if(result){
          if(payload.skipped){
            result.textContent=payload.message||'Frontier journal retrieval was skipped.';
          }else if(payload.partial){
            result.textContent='Frontier returned partial journal data. Verified events were saved; the incomplete date will remain eligible for reconciliation on a later sync.';
          }else{
            const historical=payload.journalCoverage?.historicalDate;
            result.textContent=`Sync complete. ${Number(payload.newEvents||0)} retained verification/colonization event${Number(payload.newEvents||0)===1?'':'s'} found.${historical?' Historical '+historical+' was also reconciled.':''}`;
          }
        }
      }catch(error){
        console.error('Frontier Scout sync failed',error);
        if(result)result.textContent=String(error.message||'Sync failed').includes('reauthorization')?'Frontier requires you to reconnect your Elite account.':'Frontier sync could not be completed. Try again after the game session or if CAPI is temporarily unavailable.';
      }finally{
        if(!button.textContent.startsWith('Sync available in')){
          const canSync=button.dataset.claimTracking!=='false';
          button.disabled=!canSync;
          button.textContent=canSync?'Sync Activity':'Sync unavailable';
        }
      }
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
