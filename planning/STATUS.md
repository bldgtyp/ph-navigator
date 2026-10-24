# Planning Status

DATE: 2026-08-27
TIME: 08:55 EDT
STATUS: Active routing index for tracked planning material.
AUTHOR: Claude (with Ed May)
SCOPE: Active-only index after the migration to GitHub Issues. Completed and
superseded packets live in `archive/README.md`; every unit of work carries a
GitHub issue (`bldgtyp/ph-navigator`).

## Active / current work

| Item | Kind | State | Issue | Pointer |
| --- | --- | --- | --- | --- |
| Aperture Psi-Install | Feature (cross-repo) | **Implemented on branch** `feature/aperture-psi-install` — phases 01–06 done, phase-05 UI review closed 2026-08-15; phase 07 (GH client) shipped from `honeybee_grasshopper_ph_plus`. Remaining: merge/production deploy (Ed's call) + end-to-end closeout, then archive | [#73](https://github.com/bldgtyp/ph-navigator/issues/73) | [`features_v1.1/aperture-psi-install/`](features_v1.1/aperture-psi-install/STATUS.md) |
| Overview Documentation-Progress refactor | Refactor | **Implemented on branch** `feature/overview-documentation-progress-refactor`; closes with its PR | [#75](https://github.com/bldgtyp/ph-navigator/issues/75) | [`refactor/overview-documentation-progress/`](refactor/overview-documentation-progress/STATUS.md) |
| Spec-Status Value Unification | Refactor | **Deployed and verified in production** — only Phase 07 adapter retirement remains | [#76](https://github.com/bldgtyp/ph-navigator/issues/76) | [`refactor/spec-status-value-unification/`](refactor/spec-status-value-unification/STATUS.md) |
| Window Thermal Comfort Check | Feature | **Scoped** — PRD drafted 2026-08-18, no code; blocked on the per-type vs per-instance design question | [#72](https://github.com/bldgtyp/ph-navigator/issues/72) | [`features/window-thermal-comfort-check/`](features/window-thermal-comfort-check/STATUS.md) |
| Apertures Catalog-Drift UX Parity | Refactor | **Scoped** — deferred, not started | [#74](https://github.com/bldgtyp/ph-navigator/issues/74) | [`refactor/aperture-catalog-drift-ux-parity/`](refactor/aperture-catalog-drift-ux-parity/STATUS.md) |

## Deferred — v1.1 candidates ([milestone v1.1](https://github.com/bldgtyp/ph-navigator/milestone/1))

| Item | Issue | Pointer |
| --- | --- | --- |
| Catalog Manage Options modal | [#77](https://github.com/bldgtyp/ph-navigator/issues/77) | [`features_v1.1/catalog-manage-options-modal/`](features_v1.1/catalog-manage-options-modal/STATUS.md) |
| Design-conditions contract endpoint | [#78](https://github.com/bldgtyp/ph-navigator/issues/78) | [`features_v1.1/climate-design-conditions/`](features_v1.1/climate-design-conditions/STATUS.md) |
| Rain-exposure-class Climate metric | [#79](https://github.com/bldgtyp/ph-navigator/issues/79) | [`features_v1.1/climate-rain-exposure/`](features_v1.1/climate-rain-exposure/STATUS.md) |
| Contributor auth | [#80](https://github.com/bldgtyp/ph-navigator/issues/80) | [`features_v1.1/contributor-auth/`](features_v1.1/contributor-auth/STATUS.md) |
| Model Viewer post-MVP roster | [#81](https://github.com/bldgtyp/ph-navigator/issues/81) | [`features_v1.1/model-viewer-post-mvp/`](features_v1.1/model-viewer-post-mvp/STATUS.md) |
| Table CSV download follow-ups | [#82](https://github.com/bldgtyp/ph-navigator/issues/82) | [`features_v1.1/table-csv-download-followups/`](features_v1.1/table-csv-download-followups/STATUS.md) |
| User-defined attachment fields | [#83](https://github.com/bldgtyp/ph-navigator/issues/83) | [`features_v1.1/user-defined-attachment-fields/`](features_v1.1/user-defined-attachment-fields/STATUS.md) |

## Deferred — v2.0 / speculative ([milestone v2.0](https://github.com/bldgtyp/ph-navigator/milestone/2))

| Item | Issue | Pointer |
| --- | --- | --- |
| Access-capability enforcement (Phase 5) | [#84](https://github.com/bldgtyp/ph-navigator/issues/84) | [`features_v2.0/access-capability-enforcement/`](features_v2.0/access-capability-enforcement/STATUS.md) |
| Account-security hardening | [#86](https://github.com/bldgtyp/ph-navigator/issues/86) | [`features_v2.0/account-security-hardening/`](features_v2.0/account-security-hardening/STATUS.md) |
| Multi-tenant teams | [#87](https://github.com/bldgtyp/ph-navigator/issues/87) | [`features_v2.0/multi-tenant-teams/`](features_v2.0/multi-tenant-teams/STATUS.md) |
| Public account recovery + email | [#88](https://github.com/bldgtyp/ph-navigator/issues/88) | [`features_v2.0/public-account-recovery/`](features_v2.0/public-account-recovery/STATUS.md) |

## Completed / archived work

Every completed or superseded packet is indexed newest-first in
[`archive/README.md`](archive/README.md); grep it by slug. Do not treat
archived material as current unless an active packet points to it.

## Update rule

When an item reaches `Complete`, fold its outcome into the relevant `context/`
doc, move the packet flat-by-slug to `archive/<slug>/`, add a row (with the
closed-issue link) to `archive/README.md`, and let the PR close the issue.
