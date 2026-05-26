import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { UnitPreferenceProvider } from "../lib/units";
import { createQueryClient } from "./query-client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </UnitPreferenceProvider>
    </QueryClientProvider>
  );
}
