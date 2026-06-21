> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.10 Project settings (overflow menu, not a tab)

**(Detailed in US-Settings.)**

Reached via the project header `⋯` → "Project settings". Opens a
modal (or dedicated route — TBD when walked) with:
- Edit metadata (name, bt_number, client, phius_number,
  phius_dropbox_url).
- Location metadata (latitude, longitude, elevation, time zone,
  true-north, address/city/state). Editors edit; Viewers read only.
  Editors can upload an EPW weather file, parse its `LOCATION` header,
  apply the suggested coordinates/elevation/time zone into editable
  fields, save an EPW source URL, and see non-blocking mismatch
  warnings. Linked EPWs are downloadable from the settings view.
- MCP tokens for this project (issue / list / revoke).
- Transfer ownership (post-MVP UI; data model supports).
- Delete project (gated to v1.1, US-1.4).

