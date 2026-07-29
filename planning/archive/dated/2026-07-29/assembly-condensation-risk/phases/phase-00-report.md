---
DATE: 2026-07-28
UPDATED: 2026-07-29 — both policy recommendations explicitly accepted by Ed
TIME: 07:17 EDT
STATUS: Complete — evidence reproduced and both policy calls accepted
AUTHOR: Codex with Ed May
SCOPE: Phase 0 coverage evidence, seed target roster, policy calls, and go/no-go
RELATED: ./phase-00-coverage-probe.md, ../decisions.md §D-12/Q-8,
  ../PRD.md §8, ../../licensed-data-pipeline/phases/phase-04-mu-dataset-dry-run.md
---

# Phase 0 report — catalog vapour-data coverage

## Recommendation

**Go.** The deterministic material catalog can resolve **381 / 408 rows
(93.4%)** without per-product entry:

- 180 air-layer rows are calculation-time exemptions;
- 92 rows have a defensible ISO 10456 material-family match;
- 7 rows use the packet's vapour-tight `sd`-direct convention;
- 102 composite rows use the base/cavity material family with an uncertainty
  caveat.

The remaining 27 rows are intentionally not defaulted: 26 proprietary or
multi-material products require product data, and the generic `Stone` row has no
defensible value without a stone subtype/density. If those 26 product values are
entered, catalog-row coverage becomes **407 / 408 (99.8%)**.

No licensed values are recorded here. This report contains only row identity,
material-family match names, counts, and policy.

## Inputs and limits

- Catalog: `backend/seeds/catalogs/materials.v1.json`, 408 rows. The IDs are the
  stable target identities intended for the Phase 1 licensed-data `db_seed`
  applier.
- Assembly proxy: committed `backend/seeds/project/assemblies.json`, restricted
  to `outdoor_air` / `ventilated` (missing condition means `outdoor_air`, the
  document-model default).
- Production was not queried. Production reads and every production
  publish/apply event remain Ed-gated.
- Therefore the catalog result is decision-grade; the assembly-weighted result
  below is a reproducible proxy, not a claim about the production portfolio.

## Mapping policy

The match is deliberately conservative: a category alone is sufficient only
when it is materially homogeneous; heterogeneous categories use explicit names
or seed comments.

| Catalog family | Roster treatment |
| --- | --- |
| `air_*_heat_flow` | Exempt; engine supplies the ISO 13788 air-layer rule |
| Mineral/glass fibre, EPS, XPS, PIR, PU, cellulose, wood fibre, cork, AAC | Match the named bulk-material family |
| Gypsum, fibre-cement, stucco, PVC, timber/panels, masonry | Match the named bulk/sheet family |
| Metals and cellular glass | `sd`-direct vapour-tight convention |
| Legacy stud+cavity pseudo-materials | Match the cavity family named in `comments`; add the composite-path caveat |
| Rainscreen insulation with fasteners | Match the base insulation family; add the composite-path caveat |
| Proprietary boards, thermal breaks, doors, membranes | Product entry; never category-default |
| Generic `Stone` | Unmappable until subtype/density is known |

## Catalog coverage

| Class | Rows | Share |
| --- | ---: | ---: |
| Air-layer exempt | 180 | 44.1% |
| Direct family seed | 92 | 22.5% |
| `sd`-direct seed | 7 | 1.7% |
| Composite base/cavity seed | 102 | 25.0% |
| Product entry required | 26 | 6.4% |
| Unmappable | 1 | 0.2% |
| **Total** | **408** | **100.0%** |

The private `iso10456-vapor-mu` dataset target roster is the **201** direct,
`sd`-direct, and composite rows below. Air-layer rows do not belong in the
dataset. Product-entry and unmappable rows are listed separately so every
non-exempt row is accounted for.

## Assembly-weighted proxy

After applying the family roster:

| Proxy measure | Result |
| --- | ---: |
| Resolved layers | 5 / 5 (100%) |
| Fully computable outdoor-air/ventilated assemblies | 2 / 2 (100%) |

This is intentionally a small committed dev-seed proxy, not evidence of
production portfolio coverage. Each project material resolves through an
existing µ/sd value, a catalog-origin row classified by the same catalog
resolver, or an explicit named seed-family match. The resolver supports the
accepted per-product membrane-`sd` assumption if a membrane is later added to
the seed; broad category membership alone never counts as resolved.

## Policy calls

