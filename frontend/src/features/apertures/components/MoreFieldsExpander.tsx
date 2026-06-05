// Native `<details>` wrapper used to reveal additional ref fields
// below the headline columns on a FrameRow / GlazingRow.

import type { ReactNode } from "react";

export function MoreFieldsExpander({ children }: { children: ReactNode }) {
  return (
    <details className="aperture-more-fields">
      <summary className="aperture-more-fields__summary">More fields…</summary>
      <div className="aperture-more-fields__body">{children}</div>
    </details>
  );
}
