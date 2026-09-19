import { json, readSession } from '../../../lib/auth.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return json({ok:false,error:'authentication_required'},{status:401});
  if (!ALLOWED_ACCESS.has(session.access)) return json({ok:false,error:'member_access_required'},{status:403});
  return json({ok:false,error:'duelbot_integration_not_configured'},{status:503});
}
