export type AdminUserStatus = "active" | "invited" | "inactive";
export type AdminUserRolePreset = "user" | "admin";
export type AccountTokenType = "invite" | "password_reset";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  status: AdminUserStatus;
  role: AdminUserRolePreset;
  is_staff: boolean;
  created_at: string;
  last_action_at: string | null;
};

export type IssuedAccountLink = {
  token_type: AccountTokenType;
  link: string;
};

export type AdminAuditEntry = {
  id: number;
  action: string;
  actor_user_id: string | null;
  actor_email: string | null;
  target_email: string | null;
  ip_address: string | null;
  created_at: string;
  details: Record<string, unknown>;
};

export type InviteUserPayload = {
  email: string;
  display_name: string;
  role: AdminUserRolePreset;
};

export type UpdateUserNamePayload = {
  userId: string;
  displayName: string;
};

export type UpdateUserEmailPayload = {
  userId: string;
  email: string;
};

export type InviteUserResult = {
  user: AdminUser;
  link: IssuedAccountLink;
};

export type ReactivateUserResult = {
  user: AdminUser;
  link: IssuedAccountLink;
};
