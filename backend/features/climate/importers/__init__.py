"""Seed importers that turn source climate files into ``ClimateRecord``s.

- :mod:`features.climate.importers.phius` — the Phius ``-mon.txt`` station
  files (implemented, validated against the real 2022 US set: 1007 stations).
- PHI / PHPP xlsx — deferred until the real PHPP workbook + a reference to
  ``PHX/PHPP/sheet_io/io_climate.py`` are in hand (the exact worksheet cell
  layout cannot be reconstructed blind). See
  ``planning/features_v1.1/climate-phi-importer/PRD.md``.

Seed from the CLI (see :mod:`features.climate.importers.__main__`)::

    uv run python -m features.climate.importers --provider phius --root <dir>
"""
