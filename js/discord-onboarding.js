(() => {
  const status = document.querySelector('[data-onboarding-status]');
  const detail = document.querySelector('[data-onboarding-detail]');
  const config = document.querySelector('[data-onboarding-config]');
  const endpoint = document.querySelector('[data-interaction-endpoint]');
  const welcome = document.querySelector('[data-welcome-channel]');
  const applicant = document.querySelector('[data-applicant-role]');
  const guest = document.querySelector('[data-guest-role]');
  const publish = document.querySelector('[data-publish-onboarding]');
  const result = document.querySelector('[data-publish-result]');

  if (!status || !publish) return;

  init();

  async function init() {
    try {
      const response = await fetch('/api/discord/onboarding', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        status.textContent = 'Discord sign-in required';
        detail.innerHTML = 'Sign in through the <a href="/member/">Member Portal</a>, then return here.';
        result.textContent = 'Publishing is disabled until you are signed in.';
        return;
      }
      if (response.status === 403) {
        status.textContent = 'Site Admin access required';
        detail.textContent = 'This control is restricted to the website Site Admin.';
        result.textContent = 'Publishing is disabled for this account.';
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || `Configuration check failed (${response.status})`);

      config.hidden = false;
      endpoint.textContent = data.interactionEndpoint || 'Not available';
      welcome.textContent = data.welcomeChannelId || 'Not configured';
      applicant.textContent = data.applicantRoleId || 'Not configured';
      guest.textContent = data.guestRoleId || 'Not configured';

      if (!data.botTokenConfigured) {
        status.textContent = 'Waiting for Discord bot token';
        detail.textContent = 'The code is deployed, but DISCORD_BOT_TOKEN still needs to be added as a Cloudflare secret.';
        result.textContent = 'Add the bot token in Cloudflare before publishing.';
        return;
      }
      if (!data.guildConfigured) {
        status.textContent = 'Guild ID is not configured';
        detail.textContent = 'The existing GUILD_ID environment value is missing.';
        result.textContent = 'Publishing is disabled until the server ID is configured.';
        return;
      }

      status.textContent = 'Backend ready';
      detail.textContent = 'Bot token, server configuration, and onboarding IDs are available.';
      result.textContent = 'Ready to publish a test replacement selector.';
      publish.disabled = false;
    } catch (error) {
      status.textContent = 'Configuration check failed';
      detail.textContent = String(error?.message || error);
      result.textContent = 'Publishing is disabled until the backend responds.';
    }
  }

  publish.addEventListener('click', async () => {
    publish.disabled = true;
    result.textContent = 'Publishing the replacement selector to #welcome…';
    try {
      const response = await fetch('/api/discord/onboarding', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Mongrels-Request': 'discord-onboarding-admin',
        },
        body: JSON.stringify({ action: 'publish' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        const message = data.detail ? `${data.error}: ${data.detail}` : (data.error || `Publish failed (${response.status})`);
        throw new Error(message);
      }
      result.textContent = 'Published. Test both new Discord buttons before removing the MEE6 fallback messages.';
    } catch (error) {
      result.textContent = `Publish failed: ${String(error?.message || error)}`;
    } finally {
      publish.disabled = false;
    }
  });
})();
