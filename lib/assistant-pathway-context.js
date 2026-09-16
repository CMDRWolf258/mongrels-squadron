import { AX_ACTIVITY_ID, eligibleAxRoutes, getAxRoute } from './pathway-ax.js';
import { BGS_ACTIVITY_ID, eligibleBgsRoutes, getBgsRoute } from './pathway-bgs.js';
import { MINING_ACTIVITY_ID, eligibleMiningRoutes, getMiningRoute } from './pathway-mining.js';
import { TRADE_ACTIVITY_ID, eligibleTradeRoutes, getTradeRoute } from './pathway-trade.js';
import { CARRIER_LOGISTICS_ACTIVITY_ID, eligibleCarrierLogisticsRoutes, getCarrierLogisticsRoute } from './pathway-carrier-logistics.js';
import { ENGINEERING_ACTIVITY_ID, eligibleEngineeringRoutes, getEngineeringRoute } from './pathway-engineering.js';
import {
  ENGINEERING_CAMPAIGN_KEY_PREFIX,
  normalizeEngineeringCampaignState,
  buildEngineeringCampaignView,
} from './engineering-campaign.js';
import { buildEngineeringDependencyNodes } from './engineering-campaign-data.js';
import { buildShieldEngineeringDependencyNodes } from './engineering-campaign-shields.js';
import { buildJumpRangeEngineeringDependencyNodes } from './engineering-campaign-jump-range.js';
import { buildMobilityEngineeringDependencyNodes } from './engineering-campaign-mobility.js';
import { buildDistributorEngineeringDependencyNodes } from './engineering-campaign-distributor.js';
import { engineeringPrepForTask } from './pathway-engineering-prep.js';
import {
  CG_HAULER_PREP_KEY_PREFIX,
  normalizeCgHaulerPrepState,
  buildCgHaulerPrepView,
} from './pathway-cg-hauler-prep.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);
const PREFERENCES_PREFIX = 'pathway-preferences-v1:';
const PROGRESS_PREFIX = 'pathway-progress-v1:';
const CREDITED = new Set(['complete','known']);
const VALID_STATUS = new Set(['complete','known','skipped','pending']);

const PROVIDERS = {
  [AX_ACTIVITY_ID]: {
    label:'Anti-Xeno',
    seedVersion:'ax-v2',
    eligibleRoutes:eligibleAxRoutes,
    getRoute:getAxRoute,
    keywords:['anti-xeno','anti xeno','ax pathway','ax assignment'],
  },
  [BGS_ACTIVITY_ID]: {
    label:'Background Simulation',
    seedVersion:'bgs-v1',
    eligibleRoutes:eligibleBgsRoutes,
    getRoute:getBgsRoute,
    keywords:['background simulation','bgs pathway','bgs assignment'],
  },
  [MINING_ACTIVITY_ID]: {
    label:'Mining',
    seedVersion:'mining-v1',
    eligibleRoutes:eligibleMiningRoutes,
    getRoute:getMiningRoute,
    keywords:['mining pathway','mining assignment','my mining'],
  },
  [TRADE_ACTIVITY_ID]: {
    label:'Trade & Hauling',
    seedVersion:'trade-v2',
    eligibleRoutes:eligibleTradeRoutes,
    getRoute:getTradeRoute,
    keywords:['trade pathway','trade assignment','hauling pathway','hauling assignment','my trade'],
  },
  [CARRIER_LOGISTICS_ACTIVITY_ID]: {
    label:'Carrier Logistics',
    seedVersion:'carrier-logistics-v1',
    eligibleRoutes:eligibleCarrierLogisticsRoutes,
    getRoute:getCarrierLogisticsRoute,
    keywords:['carrier logistics pathway','carrier logistics assignment','my carrier logistics'],
  },
  [ENGINEERING_ACTIVITY_ID]: {
    label:'Engineering & Shipbuilding',
    seedVersion:'engineering-v1',
    eligibleRoutes:eligibleEngineeringRoutes,
    getRoute:getEngineeringRoute,
    keywords:['engineering pathway','engineering assignment','my engineering','engineering task','engineering step','current engineering','my engineering step'],
  },
};

