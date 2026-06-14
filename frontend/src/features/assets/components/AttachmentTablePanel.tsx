import { useMemo } from "react";
import { AttachmentRowsTable } from "./AttachmentRowsTable";
import { useAttachmentRows, useReplaceAttachmentRows } from "../hooks";
import type { AttachmentFieldConfig, AttachmentRow } from "../types";

export function AttachmentTablePanel({
  projectId,
  versionId,
  accessMode,
  versionLocked,
  tableName,
  title,
  fieldKey,
  fieldLabel,
  config,
}: {
  projectId: string;
  versionId: string | null;
  accessMode: "editor" | "viewer";
  versionLocked: boolean;
  tableName: string;
  title: string;
  fieldKey: string;
  fieldLabel: string;
  config: AttachmentFieldConfig;
}) {
  const query = useAttachmentRows(projectId, versionId, tableName, accessMode);
  const mutation = useReplaceAttachmentRows(projectId, versionId, tableName);
  const readOnly = accessMode !== "editor" || versionLocked;
  const normalizedConfig = useMemo(() => config, [config]);

  if (query.isLoading) {
    return (
      <section className="attachment-panel">
        <h3>{title}</h3>
        <p>Loading...</p>
      </section>
    );
  }
  if (query.isError || !query.data) {
    return (
      <section className="attachment-panel">
        <h3>{title}</h3>
        <p>Could not load this attachment table.</p>
      </section>
    );
  }
  return (
    <section className="attachment-panel">
      <h3>{title}</h3>
      <AttachmentRowsTable
        projectId={projectId}
        slice={query.data}
        tableName={tableName}
        readOnly={readOnly}
        fieldKey={fieldKey}
        fieldLabel={fieldLabel}
        config={normalizedConfig}
        onReplaceRows={async (rows: AttachmentRow[]) => {
          await mutation.mutateAsync({ current: query.data, payload: { rows } });
          await query.refetch();
        }}
      />
    </section>
  );
}
