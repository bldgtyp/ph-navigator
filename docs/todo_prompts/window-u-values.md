<context>
- @context/app.md
- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Page.tsx`
</context>

<task>
- Develop a plan for a new feature.
- **DO NOT IMPLEMENT** Plan only
- Write the Plan as a .MD file to the `docs/plans/...` folder
</task>

<feature>
- On the 'Windows' / 'Unit Builder' page, add a new label to the Header with the **Total Effective U-Value** of the window.
- Consider the entire window and ALL the window-elements which make up the full window.
</feature>

<reference>
- ISO 10077-1: `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/docs/reference/BS EN ISO 10077-1_2006 (Uw calc).pdf`
- ISO 10077-2: `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/docs/reference/ISO 10077-2-2017.pdf`
- Honeybee-PH Reference Implementation: `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/.venv/lib/python3.11/site-packages/honeybee_ph_utils/iso_10077_1.py`
<reference>

<method>
- Use the 'Passive House' method of calculating a Window U-Value
- The Passive House method matches ISO 10077-1: U_w = (Heatloss_frame + Heatloss_glass + Heatloss_spacer) / Area_win
- **NOTE:** Calculate the UNINSTALLED U-W. Disregard any Psi-Install value for this case.
</method>

<consider>
- Suggested Implementation: 
1) Calculate Heat-loss value for each 'side' (top, left, right, bottom) using: length x width x frame-element-u-value
2) Calculate Heat-loss value for the glass: area * glass-u-value
3) Calculate Heat-loss value for the spacer: length * psi-value
- Glazing-area = total-area - frame-area
- Consider the potential 'overlap' of frame elements at the corners
- Consider that the 'spacer' length is around the 'inside' of the frame elements.
- All the 'backend' data for the windows and all frame/glass are **ALWAYS** in SI units.
- Since we are 'calculating' something, we need to be EXTRA careful about documentation and verification.
- Complete verification tests will be *CRITICAL* for this feature.
- We should include a '?' bubble or text tooltip with reference / citation for the method used here to ensure full transparency.
</consider>

<database-considerations>
- Database changes must be considered *VERY* carefully, and minimized where possible.
- *ANY* changes to the database or data schema for any entities on the backend should *NEVER* cause breaking changes OR any backwards-incompatibility.
</database-considerations>
