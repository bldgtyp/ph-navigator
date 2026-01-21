# PH-Navigator (WIP)

---

## Data View:

### Project Browser

- [ ] Better Landing page
- [ ] Implement Delete Project

### UI:

- [ ] Force Light Theme background

### (IO):

- [ ] Upload handles steel-stud continuous exterior insulation
- [ ] Upload corresponding Flixo PDF

### Material List:

- [x] Change so that the Assemblies are the first page, not materials
- [ ] Fix slow google-cloud image load
- [ ] Add 'download' button to pdf/png file viewer
- [ ] PDF full-view looks a very odd... clean up.
- [ ] Materials should have URL link(s) option
- [ ] Delete Image
- [ ] Delete Datasheet
- [ ] Multiple Datasheets?

### Assemblies (UI):

- [x] Add calculated R-Value / U-Value label
- [x] Display Material Legend with key material info (conductivity)
- [x] Add total thickness label
- [x] Add Pagination (offset) to get_assemblies_as_hb_json() endpoint
- [x] R-Value Label preview Does NOT work with Steel-Stud Assemblies currently
- [x] HBE Conversion to include mixed materials
  - [ ] Check what happens with uneven widths on different layers?
- [ ] Scale properly with screen
- [ ] Air-Cavity (automatic-thickness detection)
- [ ] Material copy/paste between Assemblies
- [ ] Handle fasteners (view, inputs, include in R-Value calc)
  - [ ] Add to Json download? Check Honeybee-PH
- [ ] Add 'PHPP' style download button (download as CSV)
- [ ] Handle Load-from-JSON Steel Stud Assemblies.
- [ ] Consider caching/storing the total Assembly U-Value on the DB-entity to reduce server workload?

### Ventilation Commissioning Page

- [ ] Room by room flow-rate page
- [ ] Ventilation Balancing page
- [ ] Add instructions
- [ ] Add note about form SIGNED

### Thermal Bridges

- Add TB record view page
- Link to AirTable

### Windows:

- [x] Scale window unit geometry
- [x] Window Frame Database (AirTable)
- [x] Window Glazing Database (AirTable)
- [x] Assign frames (frame DB elements)
- [x] Assign glass (glass DB elements)
- [x] Attribute reporting (& assignment) table
- [x] Add window U-Value
- [ ] Change Element blocks to be inside a scrollable container so we always see the window graphic
- [ ] Select individual frame elements allows direct setting (dropdown)
- [ ] Double click to enter 'editing' mode? Bring up editing panel?
- [ ] Cron-job frame-type / glass-type autoloader from AirTable
- [ ] Add an UNDO to frame/glass assignment
- [x] Add window-element U-Value (might refactor Uw calc?)
- [x] Uw Value Label doesn't respect SI | IP state.
- [x] Consider caching/storing the total Uw on the DB-entity to reduce server workload?

---

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

- [x] Face Data - truncate names / identifiers
- [x] Don't like constant opening/closing.
- [x] Should have option to close
- [x] Tighten up text fields. Too much spacing

#### Color by:

- [x] Boundary Condition
- [x] Assembly Type
- [x] Construction Name (Opaque)
- [x] Construction Name (Apertures)
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
  - Add 'Download' icon, not just link icon
- [ ] CSV
- [ ] Download
