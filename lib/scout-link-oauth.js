import { linkEnabled, linkStorageReady, sha256Hex } from './scout-link.js';
import { authStorageReady, storeRecord, readRecord, takeRecord } from './scout-auth-store.js';

export const CLIENT_ID = 'https://chatgpt.com/oauth/client.json';
export const CALLBACK = 'https://chatgpt.com/connector_platform_oauth_redirect';
export const SCOPE = 'scout.read scout.route';
export const scopeAllowed = scope => typeof scope === 'string' && scope.split(/\s+/).includes('scout.read') && scope.split(/\s+/).every(x => ['scout.read','scout.route','offline_access'].includes(x));
const BASE = 'scout-chatgpt-link:v1:oauth:';
const encoder = new TextEncoder();

export const oauthConfigured = env => linkEnabled(env) && linkStorageReady(env) && Boolean(env.ADMIN_USER_ID) && authStorageReady(env);
export const issuer = request => new URL(request.url).origin;
export const resourceUrl = request => issuer(request) + '/api/scout-link/mcp';
export const validResource = (request, resource) => typeof resource === 'string' && resource === resourceUrl(request);
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
  await storeRecord(env,await kvKey(type,raw),value,Number(value.exp));
}
export async function readSecret(env,type,raw) {
  if (!raw || typeof raw !== 'string' || raw.length > 512) return null;
  const obj = await readRecord(env,await kvKey(type,raw));
  return obj && typeof obj === 'object' && Number(obj.exp || 0) > Date.now() ? obj : null;
}
export async function consumeSecret(env,type,raw) {
  if (!raw || typeof raw !== 'string' || raw.length > 512) return null;
  const entry = await takeRecord(env,await kvKey(type,raw));
  return entry && typeof entry === 'object' && Number(entry.exp || 0) > Date.now() ? entry : null;
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
export async function issueTokens(env,ownerId,clientId,grantedScope=SCOPE,audience) {
  if (!audience) throw new Error('OAuth resource audience is required');
  const now = Date.now();
  const accessToken = 'mslink_a_' + randomToken(32);
  const refreshToken = 'mslink_r_' + randomToken(32);
  const principal = { ownerId:String(ownerId),clientId,scope:grantedScope,audience,exp:now + 3600_000 };
  await putSecret(env,'access',accessToken,principal,3600);
  await putSecret(env,'refresh',refreshToken,{...principal,exp:now + 30 * 86400_000},30*86400);
  return { access_token:accessToken,token_type:'Bearer',expires_in:3600,refresh_token:refreshToken,scope:grantedScope };
}
export async function authenticateMcp(request,env) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(mslink_a_[A-Za-z0-9_-]{40,128})$/);
  if (!match) return null;
  const token = await readSecret(env,'access',match[1]);
  if (!token || !scopeAllowed(token.scope) || token.audience !== resourceUrl(request) || token.clientId !== CLIENT_ID || token.ownerId !== String(env.ADMIN_USER_ID)) return null;
  return token;
}
export function authRequired(request) {
  return oauthJson({error:'unauthorized'},401,{
    'WWW-Authenticate': 'Bearer realm="Mongrel Scout Link", resource_metadata="' + resourceMetadataUrl(request) + '"',
  });
}
