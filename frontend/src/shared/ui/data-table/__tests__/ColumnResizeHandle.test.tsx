import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ColumnResizeHandle } from "../components/ColumnResizeHandle";

function renderHandle(props?: Partial<React.ComponentProps<typeof ColumnResizeHandle>>) {
  const onPointerDown = props?.onPointerDown ?? vi.fn();
  const utils = render(
    <table>
      <thead>
        <tr>
          <th>
            <ColumnResizeHandle
              columnId="name"
              active={false}
              onPointerDown={onPointerDown}
              {...props}
            />
          </th>
        </tr>
      </thead>
    </table>,
  );
  const handle = utils.container.querySelector('[data-column-resize-handle="name"]') as HTMLElement;
  return { handle, onPointerDown, ...utils };
}

describe("ColumnResizeHandle", () => {
  test("renders a separator with the column id wired to data attribute", () => {
    const { handle } = renderHandle();
    expect(handle).not.toBeNull();
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
  });

  test("invokes onPointerDown with the synthetic event", () => {
    const onPointerDown = vi.fn();
    const { handle } = renderHandle({ onPointerDown });
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  test("active state surfaces as data-active=true", () => {
    const { handle } = renderHandle({ active: true });
    expect(handle.getAttribute("data-active")).toBe("true");
  });

  test("stops the underlying mousedown so column-select drag does not fire", () => {
    const headerMouseDown = vi.fn();
    const { container } = render(
      <table>
        <thead>
          <tr>
            <th onMouseDown={headerMouseDown}>
              <ColumnResizeHandle columnId="name" active={false} onPointerDown={vi.fn()} />
            </th>
          </tr>
        </thead>
      </table>,
    );
    const handle = container.querySelector('[data-column-resize-handle="name"]') as HTMLElement;
    fireEvent.mouseDown(handle, { button: 0 });
    expect(headerMouseDown).not.toHaveBeenCalled();
  });
});
