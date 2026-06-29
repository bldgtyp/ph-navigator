import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function BlockingProgressOverlay({
  label,
  title = label,
}: {
  label: string;
  title?: string;
}) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="blocking-progress-overlay" role="presentation">
      <section
        ref={panelRef}
        className="blocking-progress-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <span className="blocking-progress-overlay__spinner" aria-hidden="true" />
        <p className="blocking-progress-overlay__status" role="status" aria-live="polite">
          {label}
        </p>
      </section>
    </div>,
    document.body,
  );
}
