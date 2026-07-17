import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { getCatalogOptionJob, retryCatalogOptionJob } from "../api";
import { catalogQueryKeys } from "../query-keys";
import type { CatalogOptionJob } from "../types";

export function CatalogOptionCascadeProgressModal({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [retryRequested, setRetryRequested] = useState(false);
  const jobQuery = useQuery({
    queryKey: catalogQueryKeys.optionJob(jobId),
    queryFn: ({ signal }) => getCatalogOptionJob(jobId, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return retryRequested || status === "pending" || status === "running" ? 750 : false;
    },
  });
  const retry = useMutation({
    mutationFn: () => retryCatalogOptionJob(jobId),
    onSuccess: (job) => {
      queryClient.setQueryData(catalogQueryKeys.optionJob(jobId), job);
      setRetryRequested(true);
    },
  });

  useEffect(() => {
    if (jobQuery.data?.status !== "failed") setRetryRequested(false);
  }, [jobQuery.data?.status]);

  if (jobQuery.isError) {
    return (
      <ModalDialog
        title="Catalog update status unavailable"
        titleId="catalog-option-cascade-status-error-title"
        onClose={onClose}
      >
        <div className="catalog-option-cascade-modal">
          <p className="form-error" role="alert">
            {errorMessage(jobQuery.error, "Could not load the catalog update status.")}
          </p>
          <div className="catalog-option-cascade-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
            <button type="button" onClick={() => void jobQuery.refetch()}>
              Try again
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  const job = jobQuery.data;
  const working =
    job === undefined || job.status === "pending" || job.status === "running" || retryRequested;
  const title = working
    ? "Updating project references…"
    : job.status === "completed"
      ? "Catalog update complete"
      : "Catalog update needs attention";

  return (
    <ModalDialog
      id="catalog-option-cascade-progress"
      title={title}
      titleId="catalog-option-cascade-progress-title"
      onClose={working ? () => undefined : onClose}
      showHeaderClose={!working}
    >
      <div className="catalog-option-cascade-modal" aria-busy={working || undefined}>
        {job === undefined ? (
          <p role="status">Preparing the catalog update…</p>
        ) : (
          <CascadeStatus job={job} working={working} />
        )}
        {job?.status === "failed" && !retryRequested ? (
          <>
            <p className="form-error" role="alert">
              {job.error ?? "The catalog update did not finish."}
            </p>
            {retry.error ? (
              <p className="form-error" role="alert">
                {errorMessage(retry.error, "Could not restart the catalog update.")}
              </p>
            ) : null}
            <div className="catalog-option-cascade-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Close
              </button>
              <button type="button" disabled={retry.isPending} onClick={() => retry.mutate()}>
                {retry.isPending ? "Retrying…" : "Retry project update"}
              </button>
            </div>
          </>
        ) : null}
        {job?.status === "completed" ? (
          <div className="catalog-option-cascade-actions">
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        ) : null}
      </div>
    </ModalDialog>
  );
}

function CascadeStatus({ job, working }: { job: CatalogOptionJob; working: boolean }) {
  const result = job.result;
  return (
    <>
      <p role="status">
        {working
          ? `${job.processed_projects} of ${job.total_projects} projects updated (${job.progress}%).`
          : `${result.projects_touched} projects updated.`}
      </p>
      <div
        className="catalog-option-cascade-progress"
        role="progressbar"
        aria-label="Project update progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={job.progress}
      >
        <span style={{ width: `${job.progress}%` }} />
      </div>
      <dl className="catalog-option-cascade-summary">
        <div>
          <dt>Projects touched</dt>
          <dd>{result.projects_touched}</dd>
        </div>
        <div>
          <dt>References rewritten</dt>
          <dd>{result.refs_rewritten}</dd>
        </div>
        <div>
          <dt>Filters rewritten</dt>
          <dd>{result.filters_rewritten}</dd>
        </div>
        <div>
          <dt>Failures</dt>
          <dd>{result.failures}</dd>
        </div>
      </dl>
      {job.project_results.length > 0 ? (
        <details className="catalog-option-cascade-projects" open={working}>
          <summary>Project progress</summary>
          <ul>
            {job.project_results.map((project) => (
              <li key={project.project_id} data-status={project.status}>
                <div>
                  <span>{project.project_name}</span>
                  {project.error ? (
                    <p className="catalog-option-cascade-project-error">{project.error}</p>
                  ) : null}
                </div>
                <span>{project.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
