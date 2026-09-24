import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MONGREL_PURSUITS,
  getMemberPursuitIds,
  pursuitIdsFromLabels,
  pursuitLabels,
  setMemberPursuits,
} from '../lib/mongrel-pursuits.js';
import {
  PURSUITS_SELECT_CUSTOM_ID,
  buildMongrelPursuitsDiscordPayload,
} from '../lib/mongrel-pursuits-discord.js';

function fakeKv(seed={}){
  const store=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  return{
    async get(key,options){
      const value=store.get(key);
      if(value==null)return null;
      return options?.type==='json'?JSON.parse(value):value;
    },
    async put(key,value){store.set(key,String(value));},
    dump(key){const value=store.get(key);return value?JSON.parse(value):null;},
  };
}

assert.equal(MONGREL_PURSUITS.length,16);
assert.deepEqual(pursuitIdsFromLabels(['BGS Operations','Trade','AX Combat']),['bgs','trade','ax']);
assert.deepEqual(pursuitLabels(['bgs','trade']),['BGS','Trade & Hauling']);

const kv=fakeKv({
  'profiles-v1':[{
    id:'profile-1',ownerId:'user-1',ownerName:'Wolf',commanderName:'CMDR Wolf258',
    activities:['BGS Operations','Mining'],updatedAt:'2026-09-20T00:00:00.000Z',
  }],
});
const env={PROJECTS:kv};
const fallback=await getMemberPursuitIds(env,'user-1',{profileFallback:true});
assert.deepEqual(fallback,['bgs','mining']);

const saved=await setMemberPursuits(env,{
  ownerId:'user-1',
  displayName:'CMDR Wolf258',
  pursuits:['bgs','colonization','mining'],
  source:'website',
});
assert.deepEqual(saved.member.pursuits,['bgs','colonization','mining']);
assert.deepEqual(kv.dump('profiles-v1')[0].activities,['BGS','Colonization','Mining']);
assert.deepEqual(await getMemberPursuitIds(env,'user-1',{profileFallback:true}),['bgs','colonization','mining']);

const payload=buildMongrelPursuitsDiscordPayload({origin:'https://mongrels-squadron.pages.dev'});
assert.equal(payload.embeds[0].title,'🐺 Mongrel Pursuits');
assert.match(payload.embeds[0].description,/interests, not obligations/i);
assert.equal(payload.components[0].components[0].custom_id,PURSUITS_SELECT_CUSTOM_ID);
assert.equal(payload.components[0].components[0].options.length,MONGREL_PURSUITS.length);
assert.equal(payload.components[0].components[0].max_values,MONGREL_PURSUITS.length);
assert.match(payload.components[1].components[0].url,/\/pursuits\/$/);

const api=readFileSync('functions/api/pursuits/index.js','utf8');
for(const pattern of [
  /mongrels-pursuits/,
  /setMemberPursuits/,
  /syncMemberPursuitRoles/,
  /syncMongrelPursuitsDiscord/,
  /site_admin_required/,
])assert.match(api,pattern);

const interactions=readFileSync('functions/api/discord/interactions.js','utf8');
for(const pattern of [
  /PURSUITS_SELECT_CUSTOM_ID/,
  /handlePursuitsInteraction/,
  /setMemberPursuits/,
  /syncMemberPursuitRoles/,
])assert.match(interactions,pattern);

const profiles=readFileSync('functions/api/profiles/index.js','utf8');
assert.match(profiles,/seedProfileActivitiesFromPursuits/);
assert.match(profiles,/Mongrel Pursuits is the authoritative editor for member activities/);

const client=readFileSync('js/pursuits.js','utf8');
new Function(client);
for(const pattern of [
  /\/api\/pursuits/,
  /Save My Pursuits|Saving your pursuits/,
  /Publish \/ Sync Discord Card/,
  /mongrels-pursuits/,
])assert.match(client,pattern);

const profileClient=readFileSync('js/profiles.js','utf8');
new Function(profileClient);
assert.match(profileClient,/Manage Mongrel Pursuits/);
assert.doesNotMatch(profileClient,/activities:fd\.getAll\('activities'\)/);

const page=readFileSync('pursuits/index.html','utf8');
for(const pattern of [
  /Mongrel Pursuits/,
  /data-pursuits-groups/,
  /data-pursuits-form/,
  /pursuits\.js\?v=1/,
  /pursuits\.css\?v=1/,
])assert.match(page,pattern);

const portal=readFileSync('member/index.html','utf8');
assert.match(portal,/id="mongrel-pursuits"/);
assert.match(portal,/href="\.\.\/pursuits\/"/);

console.log('✓ Mongrel Pursuits shares one activity model across website profiles, Discord selection, and Discord roles');
