<context>
- @context/app.md
- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/frontend/src/features/project_view/data_views/envelope/assemblies/_Page/EffectiveRValueLabel.tsx`
- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/features/assembly/services/thermal_resistance.py`
</context>

<task>
- Research the topic and existing objects/attributes/functions to be sure that you fully understand before outlining any plans or implementation.
- Develop a PLAN for a refactor/bug-fix to an existing feature.
- **DO NOT IMPLEMENT** Plan only
- Write the Plan as a .MD file to the `docs/plans/...` folder
</task>

<feature>
- On the 'Envelope' / 'Assembly' page, we have an 'Effective R-Value' label in the Header. Currently, this label and the backend calculation do **NOT** properly take into account the 'steel stud' impact on thermal performance. 
- Please research the current implementation of 'Steel-stud' in the assembly and make sure that our calculation is taking into account the impact of these elements. 
</feature>

<reference>
Review 'steel-stud' use and implementation in depth within at least:
- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/features/assembly/services/to_hbe_material_steel_stud.py`
- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/features/assembly/services/assembly_from_hbjson.py`
- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/features/assembly/services/assembly_from_hbjson.py`
<reference>

<consider>
- All the 'backend' data for the windows and all frame/glass are **ALWAYS** in SI units.
- Since we are 'calculating' something, we need to be EXTRA careful about documentation and verification.
- Complete verification tests will be *CRITICAL* for this feature.
</consider>

<database-considerations>
- Database changes must be considered *VERY* carefully, and minimized where possible.
- *ANY* changes to the database or data schema for any entities on the backend should *NEVER* cause breaking changes OR any backwards-incompatibility.
</database-considerations>
