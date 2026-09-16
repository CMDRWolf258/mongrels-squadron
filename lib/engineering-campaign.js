export const ENGINEERING_CAMPAIGN_VERSION = 1;
export const ENGINEERING_CAMPAIGN_KEY_PREFIX = 'engineering-campaign-v1:';

export const ENGINEERING_GOAL_CATALOG = [
  { id:'shields', label:'Improve Shields', group:'Defense', description:'Improve shield strength, resistance, recovery, or the shield package for a specific ship role.' },
  { id:'jump-range', label:'Improve Jump Range', group:'Travel', description:'Improve travel performance without losing sight of the ship’s primary job.' },
  { id:'mobility', label:'Improve Speed & Mobility', group:'Core', description:'Improve thrusters, boost behavior, handling, or movement performance.' },
  { id:'distributor', label:'Improve Power Distributor', group:'Core', description:'Improve SYS / ENG / WEP sustain around the ship’s real workload.' },
  { id:'power-thermal', label:'Improve Power & Heat', group:'Core', description:'Solve power-budget or heat problems without over-engineering the plant by default.' },
  { id:'weapons', label:'Improve Weapon Package', group:'Combat', description:'Improve weapon performance and experimental-effect synergy as a package.' },
  { id:'whole-ship', label:'Finish a Role Build', group:'Shipbuilding', description:'Work toward a coherent engineered ship whose systems support one defined role.' },
];

const GOAL_IDS = new Set(ENGINEERING_GOAL_CATALOG.map(goal => goal.id));
const FACT_ID_RE = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
const NODE_ID_RE = /^[a-z0-9][a-z0-9._:-]{0,159}$/;

// These setup nodes are intentionally generic. Goal-specific engineer chains are added
// as data-driven dependency nodes later instead of hard-coding unlock logic into the UI.
const CAMPAIGN_SETUP_NODES = [
  {
    id:'campaign.assess-current',
    kind:'assess',
    title:'Record where the ship is now',
    objective:'Record the current module, current engineering grade if any, and the behavior you want to improve.',
    dependsOn:[],
  },
  {
    id:'campaign.choose-target',
    kind:'plan',
    title:'Choose the next useful stopping point',
    objective:'Choose a realistic next engineering stopping point instead of treating G5 as the only meaningful result.',
    dependsOn:['campaign.assess-current'],
  },
  {
    id:'campaign.map-dependencies',
    kind:'plan',
    title:'Map only the dependencies between here and there',
    objective:'Identify the engineer access, reputation, prerequisite counters, deliveries, or other gates needed for the next useful stopping point.',
    dependsOn:['campaign.choose-target'],
  },
  {
    id:'campaign.plan-materials',
    kind:'plan',
    title:'Plan the exact material requirement',
    objective:'Use an engineering planning resource such as Inara to calculate the materials needed for the intended grades before gathering anything.',
    dependsOn:['campaign.map-dependencies'],
    resourceHint:'inara-engineering',
  },
];

export function createEmptyEngineeringCampaignState(ownerId = '') {
  return {
    version:ENGINEERING_CAMPAIGN_VERSION,
    ownerId:String(ownerId || ''),
    activeCampaignId:'',
    campaigns:{},
    facts:{},
    updatedAt:null,
  };
}

export function normalizeEngineeringCampaignState(value, ownerId = '') {
  const source = value && typeof value === 'object' ? value : {};
  const state = createEmptyEngineeringCampaignState(ownerId || source.ownerId || '');
  const campaigns = source.campaigns && typeof source.campaigns === 'object' ? source.campaigns : {};
  for (const [id, raw] of Object.entries(campaigns)) {
    if (!raw || typeof raw !== 'object') continue;
    const goalId = cleanGoalId(raw.goalId);
    if (!goalId) continue;
    const campaignId = cleanId(id, NODE_ID_RE, 160);
    if (!campaignId) continue;
    const completedNodes = {};
    const rawCompleted = raw.completedNodes && typeof raw.completedNodes === 'object' ? raw.completedNodes : {};
    for (const [nodeId, completion] of Object.entries(rawCompleted)) {
      const cleanNodeId = cleanId(nodeId, NODE_ID_RE, 160);
      if (!cleanNodeId) continue;
      completedNodes[cleanNodeId] = {
        completedAt:cleanText(completion?.completedAt, 64),
        source:cleanText(completion?.source, 32) || 'manual',
      };
    }
    state.campaigns[campaignId] = {
      id:campaignId,
      goalId,
      shipName:cleanText(raw.shipName, 120),
      targetNotes:cleanText(raw.targetNotes, 500),
      status:['active','paused','complete','archived'].includes(raw.status) ? raw.status : 'active',
      completedNodes,
      createdAt:cleanText(raw.createdAt, 64),
      updatedAt:cleanText(raw.updatedAt, 64),
    };
  }

  const facts = source.facts && typeof source.facts === 'object' ? source.facts : {};
  for (const [factId, raw] of Object.entries(facts)) {
    const cleanFactId = cleanId(factId, FACT_ID_RE, 120);
    if (!cleanFactId || !raw || typeof raw !== 'object') continue;
    const value = normalizeFactValue(raw.value);
    if (value === undefined) continue;
    state.facts[cleanFactId] = {
      value,
      source:cleanText(raw.source, 32) || 'manual',
      updatedAt:cleanText(raw.updatedAt, 64),
    };
  }

  const activeId = cleanId(source.activeCampaignId, NODE_ID_RE, 160);
  state.activeCampaignId = activeId && state.campaigns[activeId] && state.campaigns[activeId].status !== 'archived' ? activeId : '';
  state.updatedAt = cleanText(source.updatedAt, 64);
  return state;
}

