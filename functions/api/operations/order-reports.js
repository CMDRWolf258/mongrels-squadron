import { json, readSession } from '../../../lib/auth.js';
import { HUD_SIGNAL_MISSION_PROGRESS, readHudSignal, touchHudSignal } from '../../../lib/hud-change-signals.js';
import { invalidateKeyListCache, listKeysCached } from '../../../lib/kv-list-cache.js';
import { aggregateVerifiedOrderTotals, matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { getEvents, listFrontierAccounts } from '../../../lib/frontier.js';
import { orderWorkCycleId, workCycleForTimestamp } from '../../../lib/daily-order-cycle.js';

const ALLOWED_ACCESS = new Set(['member', 'officer', 'site_admin']);
const MANAGER_ACCESS = new Set(['officer', 'site_admin']);
const CURRENT_KEY = 'current';
const LEGACY_PREFIX = 'order-report:';
const SUBMISSION_PREFIX = 'order-submission:';
const CZ_WEIGHTS = { low: 1, medium: 1.3, high: 1.6 };
const CZ_RESULT_OUTCOMES = new Set(['win','loss','disconnect']);
const CZ_RESULT_INTENSITIES = new Set(['low','medium','high']);
const WING_RESULT_WINDOW_MS = 3 * 60 * 1000;
const SOLO_DOUBLE_TAP_WINDOW_MS = 45 * 1000;
const REPORT_TYPES = new Set(['cz', 'inf', 'bounties', 'trade', 'exploration']);
const CREDIT_TYPES = new Set(['bounties', 'trade', 'exploration']);
const PROGRESS_CACHE_VERSION=1;
const PROGRESS_CACHE_PREFIX='order-progress-cache-v1:';
const PROGRESS_CACHE_MAX_AGE_MS=10*60*1000;
const PROGRESS_CACHE_TTL_SECONDS=30*24*60*60;

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const current = await readCurrent(env);
  const canManage = MANAGER_ACCESS.has(auth.session.access);
  if (!current) return reply({ ok:true, cycleId:null, summaries:{}, verifiedSummaries:{}, reports:[], canManageReports:canManage });

  const progress=await readOrderProgressSnapshot(env,current);
  const records=progress.records;
  const verifiedSummaries=progress.verifiedSummaries;
  const summaries = summarizeCurrent(current, records, auth.session.sub);
  const wantsAdmin = new URL(request.url).searchParams.get('admin') === '1';
  const visible = wantsAdmin && canManage
    ? records
    : records.filter(record => recordIncludesUser(record,auth.session.sub));

  return reply({
    ok:true,
    cycleId:cycleId(current),
    summaries,
    verifiedSummaries,
    reports:visible.map(record => reportView(record, canManage || String(record.ownerId) === String(auth.session.sub))),
    canManageReports:canManage,
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const validation = validateMutation(request);
  if (validation) return validation;
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') return reply({ok:false,error:'orders_storage_not_configured'},503);

  const body = await readBody(request);
  if (body.error) return body.error;

  const current = await readCurrent(env);
  if (!current) return reply({ok:false,error:'no_active_order_cycle'},409);
  const order = findOrder(current, body.value?.orderId);
  if (!order) return reply({ok:false,error:'order_not_found'},404);
  const spec = reportSpec(order);
  if (!spec.type) return reply({ok:false,error:'order_reporting_not_configured'},400);

  const czResult = spec.type === 'cz' ? normalizeCzResult(body.value?.czResult) : null;
  const incoming = czResult ? countsForCzResult(czResult) : normalizeIncoming(spec.type, body.value);
  const bonds = spec.type === 'cz' && Boolean(body.value?.bondsRedeemed);
  if (!hasContribution(incoming, bonds)) return reply({ok:false,error:'empty_report'},400);

  const now = new Date().toISOString();
  const mode=body.value?.mode === 'wing' ? 'wing' : 'solo';
  const participant={ownerId:String(auth.session.sub||''),displayName:auth.session.displayName || auth.session.username || 'Mongrel CMDR'};
  if(czResult){
    const records=await listCurrentRecords(env,current);
    const duplicate=findCzResultDuplicate(records,{
      orderId:order.id,czResult,mode,ownerId:auth.session.sub,createdAt:now,
    });
    if(duplicate){
      const participants=mergeParticipants(duplicate.participants,[participant]);
      const updated={...duplicate,participants,updatedAt:now};
      await env.DAILY_ORDERS.put(submissionKey(cycleId(current),duplicate.reportId),JSON.stringify(stripStorageMeta(updated)));
      await touchHudSignal(env,HUD_SIGNAL_MISSION_PROGRESS);
      await invalidateKeyListCache(env,reportListCacheKey('submissions',cycleId(current)));
      return mutationReply(env,current,auth.session,{...updated,storageKind:'submission'},participants.length>(duplicate.participants||[]).length?'joined-wing-result':'duplicate-result');
    }
  }

  const reportId = crypto.randomUUID();
  const record = {
    reportId,
    storageKind:'submission',
    cycleId:cycleId(current),
    workCycleId:orderWorkCycleId(order,cycleId(current)),
    workCycleStartedAt:order?.workCycle?.cycleStartedAt||null,
    workCycleEndsAt:order?.workCycle?.cycleEndsAt||null,
    orderId:order.id,
    system:order.system || '',
    faction:order.faction || '',
    kind:order.kind || '',
    source:order.source || '',
    reportType:spec.type,
    target:spec.target,
    mode,
    displayName:participant.displayName,
    ownerId:auth.session.sub,
    participants:[participant],
    czResult,
    counts:incoming,
    bondsRedeemed:bonds,
    submissions:1,
    createdAt:now,
    updatedAt:now,
  };

  await env.DAILY_ORDERS.put(submissionKey(record.cycleId, reportId), JSON.stringify(record));
  await touchHudSignal(env,HUD_SIGNAL_MISSION_PROGRESS);
  await invalidateKeyListCache(env,reportListCacheKey('submissions',record.cycleId));
  return mutationReply(env, current, auth.session, record, 'created');
}

export async function onRequestPatch({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const validation = validateMutation(request);
  if (validation) return validation;
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') return reply({ok:false,error:'orders_storage_not_configured'},503);

  const body = await readBody(request);
  if (body.error) return body.error;
  const current = await readCurrent(env);
  if (!current) return reply({ok:false,error:'no_active_order_cycle'},409);

  const found = await readReportById(env, current, body.value?.reportId);
  if (!found) return reply({ok:false,error:'report_not_found'},404);
  if (!canModify(auth.session, found.record)) return reply({ok:false,error:'report_edit_forbidden'},403);

  const order = findOrder(current, found.record.orderId);
  if (!order) return reply({ok:false,error:'order_not_found'},404);
  const spec = reportSpec(order);
  const incoming = normalizeIncoming(spec.type, body.value);
  const bonds = spec.type === 'cz' && Boolean(body.value?.bondsRedeemed);
  if (!hasContribution(incoming, bonds)) return reply({ok:false,error:'empty_report'},400);

  const record = {
    ...found.record,
    system:order.system || '',
    faction:order.faction || '',
    kind:order.kind || '',
    source:order.source || '',
    reportType:spec.type,
    target:spec.target,
    mode:body.value?.mode === 'wing' ? 'wing' : 'solo',
    counts:incoming,
    bondsRedeemed:bonds,
    updatedAt:new Date().toISOString(),
  };
  await env.DAILY_ORDERS.put(found.key, JSON.stringify(stripStorageMeta(record)));
  await touchHudSignal(env,HUD_SIGNAL_MISSION_PROGRESS);
  return mutationReply(env, current, auth.session, {...record, reportId:found.reportId, storageKind:found.storageKind}, 'updated');
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const validation = validateMutation(request);
  if (validation) return validation;
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.delete !== 'function') return reply({ok:false,error:'orders_storage_not_configured'},503);

  const body = await readBody(request);
  if (body.error) return body.error;
  const current = await readCurrent(env);
  if (!current) return reply({ok:false,error:'no_active_order_cycle'},409);

  const found = await readReportById(env, current, body.value?.reportId);
  if (!found) return reply({ok:false,error:'report_not_found'},404);
  if (!canModify(auth.session, found.record)) return reply({ok:false,error:'report_delete_forbidden'},403);

  await env.DAILY_ORDERS.delete(found.key);
  await touchHudSignal(env,HUD_SIGNAL_MISSION_PROGRESS);
  await invalidateKeyListCache(env,reportListCacheKey(found.storageKind==='legacy'?'legacy':'submissions',cycleId(current)));
  const records = (await listCurrentRecords(env, current))
    .filter(record => String(record.reportId || '') !== String(found.reportId || ''));
  return reply({
    ok:true,
    action:'deleted',
    cycleId:cycleId(current),
    summaries:summarizeCurrent(current, records, auth.session.sub),
    reports:records
      .filter(record => recordIncludesUser(record,auth.session.sub))
      .map(record => reportView(record, canModify(auth.session,record))),
    canManageReports:MANAGER_ACCESS.has(auth.session.access),
  });
}

async function summarizeVerifiedCurrent(env,current){
  try{
    const accounts=await listFrontierAccounts(env);
    if(!accounts.length)return {};
    const members=await Promise.all(accounts.map(async row=>{
      try{
        const events=await getEvents(env,row.userId);
        return {userId:row.userId,matched:matchVerifiedActivity(events,current)};
      }catch(error){
        console.error('Could not read one member Scout activity for Daily Orders',error);
        return null;
      }
    }));
    return aggregateVerifiedOrderTotals(members.filter(Boolean));
  }catch(error){
    console.error('Could not aggregate squad Scout progress for Daily Orders',error);
    return {};
  }
}

export async function buildOrderProgressForHud(env,current,viewerId='') {
  if(!current)return{summaries:{},verifiedSummaries:{}};
  const progress=await readOrderProgressSnapshot(env,current);
  return{
    summaries:summarizeCurrent(current,progress.records,viewerId),
    verifiedSummaries:progress.verifiedSummaries,
  };
}

export async function readOrderProgressSnapshot(env,current,{now=new Date()}={}) {
  if(!current)return{records:[],verifiedSummaries:{},cacheStatus:'empty'};
  const build=async()=>{
    const [records,verifiedSummaries]=await Promise.all([
      listCurrentRecords(env,current),
      summarizeVerifiedCurrent(env,current),
    ]);
    return{records,verifiedSummaries};
  };
  const kv=env?.DAILY_ORDERS;
  if(!kv||typeof kv.get!=='function'||typeof kv.put!=='function'){
    return{...(await build()),cacheStatus:'bypass'};
  }

  const currentCycle=cycleId(current);
  const fingerprint=orderProgressFingerprint(current);
  const signal=await readHudSignal(env,HUD_SIGNAL_MISSION_PROGRESS);
  const signalToken=clean(signal?.token);
  const key=progressCacheKey(currentCycle);
  const nowMs=now instanceof Date?now.getTime():new Date(now).getTime();

  try{
    const cached=await kv.get(key,{type:'json'});
    const generatedMs=Date.parse(cached?.generatedAt||'');
    const age=Number.isFinite(nowMs)&&Number.isFinite(generatedMs)?Math.max(0,nowMs-generatedMs):Infinity;
    if(
      cached?.version===PROGRESS_CACHE_VERSION
      && cached?.cycleId===currentCycle
      && cached?.fingerprint===fingerprint
      && clean(cached?.signalToken)===signalToken
      && age<=PROGRESS_CACHE_MAX_AGE_MS
      && Array.isArray(cached?.records)
      && cached?.verifiedSummaries
      && typeof cached.verifiedSummaries==='object'
      && !Array.isArray(cached.verifiedSummaries)
    ){
      return{
        records:cached.records,
        verifiedSummaries:cached.verifiedSummaries,
        cacheStatus:'hit',
      };
    }
  }catch(error){
    console.error('Could not read Daily Order progress cache',error);
  }

  const built=await build();
  try{
    await kv.put(key,JSON.stringify({
      version:PROGRESS_CACHE_VERSION,
      cycleId:currentCycle,
      fingerprint,
      signalToken,
      generatedAt:new Date(Number.isFinite(nowMs)?nowMs:Date.now()).toISOString(),
      records:built.records,
      verifiedSummaries:built.verifiedSummaries,
    }),{expirationTtl:PROGRESS_CACHE_TTL_SECONDS});
  }catch(error){
    console.error('Could not write Daily Order progress cache',error);
  }
  return{...built,cacheStatus:'miss'};
}

function progressCacheKey(currentCycle){
  return PROGRESS_CACHE_PREFIX+encodeURIComponent(String(currentCycle||'legacy'));
}

function orderProgressFingerprint(current){
  const source=JSON.stringify({
    cycleId:cycleId(current),
    updatedAt:clean(current?.updatedAt),
    orders:Array.isArray(current?.orders)?current.orders:[],
  });
  let hash=2166136261;
  for(let i=0;i<source.length;i+=1){
    hash^=source.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36);
}

async function mutationReply(env, current, session, record, action) {
  const listed = await listCurrentRecords(env, current);
  const reportId = String(record?.reportId || '');
  const records = listed.filter(item => String(item?.reportId || '') !== reportId);
  records.push(record);
  return reply({
    ok:true,
    action,
    cycleId:cycleId(current),
    report:reportView(record, true),
    summaries:summarizeCurrent(current, records, session.sub),
    reports:records
      .filter(item => recordIncludesUser(item,session.sub))
      .map(item => reportView(item, canModify(session,item))),
    canManageReports:MANAGER_ACCESS.has(session.access),
  });
}

async function requireMember(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response: reply({ok:false,error:'authentication_required'},401) };
  if (!ALLOWED_ACCESS.has(session.access)) return { response: reply({ok:false,error:'member_access_required'},403) };
  return { session };
}

function canModify(session, record) {
  return MANAGER_ACCESS.has(session.access) || String(record.ownerId) === String(session.sub);
}

function validateMutation(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'daily-order-report') return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}

