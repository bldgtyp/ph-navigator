# Licensing

PH-Navigator is copyright BLDGTYP, LLC and is released under the GNU Affero General
Public License, version 3 or later (`AGPL-3.0-or-later`). The full text is in
[`LICENSE`](LICENSE). The same license covers the backend and the frontend.

## What the AGPL means here

- **Use and self-host freely.** Run PH-Navigator for your own firm, on your own
  infrastructure, with no obligation to anyone. The AGPL restricts redistribution and
  modified network services, not use.
- **Modify and host for others: publish your changes.** If you modify PH-Navigator and
  let other people use it over a network, AGPL section 13 requires you to offer them the
  source of your modified version.
- **Proprietary layers need a commercial license.** Code that links to or extends
  PH-Navigator in-process and is kept closed is not permitted under the AGPL. BLDGTYP
  offers commercial licenses for that case. Contact ed@bldgtyp.com.

BLDGTYP's hosted service at ph-nav.com runs this same code base.

## Why AGPL

The backend links at runtime to `ladybug-core`, `honeybee-core`, and `honeybee-energy`
(AGPL-3.0) and to `honeybee-ph`, `honeybee-ref`, and `PHX` (GPL-3.0-or-later). A
network-served combination of that code already carries AGPL obligations, so AGPL for
PH-Navigator itself adds no new burden on users and needs no refactoring of the
dependency boundary. It also keeps the code open for self-hosters while preventing
closed hosted forks.

## Contributions

BLDGTYP dual-licenses PH-Navigator (AGPL publicly, commercial on request). That is only
possible if BLDGTYP holds the rights to every line. Outside contributions therefore
require a signed Contributor License Agreement before merge. See [`CLA.md`](CLA.md).

## Data, not code

The catalog seed files under `backend/seeds/catalogs/` are data, and the AGPL is a
software license. A separate data license for the catalogs (CC BY 4.0 is the intended
choice) will be added after a provenance review of the rows. Until that lands, treat the
seed files as all rights reserved, and never commit PHI-, Phius-, PHPP-, or WUFI-derived
data to this repository (see `CLAUDE.md`).

## Status

The license choice and the CLA text are pending review by counsel. Nothing here is legal
advice.
