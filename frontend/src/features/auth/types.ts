import type { UnitSystem } from "../../lib/units/types";

export type User = {
  id: string;
  email: string;
  display_name: string;
  units_preference: UnitSystem;
};

export type AuthSession = {
  user: User;
  expires_at: string;
  // Resolved global capability keys for affordance gating (e.g. the admin nav).
  // Authorization is always re-checked server-side; this only hides UI.
  capabilities: string[];
};
