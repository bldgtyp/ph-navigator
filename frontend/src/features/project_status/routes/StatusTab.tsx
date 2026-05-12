import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import { StatusEmptyState } from "../components/StatusEmptyState";
import { StatusItemModal } from "../components/StatusItemModal";
import { StatusItemRow } from "../components/StatusItemRow";
import {
  useApplyDefaultStatusTemplateMutation,
  useCreateStatusItemMutation,
  useDeleteStatusItemMutation,
  useStatusItemsQuery,
  useUpdateStatusItemMutation,
} from "../hooks";
import { nextStatusState, orderIndexForMove } from "../lib";
import type { StatusItem, StatusItemPayload } from "../types";

export function StatusTab({ project }: { project: ProjectDetail }) {
  const itemsQuery = useStatusItemsQuery(project.id);
  const applyTemplateMutation = useApplyDefaultStatusTemplateMutation(project.id);
  const createMutation = useCreateStatusItemMutation(project.id);
  const updateMutation = useUpdateStatusItemMutation(project.id);
  const deleteMutation = useDeleteStatusItemMutation(project.id);
  const [editingItem, setEditingItem] = useState<StatusItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isEditor = project.access_mode === "editor";

  const applyTemplate = () => {
    setActionError(null);
    applyTemplateMutation.mutate(undefined, {
      onError: (error) => setActionError(errorMessage(error, "Could not apply template.")),
    });
  };

  const addItem = async (payload: StatusItemPayload) => {
    await createMutation.mutateAsync(payload);
    setIsAdding(false);
  };

  const patchItem = async (itemId: string, payload: StatusItemPayload) => {
    await updateMutation.mutateAsync({ itemId, payload });
    setEditingItem(null);
  };

  const cycleState = (item: StatusItem) => {
    if (!isEditor) return;
    void patchItem(item.id, { state: nextStatusState(item.state) }).catch((error: unknown) => {
      setActionError(errorMessage(error, "Could not update item."));
    });
  };

  const deleteItem = (item: StatusItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setActionError(null);
    deleteMutation.mutate(item.id, {
      onError: (error) => setActionError(errorMessage(error, "Could not delete item.")),
    });
  };

  const moveItem = (item: StatusItem, direction: -1 | 1) => {
    const items = itemsQuery.data ?? [];
    const nextOrder = orderIndexForMove(items, item.id, direction);
    if (nextOrder === null) return;
    void patchItem(item.id, { order_index: nextOrder }).catch((error: unknown) => {
      setActionError(errorMessage(error, "Could not reorder item."));
    });
  };

  if (itemsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-labelledby="status-title">
        <h2 id="status-title">Status</h2>
        <p>Loading status items...</p>
      </section>
    );
  }

  if (itemsQuery.isError) {
    return (
      <section className="tab-panel" aria-labelledby="status-title">
        <h2 id="status-title">Status</h2>
        <p role="alert">{errorMessage(itemsQuery.error, "Could not load status items.")}</p>
      </section>
    );
  }

  const items = itemsQuery.data ?? [];
  const currentItemId = items.find((item) => item.state === "todo")?.id ?? null;

  return (
    <section className="tab-panel status-panel" aria-labelledby="status-title">
      <div className="status-heading">
        <div>
          <h2 id="status-title">Status</h2>
          <p>Track this project's lifecycle milestones.</p>
        </div>
        {isEditor && items.length > 0 ? (
          <button type="button" onClick={() => setIsAdding(true)}>
            Add item
          </button>
        ) : null}
      </div>
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {items.length === 0 ? (
        <StatusEmptyState
          isEditor={isEditor}
          projectId={project.id}
          onApplyTemplate={applyTemplate}
          onAddItem={() => setIsAdding(true)}
        />
      ) : (
        <div className="status-timeline" aria-label="Project status items">
          {items.map((item, index) => (
            <StatusItemRow
              key={item.id}
              item={item}
              isCurrent={item.id === currentItemId}
              isEditor={isEditor}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onCycleState={() => cycleState(item)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => deleteItem(item)}
              onMove={(direction) => moveItem(item, direction)}
            />
          ))}
        </div>
      )}
      {isAdding ? (
        <StatusItemModal
          title="Add status item"
          onCancel={() => setIsAdding(false)}
          onSubmit={addItem}
        />
      ) : null}
      {editingItem ? (
        <StatusItemModal
          title="Edit status item"
          item={editingItem}
          onCancel={() => setEditingItem(null)}
          onSubmit={(payload) => patchItem(editingItem.id, payload)}
        />
      ) : null}
    </section>
  );
}
