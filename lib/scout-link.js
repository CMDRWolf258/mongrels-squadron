import { readSession, json } from './auth.js';

export const SCOUT_LINK_KEY_PREFIX = 'scout-chatgpt-link:v1:ship:';
export const SCOUT_LINK_TOKEN_KEY = 'wolf-bgs-scout-tokens-v1';
export const SCOUT_LINK_STALE_SECONDS = 180;
export const SCOUT_LINK_EXPIRES_SECONDS = 60 * 60 * 24;

export const linkEnabled = env => String(env?.SCOUT_CHATGPT_LINK_ENABLED || '').toLowerCase() === 'true';
export const linkStorageReady = env => Boolean(env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.get === 'function' && typeof env.DAILY_ORDERS.put === 'function');

export function linkReply(data, status = 200, extraHeaders = {}) {
  return json(data, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extraHeaders } });
}
export function linkAdmin(env, ownerId) {
  return Boolean(env?.ADMIN_USER_ID && String(ownerId || '') === String(env.ADMIN_USER_ID));
}
export async function requireLinkAdmin(request, env) {
  const session = await readSession(request, env);
  return session && session.access === 'site_admin' && linkAdmin(env, session.sub) ? session : null;
}
export async function sha256Hex(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export function constantTimeEqual(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i=0; i<a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function authenticateOwnerScout(request, env) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(mscout_[A-Za-z0-9_-]{8,174})$/i);
  if (!match) return null;
  const hash = await sha256Hex(match[1]);
  const stored = await env.DAILY_ORDERS.get(SCOUT_LINK_TOKEN_KEY, { type: 'json' });
  const tokens = stored?.tokens && typeof stored.tokens === 'object' ? Object.values(stored.tokens) : [];
  for (const token of tokens) {
    if (token?.hash && constantTimeEqual(String(token.hash), hash) && linkAdmin(env, token.ownerId) && !token.revokedAt && token.enabled !== false) {
      return { ownerId: String(token.ownerId), id: String(token.id || '') };
    }
  }
  return null;
}
export function snapshotKey(env) { return SCOUT_LINK_KEY_PREFIX + String(env.ADMIN_USER_ID); }
const safeText = (value, max = 120) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,max) : '';
const number = (value, min = 0, max = 1e9) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? Math.round(value * 1000000) / 1000000 : null;
export function normalizeShipSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return null;
  const observedAt = safeText(value.observedAt, 35);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed) || observed > Date.now() + 60000 || observed < Date.now() - 600000) return null;
  const system = safeText(value.system, 150);
  const ship = safeText(value.ship, 85);
  if (!system || !ship) return null;
  const currentJumpRange = number(value.currentJumpRange, 0, 1000);
  const fuelCapacity = number(value.fuelCapacity, 0, 2000);
  const fuelReserveCapacity = number(value.fuelReserveCapacity, 0, 2000);
  const fuel = number(value.fuel, 0, 2000);
  const cargo = number(value.cargo, 0, 100000);
  const unladenMass = number(value.unladenMass, 0, 100000);
  const jumpModel = value.jumpModel && typeof value.jumpModel === 'object' ? value.jumpModel : {};
  const optimalMass = number(jumpModel.optimalMass, 1, 1000000);
  const fuelPerJump = number(jumpModel.maxFuelPerJump, 0.01, 1000);
  const ratingConstant = number(jumpModel.ratingConstant, 0.001, 1000);
  const powerConstant = number(jumpModel.powerConstant, 0.001, 10);
  const guardianBoost = number(jumpModel.guardianBoost, 0, 50) ?? 0;
  // Spansh Galaxy Plotter accepts FSD physics, not a full commander loadout.
  // We only retain whitelisted journal-derived numbers (no Modules export).
  const galaxyModel = [optimalMass, fuelPerJump, ratingConstant, powerConstant,
      unladenMass, fuelCapacity, fuelReserveCapacity].every(n=>n!==null)
    ? {
        fuelPower:powerConstant, fuelMultiplier:ratingConstant/1000,
        optimalMass, maxFuelPerJump:fuelPerJump,
        baseMass:unladenMass+fuelReserveCapacity,
        tankSize:fuelCapacity, internalTankSize:fuelReserveCapacity,
        rangeBoost:guardianBoost,
        superchargeMultiplier:jumpModel.kind==='mkii'?6:4,
      }
    : null;
  let fullFuelZeroCargoRange = null;
  if ([fuelCapacity,unladenMass,optimalMass,fuelPerJump,ratingConstant,powerConstant].every(n => n !== null)) {
    // Same journal-derived formula as Scout; reserve fuel is excluded from the
    // full-main-tank prediction. Never replace Scout's current HUD calculation.
    const rangeMass = unladenMass + fuelCapacity;
    const jumpFuel = Math.min(fuelCapacity, fuelPerJump);
    if (rangeMass > 0 && jumpFuel > 0) {
      fullFuelZeroCargoRange = number((optimalMass / rangeMass) *
        Math.pow(jumpFuel * 1000 / ratingConstant, 1 / powerConstant) + guardianBoost, 0, 1000);
    }
  }
  return {
    version:1, system, ship, shipType:safeText(value.shipType,85),
    currentJumpRange, fullFuelZeroCargoRange,
    fuel, fuelCapacity, fuelReserveCapacity, cargo, unladenMass,
    galaxyModel,
    fuelScoopInstalled:value.fuelScoopInstalled===true?true:value.fuelScoopInstalled===false?false:null,
    fsdType:safeText(jumpModel.kind,30),
    guardianBoost,
    observedAt:new Date(observed).toISOString(),
    receivedAt:new Date().toISOString(),
    source:'MongrelScout / Elite journal + Status.json',
  };
}
export async function readShipSnapshot(env) {
  const snapshot = await env.DAILY_ORDERS.get(snapshotKey(env), { type:'json' });
  if (!snapshot || typeof snapshot !== 'object') return { available:false, reason:'no_snapshot' };
  const observedMs = Date.parse(snapshot.observedAt || '');
  const receivedMs = Date.parse(snapshot.receivedAt || '');
  const ageSeconds = Number.isFinite(observedMs) ? Math.max(0, Math.floor((Date.now() - observedMs) / 1000)) : null;
  const receivedAgeSeconds = Number.isFinite(receivedMs) ? Math.max(0, Math.floor((Date.now() - receivedMs) / 1000)) : null;
  return {
    available:true, fresh:ageSeconds !== null && ageSeconds <= SCOUT_LINK_STALE_SECONDS,
    ageSeconds, receivedAgeSeconds, ...snapshot,
  };
}
