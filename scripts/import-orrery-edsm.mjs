import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SYSTEM_NAME = 'NGC 2546 Sector UZ-G d10-16';
const SYSTEM_ID = 'ngc-2546-uz-g-d10-16';
const API_ROOT = 'https://www.edsm.net/api-system-v1/';
const BODY_URL = `${API_ROOT}bodies?systemName=${encodeURIComponent(SYSTEM_NAME)}`;
const STATION_URL = `${API_ROOT}stations?systemName=${encodeURIComponent(SYSTEM_NAME)}`;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Only names present in the EDSM station snapshot are enriched. The source
// screenshots also contain proposed facilities; those are deliberately omitted.
const PLAN_ASSOCIATIONS = {
  'Verquerre Astrophysics Site': [3, '1B2FDA68-681D-416D-9B6F-D86FA9E2758D.png'],
  'Saturn Ascending': [20, '1B2FDA68-681D-416D-9B6F-D86FA9E2758D.png'],
  'Ladipo Munitions Stockade': [20, '1B2FDA68-681D-416D-9B6F-D86FA9E2758D.png'],
  'Haxel City': [23, 'BE03F73C-9EC0-4186-A721-CAF9A1F72B97.png'],
  'Griffin Hospitality Resort': [23, 'BE03F73C-9EC0-4186-A721-CAF9A1F72B97.png'],
  'Huntley Tourism Lodge': [23, 'BE03F73C-9EC0-4186-A721-CAF9A1F72B97.png'],
  'Drexler Prospect': [38, 'BE03F73C-9EC0-4186-A721-CAF9A1F72B97.png'],
  'Sherlock Engineering': [57, '7C46A5FC-CEDD-42F7-ADF6-C9979BF5560F.png'],
  'Eon Blue Apocalypse': [90, '8D41A6BE-60A0-4925-AB20-C90AEE4BA90E.png'],
  'Xie Cultivations': [85, '4D66F351-89AB-4E4D-82EF-776F2BAD72E0.png'],
  'Mendez Entertainment Resort': [92, '8D41A6BE-60A0-4925-AB20-C90AEE4BA90E.png'],
  'Rivera Leisure Resort': [92, '8D41A6BE-60A0-4925-AB20-C90AEE4BA90E.png'],
  'Kava Leisure Site': [92, '8D41A6BE-60A0-4925-AB20-C90AEE4BA90E.png'],
};

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parentEntry(value) {
  if (!value || typeof value !== 'object') throw new Error('Malformed EDSM parent');
  const entries = Object.entries(value);
  if (entries.length !== 1 || !Number.isInteger(entries[0][1])) throw new Error('Malformed EDSM parent ID');
  return { type:entries[0][0], id:entries[0][1] };
}

function normalizeRings(rows, bodyId, prefix='ring') {
  return (Array.isArray(rows) ? rows : []).map((ring, index) => ({
    id:`${bodyId}-${prefix}-${index + 1}`,
    name:ring.name,
    type:ring.type,
    innerRadiusKm:finite(ring.innerRadius),
    outerRadiusKm:finite(ring.outerRadius),
  }));
}

