import { useEffect, useCallback } from "react";
import { FileTypeIcon } from "./FileTypeIcons";
import { FolderIcon } from "./Icons";
import type { SearchResult } from "../types";
import "./FilePreview.css";

interface FilePreviewProps {
  result: SearchResult;
  onClose: () => void;
  isRanking?: boolean;
}

export function FilePreview({ result, onClose, isRanking = false }: FilePreviewProps) {
  const filePath = result.file?.path ?? "";
  const fileName = result.file?.name ?? "Untitled";
  const metadata = result.metadata;
  const summary = result.summary;
  const isLoadingSummary = !summary && isRanking;

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOpenFile = useCallback(() => {
    if (filePath) window.api.openFile(filePath);
  }, [filePath]);

  const handleShowInFolder = useCallback(() => {
    if (filePath) window.api.showInFolder(filePath);
  }, [filePath]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div
        className="file-preview"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="file-preview__header">
          <div className="file-preview__icon">
            <FileTypeIcon filename={fileName} size={22} />
          </div>
          <div className="file-preview__title-block">
            <div className="file-preview__filename">{fileName}</div>
            <div className="file-preview__path">{filePath}</div>
          </div>
          <button
            className="file-preview__close"
            onClick={onClose}
            title="Close preview"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="file-preview__body">
          {/* Metadata — always shown instantly */}
          {metadata && (
            <div className="file-preview__meta">
              <div className="file-preview__meta-item">
                <span className="file-preview__meta-label">Type</span>
                <span className="file-preview__meta-value">{metadata.fileType || "Unknown"}</span>
              </div>
              <div className="file-preview__meta-item">
                <span className="file-preview__meta-label">Size</span>
                <span className="file-preview__meta-value">{metadata.sizeReadable}</span>
              </div>
              <div className="file-preview__meta-item">
                <span className="file-preview__meta-label">Modified</span>
                <span className="file-preview__meta-value">
                  {formatDate(metadata.lastModifiedReadable)}
                </span>
              </div>
              <div className="file-preview__meta-item">
                <span className="file-preview__meta-label">Accessed</span>
                <span className="file-preview__meta-value">
                  {formatDate(metadata.lastAccessedReadable)}
                </span>
              </div>
            </div>
          )}

          {/* Summary — reuses the ranking summary */}
          <div className="file-preview__summary-section">
            <div className="file-preview__summary-label">Summary</div>
            {isLoadingSummary ? (
              <div className="file-preview__summary-loading">
                <span className="file-preview__pulse-line" />
                <span className="file-preview__pulse-line file-preview__pulse-line--short" />
                <span className="file-preview__pulse-line file-preview__pulse-line--med" />
              </div>
            ) : (
              <div className="file-preview__summary-text">
                {summary || "No summary available."}
              </div>
            )}
          </div>
        </div>

        {/* Actions — sticky at bottom */}
        <div className="file-preview__actions">
          <button className="file-preview__btn file-preview__btn--primary" onClick={handleOpenFile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open File
          </button>
          <button className="file-preview__btn file-preview__btn--secondary" onClick={handleShowInFolder}>
            <FolderIcon size={14} />
            Show in Folder
          </button>
        </div>
      </div>
    </div>
  );
}
