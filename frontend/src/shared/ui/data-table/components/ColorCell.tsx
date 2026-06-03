import * as Popover from "@radix-ui/react-popover";
import type { KeyboardEvent, ReactNode } from "react";
import { cmykToHex, hexToRgb, normalizeColorInput, rgbToCmyk, rgbToHex } from "../../../lib/color";

type CommitMove = { kind: "tab"; shiftKey: boolean } | { kind: "down" };

const PICKER_FALLBACK_COLOR = `#${"000000"}`;
const VIEWPORT_MARGIN_PX = 12;

export function ColorCell({ value }: { value: unknown }) {
  const normalized = typeof value === "string" ? normalizeColorInput(value) : null;
  if (!normalized) return <span className="muted-cell">Empty</span>;
  return (
    <span className="data-table-color-cell">
      <span className="data-table-color-swatch" style={{ background: normalized }} />
      <span className="data-table-color-value">{normalized}</span>
    </span>
  );
}

export function ColorCellEditor({
  value,
  onChange,
  onCancel,
  onCommit,
  onCommitAndMove,
  anchorChildren,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
  onCommitAndMove: (move: CommitMove) => void;
  anchorChildren: ReactNode;
}) {
  const parsed = normalizeColorInput(value);
  const normalized = parsed ?? PICKER_FALLBACK_COLOR;
  const rgb = hexToRgb(normalized) ?? { r: 0, g: 0, b: 0 };
  const cmyk = rgbToCmyk(rgb) ?? { c: 0, m: 0, y: 0, k: 100 };
  const invalid = value.trim().length > 0 && parsed === null;

  const updateRgb = (channel: "r" | "g" | "b", raw: string) => {
    const next = { ...rgb, [channel]: Number(raw) };
    const hex = rgbToHex(next);
    if (hex) onChange(hex);
  };

  const updateCmyk = (channel: "c" | "m" | "y" | "k", raw: string) => {
    const next = { ...cmyk, [channel]: Number(raw) };
    const hex = cmykToHex(next);
    if (hex) onChange(hex);
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Tab") {
      event.preventDefault();
      onCommitAndMove({ kind: "tab", shiftKey: event.shiftKey });
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onCommitAndMove({ kind: "down" });
    }
  };

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onCommit();
      }}
    >
      <Popover.Anchor asChild>{anchorChildren}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="data-table-color-editor"
          role="dialog"
          aria-label="Edit color"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={VIEWPORT_MARGIN_PX}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            onCancel();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={onEditorKeyDown}
        >
          <div className="data-table-color-editor-topline">
            <input
              aria-label="Color picker"
              type="color"
              value={normalized}
              onChange={(event) => onChange(event.target.value)}
            />
            <span
              className="data-table-color-editor-preview"
              style={{ background: normalized }}
              aria-hidden
            />
            <input
              autoFocus
              aria-label="Hex color"
              className="data-table-color-editor-hex"
              value={value}
              placeholder="#rrggbb"
              spellCheck={false}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
          <div className="data-table-color-editor-grid" aria-label="RGB channels">
            {(["r", "g", "b"] as const).map((channel) => (
              <label key={channel}>
                <span>{channel.toUpperCase()}</span>
                <input
                  aria-label={`RGB ${channel.toUpperCase()}`}
                  type="number"
                  min={0}
                  max={255}
                  step={1}
                  value={rgb[channel]}
                  onChange={(event) => updateRgb(channel, event.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="data-table-color-editor-grid" aria-label="CMYK channels">
            {(["c", "m", "y", "k"] as const).map((channel) => (
              <label key={channel}>
                <span>{channel.toUpperCase()}</span>
                <input
                  aria-label={`CMYK ${channel.toUpperCase()}`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={cmyk[channel]}
                  onChange={(event) => updateCmyk(channel, event.target.value)}
                />
              </label>
            ))}
          </div>
          {invalid ? <p className="data-table-color-editor-error">Use hex, RGB, or CMYK.</p> : null}
          <div className="data-table-color-editor-actions">
            <button type="button" onClick={() => onChange("")}>
              Clear
            </button>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={onCommit}>
              Save
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
