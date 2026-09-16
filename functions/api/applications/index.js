import { json, readSession } from '../../../lib/auth.js';
import { provisionAcceptedApplicant, sendRecruitmentDeclineNotice, sendRecruitmentSubmissionAlert } from '../../../lib/discord-recruitment.js';

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
const DEFAULT_DECLINE_MESSAGE = 'Thank you for taking the time to apply. Your application was not accepted at this time. If leadership invited you to reapply later or you would like clarification, please contact us in Discord.';

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
    applicantMessage: existing?.applicantMessage || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    submittedAt: action === 'submit' ? now : (existing?.submittedAt || null),
    reviewedAt: existing?.reviewedAt || null,
    reviewedBy: existing?.reviewedBy || '',
    acceptedAt: existing?.acceptedAt || null,
    acceptedBy: existing?.acceptedBy || '',
    declinedAt: existing?.declinedAt || null,
    declinedBy: existing?.declinedBy || '',
    discordProvisionedAt: existing?.discordProvisionedAt || null,
    acceptanceDmStatus: existing?.acceptanceDmStatus || '',
    declineDmStatus: existing?.declineDmStatus || '',
    inGameApplicationVerified: Boolean(existing?.inGameApplicationVerified),
    inGameApplicationVerifiedAt: existing?.inGameApplicationVerifiedAt || null,
    inGameApplicationVerifiedBy: existing?.inGameApplicationVerifiedBy || '',
    inGameRequirementOverridden: Boolean(existing?.inGameRequirementOverridden),
    inGameRequirementOverriddenAt: existing?.inGameRequirementOverriddenAt || null,
    inGameRequirementOverriddenBy: existing?.inGameRequirementOverriddenBy || '',
    decisionHistory: Array.isArray(existing?.decisionHistory) ? existing.decisionHistory : [],
    reapplicationCycle: Number(existing?.reapplicationCycle || 1),
    reapplicationAllowedAt: existing?.reapplicationAllowedAt || null,
    reapplicationAllowedBy: existing?.reapplicationAllowedBy || '',
    previousApplicationId: existing?.previousApplicationId || null,
  };

  if (existingIndex >= 0) items[existingIndex] = item;
  else items.push(item);
  await writeApplications(env, items);

  if (action === 'submit') {
    try {
      await sendRecruitmentSubmissionAlert(env, item, new URL(request.url).origin);
    } catch {
      // Submission remains authoritative even if Discord notification is unavailable.
    }
  }

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
  const reviewerName = session.displayName || session.username || 'Mongrel Officer';
  const now = new Date().toISOString();

  if (body.value?.action === 'allow_reapplication') {
    if (existing.status !== 'declined') return reply({ ok: false, error: 'reapplication_requires_declined_status' }, 409);
    const archived = archiveDecision(existing);
    const history = [...(Array.isArray(existing.decisionHistory) ? existing.decisionHistory : []), archived].slice(-10);
    const reopened = {
      ...existing,
      id: crypto.randomUUID(),
      status: 'draft',
      answers: { ...(existing.answers || {}), inGameApplicationSubmitted: false },
      officerNotes: '',
      applicantMessage: '',
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: '',
      acceptedAt: null,
      acceptedBy: '',
      declinedAt: null,
      declinedBy: '',
      discordProvisionedAt: null,
      acceptanceDmStatus: '',
      declineDmStatus: '',
      inGameApplicationVerified: false,
      inGameApplicationVerifiedAt: null,
      inGameApplicationVerifiedBy: '',
      inGameRequirementOverridden: false,
      inGameRequirementOverriddenAt: null,
      inGameRequirementOverriddenBy: '',
      decisionHistory: history,
      reapplicationCycle: Number(existing.reapplicationCycle || 1) + 1,
      reapplicationAllowedAt: now,
      reapplicationAllowedBy: reviewerName,
      previousApplicationId: existing.id,
    };
    items[index] = reopened;
    await writeApplications(env, items);
    return reply({ ok: true, reapplicationOpened: true, application: presentReviewer(reopened) });
  }

  if (existing.status === 'draft') return reply({ ok: false, error: 'application_not_submitted' }, 409);
  const requested = clean(body.value?.status, existing.status, 30);
  if (!STATUSES.includes(requested) || requested === 'draft') return reply({ ok: false, error: 'invalid_application_status' }, 400);
  if (!transitionAllowed(existing.status, requested)) {
    return reply({
      ok: false,
      error: ['accepted', 'declined'].includes(existing.status) ? 'application_terminal' : 'invalid_status_transition',
      detail: existing.status === 'accepted'
        ? 'Accepted applications are terminal. Use member-management tools for later membership changes.'
        : existing.status === 'declined'
          ? 'Declined applications are terminal unless leadership explicitly opens a reapplication.'
          : `Cannot move an application from ${existing.status} to ${requested}.`,
    }, 409);
  }

  const status = requested;
  const newlyAccepted = status === 'accepted' && existing.status !== 'accepted';
  const newlyDeclined = status === 'declined' && existing.status !== 'declined';
  let provisioning = null;

  const requestedVerification = typeof body.value?.inGameApplicationVerified === 'boolean'
    ? body.value.inGameApplicationVerified
    : Boolean(existing.inGameApplicationVerified);
  const inGameApplicationVerified = Boolean(existing.inGameApplicationVerified) || requestedVerification;
  const verificationBecameTrue = inGameApplicationVerified && !existing.inGameApplicationVerified;
  const overrideInGameRequirement = body.value?.overrideInGameRequirement === true;

  if (newlyAccepted && !inGameApplicationVerified && !overrideInGameRequirement) {
    return reply({
      ok: false,
      error: 'ingame_application_not_verified',
      detail: 'Verify the Commander has submitted an in-game Squadron application, or explicitly approve as an exception.',
    }, 409);
  }

  if (newlyAccepted) {
    try {
      provisioning = await provisionAcceptedApplicant(env, existing, new URL(request.url).origin);
    } catch (error) {
      return reply({
        ok: false,
        error: 'member_role_assignment_failed',
        detail: String(error?.message || error).slice(0, 700),
      }, 502);
    }
  }

  const requirementOverriddenNow = newlyAccepted && !inGameApplicationVerified && overrideInGameRequirement;
  const applicantMessage = newlyDeclined
    ? clean(body.value?.applicantMessage, DEFAULT_DECLINE_MESSAGE, 1000)
    : (existing.applicantMessage || '');

  items[index] = {
    ...existing,
    status,
    officerNotes: clean(body.value?.officerNotes, existing.officerNotes || '', 4000),
    applicantMessage,
    updatedAt: now,
    reviewedAt: status === 'submitted' ? existing.reviewedAt : now,
    reviewedBy: status === 'submitted' ? existing.reviewedBy : reviewerName,
    acceptedAt: newlyAccepted ? now : (existing.acceptedAt || null),
    acceptedBy: newlyAccepted ? reviewerName : (existing.acceptedBy || ''),
    declinedAt: newlyDeclined ? now : (existing.declinedAt || null),
    declinedBy: newlyDeclined ? reviewerName : (existing.declinedBy || ''),
    discordProvisionedAt: newlyAccepted ? now : (existing.discordProvisionedAt || null),
    acceptanceDmStatus: newlyAccepted ? (provisioning?.dmStatus || '') : (existing.acceptanceDmStatus || ''),
    inGameApplicationVerified,
    inGameApplicationVerifiedAt: verificationBecameTrue ? now : (existing.inGameApplicationVerifiedAt || null),
    inGameApplicationVerifiedBy: verificationBecameTrue ? reviewerName : (existing.inGameApplicationVerifiedBy || ''),
    inGameRequirementOverridden: requirementOverriddenNow ? true : Boolean(existing.inGameRequirementOverridden),
    inGameRequirementOverriddenAt: requirementOverriddenNow ? now : (existing.inGameRequirementOverriddenAt || null),
    inGameRequirementOverriddenBy: requirementOverriddenNow ? reviewerName : (existing.inGameRequirementOverriddenBy || ''),
  };
  await writeApplications(env, items);

  if (newlyDeclined) {
    let declineDmStatus = 'unknown';
    try {
      const notice = await sendRecruitmentDeclineNotice(env, items[index], new URL(request.url).origin);
      declineDmStatus = notice?.status || 'unknown';
    } catch {
      declineDmStatus = 'failed';
    }
    items[index] = { ...items[index], declineDmStatus };
    await writeApplications(env, items);
  }

  return reply({
    ok: true,
    application: presentReviewer(items[index]),
    provisioning: newlyAccepted ? {
      memberRoleGranted: true,
      dmStatus: provisioning?.dmStatus || 'unknown',
      cleanupWarnings: Array.isArray(provisioning?.cleanupWarnings) ? provisioning.cleanupWarnings.length : 0,
      inGameApplicationVerified,
      inGameRequirementOverridden: requirementOverriddenNow,
    } : null,
    declineNotice: newlyDeclined ? { status: items[index].declineDmStatus || 'unknown' } : null,
  });
}

