# Mongrels Squadron Site — v46

This batch adds:
- Navigation label **Command** with **Mission Control** as the BGS/operations page title.
- Correct Rules & ROE deep-linking to `about/#squad-rules`.
- CMDR Lennyshow's **Bottle Rocket** combat build (Fully Engineered) with supplied screenshot and EDSY link.
- A secure member **Projects & Events** board.
- Members can create/edit/delete only their own project posts.
- Officers/Site Admin can moderate all posts and can create official squad projects or events.
- Project system/location copy buttons, progress, target, help-request, date, category, status, and archive views.
- Member Portal preview of active projects/events.

## Cloudflare requirement
Create a KV namespace such as `mongrels-projects` and bind it to the Pages project with variable name exactly `PROJECTS`.

No Discord scope changes are required.
