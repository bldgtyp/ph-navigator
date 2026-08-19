import { describe, expect, test } from "vitest";
import {
  INSTALL_PREVIEW_MAX_ZOOM,
  INSTALL_PREVIEW_PADDING_PX,
  fitInstallPreview,
} from "../install-preview-fit";

describe("fitInstallPreview", () => {
  test("uses the available width for a landscape aperture", () => {
    const viewport = fitInstallPreview({
      availableWidthPx: 400,
      availableHeightPx: 500,
      apertureWidthMm: 2000,
      apertureHeightMm: 1000,
    });

    expect(viewport).not.toBeNull();
    expect(viewport?.widthPx).toBeCloseTo(368);
    expect(viewport?.heightPx).toBeCloseTo(184);
    expect(viewport?.originX).toBeCloseTo(INSTALL_PREVIEW_PADDING_PX);
    expect(viewport?.originY).toBeCloseTo(158);
  });

  test("uses the available height for a portrait aperture", () => {
    const viewport = fitInstallPreview({
      availableWidthPx: 400,
      availableHeightPx: 500,
      apertureWidthMm: 1000,
      apertureHeightMm: 3000,
    });

    expect(viewport).not.toBeNull();
    expect(viewport?.widthPx).toBeCloseTo(156);
    expect(viewport?.heightPx).toBeCloseTo(468);
    expect(viewport?.originX).toBeCloseTo(122);
    expect(viewport?.originY).toBeCloseTo(INSTALL_PREVIEW_PADDING_PX);
  });

  test("keeps the drawing inside the requested padding on every side", () => {
    const viewport = fitInstallPreview({
      availableWidthPx: 640,
      availableHeightPx: 360,
      apertureWidthMm: 1800,
      apertureHeightMm: 1200,
      paddingPx: 24,
    });

    expect(viewport).not.toBeNull();
    expect(viewport!.originX).toBeGreaterThanOrEqual(24);
    expect(viewport!.originY).toBeGreaterThanOrEqual(24);
    expect(640 - viewport!.originX - viewport!.widthPx).toBeGreaterThanOrEqual(24);
    expect(360 - viewport!.originY - viewport!.heightPx).toBeGreaterThanOrEqual(24);
  });

  test("caps scale-up for very small apertures", () => {
    const viewport = fitInstallPreview({
      availableWidthPx: 1000,
      availableHeightPx: 1000,
      apertureWidthMm: 100,
      apertureHeightMm: 100,
    });

    expect(viewport).not.toBeNull();
    expect(viewport?.zoom).toBe(INSTALL_PREVIEW_MAX_ZOOM);
  });

  test("waits for a measurable container and valid aperture dimensions", () => {
    expect(
      fitInstallPreview({
        availableWidthPx: 0,
        availableHeightPx: 500,
        apertureWidthMm: 1000,
        apertureHeightMm: 1000,
      }),
    ).toBeNull();
    expect(
      fitInstallPreview({
        availableWidthPx: 500,
        availableHeightPx: 500,
        apertureWidthMm: 0,
        apertureHeightMm: 1000,
      }),
    ).toBeNull();
  });
});
