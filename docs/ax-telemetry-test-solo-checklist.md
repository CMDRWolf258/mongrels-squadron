# AX Telemetry Test — Solo Quick Checklist

Use this for a simple first telemetry run against one Interceptor.

## Before launch

- [ ] Mongrel Scout is running.
- [ ] MongrelHUD is running and paired to the iPad controller.
- [ ] Select the **AX Combat** profile.
- [ ] Confirm the AX telemetry panel shows **Recorder OFF**.
- [ ] If practical, start with an Interceptor variant you can identify easily.
- [ ] Keep the normal fight tracker experimental; the purpose of this run is data collection.

## Start the capture

- [ ] Tap **START CAPTURE** before the fight begins.
- [ ] Confirm the recorder shows **ON** and the record count starts increasing.
- [ ] Target the Interceptor.
- [ ] If auto-detection identifies the target correctly, leave the variant override on **Auto**.
- [ ] If it does not identify correctly, note that for later rather than forcing a conclusion from the HUD.

## During the fight

Tap the matching marker as close as practical to the moment you observe it.

- [ ] **HEART EXERTED** when a heart becomes vulnerable.
- [ ] **HEART DOWN** when you confirm a heart is destroyed.
- [ ] **SHIELD UP** when the post-heart shield phase begins, if useful.
- [ ] **SHIELD DOWN** when the shield phase ends, if useful.
- [ ] **ENERGY SURGE** when you hear/see the shutdown-pulse warning.
- [ ] **EMP HIT** if the shutdown pulse actually disables your ship.
- [ ] **CAUSTIC MISSILE** when an inbound caustic missile is clearly identified.
- [ ] **LIGHTNING** when the Interceptor begins or lands the lightning attack.
- [ ] **SWARM LAUNCH** when a swarm is launched.
- [ ] **SWARM DOWN** when the swarm is destroyed.

You do **not** need to mark every possible event. Accuracy matters more than completeness.

## Useful target checks

At least once during the fight:

- [ ] Target the Interceptor normally.
- [ ] Target a heart/subsystem if the game allows it.
- [ ] Untarget the Interceptor for a few seconds.
- [ ] Retarget it.
- [ ] Note whether MongrelHUD appears to recover target hull, shield, subsystem, or heart information.

## End the capture

- [ ] Tap **STOP CAPTURE** after the encounter is over.
- [ ] Confirm the recorder shows **OFF**.
- [ ] Do not delete the capture file.
- [ ] Note anything obviously wrong with the HUD: wrong variant, missed target, stale heart count, unexpected reset, false alert, etc.

## What this test is trying to prove

- Does current Elite telemetry expose useful AX target information?
- Do target/subsystem updates correlate with heart exertion or destruction?
- Is the energy-surge warning represented anywhere before shutdown?
- Do any useful signals appear for caustic missiles, lightning, or swarm events?
- Does target state survive untargeting and reacquisition?

Capture files are stored locally under:

`%LOCALAPPDATA%\MongrelHUD\telemetry`

They are not uploaded to Cloudflare by the research recorder.
