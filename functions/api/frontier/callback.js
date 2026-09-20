import { finishFrontierFlow, frontierConfigured, requireMember } from '../../../lib/frontier.js';

export async function onRequestGet({request,env}) {
  const url = new URL(request.url);
  const auth = await requireMember(request, env);
  if (auth.response) return Response.redirect(new URL('/member/?elite=session_required#mongrel-scout', request.url), 302);
  if (!frontierConfigured(env)) return Response.redirect(new URL('/member/?elite=not_configured#mongrel-scout', request.url), 302);
  if (url.searchParams.get('error')) return Response.redirect(new URL('/member/?elite=denied#mongrel-scout', request.url), 302);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  try {
    await finishFrontierFlow(request, env, auth.session, state, code);
    return Response.redirect(new URL('/member/?elite=connected#mongrel-scout', request.url), 302);
  } catch (error) {
    console.error('Frontier OAuth callback failed', error);
    return Response.redirect(new URL('/member/?elite=error#mongrel-scout', request.url), 302);
  }
}
