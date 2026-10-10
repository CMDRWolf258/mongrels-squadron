import { authenticateOwnerScout, linkEnabled, linkReply, linkStorageReady, normalizeShipSnapshot, snapshotKey, SCOUT_LINK_EXPIRES_SECONDS } from '../../../lib/scout-link.js';

// This is a separate, explicitly opted-in ship telemetry lane. It does NOT
// alter the existing BGS, trade, mission, or HUD transports.
export async function onRequestPost({request,env}) {
  if (!linkEnabled(env)) return linkReply({ok:false,error:'scout_link_disabled'}, 404);
  if (!linkStorageReady(env) || !env.ADMIN_USER_ID) return linkReply({ok:false,error:'scout_link_unconfigured'},503);
  const owner = await authenticateOwnerScout(request, env);
  if (!owner) return linkReply({ok:false,error:'unauthorized'},401);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4096) return linkReply({ok:false,error:'payload_too_large'},413);
  let body;
  try { body = await request.json(); } catch { return linkReply({ok:false,error:'invalid_json'},400); }
  const snapshot = normalizeShipSnapshot(body);
  if (!snapshot) return linkReply({ok:false,error:'invalid_ship_snapshot'},422);
  // Reject a delayed/out-of-order upload so two sessions cannot overwrite
  // newer observations simply because of network retry ordering.
  const current = await env.DAILY_ORDERS.get(snapshotKey(env), {type:'json'});
  if (current && Date.parse(current.observedAt || '') > Date.parse(snapshot.observedAt)) {
    return linkReply({ok:true,accepted:true,stored:false,reason:'older_observation'});
  }
  await env.DAILY_ORDERS.put(snapshotKey(env), JSON.stringify(snapshot), { expirationTtl:SCOUT_LINK_EXPIRES_SECONDS });
  return linkReply({ok:true,accepted:true,stored:true,receivedAt:snapshot.receivedAt});
}
