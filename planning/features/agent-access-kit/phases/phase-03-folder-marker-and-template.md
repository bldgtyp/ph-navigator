---
DATE: 2026-08-01
TIME: 08:41 EDT
STATUS: Ready — no backend dependency
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Dropbox-side — `.phn.json` marker spec + agent files in the kickoff
  template folder; stamp the Linde test folder.
RELATED: ../PRD.md §4, ../decisions.md §D-4/D-5/D-9
---

# Phase 03 — Folder marker + project-folder template

## Goal

Every BLDGTYP project folder — existing and future — carries a deterministic
pointer to its PHN project and thin agent instructions, born from the
copy/rename kickoff template with no per-project editing.

## Deliverables

1. **`.phn.json` spec** (also documented in the Phase-04 skill):

   ```json
   {
     "phn_project_id": null,
     "phn_api": "https://api.ph-nav.com",
     "phn_web": "https://www.ph-nav.com"
   }
   ```

   Null-id bootstrap: an agent finding `phn_project_id: null` resolves via
   `list_projects` (folder-name match, confirm with the user if ambiguous)
   and stamps the id back into the file.

2. **Template additions** to `/Users/em/Dropbox/bldgtyp/0000 Folder Tree/`:
   - `.phn.json` (null id, prod URLs, as above).
   - `CLAUDE.md` — what this folder is, the 01–14 subfolder map, the marker
     rule, "use the `phn` MCP tools (`phn` skill) for PH-Navigator project
     data; credentials via `/phn-login` if missing". Generic — no project
     names.
   - `AGENTS.md` — same content for Codex.

3. **Linde folder stamped**: `.phn.json` in
   `/Users/em/Dropbox/bldgtyp/2524_Linde_Residence/` with
   `phn_project_id: "2f2b0cbd-19b7-41cb-9e38-72593c34d699"`, plus the two
   agent files copied from the template.

## Notes

- These files live in Dropbox, not git; the *spec* and canonical template
  text are kept in this repo (location decided in Phase 04 alongside the
  skill source, per §D-8) so the Dropbox copies can be regenerated.
- Existing project folders are back-filled opportunistically (first agent
  contact triggers the null-id bootstrap after the two files are dropped in);
  no bulk migration required.
- Content referencing auth (`/phn-login`) describes the Phase-02/04 target;
  files can land now, that line simply activates when the plugin ships.

## Done when

Copying `0000 Folder Tree` to a scratch name yields a folder whose files need
zero edits; the Linde folder carries a stamped marker + both agent files.