async function readBody(request) {
  try { return { value:await request.json() }; }
  catch { return { error:reply({ok:false,error:'invalid_json'},400) }; }
}

async function readCurrent(env) {
  return readCurrentOrderCycle(env,{historyDepth:14});
}

function findOrder(current, id) {
  return (Array.isArray(current?.orders) ? current.orders : []).find(item => String(item?.id||'') === String(id||''));
}

function cycleId(current) {
  const explicit = clean(current?.cycleId);
  if (explicit) return explicit;
  const stamp = clean(current?.updatedAt) || 'legacy';
  return 'legacy-' + stamp.replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,72);
}

function submissionKey(cycle, reportId) {
  return SUBMISSION_PREFIX + encodeURIComponent(cycle) + ':' + encodeURIComponent(reportId);
}

function submissionPrefix(cycle) {
  return SUBMISSION_PREFIX + encodeURIComponent(cycle) + ':';
}

function legacyKey(cycle, orderId, ownerId) {
  return LEGACY_PREFIX + encodeURIComponent(cycle) + ':' + encodeURIComponent(orderId) + ':' + encodeURIComponent(ownerId);
}

function legacyPrefix(cycle, orderId) {
  return LEGACY_PREFIX + encodeURIComponent(cycle) + ':' + encodeURIComponent(orderId) + ':';
}

