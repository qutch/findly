import { memo } from "react";
import type { FolderState } from "../types";
import { AlertIcon, FolderIcon, FolderPlusIcon, PlusIcon, XIcon } from "./Icons";

interface SidebarProps {
  folders: FolderState[];
  activeFolderPath: string | null;
  onAddFolder: () => void;
  onRemoveFolder: (path: string) => void;
  onSelectFolder: (path: string) => void;
}

const STATUS_LABEL: Record<FolderState["status"], string> = {
  indexing: "Indexing",
  ready: "Ready",
  error: "Error",
};

export const Sidebar = memo(function Sidebar({
  folders,
  activeFolderPath,
  onAddFolder,
  onRemoveFolder,
  onSelectFolder,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <span className="sidebar-title">Knowledge Base</span>
          <p className="sidebar-subtitle">Indexed folders</p>
        </div>
        <div className="sidebar-actions">
          <button className="btn-icon" onClick={onAddFolder} title="Add folder" aria-label="Add folder">
            <PlusIcon />
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="empty-state">
          <FolderPlusIcon className="empty-state-icon" />
          <span className="empty-state-text">
            Add a folder to build your local
            <br /> AI search index.
          </span>
          <button className="btn-add-folder" onClick={onAddFolder}>
            <PlusIcon size={14} />
            Add Folder
          </button>
        </div>
      ) : (
        <div className="folder-list">
          {folders.map((folder) => (
            <div
              key={folder.path}
              className={`folder-item ${activeFolderPath === folder.path ? "is-active" : ""}`}
            >
              <button className="folder-hit" onClick={() => onSelectFolder(folder.path)} title={folder.path}>
                <FolderIcon className="folder-icon" />
                <div className="folder-info">
                  <div className="folder-name">{folder.name}</div>
                  <div className="folder-path">{folder.path}</div>
                  <div className="folder-meta">
                    <span className={`folder-status folder-status-${folder.status}`}>
                      {folder.status === "error" && <AlertIcon size={12} />}
                      {STATUS_LABEL[folder.status]}
                    </span>
                    <span className="folder-indexed-count">{folder.indexedFiles} indexed</span>
                  </div>
                </div>
              </button>
              <button
                className="folder-remove"
                onClick={() => onRemoveFolder(folder.path)}
                title="Remove folder"
                aria-label={`Remove ${folder.name}`}
              >
                <XIcon size={14} />
              </button>
              {folder.lastError && <p className="folder-error">{folder.lastError}</p>}
              {folder.lastEventAt && (
                <p className="folder-updated">Updated {new Date(folder.lastEventAt).toLocaleTimeString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
});
