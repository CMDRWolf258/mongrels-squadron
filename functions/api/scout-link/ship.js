import { linkEnabled, linkReply, linkStorageReady, requireLinkAdmin, readShipSnapshot } from '../../../lib/scout-link.js';

// Site-admin browser diagnostic endpoint. Not usable by an anonymous browser.
export async function onRequestGet({request,env}) {
  if (!linkEnabled(env)) return linkReply({ok:false,error:'scout_link_disabled'},404);
  if (!linkStorageReady(env)) return linkReply({ok:false,error:'scout_link_unconfigured'},503);
  const admin = await requireLinkAdmin(request,env);
  if (!admin) return linkReply({ok:false,error:'forbidden'},403);
  return linkReply({ok:true,ship:await readShipSnapshot(env)});
}
