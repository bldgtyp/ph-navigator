// Sub-tab bar across the top of the Equipment panel. The remaining
// sub-tabs (Thermal Bridges, ERVs, Pumps, Fans) ship in follow-up PRs;
// they appear as disabled placeholders until then so users see the
// shape of the tab.

export function EquipmentSubTabBar() {
  return (
    <div className="subtabbar" aria-label="Equipment tables">
      <button type="button" className="active">
        Rooms
      </button>
      <button type="button" disabled>
        Thermal Bridges
      </button>
      <button type="button" disabled>
        ERVs
      </button>
      <button type="button" disabled>
        Pumps
      </button>
      <button type="button" disabled>
        Fans
      </button>
    </div>
  );
}
