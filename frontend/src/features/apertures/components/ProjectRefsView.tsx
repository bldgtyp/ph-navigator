// Phase 12 — read-only modal listing every distinct ref picked across
// the project's apertures. Two tabs (Frames / Glazings), each grouped
// into ``Catalog`` (deduped by ``catalog_record_id``) and
// ``Hand-entered`` (per-occurrence). The PRD §6.1 replacement for the
// V1 Frame Types / Glazing Types sub-tabs.

import { useState } from "react";
import { AppSubTabButton, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import type { ApertureTypeEntry } from "../types";
import {
  aggregateFrameRefs,
  aggregateGlazingRefs,
  type FrameRefUsage,
  type GlazingRefUsage,
} from "../lib/refsAggregation";

export type ProjectRefsViewProps = {
  open: boolean;
  apertures: ApertureTypeEntry[];
  onClose: () => void;
};

type Tab = "frames" | "glazings";

export function ProjectRefsView({ open, apertures, onClose }: ProjectRefsViewProps) {
  const [tab, setTab] = useState<Tab>("frames");
  if (!open) return null;

  const frameRefs = aggregateFrameRefs(apertures);
  const glazingRefs = aggregateGlazingRefs(apertures);

  return (
    <div className="project-refs__backdrop" role="presentation" onClick={onClose}>
      <div
        className="project-refs"
        role="dialog"
        aria-modal="true"
        aria-label="Picked frames and glazings"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="project-refs__header">
          <h2>Picked frames &amp; glazings</h2>
          <AppSubTabs ariaLabel="Picked reference tables" role="tablist">
            <AppSubTabButton role="tab" active={tab === "frames"} onClick={() => setTab("frames")}>
              Frames ({frameRefs.length})
            </AppSubTabButton>
            <AppSubTabButton
              role="tab"
              active={tab === "glazings"}
              onClick={() => setTab("glazings")}
            >
              Glazings ({glazingRefs.length})
            </AppSubTabButton>
          </AppSubTabs>
        </header>
        {tab === "frames" ? <FramesTab refs={frameRefs} /> : <GlazingsTab refs={glazingRefs} />}
        <footer className="project-refs__footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function FramesTab({ refs }: { refs: FrameRefUsage[] }) {
  if (refs.length === 0) return <p className="project-refs__empty">No frames picked yet.</p>;
  const catalog = refs.filter((r) => r.origin === "catalog");
  const handEntered = refs.filter((r) => r.origin === "hand_enter");
  return (
    <div className="project-refs__body">
      {catalog.length > 0 ? (
        <section>
          <h3>Catalog</h3>
          <table className="project-refs__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Manufacturer</th>
                <th>Operation</th>
                <th>Location</th>
                <th>Width (mm)</th>
                <th>U (W/m²K)</th>
                <th>Ψ-g</th>
                <th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((row, i) => (
                <FrameRefRow key={`cat-${i}`} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {handEntered.length > 0 ? (
        <section>
          <h3>Hand-entered</h3>
          <table className="project-refs__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Manufacturer</th>
                <th>Operation</th>
                <th>Location</th>
                <th>Width (mm)</th>
                <th>U (W/m²K)</th>
                <th>Ψ-g</th>
                <th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {handEntered.map((row, i) => (
                <FrameRefRow key={`hand-${i}`} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function GlazingsTab({ refs }: { refs: GlazingRefUsage[] }) {
  if (refs.length === 0) return <p className="project-refs__empty">No glazings picked yet.</p>;
  const catalog = refs.filter((r) => r.origin === "catalog");
  const handEntered = refs.filter((r) => r.origin === "hand_enter");
  return (
    <div className="project-refs__body">
      {catalog.length > 0 ? (
        <section>
          <h3>Catalog</h3>
          <GlazingTable refs={catalog} />
        </section>
      ) : null}
      {handEntered.length > 0 ? (
        <section>
          <h3>Hand-entered</h3>
          <GlazingTable refs={handEntered} />
        </section>
      ) : null}
    </div>
  );
}

function GlazingTable({ refs }: { refs: GlazingRefUsage[] }) {
  return (
    <table className="project-refs__table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Manufacturer</th>
          <th>U (W/m²K)</th>
          <th>g-value</th>
          <th>Used by</th>
        </tr>
      </thead>
      <tbody>
        {refs.map((row, i) => (
          <tr key={i}>
            <td>{row.refSnapshot.name}</td>
            <td>{row.refSnapshot.manufacturer ?? "—"}</td>
            <td>{row.refSnapshot.u_value_w_m2k ?? "—"}</td>
            <td>{row.refSnapshot.g_value ?? "—"}</td>
            <td>
              {row.usages.length} element{row.usages.length === 1 ? "" : "s"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FrameRefRow({ row }: { row: FrameRefUsage }) {
  const r = row.refSnapshot;
  return (
    <tr>
      <td>{r.name}</td>
      <td>{r.manufacturer ?? "—"}</td>
      <td>{r.operation ?? "—"}</td>
      <td>{r.location ?? "—"}</td>
      <td>{r.width_mm ?? "—"}</td>
      <td>{r.u_value_w_m2k ?? "—"}</td>
      <td>{r.psi_g_w_mk ?? "—"}</td>
      <td>
        {row.usages.length} element{row.usages.length === 1 ? "" : "s"}
      </td>
    </tr>
  );
}
