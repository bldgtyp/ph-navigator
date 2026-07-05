"""Grasshopper Data API — the downstream read surface for Rhino/Grasshopper.

`honeybee_grasshopper_ph_plus` components GET project data from
`/api/v1/gh/projects/{bt_number}` while a user builds the 3D energy model.
Projects are keyed by bt_number (not UUID), reads are anonymous-by-default with
an optional MCP bearer hedge, and every data route serves a saved version
(never a draft). See `planning/archive/dated/2026-07-05/grasshopper-data-api/PRD.md`.
"""
