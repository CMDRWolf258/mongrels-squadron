import {
  STATE_COOKIE,
  RETURN_COOKIE,
  SESSION_COOKIE,
  accessLabel,
  clearCookie,
  createSession,
  exchangeDiscordCode,
  fetchDiscordUser,
  getCookie,
  resolveAccess,
  safeReturnPath,
  sessionCookie,
} from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const savedState = getCookie(request, STATE_COOKIE);
  const storedReturn = getCookie(request, RETURN_COOKIE);
  const returnTo = safeReturnPath(storedReturn ? decodeURIComponent(storedReturn) : '/member/');

  if (error) return redirectWithResult(returnTo, 'denied');
  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return redirectWithResult(returnTo, 'state_error');
  }

  try {
    const token = await exchangeDiscordCode(env, code);
    const user = await fetchDiscordUser(token.access_token);
    const accessInfo = await resolveAccess(env, token.access_token, user);
    const session = await createSession(env, user, accessInfo);
    const target = new URL(returnTo, url.origin);
    target.searchParams.set('login', accessInfo.access === 'no_access' ? 'no_access' : 'success');
    target.searchParams.set('level', accessLabel(accessInfo.access));

    const headers = new Headers({ Location: target.toString() });
    headers.append('Set-Cookie', sessionCookie(session));
    headers.append('Set-Cookie', clearCookie(STATE_COOKIE));
    headers.append('Set-Cookie', clearCookie(RETURN_COOKIE));
    headers.set('Cache-Control', 'no-store');
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('Mongrels OAuth callback failed', error);
    return redirectWithResult(returnTo, 'server_error');
  }
}

function redirectWithResult(returnTo, result) {
  const target = new URL(returnTo, 'https://mongrels-squadron.pages.dev');
  target.searchParams.set('login', result);
  const headers = new Headers({ Location: target.toString() });
  headers.append('Set-Cookie', clearCookie(STATE_COOKIE));
  headers.append('Set-Cookie', clearCookie(RETURN_COOKIE));
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
}
