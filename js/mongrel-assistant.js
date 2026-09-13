(() => {
  const state = { session:null, history:[], busy:false, usage:null };
  const root = document.createElement('div');
  root.className = 'mongrel-assistant';
  root.innerHTML = `
    <button class="mongrel-assistant-launcher" type="button" aria-expanded="false" aria-controls="mongrel-assistant-panel">
      <span class="mongrel-assistant-launcher-mark" aria-hidden="true">◆</span><span>Ask the Mongrels</span>
    </button>
    <section class="mongrel-assistant-panel" id="mongrel-assistant-panel" hidden aria-label="Mongrel Assistant">
      <header class="mongrel-assistant-head">
        <div><small>MONGREL NETWORK</small><strong>Mongrel Assistant</strong><span data-assistant-access>Checking member access…</span></div>
        <button type="button" class="mongrel-assistant-close" aria-label="Close assistant">×</button>
      </header>
      <div class="mongrel-assistant-log" data-assistant-log aria-live="polite"></div>
      <div class="mongrel-assistant-links" data-assistant-links hidden></div>
      <form class="mongrel-assistant-form" data-assistant-form>
        <label for="mongrel-assistant-input">Ask about the squad, today's orders, projects, carriers, trades, PvP, ships, or rules.</label>
        <textarea id="mongrel-assistant-input" rows="2" maxlength="1600" placeholder="What should I be working on today?" data-assistant-input></textarea>
        <div class="mongrel-assistant-budget" data-assistant-budget>Monthly AI allowance: checking…</div>
        <div class="mongrel-assistant-form-row"><small data-assistant-status>Read-only assistant</small><button class="btn btn-primary" type="submit" data-assistant-send>Send</button></div>
      </form>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector('.mongrel-assistant-launcher');
  const panel = root.querySelector('.mongrel-assistant-panel');
  const close = root.querySelector('.mongrel-assistant-close');
  const log = root.querySelector('[data-assistant-log]');
  const links = root.querySelector('[data-assistant-links]');
  const form = root.querySelector('[data-assistant-form]');
  const input = root.querySelector('[data-assistant-input]');
  const send = root.querySelector('[data-assistant-send]');
  const status = root.querySelector('[data-assistant-status]');
  const access = root.querySelector('[data-assistant-access]');
  const budget = root.querySelector('[data-assistant-budget]');

  const open = () => { panel.hidden=false; launcher.setAttribute('aria-expanded','true'); input?.focus(); };
  const shut = () => { panel.hidden=true; launcher.setAttribute('aria-expanded','false'); };
  launcher.addEventListener('click', () => panel.hidden ? open() : shut());
  close.addEventListener('click', shut);

  const addMessage = (role, text) => {
    const item=document.createElement('div'); item.className=`mongrel-assistant-message is-${role}`;
    const who=document.createElement('span'); who.textContent=role==='assistant'?'Mongrel Assistant':'You';
    const body=document.createElement('div'); body.textContent=text;
    item.append(who,body); log.appendChild(item); log.scrollTop=log.scrollHeight;
    return item;
  };

  const showWelcome = () => {
    log.replaceChildren();
    if (state.session?.authenticated) {
      addMessage('assistant', `Ready, ${state.session.displayName || 'Mongrel'}. I can read current squad data and help you find what you need. I cannot change anything on the site.`);
    } else {
      addMessage('assistant', 'Sign in with Discord to use the Mongrel Assistant. Member authentication keeps private squad data protected and prevents anonymous API usage.');
      const a=document.createElement('a'); a.className='btn btn-primary mongrel-assistant-login'; a.href=`/api/auth/login?return=${encodeURIComponent(location.pathname+location.search+location.hash)}`; a.textContent='Sign in with Discord'; log.appendChild(a);
    }
  };

  const money = value => `$${Number(value || 0).toFixed(Number(value || 0) < 0.01 ? 4 : 2)}`;
  const renderUsage = usage => {
    state.usage=usage || null;
    if(!usage?.user){ budget.textContent=state.session?.authenticated?'Monthly AI allowance: unavailable':'Sign in to view allowance'; budget.className='mongrel-assistant-budget'; return; }
    const u=usage.user;
    budget.textContent=`Monthly AI allowance: ${money(u.spentUsd)} of ${money(u.limitUsd)} used · ${u.requests || 0} requests`;
    budget.className='mongrel-assistant-budget' + (u.exhausted?' is-exhausted':u.warning?' is-warning':'');
    if(u.exhausted){ input.disabled=true; send.disabled=true; status.textContent='Monthly AI allowance reached'; }
  };

  const loadUsage = async () => {
    if(!state.session?.authenticated){renderUsage(null);return;}
    try{
      const response=await fetch(`/api/assistant?_=${Date.now()}`,{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(response.ok&&payload.ok) renderUsage(payload.usage); else renderUsage(null);
    }catch{renderUsage(null);}
  };

  const loadSession = async () => {
    try {
      const response=await fetch(`/api/auth/session?_=${Date.now()}`,{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
      state.session=response.ok?await response.json():null;
    } catch { state.session=null; }
    const authenticated=Boolean(state.session?.authenticated);
    access.textContent=authenticated?`${state.session.displayName} · ${state.session.accessLabel}`:'Members only';
    input.disabled=!authenticated; send.disabled=!authenticated;
    status.textContent=authenticated?'Read-only · current squad data':'Discord sign-in required';
    showWelcome();
    await loadUsage();
  };

  const renderLinks = items => {
    links.replaceChildren();
    const safe=Array.isArray(items)?items:[];
    if(!safe.length){links.hidden=true;return;}
    const label=document.createElement('span');label.textContent='Related';links.appendChild(label);
    safe.slice(0,4).forEach(item=>{const a=document.createElement('a');a.href=item.href;a.textContent=item.label;links.appendChild(a);});
    links.hidden=false;
  };

  const errorMessage = code => ({
    assistant_not_configured:'The assistant backend is online, but its OpenAI API key has not been configured yet.',
    assistant_usage_storage_not_configured:'AI usage tracking is not configured yet. The assistant is staying offline so spending limits cannot be bypassed.',
    assistant_pricing_not_configured:'The selected AI model does not have pricing configured for budget tracking.',
    authentication_required:'Your member session expired. Sign in again and retry.',
    member_access_required:'Your Discord account does not currently have Mongrel member access.',
    assistant_user_budget_exhausted:'You have reached your monthly Mongrel Assistant allowance. It resets next month.',
    assistant_site_budget_exhausted:'The squad-wide $30 monthly AI ceiling has been reached. The assistant will reopen next month unless Wolf adjusts the limit.',
    assistant_hourly_limit:'You have reached the hourly assistant request limit. Try again later.',
    assistant_busy:'The assistant is temporarily rate-limited. Try again in a moment.',
    assistant_unavailable:'The AI service is temporarily unavailable. The rest of the site is unaffected.',
  }[code] || 'I could not complete that request. Please try again.');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message=(input.value||'').trim();
    if(!message||state.busy||!state.session?.authenticated||state.usage?.user?.exhausted)return;
    state.busy=true; send.disabled=true; input.disabled=true; status.textContent='Thinking…';
    addMessage('user',message); input.value=''; renderLinks([]);
    const pending=addMessage('assistant','Checking current squad data…');
    try {
      const response=await fetch('/api/assistant',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json','X-Mongrels-Request':'mongrel-assistant'},body:JSON.stringify({message,history:state.history.slice(-6)})});
      const payload=await response.json().catch(()=>({}));
      if(payload.usage) renderUsage(payload.usage);
      if(!response.ok||!payload.ok){pending.querySelector('div').textContent=errorMessage(payload.error);return;}
      pending.querySelector('div').textContent=payload.answer;
      state.history.push({role:'user',text:message},{role:'assistant',text:payload.answer});
      state.history=state.history.slice(-8);
      renderLinks(payload.links);
    } catch { pending.querySelector('div').textContent=errorMessage('assistant_unavailable'); }
    finally {
      state.busy=false;
      const exhausted=Boolean(state.usage?.user?.exhausted);
      send.disabled=exhausted; input.disabled=exhausted;
      status.textContent=exhausted?'Monthly AI allowance reached':'Read-only · current squad data';
      if(!exhausted) input.focus();
    }
  });

  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
  loadSession();
})();
