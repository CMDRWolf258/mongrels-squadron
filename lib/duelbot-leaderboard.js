export const DUELBOT_SCHEMA_VERSION = 1;

export const DUELBOT_CATEGORY_KEYS = Object.freeze([
  'most_logged_duels',
  'most_wins',
  'longest_win_streak',
  'highest_win_percentage',
  'most_losses',
  'longest_losing_streak',
  'overall_winningest_ship',
  'top_victory_hardpoints',
  'most_pending_duels',
]);

export function normalizeDuelBotLeaderboard(payload) {
  if (!payload || payload.ok !== true || Number(payload.schema_version) !== DUELBOT_SCHEMA_VERSION) return null;
  if (!Array.isArray(payload.leaderboard) || payload.leaderboard.length !== DUELBOT_CATEGORY_KEYS.length) return null;

  const generated = new Date(payload.generated_at);
  if (!Number.isFinite(generated.getTime())) return null;

  const leaderboard = [];
  for (let index = 0; index < DUELBOT_CATEGORY_KEYS.length; index += 1) {
    const raw = payload.leaderboard[index];
    const expectedKey = DUELBOT_CATEGORY_KEYS[index];
    if (!raw || clean(raw.key, 80) !== expectedKey) return null;

    const title = clean(raw.title, 120);
    const label = clean(raw.label, 180);
    if (!title || !label || !Array.isArray(raw.entries)) return null;

    const entries = raw.entries.map(entry => normalizeEntry(expectedKey, entry)).filter(Boolean);
    if (entries.length !== raw.entries.length) return null;
    if (expectedKey === 'top_victory_hardpoints' && entries.length > 3) return null;

    leaderboard.push({ key:expectedKey, title, label, entries });
  }

  return {
    ok:true,
    schema_version:DUELBOT_SCHEMA_VERSION,
    generated_at:generated.toISOString(),
    leaderboard,
  };
}

function normalizeEntry(key, entry) {
  if (!entry || typeof entry !== 'object') return null;

  if (key === 'overall_winningest_ship') {
    const ship = clean(entry.ship, 120);
    return ship ? { ship } : null;
  }

  if (key === 'top_victory_hardpoints') {
    const label = clean(entry.label, 180);
    return label ? { label } : null;
  }

  const username = clean(entry.username, 120);
  if (!username) return null;

  if (key === 'highest_win_percentage') {
    const percentage = Number(entry.percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return null;
    return { username, percentage:Math.round(percentage * 10) / 10 };
  }

  const value = Number(entry.value);
  if (!Number.isInteger(value) || value < 0 || value > 1000000) return null;
  return { username, value };
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
