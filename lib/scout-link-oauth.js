import { linkEnabled, linkStorageReady, sha256Hex } from './scout-link.js';

export const CLIENT_ID = 'https://chatgpt.com/oauth/client.json';
export const CALLBACK = 'https://chatgpt.com/connector_platform_oauth_redirect';
export const SCOPE = 'scout.read';
export const scopeAllowed = scope => typeof scope === 'string' && scope.split(/\s+/).includes(SCOPE) && scope.split(/\s+/).every(x => x === SCOPE || x === 'offline_access');
const BASE = 'scout-chatgpt-link:v1:oauth:';
const encoder = new TextEncoder();

export const oauthConfigured = env => linkEnabled(env) && linkStorageReady(env) && Boolean(env.ADMIN_USER_ID);
export const issuer = request => new URL(request.url).origin;
export const resourceUrl = request => issuer(request) + '/api/scout-link/mcp';
export const authorizeUrl = request => issuer(request) + '/api/scout-link/oauth/authorize';
export const tokenUrl = request => issuer(request) + '/api/scout-link/oauth/token';
export const resourceMetadataUrl = request => issuer(request) + '/.well-known/oauth-protected-resource';

export function noStore(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,headers});
}
export function oauthJson(value,status=200,headers={}) {
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}
export function oauthError(code,status=400) { return oauthJson({error:code},status); }
export const randomToken = (bytes=32) => {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
export async function kvKey(type,raw) { return BASE + type + ':' + await sha256Hex(raw); }
export async function putSecret(env,type,raw,value,ttlSeconds) {
  await env.DAILY_ORDERS.put(await kvKey(type,raw),JSON.stringify(value),{expirationTtl:ttlSeconds});
}
export async function readSecret(env,type,raw) {
  if (!raw || typeof raw !== 'string' || raw.length > 512) return null;
  const obj = await env.DAILY_ORDERS.get(await kvKey(type,raw),{type:'json'});
  return obj && typeof obj === 'object' && Number(obj.exp || 0) > Date.now() ? obj : null;
}
export async function consumeSecret(env,type,raw) {
  const key = await kvKey(type,raw);
  const entry = await readSecret(env,type,raw);
  if (entry) await env.DAILY_ORDERS.delete(key);
  return entry;
}
export function isSupportedClient(clientId,redirectUri) {
  return clientId === CLIENT_ID && redirectUri === CALLBACK;
}
export async function verifyPkce(verifier,challenge) {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const digest = await crypto.subtle.digest('SHA-256',encoder.encode(verifier));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if (encoded.length !== challenge.length) return false;
  let mismatch = 0;
  for(let i=0;i<encoded.length;i++) mismatch |= encoded.charCodeAt(i) ^ challenge.charCodeAt(i);
  return mismatch === 0;
}
export async function issueTokens(env,ownerId,clientId,grantedScope=SCOPE) {
  const now = Date.now();
  const accessToken = 'mslink_a_' + randomToken(32);
  const refreshToken = 'mslink_r_' + randomToken(32);
  const principal = { ownerId:String(ownerId),clientId,scope:grantedScope,audience:'scout-link',exp:now + 3600_000 };
  await putSecret(env,'access',accessToken,principal,3600);
  await putSecret(env,'refresh',refreshToken,{...principal,exp:now + 30 * 86400_000},30*86400);
  return { access_token:accessToken,token_type:'Bearer',expires_in:3600,refresh_token:refreshToken,scope:grantedScope };
}
export async function authenticateMcp(request,env) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(mslink_a_[A-Za-z0-9_-]{40,128})$/);
  if (!match) return null;
  const token = await readSecret(env,'access',match[1]);
  if (!token || !scopeAllowed(token.scope) || token.clientId !== CLIENT_ID || token.ownerId !== String(env.ADMIN_USER_ID)) return null;
  return token;
}
export function authRequired(request) {
  return oauthJson({error:'unauthorized'},401,{
    'WWW-Authenticate': 'Bearer realm="Mongrel Scout Link", resource_metadata="' + resourceMetadataUrl(request) + '"',
  });
}
