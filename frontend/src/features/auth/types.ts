export type User = {
  id: string;
  email: string;
  display_name: string;
};

export type AuthSession = {
  user: User;
  expires_at: string;
};