function legacyCyclePrefix(cycle) {
  return LEGACY_PREFIX + encodeURIComponent(cycle) + ':';
}

function reportListCacheKey(kind, cycle) {
  return 'kv-list-cache:order-reports-v1:' + kind + ':' + encodeURIComponent(cycle);
}

function legacyId(orderId, ownerId) {
  return 'legacy:' + encodeURIComponent(orderId) + ':' + encodeURIComponent(ownerId);
}

function parseLegacyId(value) {
  const parts = String(value||'').split(':');
  if (parts.length !== 3 || parts[0] !== 'legacy') return null;
  try { return { orderId:decodeURIComponent(parts[1]), ownerId:decodeURIComponent(parts[2]) }; }
  catch { return null; }
}

async function readReportById(env, current, reportId) {
  const legacy = parseLegacyId(reportId);
  if (legacy) {
    const key = legacyKey(cycleId(current), legacy.orderId, legacy.ownerId);
    const value = await env.DAILY_ORDERS.get(key, { type:'json' });
    if (!value) return null;
    return {
      key,
      reportId:legacyId(value.orderId || legacy.orderId, value.ownerId || legacy.ownerId),
      storageKind:'legacy',
      record:{...value, reportId:legacyId(value.orderId || legacy.orderId, value.ownerId || legacy.ownerId), storageKind:'legacy'},
    };
  }

  const id = clean(reportId);
  if (!id) return null;
  const key = submissionKey(cycleId(current), id);
  const value = await env.DAILY_ORDERS.get(key, { type:'json' });
  if (!value) return null;
  return { key, reportId:id, storageKind:'submission', record:{...value, reportId:id, storageKind:'submission'} };
}

