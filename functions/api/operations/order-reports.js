import { json, readSession } from '../../../lib/auth.js';

const ALLOWED_ACCESS = new Set(['member', 'officer', 'site_admin']);
const CURRENT_KEY = 'current';
const REPORT_PREFIX = 'order-report:';
const CZ_WEIGHTS = { low: 1, medium: 1.3, high: 1.6 };

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const current = await readCurrent(env);
  if (!current) return reply({ ok:true, cycleId:null, summaries:{} });
  const summaries = await summarizeCurrent(env, current, auth.session.sub);
  return reply({ ok:true, cycleId:cycleId(current), summaries });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') return reply({ok:false,error:'orders_storage_not_configured'},503);

  let body;
  try { body = await request.json(); } catch { return reply({ok:false,error:'invalid_json'},400); }

  const current = await readCurrent(env);
  if (!current) return reply({ok:false,error:'no_active_order_cycle'},409);
  const order = (Array.isArray(current.orders) ? current.orders : []).find(item => String(item?.id||'') === String(body?.orderId||''));
  if (!order) return reply({ok:false,error:'order_not_found'},404);

  const spec = reportSpec(order);
  if (!spec.type) return reply({ok:false,error:'order_reporting_not_configured'},400);

  const cycle = cycleId(current);
  const key = reportKey(cycle, order.id, auth.session.sub);
  const existing = await env.DAILY_ORDERS.get(key, { type:'json' }) || emptyRecord(order, auth.session, spec);
  const mode = body?.mode === 'wing' ? 'wing' : 'solo';

  const incoming = spec.type === 'cz' ? normalizeCz(body?.cz) : normalizeInf(body?.inf);
  const hasWork = Object.values(incoming).some(value => value > 0);
  const bonds = spec.type === 'cz' && Boolean(body?.bondsRedeemed);
  if (!hasWork && !bonds) return reply({ok:false,error:'empty_report'},400);

  const record = {
    ...existing,
    cycleId: cycle,
    orderId: order.id,
    system: order.system || '',
    reportType: spec.type,
    target: spec.target,
    mode,
    displayName: auth.session.displayName || auth.session.username || 'Mongrel CMDR',
    ownerId: auth.session.sub,
    counts: addCounts(existing.counts || {}, incoming),
    bondsRedeemed: Boolean(existing.bondsRedeemed || bonds),
    submissions: Math.min(9999, Number(existing.submissions || 0) + 1),
    updatedAt: new Date().toISOString(),
  };
  await env.DAILY_ORDERS.put(key, JSON.stringify(record));

  const summaries = await summarizeCurrent(env, current, auth.session.sub);
  return reply({ ok:true, cycleId:cycle, summaries });
}

async function requireMember(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response: reply({ok:false,error:'authentication_required'},401) };
  if (!ALLOWED_ACCESS.has(session.access)) return { response: reply({ok:false,error:'member_access_required'},403) };
  return { session };
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'daily-order-report') return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}

async function readCurrent(env) {
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return null;
  return env.DAILY_ORDERS.get(CURRENT_KEY, { type:'json' });
}

function cycleId(current) {
  const explicit = clean(current?.cycleId);
  if (explicit) return explicit;
  const stamp = clean(current?.updatedAt) || 'legacy';
  return 'legacy-' + stamp.replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,72);
}

function reportKey(cycle, orderId, ownerId) {
  return REPORT_PREFIX + encodeURIComponent(cycle) + ':' + encodeURIComponent(orderId) + ':' + encodeURIComponent(ownerId);
}

function reportPrefix(cycle, orderId) {
  return REPORT_PREFIX + encodeURIComponent(cycle) + ':' + encodeURIComponent(orderId) + ':';
}

async function listRecords(env, prefix) {
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const keys=[]; let cursor;
  do {
    const page = await env.DAILY_ORDERS.list({ prefix, cursor, limit:1000 });
    keys.push(...(page?.keys || []).map(item=>item.name));
    cursor = page?.list_complete ? undefined : page?.cursor;
  } while (cursor);
  const records = await Promise.all(keys.map(key => env.DAILY_ORDERS.get(key,{type:'json'})));
  return records.filter(Boolean);
}

async function summarizeCurrent(env, current, viewerId) {
  const out={};
  for (const order of Array.isArray(current.orders) ? current.orders : []) {
    const spec=reportSpec(order);
    if (!spec.type) continue;
    const records=await listRecords(env, reportPrefix(cycleId(current), order.id));
    out[order.id]=summarize(order,spec,records,viewerId);
  }
  return out;
}

