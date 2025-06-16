# PH-Dashboard

## Data View:
#### Project Browser
- [ ] Better Landing page
- [ ] Delete Project
- [ ] Cancel / Save buttons on Project Config form don't work

#### (IO):
- [ ] Upload handles steel-stud continuous exterior insulation
- [ ] Upload corresponding Flixo PDF

## Material List:
- [ ] Add 'download' button to pdf/png file viewer
- [ ] PDF full-view looks a little odd... clean up a little.

## Assemblies (UI):
- [ ] HBJSON Download supports Steel Stud Assemblies
- [x] HBE Conversion to include mixed materials
  - [ ] Check what happens with uneven widths?
- [ ] Add Pagination (offset) to get_assemblies_as_hb_json() endpoint
- [ ] Display Material Legend
- [ ] Scale properly with screen
- [ ] Air-Cavity (automatic-thickness detection)


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
