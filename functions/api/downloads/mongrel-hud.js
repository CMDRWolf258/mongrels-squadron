const RELEASE_URL = 'https://github.com/CMDRWolf258/mongrels-squadron/releases/download/mongrel-hud-latest/MongrelHUD-Windows.zip';

export async function onRequestGet() {
  return Response.redirect(RELEASE_URL, 302);
}
