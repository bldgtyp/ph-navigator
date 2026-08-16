// Staged (not yet written) Installs-modal edits. Everything the user does in
// the modal — painting edges, creating or re-valuing a type, choosing copy
// targets — accumulates here and is written only on Save, so Cancel/Escape
// genuinely discards instead of leaving half the session in the draft.
//
// The staged types carry their real row ids (`newInstallTypeId`), so an edge
// can be painted with a type that does not exist in the document yet and the
// commands written on Save are still self-consistent.

import { classifyElementEdges, edgeClassKey } from "./edge-classification";
import type { InstallTypeCreate, InstallTypePatch } from "./installs/useInstallTypeWrites";
import {
  APERTURE_SIDES,
  type ApertureCommand,
  type ApertureInstallTypeSummary,
  type ApertureSide,
  type ApertureTypeEntry,
} from "./types";

export type StagedInstall = {
  elementId: string;
  side: ApertureSide;
  installTypeId: string | null;
};

export type InstallsDraft = {
  /** Edge slot overrides, keyed by {@link edgeClassKey}. */
  installs: ReadonlyMap<string, StagedInstall>;
  creates: readonly InstallTypeCreate[];
  patches: ReadonlyMap<string, InstallTypePatch>;
  /** Apertures that receive this one's assignments on Save. */
  copyTargets: readonly string[];
};

export const EMPTY_INSTALLS_DRAFT: InstallsDraft = {
  installs: new Map(),
  creates: [],
  patches: new Map(),
  copyTargets: [],
};

export function installsDraftIsDirty(draft: InstallsDraft): boolean {
  return (
    draft.installs.size > 0 ||
    draft.creates.length > 0 ||
    draft.patches.size > 0 ||
    draft.copyTargets.length > 0
  );
}

export function stageInstall(
  draft: InstallsDraft,
  elementId: string,
  side: ApertureSide,
  installTypeId: string | null,
): InstallsDraft {
  const installs = new Map(draft.installs);
  installs.set(edgeClassKey(elementId, side), { elementId, side, installTypeId });
  return { ...draft, installs };
}

export function stageTypeCreate(draft: InstallsDraft, create: InstallTypeCreate): InstallsDraft {
  return { ...draft, creates: [...draft.creates, create] };
}

/** Stage a rename / re-value. Editing a type that is itself still staged folds
 *  into that insert rather than becoming a patch of a non-existent row.
 *  `psiEdited` false keeps whatever Ψ the draft already carries, so display
 *  rounding can never quantize a value the user did not touch. */
export function stageTypeEdit(
  draft: InstallsDraft,
  installTypeId: string,
  name: string,
  psiWmk: number | null,
  psiEdited: boolean,
): InstallsDraft {
  if (draft.creates.some((create) => create.id === installTypeId)) {
    return {
      ...draft,
      creates: draft.creates.map((create) =>
        create.id === installTypeId
          ? { ...create, name, psiWmk: psiEdited ? psiWmk : create.psiWmk }
          : create,
      ),
    };
  }
  const previous = draft.patches.get(installTypeId);
  const psi: Pick<InstallTypePatch, "psiWmk"> = psiEdited
    ? { psiWmk }
    : previous && previous.psiWmk !== undefined
      ? { psiWmk: previous.psiWmk }
      : {};
  const patches = new Map(draft.patches);
  patches.set(installTypeId, { id: installTypeId, name, ...psi });
  return { ...draft, patches };
}

/** The legend's view of the library: saved rows with staged edits applied,
 *  followed by staged new rows. */
export function draftInstallTypes(
  installTypes: readonly ApertureInstallTypeSummary[],
  draft: InstallsDraft,
): ApertureInstallTypeSummary[] {
  const patched = installTypes.map((installType) => {
    const patch = draft.patches.get(installType.id);
    if (!patch) return installType;
    return {
      ...installType,
      name: patch.name,
      psi_w_mk: patch.psiWmk === undefined ? installType.psi_w_mk : patch.psiWmk,
    };
  });
  return [
    ...patched,
    ...draft.creates.map((create) => ({
      id: create.id,
      name: create.name,
      psi_w_mk: create.psiWmk,
      source: null,
      has_pdf: false,
    })),
  ];
}

/** The aperture as the key view should draw it: saved slots with staged edge
 *  assignments laid over them. */
export function draftApertureEntry(
  aperture: ApertureTypeEntry,
  draft: InstallsDraft,
): ApertureTypeEntry {
  if (draft.installs.size === 0) return aperture;
  return {
    ...aperture,
    elements: aperture.elements.map((element) => {
      const installs = { ...element.installs };
      let changed = false;
      for (const side of APERTURE_SIDES) {
        const staged = draft.installs.get(edgeClassKey(element.id, side));
        if (!staged) continue;
        installs[side] = staged.installTypeId;
        changed = true;
      }
      return changed ? { ...element, installs } : element;
    }),
  };
}

/** Commands for the staged work, in write order: edge assignments that differ
 *  from what the document already holds, then the copy-to fan-out (which reads
 *  the just-written source aperture). Type-library writes are not commands —
 *  they go through `useInstallTypeWrites.commit` before any of these. */
export function installsDraftCommands(
  aperture: ApertureTypeEntry,
  draft: InstallsDraft,
): ApertureCommand[] {
  const elementsById = new Map(aperture.elements.map((element) => [element.id, element]));
  const edges: ApertureCommand[] = [];
  for (const staged of draft.installs.values()) {
    const element = elementsById.get(staged.elementId);
    if (!element || element.installs[staged.side] === staged.installTypeId) continue;
    edges.push({
      kind: "setElementInstall",
      aperture_type_id: aperture.id,
      element_id: staged.elementId,
      side: staged.side,
      install_type_id: staged.installTypeId,
    });
  }
  // Every write is a document write, so "apply to all edges" would otherwise
  // cost one round trip per edge. When the staged result leaves every
  // perimeter edge carrying the same type, the backend's bulk command says
  // exactly that in one write.
  const uniform = uniformPerimeterSlot(aperture, draft);
  const commands: ApertureCommand[] =
    edges.length > 1 && uniform !== undefined
      ? [
          {
            kind: "applyInstallToApertures",
            aperture_ids: [aperture.id],
            install_type_id: uniform,
          },
        ]
      : edges;
  if (draft.copyTargets.length > 0) {
    commands.push({
      kind: "copyElementInstalls",
      source_aperture_id: aperture.id,
      target_aperture_ids: [...draft.copyTargets],
    });
  }
  return commands;
}

/** The install type every perimeter edge carries after staging, or `undefined`
 *  when they differ (or there are no perimeter edges). Mulled edges are
 *  excluded — they carry no assignment. */
function uniformPerimeterSlot(
  aperture: ApertureTypeEntry,
  draft: InstallsDraft,
): string | null | undefined {
  const classes = classifyElementEdges(aperture);
  const staged = draftApertureEntry(aperture, draft);
  let slot: string | null | undefined;
  let seen = false;
  for (const element of staged.elements) {
    if (element.kind !== "glazed") continue;
    for (const side of APERTURE_SIDES) {
      if (classes.get(edgeClassKey(element.id, side)) === "interior") continue;
      if (!seen) {
        slot = element.installs[side];
        seen = true;
        continue;
      }
      if (element.installs[side] !== slot) return undefined;
    }
  }
  return seen ? slot : undefined;
}
