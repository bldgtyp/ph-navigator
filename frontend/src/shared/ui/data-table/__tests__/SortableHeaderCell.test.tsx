import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { describe, expect, test } from "vitest";
import { SortableHeaderCell } from "../components/SortableHeaderCell";

// Wraps the cell in the minimum context dnd-kit's `useSortable`
// needs: `DndContext` (for the draggable / droppable registry) and
// `SortableContext` (for the items list). A real consumer renders a
// `<table>` around the `<th>`; here we wrap in a single-cell table so
// the DOM is valid HTML and `getByRole("columnheader")` resolves.
function renderHeaderCell(props: {
  id: string;
  isPrimary: boolean;
  isPickedUp?: boolean;
}) {
  const items = [props.id];
  return render(
    <DndContext>
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        <table>
          <thead>
            <tr>
              <SortableHeaderCell
                id={props.id}
                isPrimary={props.isPrimary}
                ariaColIndex={1}
                className="data-table-th"
                fieldEditable={false}
                fieldEditorOpen={false}
                isPickedUp={props.isPickedUp}
                cellRef={() => undefined}
              >
                <span>{props.id}</span>
              </SortableHeaderCell>
            </tr>
          </thead>
        </table>
      </SortableContext>
    </DndContext>,
  );
}

describe("SortableHeaderCell", () => {
  test("renders the child content inside a columnheader `<th>`", () => {
    renderHeaderCell({ id: "name", isPrimary: false });
    const header = screen.getByRole("columnheader", { name: "name" });
    expect(header.tagName).toBe("TH");
  });

  test("non-primary cell carries data-draggable for the grab-cursor affordance", () => {
    renderHeaderCell({ id: "name", isPrimary: false });
    const header = screen.getByRole("columnheader", { name: "name" });
    expect(header.getAttribute("data-draggable")).toBe("true");
  });

  test("primary cell omits data-draggable so the cursor stays at column-select default", () => {
    renderHeaderCell({ id: "number", isPrimary: true });
    const header = screen.getByRole("columnheader", { name: "number" });
    expect(header.getAttribute("data-draggable")).toBeNull();
  });

  test("isPickedUp flag adds data-picked-up + aria-grabbed for keyboard reorder", () => {
    renderHeaderCell({ id: "name", isPrimary: false, isPickedUp: true });
    const header = screen.getByRole("columnheader", { name: "name" });
    expect(header.getAttribute("data-picked-up")).toBe("true");
    expect(header.getAttribute("aria-grabbed")).toBe("true");
  });
});
