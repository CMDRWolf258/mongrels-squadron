import { json, readSession } from '../../../lib/auth.js';

const KV_KEY = 'wolf-bgs-conflicts-v1';
const MAX_PAIRS = 3;
const PRESSURE_LEVELS = ['routine','contested','heavy'];
const MAX_PRESSURE_SYSTEMS = 80;

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  return json({ ok: true, ...(await readState(env)) }, { headers: privateHeaders() });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function' || typeof env.DAILY_ORDERS.put !== 'function') {
    return json({ ok: false, error: 'bgs_storage_not_configured' }, { status: 503, headers: privateHeaders() });
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, { status: 400, headers: privateHeaders() }); }

  const action = cleanText(body?.action, '', 60);
  const now = new Date().toISOString();
  const actor = auth.session.displayName || auth.session.username || 'CMDR Wolf258';
  const current = await readState(env);

  if (action === 'observe-conflict-scores') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok:false, error:'system_required' }, {status:400,headers:privateHeaders()});
    const observations = normalizeObservations(body?.observations);
    if (!current.pressureStates || typeof current.pressureStates !== 'object') current.pressureStates = {};
    const systemState = current.pressureStates[system] && typeof current.pressureStates[system] === 'object'
      ? current.pressureStates[system]
      : {};
    for (const observation of observations) {
      const key=pairKey(observation.factionA,observation.factionB);
      if(!key || observation.stale || observation.phase!=='active') continue;
      systemState[key]=advancePressure(systemState[key],observation,now);
    }
    if(Object.keys(systemState).length) current.pressureStates[system]=systemState;
    prunePressureSystems(current.pressureStates);
    await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(current));
    return json({ok:true,...current},{headers:privateHeaders()});
  }

  if (action === 'save-system-conflicts') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const pairs = normalizePairs(body?.pairs);
    if (pairs.length) current.systemConflicts[system] = pairs;
    else delete current.systemConflicts[system];
    current.updatedAt[system] = now;
    current.updatedBy[system] = actor;
    await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  if (action === 'reset-system-conflicts') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    delete current.systemConflicts[system];
    delete current.updatedAt[system];
    delete current.updatedBy[system];
    if(current.pressureStates) delete current.pressureStates[system];
    await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
}

async function readState(env) {
  const empty = { version: 2, systemConflicts: {}, pressureStates:{}, updatedAt: {}, updatedBy: {} };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    const systemConflicts = {};
    for (const [system, pairs] of Object.entries(stored.systemConflicts || {})) {
      const key = cleanText(system, '', 140);
      if (key) systemConflicts[key] = normalizePairs(pairs);
    }
    return {
      version: 2,
      systemConflicts,
      pressureStates:normalizePressureStates(stored.pressureStates),
      updatedAt: normalizeTextMap(stored.updatedAt, 60),
      updatedBy: normalizeTextMap(stored.updatedBy, 120),
    };
  } catch (error) {
    console.error('Could not read Wolf BGS conflict configuration', error);
    return empty;
  }
}

function normalizePairs(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const used = new Set();
  for (const row of value.slice(0, MAX_PAIRS)) {
    const factionA = cleanText(row?.factionA, '', 120);
    const factionB = cleanText(row?.factionB, '', 120);
    if (!factionA || !factionB || factionA.toLowerCase() === factionB.toLowerCase()) continue;
    const keyA = factionA.toLowerCase();
    const keyB = factionB.toLowerCase();
    if (used.has(keyA) || used.has(keyB)) continue;
    used.add(keyA); used.add(keyB);
    out.push({
      factionA,
      factionB,
      objective: ['monitor', 'win-a', 'win-b'].includes(row?.objective) ? row.objective : 'monitor',
      blitz:Boolean(row?.blitz),
    });
  }
  return out;
}

