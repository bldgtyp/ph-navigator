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

- [ ] Fix slow google-cloud image load
- [ ] Add 'download' button to pdf/png file viewer
- [ ] PDF full-view looks a very odd... clean up.
- [ ] Materials should have URL link(s) option
- [ ] Delete Image
- [ ] Delete Datasheet
- [ ] Multiple Datasheets?

### Assemblies (UI):

- [ ] Add a 'loading' state
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
- [ ] Dimension input allows simple arithmetic (ie: 100/2, etc..)
- [ ] Layer dim edit direct (like windows) not in modal window

### Ventilation Commissioning Page

- [ ] Room by room flow-rate page
- [ ] Ventilation Balancing page
- [ ] Add instructions
- [ ] Add note about form SIGNED

### Thermal Bridges

- Add TB record view page
- Link to AirTable

### Windows:

- [ ] Add a 'loading' state
- [ ] Change Element blocks to be inside a scrollable container so we always see the window graphic
- [ ] Select individual frame elements allows direct setting (dropdown)
- [ ] Double click to enter 'editing' mode? Bring up editing panel?
- [ ] Cron-job frame-type / glass-type autoloader from AirTable
- [ ] Add an UNDO to frame/glass assignment
- [ ] U-w is still REALLY slow to load for some reason?
- [ ] Add loading state until duplicate is done. Remove popup message window.

---

## 3D Model:

#### Get Geometry:

- [ ] Consider Browser caching?
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

- [ ] Disable right-mouse click (grrr.... Rhino!)
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

#### Search Panel:

- [ ] Select Similar to current selection
- [ ] By boundary-condition type
- [ ] By surface/object type
- [ ] By Construction Type
- [ ] By Name / Prefix

#### NavBar:

- [ ] Add EPW file data source. Location in upper right (map link)

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
