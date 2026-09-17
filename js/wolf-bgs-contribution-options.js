(() => {
  const MONGREL = 'Regiment of Imperial Mongrels';
  const CONFLICT_RE = /\b(civil\s+war|war|election)\b/i;
  const previewObservers = new WeakMap();

  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const num = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function factionRows(card) {
    const strategies = [...card.querySelectorAll('[data-faction-strategy-row]')];
    const sliders = [...card.querySelectorAll('[data-slider-objective-row]')];
    return [...card.querySelectorAll('[data-faction-row]')].map(row => {
      const name = row.querySelector('[data-faction="name"]')?.value?.trim() || '';
      const strategy = strategies.find(item => norm(item.dataset.factionName) === norm(name));
      const slider = sliders.find(item => norm(item.dataset.factionName) === norm(name));
      const mongrel = norm(name) === norm(MONGREL);
      return {
        name,
        influence:num(row.querySelector('[data-faction="influence"]')?.value),
        state:row.querySelector('[data-faction="state"]')?.value?.trim() || '',
        intent:strategy?.querySelector('[data-faction-strategy="intent"]')?.value || 'flexible',
        targetMin:mongrel ? num(card.querySelector('[data-setting="targetMin"]')?.value) : num(strategy?.querySelector('[data-faction-strategy="targetMin"]')?.value),
        targetMax:mongrel ? num(card.querySelector('[data-setting="targetMax"]')?.value) : num(strategy?.querySelector('[data-faction-strategy="targetMax"]')?.value),
        controlObjective:strategy?.querySelector('[data-faction-strategy="controlObjective"]')?.value || 'none',
        economy:slider?.querySelector('[data-slider-objective="economyObjective"]')?.value || 'ignore',
        security:slider?.querySelector('[data-slider-objective="securityObjective"]')?.value || 'ignore',
        mongrel,
      };
    }).filter(row => row.name);
  }

  function systemControlPolicy(card) {
    return card.querySelector('[data-setting="controlPolicy"]')?.value || '';
  }

  function priority(card) {
    return card.querySelector('[data-setting="priority"]')?.value || 'normal';
  }

  function tradeGoal() {
    return Number(document.querySelector('[data-rule="tradeProfitMillionsPerCmdr"]')?.value || 20);
  }

  function bountyGoal() {
    return Number(document.querySelector('[data-rule="bountyMillionsPerCmdr"]')?.value || 20);
  }

  function explorationGoal(card) {
    const p = priority(card);
    const selector = p === 'critical' ? 'explorationEmergencyMillionsPerCmdr' : p === 'high' ? 'explorationStrongMillionsPerCmdr' : 'explorationRoutineMillionsPerCmdr';
    const fallback = p === 'critical' ? 10 : p === 'high' ? 5 : 2;
    return Number(document.querySelector(`[data-economy-rule="${selector}"]`)?.value || fallback);
  }

  function currentController(card, board) {
    const name = card.querySelector('[data-status="controller"]')?.value?.trim() || '';
    return board.find(row => norm(row.name) === norm(name)) || null;
  }

  function pushState(card, row, board) {
    if (!row || row.influence === null || CONFLICT_RE.test(row.state)) return null;
    const below = row.targetMin !== null && row.influence < row.targetMin;
    const support = row.intent === 'support' && (row.targetMax === null || row.influence < row.targetMax);
    if (!below && !support) return null;

    const controller = currentController(card, board);
    const notController = controller && norm(controller.name) !== norm(row.name);
    const factionControl = row.controlObjective === 'prefer-control' && notController;
    const systemControl = row.mongrel && systemControlPolicy(card) === 'gain' && notController;
    const controlPush = Boolean(factionControl || systemControl);
    const gap = controlPush && controller?.influence !== null ? Math.max(0, controller.influence - row.influence) : 0;
    const p = priority(card);
    const strong = controlPush && (gap >= 3 || p === 'high' || p === 'critical');
    const urgent = controlPush && (gap >= 7 || p === 'critical');

    return {below,support,controlPush,strong,urgent,gap,controller};
  }

  function existingTask(host, faction, words) {
    const name = norm(faction);
    return [...host.querySelectorAll('.wolf-order-task')].some(task => {
      const text = norm(task.textContent);
      return text.includes(name) && words.some(word => text.includes(norm(word)));
    });
  }

  function taskMarkup({label,instruction,detail,note='',optional=false,recommended=false}) {
    const status = optional ? ' · OPTIONAL' : recommended ? ' · RECOMMENDED' : '';
    return `<article class="wolf-order-task wolf-contribution-option-task"><div class="wolf-order-task-number">+</div><div><span class="wolf-order-task-type">${esc(label + status)}</span><strong>${esc(instruction)}</strong><p>${esc(detail)}</p>${note ? `<small>${esc(note)}</small>` : ''}</div></article>`;
  }

  function contributionTasks(card, host) {
    const board = factionRows(card), result = [];
    for (const row of board) {
      const push = pushState(card,row,board);
      if (!push) continue;

      const controlText = push.controlPush && push.controller ? ` Control objective: overtake ${push.controller.name}${push.gap ? ` (currently ${push.gap.toFixed(1)} points ahead)` : ''}.` : '';
      const routine = !push.strong;

      if (!existingTask(host,row.name,['trade'])) {
        result.push(taskMarkup({
          label:'INFLUENCE / TRADE',
          instruction:`Generate about ${tradeGoal()}M Cr of profitable trade for ${row.name}`,
          detail:`${routine ? 'Alternate contribution route for a comfortable influence raise.' : 'Use profitable trade as an additional positive-influence bucket during the control push.'}${controlText}`,
          note:`Use a market owned by ${row.name} with useful supply/demand and keep the trade profitable.`,
          optional:routine,
          recommended:!routine,
        }));
      }

      if (!existingTask(host,row.name,['exploration'])) {
        result.push(taskMarkup({
          label:'INFLUENCE / EXPLORATION',
          instruction:`Sell about ${explorationGoal(card)}M Cr of exploration data for ${row.name}`,
          detail:`${routine ? 'Optional alternative for members who prefer exploration.' : push.urgent ? 'Useful additional bucket for an urgent control push.' : 'Alternative contribution bucket for the control push.'}${controlText}`,
          note:`Sell at a ${row.name}-owned asset with Universal Cartographics; do not exceed the configured exploration tier for the cycle.`,
          optional:routine || !push.urgent,
          recommended:push.urgent,
        }));
      }

      result.push(taskMarkup({
        label:'INFLUENCE / MINING MISSIONS',
        instruction:`Use mining or source-and-return missions for ${row.name} toward the mission-INF goal`,
        detail:`Mine requested mission commodities when suitable missions are available and choose the Influence reward. This is an alternate way to satisfy the existing mission-INF target, not extra INF that must be stacked on top.`,
        note:`Direct sale of mined commodities is not counted here as BGS influence/economy work; the mined goods need to be used for faction missions.`,
        optional:true,
      }));

      if ((row.security === 'ignore' || row.security === 'raise') && !existingTask(host,row.name,['bount'])) {
        result.push(taskMarkup({
          label:'INFLUENCE / BOUNTIES',
          instruction:`Optional: turn in about ${bountyGoal()}M Cr of bounty vouchers for ${row.name}`,
          detail:`Another positive contribution route for members who prefer combat${row.security === 'raise' ? '; this also aligns with the configured Security raise objective' : ''}.${controlText}`,
          note:`Skip this option when Security should be held/lowered or when conflict-specific logic applies.`,
          optional:true,
        }));
      }

      if (push.controlPush) {
        result.unshift(`<div class="wolf-rules-callout subtle wolf-contribution-push-banner"><strong>${push.urgent ? 'Urgent control push' : push.strong ? 'Control push' : 'Influence push toward control'} · ${esc(row.name)}</strong><span>Mission INF remains the primary target. ${push.strong ? 'Trade is recommended as a second bucket; other activities give members useful alternatives without forcing one repetitive game loop.' : 'Secondary buckets remain optional so members can contribute through the activity they enjoy.'}</span></div>`);
      }
    }
    return result;
  }

  function process(card) {
    const host = card.querySelector('[data-order-preview-output]');
    if (!host || !host.querySelector('.wolf-order-preview-head')) return;
    const entry = previewObservers.get(card);
    if (entry?.observer) entry.observer.disconnect();
    try {
      host.querySelectorAll('.wolf-contribution-option-task,.wolf-contribution-push-banner').forEach(el => el.remove());
      const additions = contributionTasks(card,host);
      if (!additions.length) return;
      const list = host.querySelector('.wolf-order-task-list');
      if (!list) return;
      list.insertAdjacentHTML('beforeend', additions.join(''));
      const small=host.querySelector('.wolf-order-preview-head small');
      if(small){
        const count=host.querySelectorAll('.wolf-order-task').length;
        small.textContent=small.textContent.replace(/^\d+ generated tasks?/,`${count} generated task${count===1?'':'s'}`);
      }
    } finally {
      if (entry?.observer) entry.observer.observe(host,{childList:true,subtree:true});
    }
  }

  function watchPreview(card) {
    const host = card.querySelector('[data-order-preview-output]');
    if (!host) return;
    const existing = previewObservers.get(card);
    if (existing?.host === host) { process(card); return; }
    if (existing?.observer) existing.observer.disconnect();
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;queued=true;
      setTimeout(()=>{queued=false;process(card);},0);
    });
    observer.observe(host,{childList:true,subtree:true});
    previewObservers.set(card,{host,observer});
    process(card);
  }

  function enhanceAll() {
    document.querySelectorAll('.wolf-system-card').forEach(watchPreview);
  }

  function init() {
    enhanceAll();
    const list=document.querySelector('[data-system-list]');
    if(list)new MutationObserver(()=>setTimeout(enhanceAll,20)).observe(list,{childList:true,subtree:true});
    document.addEventListener('change',event=>{
      if(event.target.closest('.wolf-system-card'))setTimeout(()=>{
        const card=event.target.closest('.wolf-system-card');
        if(card)process(card);
      },20);
    });
    for(const name of ['wolf-bgs-faction-strategy-updated','wolf-bgs-slider-objectives-updated','wolf-bgs-rules-updated'])window.addEventListener(name,()=>setTimeout(enhanceAll,30));
    setTimeout(enhanceAll,250);
    setTimeout(enhanceAll,700);
  }

  init();
})();