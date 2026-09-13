const PROFILE_KEY = 'profiles-v1';

export async function resolveMemberProfile(env, profileId) {
  const id = typeof profileId === 'string' ? profileId.trim().slice(0, 100) : '';
  if (!id || !env.PROJECTS || typeof env.PROJECTS.get !== 'function') return null;
  try {
    const profiles = await env.PROJECTS.get(PROFILE_KEY, { type: 'json' });
    if (!Array.isArray(profiles)) return null;
    const profile = profiles.find(item => item && item.id === id);
    if (!profile || !profile.ownerId) return null;
    return {
      id: profile.id,
      ownerId: profile.ownerId,
      name: profile.commanderName || profile.ownerName || 'Mongrel member',
    };
  } catch {
    return null;
  }
}

export function publicMemberFilter(profile) {
  return profile ? { id: profile.id, name: profile.name } : null;
}
