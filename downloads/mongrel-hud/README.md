# Mongrel HUD

**Short version:** put it on the Windows PC that runs Elite, start **MongrelHUD.exe**, then use your iPad or browser as the controller.

You do **not** install anything on the iPad.

Current downloads:
https://mongrels-squadron.pages.dev/member/#mongrel-tools

## Before you start

You need:

- a Windows PC running Elite Dangerous
- **Mongrel Scout** installed and running in EDMC on that same PC
- your iPad/phone on the same home/private network if you want to use the remote controller

The HUD runs on the Elite PC because the overlay has to appear over the game and it talks to Scout through a local connection.

## Install and start

1. Download **MongrelHUD-Windows.zip** from the Mongrels site.
2. Unzip it somewhere convenient on your Elite PC.
3. Double-click **MongrelHUD.exe**.
4. If Windows Firewall asks, allow it on **Private networks**.
5. The small HUD control window will show a local address and a six-digit pairing PIN.
6. On your iPad or phone, open the address shown in that window.
7. Enter the PIN.
8. Use the controller to turn overlays on/off and arrange them.

The stable controller address is usually:

`http://mongrel-hud.local:43858/`

If that does not open, use the numbered local IP address shown in the HUD window instead.

## Moving and resizing overlays

The HUD normally runs in **LOCKED** mode so the overlay panels do not steal mouse clicks from Elite.

To arrange things:

1. On the controller, choose **UNLOCK LAYOUT**.
2. Move the HUD panels on the PC.
3. Adjust panel size as needed.
4. Choose **LOCK LAYOUT** when you are done.

Your panel positions, visibility and sizes are saved locally.

If the layout gets messed up, use **Reset Layout**.

## Updating the HUD

If the HUD tells you an update is available, use its **Update to x.x.x** button.

The HUD will update itself and keep your local layout/settings.

**Mongrel Scout updates separately.** Updating the HUD does not update Scout.

If you ever update manually, close the HUD, unzip the new build, and run the new **MongrelHUD.exe**. Your normal HUD settings live separately from the EXE.

## Voice pack

The optional neural voice pack is **not required** to use Mongrel HUD.

If you want it, use **Install Voice Pack** from the paired controller. The request is sent to the Windows HUD and the files are installed on the PC, not the iPad.

Windows system voices continue to work without the extra pack.

## Quick troubleshooting

### I cannot see any HUD panels
- Make sure the panel is enabled in the controller.
- Try **UNLOCK LAYOUT** in case the panel is off-screen or hidden behind another window.
- Use **Reset Layout** if needed.

### My iPad cannot connect
- Make sure the iPad and PC are on the same private/home network.
- Make sure Windows Firewall allowed Mongrel HUD on **Private networks**.
- Try the raw IP address shown in the HUD window instead of `mongrel-hud.local`.

### Windows says the app is unrecognized
The current HUD build is not code-signed, so Windows may show a SmartScreen warning even when you downloaded it from the official Mongrels site.

### The HUD is running but data is missing
Check that EDMC is open and **Mongrel Scout** is enabled. Scout is the HUD's local Elite-data bridge.

## Privacy

Most HUD state stays on your PC. The iPad controller talks to the HUD over your local network.

Mongrel Scout handles the separate squad-data uploads used by the website and follows its own privacy rules.

## Need the current downloads?

Open the Member Portal:
https://mongrels-squadron.pages.dev/member/#mongrel-tools

---

Developer/engineering details are intentionally kept out of this README. They are preserved in the repository at:

`downloads/mongrel-hud/TECHNICAL_NOTES.md`
