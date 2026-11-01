# Feature map

`.cursor/skills/verify-hummlist/features/` describes what Hummlist does today, one file per
user-facing feature (index: its `README.md`). `FEATURES-FOR-WRITERS.md` in the same folder is
the plain-language version with the exact German and English labels, a "never claim" list per
feature and the commit each section was last verified on. Hummlist Launch and anyone writing
emails, site copy or instructions works from it.

**Whenever user-facing behaviour changes, update the feature file and its section in
FEATURES-FOR-WRITERS.md (including "Last verified") in the same PR.** The PR template has a
checkbox for it.

- Prove a feature on the real web build: the verify-hummlist skill
  (`.cursor/skills/verify-hummlist/SKILL.md`): `helpers/launch.sh`, `helpers/doctor.sh`,
  `helpers/drive.sh <feature-id>`, `helpers/cleanup.sh`.
- Film a how-to clip (email GIF, MP4/WebM, PNG) of a feature: the hummlist-howto-clips skill
  (`.cursor/skills/hummlist-howto-clips/SKILL.md`).
- The older verify-family-groceries skill (`scripts/fg`, the Linux desktop app, `fg sync`,
  scenarios) stays; its `features/` folder is no longer the current map.
- Copies for writers outside the repo: the box's `/workspace/hummlist/feature-map/` (this folder)
  and `/workspace/hummlist/clips/<feature-id>/` (clips), refreshed by the lead.
