(() => {
  const panel=document.querySelector('[data-reward-admin]');
  const form=panel?.querySelector('[data-reward-form]');
  const meta=panel?.querySelector('[data-reward-meta]');
  if(!panel||!form)return;

  const API='/api/operations/reward-settings';
  let settingsLoaded=false;
  let settingsLoading=false;
  let ledgerLoaded=false;
  let ledgerLoading=false;
  let ledgerLoadedAt=0;
  const LEDGER_FRESH_MS=5000;
  let verificationLoaded=false;
  let verificationLoading=false;
  let verificationLoadedAt=0;
  const VERIFICATION_FRESH_MS=5000;
  let paymentEntriesById=new Map();
  let paymentSelectedIds=new Set();
  let paymentSelectionOwnerId='';
  let paymentSelectionCommander='';
  let paymentRequestId='';
  let paymentCanConfirm=false;
  const RECENT_ISSUE_OVERLAY_MS=120000;
  const recentlyIssuedRewardEntries=new Map();

  function getPath(obj,path){
    return String(path||'').split('.').reduce((value,key)=>value&&typeof value==='object'?value[key]:undefined,obj);
  }

  function setPath(obj,path,value){
    const parts=String(path||'').split('.');
    let cursor=obj;
    parts.forEach((part,index)=>{
      if(index===parts.length-1){cursor[part]=value;return;}
      if(!cursor[part]||typeof cursor[part]!=='object')cursor[part]={};
      cursor=cursor[part];
    });
  }

  function stamp(value){
    if(!value)return'Using default reward rules.';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'Reward defaults saved.':`Saved ${d.toLocaleString()}`;
  }

  function dateTime(value){
    if(!value)return'—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleString();
  }

  const formatCredits=value=>Math.round(Number(value)||0).toLocaleString()+' Cr';

  function activeRecentIssues(){
    const now=Date.now();
    for(const [id,row] of recentlyIssuedRewardEntries){
      if(!row?.entry||!Number.isFinite(Number(row.issuedAt))||now-Number(row.issuedAt)>RECENT_ISSUE_OVERLAY_MS){
        recentlyIssuedRewardEntries.delete(id);
      }
    }
    return recentlyIssuedRewardEntries;
  }

  function overlayRecentlyIssuedLedger(ledger){
    const recent=activeRecentIssues();
    if(!recent.size||!ledger||typeof ledger!=='object')return ledger;
    const entries=Array.isArray(ledger.entries)?ledger.entries.slice():[];
    const owedEntries=Array.isArray(ledger.owedEntries)?ledger.owedEntries.slice():entries.filter(entry=>entry?.status==='owed');
    const members=Array.isArray(ledger.members)?ledger.members.map(member=>({...member})):[];
    const summary={...(ledger.summary||{})};
    const seen=new Set(entries.map(entry=>String(entry?.id||'')).filter(Boolean));

    for(const {entry} of recent.values()){
      const id=String(entry?.id||'');
      if(!id||seen.has(id))continue;
      seen.add(id);
      entries.unshift(entry);
      if(entry?.status==='owed')owedEntries.unshift(entry);

      const amount=Math.round(Number(entry?.amountCredits)||0);
      summary.entryCount=(Number(summary.entryCount)||0)+1;
      if(entry?.status==='paid')summary.totalPaidCredits=(Number(summary.totalPaidCredits)||0)+amount;
      else if(entry?.status==='owed')summary.totalOwedCredits=(Number(summary.totalOwedCredits)||0)+amount;

      const ownerId=String(entry?.ownerId||'');
      let member=members.find(row=>String(row?.ownerId||'')===ownerId);
      if(!member){
        member={
          ownerId,
          displayName:entry?.displayName||'Mongrel CMDR',
          owedCredits:0,
          paidCredits:0,
          owedEntryCount:0,
          paidEntryCount:0,
          entryCount:0,
          latestAt:entry?.createdAt||null,
          payoutRequest:null,
        };
        members.push(member);
        summary.memberCount=(Number(summary.memberCount)||0)+1;
      }
      member.entryCount=(Number(member.entryCount)||0)+1;
      if(entry?.status==='paid'){
        member.paidCredits=(Number(member.paidCredits)||0)+amount;
        member.paidEntryCount=(Number(member.paidEntryCount)||0)+1;
      }else if(entry?.status==='owed'){
        member.owedCredits=(Number(member.owedCredits)||0)+amount;
        member.owedEntryCount=(Number(member.owedEntryCount)||0)+1;
      }
      if(entry?.createdAt&&(!member.latestAt||String(entry.createdAt)>String(member.latestAt)))member.latestAt=entry.createdAt;
    }

    ledger.entries=entries;
    ledger.owedEntries=owedEntries;
    ledger.members=members;
    ledger.summary=summary;
    return ledger;
  }

  function overlayRecentlyIssuedDryRun(dry){
    const recent=activeRecentIssues();
    if(!recent.size||!dry||typeof dry!=='object')return dry;
    const summary=dry.summary&&typeof dry.summary==='object'?dry.summary:{};

    for(const member of Array.isArray(dry.members)?dry.members:[]){
      for(const item of Array.isArray(member?.obligations)?member.obligations:[]){
        const issued=recent.get(String(item?.id||''));
        if(!issued?.entry)continue;

        const beforeDelta=Math.max(0,Math.round(Number(item.deltaCredits)||0));
        const credit=Math.min(beforeDelta,Math.max(0,Math.round(Number(issued.entry.amountCredits)||0)));
        if(!credit)continue;

        const wasReady=item.readyForLive===true;
        item.existingCredits=Math.max(0,Math.round(Number(item.existingCredits)||0)+credit);
        item.deltaCredits=Math.max(0,beforeDelta-credit);
        item.readyForLive=item.deltaCredits>0&&!(Array.isArray(item.blockers)&&item.blockers.length);
        item.duplicateSuppressed=item.deltaCredits===0&&Number(item.entitlementCredits)>0&&!item.blockers?.length;
        if(!item.readyForLive)item.plannedEntry=null;

        member.deltaCredits=Math.max(0,(Number(member.deltaCredits)||0)-credit);
        summary.wouldCreateCredits=Math.max(0,(Number(summary.wouldCreateCredits)||0)-credit);
        summary.existingVerifiedCredits=(Number(summary.existingVerifiedCredits)||0)+credit;
        if(wasReady&&!item.readyForLive){
          member.readyCount=Math.max(0,(Number(member.readyCount)||0)-1);
          summary.readyObligations=Math.max(0,(Number(summary.readyObligations)||0)-1);
          if(item.duplicateSuppressed){
            member.duplicateSuppressedCount=(Number(member.duplicateSuppressedCount)||0)+1;
            summary.duplicateSuppressed=(Number(summary.duplicateSuppressed)||0)+1;
          }
        }
      }
    }
    dry.summary=summary;
    return dry;
  }

  const paymentSourceLabel=entry=>{
    if(entry?.kind==='colonization_job'||entry?.rewardType==='colonization')return'COLONIZATION';
    if(entry?.kind==='verified_order')return'DAILY ORDER';
    if(entry?.kind==='manual_adjustment')return'MANUAL ADJUSTMENT';
    return String(entry?.kind||'REWARD').replaceAll('_',' ').toUpperCase();
  };

  function clearPaymentSelection(){
    paymentSelectedIds=new Set();
    paymentSelectionOwnerId='';
    paymentSelectionCommander='';
    paymentRequestId='';
    updatePaymentSelectionUi();
  }

  function updatePaymentSelectionUi(){
    const consolePanel=document.querySelector('[data-reward-ledger-admin]');
    if(!consolePanel)return;
    let total=0;
    for(const id of paymentSelectedIds){
      const entry=paymentEntriesById.get(id);
      if(entry)total+=Number(entry.amountCredits)||0;
    }

    consolePanel.querySelectorAll('[data-payment-entry-id]').forEach(input=>{
      const id=String(input.dataset.paymentEntryId||'');
      const owner=String(input.dataset.paymentOwnerId||'');
      input.checked=paymentSelectedIds.has(id);
      input.disabled=!paymentCanConfirm||(Boolean(paymentSelectionOwnerId)&&owner!==paymentSelectionOwnerId);
    });
    consolePanel.querySelectorAll('[data-payment-select-all]').forEach(button=>{
      const owner=String(button.dataset.paymentOwnerId||'');
      button.disabled=!paymentCanConfirm||(Boolean(paymentSelectionOwnerId)&&owner!==paymentSelectionOwnerId);
    });

    const bar=consolePanel.querySelector('[data-reward-payment-bar]');
    if(!bar)return;
    const count=paymentSelectedIds.size;
    bar.hidden=count===0;
    const commander=bar.querySelector('[data-payment-selected-commander]');
    const selectedCount=bar.querySelector('[data-payment-selected-count]');
    const selectedTotal=bar.querySelector('[data-payment-selected-total]');
    const confirm=bar.querySelector('[data-payment-confirm]');
    if(commander)commander.textContent=paymentSelectionCommander||'—';
    if(selectedCount)selectedCount.textContent=count.toLocaleString();
    if(selectedTotal)selectedTotal.textContent=formatCredits(total);
    if(confirm)confirm.disabled=!paymentCanConfirm||count===0;
  }

  function fill(payload){
    const settings=payload?.settings||{};
    form.querySelectorAll('[data-reward]').forEach(input=>{
      const value=getPath(settings,input.dataset.reward);
      if(value!==undefined&&value!==null)input.value=String(value);
    });
    if(meta){
      const who=payload?.updatedBy?` by ${payload.updatedBy}`:'';
      meta.textContent=payload?.updatedAt?`${stamp(payload.updatedAt)}${who}.`:'Using default reward rules.';
    }
  }

  function collect(){
    const settings={trade:{},inf:{},bounties:{}};
    form.querySelectorAll('[data-reward]').forEach(input=>{
      const value=Number(input.value);
      setPath(settings,input.dataset.reward,Number.isFinite(value)?value:0);
    });
    return settings;
  }

  async function load(){
    if(settingsLoaded||settingsLoading)return;
    settingsLoading=true;
    if(meta)meta.textContent='Loading reward defaults…';
    try{
      const response=await fetch(API+'?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Reward settings request failed ('+response.status+')');
      fill(await response.json());
      settingsLoaded=true;
    }catch(error){
      console.error('Could not load reward settings',error);
      if(meta)meta.textContent='Could not load reward defaults.';
    }finally{
      settingsLoading=false;
    }
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    if(meta)meta.textContent='Saving reward defaults…';
    try{
      const response=await fetch(API,{
        method:'PUT',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/json',
          'X-Mongrels-Request':'wolf-rewards',
        },
        body:JSON.stringify({settings:collect()}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Save failed ('+response.status+')');
      fill(payload);
      settingsLoaded=true;
    }catch(error){
      console.error('Could not save reward settings',error);
      if(meta)meta.textContent='Could not save reward defaults.';
    }finally{
      if(button)button.disabled=false;
    }
  });

  async function loadLedgerPreview(force=false){
    const consolePanel=document.querySelector('[data-reward-ledger-admin]');
    if(!consolePanel||ledgerLoading)return;
    const fresh=ledgerLoaded&&(Date.now()-ledgerLoadedAt)<LEDGER_FRESH_MS;
    if(!force&&fresh)return;
    ledgerLoading=true;

    const ledgerList=consolePanel.querySelector('[data-reward-member-list]');
    const dryList=consolePanel.querySelector('[data-reward-dryrun-list]');
    const refreshButton=consolePanel.querySelector('[data-refresh-reward-dryrun]');
    const checked=consolePanel.querySelector('[data-reward-dryrun-checked]');
    if(refreshButton)refreshButton.disabled=true;
    if(checked)checked.textContent='Refreshing reward engine…';

    const fmt=formatCredits;
    const num=(selector,value)=>{const el=consolePanel.querySelector(selector);if(el)el.textContent=Number(value||0).toLocaleString();};
    const money=(selector,value)=>{const el=consolePanel.querySelector(selector);if(el)el.textContent=fmt(value);};
    const short=value=>{const text=String(value||'');return text.length>16?text.slice(0,10)+'…'+text.slice(-4):text||'—';};
    const blockerLabel=value=>({
      cycle_missing:'Cycle missing',
      logical_order_key_missing:'Logical order identity missing',
      current_order_missing:'Current order missing',
      frontier_evidence_missing:'Frontier evidence IDs missing',
      archive_provenance_missing:'Archived publication provenance missing',
      archive_revision_mismatch:'Archived order revision does not match current verified revision',
      order_legacy_history_gap:'Contribution predates the durable Daily Order baseline',
      order_revision_time_mismatch:'Contribution predates the archived Daily Order revision now being evaluated',
      order_event_time_missing:'Frontier evidence timestamp is missing, so revision timing cannot be proven',
      colonization_archive_provenance_missing:'Archived Colonization Job revision is missing',
      colonization_binding_provenance_missing:'Construction-site binding provenance is missing',
      colonization_legacy_history_gap:'Contribution predates the durable Colonization Job baseline',
      colonization_reward_rules_changed_during_job:'Reward rules changed while verified cargo spans multiple revisions',
      colonization_overlap_ambiguous:'Contribution matches multiple equally specific Colonization Jobs',
      existing_ledger_exceeds_entitlement:'Existing ledger credit exceeds current entitlement',
    }[value]||String(value||'').replaceAll('_',' '));

    try{
      const [ledgerResponse,dryResponse]=await Promise.all([
        fetch('/api/rewards/admin?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
        fetch('/api/rewards/dry-run?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
      ]);
      const [ledger,dry]=await Promise.all([
        ledgerResponse.json().catch(()=>({})),
        dryResponse.json().catch(()=>({})),
      ]);
      if(!ledgerResponse.ok)throw new Error(ledger.error||'Reward ledger request failed');
      if(!dryResponse.ok)throw new Error(dry.error||'Reward dry-run request failed');
      overlayRecentlyIssuedLedger(ledger);
      overlayRecentlyIssuedDryRun(dry);

      const ls=ledger.summary||{};
      money('[data-reward-total-owed]',ls.totalOwedCredits);
      money('[data-reward-total-paid]',ls.totalPaidCredits);
      num('[data-reward-member-count]',ls.memberCount);

      const ds=dry.summary||{};
      const mode=consolePanel.querySelector('[data-reward-engine-mode]');
      if(mode){
        const sources=Array.isArray(dry.sources)&&dry.sources.includes('colonization')?' · DAILY ORDERS + COLONIZATION':'';
        mode.textContent=String(dry.engineMode||dry.mode||'dry_run').replaceAll('_',' ').toUpperCase()+sources+' · AUTO WRITES OFF';
      }
      money('[data-reward-dryrun-create]',ds.wouldCreateCredits);
      num('[data-reward-dryrun-ready]',ds.readyObligations);
      num('[data-reward-dryrun-blocked]',ds.blockedObligations);
      num('[data-reward-dryrun-duplicates]',ds.duplicateSuppressed);
      money('[data-reward-dryrun-entitlement]',ds.entitlementCredits);
      money('[data-reward-dryrun-blocked-value]',ds.blockedDeltaCredits);
      const cycle=consolePanel.querySelector('[data-reward-dryrun-cycle]');
      const history=consolePanel.querySelector('[data-reward-dryrun-history]');
      const colonyHistory=consolePanel.querySelector('[data-reward-dryrun-colonization-history]');
      const ledgerCount=consolePanel.querySelector('[data-reward-dryrun-ledger-count]');
      if(cycle){cycle.textContent=short(dry.cycleId);cycle.title=String(dry.cycleId||'');}
      if(history)history.textContent=Number(dry.historyRecordCount||0).toLocaleString();
      if(colonyHistory)colonyHistory.textContent=Number(dry.colonizationHistoryRecordCount||0).toLocaleString();
      if(ledgerCount)ledgerCount.textContent=Number(dry.ledgerEntryCount||0).toLocaleString();

      if(dryList){
        dryList.replaceChildren();
        const members=Array.isArray(dry.members)?dry.members:[];
        if(!members.length){
          const empty=document.createElement('div');empty.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='No verified reward obligations in the current cycle.';
          const small=document.createElement('small');small.textContent='Verified Daily Order or Colonization Job activity will appear here automatically.';
          empty.append(strong,small);dryList.appendChild(empty);
        }else{
          members.forEach((member,index)=>{
            const details=document.createElement('details');
            details.className='wolf-dryrun-member';
            if(index===0)details.open=true;

            const summary=document.createElement('summary');
            const main=document.createElement('div');
            const name=document.createElement('strong');name.textContent=member.commander||'Elite CMDR';
            const info=document.createElement('small');
            info.textContent=[
              (Number(member.readyCount)||0)+' ready',
              (Number(member.blockedCount)||0)+' blocked',
              (Number(member.duplicateSuppressedCount)||0)+' duplicate suppressed',
            ].join(' · ');
            main.append(name,info);
            const total=document.createElement('div');total.className='wolf-dryrun-member-total';
            const amount=document.createElement('b');amount.textContent=fmt(member.deltaCredits);
            const label=document.createElement('small');label.textContent='eligible delta before blockers';
            total.append(amount,label);
            summary.append(main,total);

            const obligations=document.createElement('div');obligations.className='wolf-dryrun-obligations';
            (member.obligations||[]).forEach(item=>{
              const state=item.readyForLive?'ready':item.blockers?.length?'blocked':item.duplicateSuppressed?'duplicate':'blocked';
              const row=document.createElement('div');row.className='wolf-dryrun-obligation is-'+state;

              const order=document.createElement('div');order.className='wolf-dryrun-main';
              const strong=document.createElement('strong');strong.textContent=item.task||'Daily Order';
              const small=document.createElement('small');
              const pub=item.provenance?.publicationId?short(item.provenance.publicationId):'—';
              const revisions=Array.isArray(item.revisions)&&item.revisions.length
                ? 'revs '+item.revisions.join('/')
                : 'rev '+Number(item.revision||1);
              small.textContent=[
                item.source==='colonization'?'COLONIZATION':'DAILY ORDER',
                (member.commander||'Elite CMDR'),
                item.system,
                item.faction,
                Number(item.contribution||0).toLocaleString()+' '+(item.unit||''),
                revisions,
                (Number(item.eventCount)||0)+' evidence event'+(Number(item.eventCount)===1?'':'s'),
                'publication '+pub,
                'entry '+short(item.id),
              ].filter(Boolean).join(' · ');
              strong.title=String(item.id||'');
              order.append(strong,small);

              const amountBox=document.createElement('div');amountBox.className='wolf-dryrun-amount';
              const due=document.createElement('strong');due.textContent=fmt(item.deltaCredits);
              const detail=document.createElement('small');
              detail.textContent=fmt(item.entitlementCredits)+' entitlement · '+fmt(item.existingCredits)+' already ledgered';
              amountBox.append(due,detail);

              const stateBox=document.createElement('div');stateBox.className='wolf-dryrun-state';
              const chip=document.createElement('span');chip.className='wolf-dryrun-chip is-'+state;
              chip.textContent=item.readyForLive?'READY':item.duplicateSuppressed&&!item.blockers?.length?'DUPLICATE SUPPRESSED':'BLOCKED';
              stateBox.append(chip);
              if(item.provenance?.match==='exact'){
                const provenance=document.createElement('span');provenance.className='wolf-dryrun-chip is-provenance';provenance.textContent='ARCHIVE EXACT';
                provenance.title=String(item.provenance.snapshotHash||item.provenance.afterHash||'');
                stateBox.append(provenance);
              }
              if(dry.canIssueReady===true&&item.readyForLive&&item.plannedEntry){
                const issue=document.createElement('button');
                issue.type='button';
                issue.className='btn btn-secondary btn-compact wolf-dryrun-issue';
                issue.textContent='CREATE OWED ENTRY';
                issue.dataset.issueReadyReward=item.id||'';
                issue.dataset.issueAmountCredits=String(Math.round(Number(item.deltaCredits)||0));
                issue.dataset.issueEvidenceDigest=String(item.evidenceDigest||'');
                issue.dataset.issueRewardRuleDigest=String(item.rewardRuleDigest||'');
                issue.dataset.issueCommander=String(member.commander||'Elite CMDR');
                issue.dataset.issueTask=String(item.task||'Reward obligation');
                issue.title='Explicitly add this READY obligation to the actual reward ledger as OWED. This does not mark it paid.';
                stateBox.append(issue);
              }

              row.append(order,amountBox,stateBox);
              if(item.blockers?.length){
                const blockers=document.createElement('div');blockers.className='wolf-dryrun-blockers';
                blockers.textContent='Blocked: '+item.blockers.map(blockerLabel).join(' · ');
                row.append(blockers);
              }
              obligations.append(row);
            });

            details.append(summary,obligations);
            dryList.append(details);
          });
        }
      }

      if(ledgerList){
        ledgerList.replaceChildren();
        const members=Array.isArray(ledger.members)?ledger.members:[];
        const allEntries=Array.isArray(ledger.entries)?ledger.entries:[];
        const owedEntries=Array.isArray(ledger.owedEntries)?ledger.owedEntries:allEntries.filter(entry=>entry?.status==='owed');
        paymentCanConfirm=ledger.canConfirmPayments===true;
        paymentEntriesById=new Map(owedEntries.map(entry=>[String(entry?.id||''),entry]).filter(([id])=>id));
        paymentSelectedIds=new Set([...paymentSelectedIds].filter(id=>paymentEntriesById.has(id)));
        if(paymentSelectionOwnerId&&!owedEntries.some(entry=>String(entry?.ownerId||'')===paymentSelectionOwnerId&&paymentSelectedIds.has(String(entry?.id||'')))){
          paymentSelectionOwnerId='';
          paymentSelectionCommander='';
          paymentRequestId='';
        }

        if(!members.length){
          const empty=document.createElement('div');empty.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='Actual reward ledger is empty.';
          const small=document.createElement('small');small.textContent='READY obligations can be promoted to OWED before payment.';
          empty.append(strong,small);ledgerList.appendChild(empty);
        }else{
          members.forEach((member,index)=>{
            const ownerId=String(member.ownerId||'');
            const memberOwed=owedEntries.filter(entry=>String(entry?.ownerId||'')===ownerId);
            const memberPaid=allEntries.filter(entry=>String(entry?.ownerId||'')===ownerId&&entry?.status==='paid').slice(0,10);

            const details=document.createElement('details');
            details.className='wolf-payment-member';
            details.dataset.paymentMemberOwner=ownerId;
            if(index===0&&memberOwed.length)details.open=true;

            const summary=document.createElement('summary');
            const main=document.createElement('div');
            const name=document.createElement('strong');name.textContent=member.displayName||'Mongrel CMDR';
            const meta=document.createElement('small');
            meta.textContent=fmt(member.owedCredits)+' owed · '+(Number(member.owedEntryCount)||0)+' outstanding · '+fmt(member.paidCredits)+' paid historically';
            main.append(name,meta);
            if(member.payoutRequest?.active){
              const requested=document.createElement('span');
              requested.className='wolf-payment-request-badge';
              requested.textContent='PAYOUT REQUESTED · '+fmt(member.payoutRequest.requestedRemainingCredits||member.payoutRequest.requestedCredits);
              main.append(requested);
            }
            const balance=document.createElement('div');balance.className='wolf-payment-member-balance';
            const amount=document.createElement('b');amount.textContent=fmt(member.owedCredits);
            const label=document.createElement('small');label.textContent='OUTSTANDING';
            balance.append(amount,label);
            summary.append(main,balance);

            const body=document.createElement('div');body.className='wolf-payment-member-body';
            if(member.payoutRequest?.active){
              const request=document.createElement('div');request.className='wolf-payment-request-callout';
              const strong=document.createElement('strong');strong.textContent='PAYOUT REQUESTED';
              const small=document.createElement('small');
              small.textContent=[
                fmt(member.payoutRequest.requestedRemainingCredits||member.payoutRequest.requestedCredits)+' remaining from request',
                member.payoutRequest.requestedAt?'requested '+dateTime(member.payoutRequest.requestedAt):'',
                Number(member.payoutRequest.newSinceRequestCredits)>0?fmt(member.payoutRequest.newSinceRequestCredits)+' earned since request':'',
              ].filter(Boolean).join(' · ');
              request.append(strong,small);body.append(request);
            }
            if(memberOwed.length){
              const toolbar=document.createElement('div');toolbar.className='wolf-payment-toolbar';
              const note=document.createElement('span');
              note.textContent=paymentCanConfirm
                ? 'Select any combination below. Selection is locked to one CMDR at a time.'
                : 'Payment confirmation is restricted to site admins.';
              toolbar.append(note);
              if(paymentCanConfirm){
                const selectAll=document.createElement('button');
                selectAll.type='button';
                selectAll.className='btn btn-secondary btn-compact';
                selectAll.dataset.paymentSelectAll='1';
                selectAll.dataset.paymentOwnerId=ownerId;
                selectAll.dataset.paymentCommander=member.displayName||'Mongrel CMDR';
                selectAll.textContent='SELECT ALL OWED';
                toolbar.append(selectAll);
              }
              body.append(toolbar);

              const owedList=document.createElement('div');owedList.className='wolf-payment-entry-list';
              memberOwed.forEach(entry=>{
                const row=document.createElement('label');row.className='wolf-payment-entry';
                const select=document.createElement('input');
                select.type='checkbox';
                select.className='wolf-payment-check';
                select.dataset.paymentEntryId=entry.id||'';
                select.dataset.paymentOwnerId=ownerId;
                select.dataset.paymentCommander=member.displayName||'Mongrel CMDR';
                select.disabled=!paymentCanConfirm;

                const info=document.createElement('span');info.className='wolf-payment-entry-info';
                const reason=document.createElement('strong');reason.textContent=entry.reason||'Reward payment';
                const detail=document.createElement('small');
                const contribution=Number(entry.verifiedContribution)>0
                  ? Number(entry.verifiedContribution).toLocaleString()+' '+String(entry.verifiedUnit||'')
                  : '';
                detail.textContent=[
                  paymentSourceLabel(entry),
                  contribution,
                  entry.createdAt?'owed '+dateTime(entry.createdAt):'',
                  entry.approvedBy?'approved by '+entry.approvedBy:'',
                ].filter(Boolean).join(' · ');
                info.append(reason,detail);

                const amountBox=document.createElement('span');amountBox.className='wolf-payment-entry-amount';
                amountBox.textContent=fmt(entry.amountCredits);
                row.append(select,info,amountBox);
                owedList.append(row);
              });
              body.append(owedList);
            }else{
              const clear=document.createElement('div');clear.className='wolf-scout-empty';
              const strong=document.createElement('strong');strong.textContent='Nothing currently owed.';
              const small=document.createElement('small');small.textContent='All ledger entries for this CMDR are settled.';
              clear.append(strong,small);body.append(clear);
            }

            if(memberPaid.length){
              const paidTitle=document.createElement('div');paidTitle.className='wolf-payment-history-title';
              paidTitle.textContent='RECENT PAID HISTORY';
              const paidList=document.createElement('div');paidList.className='wolf-payment-paid-list';
              memberPaid.forEach(entry=>{
                const paid=document.createElement('div');paid.className='wolf-payment-paid-entry';
                const info=document.createElement('span');
                const reason=document.createElement('strong');reason.textContent=entry.reason||'Reward payment';
                const detail=document.createElement('small');
                detail.textContent=[
                  paymentSourceLabel(entry),
                  entry.paidAt?'paid '+dateTime(entry.paidAt):'paid',
                  entry.paidBy?'by '+entry.paidBy:'',
                  entry.paymentBatchId?'batch '+short(entry.paymentBatchId):'',
                ].filter(Boolean).join(' · ');
                info.append(reason,detail);
                const amount=document.createElement('b');amount.textContent=fmt(entry.amountCredits);
                paid.append(info,amount);paidList.append(paid);
              });
              body.append(paidTitle,paidList);
            }

            details.append(summary,body);
            details.addEventListener('toggle',()=>{
              if(!details.open)return;
              ledgerList.querySelectorAll('.wolf-payment-member[open]').forEach(other=>{
                if(other!==details)other.open=false;
              });
            });
            ledgerList.append(details);
          });
        }
        updatePaymentSelectionUi();
      }

      ledgerLoaded=true;
      ledgerLoadedAt=Date.now();
      if(checked)checked.textContent='Checked '+new Date(ledgerLoadedAt).toLocaleString()+' · automatic issuance/payment OFF';
    }catch(error){
      console.error('Could not load reward dry run / payout console',error);
      if(dryList)dryList.innerHTML='<div class="wolf-scout-empty"><strong>Reward dry run unavailable.</strong><small>No ledger state was changed.</small></div>';
      if(ledgerList)ledgerList.innerHTML='<div class="wolf-scout-empty"><strong>Reward ledger unavailable.</strong><small>Nothing was changed.</small></div>';
      if(checked)checked.textContent='Refresh failed · no writes performed';
    }finally{
      ledgerLoading=false;
      if(refreshButton)refreshButton.disabled=false;
    }
  }

  function selectAllPayments(button){
    if(!button||button.disabled)return;
    const ownerId=String(button.dataset.paymentOwnerId||'');
    const commander=String(button.dataset.paymentCommander||'Mongrel CMDR');
    if(paymentSelectionOwnerId&&paymentSelectionOwnerId!==ownerId)return;
    paymentSelectionOwnerId=ownerId;
    paymentSelectionCommander=commander;
    paymentSelectedIds=new Set(
      [...paymentEntriesById.values()]
        .filter(entry=>String(entry?.ownerId||'')===ownerId)
        .map(entry=>String(entry?.id||''))
        .filter(Boolean)
    );
    paymentRequestId='';
    updatePaymentSelectionUi();
  }

  async function confirmSelectedPayments(button){
    if(!button||button.disabled||!paymentCanConfirm||!paymentSelectedIds.size)return;
    const entries=[...paymentSelectedIds].map(id=>paymentEntriesById.get(id)).filter(Boolean);
    if(!entries.length)return clearPaymentSelection();
    const ownerIds=new Set(entries.map(entry=>String(entry.ownerId||'')));
    if(ownerIds.size!==1||!paymentSelectionOwnerId||!ownerIds.has(paymentSelectionOwnerId)){
      window.alert('Payment selection is invalid. Clear the selection and try again.');
      return;
    }
    const total=Math.round(entries.reduce((sum,entry)=>sum+(Number(entry.amountCredits)||0),0));
    const confirmed=window.confirm(
      'Confirm payment to '+(paymentSelectionCommander||'this CMDR')+'?\n\n'
      +entries.length+' ledger entr'+(entries.length===1?'y':'ies')+'\n'
      +'TOTAL: '+formatCredits(total)+'\n\n'
      +'Use this only after you have actually transferred these credits in Elite Dangerous. '
      +'All selected ledger entries will be marked PAID.'
    );
    if(!confirmed)return;

    paymentRequestId=paymentRequestId||(
      crypto?.randomUUID?crypto.randomUUID():'payment-'+Date.now()+'-'+Math.random().toString(16).slice(2)
    );
    const bar=document.querySelector('[data-reward-payment-bar]');
    const status=bar?.querySelector('[data-reward-payment-status]');
    button.disabled=true;
    button.textContent='CONFIRMING…';
    if(status)status.textContent='Writing payment batch…';

    try{
      const response=await fetch('/api/rewards/pay',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/json',
          'X-Mongrels-Request':'wolf-reward-payment',
        },
        body:JSON.stringify({
          ownerId:paymentSelectionOwnerId,
          entryIds:[...paymentSelectedIds],
          expectedTotalCredits:total,
          paymentRequestId,
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        const error=new Error(payload.message||payload.error||('Payment confirmation failed ('+response.status+')'));
        error.code=payload.error||'';
        throw error;
      }

      const paidCommander=paymentSelectionCommander;
      const paidCount=entries.length;
      const paidTotal=total;
      clearPaymentSelection();
      ledgerLoaded=false;
      ledgerLoadedAt=0;
      if(status)status.textContent='Payment recorded.';
      await loadLedgerPreview(true);
      window.alert(
        'Payment recorded for '+paidCommander+'.\n\n'
        +paidCount+' ledger entr'+(paidCount===1?'y':'ies')+' marked PAID\n'
        +formatCredits(paidTotal)
      );
    }catch(error){
      console.error('Could not confirm reward payment',error);
      if(['payment_selection_invalid','reward_entry_missing','reward_entry_not_owed','multiple_commanders_not_allowed','payment_selection_changed'].includes(error.code)){
        paymentRequestId='';
      }
      button.disabled=false;
      button.textContent='CONFIRM PAYMENT';
      if(status)status.textContent='Payment not confirmed · '+String(error.message||error);
      window.alert('Payment ledger was not fully confirmed.\n\n'+String(error.message||error));
    }
  }

  async function issueReadyReward(button){
    if(!button||button.disabled)return;
    const obligationId=String(button.dataset.issueReadyReward||'');
    const amountCredits=Math.round(Number(button.dataset.issueAmountCredits)||0);
    const commander=String(button.dataset.issueCommander||'Elite CMDR');
    const task=String(button.dataset.issueTask||'Reward obligation');
    const fmt=value=>Math.round(Number(value)||0).toLocaleString()+' Cr';
    if(!obligationId||amountCredits<=0)return;

    const confirmed=window.confirm(
      'Create an OWED reward-ledger entry for '+commander+'?\n\n'
      +task+'\n'
      +fmt(amountCredits)+'\n\n'
      +'This records an amount owed. It does NOT mark any in-game payment as sent.'
    );
    if(!confirmed)return;

    const original=button.textContent;
    button.disabled=true;
    button.textContent='VALIDATING…';
    const consolePanel=document.querySelector('[data-reward-ledger-admin]');
    const checked=consolePanel?.querySelector('[data-reward-dryrun-checked]');
    if(checked)checked.textContent='Re-validating READY obligation before ledger write…';

    try{
      const response=await fetch('/api/rewards/issue',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/json',
          'X-Mongrels-Request':'wolf-reward-issue',
        },
        body:JSON.stringify({
          obligationId,
          expectedAmountCredits:amountCredits,
          expectedEvidenceDigest:String(button.dataset.issueEvidenceDigest||''),
          expectedRewardRuleDigest:String(button.dataset.issueRewardRuleDigest||''),
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||payload.error||('Issue failed ('+response.status+')'));

      if(payload.entry?.id){
        recentlyIssuedRewardEntries.set(String(payload.entry.id),{entry:payload.entry,issuedAt:Date.now()});
      }
      button.textContent=payload.created?'OWED ENTRY CREATED':'ALREADY LEDGERED';
      ledgerLoaded=false;
      ledgerLoadedAt=0;
      if(checked)checked.textContent=(payload.message||'Reward ledger updated.')+' Refreshing the console with the confirmed write…';
      await loadLedgerPreview(true);
    }catch(error){
      console.error('Could not create reward-ledger entry',error);
      button.disabled=false;
      button.textContent='REFRESH REQUIRED';
      if(checked)checked.textContent='Ledger write rejected · '+String(error.message||error);
      window.alert('Reward ledger was not changed.\n\n'+String(error.message||error));
    }finally{
      if(button.isConnected&&button.textContent==='VALIDATING…'){
        button.disabled=false;
        button.textContent=original;
      }
    }
  }

  const rewardConsole=document.querySelector('[data-reward-ledger-admin]');
  rewardConsole?.addEventListener('click',event=>{
    const issue=event.target.closest('[data-issue-ready-reward]');
    if(issue){issueReadyReward(issue);return;}
    const selectAll=event.target.closest('[data-payment-select-all]');
    if(selectAll){selectAllPayments(selectAll);return;}
    const clear=event.target.closest('[data-payment-clear]');
    if(clear){clearPaymentSelection();return;}
    const confirm=event.target.closest('[data-payment-confirm]');
    if(confirm){confirmSelectedPayments(confirm);return;}
  });
  rewardConsole?.addEventListener('change',event=>{
    const input=event.target.closest('[data-payment-entry-id]');
    if(!input)return;
    const id=String(input.dataset.paymentEntryId||'');
    const ownerId=String(input.dataset.paymentOwnerId||'');
    const commander=String(input.dataset.paymentCommander||'Mongrel CMDR');
    if(input.checked){
      if(paymentSelectionOwnerId&&paymentSelectionOwnerId!==ownerId){
        input.checked=false;
        return;
      }
      paymentSelectionOwnerId=ownerId;
      paymentSelectionCommander=commander;
      paymentSelectedIds.add(id);
    }else{
      paymentSelectedIds.delete(id);
      if(!paymentSelectedIds.size){
        paymentSelectionOwnerId='';
        paymentSelectionCommander='';
      }
    }
    paymentRequestId='';
    updatePaymentSelectionUi();
  });

  async function loadVerificationReview(force=false){
    const review=document.querySelector('[data-verification-review]');
    if(!review||verificationLoading)return;
    const fresh=verificationLoaded && (Date.now()-verificationLoadedAt)<VERIFICATION_FRESH_MS;
    if(!force&&fresh)return;
    verificationLoading=true;
    const list=review.querySelector('[data-verification-list]');
    const flags=review.querySelector('[data-verification-flags]');
    const refreshButton=review.querySelector('[data-refresh-verification]');
    const checked=review.querySelector('[data-verification-checked]');
    if(refreshButton)refreshButton.disabled=true;
    if(checked)checked.textContent='Refreshing…';
    const number=(sel,value)=>{const el=review.querySelector(sel);if(el)el.textContent=Number(value||0).toLocaleString();};
    const round=value=>Math.round((Number(value)||0)*10)/10;
    const signed=value=>{const n=round(value);return (n>0?'+':'')+n.toLocaleString();};

    try{
      const [verificationResponse,reportsResponse]=await Promise.all([
        fetch('/api/rewards/verification?_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
        fetch('/api/operations/order-reports?admin=1&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}),
      ]);
      const verification=await verificationResponse.json().catch(()=>({}));
      const reportsPayload=await reportsResponse.json().catch(()=>({}));
      if(!verificationResponse.ok)throw new Error(verification.error||'Verification review failed');
      if(!reportsResponse.ok)throw new Error(reportsPayload.error||'Manual report review failed');

      const s=verification.summary||{};
      number('[data-verification-members]',s.connectedMembers);
      number('[data-verification-matches]',s.verifiedOrderMatches);
      number('[data-verification-ambiguous]',s.ambiguousComponents);
      number('[data-verification-unmatched]',s.unmatchedComponents);

      const cycle=review.querySelector('[data-verification-cycle]');
      const activeOrders=review.querySelector('[data-verification-active-orders]');
      if(cycle){
        const id=String(verification.cycleId||'No active cycle');
        const started=verification.cycleStartedAt?dateTime(verification.cycleStartedAt):'';
        cycle.textContent=started?`${id} · started ${started}`:id;
        cycle.title=id;
      }
      if(activeOrders)activeOrders.textContent=Number(verification.activeOrderCount||0).toLocaleString();

      const audit={matched:0,mismatch:0,scoutOnly:0,manualOnly:0};
      const reports=Array.isArray(reportsPayload.reports)?reportsPayload.reports:[];
      const manual=new Map();
      for(const report of reports){
        const key=String(report.ownerId||'')+'|'+String(report.orderId||'');
        const bucket=manual.get(key)||{
          ownerId:String(report.ownerId||''),
          orderId:String(report.orderId||''),
          displayName:report.displayName||'Mongrel CMDR',
          system:report.system||'',
          faction:report.faction||'',
          reportType:report.reportType||'',
          score:0,
          reportCount:0,
        };
        bucket.score+=Number(report.score)||0;
        bucket.reportCount+=Math.max(1,Number(report.submissions)||1);
        manual.set(key,bucket);
      }

      const seen=new Set();
      if(list){
        list.replaceChildren();
        const members=Array.isArray(verification.members)?verification.members:[];
        let rows=0;

        for(const member of members){
          for(const item of Array.isArray(member.verifiedOrders)?member.verifiedOrders:[]){
            rows+=1;
            const key=String(member.ownerId||'')+'|'+String(item.orderId||'');
            seen.add(key);
            const reported=manual.get(key);
            const verified=Number(item.contribution)||0;
            const hasManual=Boolean(reported);
            const manualScore=hasManual?(Number(reported.score)||0):null;
            const diff=hasManual?verified-manualScore:null;
            const mismatch=hasManual&&Math.abs(diff)>0.009;
            if(!hasManual)audit.scoutOnly+=1;
            else if(mismatch)audit.mismatch+=1;
            else audit.matched+=1;

            const row=document.createElement('div');
            row.className='wolf-scout-token-row wolf-verification-row '+(hasManual?(mismatch?'is-mismatch':'is-matched'):'is-scout-only');
            const main=document.createElement('div');main.className='wolf-verification-main';
            const strong=document.createElement('strong');
            strong.textContent=(member.commander||reported?.displayName||'Elite CMDR')+' · '+(item.task||'Daily Order');
            const small=document.createElement('small');
            const reward=item.rewardEligible
              ? ` · Reward preview ${round(item.entitlementMillions)}M / ${round(item.capMillions)}M Cr`
              : '';
            small.textContent=[
              `Verified ${round(verified)} ${item.unit||''}`,
              hasManual?`Reported ${round(manualScore)} ${item.unit||''}`:'Reported —',
              hasManual?`Difference ${signed(diff)} ${item.unit||''}`:'',
              item.faction,
              item.system,
            ].filter(Boolean).join(' · ')+reward;
            const badge=document.createElement('span');
            badge.className='wolf-verification-badge '+(hasManual?(mismatch?'is-mismatch':'is-matched'):'is-scout-only');
            badge.textContent=hasManual?(mismatch?'MISMATCH':'MATCHED'):'SCOUT ONLY';
            main.append(strong,small);
            row.append(main,badge);
            list.appendChild(row);
          }
        }

        for(const [key,reported] of manual){
          if(seen.has(key)||!(Number(reported.score)>0))continue;
          rows+=1;
          audit.manualOnly+=1;
          const row=document.createElement('div');row.className='wolf-scout-token-row wolf-verification-row is-manual-only';
          const main=document.createElement('div');main.className='wolf-verification-main';
          const strong=document.createElement('strong');
          strong.textContent=(reported.displayName||'Mongrel CMDR')+' · '+String(reported.reportType||'report').toUpperCase();
          const small=document.createElement('small');
          small.textContent=[
            `Reported ${round(reported.score)} ${reported.reportType==='inf'?'INF':'M Cr'}`,
            'No current Scout match',
            reported.faction,
            reported.system,
          ].filter(Boolean).join(' · ');
          const badge=document.createElement('span');
          badge.className='wolf-verification-badge is-manual-only';
          badge.textContent='MANUAL ONLY';
          main.append(strong,small);row.append(main,badge);list.appendChild(row);
        }

        if(!rows){
          const empty=document.createElement('div');empty.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='No verified/manual comparisons yet.';
          const small=document.createElement('small');small.textContent='Once a connected member has activity against an active order, the dry-run comparison will appear here.';
          empty.append(strong,small);list.appendChild(empty);
        }
      }

      number('[data-verification-audit-matched]',audit.matched);
      number('[data-verification-audit-mismatch]',audit.mismatch);
      number('[data-verification-audit-scout]',audit.scoutOnly);
      number('[data-verification-audit-manual]',audit.manualOnly);

      if(flags){
        flags.replaceChildren();
        const members=Array.isArray(verification.members)?verification.members:[];
        const flagged=members.flatMap(member=>(member.flaggedEvents||[]).map(event=>({member,event})));
        if(flagged.length){
          const head=document.createElement('div');head.className='wolf-scout-empty';
          const strong=document.createElement('strong');strong.textContent='Verification flags';
          const small=document.createElement('small');small.textContent='These require review before automatic reward issuance is enabled.';
          head.append(strong,small);flags.appendChild(head);

          flagged.slice(0,50).forEach(({member,event})=>{
            const row=document.createElement('div');row.className='wolf-scout-token-row';
            const main=document.createElement('div');
            const strong=document.createElement('strong');
            strong.textContent=(member.commander||'Elite CMDR')+' · '+String(event.type||'event').replaceAll('_',' ');
            const small=document.createElement('small');
            const ambiguous=(event.ambiguous||[]).length;
            const unmatched=(event.unmatched||[]).length;
            small.textContent=[
              ambiguous?`${ambiguous} ambiguous`:'',
              unmatched?`${unmatched} unmatched`:'',
              event.system,
              event.station,
              event.timestamp?new Date(event.timestamp).toLocaleString():'',
            ].filter(Boolean).join(' · ');
            main.append(strong,small);row.append(main);flags.appendChild(row);
          });
        }
      }
      verificationLoaded=true;
      verificationLoadedAt=Date.now();
      if(checked)checked.textContent=new Date(verificationLoadedAt).toLocaleString();
    }catch(error){
      console.error('Could not load verification review',error);
      if(list)list.innerHTML='<div class="wolf-scout-empty"><strong>Verification review unavailable.</strong><small>No reward state was changed.</small></div>';
      if(checked)checked.textContent='Refresh failed';
    }finally{
      verificationLoading=false;
      if(refreshButton)refreshButton.disabled=false;
    }
  }

  function loadAfterOpen(details,loader){
    if(!details)return;
    const run=()=>{
      if(!details.open)return;
      // Let the browser paint the expanded panel first; expensive work starts after.
      requestAnimationFrame(()=>requestAnimationFrame(()=>{if(details.open)loader();}));
    };
    details.addEventListener('toggle',run,{passive:true});
    if(details.open)run();
  }

  const verificationPanel=document.querySelector('[data-verification-review]');
  verificationPanel?.querySelector('[data-refresh-verification]')?.addEventListener('click',()=>loadVerificationReview(true));
  const refreshVerificationIfVisible=()=>{
    if(!verificationPanel?.open)return;
    if(Date.now()-verificationLoadedAt<VERIFICATION_FRESH_MS)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(verificationPanel.open)loadVerificationReview(true);}));
  };

  window.addEventListener('focus',refreshVerificationIfVisible,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVerificationIfVisible();},{passive:true});
  window.addEventListener('pageshow',refreshVerificationIfVisible,{passive:true});

  const ledgerPanel=document.querySelector('[data-reward-ledger-admin]');
  const refreshLedgerIfVisible=()=>{
    if(!ledgerPanel?.open)return;
    if(Date.now()-ledgerLoadedAt<LEDGER_FRESH_MS)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(ledgerPanel.open)loadLedgerPreview(true);}));
  };
  window.addEventListener('focus',refreshLedgerIfVisible,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLedgerIfVisible();},{passive:true});
  window.addEventListener('pageshow',refreshLedgerIfVisible,{passive:true});
  ledgerPanel?.querySelector('[data-refresh-reward-dryrun]')?.addEventListener('click',()=>loadLedgerPreview(true));
  window.addEventListener('wolf-bgs-order-history-updated',()=>{ledgerLoadedAt=0;if(ledgerPanel?.open)setTimeout(()=>loadLedgerPreview(true),160);});

  loadAfterOpen(panel,load);
  loadAfterOpen(ledgerPanel,loadLedgerPreview);
  loadAfterOpen(verificationPanel,loadVerificationReview);
})();
