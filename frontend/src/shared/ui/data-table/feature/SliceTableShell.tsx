// Banners + blockers + action-error shell that wraps a feature tab's
// table. Pulls the three pieces of UI that every slice-backed tab
// shipped verbatim (locked banner, draft-restored banner, edit-blocker
// banner with reload button, action-error paragraph) into a single
// component so future tabs don't re-implement them.
//
// The shell does NOT render the table itself, the sub-tab bar, the
// modal, or the footer action — those stay consumer-owned because
// they're feature-specific. The shell is essentially a `<section>`
// with a known banner stack and a `{children}` slot underneath.

import type { ReactNode } from "react";
import type { EditBlocker } from "./types";

export type SliceTableShellProps = {
  ariaLabel: string;
  className?: string;
  // The optional sub-tab bar (e.g. Rooms / TB / ERV / Pumps / Fans).
  // Stays outside `children` so the banner stack always renders below
  // the sub-tab bar, never below the table.
  subTabBar?: ReactNode;
  // Show the "Unsaved <X> draft restored" banner. Consumers compute
  // this themselves (it depends on `wasLocalDraftTouched`, the slice
  // source, and the active version).
  showDraftRestoredBanner: boolean;
  draftRestoredMessage: string;
  // Show the "This version is locked" banner. Same gating: the
  // consumer owns `versionLocked` because it composes both the
  // version-locked editBlocker and the project's `active_version`.
  isLocked: boolean;
  lockedMessage: string;
  editBlocker: EditBlocker | null;
  onReloadDraft: () => void;
  actionError: string | null;
  children: ReactNode;
};

export function SliceTableShell(props: SliceTableShellProps) {
  const {
    ariaLabel,
    className,
    subTabBar,
    showDraftRestoredBanner,
    draftRestoredMessage,
    isLocked,
    lockedMessage,
    editBlocker,
    onReloadDraft,
    actionError,
    children,
  } = props;
  return (
    <section className={className ?? "tab-panel"} aria-label={ariaLabel}>
      {subTabBar}
      {showDraftRestoredBanner ? <p className="draft-banner">{draftRestoredMessage}</p> : null}
      {isLocked ? <p className="draft-banner">{lockedMessage}</p> : null}
      {editBlocker ? (
        <div className="draft-banner draft-conflict-banner" role="alert">
          <span>{editBlocker.message}</span>
          {editBlocker.kind === "draft-conflict" ? (
            <button type="button" className="secondary-button" onClick={onReloadDraft}>
              Reload draft
            </button>
          ) : null}
        </div>
      ) : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {children}
    </section>
  );
}
