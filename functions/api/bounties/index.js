import { json, readSession } from '../../../lib/auth.js';
import { resolveMemberProfile, publicMemberFilter } from '../../../lib/member-profile.js';
import {
  applyBountyDiscordState,
  deleteBountyDiscord,
  syncBountyDiscord,
} from '../../../lib/bounty-discord.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);
const KV_KEY = 'board-v1';

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const items = await readItems(env);
  const memberId = new URL(request.url).searchParams.get('member') || '';
  const memberProfile = memberId ? await resolveMemberProfile(env, memberId) : null;
  const selected = memberId ? (memberProfile ? items.filter(item => item.ownerId === memberProfile.ownerId) : []) : items;
  return reply({ ok:true, viewer:viewer(auth.session), canModerate:MANAGER_ACCESS.has(auth.session.access), memberFilter:publicMemberFilter(memberProfile), bounties:selected.map(item => present(item, auth.session)) });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const now = new Date().toISOString();
  const item = normalizeItem(body.value, { id:crypto.randomUUID(), ownerId:auth.session.sub, ownerName:auth.session.displayName, createdAt:now, updatedAt:now, updatedBy:auth.session.displayName });
  const items = await readItems(env);
  items.unshift(item);
  await writeItems(env, items);

  const discord = await syncBountyDiscord(env,{bounty:item,origin:new URL(request.url).origin});
  applyBountyDiscordState(item,discord);
  items[0]=item;
  await writeItems(env,items);

  return reply({ ok:true, item:present(item, auth.session), discord }, 201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const id = clean(body.value?.id,'',100); if (!id) return reply({ok:false,error:'bounty_id_required'},400);
  const items = await readItems(env); const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'bounty_not_found'},404);
  const existing = items[idx]; const manager = MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_bounty_owner'},403);
  items[idx] = normalizeItem(body.value, { id:existing.id, ownerId:existing.ownerId, ownerName:existing.ownerName, createdAt:existing.createdAt, updatedAt:new Date().toISOString(), updatedBy:auth.session.displayName }, existing);
  await writeItems(env, items);

  const discord = await syncBountyDiscord(env,{bounty:items[idx],origin:new URL(request.url).origin});
  applyBountyDiscordState(items[idx],discord);
  await writeItems(env,items);

  return reply({ ok:true, item:present(items[idx], auth.session), discord });
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const id = new URL(request.url).searchParams.get('id') || '';
  const items = await readItems(env); const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'bounty_not_found'},404);
  const existing = items[idx]; const manager = MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_bounty_owner'},403);
  items.splice(idx,1);
  await writeItems(env,items);
  const discord=await deleteBountyDiscord(env,{bounty:existing});
  return reply({ok:true,discord});
}

function normalizeItem(value, fixed, existing={}) {
  const src = value && typeof value === 'object' ? value : {};
  return {
    id: fixed.id,
    ownerId: fixed.ownerId,
    ownerName: fixed.ownerName,
    target: clean(src.target, existing.target || 'Unknown CMDR', 120),
    system: clean(src.system, existing.system || '', 120),
    reward: clean(src.reward, existing.reward || 'Bragging rights', 160),
    reason: clean(src.reason, existing.reason || '', 1600),
    proof: clean(src.proof, existing.proof || 'Screenshot or combat report', 400),
    expires: clean(src.expires, existing.expires || '', 40),
    status: normalizeStatus(src.status ?? existing.status),
    createdAt: fixed.createdAt,
    updatedAt: fixed.updatedAt,
    updatedBy: fixed.updatedBy,
    discordMessageId: clean(existing.discordMessageId, '', 40),
    discordChannelId: clean(existing.discordChannelId, '', 40),
    discordLastSyncedAt: clean(existing.discordLastSyncedAt, '', 80),
    discordLastError: clean(existing.discordLastError, '', 300),
  };
}

function present(item, session) {
  const {
    discordMessageId,
    discordChannelId,
    discordLastSyncedAt,
    discordLastError,
    ...publicItem
  }=item||{};
  return {
    ...publicItem,
    discord:{linked:Boolean(discordMessageId&&discordChannelId),lastSyncedAt:discordLastSyncedAt||'',error:discordLastError||''},
    canEdit:MANAGER_ACCESS.has(session.access) || item.ownerId === session.sub,
    isMine:item.ownerId === session.sub,
  };
}
async function readItems(env) { if(!env.BOUNTIES || typeof env.BOUNTIES.get !== 'function') return []; const stored=await env.BOUNTIES.get(KV_KEY,{type:'json'}); return Array.isArray(stored)?stored:[]; }
async function writeItems(env,items) { await env.BOUNTIES.put(KV_KEY, JSON.stringify(items.slice(0,250))); }
function requireStorage(env) { return (!env.BOUNTIES || typeof env.BOUNTIES.put !== 'function') ? reply({ok:false,error:'bounty_storage_not_configured'},503) : null; }
async function requireMember(request,env) { const session=await readSession(request,env); if(!session)return {response:reply({ok:false,error:'authentication_required'},401)}; if(!ALLOWED_ACCESS.has(session.access))return {response:reply({ok:false,error:'member_access_required'},403)}; return {session}; }
function validateSameOrigin(request) { const origin=request.headers.get('Origin'); const expected=new URL(request.url).origin; const marker=request.headers.get('X-Mongrels-Request'); if(origin!==expected || marker!=='bounty-editor') return reply({ok:false,error:'request_validation_failed'},403); return null; }
async function readBody(request) { try { return {value:await request.json()}; } catch { return {response:reply({ok:false,error:'invalid_json'},400)}; } }
function viewer(s) { return {id:s.sub,displayName:s.displayName,access:s.access}; }
function normalizeStatus(v) { const x=clean(v,'active',20).toLowerCase(); return ['active','claimed','complete'].includes(x)?x:'active'; }
function clean(v,fallback,max) { if(typeof v!=='string') return fallback; const x=v.trim(); return x ? x.slice(0,max) : fallback; }
function headers() { return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}; }
function reply(data,status=200) { return json(data,{status,headers:headers()}); }
