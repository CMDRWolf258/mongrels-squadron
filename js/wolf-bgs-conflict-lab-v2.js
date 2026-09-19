(() => {
  const KEY='wolf-bgs-lab-conflict-v3';
  const q=()=>document.querySelector('[data-bgs-lab="true"]');
  const LEVELS=['routine','contested','heavy'];
  const D={
    objective:'tie',
    source:'fresh',
    throughDay:0,
    observeFrom:0,
    staleAtDay:null,
    blitz:false,
    days:Array.from({length:7},()=>({winner:''})),
    manualHistory:[],
    manualDraftA:0,
    manualDraftB:0,
    cz:{routine:3,contested:6,heavy:15,blitz:25,low:1,medium:1.3,high:1.6},
    election:{routine:6,contested:15,heavy:40,blitz:60},
  };

  const clone=v=>JSON.parse(JSON.stringify(v));
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
  let s={...clone(D),...saved,cz:{...D.cz,...(saved.cz||{})},election:{...D.election,...(saved.election||{})}};
  if(!Array.isArray(s.days)||s.days.length!==7||s.days.some(x=>!x||!('winner' in x)))s.days=clone(D.days);
  if(!Array.isArray(s.manualHistory))s.manualHistory=[];
  s.throughDay=clamp(s.throughDay,0,7);
  s.observeFrom=clamp(s.observeFrom,0,s.throughDay);
  s.source=['fresh','stale','missing'].includes(s.source)?s.source:'fresh';
  s.objective=['tie','win-a','win-b','monitor'].includes(s.objective)?s.objective:'tie';

  const save=()=>localStorage.setItem(KEY,JSON.stringify(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>ch==='&'?'&amp;':ch==='<'?'&lt;':ch==='>'?'&gt;':ch==='"'?'&quot;':'&#39;');
  const cap=v=>String(v||'').charAt(0).toUpperCase()+String(v||'').slice(1);
  function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}
  function lower(level){const i=LEVELS.indexOf(level);return LEVELS[Math.max(0,i-1)]||'routine'}
  function raise(level){const i=LEVELS.indexOf(level);return LEVELS[Math.min(LEVELS.length-1,i+1)]||'heavy'}

  function pair(){
    const c=q();
    const r=[...(c?.querySelectorAll('[data-conflict-pair-row]')||[])].find(x=>x.querySelector('[data-conflict="factionA"]')?.value&&x.querySelector('[data-conflict="factionB"]')?.value);
    if(!r)return null;
    const t=(r.querySelector('[data-conflict-type]')?.textContent||'').toLowerCase();
    return{
      a:r.querySelector('[data-conflict="factionA"]').value,
      b:r.querySelector('[data-conflict="factionB"]').value,
      type:t.includes('election')?'election':t.includes('civil')?'civil-war':'war',
      row:r,
    };
  }

  function scoreThrough(n){
    let a=0,b=0;
    for(let i=0;i<clamp(n,0,7);i++){
      if(s.days[i]?.winner==='a')a++;
      else if(s.days[i]?.winner==='b')b++;
    }
    return{a,b};
  }

  function resolvedState(score,completed){
    const rem=Math.max(0,7-completed);
    if(score.a>=4||score.b>=4){
      const side=score.a>score.b?'a':'b';
      return{resolved:true,side,reason:'four daily wins secured the conflict'};
    }
    if(completed>=4&&Math.abs(score.a-score.b)>rem){
      const side=score.a>score.b?'a':'b';
      return{resolved:true,side,reason:'the trailing side no longer has enough days remaining to force a draw'};
    }
    if(completed>=7){
      return{resolved:true,side:score.a===score.b?'tie':(score.a>score.b?'a':'b'),reason:score.a===score.b?'the seven-day window ended tied':'the seven-day window is complete'};
    }
    return{resolved:false,side:'',reason:''};
  }

  function initialWinPressure(score,desired){
    const opponent=desired==='a'?'b':'a';
    if(score.a===0&&score.b===0)return'routine';
    if(score[desired]>score[opponent])return'routine';
    return'contested';
  }

  function winPressureFromDays(desired,start,end){
    const opponent=desired==='a'?'b':'a';
    const baseline=scoreThrough(start);
    let level=initialWinPressure(baseline,desired),quiet=0,heavyLock=false;
    let reason=baseline.a===0&&baseline.b===0?'Opening 0–0 baseline starts Routine.'
      :baseline[desired]>baseline[opponent]?'First observed score already has the intended winner ahead, so automation starts Routine.'
      :'First observed score does not start Heavy; automation begins Contested and reacts only to opposition observed from here.';
    for(let i=start;i<end;i++){
      const winner=s.days[i]?.winner||'';
      const after=scoreThrough(i+1);
      if(winner===opponent){
        quiet=0;
        level=raise(level);
        reason='Opponent won an observed conflict day, so pressure increased one level.';
        if(after[opponent]>=3){
          level='heavy';
          heavyLock=true;
          reason='Opponent reached 3 wins during observation; Heavy is locked for the remainder of the conflict.';
        }
      }else{
        quiet++;
        if(!heavyLock&&quiet>=2){
          level=lower(level);
          quiet=0;
          reason='Opponent went two observed conflict days without a win, so pressure dropped one level.';
        }
      }
    }
    return{level,quiet,heavyLock,reason,baseline};
  }

  function tiePressureFromDays(start,end){
    const baseline=scoreThrough(start);
    let leader=baseline.a===baseline.b?'':(baseline.a>baseline.b?'a':'b');
    let level='contested',quiet=0,heavyLock=false;
    let reason=leader?'First observed unequal score starts Tie recovery at Contested.':'Score is tied; no corrective conflict work is required.';
    for(let i=start;i<end;i++){
      const winner=s.days[i]?.winner||'';
      const after=scoreThrough(i+1);
      const newLeader=after.a===after.b?'':(after.a>after.b?'a':'b');
      if(!newLeader){
        leader='';
        level='contested';
        quiet=0;
        heavyLock=false;
        reason='An equal score was observed, so Tie work stops.';
        continue;
      }
      if(!leader||newLeader!==leader){
        leader=newLeader;
        level='contested';
        quiet=0;
        heavyLock=false;
        reason='The tie broke; support the new trailing faction immediately at Contested pressure.';
        if(winner===leader&&after[leader]>=3){
          level='heavy';
          heavyLock=true;
          reason='The current leader reached 3 wins while observed; Tie recovery is locked Heavy.';
        }
        continue;
      }
      if(winner===leader){
        quiet=0;
        level=raise(level);
        reason='The leading faction won another observed day, so Tie recovery pressure increased.';
        if(after[leader]>=3){
          level='heavy';
          heavyLock=true;
          reason='The current leader reached 3 wins while observed; Tie recovery is locked Heavy.';
        }
      }else{
        quiet++;
        if(!heavyLock&&quiet>=2){
          level=lower(level);
          quiet=0;
          reason='The leading faction went two observed days without a win, so Tie recovery pressure dropped one level.';
        }
      }
    }
    return{level,quiet,heavyLock,leader,reason,baseline};
  }

  function pressureFromManualHistory(objective){
    const history=s.manualHistory;
    if(!history.length)return null;
    const first=history[0];
    if(objective==='monitor')return{level:'routine',quiet:0,heavyLock:false,reason:'Monitor does not generate winner-specific pressure.'};

    if(objective==='tie'){
      let leader=first.a===first.b?'':(first.a>first.b?'a':'b');
      let level='contested',quiet=0,heavyLock=false;
      let reason=leader?'First manual unequal score starts Tie recovery at Contested.':'Manual score is tied; no corrective work is required.';
      for(let i=1;i<history.length;i++){
        const before=history[i-1],after=history[i];
        const newLeader=after.a===after.b?'':(after.a>after.b?'a':'b');
        if(!newLeader){leader='';level='contested';quiet=0;heavyLock=false;reason='Manual score returned to a tie; corrective work stops.';continue;}
        if(!leader||newLeader!==leader){leader=newLeader;level='contested';quiet=0;heavyLock=false;reason='Manual score shows a new leader; Tie recovery restarts Contested.';continue;}
        const leaderGain=after[leader]>before[leader];
        if(leaderGain){
          quiet=0;level=raise(level);reason='Manual score confirms another win for the leader; pressure increased.';
          if(after[leader]>=3){level='heavy';heavyLock=true;reason='Manual score confirms the leader reached 3 while observed; Heavy is locked.';}
        }else if(after.a!==before.a||after.b!==before.b){
          quiet++;
          if(!heavyLock&&quiet>=2){level=lower(level);quiet=0;reason='Two observed manual score changes without a leader win lowered pressure one level.';}
        }
      }
      return{level,quiet,heavyLock,leader,reason};
    }

    const desired=objective==='win-a'?'a':'b',opponent=desired==='a'?'b':'a';
    let level=initialWinPressure(first,desired),quiet=0,heavyLock=false;
    let reason=first.a===0&&first.b===0?'Opening manual 0–0 starts Routine.'
      :first[desired]>first[opponent]?'First manual score has the intended winner ahead, so automation starts Routine.'
      :'First manual score starts Contested; prior opposition is not reconstructed.';
    for(let i=1;i<history.length;i++){
      const before=history[i-1],after=history[i];
      if(after[opponent]>before[opponent]){
        quiet=0;level=raise(level);reason='Manual score confirms an opponent win; pressure increased one level.';
        if(after[opponent]>=3){level='heavy';heavyLock=true;reason='Manual score confirms the opponent reached 3 while observed; Heavy is locked.';}
      }else if(after.a!==before.a||after.b!==before.b){
        quiet++;
        if(!heavyLock&&quiet>=2){level=lower(level);quiet=0;reason='Two observed manual score changes without an opponent win lowered pressure one level.';}
      }
    }
    return{level,quiet,heavyLock,reason};
  }

  function context(){
    if(s.source==='missing'){
      const latest=s.manualHistory[s.manualHistory.length-1];
      if(!latest)return{source:'missing',score:null,completed:null,pressure:null,stale:false,manual:true};
      const p=pressureFromManualHistory(s.objective);
      return{source:'manual',score:{a:latest.a,b:latest.b},completed:null,pressure:p,stale:false,manual:true};
    }
    const completed=s.source==='stale'
      ?clamp(s.staleAtDay===null?s.throughDay:s.staleAtDay,0,s.throughDay)
      :s.throughDay;
    const score=scoreThrough(completed);
    const start=clamp(s.observeFrom,0,completed);
    const p=s.objective==='tie'?tiePressureFromDays(start,completed)
      :s.objective==='win-a'?winPressureFromDays('a',start,completed)
      :s.objective==='win-b'?winPressureFromDays('b',start,completed)
      :{level:'routine',quiet:0,heavyLock:false,reason:'Monitor does not generate winner-specific pressure.'};
    return{source:s.source,score,completed,pressure:p,stale:s.source==='stale',manual:false};
  }

  function recommendation(){
    const p=pair();
    if(!p)return{title:'Configure a conflict pair',detail:'Use Mandalore Conflict Configuration first.',state:'needs-config'};
    const C=context();
    if(!C.score)return{title:'SCORE REQUIRED',detail:'No automatic conflict score is available. Enter a manual score below before automation can recommend work.',state:'needs-score',p,C};

    const completed=C.completed===null?s.throughDay:C.completed;
    const end=resolvedState(C.score,completed);
    if(end.resolved){
      const winner=end.side==='a'?p.a:end.side==='b'?p.b:'Draw';
      return{title:'RESOLVED — STOP CONFLICT WORK',detail:(winner==='Draw'?'Conflict ended tied.':winner+' has secured the conflict.')+' '+end.reason+'.',state:'resolved',p,C,end};
    }

    if(s.objective==='monitor')return{title:'HOLD / AVOID CONFLICT WORK',detail:'Monitor objective: no winner-specific conflict work.',state:'hold',p,C};
    if(s.objective==='tie'&&C.score.a===C.score.b){
      return{title:'TIED — HOLD',detail:p.a+' '+C.score.a+'–'+C.score.b+' '+p.b+'. The objective is already satisfied. Issue no conflict order unless the tie breaks.',state:'hold',p,C};
    }

    let desired,why;
    if(s.objective==='tie'){
      desired=C.score.a<C.score.b?'a':'b';
      why='Tie objective: immediately support the trailing faction until an equal score is observed.';
    }else{
      desired=s.objective==='win-a'?'a':'b';
      why='Configured outcome is a win for '+(desired==='a'?p.a:p.b)+'.';
    }

    const winner=desired==='a'?p.a:p.b;
    let pr=C.pressure?.level||'contested';
    const blitzAllowed=s.objective==='win-a'||s.objective==='win-b';
    if(blitzAllowed&&s.blitz)pr='blitz';
    const amount=p.type==='election'?s.election[pr]:s.cz[pr];
    const type=p.type==='election'?'INF':'CZ points';
    const prefix=pr==='blitz'?'BLITZ — ':pr==='heavy'?'ALERT — ':'';
    return{
      title:prefix+'WIN TODAY FOR '+winner,
      detail:(C.completed===null?'Manual score':'Start of Day '+(completed+1))+' · '+p.a+' '+C.score.a+'–'+C.score.b+' '+p.b+'. '+why,
      state:C.stale?'stale':'work',
      winner,desired,pr,amount,type,p,C,
    };
  }

  function sourceLabel(C){
    if(C.source==='fresh')return['AUTHORITATIVE SCORE','Fresh simulated source'];
    if(C.source==='stale')return['SCORE STALE','Automation frozen at the last fresh observation'];
    if(C.source==='manual')return['MANUAL VERIFIED','Using Wolf-entered score history'];
    return['SCORE REQUIRED','No automatic score available'];
  }

  function pressureLabel(R){
    if(R.state==='resolved')return['STOP','Conflict resolved'];
    if(R.state==='hold')return['HOLD','No conflict work'];
    if(!R.C?.pressure)return['—','Awaiting score'];
    if(R.pr==='blitz')return['BLITZ','Manual override'];
    return[(R.pr||R.C.pressure.level||'contested').toUpperCase(),R.C.pressure.heavyLock?'AUTO · HEAVY LOCK':'AUTO'];
  }

  function dayOptions(value){
    return Array.from({length:8},(_,i)=>'<option value="'+i+'" '+(i===value?'selected':'')+'>'+(i<7?'Start of Day '+(i+1):'After Day 7')+'</option>').join('');
  }

  function dayGrid(){
    return s.days.map((x,i)=>{
      const sc=scoreThrough(i+1),future=i>=s.throughDay;
      return '<div class="wolf-conflict-day-row '+(future?'is-future':'')+'">'+
        '<div class="wolf-day-head"><b>Day '+(i+1)+'</b><span>'+sc.a+'–'+sc.b+'</span></div>'+
        '<div class="wolf-day-winners">'+
          '<button type="button" data-v2-winner="'+i+'" data-side="a" class="'+(x.winner==='a'?'is-winner':'')+'">Faction A</button>'+
          '<button type="button" data-v2-winner="'+i+'" data-side="b" class="'+(x.winner==='b'?'is-winner':'')+'">Faction B</button>'+
        '</div>'+
        '<small>'+(x.winner==='a'?'A won the day':x.winner==='b'?'B won the day':'No winner / tied day')+'</small>'+
      '</div>';
    }).join('');
  }

  function workMarkup(R){
    if(!R.amount)return'';
    if(R.type==='CZ points')return '<strong>Squad target: '+R.amount+' CZ points</strong><small>Low = '+s.cz.low+' · Medium = '+s.cz.medium+' · High = '+s.cz.high+'. Any combination. Redeem Combat Bonds.</small>';
    return '<strong>Squad target: '+R.amount+' mission INF</strong><small>Use +2 / +3 / +4 / +5 Influence rewards; prioritize quick Election-compatible missions where practical.</small>';
  }

  function manualScoreMarkup(pairInfo){
    const latest=s.manualHistory[s.manualHistory.length-1];
    return '<details class="wolf-score-controls" '+(s.source==='missing'?'open':'')+'>'+
      '<summary><span><b>Score controls</b><small>'+(s.source==='missing'?'Automatic score unavailable — manual entry required':'Manual fallback for non-Mongrel or unavailable score feeds')+'</small></span><strong>+</strong></summary>'+
      '<div class="wolf-score-controls-body">'+
        '<p>Each saved manual update is treated as one newly observed score. Automation never reconstructs opposition that happened before the first score you enter.</p>'+
        '<div class="wolf-manual-score">'+
          '<label><span>'+esc(pairInfo?.a||'Faction A')+' wins</span><input type="number" min="0" max="4" step="1" data-manual-score="a" value="'+esc(s.manualDraftA)+'"></label>'+
          '<span class="wolf-score-dash">–</span>'+
          '<label><span>'+esc(pairInfo?.b||'Faction B')+' wins</span><input type="number" min="0" max="4" step="1" data-manual-score="b" value="'+esc(s.manualDraftB)+'"></label>'+
          '<button type="button" class="btn btn-primary btn-compact" data-save-manual-score>SAVE SCORE</button>'+
        '</div>'+
        '<small>'+(latest?'Last manual observation: '+latest.a+'–'+latest.b+' · '+s.manualHistory.length+' observation'+(s.manualHistory.length===1?'':'s'):'No manual score saved yet.')+'</small>'+
      '</div>'+
    '</details>';
  }

  function reportPrototype(R){
    return '<details class="wolf-conflict-report-mock"><summary><span><b>Member reporting prototype</b><small>Preview only; nothing is submitted.</small></span><strong>+</strong></summary>'+
      '<div class="wolf-report-prototype-body">'+
        '<div class="wolf-report-title"><div><b>Order contribution</b><small>'+(R.amount?'Current squad target: '+R.amount+' '+R.type:'No active conflict target.')+'</small></div><div class="wolf-report-mode"><button type="button" class="is-active">Solo</button><button type="button">Wing</button></div></div>'+
        '<div class="wolf-report-grid"><section><h5>CZ victories</h5>'+counter('low','Low')+counter('medium','Medium')+counter('high','High')+'</section><section><h5>Failures to report</h5>'+counter('loss','CZ lost / abandoned')+counter('disconnect','Full-instance disconnect')+'<small class="wolf-report-rule">Wing rule: if at least one Mongrel remains in the shared CZ and wins it, report the CZ as a win. A member dropping out alone is not a loss.</small></section></div>'+
        '<button type="button" class="wolf-bonds-button" data-mock-bonds aria-pressed="false">COMBAT BONDS NOT REDEEMED</button>'+
        '<div class="wolf-inf-report"><span>Mission INF tally</span>'+counter('inf2','+2')+counter('inf3','+3')+counter('inf4','+4')+counter('inf5','+5')+'<small>Tap the reward received once while turning in; use − to correct a mistake before Submit.</small></div>'+
        '<p class="wolf-wing-note"><b>Wing reporting:</b> one shared CZ instance is one CZ result, regardless of how many Mongrels participated. One wing member reports it; participant names can be optional metadata later.</p>'+
      '</div></details>';
  }

  function counter(name,label){
    return '<div class="wolf-report-counter"><span>'+label+'</span><div><button type="button" data-mock-counter="'+name+'" data-delta="-1">−</button><b data-mock-value="'+name+'">0</b><button type="button" data-mock-counter="'+name+'" data-delta="1">+</button></div></div>';
  }

  function render(){
    const c=q(),sec=c?.querySelector('[data-conflict-section]');
    if(!sec)return;
    let h=c.querySelector('[data-conflict-lab-v2]');
    if(!h){h=document.createElement('section');h.className='wolf-conflict-lab-v2';h.dataset.conflictLabV2='true';sec.append(h)}
    const R=recommendation(),p=pair(),C=R.C||context(),src=sourceLabel(C),pressure=pressureLabel(R);
    const score=C.score?C.score.a+'–'+C.score.b:'—';
    const objectiveLabel=s.objective==='tie'?'TIE':s.objective==='win-a'?'WIN A':s.objective==='win-b'?'WIN B':'MONITOR';
    const blitzAllowed=(s.objective==='win-a'||s.objective==='win-b')&&R.state!=='resolved';
    const staleNote=C.stale?'<div class="wolf-conflict-freeze"><b>SCORE STALE — AUTOMATION FROZEN</b><span>Pressure and quiet-day counters are frozen at the last fresh score. Stale time never counts as an opponent-winless day and cannot create a new automatic order.</span></div>':'';
    const pressureMeta=C.pressure?'<small>'+esc(C.pressure.reason||'')+(C.pressure.quiet?' · Opponent quiet streak: '+C.pressure.quiet:'')+'</small>':'';
    const stateClass=R.pr==='blitz'?'is-blitz':R.pr==='heavy'?'is-alert':R.state==='hold'?'is-hold':R.state==='stale'?'is-stale':'';

    h.innerHTML=
      '<div class="wolf-conflict-lab-head"><div><span>Conflict Operations Prototype</span><h4>Live-order behavior test</h4></div><small>Mandalore only · never published</small></div>'+
      '<div class="wolf-conflict-command-strip">'+
        '<div class="wolf-command-score"><span>'+esc(p?.type==='election'?'ELECTION':p?.type==='civil-war'?'CIVIL WAR':'WAR')+'</span><strong>'+esc(p?.a||'Faction A')+' <b>'+score+'</b> '+esc(p?.b||'Faction B')+'</strong><small>'+esc(src[0])+' · '+esc(src[1])+'</small></div>'+
        '<label class="wolf-command-objective"><span>Objective</span><select data-v2="objective"><option value="tie">Tie</option><option value="win-a">Win for A</option><option value="win-b">Win for B</option><option value="monitor">Monitor</option></select></label>'+
        '<div class="wolf-command-pressure"><span>Pressure</span><strong>'+esc(pressure[0])+'</strong><small>'+esc(pressure[1])+'</small></div>'+
        '<button type="button" class="wolf-blitz-button '+(s.blitz?'is-active':'')+'" data-blitz-override '+(blitzAllowed?'':'disabled')+'>'+(s.blitz?'BLITZ ACTIVE':'BLITZ OVERRIDE')+'</button>'+
      '</div>'+
      staleNote+
      '<div class="wolf-conflict-v2-rec '+stateClass+'"><div class="wolf-rec-kicker"><span>AUTOMATION RECOMMENDATION</span><b>'+objectiveLabel+'</b></div><h4>'+esc(R.title)+'</h4><p>'+esc(R.detail)+'</p>'+workMarkup(R)+pressureMeta+'</div>'+
      '<div class="wolf-conflict-doctrine"><div><b>War / Civil War</b><span>Routine 3 · Contested 6 · Heavy 15 · Blitz 25 CZ pts</span></div><div><b>Election</b><span>Routine 6 · Contested 15 · Heavy 40 · Blitz 60 INF</span></div><div><b>Tie</b><span>Equal score = HOLD. If the tie breaks, immediately support the trailing faction until equality is observed again. No Blitz.</span></div></div>'+
      '<details class="wolf-conflict-sandbox-controls" open><summary><span><b>Sandbox controls</b><small>Simulate score history, late discovery, stale data, and manual fallback</small></span><strong>+</strong></summary>'+
        '<div class="wolf-conflict-v2-settings">'+
          '<label><span>Score source</span><select data-v2="source"><option value="fresh">Fresh authoritative</option><option value="stale">Stale authoritative</option><option value="missing">No automatic score</option></select></label>'+
          '<label><span>Current conflict day</span><select data-v2="throughDay">'+dayOptions(s.throughDay)+'</select></label>'+
          '<label><span>First observed score</span><select data-v2="observeFrom">'+dayOptions(s.observeFrom)+'</select></label>'+
        '</div>'+
        '<div class="wolf-sandbox-help"><span><b>First observed score</b> is the moment automation began watching. A conflict first discovered at 0–3 starts Contested; prior opposition is never invented.</span><button type="button" class="btn btn-secondary btn-compact" data-reset-operational-history>RESET CONFLICT TEST</button></div>'+
        '<div class="wolf-conflict-day-grid">'+dayGrid()+'</div>'+
      '</details>'+
      manualScoreMarkup(p)+reportPrototype(R);

    h.querySelector('[data-v2="objective"]').value=s.objective;
    h.querySelector('[data-v2="source"]').value=s.source;
    h.querySelector('[data-v2="throughDay"]').value=String(s.throughDay);
    h.querySelector('[data-v2="observeFrom"]').value=String(Math.min(s.observeFrom,s.throughDay));

    if(p){
      const o=p.row.querySelector('[data-conflict="objective"]');
      if(o&&!o.querySelector('option[value="tie"]'))o.insertAdjacentHTML('beforeend','<option value="tie">Tie</option>');
      if(o)o.value=s.objective;
    }
  }

  function resetOperational(){
    const keepObjective=s.objective;
    s={...clone(D),objective:keepObjective,cz:{...D.cz},election:{...D.election}};
    save();render();
  }

  function saveManualScore(){
    const c=q(),a=clamp(c?.querySelector('[data-manual-score="a"]')?.value,0,4),b=clamp(c?.querySelector('[data-manual-score="b"]')?.value,0,4);
    s.manualDraftA=a;s.manualDraftB=b;
    const last=s.manualHistory[s.manualHistory.length-1];
    if(!last||last.a!==a||last.b!==b)s.manualHistory.push({a,b,at:new Date().toISOString(),objective:s.objective});
    if(s.manualHistory.length>8)s.manualHistory=s.manualHistory.slice(-8);
    const end=resolvedState({a,b},s.throughDay);
    if(end.resolved)s.blitz=false;
    save();render();
  }

  function syncPairObjective(){
    const p=pair();
    const o=p?.row.querySelector('[data-conflict="objective"]');
    if(o){
      if(!o.querySelector('option[value="tie"]'))o.insertAdjacentHTML('beforeend','<option value="tie">Tie</option>');
      o.value=s.objective;
    }
  }

  document.addEventListener('change',e=>{
    if(!e.target.closest('[data-bgs-lab="true"]'))return;
    if(e.target.matches('[data-v2]')){
      const key=e.target.dataset.v2;
      const previousObjective=s.objective;
      if(key==='throughDay'){
        s.throughDay=clamp(e.target.value,0,7);
        s.observeFrom=Math.min(s.observeFrom,s.throughDay);
      }else if(key==='observeFrom'){
        s.observeFrom=clamp(e.target.value,0,s.throughDay);
      }else if(key==='source'){
        const next=e.target.value;
        if(next==='stale'&&s.source!=='stale')s.staleAtDay=s.throughDay;
        if(next==='fresh')s.staleAtDay=null;
        s.source=next;
      }else if(key==='objective'){
        s.objective=e.target.value;
        if(!['win-a','win-b'].includes(s.objective))s.blitz=false;
        if(s.source==='missing'&&previousObjective!==s.objective&&s.manualHistory.length){
          const last=s.manualHistory[s.manualHistory.length-1];
          s.manualHistory=[{...last,objective:s.objective,at:new Date().toISOString()}];
        }
        syncPairObjective();
      }
      const C=context();
      if(C.score){
        const completed=C.completed===null?s.throughDay:C.completed;
        if(resolvedState(C.score,completed).resolved)s.blitz=false;
      }
      save();render();
      return;
    }
    if(e.target.matches('[data-manual-score]')){
      const key=e.target.dataset.manualScore==='a'?'manualDraftA':'manualDraftB';
      s[key]=clamp(e.target.value,0,4);save();return;
    }
    if(e.target.matches('[data-conflict]')){
      const row=e.target.closest('[data-conflict-pair-row]');
      if(row&&e.target.dataset.conflict==='objective'){
        s.objective=e.target.value==='tie'?'tie':(['win-a','win-b','monitor'].includes(e.target.value)?e.target.value:'monitor');
        if(!['win-a','win-b'].includes(s.objective))s.blitz=false;
        save();
      }
      setTimeout(render,0);
    }
  });

  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-bgs-lab="true"]'))return;
    const win=e.target.closest('[data-v2-winner]');
    if(win){
      const i=Number(win.dataset.v2Winner),side=win.dataset.side;
      s.days[i].winner=s.days[i].winner===side?'':side;
      const C=context();
      if(C.score){
        const completed=C.completed===null?s.throughDay:C.completed;
        if(resolvedState(C.score,completed).resolved)s.blitz=false;
      }
      save();render();return;
    }
    if(e.target.closest('[data-save-manual-score]')){saveManualScore();return;}
    if(e.target.closest('[data-reset-operational-history]')){resetOperational();return;}
    const blitz=e.target.closest('[data-blitz-override]');
    if(blitz&&!blitz.disabled){
      const next=!s.blitz;
      const ok=window.confirm(next
        ?'Enable Blitz for the remainder of this conflict? Conflict orders will stay at Blitz pressure until you cancel it or the conflict ends.'
        :'Cancel the Blitz override and return to automatic pressure?');
      if(ok){s.blitz=next;save();render();}
      return;
    }
    const ctr=e.target.closest('[data-mock-counter]');
    if(ctr){
      const host=ctr.closest('.wolf-report-counter'),v=host?.querySelector('[data-mock-value]');
      if(v)v.textContent=String(Math.max(0,Number(v.textContent||0)+Number(ctr.dataset.delta||0)));
      return;
    }
    const bonds=e.target.closest('[data-mock-bonds]');
    if(bonds){
      const on=bonds.getAttribute('aria-pressed')!=='true';
      bonds.setAttribute('aria-pressed',String(on));
      bonds.textContent=on?'✓ COMBAT BONDS REDEEMED':'COMBAT BONDS NOT REDEEMED';
      return;
    }
    if(e.target.closest('[data-lab-scenario],[data-lab-reset]'))setTimeout(render,60);
  });

  const start=()=>{
    render();
    const c=q();
    if(c)new MutationObserver(()=>{
      if(c.querySelector('[data-conflict-section]')&&!c.querySelector('[data-conflict-lab-v2]'))render();
    }).observe(c,{childList:true,subtree:true});
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(start,140)):setTimeout(start,140);
})();