### Composite stud materials — accepted v1 policy

Use the cavity insulation family recorded in each legacy row's `comments`:
glass fibre, mineral wool, XPS, spray polyurethane, or the air-layer
`sd`-direct treatment for `No Insulation`. Surface an uncertainty caveat and
encourage re-modelling the stud/cavity as real segments. This retires the legacy
data blocker without pretending that the homogenized thermal row represents a
vapour-average material.

### `unconditioned_space` — accepted v1 policy

Do not screen it in v1. Report `not screened — adjacent space temperature not
modelled`. A nullable `adjacent_temp_factor` remains a v1.1 candidate. The
implementation must not invent a far-side temperature.

Ed explicitly accepted both recommendations on 2026-07-29. Private dataset
review/publication and every production action remain separate, explicit Ed
decisions.

## Seed target roster

Each line is `treatment | ISO/material-family entry name | count | catalog ids`.
Entry names are match keys only; no licensed table values appear.

```text
composite | air cavity sd-direct | 11 | recSGq4lTb8knCDFz, recovYs54EqDsXGO7, recRCz4LTb4Rni7zK, recKhj6vpylQ1WuFu, recSi1PjfmeOmA9FR, recoKO0Pl6PqQA2c5, recDFmenQbwpMDR0o, rec32KffjhxkmVC97, recKrkcDqn3raCHYl, receNsjbWlJfJFJ6a, receBfLkJ4Q5T2tDF
composite | extruded-polystyrene insulation | 23 | recp0kEzzPbyLztIC, recxEBU06uzpK2WyX, rec5V7cN9Bjas1xan, recvIraC8xN9zBiXY, recVJRwnXXSA1Ne7y, recsL0p6bseLeJr0c, recRorInFnKjChD70, rec6DCw2eDahNSKl3, recXUwhBZ4i3x4csR, recWOM045H5WUgUSR, recp8WePasq0wqMWH, rec6VfIoPhs3TKPw1, rece6D8DMjF77GGVO, recujNHFdIVlLtPyc, reco6uUJPivpCevTw, reco8JL5E8inlMxZn, receTXh4vTsCSjtr8, rec1dDnXlv9JOMWwr, recFiv60p2mOAadrh, recqii4Ix9pJj3OE4, recLmLZJO47c7N6b7, recJeGK1lOJaYxxW9, recCyFX7wvPGyJCMk
composite | glass-fibre insulation | 22 | recNhQa4RBWAcw1iT, rec629pZ6FBCHnzes, recrVoLlIJ5HDBoIZ, recG2V28uis3A3KCv, recUHDY6TEAU7HEOW, recU0m3mGRlvftD37, recD2zMlqqtxas2D8, rec2sWpJgblODnyGd, recFXwHd7gxcoySlO, recUbLu4ozl2kHwJE, recZXOQpPHF4I7LTC, recOWBsy7zfcaPC9o, recRMiC7ZzCNR6zxx, recSuK4qI5CqxfayH, recwJIQwd55n0D5TB, recCF7zi9pM12Qzl0, recME8phToTfqnCQw, recdrATzvuqF98HGo, rec0b95rajIYGbIrS, recZJLMsa8COWuTEJ, recNXTF0rTWO219Zb, recK7n2ItlMEYWRFK
composite | mineral-wool insulation | 24 | recuWq6FilIqUoPvg, recN36uT8vFBxX1PK, rec3XGjjptOc0tHfA, recU6rTxa2NPtdrln, recGUvWLDfHAIQcxF, rec0Iyt7ECcV5cykN, recrmcuBX151W2Zlv, recGGETI7bofSDeob, recWQwaMpDxWHPsq6, recWA1ddyJgbrgU5e, rec7MoLcESze6aaAH, recVseNXYoMBgBAdw, recBytiouxc9blwW9, recGrnuicRYvG4WaF, recsAKJlYUAItOl63, recz6SkWaBjNnll64, recm5XOLsjIcCBHcU, recMx9Rk6zbGB8JiR, recAHbrEY8hk2woEs, recfjqOhPjpO4Gr8c, recqJhSG0X6wtqT12, recQh4WBbSrZxG97e, rec4BZfwA3A2Z0JCs, recmT9gHyNbbtf1kR
composite | rigid polyurethane spray foam | 22 | rec1vpevkMkn8lNAo, recOK9uy4e7LpaU4S, recIDraA2bnpfQLdT, rect1BZ9nEGMTNpwp, recYUWL9F4yt68MBc, recQp4rT9JsTswQBA, rechlpFvVBrhCtpEM, recPu4YFsBNOs8Uqd, reck5DeEd7HDdUrOB, rec4iuxj9KQ3taiFD, recDRzCfiHOeW9E5N, recsuYhSh80uWTwUQ, recRmkKKK7NVyUeBX, recqoGhJoPdL3RXGV, recPuGPvoUbF99A33, recwRGaHFMrqTQyqB, recz0OpjJxA5QtTaV, recTIPPAy8sLv40W5, rec3GVCB1OhJCJzOP, recDGJil9ylsKt3t6, rec19CWqGe9gBacnW, recmNqY6WjjRwvUCS
sd-direct | cellular-glass vapour-tight layer | 1 | rec325aJ8SiAigyKa
sd-direct | vapour-tight sheet/layer | 6 | recLoCrv6OKJN5WEY, recMP78mw93R1GZnU, recsotGoZISzymYdE, recWOEr5vQVzdc7a9, recysxAWweFoLzCgx, rec4GEA1DcyjYaM8v
seed | OSB | 3 | recjDrqEfKAqq6iZh, recGRQRLcYjtWyKZb, rect56aq8olxGB1oA
seed | PVC cladding | 1 | rec4apNywqzoarvKp
seed | autoclaved aerated concrete | 2 | recj8lZRWam043KPB, recV8WsV6skVkMkZz
seed | cellulose-fibre insulation | 3 | recQLcTMG29Ewl9nN, recO3COZwICkFSGxo, recXUSzusImiFzo40
seed | cement render | 1 | recfxU4v3Ob2quigC
seed | cement/lime mortar | 2 | recXT03r8GrdspHdQ, recIrqQ4Qqb7O8m2k
seed | clay/concrete brick | 5 | recmBYWowrDjfqeHn, recBThSctzWqQd6Xy, recdKZcwRdW0seuPI, recn4xtROhaXLvh7g, rec3eWj8XwNWmluc9
seed | concrete/masonry unit | 6 | recbyXsniclUiDduq, recYzbLfjPvTqTwUW, recUFLtkJXIX4B8Cr, recwKDjuSLByEIAsS, recbDMKKVAE637uyV, reclCqSObOZVwEJ1u
seed | cross-laminated timber | 2 | recQEabfH2Vrbyawe, rec77a7B94Hp3cGzV
seed | expanded-cork insulation | 2 | recGEbSjB6OzRJUHk, recKx4Km80cNA9slS
seed | expanded-polystyrene insulation | 7 | recNLV2Iorz2VnTJf, recqYyjJ7IbO4L2mQ, recPXJjHVg0CcXDn5, recE7LgsjP6fFDbyh, recNbwMqxsrBOoRJC, recwEGXOy5zQDEAvw, recqCgk09Ww1XTWB7
seed | extruded-polystyrene insulation | 2 | recQMC8fQrsvOuacd, recYjJ77atscQECxA
seed | fibre-cement board | 2 | rec1Skjc8B21uDIWZ, recdjIJU6E9va8EPv
seed | glass-fibre insulation | 6 | recRoRDMqfkJCoe1D, recpTaFLcXECBwWM7, rec74gHadjhuVQxnG, recEBT5nIDkYV5FJj, recKycfQRulJX4rr2, recvAYNbsmlzkSa4q
seed | gypsum plasterboard | 2 | rec1HG6Vo9ovdqdNZ, recpKrKzwyW7aMmoh
seed | hardwood | 2 | recLigEQOBBX9mm5u, recBgdj93DyEqgSNn
seed | mineral-wool insulation | 15 | reccTd8w6QMlI21ZQ, rec5QO4muCMiAV9Bs, recrWOhyfWgbPlDlI, rec0dksPScE2Oqyv2, rec2T4K6KWazll0ug, recvwXy5nvYmHWoUr, rec1GytpUuT3H3d01, recYc9Bsj6ezPq3PU, recyCln6YT8fsKLj5, recgwJNBuX1t8mRkL, recTOpg9SRiSzw9mK, recT9GxPuvs1uFnll, rec0IYVBLdiFZHgC1, rec5SDO1gsk4R71mJ, recNuQtXOtryhneoS
seed | plywood | 2 | rec441iVV8pBqSsLj, recJT9Du0wLnismCU
seed | polyisocyanurate insulation | 11 | recWR7uQ8wkeZrgzR, recLolG7PFRk53UDx, recz1IBBMguZXd3ve, recUaFEm7P9sCGPdn, recj3MQIFvVYGmfTI, recfcgoIGTzvixGuL, rectqdC4dT6P5PEPc, recy7eqETyH3Cz2MZ, recQGZKxVyHa4gsdp, recRZFDUnMaSm9f9M, recNorhwGWnfV3Hct
seed | rigid polyurethane foam | 8 | recsWwKkYX58Qy1Ue, recyjzLPZzPBdYOwX, recjNSV2Mvdj96e0H, recSrOYxXAhvIynV7, recyvBoTVrRTGbhwV, recjdlNG4Cg5qr9mD, recC5OxIgOIJldntW, recIknHmQyRkdceN4
seed | softwood | 2 | recQq6VALWcpkiZDo, rec3bcmlphFEhNNip
seed | wood-fibre insulation board | 6 | rec7oIwiQ61ImRvoF, recmDWMvp3ryZfbMc, recUueb2mG4wrthum, recb2a0w1n2MjSrez, recvmWMv6oMPvqAcL, recHgFLTEYaF2w30p
```

