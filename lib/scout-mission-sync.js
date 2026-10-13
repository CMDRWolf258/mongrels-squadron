// Private Scout mission-cargo snapshot reconciliation. Nothing here participates
// in Daily Orders, BGS activity, raw journal uploads or ship-cargo accounting.
export const MISSION_SYNC_PREFIX = 'scout-mission-cargo-v1:';
const MAX_RECORDS = 256;
const MAX_OPS = 24;
const MAX_AGE_MS = 90 * 86400000;
const MAX_FUTURE_MS = 300000;

export function missionSyncKey(ownerId, commander) {
  const owner = String(ownerId || '').trim();
  const name = String(commander || '').trim().replace(/\s+/g,' ').toLowerCase();
  if(!owner || !name || name.length > 80) return null;
  return MISSION_SYNC_PREFIX + encodeURIComponent(owner) + ':' + encodeURIComponent(name);
}

function text(value, limit=180) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
function timestamp(value, now) {
  const valueText = text(value, 40);
  const ms = Date.parse(valueText);
  if(!Number.isFinite(ms) || ms > now + MAX_FUTURE_MS || ms < now - MAX_AGE_MS) return null;
  return new Date(ms).toISOString();
}
function count(value, min, max) {
  if(typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}
export function normalizeMissionSyncOp(value, now=Date.now()) {
  if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const missionId = count(value.missionId,1,Number.MAX_SAFE_INTEGER);
  const occurredAt = timestamp(value.occurredAt, now);
  const kind = value.kind;
  if(missionId === null || !occurredAt || !['upsert','closed'].includes(kind)) return null;
  if(kind === 'closed') return {kind,missionId,occurredAt};
  const m = value.mission;
  if(!m || typeof m !== 'object' || Array.isArray(m) || count(m.missionId,1,Number.MAX_SAFE_INTEGER) !== missionId) return null;
  const commodity = text(m.commodity,100).toLowerCase();
  const total = count(m.count,1,1000000);
  const delivered = count(m.delivered,0,1000000);
  if(!/^[a-z0-9]+$/.test(commodity) || total === null || delivered === null || delivered > total) return null;
  const acceptedAt = timestamp(m.acceptedAt || occurredAt, now);
  if(!acceptedAt) return null;
  return {
    kind,missionId,occurredAt,
    mission: {
      missionId,
      name:text(m.name),localisedName:text(m.localisedName,240),
      commodity,commodityName:text(m.commodityName,120),
      faction:text(m.faction,160),count:total,delivered,
      wing:m.wing === true,
      destinationSystem:text(m.destinationSystem,160),
      destinationStation:text(m.destinationStation,160),
      acceptedAt,
      updatedAt:occurredAt,
    },
  };
}

export function mergeMissionSync(state, operations, now=Date.now()) {
  const prior = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const records = prior.records && typeof prior.records === 'object' && !Array.isArray(prior.records)
    ? {...prior.records} : {};
  let changed=false,accepted=0,rejected=0;
  const input=Array.isArray(operations)?operations.slice(0,MAX_OPS):[];
  for(const raw of input) {
    const op=normalizeMissionSyncOp(raw,now);
    if(!op){rejected++;continue;}
    accepted++;
    const key=String(op.missionId);
    const previous=records[key];
    // An actual terminal journal event is irreversible for a globally unique
    // MissionID. A stale laptop can never recreate a mission after closure.
    if(previous?.closed) continue;
    if(op.kind==='closed'){
      records[key]={missionId:op.missionId,closed:true,updatedAt:op.occurredAt};
      changed=true;
      continue;
    }
    const oldTime=Date.parse(previous?.updatedAt || '') || 0;
    const newTime=Date.parse(op.occurredAt);
    if(previous && newTime < oldTime) continue;
    if(previous && newTime === oldTime &&
       Number(previous.mission?.delivered || 0) >= op.mission.delivered) continue;
    records[key]={
      missionId:op.missionId,closed:false,updatedAt:op.occurredAt,
      mission:{...op.mission,delivered:Math.max(op.mission.delivered,Number(previous?.mission?.delivered || 0))},
    };
    changed=true;
  }
  // Preserve mission tombstones while active. Drop only stale, old records.
  const cutoff=now-MAX_AGE_MS;
  for(const [key,record] of Object.entries(records)){
    if(!record || !Number.isFinite(Date.parse(record.updatedAt)) || Date.parse(record.updatedAt)<cutoff){
      delete records[key];changed=true;
    }
  }
  const sorted=Object.entries(records).sort((a,b)=>String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)));
  const bounded=Object.fromEntries(sorted.slice(0,MAX_RECORDS));
  if(sorted.length>MAX_RECORDS)changed=true;
  return {state:{version:1,updatedAt:changed?new Date(now).toISOString():prior.updatedAt||null,records:bounded},changed,accepted,rejected};
}

export function visibleMissionSyncRecords(state) {
  const values=Object.values(state?.records||{});
  return values.filter(r=>r && !r.closed && r.mission)
    .map(r=>r.mission)
    .sort((a,b)=>String(a.acceptedAt).localeCompare(String(b.acceptedAt)) || a.missionId-b.missionId)
    .slice(0,128);
}
