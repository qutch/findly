import { FileTypeIcon } from "./FileTypeIcons";
import { FolderIcon } from "./Icons";
import type { SearchResult } from "../types";
import "./ResultItem.css";

interface ResultItemProps {
  result: SearchResult;
}

export function ResultItem({ result }: ResultItemProps) {
  const fileName = result.file?.name ?? "Untitled";
  const filePath = result.file?.path ?? "";

  const handleClick = () => {
    if (filePath) {
      window.api.openFile(filePath);
    }
  };

  const handleShowInFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (filePath) {
      window.api.showInFolder(filePath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="result-item" onClick={handleClick} onKeyDown={handleKeyDown} role="button" tabIndex={0}>
      <div className="result-item__icon">
        <FileTypeIcon filename={fileName} size={16} />
      </div>

      <div className="result-item__content">
        <div className="result-item__title">{fileName}</div>
        <div className="result-item__path">{filePath}</div>
        {result.summary && (
          <div className="result-item__summary">{String(result.summary)}</div>
        )}
      </div>

      <button
        className="result-item__action"
        onClick={handleShowInFolder}
        title="Show in folder"
      >
        <FolderIcon size={14} />
      </button>
    </div>
  );
}
