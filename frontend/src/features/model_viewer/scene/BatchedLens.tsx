import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, type BatchedMesh, type LineBasicMaterial } from "three";
import {
  VIEWER_FACE_EDGE_COLOR,
  VIEWER_FILTER_WIREFRAME_COLOR,
  type MaterialState,
  type ViewerTokens,
} from "../lib/colors";
import { bucketKeyForMeta, isBucketHidden } from "../lib/legendFilter";
import { isClickWithinDragTolerance, pointerPoint, type PointerPoint } from "../lib/selection";
import type { BuildingModel, BuildingRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { LegendFilter, ModelObjectMeta, ModelViewerLens, ModelViewerTheme } from "../types";
import { buildLensBatch, resolveInstanceColor, type LensBatch } from "./LensBatch";

type BatchedLensProps = {
  model: BuildingModel;
  lens: ModelViewerLens;
  tokens: ViewerTokens;
};

/**
 * A mesh lens rendered on the batched substrate (D-1/D-5). The lens's ~thousands
 * of per-face `<mesh>`es collapse into the two `THREE.BatchedMesh` batches + one
 * merged edge line built by `buildLensBatch`. Theming, selection, and hover are
 * per-instance `setColorAt` writes driven by ONE store subscriber (F6) instead
 * of a Zustand subscription per object, and picking reads `batchId` off the
 * raycast hit (D-9). Serves building / spaces / floor-areas / site-sun; only the
 * line lenses (ventilation/hot-water) stay on the per-mesh path (D-6).
 */
export function BatchedLens({ model, lens, tokens }: BatchedLensProps) {
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const interactive = !measureActive;
  const { invalidate } = useThree();

  const objects = useMemo(() => objectsForLens(model, lens), [model, lens]);
  // Build + own the batch inside the effect (not useMemo) so it's disposed
  // exactly once and rebuilt cleanly: under React StrictMode a `useMemo` batch +
  // `useEffect` dispose would dispose the memoized batch on the simulated unmount
  // and then reuse the disposed object on remount (CR3). `batch` is null for the
  // first render after a lens change, until the fresh batch is built.
  const [batch, setBatch] = useState<LensBatch | null>(null);
  useEffect(() => {
    const built = buildLensBatch(objects);
    setBatch(built);
    return () => built.dispose();
  }, [objects]);

  useBatchColors(batch, model.metaById, lens, tokens, invalidate);
  useBatchFilter(batch, model.metaById, lens, invalidate);
  useLensFadeIn(batch, invalidate);

  const handlers = usePickHandlers(batch, interactive);

  if (!batch) return null;
  return (
    <group name={`${lens}-lens`}>
      {batch.opaqueMesh ? <primitive object={batch.opaqueMesh} {...handlers} /> : null}
      {batch.transparentMesh ? <primitive object={batch.transparentMesh} {...handlers} /> : null}
      <primitive object={batch.edges} />
    </group>
  );
}

/** The mesh renderables a batched lens draws: building + site-sun both show the
 *  prebuilt building context; the rest filter the model's objects to that lens. */
function objectsForLens(model: BuildingModel, lens: ModelViewerLens): BuildingRenderable[] {
  if (lens === "building" || lens === "site-sun") return model.buildingObjects;
  return model.objects.filter(
    (object): object is BuildingRenderable => object.kind === "mesh" && object.lens === lens,
  );
}

/**
 * The single subscriber that keeps the batch's per-instance colors in sync with
 * the store (F6). It repaints on theme change and applies/restores the highlight
 * on selection/hover change, touching only the objects whose color actually
 * changed (or every object on a theme switch). Reads everything off the store so
 * inspector/camera consumers stay untouched.
 *
 * The batch highlights selection/hover as a flat color swap; the per-mesh path
 * (`materialForObject`) additionally glows via emissive. That divergence is
 * intentional for the temporary dual path and disappears when Phase 04 retires
 * the per-mesh lenses (D-5).
 */
function useBatchColors(
  batch: LensBatch | null,
  metaById: Map<string, ModelObjectMeta>,
  lens: ModelViewerLens,
  tokens: ViewerTokens,
  invalidate: () => void,
): void {
  useEffect(() => {
    if (!batch) return;
    const store = useModelViewerStore;
    // Cache parsed Colors by hex so the paint loop never re-parses a CSS string;
    // resolved colors are static per (type, theme, state) + the highlight tokens.
    const colorCache = new Map<string, Color>();
    const colorFor = (hex: string): Color => {
      let color = colorCache.get(hex);
      if (!color) {
        color = new Color(hex);
        colorCache.set(hex, color);
      }
      return color;
    };

    // Paint one object given the selection/hover/theme already read for this
    // pass. A multi-geometry object (e.g. a space) recolors all its instances.
    const paint = (
      id: string,
      selectionId: string | null,
      hoverId: string | null,
      theme: ModelViewerTheme,
    ) => {
      const locations = batch.batchForId.get(id);
      const meta = metaById.get(id);
      if (!locations || !meta) return;
      const state: MaterialState =
        id === selectionId ? "selected" : id === hoverId ? "hovered" : "base";
      const color = colorFor(resolveInstanceColor(meta, lens, theme, state, tokens));
      for (const location of locations) location.mesh.setColorAt(location.instanceId, color);
    };

    const repaint = (ids: Iterable<string>) => {
      const { selectionId, hoverId, themesByLens } = store.getState();
      const theme = themesByLens[lens];
      for (const id of ids) paint(id, selectionId, hoverId, theme);
      invalidate();
    };

    // Initial paint honors the theme/selection the store already holds.
    repaint(batch.batchForId.keys());

    return store.subscribe((state, previous) => {
      const themeChanged = state.themesByLens[lens] !== previous.themesByLens[lens];
      if (themeChanged) {
        repaint(batch.batchForId.keys());
      } else if (state.selectionId !== previous.selectionId || state.hoverId !== previous.hoverId) {
        repaint(affectedIds(previous, state));
      }
    });
  }, [batch, metaById, lens, tokens, invalidate]);
}

/** The object ids whose resting/highlight color may differ across a store step. */
function affectedIds(
  previous: { selectionId: string | null; hoverId: string | null },
  next: { selectionId: string | null; hoverId: string | null },
): Set<string> {
  const ids = new Set<string>();
  for (const id of [previous.selectionId, previous.hoverId, next.selectionId, next.hoverId]) {
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Applies the active legend filter to the batch (NEW-VIEW-2). A single store
 * subscriber — mirroring `useBatchColors` — toggles per-instance visibility via
 * `BatchedMesh.setVisibleAt` (hidden instances are skipped by the renderer *and*
 * the raycaster, so picking is gated for free) and lightens the lens's one merged
 * edge line to `VIEWER_FILTER_WIREFRAME_COLOR`, leaving the whole building as a
 * faint wireframe context behind the solid matched bucket. Everything is restored
 * to fully visible + the normal edge color whenever the filter clears (which the
 * store forces on every lens/theme/file change).
 */
function useBatchFilter(
  batch: LensBatch | null,
  metaById: Map<string, ModelObjectMeta>,
  lens: ModelViewerLens,
  invalidate: () => void,
): void {
  useEffect(() => {
    if (!batch) return;
    const store = useModelViewerStore;
    const edgeMaterial = batch.edges.material as LineBasicMaterial;

    const apply = (filter: LegendFilter | null, theme: ModelViewerTheme) => {
      const filtering = filter !== null && filter.theme === theme;
      for (const [id, locations] of batch.batchForId) {
        const meta = metaById.get(id);
        const hidden =
          filtering &&
          (!meta || isBucketHidden(bucketKeyForMeta(meta, lens, theme), theme, filter));
        for (const location of locations) location.mesh.setVisibleAt(location.instanceId, !hidden);
      }
      edgeMaterial.color.set(filtering ? VIEWER_FILTER_WIREFRAME_COLOR : VIEWER_FACE_EDGE_COLOR);
      invalidate();
    };

    const read = () => {
      const { legendFilter, themesByLens } = store.getState();
      apply(legendFilter, themesByLens[lens]);
    };

    read(); // honor any filter the store already holds when the batch mounts
    return store.subscribe((state, previous) => {
      if (
        state.legendFilter !== previous.legendFilter ||
        state.themesByLens[lens] !== previous.themesByLens[lens]
      ) {
        read();
      }
    });
  }, [batch, metaById, lens, invalidate]);
}

/** R3F pointer handlers shared by both batch primitives; picking reads `batchId`. */
function usePickHandlers(batch: LensBatch | null, interactive: boolean) {
  const pointerDown = useRef<PointerPoint | null>(null);

  return useMemo(() => {
    const idFromEvent = (event: ThreeEvent<PointerEvent | MouseEvent>): string | null => {
      if (!batch || event.batchId === undefined) return null;
      return batch.idForBatch.get(event.object as BatchedMesh)?.get(event.batchId) ?? null;
    };

    return {
      onPointerDown: (event: ThreeEvent<PointerEvent>) => {
        if (!interactive) return;
        pointerDown.current = pointerPoint(event);
      },
      onPointerMove: (event: ThreeEvent<PointerEvent>) => {
        if (!interactive) return;
        event.stopPropagation();
        const store = useModelViewerStore.getState();
        const id = idFromEvent(event);
        // Pointer-move fires every frame; skip the work when still on the same id.
        if (id !== store.hoverId) store.setHoverId(id);
      },
      onPointerOut: (event: ThreeEvent<PointerEvent>) => {
        if (!interactive) return;
        event.stopPropagation();
        useModelViewerStore.getState().setHoverId(null);
      },
      onClick: (event: ThreeEvent<MouseEvent>) => {
        if (!interactive) return;
        event.stopPropagation();
        if (!isClickWithinDragTolerance(pointerDown.current, pointerPoint(event))) return;
        useModelViewerStore.getState().setSelectionId(idFromEvent(event));
      },
      onDoubleClick: (event: ThreeEvent<MouseEvent>) => {
        if (!interactive) return;
        event.stopPropagation();
        const id = idFromEvent(event);
        if (!id) return;
        const store = useModelViewerStore.getState();
        store.setSelectionId(id);
        store.requestCamera("zoomTo", id);
      },
    };
  }, [batch, interactive]);
}

/** Seconds the incoming lens takes to fade up to full opacity (D-8, fade-in only). */
const LENS_FADE_IN_SECONDS = 0.18;

/**
 * Fade the batch in when it mounts (D-8): `batch.setOpacity` ramps its materials
 * from 0 to full over `LENS_FADE_IN_SECONDS`, driven by a self-terminating
 * `requestAnimationFrame` loop — no React state churn and no permanent `useFrame`
 * subscriber (F8). Each frame `invalidate()`s the demand loop; the rAF stops at
 * full opacity (restoring opaque early-Z), so the scene goes idle (A6). There is
 * no outgoing batch: the previous lens unmounts and disposes normally (fade-in,
 * not cross-fade — Ed's call). `useLayoutEffect` hides the batch before its first
 * rendered frame so there is no one-frame flash; cleanup cancels an in-flight
 * fade when the lens/model changes.
 */
function useLensFadeIn(batch: LensBatch | null, invalidate: () => void): void {
  useLayoutEffect(() => {
    if (!batch) return;
    batch.setOpacity(0);
    invalidate();
    let start = 0;
    let frame = window.requestAnimationFrame(function tick(now) {
      if (!start) start = now;
      const progress = Math.min((now - start) / (LENS_FADE_IN_SECONDS * 1000), 1);
      batch.setOpacity(easeOutQuad(progress));
      invalidate();
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [batch, invalidate]);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
