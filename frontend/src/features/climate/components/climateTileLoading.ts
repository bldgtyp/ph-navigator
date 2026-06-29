export type ClimateTileLoadingChangeHandler = (loading: boolean) => void;

export type ClimateTileLoadingTracker = {
  markLayerLoading: () => void;
  markTileLoading: () => void;
  markTileSettled: () => void;
  markLayerLoaded: () => void;
  reset: () => void;
};

export function createClimateTileLoadingTracker(
  onLoadingChange?: ClimateTileLoadingChangeHandler,
): ClimateTileLoadingTracker {
  let pendingTiles = 0;

  const setLoading = (loading: boolean): void => {
    onLoadingChange?.(loading);
  };

  return {
    markLayerLoading: () => {
      setLoading(true);
    },
    markTileLoading: () => {
      pendingTiles += 1;
      setLoading(true);
    },
    markTileSettled: () => {
      pendingTiles = Math.max(0, pendingTiles - 1);
      if (pendingTiles === 0) setLoading(false);
    },
    markLayerLoaded: () => {
      pendingTiles = 0;
      setLoading(false);
    },
    reset: () => {
      pendingTiles = 0;
      setLoading(false);
    },
  };
}