async function listCurrentRecords(env, current) {
  const cycle = cycleId(current);
  const [submissions,legacy] = await Promise.all([
    listRecords(env,submissionPrefix(cycle),reportListCacheKey('submissions',cycle)),
    listRecords(env,legacyCyclePrefix(cycle),reportListCacheKey('legacy',cycle)),
  ]);
  const newRecords = submissions.map(record => ({
    ...record,
    reportId:clean(record.reportId),
    storageKind:'submission',
    submissions:1,
  })).filter(record => record.reportId);

  const currentOrderIds=new Set((Array.isArray(current.orders)?current.orders:[]).map(order=>String(order?.id||'')).filter(Boolean));
  const legacyRecords = legacy
    .filter(record=>currentOrderIds.has(String(record?.orderId||'')))
    .map(record => ({
      ...record,
      reportId:legacyId(record.orderId, record.ownerId),
      storageKind:'legacy',
      createdAt:record.createdAt || record.updatedAt || null,
    }));

  return [...legacyRecords, ...newRecords].filter(record=>recordBelongsToCurrentWorkCycle(record,current));
}

function recordBelongsToCurrentWorkCycle(record,current) {
  const order=findOrder(current,record?.orderId);
  if(!order)return false;
  const currentId=orderWorkCycleId(order,cycleId(current));
  const explicit=clean(record?.workCycleId);
  if(explicit)return explicit===currentId;
  const inferred=workCycleForTimestamp(order,record?.createdAt||record?.updatedAt||'');
  return Boolean(inferred?.cycleId&&inferred.cycleId===currentId);
}

