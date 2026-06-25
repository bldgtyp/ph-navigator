import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { envelopeQueryKeys } from "../../envelope/query-keys";
import { projectQueryKeys } from "../../projects/query-keys";
import {
  invalidateProjectDocumentQueries,
  projectDocumentQueryKeys,
  projectDocumentTableQueryKeys,
} from "../hooks";

const PROJECT_ID = "project-1";
const VERSION_ID = "version-1";

describe("invalidateProjectDocumentQueries", () => {
  test("invalidates envelope caches after document lifecycle changes", async () => {
    const queryClient = new QueryClient();
    const envelopeReadKey = envelopeQueryKeys.read(PROJECT_ID, VERSION_ID, "draft");
    const envelopeThermalKey = envelopeQueryKeys.thermal(
      PROJECT_ID,
      VERSION_ID,
      "assembly-1",
      "draft",
    );
    const envelopeDriftKey = envelopeQueryKeys.materialDrift(PROJECT_ID, VERSION_ID, "draft");
    const tableKey = projectDocumentTableQueryKeys.table(PROJECT_ID, "rooms");

    queryClient.setQueryData(projectQueryKeys.detail(PROJECT_ID), { id: PROJECT_ID });
    queryClient.setQueryData(projectDocumentQueryKeys.document(PROJECT_ID, VERSION_ID), {});
    queryClient.setQueryData(tableKey, []);
    queryClient.setQueryData(envelopeReadKey, {});
    queryClient.setQueryData(envelopeThermalKey, {});
    queryClient.setQueryData(envelopeDriftKey, {});

    await invalidateProjectDocumentQueries(queryClient, PROJECT_ID);

    expect(queryClient.getQueryState(envelopeReadKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(envelopeThermalKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(envelopeDriftKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(tableKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectQueryKeys.detail(PROJECT_ID))?.isInvalidated).toBe(
      true,
    );
  });

  test("keeps the existing detail/table switches while still invalidating envelope caches", async () => {
    const queryClient = new QueryClient();
    const detailKey = projectQueryKeys.detail(PROJECT_ID);
    const tableKey = projectDocumentTableQueryKeys.table(PROJECT_ID, "rooms");
    const envelopeReadKey = envelopeQueryKeys.read(PROJECT_ID, VERSION_ID, "draft");

    queryClient.setQueryData(detailKey, { id: PROJECT_ID });
    queryClient.setQueryData(tableKey, []);
    queryClient.setQueryData(envelopeReadKey, {});

    await invalidateProjectDocumentQueries(queryClient, PROJECT_ID, {
      detail: false,
      tables: false,
    });

    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(tableKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(envelopeReadKey)?.isInvalidated).toBe(true);
  });
});
