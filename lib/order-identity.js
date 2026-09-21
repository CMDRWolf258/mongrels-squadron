export function deriveLogicalOrderKey(order = {}) {
  const reportingType = clean(order?.reporting?.type);
  const source = norm(order.source) || 'manual';
  const system = norm(order.system) || 'squad-wide';
  const faction = norm(order.faction) || 'any-faction';
  const kind = norm(order.kind) || reportingType || 'task';
  const semantic = semanticTask(order.task || order.detail || kind);
  const explicit = clean(order.logicalKey);
  return explicit || [source, system, faction, kind, semantic].join('|').slice(0, 520);
}

export function orderRevisionFingerprint(order = {}) {
  const reporting = order?.reporting && typeof order.reporting === 'object'
    ? {
        type:clean(order.reporting.type),
        target:numberOrNull(order.reporting.target),
        blitz:Boolean(order.reporting.blitz),
      }
    : null;
  return JSON.stringify({
    system:clean(order.system),
    faction:clean(order.faction),
    kind:clean(order.kind),
    source:clean(order.source),
    priority:clean(order.priority),
    task:clean(order.task),
    detail:clean(order.detail),
    status:clean(order.status),
    reporting,
  });
}

export function sameLogicalOrder(a, b) {
  return deriveLogicalOrderKey(a) === deriveLogicalOrderKey(b);
}

function semanticTask(value) {
  return norm(value)
    .replace(/\b\d+(?:\.\d+)?\s*m\s*cr\b/g, ' amount ')
    .replace(/\b\d+(?:\.\d+)?\s*inf\b/g, ' inf ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:cz\s*)?(?:points?|pts?)\b/g, ' cz ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' number ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'task';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function norm(value) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ');
}