const ACTIVITY_LABELS = {
  pve:'PvE Combat',
  pvp:'PvP',
  ax:'Anti-Xeno',
  surface:'Surface Operations',
  mining:'Mining',
  trade:'Trade & Hauling',
  'carrier-logistics':'Carrier Logistics',
  engineering:'Engineering & Shipbuilding',
  exploration:'Exploration',
  exobiology:'Exobiology',
  bgs:'Background Simulation',
  colonization:'Colonization',
  powerplay:'Powerplay',
  operations:'Squad Operations',
};

export function assistantPathwayIntent(message) {
  const query = String(message || '').toLowerCase();
  if (!query) return false;
  return [
    'my pathway','pathway assignment','pathway task','pathway progress','current assignment','current task','my task','my assignment',
    'what am i working on','what should i work on next','what should i do next','this task','this assignment','this step','current step',
    'campaign planner','engineering campaign','shield campaign','improve shields','jump range campaign','improve jump range','my jump range',
    'mobility campaign','improve speed','improve mobility','speed and mobility','my thrusters','thrusters campaign',
    'power distributor campaign','improve power distributor','my distributor','distributor campaign','capacitor campaign',
    'community goal hauler','cg hauler','hauler prep','hostile hauling','hostile delivery','interdiction drill','escape drill','my hauler task',
    'prep tracker','engineering prep','help engineering','help with engineering','does this help engineering','how do i do this','how do i complete this',
    'why am i doing this','help with this task','help with my task','help with my assignment',
  ].some(term => query.includes(term)) || Object.values(PROVIDERS).some(provider => provider.keywords.some(term => query.includes(term)));
}

export async function buildAssistantPathwayContext(env, session, message) {
  if (!assistantPathwayIntent(message)) return null;
  if (!session?.sub || !MEMBER_ACCESS.has(session.access)) return null;
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function') return null;

  const query = String(message || '').toLowerCase();
  const preferences = await readJson(env.PROJECTS, `${PREFERENCES_PREFIX}${session.sub}`, {});
  const selectedIds = [...new Set([
    ...(Array.isArray(preferences?.interests) ? preferences.interests : []),
    ...(Array.isArray(preferences?.improve) ? preferences.improve : []),
  ])];
  const requested = requestedActivities(query);
  const fullSelected = selectedIds.filter(id => PROVIDERS[id]);
  const activityIds = requested.length ? requested.filter(id => selectedIds.includes(id)) : fullSelected;

  const assignments = [];
  for (const activity of activityIds.slice(0, 6)) {
    const summary = await buildAssignmentSummary(env.PROJECTS, session.sub, preferences, activity);
    if (summary) assignments.push(summary);
  }

  const wantsEngineeringCampaign = requested.includes(ENGINEERING_ACTIVITY_ID)
    || /campaign|shield|engineering|jump range|\bfsd\b|mobility|thrusters|dirty drives|clean drives|power distributor|\bdistributor\b|capacitor|current step|this step|prep tracker/.test(query)
    || requested.length === 0;
  const engineeringCampaign = wantsEngineeringCampaign
    ? await buildEngineeringCampaignSummary(env.PROJECTS, session.sub)
    : null;

  const communityGoalHaulerPrep = cgHaulerIntent(query)
    ? await buildCgHaulerPrepSummary(env.PROJECTS, session.sub)
    : null;

  return {
    authority:'Read-only personalized context. My Pathway and specialty/campaign surfaces remain authoritative for saved progress and completion.',
    currentGoal:typeof preferences?.currentGoal === 'string' ? preferences.currentGoal : '',
    playStyle:typeof preferences?.playStyle === 'string' ? preferences.playStyle : 'either',
    selectedActivities:selectedIds.map(id => ({
      id,
      label:ACTIVITY_LABELS[id] || id,
      priority:Array.isArray(preferences?.improve) && preferences.improve.includes(id) ? 'want_to_improve' : 'interested',
      experience:normalizeExperience(preferences?.experience?.[id]),
    })),
    assignments,
    engineeringCampaign,
    specialties:communityGoalHaulerPrep ? { communityGoalHaulerPrep } : null,
  };
}