function summarize(order,spec,records,viewerId) {
  const squadCounts = spec.type === 'cz' ? normalizeCz({}) : normalizeInf({});
  const viewerCounts = spec.type === 'cz' ? normalizeCz({}) : normalizeInf({});
  let reportCount=0,bondsRedeemedBy=0,viewerBonds=false,updatedAt=null;
  for (const record of records) {
    const normalized=spec.type==='cz'?normalizeCz(record.counts):normalizeInf(record.counts);
    mergeInto(squadCounts,normalized);
    reportCount += Number(record.submissions || 0);
    if (record.bondsRedeemed) bondsRedeemedBy += 1;
    if (String(record.ownerId)===String(viewerId)) {
      mergeInto(viewerCounts,normalized);
      viewerBonds=Boolean(record.bondsRedeemed);
    }
    if (record.updatedAt && (!updatedAt || record.updatedAt>updatedAt)) updatedAt=record.updatedAt;
  }
  const squadScore=spec.type==='cz'?czScore(squadCounts):infScore(squadCounts);
  const viewerScore=spec.type==='cz'?czScore(viewerCounts):infScore(viewerCounts);
  return {
    orderId:order.id, type:spec.type, target:spec.target, blitz:spec.blitz,
    squad:{ counts:squadCounts, score:round(squadScore), reporterCount:records.length, reportCount, bondsRedeemedBy, updatedAt },
    viewer:{ counts:viewerCounts, score:round(viewerScore), bondsRedeemed:viewerBonds },
  };
}

function reportSpec(order) {
  const explicit=order?.reporting && typeof order.reporting==='object' ? order.reporting : {};
  let type=['cz','inf'].includes(explicit.type)?explicit.type:'';
  const text=[order?.task,order?.detail].filter(Boolean).join(' ');
  if (!type && /\b(?:CZ|Conflict Zones?)\b/i.test(text)) type='cz';
  if (!type && /\bINF\b/i.test(text)) type='inf';
  let target=numberOrNull(explicit.target);
  if (target===null && type==='cz') target=matchTarget(text,/([0-9]+(?:\.[0-9]+)?)\s*(?:CZ\s*)?(?:points?|pts?)\b/i);
  if (target===null && type==='inf') target=matchTarget(text,/([0-9]+(?:\.[0-9]+)?)\s*INF\b/i);
  return { type, target, blitz:Boolean(explicit.blitz || /\bBLITZ\b/i.test(text)) };
}

function matchTarget(text,re){const match=String(text||'').match(re);return match?numberOrNull(match[1]):null}
function numberOrNull(value){const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
function clean(value){return typeof value==='string'?value.trim():''}
function safeCount(value){const n=Math.floor(Number(value)||0);return Math.max(0,Math.min(99,n))}
function normalizeCz(value={}) {
  return {
    low:safeCount(value.low), medium:safeCount(value.medium), high:safeCount(value.high),
    lossLow:safeCount(value.lossLow), lossMedium:safeCount(value.lossMedium), lossHigh:safeCount(value.lossHigh),
    disconnectLow:safeCount(value.disconnectLow), disconnectMedium:safeCount(value.disconnectMedium), disconnectHigh:safeCount(value.disconnectHigh),
  };
}
function normalizeInf(value={}) { return { inf2:safeCount(value.inf2),inf3:safeCount(value.inf3),inf4:safeCount(value.inf4),inf5:safeCount(value.inf5) }; }
function addCounts(existing,incoming){const out={};for(const key of Object.keys(incoming))out[key]=safeCount(Number(existing?.[key]||0)+Number(incoming[key]||0));return out}
function mergeInto(target,source){for(const [key,value] of Object.entries(source))target[key]=(target[key]||0)+Number(value||0)}
function czScore(c){return (c.low-c.lossLow-c.disconnectLow)*CZ_WEIGHTS.low+(c.medium-c.lossMedium-c.disconnectMedium)*CZ_WEIGHTS.medium+(c.high-c.lossHigh-c.disconnectHigh)*CZ_WEIGHTS.high}
function infScore(c){return c.inf2*2+c.inf3*3+c.inf4*4+c.inf5*5}
function round(value){return Math.round((Number(value)||0)*10)/10}
function emptyRecord(order,session,spec){return{cycleId:null,orderId:order.id,system:order.system||'',reportType:spec.type,target:spec.target,mode:'solo',displayName:session.displayName||'',ownerId:session.sub,counts:spec.type==='cz'?normalizeCz({}):normalizeInf({}),bondsRedeemed:false,submissions:0,updatedAt:null}}

function privateHeaders(){return{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}}
function reply(body,status=200){return json(body,{status,headers:privateHeaders()})}
