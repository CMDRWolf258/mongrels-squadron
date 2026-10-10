import assert from 'node:assert/strict';
import { createSession } from '../lib/auth.js';
import { sha256Hex, normalizeShipSnapshot } from '../lib/scout-link.js';
import { randomToken, verifyPkce, issueTokens, CLIENT_ID, CALLBACK } from '../lib/scout-link-oauth.js';
import { onRequestPost as ingest } from '../functions/api/scout-link/ingest.js';
import { onRequestGet as adminRead } from '../functions/api/scout-link/ship.js';
import { onRequestPost as mcp } from '../functions/api/scout-link/mcp.js';
import { onRequestGet as authorizeGet, onRequestPost as authorizePost } from '../functions/api/scout-link/oauth/authorize.js';
import { onRequestPost as exchangeToken } from '../functions/api/scout-link/oauth/token.js';

class Kv {
  constructor(){this.values=new Map();}
  async get(key,opt){const v=this.values.get(key);return opt?.type === 'json' && v ? JSON.parse(v) : (v ?? null);}
  async put(key,value){this.values.set(key,value);}
  async delete(key){this.values.delete(key);}
}
const kv=new Kv();
const env={SCOUT_CHATGPT_LINK_ENABLED:'true',ADMIN_USER_ID:'admin-123',SESSION_SECRET:'test-secret-only',DAILY_ORDERS:kv};
const origin='https://mongrels-squadron.pages.dev';
const now=()=>new Date().toISOString();
const baseModel={kind:'mkii',optimalMass:7528.04,maxFuelPerJump:6.8,ratingConstant:11,powerConstant:2.5025,guardianBoost:10.5};
const snapshot={version:1,system:'NGC 2546 Sector UZ-G d10-16',ship:'Leaf On the Wind',shipType:'Caspian Explorer',observedAt:now(),currentJumpRange:69.01,fuel:128,fuelCapacity:128,cargo:0,unladenMass:1502.22,jumpModel:baseModel};
const normalized=normalizeShipSnapshot(snapshot);
assert.equal(normalized.ship,'Leaf On the Wind');
assert.ok(normalized.fullFuelZeroCargoRange > 50 && normalized.fullFuelZeroCargoRange < 100);
assert.equal(normalized.fsdType,'mkii');
assert.equal(normalized.observedAt,snapshot.observedAt);
assert.equal(normalizeShipSnapshot({...snapshot,observedAt:'2020-01-01T00:00:00Z'}),null);
const secret='mscout_'+'a'.repeat(40);
await kv.put('wolf-bgs-scout-tokens-v1',JSON.stringify({tokens:{'1':{id:'1',ownerId:env.ADMIN_USER_ID,hash:await sha256Hex(secret)}}}));
const req=(url,method,body,headers={})=>new Request(url,{method,headers,body});
const submit=async(token,body=snapshot)=>ingest({env,request:req(origin+'/api/scout-link/ingest','POST',JSON.stringify(body),{'Content-Type':'application/json',Authorization:'Bearer '+token})});
assert.equal((await submit('mscout_invalid')).status,401);
assert.equal((await submit(secret)).status,200);
const nonAdmin=await createSession(env,{id:'not-admin',username:'visitor'},{access:'site_admin',membershipVerified:true});
const owner=await createSession(env,{id:env.ADMIN_USER_ID,username:'wolf'},{access:'site_admin',membershipVerified:true});
const get=async(cookie)=>adminRead({env,request:req(origin+'/api/scout-link/ship','GET',undefined,cookie?{Cookie:'mongrels_session='+cookie}:{})});
assert.equal((await get()).status,403);
assert.equal((await get(nonAdmin)).status,403);
const adminPayload=await (await get(owner)).json();
assert.equal(adminPayload.ship.ship,'Leaf On the Wind');
assert.equal(adminPayload.ship.fresh,true);
assert.equal(adminPayload.ship.cargo,0);

const issued=await issueTokens(env,env.ADMIN_USER_ID,CLIENT_ID);
const rpc=async(msg,token=issued.access_token)=>mcp({env,request:req(origin+'/api/scout-link/mcp','POST',JSON.stringify(msg),{'Content-Type':'application/json',Authorization:'Bearer '+token})});
assert.equal((await rpc({jsonrpc:'2.0',id:1,method:'tools/list'},'invalid')).status,401);
const init=await (await rpc({jsonrpc:'2.0',id:2,method:'initialize',params:{}})).json();
assert.equal(init.result.serverInfo.name,'Mongrel Scout Link');
const tools=await (await rpc({jsonrpc:'2.0',id:3,method:'tools/list'})).json();
assert.deepEqual(tools.result.tools.map(t=>t.name),[
  'get_current_ship','plot_neutron_route','get_neutron_route',
  'activate_neutron_navigation','stop_neutron_navigation','get_active_neutron_navigation',
]);
const result=await (await rpc({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'get_current_ship',arguments:{}}})).json();
assert.equal(result.result.structuredContent.ship.ship,'Leaf On the Wind');
assert.equal((await (await rpc({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'set_ship_route'}})).json()).error.code,-32602);

// OAuth: admin consent, PKCE, one-time code and scoped token.
const verifier='a'.repeat(56);
const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
const challenge=Buffer.from(bytes).toString('base64url');
assert.ok(await verifyPkce(verifier,challenge));
assert.equal(await verifyPkce('b'.repeat(56),challenge),false);
const auth=new URL(origin+'/api/scout-link/oauth/authorize');
for(const [k,v] of Object.entries({client_id:CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',scope:'scout.read',state:'test-state'})) auth.searchParams.set(k,v);
const presented=await authorizeGet({env,request:req(auth,'GET',undefined,{Cookie:'mongrels_session='+owner})});
assert.equal(presented.status,200);
const html=await presented.text();
const pending=html.match(/name="pending" value="([^"]+)"/)?.[1];
assert.ok(pending);
const cookie=presented.headers.get('Set-Cookie').split(';')[0];
const approved=await authorizePost({env,request:req(auth,'POST',new URLSearchParams({pending,decision:'approve'}),{'Content-Type':'application/x-www-form-urlencoded',Origin:origin,Cookie:'mongrels_session='+owner+'; '+cookie})});
assert.equal(approved.status,303);
const code=new URL(approved.headers.get('Location')).searchParams.get('code');
assert.ok(code);
const exchange=()=>exchangeToken({env,request:req(origin+'/api/scout-link/oauth/token','POST',new URLSearchParams({client_id:CLIENT_ID,grant_type:'authorization_code',code,redirect_uri:CALLBACK,code_verifier:verifier}),{'Content-Type':'application/x-www-form-urlencoded'})});
const grant=await (await exchange()).json();
assert.equal(grant.scope,'scout.read scout.route');
assert.equal((await exchange()).status,400);
assert.equal((await rpc({jsonrpc:'2.0',id:6,method:'tools/list'},grant.access_token)).status,200);
const wrongEnv={...env,SCOUT_CHATGPT_LINK_ENABLED:'false'};
assert.equal((await ingest({env:wrongEnv,request:req(origin+'/api/scout-link/ingest','POST',JSON.stringify(snapshot),{Authorization:'Bearer '+secret})})).status,404);
console.log('Scout ChatGPT Link read-only, OAuth and security smoke tests passed');
