(() => {
  const status = document.querySelector('[data-onboarding-status]');
  const detail = document.querySelector('[data-onboarding-detail]');
  const config = document.querySelector('[data-onboarding-config]');
  const endpoint = document.querySelector('[data-interaction-endpoint]');
  const welcome = document.querySelector('[data-welcome-channel]');
  const applicant = document.querySelector('[data-applicant-role]');
  const guest = document.querySelector('[data-guest-role]');
  const recruitment = document.querySelector('[data-recruitment-channel]');
  const publish = document.querySelector('[data-publish-onboarding]');
  const result = document.querySelector('[data-publish-result]');
  const testAlert = document.querySelector('[data-test-recruitment-alert]');
  const alertResult = document.querySelector('[data-alert-result]');
  const testAcceptanceDm = document.querySelector('[data-test-acceptance-dm]');
  const acceptanceDmResult = document.querySelector('[data-acceptance-dm-result]');

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
        if (alertResult) alertResult.textContent = 'Testing is disabled until you are signed in.';
        if (acceptanceDmResult) acceptanceDmResult.textContent = 'Testing is disabled until you are signed in.';
        return;
      }
      if (response.status === 403) {
        status.textContent = 'Site Admin access required';
        detail.textContent = 'This control is restricted to the website Site Admin.';
        result.textContent = 'Publishing is disabled for this account.';
        if (alertResult) alertResult.textContent = 'Testing is disabled for this account.';
        if (acceptanceDmResult) acceptanceDmResult.textContent = 'Testing is disabled for this account.';
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || `Configuration check failed (${response.status})`);

      config.hidden = false;
      endpoint.textContent = data.interactionEndpoint || 'Not available';
      welcome.textContent = data.welcomeChannelId || 'Not configured';
      applicant.textContent = data.applicantRoleId || 'Not configured';
      guest.textContent = data.guestRoleId || 'Not configured';
      if (recruitment) recruitment.textContent = data.recruitmentChannelId || 'Not configured';

      if (!data.botTokenConfigured) {
        status.textContent = 'Waiting for Discord bot token';
        detail.textContent = 'The code is deployed, but DISCORD_BOT_TOKEN still needs to be added as a Cloudflare secret.';
        result.textContent = 'Add the bot token in Cloudflare before publishing.';
        if (alertResult) alertResult.textContent = 'Add the bot token in Cloudflare before testing alerts.';
        if (acceptanceDmResult) acceptanceDmResult.textContent = 'Add the bot token in Cloudflare before testing DMs.';
        return;
      }
      if (!data.guildConfigured) {
        status.textContent = 'Guild ID is not configured';
        detail.textContent = 'The existing GUILD_ID environment value is missing.';
        result.textContent = 'Publishing is disabled until the server ID is configured.';
        if (alertResult) alertResult.textContent = 'Testing is disabled until the server ID is configured.';
        if (acceptanceDmResult) acceptanceDmResult.textContent = 'Testing is disabled until the server ID is configured.';
        return;
      }

      status.textContent = 'Backend ready';
      detail.textContent = 'Bot token, server configuration, onboarding IDs, and recruitment channel are available.';
      result.textContent = 'Onboarding selector controls are ready.';
      if (alertResult) alertResult.textContent = 'Ready to send a harmless test alert to The High Council.';
      if (acceptanceDmResult) acceptanceDmResult.textContent = 'Ready to send the acceptance-message preview to your Discord DMs.';
      publish.disabled = false;
      if (testAlert) testAlert.disabled = false;
      if (testAcceptanceDm) testAcceptanceDm.disabled = false;
    } catch (error) {
      status.textContent = 'Configuration check failed';
      detail.textContent = String(error?.message || error);
      result.textContent = 'Publishing is disabled until the backend responds.';
      if (alertResult) alertResult.textContent = 'Alert testing is disabled until the backend responds.';
      if (acceptanceDmResult) acceptanceDmResult.textContent = 'DM testing is disabled until the backend responds.';
    }
  }

  publish.addEventListener('click', async () => {
    publish.disabled = true;
    result.textContent = 'Publishing the replacement selector to #welcome…';
    try {
      const data = await postAction('publish');
      if (!data.ok) throw new Error(data.message);
      result.textContent = 'Published. Test both Discord buttons before removing any fallback messages.';
    } catch (error) {
      result.textContent = `Publish failed: ${String(error?.message || error)}`;
    } finally {
      publish.disabled = false;
    }
  });

  if (testAlert) {
    testAlert.addEventListener('click', async () => {
      testAlert.disabled = true;
      alertResult.textContent = 'Sending a test recruitment alert to The High Council…';
      try {
        const data = await postAction('test_recruitment_alert');
        if (!data.ok) throw new Error(data.message);
        alertResult.textContent = 'Test alert sent successfully. Check The High Council channel in Discord.';
      } catch (error) {
        alertResult.textContent = `Test failed: ${String(error?.message || error)}`;
      } finally {
        testAlert.disabled = false;
      }
    });
  }

  if (testAcceptanceDm) {
    testAcceptanceDm.addEventListener('click', async () => {
      testAcceptanceDm.disabled = true;
      acceptanceDmResult.textContent = 'Sending the acceptance-message preview to your Discord DMs…';
      try {
        const data = await postAction('test_acceptance_dm');
        if (!data.ok) throw new Error(data.message);
        acceptanceDmResult.textContent = 'Test DM sent successfully. No application, roles, or one-time DM state were changed.';
      } catch (error) {
        acceptanceDmResult.textContent = `Test failed: ${String(error?.message || error)}`;
      } finally {
        testAcceptanceDm.disabled = false;
      }
    });
  }

  async function postAction(action) {
    const response = await fetch('/api/discord/onboarding', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Mongrels-Request': 'discord-onboarding-admin',
      },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const message = data.detail ? `${data.error}: ${data.detail}` : (data.error || `Request failed (${response.status})`);
      return { ok: false, message };
    }
    return { ok: true, data };
  }
})();