async function buildAssignmentSummary(storage, ownerId, preferences, activity) {
  const provider = PROVIDERS[activity];
  if (!provider) return null;
  const experience = normalizeExperience(preferences?.experience?.[activity]);
  const eligible = provider.eligibleRoutes(experience);
  const choices = routeChoicesFor(activity, experience, eligible);
  if (!choices.length) return null;

  const saved = await readJson(storage, `${PROGRESS_PREFIX}${ownerId}:${activity}`, {});
  const selectedRoute = choices.includes(saved?.selectedRoute)
    ? saved.selectedRoute
    : chooseInitialRoute(ownerId, experience, choices, provider.seedVersion);
  const route = provider.getRoute(selectedRoute) || provider.getRoute(choices[0]);
  if (!route || !Array.isArray(route.tasks)) return null;

  const taskStates = saved?.routes?.[route.id]?.taskStates && typeof saved.routes[route.id].taskStates === 'object'
    ? saved.routes[route.id].taskStates
    : {};
  const tasks = route.tasks.map((task, index) => {
    const stored = taskStates[task.id];
    return {
      ...task,
      index:index + 1,
      status:VALID_STATUS.has(stored) ? stored : 'pending',
    };
  });
  const current = tasks.find(task => task.status === 'pending') || tasks.find(task => task.status === 'skipped') || null;
  const completed = tasks.filter(task => CREDITED.has(task.status)).length;
  const currentEngineeringPrep = current ? engineeringPrepForTask(activity, current.id) : [];

  return {
    activity,
    label:provider.label,
    experience,
    route:{ id:route.id, title:route.title, band:route.band || '' },
    progress:{ completed, total:tasks.length, percent:tasks.length ? Math.round((completed / tasks.length) * 100) : 0 },
    currentTask:current ? {
      id:current.id,
      index:current.index,
      status:current.status,
      stage:current.stage || '',
      type:current.type || '',
      title:current.title || '',
      objective:current.objective || '',
      why:current.why || '',
      checklist:Array.isArray(current.checklist) ? current.checklist.slice(0, 8) : [],
      resource:current.link?.url ? { label:current.link.label || 'Resource', url:current.link.url } : null,
      engineeringPrep:currentEngineeringPrep.slice(0, 3).map(item => ({
        factId:item.factId,
        label:item.label,
        prompt:item.prompt,
        target:item.target || null,
        unit:item.unit || '',
        note:item.note || '',
        resource:item.resourceUrl ? { label:item.resourceLabel || 'Engineer reference', url:item.resourceUrl } : null,
      })),
    } : null,
  };
}

async function buildEngineeringCampaignSummary(storage, ownerId) {
  const raw = await readJson(storage, `${ENGINEERING_CAMPAIGN_KEY_PREFIX}${ownerId}`, null);
  const state = normalizeEngineeringCampaignState(raw, ownerId);
  const active = state.activeCampaignId ? state.campaigns[state.activeCampaignId] : null;
  if (!active) return { active:false };

  const dependencyNodes = [
    ...buildEngineeringDependencyNodes({ campaign:active, facts:state.facts }),
    ...buildShieldEngineeringDependencyNodes({ campaign:active, facts:state.facts }),
    ...buildJumpRangeEngineeringDependencyNodes({ campaign:active, facts:state.facts }),
    ...buildMobilityEngineeringDependencyNodes({ campaign:active, facts:state.facts }),
    ...buildDistributorEngineeringDependencyNodes({ campaign:active, facts:state.facts }),
  ];
  const planner = buildEngineeringCampaignView(state, dependencyNodes);
  const nodes = Array.isArray(planner.nodes) ? planner.nodes : [];
  const completed = nodes.filter(node => node.status === 'complete').length;
  const current = planner.nextMain;

  return {
    active:true,
    goal:planner.campaign?.goal?.label || active.goalId || 'Engineering Campaign',
    shipName:active.shipName || '',
    targetNotes:active.targetNotes || '',
    progress:{ completed, total:nodes.length, percent:nodes.length ? Math.round((completed / nodes.length) * 100) : 0 },
    nextStep:current ? summarizeCampaignStep(current, state.facts) : null,
    stoppingPointReached:nodes.some(node => node.status === 'complete' && node.meta?.readyToFinish),
  };
}

async function buildCgHaulerPrepSummary(storage, ownerId) {
  const raw = await readJson(storage, `${CG_HAULER_PREP_KEY_PREFIX}${ownerId}`, null);
  const state = normalizeCgHaulerPrepState(raw, ownerId);
  const view = buildCgHaulerPrepView(state);
  const current = view.current;
  return {
    active:!view.complete,
    title:view.title,
    doctrine:view.doctrine,
    progress:view.progress,
    currentTask:current ? {
      id:current.id,
      index:current.index,
      stage:current.stage || '',
      type:current.type || '',
      title:current.title || '',
      objective:current.objective || '',
      why:current.why || '',
      payoff:current.payoff || '',
      checklist:Array.isArray(current.checklist) ? current.checklist.slice(0, 8) : [],
    } : null,
  };
}

