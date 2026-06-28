export const adminQueryKeys = {
  all: ["admin"] as const,
  users: ["admin", "users"] as const,
  userAudit: (userId: string) => ["admin", "users", userId, "audit"] as const,
};
