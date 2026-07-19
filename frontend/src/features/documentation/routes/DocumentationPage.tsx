import "../documentation.css";
import "../../project_status/status_summary.css";
import { useMemo } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import { useAssetUrls } from "../../assets/hooks";
import type { AssetUrls } from "../../assets/types";
import { allDocumentationAssetIds } from "../lib";
import { useDocumentationSummaryQuery } from "../hooks";
import { DocumentationSummaryView } from "../components/DocumentationSummaryView";

export function DocumentationPage({ project }: { project: ProjectDetail }) {
  const query = useDocumentationSummaryQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const assetIds = useMemo(
    () => allDocumentationAssetIds(query.data?.sections ?? []),
    [query.data?.sections],
  );
  const assetUrls = useAssetUrls(project.id, assetIds);
  const assetUrlById = useMemo<ReadonlyMap<string, AssetUrls>>(
    () => new Map((assetUrls.data ?? []).map((asset) => [asset.asset_id, asset])),
    [assetUrls.data],
  );

  if (!project.active_version_id) {
    return (
      <section className="tab-panel documentation-page" aria-labelledby="documentation-title">
        <h2 id="documentation-title">Documentation</h2>
        <p className="status-section-empty">Create a project version to review documentation.</p>
      </section>
    );
  }

  if (query.isLoading) {
    return (
      <section className="tab-panel documentation-page" aria-labelledby="documentation-title">
        <h2 id="documentation-title">Documentation</h2>
        <p role="status">Loading documentation...</p>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="tab-panel documentation-page" aria-labelledby="documentation-title">
        <h2 id="documentation-title">Documentation</h2>
        <div className="status-section-error" role="alert">
          <p>{errorMessage(query.error, "Could not load documentation.")}</p>
          <button type="button" className="secondary-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <DocumentationSummaryView project={project} summary={query.data} assetUrlById={assetUrlById} />
  );
}