export function startEngineeringCampaign(stateValue, { goalId, shipName = '', targetNotes = '' } = {}, now = new Date().toISOString()) {
  const state = normalizeEngineeringCampaignState(stateValue);
  const cleanGoal = cleanGoalId(goalId);
  if (!cleanGoal) throw new Error('invalid_goal');
  if (state.activeCampaignId && state.campaigns[state.activeCampaignId]) {
    state.campaigns[state.activeCampaignId].status = 'paused';
    state.campaigns[state.activeCampaignId].updatedAt = now;
  }
  const id = `eng-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  state.campaigns[id] = {
    id,
    goalId:cleanGoal,
    shipName:cleanText(shipName, 120),
    targetNotes:cleanText(targetNotes, 500),
    status:'active',
    completedNodes:{},
    createdAt:now,
    updatedAt:now,
  };
  state.activeCampaignId = id;
  state.updatedAt = now;
  return state;
}

export function setEngineeringFact(stateValue, factId, value, source = 'manual', now = new Date().toISOString()) {
  const state = normalizeEngineeringCampaignState(stateValue);
  const cleanFactId = cleanId(factId, FACT_ID_RE, 120);
  const cleanValue = normalizeFactValue(value);
  if (!cleanFactId || cleanValue === undefined) throw new Error('invalid_fact');
  state.facts[cleanFactId] = { value:cleanValue, source:cleanText(source, 32) || 'manual', updatedAt:now };
  state.updatedAt = now;
  return state;
}

export function clearEngineeringFact(stateValue, factId, now = new Date().toISOString()) {
  const state = normalizeEngineeringCampaignState(stateValue);
  const cleanFactId = cleanId(factId, FACT_ID_RE, 120);
  if (!cleanFactId) throw new Error('invalid_fact');
  delete state.facts[cleanFactId];
  state.updatedAt = now;
  return state;
}

export function setEngineeringNodeComplete(stateValue, campaignId, nodeId, complete = true, source = 'manual', now = new Date().toISOString()) {
  const state = normalizeEngineeringCampaignState(stateValue);
  const cleanCampaignId = cleanId(campaignId, NODE_ID_RE, 160);
  const cleanNodeId = cleanId(nodeId, NODE_ID_RE, 160);
  const campaign = cleanCampaignId ? state.campaigns[cleanCampaignId] : null;
  if (!campaign || !cleanNodeId) throw new Error('invalid_campaign_node');
  if (complete) campaign.completedNodes[cleanNodeId] = { completedAt:now, source:cleanText(source, 32) || 'manual' };
  else delete campaign.completedNodes[cleanNodeId];
  campaign.updatedAt = now;
  state.updatedAt = now;
  return state;
}

export function setEngineeringCampaignStatus(stateValue, campaignId, status, now = new Date().toISOString()) {
  const state = normalizeEngineeringCampaignState(stateValue);
  const cleanCampaignId = cleanId(campaignId, NODE_ID_RE, 160);
  const campaign = cleanCampaignId ? state.campaigns[cleanCampaignId] : null;
  if (!campaign || !['active','paused','complete','archived'].includes(status)) throw new Error('invalid_campaign_status');
  campaign.status = status;
  campaign.updatedAt = now;
  if (status === 'active') {
    if (state.activeCampaignId && state.activeCampaignId !== cleanCampaignId && state.campaigns[state.activeCampaignId]) {
      state.campaigns[state.activeCampaignId].status = 'paused';
      state.campaigns[state.activeCampaignId].updatedAt = now;
    }
    state.activeCampaignId = cleanCampaignId;
  } else if (state.activeCampaignId === cleanCampaignId) {
    state.activeCampaignId = '';
  }
  state.updatedAt = now;
  return state;
}

export function buildEngineeringCampaignView(stateValue, dependencyNodes = []) {
  const state = normalizeEngineeringCampaignState(stateValue);
  const campaign = state.activeCampaignId ? state.campaigns[state.activeCampaignId] : null;
  if (!campaign) {
    return { active:false, campaign:null, nodes:[], nextMain:null, backgroundPrepByActivity:{} };
  }
  const nodes = normalizeNodes([...CAMPAIGN_SETUP_NODES, ...(Array.isArray(dependencyNodes) ? dependencyNodes : [])]);
  const evaluated = nodes.map(node => evaluateNode(node, campaign, state.facts));
  const nextMain = evaluated.find(node => node.status !== 'complete' && node.dependenciesMet && !node.backgroundOnly) || null;
  const backgroundPrepByActivity = {};
  for (const node of evaluated) {
    if (node.status === 'complete' || !node.dependenciesMet) continue;
    for (const activity of node.backgroundActivities || []) {
      const opportunity = buildBackgroundOpportunity(node, state.facts);
      if (!opportunity) continue;
      if (!backgroundPrepByActivity[activity]) backgroundPrepByActivity[activity] = [];
      backgroundPrepByActivity[activity].push(opportunity);
    }
  }
  return {
    active:true,
    campaign:{ ...campaign, goal:ENGINEERING_GOAL_CATALOG.find(goal => goal.id === campaign.goalId) || null },
    nodes:evaluated,
    nextMain,
    backgroundPrepByActivity,
  };
}

export function getEngineeringPrepForActivity(stateValue, activity, dependencyNodes = [], limit = 2) {
  const view = buildEngineeringCampaignView(stateValue, dependencyNodes);
  return (view.backgroundPrepByActivity?.[String(activity || '')] || []).slice(0, Math.max(0, Math.min(10, Number(limit) || 2)));
}

function normalizeNodes(nodes) {
  const seen = new Set();
  const output = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanId(raw.id, NODE_ID_RE, 160);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const backgroundActivities = Array.isArray(raw.backgroundActivities)
      ? [...new Set(raw.backgroundActivities.map(item => cleanText(item, 64)).filter(Boolean))]
      : [];
    output.push({
      id,
      kind:cleanText(raw.kind, 40) || 'task',
      title:cleanText(raw.title, 180) || id,
      objective:cleanText(raw.objective, 800),
      dependsOn:Array.isArray(raw.dependsOn) ? raw.dependsOn.map(item => cleanId(item, NODE_ID_RE, 160)).filter(Boolean) : [],
      factCompletion:normalizeFactCompletion(raw.factCompletion),
      backgroundActivities,
      backgroundOnly:Boolean(raw.backgroundOnly),
      chunkSize:positiveNumber(raw.chunkSize),
      resourceHint:cleanText(raw.resourceHint, 80),
      meta:raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {},
    });
  }
  return output;
}

function evaluateNode(node, campaign, facts) {
  const manual = Boolean(campaign.completedNodes?.[node.id]);
  const automatic = node.factCompletion ? factSatisfied(node.factCompletion, facts) : false;
  const dependenciesMet = node.dependsOn.every(id => Boolean(campaign.completedNodes?.[id]) || false);
  return { ...node, status:(manual || automatic) ? 'complete' : 'pending', completionSource:manual ? campaign.completedNodes[node.id]?.source || 'manual' : automatic ? 'fact' : '', dependenciesMet };
}

function buildBackgroundOpportunity(node, facts) {
  const completion = node.factCompletion;
  if (!completion || completion.operator !== 'gte' || typeof completion.target !== 'number') {
    return { nodeId:node.id, title:node.title, objective:node.objective, kind:node.kind, resourceHint:node.resourceHint || '' };
  }
  const currentRaw = facts?.[completion.factId]?.value;
  const current = Number.isFinite(Number(currentRaw)) ? Number(currentRaw) : 0;
  const remaining = Math.max(0, completion.target - current);
  if (!remaining) return null;
  const suggested = node.chunkSize ? Math.min(remaining, node.chunkSize) : remaining;
  return {
    nodeId:node.id,
    title:node.title,
    objective:node.objective,
    kind:node.kind,
    progress:{ current, target:completion.target, remaining, suggested },
    resourceHint:node.resourceHint || '',
  };
}

function normalizeFactCompletion(value) {
  if (!value || typeof value !== 'object') return null;
  const factId = cleanId(value.factId, FACT_ID_RE, 120);
  const operator = ['truthy','eq','gte'].includes(value.operator) ? value.operator : '';
  if (!factId || !operator) return null;
  const target = normalizeFactValue(value.target);
  return { factId, operator, target };
}

function factSatisfied(rule, facts) {
  const value = facts?.[rule.factId]?.value;
  if (rule.operator === 'truthy') return Boolean(value);
  if (rule.operator === 'eq') return value === rule.target;
  if (rule.operator === 'gte') return Number.isFinite(Number(value)) && Number(value) >= Number(rule.target);
  return false;
}

function cleanGoalId(value) {
  const id = cleanText(value, 80);
  return GOAL_IDS.has(id) ? id : '';
}

function cleanId(value, pattern, max) {
  const id = cleanText(value, max);
  return id && pattern.test(id) ? id : '';
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeFactValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value.trim().slice(0, 300);
  return undefined;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
