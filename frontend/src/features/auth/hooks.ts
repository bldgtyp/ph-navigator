import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mcpTokenQueryKeys } from "../mcp/hooks";
import { projectDocumentTableQueryKeys } from "../project_document/query-keys";
import { projectQueryKeys } from "../projects/query-keys";
import { clearSidebarViewStateCache } from "../sidebar_views/hooks";
import type { UnitSystem } from "../../lib/units/types";
import { fetchCurrentSession, signIn, signOut, updateUnitsPreference } from "./api";

export const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export function useSessionQuery() {
  return useQuery({
    queryKey: authQueryKeys.session,
    queryFn: ({ signal }) => fetchCurrentSession(signal),
  });
}

export function useSignInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKeys.session, session);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: projectDocumentTableQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: mcpTokenQueryKeys.all });
    },
  });
}

export function useSignOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: authQueryKeys.session });
      queryClient.removeQueries({ queryKey: projectQueryKeys.all });
      queryClient.removeQueries({ queryKey: projectDocumentTableQueryKeys.all });
      queryClient.removeQueries({ queryKey: mcpTokenQueryKeys.all });
      // Sign-out is a client navigation (no hard reload), so drop the module-level
      // sidebar-order cache too — the next user must not inherit this one's order.
      clearSidebarViewStateCache();
    },
  });
}

export function useUpdateUnitsPreferenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitsPreference: UnitSystem) => updateUnitsPreference(unitsPreference),
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKeys.session, session);
    },
  });
}
