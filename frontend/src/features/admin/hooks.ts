import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deactivateUser,
  fetchAdminUsers,
  fetchUserAudit,
  generateResetLink,
  inviteUser,
  reactivateUser,
  setUserAdmin,
} from "./api";
import { adminQueryKeys } from "./query-keys";
import type { InviteUserPayload } from "./types";

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: adminQueryKeys.users,
    queryFn: ({ signal }) => fetchAdminUsers(signal),
  });
}

export function useUserAuditQuery(userId: string | null) {
  return useQuery({
    queryKey: userId ? adminQueryKeys.userAudit(userId) : adminQueryKeys.all,
    queryFn: ({ signal }) => fetchUserAudit(userId as string, signal),
    enabled: userId !== null,
  });
}

/** Shared invalidation: every user mutation can change the listing. */
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminQueryKeys.users });
}

export function useInviteUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    onSuccess: invalidate,
  });
}

export function useResetLinkMutation() {
  return useMutation({
    mutationFn: (userId: string) => generateResetLink(userId),
  });
}

export function useDeactivateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: invalidate,
  });
}

export function useReactivateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: invalidate,
  });
}

export function useSetUserAdminMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) =>
      setUserAdmin(userId, makeAdmin),
    onSuccess: invalidate,
  });
}