function normalizeObservations(value){
  if(!Array.isArray(value))return[];
  return value.slice(0,MAX_PAIRS).map(row=>{
    const factionA=cleanText(row?.factionA,'',120),factionB=cleanText(row?.factionB,'',120);
    const objective=['win-a','win-b'].includes(row?.objective)?row.objective:'';
    const scoreA=scoreInt(row?.scoreA),scoreB=scoreInt(row?.scoreB);
    if(!factionA||!factionB||!objective||scoreA===null||scoreB===null)return null;
    return{
      factionA,factionB,objective,scoreA,scoreB,
      day:dayInt(row?.day),
      episodeId:cleanText(row?.episodeId,'',120),
      scoreUpdatedAt:isoOrNull(row?.scoreUpdatedAt),
      phase:row?.phase==='active'?'active':row?.phase==='pending'?'pending':'none',
      stale:Boolean(row?.stale),
    };
  }).filter(Boolean);
}
function pairKey(a,b){return[cleanText(a,'',120).toLowerCase(),cleanText(b,'',120).toLowerCase()].sort().join('::')}
function scoreInt(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(4,Math.round(n))):null}
function dayInt(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(7,Math.round(n))):null}
function isoOrNull(value){const date=new Date(value||'');return Number.isFinite(date.getTime())?date.toISOString():null}
function raisePressure(level){const i=PRESSURE_LEVELS.indexOf(level);return PRESSURE_LEVELS[Math.min(PRESSURE_LEVELS.length-1,Math.max(0,i)+1)]||'heavy'}
function lowerPressure(level){const i=PRESSURE_LEVELS.indexOf(level);return PRESSURE_LEVELS[Math.max(0,i-1)]||'routine'}
function initialPressure(observation,now){
  const desired=observation.objective==='win-a'?observation.scoreA:observation.scoreB;
  const opponent=observation.objective==='win-a'?observation.scoreB:observation.scoreA;
  const pressure=(observation.scoreA===0&&observation.scoreB===0)||desired>opponent?'routine':'contested';
  return{
    factionA:observation.factionA,factionB:observation.factionB,objective:observation.objective,
    episodeId:observation.episodeId||'',pressure,quiet:0,heavyLock:false,
    baselineA:observation.scoreA,baselineB:observation.scoreB,
    scoreA:observation.scoreA,scoreB:observation.scoreB,lastDay:observation.day,
    scoreUpdatedAt:observation.scoreUpdatedAt||null,observedAt:now,updatedAt:now,observations:1,
    reason:pressure==='routine'
      ?'Opening / favorable observed score starts Routine.'
      :'First observed score is not favorable; automation starts Contested without reconstructing earlier opposition.',
  };
}
function advancePressure(existing,observation,now){
  if(!existing||typeof existing!=='object')return initialPressure(observation,now);
  const episodeChanged=observation.episodeId&&existing.episodeId&&observation.episodeId!==existing.episodeId;
  const objectiveChanged=existing.objective!==observation.objective;
  const scoreWentBack=observation.scoreA<Number(existing.scoreA||0)||observation.scoreB<Number(existing.scoreB||0);
  if(episodeChanged||objectiveChanged||scoreWentBack)return initialPressure(observation,now);

  const oldA=Number(existing.scoreA)||0,oldB=Number(existing.scoreB)||0;
  const deltaA=Math.max(0,observation.scoreA-oldA),deltaB=Math.max(0,observation.scoreB-oldB);
  const oldDay=dayInt(existing.lastDay),newDay=observation.day;
  const dayDelta=oldDay!==null&&newDay!==null?Math.max(0,newDay-oldDay):null;
  if(deltaA===0&&deltaB===0&&(dayDelta===null||dayDelta===0)){
    return{...existing,scoreUpdatedAt:observation.scoreUpdatedAt||existing.scoreUpdatedAt||null,updatedAt:now};
  }

  let pressure=PRESSURE_LEVELS.includes(existing.pressure)?existing.pressure:'contested';
  let quiet=Math.max(0,Math.round(Number(existing.quiet)||0));
  let heavyLock=Boolean(existing.heavyLock);
  const desiredDelta=observation.objective==='win-a'?deltaA:deltaB;
  const opponentDelta=observation.objective==='win-a'?deltaB:deltaA;
  const previousOpponent=observation.objective==='win-a'?oldB:oldA;
  const currentOpponent=observation.objective==='win-a'?observation.scoreB:observation.scoreA;
  let reason=existing.reason||'Pressure carried forward from the previous observation.';

  const observedSpan=dayDelta!==null&&dayDelta>0?dayDelta:(deltaA+deltaB);
  if(opponentDelta>0){
    quiet=0;
    for(let i=0;i<opponentDelta;i++)pressure=raisePressure(pressure);
    reason=opponentDelta===1
      ?'Opponent won an observed conflict day, so pressure increased one level.'
      :`Opponent gained ${opponentDelta} wins between observations; pressure increased conservatively without inventing quiet-day reductions.`;
    if(previousOpponent<3&&currentOpponent>=3){
      pressure='heavy';heavyLock=true;
      reason='Opponent reached 3 wins while observed; Heavy is locked for the remainder of this conflict.';
    }
  }else{
    const quietDays=Math.max(0,observedSpan||desiredDelta);
    if(quietDays>0){
      quiet+=quietDays;
      if(!heavyLock){
        let drops=0;
        while(quiet>=2){pressure=lowerPressure(pressure);quiet-=2;drops++;}
        reason=drops
          ?'Two observed conflict days without an opponent win lowered pressure one level.'
          :'Observed day without an opponent win; one more quiet day is needed to lower pressure.';
      }else{
        pressure='heavy';
        reason='Heavy remains locked even though the opponent did not win this observed day.';
      }
    }
  }
  if(heavyLock)pressure='heavy';
  return{
    ...existing,factionA:observation.factionA,factionB:observation.factionB,objective:observation.objective,
    episodeId:observation.episodeId||existing.episodeId||'',pressure,quiet,heavyLock,
    scoreA:observation.scoreA,scoreB:observation.scoreB,lastDay:newDay,
    scoreUpdatedAt:observation.scoreUpdatedAt||existing.scoreUpdatedAt||null,
    observedAt:now,updatedAt:now,observations:Math.max(1,Number(existing.observations)||1)+1,reason,
  };
}
function normalizePressureStates(value){
  const out={};
  if(!value||typeof value!=='object')return out;
  for(const [system,rows] of Object.entries(value)){
    const cleanSystem=cleanText(system,'',140);
    if(!cleanSystem||!rows||typeof rows!=='object')continue;
    const normalized={};
    for(const [key,state] of Object.entries(rows)){
      if(!state||typeof state!=='object')continue;
      const factionA=cleanText(state.factionA,'',120),factionB=cleanText(state.factionB,'',120);
      const actualKey=pairKey(factionA,factionB)||cleanText(key,'',280);
      if(!actualKey)continue;
      normalized[actualKey]={
        factionA,factionB,
        objective:['win-a','win-b'].includes(state.objective)?state.objective:'win-a',
        episodeId:cleanText(state.episodeId,'',120),
        pressure:PRESSURE_LEVELS.includes(state.pressure)?state.pressure:'contested',
        quiet:Math.max(0,Math.min(7,Math.round(Number(state.quiet)||0))),
        heavyLock:Boolean(state.heavyLock),
        baselineA:scoreInt(state.baselineA)??0,baselineB:scoreInt(state.baselineB)??0,
        scoreA:scoreInt(state.scoreA)??0,scoreB:scoreInt(state.scoreB)??0,lastDay:dayInt(state.lastDay),
        scoreUpdatedAt:isoOrNull(state.scoreUpdatedAt),observedAt:isoOrNull(state.observedAt),
        updatedAt:isoOrNull(state.updatedAt),observations:Math.max(1,Math.round(Number(state.observations)||1)),
        reason:cleanText(state.reason,'',320),
      };
    }
    if(Object.keys(normalized).length)out[cleanSystem]=normalized;
  }
  return out;
}
function prunePressureSystems(map){
  const systems=Object.entries(map||{});
  if(systems.length<=MAX_PRESSURE_SYSTEMS)return;
  systems.sort((a,b)=>{
    const newest=rows=>Math.max(0,...Object.values(rows||{}).map(row=>Date.parse(row?.updatedAt||'')||0));
    return newest(b[1])-newest(a[1]);
  });
  for(const [system] of systems.slice(MAX_PRESSURE_SYSTEMS))delete map[system];
}

function normalizeTextMap(value, maxLength) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, item] of Object.entries(value)) {
    const cleanKey = cleanText(key, '', 140);
    const cleanValue = cleanText(item, '', maxLength);
    if (cleanKey && cleanValue) out[cleanKey] = cleanValue;
  }
  return out;
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response: json({ ok: false, error: 'authentication_required' }, { status: 401, headers: privateHeaders() }) };
  if (session.access !== 'site_admin') return { response: json({ ok: false, error: 'site_admin_required' }, { status: 403, headers: privateHeaders() }) };
  return { session };
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'wolf-bgs-control') {
    return json({ ok: false, error: 'request_validation_failed' }, { status: 403, headers: privateHeaders() });
  }
  return null;
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : fallback;
}
function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  };
}
