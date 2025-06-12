# PH-Dashboard


## Data View:
#### Project Browser
- [ ] Better Landing page
- [x] Add Config / Projects Button to Browser
- [x] Add New Project
- [x] Set Project AirTable Refs
- [x] Figure out API-Key strategy
- [ ] Delete Project
- [ ] Cancel / Save buttons on Project Config form don't work

#### (IO):
- [-] Serialize HBJSON Constructions (download)
  - [x] Grasshopper Component
  - [x] UI Button 
- [x] De-Serialize HBJSON Constructions (upload)
- [x] Upload handles steel-stud cavity insulation
- [ ] Upload handles steel-stud continuous exterior insulation
- [x] Consider limiter (slowAPI) for all endpoints?
- [ ] Upload corresponding Flixo PDF (link)
- [x] Setup Database migration tooling

## Material List:
- [x] Materials DataGrid page gets data from Constructions (not AirTable)
- [x] Handle and Store Material Submittals
  - [x] Add 'delete' button to Material Modal viewer
  - [x] Add 'delete' button to Datasheet Modal viewer
- [ ] add .pdf, .jpg, .png validation to upload
- [ ] handle Upload PDFs?
- [ ] resize .png for full-size (make smaller)
- [ ] Add image carousel / scroll
- [x] Add Comments / Notes
- [x] Add download as HBJSON button
  - [ ] Support Steel Stud Assemblies
- [ ] Show only one item for each Material in the Layer (when multiple segments with same material)
- [x] Add Loading state to file uploads

## Assemblies (UI):
- [x] BUG: Delete Layer / Segment doesn't update UI until Refresh
- [x] Material Color
- [x] Filtered by Project
- [x] Add New
- [x] Select Assembly from Dropdown list
- [x] Delete
- [x] Fix Material-Refresh to clear local-storage
- [x] Set Name of Assembly
- [x] Alphabetize Assembly Select
- [x] Turn off editing for non-login users
- [x] API endpoint for getting Construction into Rhino
- [x] API-Key / Token for Rhino access
- [x] Clean Material and Assembly Names for Honeybee-Energy Construction conversion
- [x] HBE Conversion to include mixed materials
  - [ ] Check what happens with uneven widths?
- [x] Fix: Add-segment button doesn't go away after Modal
- [ ] Add Pagination (offset) to get_assemblies_as_hb_json() endpoint
- [x] Display Material Attributes
- [x] Add Loading State to Material Refresh Button
- [ ] Display Material Legend
- [ ] IP Units for all (conversion)
- [ ] Scale properly with screen
- [ ] Air-Cavity (automatic-thickness detection)
- [x] Steel-Stud-Cavity checkbox
- [x] Steel-Stud-Cavity (automatic-thickness detection)

#### Honeybee-PH Tools:
- [ ] When getting materials from new DB, Add thickness to material name (avoid HB Model conflicts)


## 3D Model:
#### Get Geometry:
- [ ] Thermal Bridge Edges
- [ ] Winter / Summer Window Radiation Grid and Legend
- [ ] Add persistent North arrow someplace (for non-shading views)
- [ ] Get Doors
- [ ] iCFA / Geometry Outlines using 'boundary' don't work for donut shapes. Shift to use edge-helper like on shading meshes
- [ ] Property Lines, curb/street edges, street-name / label
- [ ] Adjacent buildings as semi-opaque somehow?

#### Get Systems:
- [ ] Ventilation
  - [ ] Ducting 
  - [ ] ERV unit (note: need to add geom to HBPH / GH)
- [ ] Plumbing
  - [ ] Piping
  - [ ] Hot Water Tanks and Heaters (note: need to add geom to HBPH / GH)

#### UI:
- [ ] Sun-path:
  - [ ] Time of Day control (connect to sunlight position)
  - [ ] Add Compass with Cardinal Directions
- [ ] Adjustable clipping plane (vertical adjustment at least, to see levels)
- [ ] Update selectable objects with vis-state

#### Tables:
- [ ] Windows Table (frames, glass, units)
- [ ] Constructions Table (with Materials)
- [ ] Searchable
- [ ] add a u-value list with sliders to the face data panel 
  - [ ] Add a Window U-Value section below

#### Dimensions:
- [ ] Add 'escape' to clear current dimension
- [ ] Add rubber-band line
- [ ] Add 'first vertex' persistent marker
- [ ] Add guard against 0-length markers
- [ ] Add new option to select face, show face-id/name and aut-dimension all edges

#### Selection:
- [ ] When selecting a surface for query - show all the edge-dims in very light text
- [ ] Multiple Object Select (reflected in object properties panel)
- [ ] LMB crossing box to select
- [ ] ctrl-LMB (Windows Style)?
- [ ] Plumbing Pipes
  - [ ] When selecting, show the dims alongside
- [ ] Ventilation Ducting
- [ ] LMB select in negative space to de-select
- [ ] Add 'escape' to clear surface select

#### Object Properties Panel:
- [ ] Face Data - truncate names / identifiers
- [ ] Don't like constant opening/closing. 
- [ ] Should have option to close
- [ ] Tighten up text fields. Too much spacing

#### Color by:
- [ ] Boundary Condition
- [ ] Assembly Type
- [ ] TFA Factor
- [ ] Ventilation (sup/eta)

#### Search Panel:
- [ ] Select Similar to current selection
- [ ] By boundary-condition type
- [ ] By surface/object type
- [ ] By Construction Type
- [ ] By Name / Prefix 

#### NavBar:
- [ ] Add EPW file data source. Location in upper right (map link)
- [ ] Add model refresh button

#### Comments 
- [ ] Create new honeybee-tracker plugin
- [ ] Add 'comments' storage to all relevant honeybee-objects `.properties`
- [ ] Integrate comments library into ph-navigator
  - [ ] Try: [react-chat-window](https://www.npmjs.com/package/react-chat-window?activeTab=readme)

#### Scene:
- [ ] Auto-bounds (ground, shadows) based on loaded geometry size:
  - [ ] grid
  - [ ] lights
  - [ ] camera location
  - [ ] shadow map
- [ ] Camera 'reset' button someplace
- [ ] Intentionally ignore coincident face display conflict (ground)
- [ ] Add default 'pan/rotate' tool-state

#### Export:
- [ ] JSON
  -  Add 'Download' icon, not just link icon 
- [ ] CSV
- [ ] Download
