import { getCookie, cookie, readSession } from '../../../../lib/auth.js';
import { linkAdmin } from '../../../../lib/scout-link.js';
import { oauthConfigured, oauthError, randomToken, CLIENT_ID, CALLBACK, SCOPE, putSecret, readSecret, consumeSecret, noStore } from '../../../../lib/scout-link-oauth.js';

const CONSENT_COOKIE = '__Host-mongrel-scout-link-consent';
const redirect = (url) => noStore(new Response(null,{status:303,headers:{Location:url}}));
async function adminFor(request,env) {
  const user = await readSession(request,env);
  return user && user.access === 'site_admin' && linkAdmin(env,user.sub) ? user : null;
}
function confirmHtml(id) {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Connect Mongrel Scout Link</title><main style="font-family:system-ui;max-width:35rem;margin:3rem auto;padding:1rem">' +
    '<h1>Connect Mongrel Scout Link to ChatGPT?</h1>' +
    '<p>This grants ChatGPT <strong>read-only</strong> access to your most recent opt-in Scout ship snapshot: ' +
    'ship name/type, current system, fuel/cargo quantities, jump range, and timestamps. No ship controls or website writes.</p>' +
    '<p>Only the exact Mongrels Site Admin account may authorize this connection.</p>' +
    '<form method="post"><input type="hidden" name="pending" value="' + id + '">' +
    '<button name="decision" value="approve" type="submit">Allow read-only access</button> ' +
    '<button name="decision" value="deny" type="submit">Cancel</button></form></main></html>';
}
export async function onRequestGet({request,env}) {
  if (!oauthConfigured(env)) return oauthError('service_unavailable',503);
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const callback = url.searchParams.get('redirect_uri');
  const challenge = url.searchParams.get('code_challenge');
  const state = url.searchParams.get('state') || '';
  const scope = url.searchParams.get('scope') || SCOPE;
  if (clientId !== CLIENT_ID || callback !== CALLBACK ||
      url.searchParams.get('response_type') !== 'code' ||
      url.searchParams.get('code_challenge_method') !== 'S256' ||
      !challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
      scope !== SCOPE || state.length > 1000) return oauthError('invalid_request',400);
  const user = await adminFor(request,env);
  if (!user) {
    const returnTo = url.pathname + url.search;
    return redirect('/api/auth/login?return=' + encodeURIComponent(returnTo));
  }
  const pending = randomToken();
  const now = Date.now();
  await putSecret(env,'pending',pending,{ownerId:user.sub,clientId,callback,challenge,state,scope,exp:now+600000},600);
  const response = new Response(confirmHtml(pending),{status:200,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff',
  }});
  response.headers.set('Set-Cookie',cookie(CONSENT_COOKIE,pending,{maxAge:600,sameSite:'Lax'}));
  return response;
}
export async function onRequestPost({request,env}) {
  if (!oauthConfigured(env)) return oauthError('service_unavailable',503);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return oauthError('invalid_origin',403);
  const user = await adminFor(request,env);
  if (!user) return oauthError('access_denied',403);
  if (Number(request.headers.get('content-length') || 0) > 1024) return oauthError('invalid_request',413);
  const form = await request.formData();
  const pendingId = String(form.get('pending') || '');
  if (!pendingId || getCookie(request,CONSENT_COOKIE) !== pendingId) return oauthError('invalid_consent',403);
  const pending = await consumeSecret(env,'pending',pendingId);
  if (!pending || pending.ownerId !== user.sub) return oauthError('consent_expired',400);
  const url = new URL(pending.callback);
  url.searchParams.set('state',pending.state);
  if (form.get('decision') !== 'approve') {
    url.searchParams.set('error','access_denied');
  } else {
    const code = randomToken();
    await putSecret(env,'code',code,{...pending,exp:Date.now()+300000},300);
    url.searchParams.set('code',code);
  }
  const response = redirect(url.toString());
  response.headers.append('Set-Cookie',cookie(CONSENT_COOKIE,'',{maxAge:0,sameSite:'Lax'}));
  return response;
}
