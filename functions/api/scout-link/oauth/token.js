import { oauthConfigured, oauthError, oauthJson, CLIENT_ID, CALLBACK, SCOPE, consumeSecret, readSecret, issueTokens, verifyPkce } from '../../../../lib/scout-link-oauth.js';

export async function onRequestPost({request,env}) {
  if (!oauthConfigured(env)) return oauthError('service_unavailable',503);
  if (Number(request.headers.get('content-length') || 0) > 4096) return oauthError('invalid_request',413);
  if (!(request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')) return oauthError('invalid_request',400);
  const params = new URLSearchParams(await request.text());
  if (params.get('client_id') !== CLIENT_ID) return oauthError('invalid_client',401);
  const grant = params.get('grant_type');
  if (grant === 'authorization_code') {
    if (params.get('redirect_uri') !== CALLBACK) return oauthError('invalid_grant');
    const code = params.get('code');
    const entry = await readSecret(env,'code',code);
    if (!entry || entry.clientId !== CLIENT_ID || entry.callback !== CALLBACK) return oauthError('invalid_grant');
    if (!await verifyPkce(params.get('code_verifier'),entry.challenge)) return oauthError('invalid_grant');
    const consumed = await consumeSecret(env,'code',code);
    if (!consumed) return oauthError('invalid_grant');
    if (consumed.ownerId !== String(env.ADMIN_USER_ID) || consumed.scope !== SCOPE) return oauthError('invalid_grant');
    return oauthJson(await issueTokens(env,consumed.ownerId,CLIENT_ID));
  }
  if (grant === 'refresh_token') {
    const existing = await readSecret(env,'refresh',params.get('refresh_token'));
    if (!existing || existing.clientId !== CLIENT_ID || existing.ownerId !== String(env.ADMIN_USER_ID) || existing.scope !== SCOPE) return oauthError('invalid_grant');
    const consumed = await consumeSecret(env,'refresh',params.get('refresh_token'));
    if (!consumed) return oauthError('invalid_grant');
    return oauthJson(await issueTokens(env,consumed.ownerId,CLIENT_ID));
  }
  return oauthError('unsupported_grant_type');
}