export function normalizeEDSMSystem(bodySnapshot, stationSnapshot, retrievedAt, spanshBodies=[]) {
  if (bodySnapshot?.name !== SYSTEM_NAME || stationSnapshot?.name !== SYSTEM_NAME) throw new Error('Snapshot system name does not match 10-16');
  if (!Array.isArray(bodySnapshot.bodies) || !bodySnapshot.bodies.length || !Array.isArray(stationSnapshot.stations)) throw new Error('Incomplete EDSM snapshots');
  const rawBodies = bodySnapshot.bodies;
  const knownIds = new Set(rawBodies.map(body => body.bodyId));
  if (knownIds.size !== rawBodies.length || !rawBodies.every(body => Number.isInteger(body.bodyId) && body.name)) throw new Error('Duplicate or invalid body IDs');
  const physicalIds = new Map(rawBodies.map(body => [body.id, `body-${body.bodyId}`]));
  const nameIds = new Map(rawBodies.map(body => [body.name, `body-${body.bodyId}`]));
  const missingBarycentres = new Map();
  const bodies = rawBodies.map(body => {
    const id = `body-${body.bodyId}`;
    const ancestry = (Array.isArray(body.parents) ? body.parents : []).map(parentEntry);
    ancestry.forEach((parent, index) => {
      if (knownIds.has(parent.id)) return;
      if (parent.type !== 'Null') throw new Error(`Missing physical parent ${parent.id}`);
      const parentId = ancestry[index + 1] ? `body-${ancestry[index + 1].id}` : null;
      const existing = missingBarycentres.get(parent.id);
      if (existing && existing.parentId !== parentId) throw new Error(`Inconsistent barycentre parent ${parent.id}`);
      missingBarycentres.set(parent.id, { id:parent.id, parentId });
    });
    const hasPlanetAncestor = ancestry.some(parent => parent.type === 'Planet');
    return {
      id,
      bodyId:body.bodyId,
      name:body.name,
      shortName:body.name === SYSTEM_NAME ? 'Primary star' : body.name.slice(SYSTEM_NAME.length).trim(),
      kind:body.type === 'Star' ? 'star' : hasPlanetAncestor ? 'moon' : 'planet',
      parentId:ancestry[0] ? `body-${ancestry[0].id}` : null,
      subType:body.subType,
      radiusKm:body.type === 'Star' ? (finite(body.solarRadius) === null ? null : body.solarRadius * 695700) : finite(body.radius),
      solarRadius:finite(body.solarRadius),
      isLandable:body.isLandable === true,
      isScoopable:body.isScoopable === true,
      gravity:finite(body.gravity),
      temperatureK:finite(body.surfaceTemperature),
      distanceToArrivalLs:finite(body.distanceToArrival),
      atmosphere:body.atmosphereType || null,
      volcanism:body.volcanismType || null,
      orbit:{
        semiMajorAxisAu:finite(body.semiMajorAxis),
        periodDays:finite(body.orbitalPeriod),
        eccentricity:finite(body.orbitalEccentricity),
        inclinationDeg:finite(body.orbitalInclination),
        argOfPeriapsisDeg:finite(body.argOfPeriapsis),
      },
      rings:normalizeRings(body.rings, id),
      belts:normalizeRings(body.belts, id, 'belt'),
      materials:Object.entries(body.materials || {}).map(([name, percentage]) => ({ name, percentage:finite(percentage) })),
      sourceUpdatedAt:body.updateTime || null,
    };
  });

  for (const missing of missingBarycentres.values()) {
    const id = `body-${missing.id}`;
    const children = bodies.filter(body => body.parentId === id);
    const shortName = children.map(body => body.shortName).join(' / ');
    bodies.push({
      id,
      bodyId:missing.id,
      name:`${SYSTEM_NAME} ${shortName} barycentre`,
      shortName:`${shortName} barycentre`,
      kind:'barycentre',
      parentId:missing.parentId,
      subType:'Shared orbital centre',
      radiusKm:null,
      isLandable:false,
      distanceToArrivalLs:null,
      displayDistanceHintLs:children.reduce((total, child) => total + (child.distanceToArrivalLs || 0), 0) / children.length,
      orbit:{ semiMajorAxisAu:null, periodDays:null, eccentricity:null, inclinationDeg:null, argOfPeriapsisDeg:null },
      rings:[],
      belts:[],
      materials:[],
      notes:'Parent relationship is recorded by EDSM. Barycentre orbital elements are absent; its display orbit uses schematic spacing.',
      sourceUpdatedAt:null,
    });
  }
  bodies.sort((a,b) => a.bodyId - b.bodyId);

  const spanshStations = new Map();
  const hotspotLocations = [];
  for (const entry of spanshBodies) {
    const record = entry.record;
    if (!record || record.system_name !== SYSTEM_NAME || !knownIds.has(record.body_id)) throw new Error('Spansh body does not match the system snapshot');
    const body = bodies.find(row => row.bodyId === record.body_id);
    if (body.name !== record.name) throw new Error('Spansh body name does not match EDSM');
    // The wrapper retains large id64 values as decimal strings. Do not convert
    // these IDs to Number: body addresses exceed JavaScript's safe integer range.
    const source = { name:'Spansh body database', url:`https://spansh.co.uk/api/body/${entry.id64}`, retrievedAt };
    body.signals = (record.signals || []).map(signal => ({name:signal.name,count:signal.count}));
    body.signalsUpdatedAt = record.signals_updated_at || null;
    body.signalSource = source;
    for (const station of record.stations || []) {
      if (station.market_id) spanshStations.set(station.market_id,{ bodyId:body.id, source });
    }
    for (const rawRing of record.rings || []) {
      const ring = body.rings.find(row => row.name === rawRing.name);
      if (!ring) throw new Error(`Spansh ring is absent from EDSM: ${rawRing.name}`);
      for (const signal of rawRing.signals || []) {
        if (!signal.name || !Number.isInteger(signal.count) || signal.count <= 0) continue;
        hotspotLocations.push({
          id:`${ring.id}-hotspot-${signal.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
          name:`${signal.name} hotspots · ${ring.name.slice(SYSTEM_NAME.length).trim()}`,
          kind:'ring-hotspot',
          bodyId:body.id,
          ringId:ring.id,
          latitude:null,
          longitude:null,
          commodities:[signal.name],
          hotspotCount:signal.count,
          notes:`${signal.count} ${signal.name} hotspot signal${signal.count === 1 ? '' : 's'} reported in this ring. Exact hotspot positions and overlap geometry are unavailable; this record represents a ring survey, not a measured individual marker. Use the DSS to locate hotspots in game.`,
          positionKnown:true,
          coordinatesKnown:false,
          positionPrecision:'ring',
          source,
          sourceUpdatedAt:rawRing.signals_updated_at || record.updated_at || null,
        });
      }
    }
  }

  const locations = stationSnapshot.stations.map(station => {
    const edsmParent = physicalIds.get(station.body?.id) || nameIds.get(station.body?.name) || null;
    const spanshAssociation = spanshStations.get(station.marketId);
    const canonicalName = station.name.replace(/^(Planetary|Orbital) Construction Site:\s*/i, '');
    const plan = PLAN_ASSOCIATIONS[canonicalName];
    const parentId = edsmParent || spanshAssociation?.bodyId || (plan && knownIds.has(plan[0]) ? `body-${plan[0]}` : null);
    const planSource = !edsmParent && !spanshAssociation && parentId ? {
      name:'Mongrel SRVSurvey plan screenshot',
      reference:`sources/${plan[1]}`,
      notes:'User-supplied plan confirms the body association; screenshot has no capture date. Current completion state is taken only from the EDSM snapshot.',
    } : null;
    const notes = [];
    if (!edsmParent && spanshAssociation) notes.push('Body association is independently recorded by the Spansh body database; the EDSM station snapshot has no associated body.');
    if (planSource) notes.push('Body association comes from the Mongrel SRVSurvey plan; the public EDSM snapshot has no associated body.');
    if (!parentId) notes.push('Associated body is not recorded in this snapshot. This location is listed without a 3D marker.');
    else notes.push('Associated body is known; exact surface coordinates or station orbital position are not recorded. Map marker is schematic.');
    if (/construction site/i.test(station.name)) notes.push('EDSM identifies a construction site. Its completion state may lag in-game progress.');
    if (canonicalName === 'Eon Blue Apocalypse') notes.push('The supplied Mongrel plan showed this as an active build. EDSM now lists an Orbis Starport; consult current in-game status.');
    if (station.type === 'Fleet Carrier') notes.push('Fleet carriers can move; this is a dated location snapshot.');
    return {
      id:`edsm-station-${station.id}`,
      name:station.name,
      kind:station.type === 'Fleet Carrier' ? 'carrier' : /settlement/i.test(station.type || '') ? 'settlement' : /installation/i.test(station.type || '') ? 'installation' : 'station',
      bodyId:parentId,
      type:station.type || (/Planetary Construction/i.test(station.name) ? 'Planetary construction site' : /Orbital Construction/i.test(station.name) ? 'Orbital construction site' : 'Unknown installation type'),
      latitude:null,
      longitude:null,
      commodities:[],
      notes:notes.join(' '),
      distanceToArrivalLs:finite(station.distanceToArrival),
      positionKnown:Boolean(parentId),
      coordinatesKnown:false,
      marketId:station.marketId || null,
      economy:station.economy || null,
      controllingFaction:station.controllingFaction?.name || null,
      services:[...(station.haveMarket ? ['Market'] : []), ...(station.haveShipyard ? ['Shipyard'] : []), ...(station.haveOutfitting ? ['Outfitting'] : []), ...(station.otherServices || [])],
      source:{ name:'EDSM stations API', url:STATION_URL, retrievedAt },
      ...(!edsmParent && spanshAssociation ? { associationSource:spanshAssociation.source } : planSource ? { associationSource:planSource } : {}),
      sourceUpdatedAt:station.updateTime?.information || null,
    };
  });

  return {
    schemaVersion:1,
    id:SYSTEM_ID,
    name:SYSTEM_NAME,
    edsmId:bodySnapshot.id,
    id64:String(bodySnapshot.id64),
    sources:[
      { name:'EDSM celestial bodies API', url:BODY_URL, retrievedAt },
      { name:'EDSM stations API', url:STATION_URL, retrievedAt },
      ...(spanshBodies.length ? [{ name:'Spansh celestial body surveys', url:`https://spansh.co.uk/system/${bodySnapshot.id64}`, retrievedAt, notes:'Station associations and ring hotspot counts are taken from matching body records. Source survey timestamps are retained.' }] : []),
      { name:'Mongrel SRVSurvey colonization plan', reference:'ChatGPT Elite Dangerous project sources/*.png', retrievedAt, notes:'Used only when both public providers lack a body association for an exact matching EDSM station name; proposed NATO-named facilities are excluded.' },
    ],
    notes:[
      'Sizes and orbit spacing are visually compressed by the renderer. Positions are schematic, not live ephemerides.',
      'Four shared barycentres are preserved from EDSM parent chains; their unreported orbital elements remain null.',
      'No confirmed surface mining coordinates were present in the inspected repository or supplied plan screenshots. Raw material percentages are body composition data, not commodity deposits. Ring hotspot records report commodity signal counts; exact positions and overlaps are unknown.',
      'Mongrel surface sites on the separate personal website should be supplied through a reusable canonical location document shared by both websites, rather than copied into this celestial snapshot.',
    ],
    bodies,
    locations:[...locations,...hotspotLocations],
  };
}

async function readSnapshot(path, url) {
  if (path) return JSON.parse((await readFile(resolve(path), 'utf8')).replace(/^\uFEFF/, ''));
  const response = await fetch(url, { headers:{ Accept:'application/json' }, signal:AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`EDSM request failed (${response.status}): ${url}`);
  return response.json();
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let index=0; index<args.length; index+=2) {
    const name = args[index];
    if (!['--bodies','--stations','--spansh-bodies','--output','--retrieved-at'].includes(name) || !args[index+1]) throw new Error('Usage: node scripts/import-orrery-edsm.mjs [--bodies file --stations file --spansh-bodies file] [--retrieved-at ISO-date] [--output file]');
    options[name] = args[index+1];
  }
  if (Boolean(options['--bodies']) !== Boolean(options['--stations'])) throw new Error('Provide both body and station snapshots for an offline import');
  const retrievedAt = options['--retrieved-at'] || new Date().toISOString();
  if (Number.isNaN(Date.parse(retrievedAt))) throw new Error('Invalid retrieval timestamp');
  const [bodySnapshot, stationSnapshot] = await Promise.all([
    readSnapshot(options['--bodies'], BODY_URL),
    readSnapshot(options['--stations'], STATION_URL),
  ]);
  let spanshBodies = [];
  if (options['--spansh-bodies']) spanshBodies = await readSnapshot(options['--spansh-bodies']);
  else if (!options['--bodies']) {
    // Source body IDs are read as decimal strings to avoid rounded endpoint IDs.
    const response = await fetch(`https://spansh.co.uk/api/system/${bodySnapshot.id64}`,{ signal:AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Spansh system request failed (${response.status})`);
    const exactJSON = (await response.text()).replace(/("(?:id|id64)"\s*:\s*)(\d+)/g,'$1"$2"');
    const spanshSystem = JSON.parse(exactJSON);
    if (spanshSystem.record?.name !== SYSTEM_NAME) throw new Error('Spansh system mismatch');
    const references = spanshSystem.record.bodies;
    // A small bounded batch avoids hammering the community API.
    for (let offset=0; offset<references.length; offset+=4) {
      const rows = await Promise.all(references.slice(offset,offset+4).map(async reference => ({id64:reference.id64,record:(await readSnapshot(null,`https://spansh.co.uk/api/body/${reference.id64}`)).record})));
      spanshBodies.push(...rows);
    }
  }
  const data = normalizeEDSMSystem(bodySnapshot, stationSnapshot, retrievedAt, spanshBodies);
  const output = options['--output'] ? resolve(options['--output']) : resolve(REPO_ROOT, 'data/orrery', `${SYSTEM_ID}.json`);
  await mkdir(dirname(output), { recursive:true });
  await writeFile(output, `${JSON.stringify(data,null,2)}\n`, 'utf8');
  console.log(`Imported ${data.bodies.length} hierarchy nodes and ${data.locations.length} locations into ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
