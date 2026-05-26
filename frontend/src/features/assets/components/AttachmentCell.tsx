import "../attachments.css";
import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { assetDownloadPath } from "../api";
import { uploadAsset, useAssetUrls } from "../hooks";
import { sameAttachmentAssetIds } from "../lib";
import type { AssetUrls, AttachmentFieldConfig } from "../types";

export function AttachmentCell({
  projectId,
  value,
  config,
  readOnly,
  onChange,
  assetUrlById,
}: {
  projectId: string;
  value: string[];
  config: AttachmentFieldConfig;
  readOnly: boolean;
  onChange: (next: string[]) => Promise<void> | void;
  assetUrlById?: ReadonlyMap<string, AssetUrls>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selected, setSelected] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const urls = useAssetUrls(projectId, assetUrlById ? [] : value);
  const urlById = useMemo(
    () => assetUrlById ?? new Map((urls.data ?? []).map((item) => [item.asset_id, item])),
    [assetUrlById, urls.data],
  );

  const accept = config.allowedTypes.join(",");
  const commitChange = async (next: string[]) => {
    if (!sameAttachmentAssetIds(value, next)) await onChange(next);
  };
  const attachFiles = async (files: FileList | File[]) => {
    if (readOnly) return;
    const accepted = Array.from(files).filter((file) => {
      if (!config.allowedTypes.includes(file.type || "application/octet-stream")) {
        return (
          file.name.toLowerCase().endsWith(".hbjson") &&
          config.allowedTypes.includes("application/json")
        );
      }
      return true;
    });
    const next = [...value];
    setPending(accepted.map((file) => file.name));
    try {
      for (const file of accepted) {
        if (next.length >= config.maxCount) break;
        const assetId = await uploadAsset(projectId, config.assetKind, file);
        if (!next.includes(assetId)) next.push(assetId);
      }
      await commitChange(next);
    } finally {
      setPending([]);
    }
  };

  const detachSelected = async () => {
    if (readOnly || value.length === 0) return;
    const next = value.filter((_, index) => index !== selected);
    await commitChange(next);
    setSelected(Math.max(0, Math.min(selected, next.length - 1)));
  };

  const replaceSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || readOnly || modalIndex === null) return;
    const assetId = await uploadAsset(projectId, config.assetKind, file);
    const next = value.map((existing, index) => (index === modalIndex ? assetId : existing));
    await commitChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight")
      setSelected((current) => Math.min(value.length - 1, current + 1));
    if (event.key === "ArrowLeft") setSelected((current) => Math.max(0, current - 1));
    if (event.key === "Enter" || event.key === " ") setModalIndex(selected);
    if (event.key === "Delete" || event.key === "Backspace") void detachSelected();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void attachFiles(event.dataTransfer.files);
  };

  return (
    <div
      className="attachment-cell"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        if (!readOnly) event.preventDefault();
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        className="attachment-file-input"
        type="file"
        multiple
        accept={accept}
        onChange={(event) => void attachFiles(event.target.files ?? [])}
      />
      {value.length === 0 && pending.length === 0 ? (
        <button
          type="button"
          className="attachment-drop-button"
          disabled={readOnly}
          onClick={() => inputRef.current?.click()}
        >
          <span aria-hidden="true">📎</span>
          <span>Drop files here</span>
        </button>
      ) : (
        <div className="attachment-strip">
          {value.map((assetId, index) => {
            const asset = urlById.get(assetId);
            return (
              <button
                type="button"
                key={`${assetId}-${index}`}
                className={`attachment-thumb ${index === selected ? "selected" : ""}`}
                title={asset ? `${asset.original_filename} · ${asset.content_type}` : assetId}
                onClick={() => setSelected(index)}
                onDoubleClick={() => setModalIndex(index)}
              >
                {asset?.thumbnail_url ? (
                  <img src={asset.thumbnail_url} alt="" />
                ) : (
                  <span>{fileGlyph(asset?.content_type)}</span>
                )}
              </button>
            );
          })}
          {pending.map((name) => (
            <span className="attachment-pending" key={name}>
              uploading...
            </span>
          ))}
        </div>
      )}
      {modalIndex !== null && value[modalIndex]
        ? createPortal(
            <AttachmentModal
              projectId={projectId}
              assetId={value[modalIndex]}
              asset={urlById.get(value[modalIndex])}
              readOnly={readOnly}
              onClose={() => setModalIndex(null)}
              onPrev={() => setModalIndex((current) => Math.max(0, (current ?? 0) - 1))}
              onNext={() =>
                setModalIndex((current) => Math.min(value.length - 1, (current ?? 0) + 1))
              }
              onDetach={() => void detachSelected()}
              onReplace={replaceSelected}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function AttachmentModal({
  projectId,
  assetId,
  asset,
  readOnly,
  onClose,
  onPrev,
  onNext,
  onDetach,
  onReplace,
}: {
  projectId: string;
  assetId: string;
  asset: AssetUrls | undefined;
  readOnly: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDetach: () => void;
  onReplace: (files: FileList | null) => void;
}) {
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const isImage = asset?.content_type.startsWith("image/");
  return (
    <div className="attachment-modal" role="dialog" aria-modal="true">
      <div className="attachment-modal-panel">
        <header>
          <strong>{asset?.original_filename ?? assetId}</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="attachment-preview">
          {isImage && asset?.preview_url ? (
            <img src={asset.preview_url} alt={asset.original_filename} />
          ) : asset?.content_type === "application/pdf" && asset.preview_url ? (
            <iframe title={asset.original_filename} src={asset.preview_url} />
          ) : (
            <div className="attachment-file-panel">
              <span>{fileGlyph(asset?.content_type)}</span>
              <p>{asset?.content_type ?? "File"}</p>
            </div>
          )}
        </div>
        <footer>
          <button type="button" onClick={onPrev} aria-label="Previous">
            ←
          </button>
          <button type="button" onClick={onNext} aria-label="Next">
            →
          </button>
          <a href={assetDownloadPath(projectId, assetId)}>Download</a>
          {asset?.preview_url ? (
            <a href={asset.preview_url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          ) : null}
          {!readOnly ? (
            <>
              <input
                ref={replaceRef}
                type="file"
                className="attachment-file-input"
                onChange={(event) => onReplace(event.target.files)}
              />
              <button type="button" onClick={() => replaceRef.current?.click()}>
                Replace...
              </button>
              <button type="button" onClick={onDetach}>
                Detach
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function fileGlyph(contentType: string | undefined | null): string {
  if (contentType === "application/pdf") return "PDF";
  if (contentType?.includes("json")) return "JSON";
  return "FILE";
}
