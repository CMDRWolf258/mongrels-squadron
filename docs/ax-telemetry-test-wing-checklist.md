# AX Telemetry Test — Wing / Multi-Interceptor Checklist

Use this when testing MongrelHUD in a wing against multiple Interceptors.

The main purpose is to learn whether Elite gives us a stable way to distinguish individual Interceptors and whether heart state can be re-synchronized after another pilot damages a target while you are not looking at it.

## Before the fight

- [ ] Mongrel Scout is running.
- [ ] MongrelHUD is running and paired to the iPad controller.
- [ ] Select the **AX Combat** profile.
- [ ] Confirm telemetry capture is **OFF** before starting.
- [ ] Tell the wing that this run includes a short target-switching test.
- [ ] If possible, include **two Interceptors of the same variant**. Two Cyclopses, two Basilisks, etc. are especially useful.
- [ ] Do **not** treat the prototype heart counter as authoritative during this test.

## Start capture

- [ ] Tap **START CAPTURE** before engaging.
- [ ] Confirm the recorder is **ON**.

## Identify targets

- [ ] Select the first Interceptor.
- [ ] Wait briefly for the target card to populate.
- [ ] Tap **TARGET A**.
- [ ] Select a second Interceptor.
- [ ] Wait briefly for its target card to populate.
- [ ] Tap **TARGET B**.
- [ ] If a third target is useful, label it with **TARGET C**.

The TARGET A/B/C buttons are only research labels. They do not alter the fight tracker.

## Target-switch test

- [ ] Re-select **TARGET A** and verify the HUD recognizes something about it.
- [ ] Switch to **TARGET B**.
- [ ] Switch back to **TARGET A**.
- [ ] Watch for any heart-counter reset, target-card reset, variant change, or stale data.
- [ ] If anything looks wrong, keep flying; the telemetry log is more important than fixing it during the fight.

## Off-target heart-loss test

This is the most important wing test.

- [ ] Select **TARGET A** and note its apparent heart state.
- [ ] Switch away from TARGET A.
- [ ] Have another pilot destroy one of TARGET A's hearts while you are not targeting it.
- [ ] When the wing confirms the heart is gone, tap **OFF-TARGET HEART DOWN**.
- [ ] Do **not** press the normal HEART DOWN button for this event.
- [ ] Reacquire TARGET A.
- [ ] Tap **TARGET A** again.
- [ ] Observe whether the HUD or Elite target data now reflects the missing heart automatically.
- [ ] Note whether the prototype counter stayed stale, reset, or somehow reconciled.

## Repeat if practical

- [ ] Repeat the A → B → A switch once more.
- [ ] If available, repeat with two Interceptors of the **same variant**.
- [ ] If a different variant is present, repeat once across different variants too.

## Other useful markers

Use these only when clearly observed:

- [ ] **HEART EXERTED**
- [ ] **HEART DOWN** — only for the Interceptor you are actively tracking.
- [ ] **ENERGY SURGE**
- [ ] **EMP HIT**
- [ ] **CAUSTIC MISSILE**
- [ ] **LIGHTNING**
- [ ] **SWARM LAUNCH**
- [ ] **SWARM DOWN**

## End capture

- [ ] Tap **STOP CAPTURE** after the encounter.
- [ ] Confirm the recorder shows **OFF**.
- [ ] Keep the telemetry file.
- [ ] Note the approximate number and variants of Interceptors present.
- [ ] Note any moment where you were unsure whether A/B/C still referred to the same ship.

## What this test is trying to prove

We want to answer four questions:

1. Does `ShipTargeted` contain a stable per-Interceptor identifier?
2. Can MongrelHUD distinguish two Interceptors of the same variant?
3. If another pilot destroys a heart while you are off target, does reacquiring that Interceptor reveal the new state?
4. Can we safely build separate per-Interceptor encounter slots, or do we need a visible **LAST KNOWN / UNSYNCED** state with manual correction?

Capture files are stored locally under:

`%LOCALAPPDATA%\MongrelHUD\telemetry`

The research recorder does not upload the raw capture stream to the site.
