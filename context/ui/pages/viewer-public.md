> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.11 Viewer public read (`/projects/{id}/{tab}`)

**Purpose:** Anyone with the normal project URL views the project
read-only. There is no separate public URL, no `/v/{token}` route, and
no public link management surface.

**Header:** same project-workspace shell, rendered in Viewer
read-only mode. The header shows a "Read-only" pill next to the
project/version label. A sign-in affordance may appear in the account
area; edit controls do not render unless the visitor is logged in as an
editor.

**Layout:** Same project landing page as the editor view, but:
- No `Save` / Save As buttons.
- No row-action menus that lead to write actions.
- Version dropdown remains available for opening other versions;
  lock/rename/delete/default-version actions are hidden.
- Model tab viewing is allowed; Upload HBJSON is hidden.
- Climate tab viewing includes PHI/Phius records only through project-scoped
  attached-source reads; global climate dataset catalog/search endpoints and
  picker rosters remain authenticated/editor surfaces.
- Project settings remains available in read-only mode for metadata
  and location visibility, including linked EPW download when present;
  mutating settings, EPW upload/apply, and MCP token controls are
  hidden.
- Catalog manager routes require editor auth and are not part of the
  Viewer project workspace.

---
