import { json, readSession } from '../../../lib/auth.js';

const STORAGE_KEY = 'applications-v1';
const REVIEW_ACCESS = new Set(['officer', 'site_admin']);
const MEMBER_ACCESS = new Set(['member', 'officer', 'site_admin']);
const STATUSES = ['draft', 'submitted', 'under_review', 'accepted', 'declined'];
const EXPERIENCE = ['New Commander / Less than 6 months', '6 months–2 years', '2–5 years', '5+ years', 'Returning player'];
const ACTIVITIES = ['PvE Combat', 'PvP', 'Anti-Xeno', 'BGS', 'Trade / Hauling', 'Mining', 'Exploration', 'Exobiology', 'Colonization', 'Powerplay', 'Operations', 'Engineering / Shipbuilding', 'Other'];
const ACTIVE_TIMES = ['Morning', 'Afternoon', 'Evening', 'Late night', 'Varies'];
const DISCOVERY = ['Current Mongrel member', 'INARA', 'Social media', 'Discord / community server', 'In-game encounter', 'Friend / word of mouth', 'Other'];
const PVP = ['None', 'Beginner', 'Comfortable', 'Experienced'];
const VOICE = ['Yes', 'Usually', 'No'];
const OPEN = ['Yes', 'No'];

export async function onRequestGet({ request, env }) {
  const auth = await requireDiscordIdentity(request, env);
  if (auth.response) return auth.response;
  const items = await readApplications(env);
  const canReview = REVIEW_ACCESS.has(auth.session.access);
  const mine = items.find(item => item.ownerId === auth.session.sub) || null;
  if (!canReview) {
    return reply({
      ok: true,
      viewer: viewer(auth.session),
      canReview: false,
      alreadyMember: MEMBER_ACCESS.has(auth.session.access),
      mine: mine ? presentApplicant(itemForApplicant(mine)) : null,
    });
  }
  return reply({
    ok: true,
    viewer: viewer(auth.session),
    canReview: true,
    alreadyMember: MEMBER_ACCESS.has(auth.session.access),
    mine: mine ? presentApplicant(itemForApplicant(mine)) : null,
    applications: items.filter(item => item.status !== 'draft').map(presentReviewer).sort(applicationSort),
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireDiscordIdentity(request, env);
  if (auth.response) return auth.response;
  const err = validateSameOrigin(request, 'application-editor');
  if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  if (MEMBER_ACCESS.has(auth.session.access)) return reply({ ok: false, error: 'already_member' }, 409);

  const body = await readBody(request); if (body.response) return body.response;
  const action = body.value?.action === 'submit' ? 'submit' : 'save';
  const items = await readApplications(env);
  const existingIndex = items.findIndex(item => item.ownerId === auth.session.sub);
  const existing = existingIndex >= 0 ? items[existingIndex] : null;
  if (existing && existing.status !== 'draft') return reply({ ok: false, error: 'application_locked' }, 409);

  const answers = normalizeAnswers(body.value?.answers, existing?.answers || {});
  if (action === 'submit') {
    const missing = submissionErrors(answers);
    if (missing.length) return reply({ ok: false, error: 'application_incomplete', fields: missing }, 400);
  }

  const now = new Date().toISOString();
  const item = {
    id: existing?.id || crypto.randomUUID(),
    ownerId: auth.session.sub,
    ownerName: auth.session.displayName || auth.session.username || 'Discord User',
    discordUsername: auth.session.username || '',
    status: action === 'submit' ? 'submitted' : 'draft',
    answers,
    officerNotes: existing?.officerNotes || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    submittedAt: action === 'submit' ? now : (existing?.submittedAt || null),
    reviewedAt: existing?.reviewedAt || null,
    reviewedBy: existing?.reviewedBy || '',
  };

  if (existingIndex >= 0) items[existingIndex] = item;
  else items.push(item);
  await writeApplications(env, items);
  return reply({ ok: true, application: presentApplicant(itemForApplicant(item)) }, existing ? 200 : 201);
}

export async function onRequestPut({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return reply({ ok: false, error: 'authentication_required' }, 401);
  if (!REVIEW_ACCESS.has(session.access)) return reply({ ok: false, error: 'officer_access_required' }, 403);
  const err = validateSameOrigin(request, 'application-review');
  if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const id = clean(body.value?.id, '', 100);
  if (!id) return reply({ ok: false, error: 'application_id_required' }, 400);

  const items = await readApplications(env);
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return reply({ ok: false, error: 'application_not_found' }, 404);
  const existing = items[index];
  if (existing.status === 'draft') return reply({ ok: false, error: 'application_not_submitted' }, 409);
  const requested = clean(body.value?.status, existing.status, 30);
  const status = STATUSES.includes(requested) && requested !== 'draft' ? requested : existing.status;
  const now = new Date().toISOString();
  items[index] = {
    ...existing,
    status,
    officerNotes: clean(body.value?.officerNotes, existing.officerNotes || '', 4000),
    updatedAt: now,
    reviewedAt: status === 'submitted' ? existing.reviewedAt : now,
    reviewedBy: status === 'submitted' ? existing.reviewedBy : (session.displayName || session.username || 'Mongrel Officer'),
  };
  await writeApplications(env, items);
  return reply({ ok: true, application: presentReviewer(items[index]) });
}

function normalizeAnswers(value, fallback = {}) {
  const src = value && typeof value === 'object' ? value : {};
  return {
    commanderName: clean(src.commanderName, fallback.commanderName || '', 80),
    experience: allowed(src.experience, EXPERIENCE, fallback.experience || ''),
    timezone: clean(src.timezone, fallback.timezone || '', 80),
    activeTimes: allowedList(src.activeTimes, ACTIVE_TIMES, fallback.activeTimes || []),
    discoverySource: allowed(src.discoverySource, DISCOVERY, fallback.discoverySource || ''),
    discoveryDetail: clean(src.discoveryDetail, fallback.discoveryDetail || '', 160),
    interestReason: clean(src.interestReason, fallback.interestReason || '', 800),
    currentActivities: allowedList(src.currentActivities, ACTIVITIES, fallback.currentActivities || []),
    learnActivities: allowedList(src.learnActivities, ACTIVITIES, fallback.learnActivities || []),
    pvpExperience: allowed(src.pvpExperience, PVP, fallback.pvpExperience || ''),
    voiceComfort: allowed(src.voiceComfort, VOICE, fallback.voiceComfort || ''),
    openPlay: allowed(src.openPlay, OPEN, fallback.openPlay || ''),
    bgsOpenAcknowledged: booleanValue(src.bgsOpenAcknowledged, fallback.bgsOpenAcknowledged || false),
    squadGoals: clean(src.squadGoals, fallback.squadGoals || '', 1000),
    additionalInfo: clean(src.additionalInfo, fallback.additionalInfo || '', 1500),
    rulesAcknowledged: booleanValue(src.rulesAcknowledged, fallback.rulesAcknowledged || false),
  };
}

function submissionErrors(a) {
  const missing = [];
  if (!a.commanderName) missing.push('commanderName');
  if (!a.experience) missing.push('experience');
  if (!a.timezone) missing.push('timezone');
  if (!a.activeTimes.length) missing.push('activeTimes');
  if (!a.discoverySource) missing.push('discoverySource');
  if (!a.interestReason) missing.push('interestReason');
  if (!a.currentActivities.length) missing.push('currentActivities');
  if (!a.pvpExperience) missing.push('pvpExperience');
  if (!a.voiceComfort) missing.push('voiceComfort');
  if (!a.openPlay) missing.push('openPlay');
  if (!a.bgsOpenAcknowledged) missing.push('bgsOpenAcknowledged');
  if (!a.squadGoals) missing.push('squadGoals');
  if (!a.rulesAcknowledged) missing.push('rulesAcknowledged');
  return missing;
}

function itemForApplicant(item) {
  const { officerNotes, reviewedBy, ...safe } = item;
  return safe;
}
function presentApplicant(item) { return item; }
function presentReviewer(item) { return item; }
function applicationSort(a, b) {
  const rank = { submitted: 0, under_review: 1, accepted: 2, declined: 3 };
  return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(b.submittedAt || b.updatedAt || '').localeCompare(String(a.submittedAt || a.updatedAt || ''));
}
async function readApplications(env) {
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function') return [];
  try {
    const value = await env.PROJECTS.get(STORAGE_KEY, { type: 'json' });
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
async function writeApplications(env, items) {
  await env.PROJECTS.put(STORAGE_KEY, JSON.stringify(items.slice(-500)));
}
function requireStorage(env) {
  return (!env.PROJECTS || typeof env.PROJECTS.put !== 'function') ? reply({ ok: false, error: 'application_storage_not_configured' }, 503) : null;
}
async function requireDiscordIdentity(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response: reply({ ok: false, error: 'authentication_required' }, 401) };
  if (!session.membershipVerified && !MEMBER_ACCESS.has(session.access)) return { response: reply({ ok: false, error: 'discord_server_membership_required' }, 403) };
  return { session };
}
function validateSameOrigin(request, marker) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== marker) return reply({ ok: false, error: 'request_validation_failed' }, 403);
  return null;
}
async function readBody(request) {
  try { return { value: await request.json() }; }
  catch { return { response: reply({ ok: false, error: 'invalid_json' }, 400) }; }
}
function viewer(s) { return { displayName: s.displayName, username: s.username, access: s.access, membershipVerified: Boolean(s.membershipVerified) }; }
function allowed(value, choices, fallback) { return choices.includes(value) ? value : fallback; }
function allowedList(value, choices, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  const set = new Set(choices);
  return [...new Set(list.filter(item => set.has(item)))].slice(0, choices.length);
}
function booleanValue(value, fallback) { return typeof value === 'boolean' ? value : fallback; }
function clean(value, fallback, max) { if (typeof value !== 'string') return fallback; const out = value.trim(); return out ? out.slice(0, max) : ''; }
function headers() { return { 'Cache-Control': 'private, no-store, no-cache, must-revalidate', Pragma: 'no-cache', Vary: 'Cookie', 'X-Content-Type-Options':'nosniff' }; }
function reply(data, status = 200) { return json(data, { status, headers: headers() }); }