async function listRecords(env, prefix, cacheKey) {
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const keys=await listKeysCached(env,{
    prefix,
    cacheKey,
    maxAgeSeconds:21600,
    maxKeys:5000,
  });
  const records = await Promise.all(keys.map(key => env.DAILY_ORDERS.get(key,{type:'json'})));
  return records.filter(Boolean);
}

function summarizeCurrent(current, records, viewerId) {
  const out={};
  for (const order of Array.isArray(current.orders) ? current.orders : []) {
    const spec=reportSpec(order);
    if (!spec.type) continue;
    out[order.id]=summarize(order, spec, records.filter(record => String(record.orderId) === String(order.id)), viewerId);
  }
  return out;
}

function summarize(order, spec, records, viewerId) {
  const squadCounts = blankCounts(spec.type);
  const viewerCounts = blankCounts(spec.type);
  const reporters = new Set();
  let reportCount=0,bondsRedeemedBy=0,viewerBonds=false,updatedAt=null;
  for (const record of records) {
    const normalized=normalizeCounts(spec.type, record.counts);
    mergeInto(squadCounts,normalized);
    const participantIds=participantIdsFor(record);
    if(participantIds.length)participantIds.forEach(id=>reporters.add(id));
    else if (record.ownerId) reporters.add(String(record.ownerId));
    reportCount += Math.max(1, Number(record.submissions || 1));
    if (record.bondsRedeemed) bondsRedeemedBy += 1;
    if (recordIncludesUser(record,viewerId)) {
      mergeInto(viewerCounts,normalized);
      viewerBonds=Boolean(viewerBonds || record.bondsRedeemed);
    }
    if (record.updatedAt && (!updatedAt || record.updatedAt>updatedAt)) updatedAt=record.updatedAt;
  }
  return {
    orderId:order.id, type:spec.type, target:spec.target, blitz:spec.blitz,
    squad:{ counts:squadCounts, score:round(scoreFor(spec.type,squadCounts)), reporterCount:reporters.size, reportCount, bondsRedeemedBy, updatedAt },
    viewer:{ counts:viewerCounts, score:round(scoreFor(spec.type,viewerCounts)), bondsRedeemed:viewerBonds },
  };
}