function summarizeCampaignStep(node, facts) {
  const meta = node?.meta || {};
  const output = {
    id:node.id,
    stage:meta.stage || node.kind || 'Campaign Step',
    title:node.title || '',
    objective:node.objective || '',
    requirement:meta.requirement || '',
    note:meta.note || '',
    stoppingPoint:meta.stoppingPoint || '',
    payoff:meta.payoff || '',
    resources:[],
  };
  if (meta.resourceUrl) output.resources.push({ label:meta.resourceLabel || 'Resource', url:meta.resourceUrl });
  if (Array.isArray(meta.secondaryResources)) {
    output.resources.push(...meta.secondaryResources.filter(item => item?.url).slice(0, 3).map(item => ({ label:item.label || 'Resource', url:item.url })));
  }
  const rule = node.factCompletion;
  if (rule?.operator === 'gte' && Number.isFinite(Number(rule.target))) {
    const currentRaw = facts?.[rule.factId]?.value;
    const current = Number.isFinite(Number(currentRaw)) ? Number(currentRaw) : 0;
    const target = Number(rule.target);
    output.trackedProgress = { current, target, remaining:Math.max(0, target - current) };
  }
  return output;
}

function cgHaulerIntent(query) {
  return /community goal hauler|\bcg hauler\b|hauler prep|hostile haul|hostile delivery|interdiction drill|escape drill|my hauler task|survive and deliver/.test(query);
}

function requestedActivities(query) {
  const matches = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    if (provider.keywords.some(term => query.includes(term))) matches.push(id);
  }
  if (/\bax\b/.test(query) && !matches.includes(AX_ACTIVITY_ID)) matches.push(AX_ACTIVITY_ID);
  if (/\bbgs\b/.test(query) && !matches.includes(BGS_ACTIVITY_ID)) matches.push(BGS_ACTIVITY_ID);
  if (/\bmining\b/.test(query) && !matches.includes(MINING_ACTIVITY_ID)) matches.push(MINING_ACTIVITY_ID);
  if (/\btrade\b|\bhauling\b|community goal hauler|\bcg hauler\b|hauler prep|hostile haul|hostile delivery/.test(query) && !matches.includes(TRADE_ACTIVITY_ID)) matches.push(TRADE_ACTIVITY_ID);
  if (/carrier logistics/.test(query) && !matches.includes(CARRIER_LOGISTICS_ACTIVITY_ID)) matches.push(CARRIER_LOGISTICS_ACTIVITY_ID);
  if (/\bengineering\b|shield campaign|improve shields|jump range campaign|improve jump range|\bfsd\b|mobility campaign|improve mobility|improve speed|thrusters|dirty drives|clean drives|power distributor|\bdistributor\b|capacitor campaign|campaign planner/.test(query) && !matches.includes(ENGINEERING_ACTIVITY_ID)) matches.push(ENGINEERING_ACTIVITY_ID);
  return [...new Set(matches)];
}

function routeChoicesFor(activity, experience, eligible) {
  if (activity !== ENGINEERING_ACTIVITY_ID) return eligible;
  if (experience === 'some') return ['engineering-role-builder','engineering-network'].filter(id => eligible.includes(id));
  if (experience === 'comfortable') return ['engineering-ship-architect','engineering-combat-systems','engineering-role-builder'].filter(id => eligible.includes(id));
  if (experience === 'experienced') return ['engineering-mentor','engineering-ship-architect'].filter(id => eligible.includes(id));
  return eligible;
}

function chooseInitialRoute(ownerId, experience, eligible, seedVersion) {
  if (!eligible.length) return '';
  const seed = `${ownerId}:${experience}:${seedVersion}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  return eligible[Math.abs(hash) % eligible.length];
}

function normalizeExperience(value) {
  return ['new','some','comfortable','experienced'].includes(value) ? value : 'new';
}

async function readJson(namespace, key, fallback) {
  try {
    const value = await namespace.get(key, { type:'json' });
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