function transitionAllowed(from, to) {
  if (from === to) return true;
  if (from === 'submitted') return ['under_review', 'accepted', 'declined'].includes(to);
  if (from === 'under_review') return ['accepted', 'declined'].includes(to);
  return false;
}

function archiveDecision(item) {
  return {
    id: item.id,
    cycle: Number(item.reapplicationCycle || 1),
    status: item.status,
    answers: item.answers || {},
    officerNotes: item.officerNotes || '',
    applicantMessage: item.applicantMessage || '',
    createdAt: item.createdAt || null,
    submittedAt: item.submittedAt || null,
    reviewedAt: item.reviewedAt || null,
    reviewedBy: item.reviewedBy || '',
    declinedAt: item.declinedAt || null,
    declinedBy: item.declinedBy || '',
    inGameApplicationVerified: Boolean(item.inGameApplicationVerified),
  };
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
    inGameApplicationSubmitted: booleanValue(src.inGameApplicationSubmitted, fallback.inGameApplicationSubmitted || false),
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
  if (!a.inGameApplicationSubmitted) missing.push('inGameApplicationSubmitted');
  if (!a.rulesAcknowledged) missing.push('rulesAcknowledged');
  return missing;
}

function itemForApplicant(item) {
  const {
    officerNotes,
    reviewedBy,
    acceptedBy,
    declinedBy,
    discordProvisionedAt,
    acceptanceDmStatus,
    declineDmStatus,
    inGameApplicationVerified,
    inGameApplicationVerifiedAt,
    inGameApplicationVerifiedBy,
    inGameRequirementOverridden,
    inGameRequirementOverriddenAt,
    inGameRequirementOverriddenBy,
    decisionHistory,
    reapplicationAllowedBy,
    ...safe
  } = item;
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
function clean(value, fallback, max) { if (typeof value !== 'string') return fallback; const out = value.trim(); return out ? out.slice(0, max) : fallback; }
function headers() { return { 'Cache-Control': 'private, no-store, no-cache, must-revalidate', Pragma: 'no-cache', Vary: 'Cookie', 'X-Content-Type-Options':'nosniff' }; }
function reply(data, status = 200) { return json(data, { status, headers: headers() }); }