function reportView(record, canEdit) {
  const type = record.reportType;
  const counts = normalizeCounts(type, record.counts);
  return {
    id:record.reportId,
    orderId:record.orderId || '',
    system:record.system || '',
    faction:record.faction || '',
    reportType:type || '',
    target:numberOrNull(record.target),
    workCycleId:record.workCycleId||'',
    mode:record.mode === 'wing' ? 'wing' : 'solo',
    displayName:record.displayName || 'Mongrel CMDR',
    ownerId:record.ownerId || '',
    participants:normalizeParticipants(record.participants),
    czResult:normalizeCzResult(record.czResult),
    counts,
    score:round(scoreFor(type,counts)),
    bondsRedeemed:Boolean(record.bondsRedeemed),
    submissions:Math.max(1,Number(record.submissions||1)),
    createdAt:record.createdAt || record.updatedAt || null,
    updatedAt:record.updatedAt || null,
    legacy:record.storageKind === 'legacy',
    canEdit:Boolean(canEdit && type!=='cz'),
    canDelete:Boolean(canEdit),
  };
}

function stripStorageMeta(record) {
  const out={...record};
  delete out.storageKind;
  return out;
}

function normalizeCzResult(value){
  if(!value||typeof value!=='object')return null;
  const intensity=clean(value.intensity).toLowerCase();
  const outcome=clean(value.outcome).toLowerCase();
  if(!CZ_RESULT_INTENSITIES.has(intensity)||!CZ_RESULT_OUTCOMES.has(outcome))return null;
  return{intensity,outcome};
}

function countsForCzResult(result){
  const out=normalizeCz({});
  if(!result)return out;
  const cap=result.intensity.charAt(0).toUpperCase()+result.intensity.slice(1);
  const key=result.outcome==='win'?result.intensity:result.outcome==='loss'?'loss'+cap:'disconnect'+cap;
  out[key]=1;
  return out;
}

function normalizeParticipants(value){
  const seen=new Set(),out=[];
  for(const row of Array.isArray(value)?value:[]){
    const ownerId=String(row?.ownerId||'').trim();
    if(!ownerId||seen.has(ownerId))continue;
    seen.add(ownerId);
    out.push({ownerId,displayName:clean(row?.displayName)||'Mongrel CMDR'});
    if(out.length>=8)break;
  }
  return out;
}

function mergeParticipants(...groups){return normalizeParticipants(groups.flat())}
function participantIdsFor(record){
  const participants=normalizeParticipants(record?.participants);
  if(participants.length)return participants.map(row=>row.ownerId);
  const ownerId=String(record?.ownerId||'').trim();
  return ownerId?[ownerId]:[];
}
function recordIncludesUser(record,userId){
  const id=String(userId||'');
  return Boolean(id)&&participantIdsFor(record).includes(id);
}

function findCzResultDuplicate(records,{orderId,czResult,mode,ownerId,createdAt}={}){
  if(!czResult)return null;
  const at=Date.parse(createdAt||'');
  if(!Number.isFinite(at))return null;
  const windowMs=mode==='wing'?WING_RESULT_WINDOW_MS:SOLO_DOUBLE_TAP_WINDOW_MS;
  return (Array.isArray(records)?records:[])
    .filter(record=>
      record?.storageKind==='submission'
      && String(record?.orderId||'')===String(orderId||'')
      && record?.reportType==='cz'
      && record?.mode===mode
      && normalizeCzResult(record?.czResult)?.intensity===czResult.intensity
      && normalizeCzResult(record?.czResult)?.outcome===czResult.outcome
      && (mode==='wing'||recordIncludesUser(record,ownerId))
      && Math.abs(at-Date.parse(record?.createdAt||record?.updatedAt||''))<=windowMs
    )
    .sort((a,b)=>String(b?.createdAt||'').localeCompare(String(a?.createdAt||'')))[0]||null;
}