## Product-entry and unmappable rows

These 27 rows are excluded from the private bulk seed:

```text
product | recRAj0MAh4147kry | 1in. Imperial Polyurethane
product | recfqXUX7u1C8ehwL | 1in. Imperial Polyurethane and Embossed
product | recuGJjTTUP30HlwW | 1in. Imperial Polyurethane and Half-Glass
product | recwV6wHmJRTJEUFC | 1in. Legion Polystyrene
product | recRcrP5jptRavxql | 1in. Legion Polystyrene and Half-Glass
product | recenGKREm5MtXPj6 | 1in. Medallion Steel Stiffened
product | reckLhjzUWaxqqPv3 | 1in. Trio-E Polyurethane and Steel Stiffened
product | recFpuRGfnoY1e2hE | AP Armaflex
product | reciFdOVbL6AVAfM1 | Armartherm 500-150
product | rech64rbG4dFNqXP4 | Armartherm 500-200
product | recLGMG72YHYWKngP | Armartherm 500-250
product | recheH04c8HnYUO0s | Armartherm FRR
product | recBh3RJrsw8Re9tx | Aspen Aerogels - Spaceloft Grey
product | rec3WCFyzyowJd1KG | Benchmark STB-1
product | recSB4vG02udzRVZV | CompaCFoam 100
product | rec2rOJBtl7Q9ycex | CompaCFoam 200
product | recyb47W3ijAsT5ua | DensElement Barrier System
product | recMQ6ZoIUsLOulCs | Fabreeka-TIM
product | reccjGz7n2dY3L7Oz | Fiberglass Solid Pultrusion
product | recu9GrfXo1cYtLIR | GWB (Densglas Fireguard)
product | recDdEWBZRPOqlD8u | GWB (Densglas Sheathing)
product | recyPs13kZWu3sfip | GWB (USG Securock)
product | recc96cLvKN7AjWGb | Kingspan OPTIM-R Vacum Panel
product | recktdMkjnsAfxdqB | Magnesium Board
product | recP8as4pnUNbHVqQ | Shoeck Isokorb (Typ)
product | recnhI3Jznoz7ELnY | Zip-R [EnergyShield CGF]
unmappable | rect2gk8xZzIo7m55 | Stone — subtype/density required
```

## Reproduction

`phase-00-probe.mjs` contains the exact catalog predicates and committed-seed
assembly resolver. From the repo root:

```bash
node planning/features/assembly-condensation-risk/phases/phase-00-probe.mjs
node planning/features/assembly-condensation-risk/phases/phase-00-probe.mjs --roster
node planning/features/assembly-condensation-risk/phases/phase-00-probe.mjs --assembly-proxy
```

The first command reproduces the 408-row class totals; `--roster` emits every
target/excluded row and match; `--assembly-proxy` reads the committed dev-seed
file and reproduces the 5/5 and 2/2 figures plus each material-resolution basis.
A layer resolves only when every segment resolves; an assembly computes only
when every layer resolves.

## Hand-off

Phase 1 may land the public µ/sd columns and applier. The 201-row roster is the
content hand-off to private `ph-navigator-data`; values, provenance review,
private publication, local dataset drill, and production application remain on
the licensed-data pipeline's explicit gates.