function reportSpec(order) {
  const explicit=order?.reporting && typeof order.reporting==='object' ? order.reporting : {};
  let type=REPORT_TYPES.has(explicit.type)?explicit.type:'';
  const text=[order?.task,order?.detail].filter(Boolean).join(' ');
  if (!type && /\b(?:CZ|Conflict Zones?)\b/i.test(text)) type='cz';
  if (!type && /\bINF\b/i.test(text)) type='inf';
  if (!type && /\bbount(?:y|ies)\b[^.]{0,80}\bvouchers?\b|\bbounty vouchers?\b/i.test(text)) type='bounties';
  if (!type && /\bexploration data\b/i.test(text)) type='exploration';
  if (!type && /\bprofitable trade\b|\btrade profit\b/i.test(text)) type='trade';
  let target=numberOrNull(explicit.target);
  if (target===null && type==='cz') target=matchTarget(text,/([0-9]+(?:\.[0-9]+)?)\s*(?:CZ\s*)?(?:points?|pts?)\b/i);
  if (target===null && type==='inf') target=matchTarget(text,/([0-9]+(?:\.[0-9]+)?)\s*INF\b/i);
  if (target===null && CREDIT_TYPES.has(type)) target=matchTarget(text,/([0-9]+(?:\.[0-9]+)?)\s*M\s*Cr\b/i);
  return { type, target, blitz:Boolean(explicit.blitz || /\bBLITZ\b/i.test(text)) };
}

function normalizeIncoming(type, body) {
  if (type==='cz') return normalizeCz(body?.cz);
  if (type==='inf') return normalizeInf(body?.inf);
  if (CREDIT_TYPES.has(type)) return normalizeCredits({ millions:body?.millions ?? body?.credits?.millions });
  return {};
}

function hasContribution(incoming, bonds) {
  return Object.values(incoming).some(value => Number(value) > 0) || bonds;
}

function blankCounts(type) {
  if (type==='cz') return normalizeCz({});
  if (type==='inf') return normalizeInf({});
  if (CREDIT_TYPES.has(type)) return normalizeCredits({});
  return {};
}

function normalizeCounts(type,value) {
  if (type==='cz') return normalizeCz(value);
  if (type==='inf') return normalizeInf(value);
  if (CREDIT_TYPES.has(type)) return normalizeCredits(value);
  return {};
}

function scoreFor(type,counts) {
  if (type==='cz') return czScore(counts);
  if (type==='inf') return infScore(counts);
  if (CREDIT_TYPES.has(type)) return Number(counts.millions)||0;
  return 0;
}

function matchTarget(text,re){const match=String(text||'').match(re);return match?numberOrNull(match[1]):null}
function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
function clean(value){return typeof value==='string'?value.trim():''}
function safeCount(value){const n=Math.floor(Number(value)||0);return Math.max(0,Math.min(99,n))}
function safeMillions(value){const n=Number(value)||0;return Math.round(Math.max(0,Math.min(100000,n))*100)/100}
function normalizeCz(value={}) {
  return {
    low:safeCount(value.low), medium:safeCount(value.medium), high:safeCount(value.high),
    lossLow:safeCount(value.lossLow), lossMedium:safeCount(value.lossMedium), lossHigh:safeCount(value.lossHigh),
    disconnectLow:safeCount(value.disconnectLow), disconnectMedium:safeCount(value.disconnectMedium), disconnectHigh:safeCount(value.disconnectHigh),
  };
}
function normalizeInf(value={}) { return { inf2:safeCount(value.inf2),inf3:safeCount(value.inf3),inf4:safeCount(value.inf4),inf5:safeCount(value.inf5) }; }
function normalizeCredits(value={}) { return { millions:safeMillions(value.millions) }; }
function mergeInto(target,source){for(const [key,value] of Object.entries(source))target[key]=(target[key]||0)+Number(value||0)}
function czScore(c){return (c.low-c.lossLow-c.disconnectLow)*CZ_WEIGHTS.low+(c.medium-c.lossMedium-c.disconnectMedium)*CZ_WEIGHTS.medium+(c.high-c.lossHigh-c.disconnectHigh)*CZ_WEIGHTS.high}
function infScore(c){return c.inf2*2+c.inf3*3+c.inf4*4+c.inf5*5}
function round(value){return Math.round((Number(value)||0)*10)/10}

function privateHeaders(){return{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}}
function reply(body,status=200){return json(body,{status,headers:privateHeaders()})}
